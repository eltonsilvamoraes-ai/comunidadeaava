/* Projeto Escala — frontend (Fase 1 auth + Fase 2 voluntários/CSV) */
(function () {
  'use strict';

  const cfg = window.SUPA_CONFIG || {};
  const configOk = cfg.URL && cfg.ANON_KEY &&
    cfg.URL.indexOf('COLE_AQUI') === -1 && cfg.ANON_KEY.indexOf('COLE_AQUI') === -1;

  let sb = null;
  let igrejaId = null;          // igreja do usuário logado
  let papelAtual = null;         // 'admin' | 'lider'
  let deptosCache = [];          // [{id, nome, ativo}]

  /* ----- Navegação ----- */
  // Telas de entrada (sem menu lateral). As demais usam o shell do app.
  const TELAS_LOGIN = { 'tela-load': 1, 'tela-auth': 1, 'tela-igreja': 1 };
  // Título e subtítulo da barra superior por tela.
  const TITULOS = {
    'tela-home': ['Painel', 'Visão geral da sua igreja'],
    'tela-voluntarios': ['Voluntários', 'Cadastre e gerencie quem serve'],
    'tela-departamentos': ['Departamentos', 'Áreas de serviço da igreja'],
    'tela-importar': ['Importar voluntários', 'Suba uma planilha (.xlsx, .csv ou .tsv)'],
    'tela-cultos-fixos': ['Cultos fixos', 'Os cultos que se repetem toda semana'],
    'tela-cultos': ['Cultos do mês', 'Gere e ajuste a agenda do mês'],
    'tela-escala': ['Montar escala', 'Defina quem serve em cada culto'],
    'tela-checkin': ['Check-in', 'Marque quem compareceu em cada escala'],
    'tela-presenca': ['Mapa de presença', 'Quem esteve no culto (mesmo sem escala)'],
    'tela-lideres': ['Líderes', 'Autorize acessos e defina as equipes'],
    'tela-dashboard': ['Relatórios', 'Comparecimento: escalados × check-ins'],
    'tela-dados-igreja': ['Dados da igreja', 'Informações do cadastro'],
    'tela-planos': ['Meus planos', 'Seu plano atual']
  };
  function irPara(id) {
    const ehLogin = !!TELAS_LOGIN[id];
    document.getElementById('login-shell').hidden = !ehLogin;
    document.getElementById('app-shell').hidden = ehLogin;
    document.body.classList.toggle('modo-login', ehLogin);
    document.body.classList.toggle('modo-app', !ehLogin);
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('is-active'); });
    const alvo = document.getElementById(id);
    if (alvo) alvo.classList.add('is-active');
    if (!ehLogin) {
      document.querySelectorAll('.nav-item').forEach(function (n) {
        n.classList.toggle('is-active', n.getAttribute('data-go') === id);
      });
      const t = TITULOS[id] || ['', ''];
      document.getElementById('content-titulo').textContent = t[0] || '';
      document.getElementById('content-sub').textContent = t[1] || '';
      document.querySelector('.content').scrollTop = 0;
      fecharNav();   // fecha a gaveta no celular
    }
  }
  // Botões/itens que trocam de tela (data-go) — inclui o menu lateral.
  document.querySelectorAll('[data-go]').forEach(function (b) {
    b.addEventListener('click', function (e) {
      e.preventDefault();
      const destino = b.getAttribute('data-go');
      irPara(destino);
      if (destino === 'tela-home') abrirHome();
      if (destino === 'tela-departamentos') carregarDepartamentos();
      if (destino === 'tela-lideres') abrirLideres();
      if (destino === 'tela-voluntarios') abrirVoluntarios();
      if (destino === 'tela-importar') resetImport();
      if (destino === 'tela-cultos-fixos') carregarCultosFixos();
      if (destino === 'tela-cultos') abrirCultos();
      if (destino === 'tela-escala') abrirEscala();
      if (destino === 'tela-checkin') abrirCheckin();
      if (destino === 'tela-presenca') abrirPresenca();
      if (destino === 'tela-dashboard') abrirDashboard();
      if (destino === 'tela-dados-igreja') abrirDadosIgreja();
    });
  });

  /* ----- Menu lateral no celular (gaveta) ----- */
  function fecharNav() { document.body.classList.remove('nav-aberto'); }
  const btnMenu = document.getElementById('btn-menu');
  if (btnMenu) btnMenu.addEventListener('click', function () { document.body.classList.toggle('nav-aberto'); });
  const navBack = document.getElementById('nav-backdrop');
  if (navBack) navBack.addEventListener('click', fecharNav);

  /* ----- Início ----- */
  async function init() {
    try {
      if (typeof supabase === 'undefined' || !supabase.createClient) {
        irPara('tela-auth');
        msg('auth-msg', 'Não carregou a biblioteca do Supabase. Desative o bloqueador ' +
          '(Brave Shields) para esta página e recarregue (Cmd+R).', true);
        return;
      }
      if (!configOk) {
        irPara('tela-auth');
        msg('auth-msg', 'Preencha o config.js com a URL e a chave do Supabase, salve e recarregue.', true);
        return;
      }
      // storageKey próprio: separa a sessão do painel (líder/admin) da Área do Voluntário.
      sb = supabase.createClient(cfg.URL, cfg.ANON_KEY, { auth: { storageKey: 'pe-painel' } });
      const { data } = await sb.auth.getSession();
      if (data && data.session) await rotearLogado();
      else irPara('tela-auth');
    } catch (e) {
      irPara('tela-auth');
      msg('auth-msg', 'Erro ao iniciar: ' + (e && e.message ? e.message : e), true);
    }
  }

  async function rotearLogado() {
    irPara('tela-load');
    // 1) Quem é o usuário logado? (papel define o que ele vê)
    //    Filtra pelo PRÓPRIO id — admin/líder enxergam vários usuários, então
    //    sem o filtro a consulta volta mais de uma linha.
    const { data: auth } = await sb.auth.getUser();
    const uid = auth && auth.user ? auth.user.id : null;
    const { data: u, error: ue } = await sb.from('usuarios').select('papel, igreja_id').eq('id', uid).maybeSingle();
    if (ue) { irPara('tela-auth'); msg('auth-msg', traduzErro(ue), true); return; }
    if (!u) {
      // conta logada sem registro de usuário -> ainda não tem igreja (fluxo admin novo)
      igrejaId = null; irPara('tela-igreja'); return;
    }
    papelAtual = u.papel;
    // 2) Este painel é só para ADMIN e LÍDER. Voluntário/kiosk são barrados.
    if (papelAtual !== 'admin' && papelAtual !== 'lider') {
      await sb.auth.signOut();
      irPara('tela-auth');
      msg('auth-msg', 'Esta área é da liderança. Use a Área do Voluntário (link da sua igreja).', true);
      return;
    }
    // 3) Dados da igreja + adapta a tela ao papel.
    const { data: igreja } = await sb.from('igrejas').select('id, nome').maybeSingle();
    igrejaId = igreja ? igreja.id : u.igreja_id;
    document.getElementById('sb-igreja').textContent = igreja ? igreja.nome : '—';
    document.getElementById('home-presenca').href = 'voluntario.html?igreja=' + igrejaId;
    await adaptarPainel(papelAtual);
    abrirHome();
    irPara('tela-home');
  }

  // Mostra/esconde itens do menu conforme o papel e ajusta o rodapé da barra.
  async function adaptarPainel(papel) {
    const ehAdmin = papel === 'admin';
    document.querySelectorAll('[data-role="admin"]').forEach(function (el) { el.hidden = !ehAdmin; });
    // esconde grupos do menu que ficaram sem itens visíveis (ex.: líder)
    document.querySelectorAll('.sidebar .nav-group[data-grupo]').forEach(function (g) {
      const algum = Array.prototype.slice.call(g.querySelectorAll('.nav-item'))
        .some(function (it) { return !it.hidden; });
      g.hidden = !algum;
    });
    const sub = document.getElementById('sb-papel');
    if (ehAdmin) {
      sub.textContent = 'Administrador';
    } else {
      // líder: lista os departamentos que ele gerencia (a RLS já devolve só os dele)
      const { data: deps } = await sb.from('departamentos').select('nome').order('nome');
      const nomes = (deps || []).map(function (d) { return d.nome; });
      sub.textContent = 'Líder' + (nomes.length ? ' · ' + nomes.join(', ') : '');
    }
  }

  /* ============================================================ */
  /* PAINEL / VISÃO GERAL (KPIs rápidos)                          */
  /* ============================================================ */
  async function abrirHome() {
    const div = document.getElementById('home-kpis');
    if (!div) return;
    div.innerHTML = '<p class="muted">Carregando…</p>';
    const h = new Date();
    const ini = h.getFullYear() + '-' + pad(h.getMonth() + 1) + '-01';
    const fim = h.getFullYear() + '-' + pad(h.getMonth() + 1) + '-' + pad(new Date(h.getFullYear(), h.getMonth() + 1, 0).getDate());
    const volC = await sb.from('voluntarios').select('id', { count: 'exact', head: true });
    const depC = await sb.from('departamentos').select('id', { count: 'exact', head: true });
    const culC = await sb.from('cultos').select('id', { count: 'exact', head: true }).gte('data', ini).lte('data', fim);
    let cards = cardKpi('🧑‍🤝‍🧑', volC.count || 0, 'Voluntários') +
                cardKpi('🏷️', depC.count || 0, 'Departamentos') +
                cardKpi('📅', culC.count || 0, 'Cultos neste mês');
    if (papelAtual === 'admin') {
      const ldC = await sb.from('usuarios').select('id', { count: 'exact', head: true }).eq('papel', 'lider');
      cards += cardKpi('⭐', ldC.count || 0, 'Líderes');
    }
    div.innerHTML = cards;
  }
  function cardKpi(ic, num, lb) {
    return '<div class="kpi-card"><div class="kpi-card__ic">' + ic + '</div>' +
           '<div class="kpi-card__num">' + num + '</div>' +
           '<div class="kpi-card__lb">' + esc(lb) + '</div></div>';
  }

  /* ============================================================ */
  /* DADOS DA IGREJA                                              */
  /* ============================================================ */
  async function abrirDadosIgreja() {
    msg('di-msg', '');
    const { data } = await sb.from('igrejas').select('nome, cnpj').maybeSingle();
    document.getElementById('di-nome').value = data ? (data.nome || '') : '';
    document.getElementById('di-cnpj').value = data ? formatCnpj(data.cnpj) : '';
  }
  document.getElementById('btn-salvar-igreja').addEventListener('click', async function () {
    const nome = val('di-nome'); msg('di-msg', '');
    if (!nome) { msg('di-msg', 'Informe o nome da igreja.', true); return; }
    trava(this, 'Salvando…');
    try {
      const { error } = await sb.from('igrejas').update({ nome: nome }).eq('id', igrejaId);
      if (error) { msg('di-msg', traduzErro(error), true); return; }
      document.getElementById('sb-igreja').textContent = nome;
      msg('di-msg', '✓ Dados atualizados.');
    } catch (e) { msg('di-msg', 'Falha de conexão.', true); }
    finally { destrava(this, 'Salvar alterações'); }
  });
  function formatCnpj(c) {
    c = String(c || '').replace(/\D/g, '');
    return c.length === 14 ? c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : c;
  }

  /* ============================================================ */
  /* AUTH                                                         */
  /* ============================================================ */
  document.querySelectorAll('#tela-auth .aba').forEach(function (a) {
    a.addEventListener('click', function () {
      document.querySelectorAll('#tela-auth .aba').forEach(function (x) { x.classList.remove('is-on'); });
      a.classList.add('is-on');
      const aba = a.getAttribute('data-aba');
      document.getElementById('painel-login').hidden = aba !== 'login';
      document.getElementById('painel-cadastro').hidden = aba !== 'cadastro';
      msg('auth-msg', '');
    });
  });

  document.getElementById('btn-cadastro').addEventListener('click', async function () {
    const email = val('cad-email'), senha = val('cad-senha');
    msg('auth-msg', '');
    if (!email || !senha) { msg('auth-msg', 'Preencha e-mail e senha.', true); return; }
    trava(this, 'Criando…');
    try {
      const { data, error } = await sb.auth.signUp({ email: email, password: senha });
      if (error) { msg('auth-msg', traduzErro(error), true); return; }
      if (data.session) await rotearLogado();
      else msg('auth-msg', 'Conta criada! Confirme pelo link no seu e-mail e depois entre.');
    } catch (e) { msg('auth-msg', 'Falha de conexão.', true); }
    finally { destrava(this, 'Criar conta'); }
  });

  document.getElementById('btn-login').addEventListener('click', async function () {
    const email = val('login-email'), senha = val('login-senha');
    msg('auth-msg', '');
    if (!email || !senha) { msg('auth-msg', 'Preencha e-mail e senha.', true); return; }
    trava(this, 'Entrando…');
    try {
      const { error } = await sb.auth.signInWithPassword({ email: email, password: senha });
      if (error) { msg('auth-msg', traduzErro(error), true); return; }
      await rotearLogado();
    } catch (e) { msg('auth-msg', 'Falha de conexão.', true); }
    finally { destrava(this, 'Entrar'); }
  });

  document.getElementById('btn-criar-igreja').addEventListener('click', async function () {
    const nome = val('ig-nome'), cnpj = val('ig-cnpj').replace(/\D/g, ''), admin = val('ig-admin');
    msg('igreja-msg', '');
    if (!nome || !cnpj || !admin) { msg('igreja-msg', 'Preencha todos os campos.', true); return; }
    if (cnpj.length !== 14) { msg('igreja-msg', 'CNPJ deve ter 14 dígitos.', true); return; }
    trava(this, 'Criando…');
    try {
      const { error } = await sb.rpc('criar_igreja', { p_cnpj: cnpj, p_nome_igreja: nome, p_nome_admin: admin });
      if (error) { msg('igreja-msg', traduzErro(error), true); return; }
      await rotearLogado();
    } catch (e) { msg('igreja-msg', 'Falha de conexão.', true); }
    finally { destrava(this, 'Criar igreja'); }
  });

  function sair(e) {
    if (e) e.preventDefault();
    sb.auth.signOut().then(function () {
      igrejaId = null; deptosCache = [];
      ['login-email','login-senha','cad-email','cad-senha','ig-nome','ig-cnpj','ig-admin']
        .forEach(function (id) { const el = document.getElementById(id); if (el) el.value = ''; });
      msg('auth-msg', ''); irPara('tela-auth');
    });
  }
  document.getElementById('btn-sair-1').addEventListener('click', sair);
  document.getElementById('btn-sair-2').addEventListener('click', sair);

  /* ============================================================ */
  /* DEPARTAMENTOS                                                */
  /* ============================================================ */
  async function carregarDepartamentos() {
    const div = document.getElementById('dep-lista');
    div.innerHTML = '<p class="muted">Carregando…</p>';
    const { data, error } = await sb.from('departamentos').select('id, nome, ativo').order('nome');
    if (error) { div.innerHTML = '<p class="muted">' + esc(traduzErro(error)) + '</p>'; return; }
    deptosCache = data || [];
    if (!deptosCache.length) { div.innerHTML = '<p class="muted">Nenhum departamento ainda.</p>'; return; }
    div.innerHTML = deptosCache.map(function (d) {
      return '<div class="item"><span>' + esc(d.nome) + '</span>' +
             '<span class="item-acoes">' +
               '<button class="link-acao" data-edit-dep="' + d.id + '" data-nome="' + esc(d.nome) + '">renomear</button>' +
               '<button class="link-acao link-excluir" data-del-dep="' + d.id + '">excluir</button>' +
             '</span></div>';
    }).join('');
    div.querySelectorAll('[data-edit-dep]').forEach(function (b) {
      b.addEventListener('click', function () { renomearDepartamento(b.getAttribute('data-edit-dep'), b.getAttribute('data-nome')); });
    });
    div.querySelectorAll('[data-del-dep]').forEach(function (b) {
      b.addEventListener('click', function () { excluirDepartamento(b.getAttribute('data-del-dep')); });
    });
  }

  async function renomearDepartamento(id, nomeAtual) {
    const novo = (prompt('Novo nome do departamento:', nomeAtual) || '').trim();
    if (!novo || novo === nomeAtual) return;
    const { error } = await sb.from('departamentos').update({ nome: novo }).eq('id', id);
    if (error) { msg('dep-msg', error.code === '23505' ? 'Já existe um departamento com esse nome.' : traduzErro(error), true); return; }
    msg('dep-msg', '✓ Renomeado.'); carregarDepartamentos();
  }

  document.getElementById('btn-add-dep').addEventListener('click', async function () {
    const nome = val('dep-nome'); msg('dep-msg', '');
    if (!nome) { msg('dep-msg', 'Informe o nome.', true); return; }
    trava(this, '…');
    try {
      const { error } = await sb.from('departamentos').insert({ igreja_id: igrejaId, nome: nome });
      if (error) { msg('dep-msg', error.code === '23505' ? 'Esse departamento já existe.' : traduzErro(error), true); return; }
      document.getElementById('dep-nome').value = '';
      msg('dep-msg', '✓ Adicionado.'); carregarDepartamentos();
    } catch (e) { msg('dep-msg', 'Falha de conexão.', true); }
    finally { destrava(this, 'Adicionar'); }
  });

  async function excluirDepartamento(id) {
    if (!confirm('Excluir este departamento? (os voluntários continuam, só perdem este vínculo)')) return;
    const { error } = await sb.from('departamentos').delete().eq('id', id);
    if (error) { msg('dep-msg', traduzErro(error), true); return; }
    carregarDepartamentos();
  }

  /* ============================================================ */
  /* LÍDERES (admin autoriza acesso + define departamentos)       */
  /* ============================================================ */
  function abrirLideres() {
    msg('lid-msg', '');
    // link absoluto e compartilhável para o líder se cadastrar (carrega a igreja).
    const base = location.href.split('?')[0].split('#')[0].replace(/[^/]*$/, '');
    document.getElementById('lid-link').value = base + 'cadastro-lider.html?igreja=' + igrejaId;
    carregarLideres();
  }

  document.getElementById('btn-copiar-lid').addEventListener('click', function () {
    const inp = document.getElementById('lid-link');
    inp.select(); inp.setSelectionRange(0, 99999);
    function ok() { msg('lid-msg', '✓ Link copiado.'); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(inp.value).then(ok, function () { try { document.execCommand('copy'); ok(); } catch (e) {} });
    } else { try { document.execCommand('copy'); ok(); } catch (e) {} }
  });

  async function carregarLideres() {
    const div = document.getElementById('lid-lista');
    div.innerHTML = '<p class="muted">Carregando…</p>';
    // departamentos da igreja (para os chips de cada líder)
    const depRes = await sb.from('departamentos').select('id, nome').order('nome');
    if (depRes.error) { div.innerHTML = '<p class="muted">' + esc(traduzErro(depRes.error)) + '</p>'; return; }
    const deptos = depRes.data || [];
    // líderes da igreja (a RLS já limita à própria igreja)
    const ldRes = await sb.from('usuarios').select('id, nome, email, ativo').eq('papel', 'lider').order('nome');
    if (ldRes.error) { div.innerHTML = '<p class="muted">' + esc(traduzErro(ldRes.error)) + '</p>'; return; }
    const lideres = ldRes.data || [];
    if (!lideres.length) {
      div.innerHTML = '<p class="muted">Nenhum líder ainda. Compartilhe o link acima para o líder criar o acesso.</p>';
      return;
    }
    // vínculos líder ↔ departamento
    const udRes = await sb.from('usuario_departamento').select('usuario_id, departamento_id');
    const porLider = {};
    (udRes.data || []).forEach(function (r) { (porLider[r.usuario_id] = porLider[r.usuario_id] || {})[r.departamento_id] = true; });

    div.innerHTML = lideres.map(function (l) {
      const sel = porLider[l.id] || {};
      const chips = deptos.length ? deptos.map(function (d) {
        return '<label class="check"><input type="checkbox" value="' + d.id + '"' + (sel[d.id] ? ' checked' : '') +
               '><span>' + esc(d.nome) + '</span></label>';
      }).join('') : '<p class="muted">Crie departamentos primeiro.</p>';
      const pill = l.ativo ? '<span class="pill pill--ok">Ativo</span>' : '<span class="pill pill--pend">Pendente</span>';
      const acaoStatus = l.ativo
        ? '<button class="link-acao link-excluir" type="button" data-suspender="' + l.id + '">suspender acesso</button>'
        : '<button class="btn btn-inline" type="button" data-autorizar="' + l.id + '">Autorizar acesso</button>';
      return '<div class="lider-card" data-lid="' + l.id + '">' +
               '<div class="lider-head"><div><strong>' + esc(l.nome || '(sem nome)') + '</strong>' +
                 '<div class="dep-tag">' + esc(l.email || '') + '</div></div>' + pill + '</div>' +
               '<p class="label">Departamentos que ele cuida</p>' +
               '<div class="checks">' + chips + '</div>' +
               '<div class="lider-acoes">' +
                 '<button class="btn btn--ghost btn-inline" type="button" data-salvar-deps="' + l.id + '">Salvar departamentos</button>' +
                 acaoStatus +
               '</div></div>';
    }).join('');

    div.querySelectorAll('[data-autorizar]').forEach(function (b) {
      b.addEventListener('click', function () { mudarAcessoLider(b.getAttribute('data-autorizar'), true); });
    });
    div.querySelectorAll('[data-suspender]').forEach(function (b) {
      b.addEventListener('click', function () { mudarAcessoLider(b.getAttribute('data-suspender'), false); });
    });
    div.querySelectorAll('[data-salvar-deps]').forEach(function (b) {
      b.addEventListener('click', function () { salvarDepsLider(b.getAttribute('data-salvar-deps')); });
    });
  }

  // Autoriza (ou suspende) o líder. Ao autorizar, salva também os departamentos marcados.
  async function mudarAcessoLider(id, ativar) {
    msg('lid-msg', '');
    if (!ativar && !confirm('Suspender o acesso deste líder? Ele não conseguirá mais entrar até ser autorizado de novo.')) return;
    const upd = await sb.from('usuarios').update({ ativo: ativar }).eq('id', id);
    if (upd.error) { msg('lid-msg', traduzErro(upd.error), true); return; }
    if (ativar) { const e = await persistirDepsLider(id); if (e) { msg('lid-msg', traduzErro(e), true); return; } }
    msg('lid-msg', ativar ? '✓ Líder autorizado.' : '✓ Acesso suspenso.');
    carregarLideres();
  }

  async function salvarDepsLider(id) {
    msg('lid-msg', '');
    const e = await persistirDepsLider(id);
    if (e) { msg('lid-msg', traduzErro(e), true); return; }
    msg('lid-msg', '✓ Departamentos atualizados.');
  }

  // Regrava os vínculos líder↔departamento conforme os checkboxes do cartão.
  async function persistirDepsLider(id) {
    const card = document.querySelector('.lider-card[data-lid="' + id + '"]');
    if (!card) return null;
    const checked = Array.prototype.slice.call(card.querySelectorAll('input:checked')).map(function (c) { return c.value; });
    const del = await sb.from('usuario_departamento').delete().eq('usuario_id', id);
    if (del.error) return del.error;
    if (checked.length) {
      const rows = checked.map(function (d) { return { igreja_id: igrejaId, usuario_id: id, departamento_id: d }; });
      const ins = await sb.from('usuario_departamento').insert(rows);
      if (ins.error) return ins.error;
    }
    return null;
  }

  /* ============================================================ */
  /* VOLUNTÁRIOS                                                  */
  /* ============================================================ */
  async function abrirVoluntarios() {
    limparFormVol();
    // carrega departamentos (para os checkboxes) e a lista.
    const { data } = await sb.from('departamentos').select('id, nome').order('nome');
    deptosCache = data || [];
    renderChecksDeptos([]);
    carregarVoluntarios();
  }

  function renderChecksDeptos(marcados) {
    const div = document.getElementById('vol-deptos');
    if (!deptosCache.length) { div.innerHTML = '<p class="muted">Cadastre um departamento primeiro.</p>'; return; }
    const sel = {}; (marcados || []).forEach(function (id) { sel[id] = true; });
    div.innerHTML = deptosCache.map(function (d) {
      return '<label class="check"><input type="checkbox" value="' + d.id + '"' + (sel[d.id] ? ' checked' : '') + '>' +
             '<span>' + esc(d.nome) + '</span></label>';
    }).join('');
  }

  async function carregarVoluntarios() {
    const div = document.getElementById('vol-lista');
    div.innerHTML = '<p class="muted">Carregando…</p>';
    const { data, error } = await sb.from('voluntarios')
      .select('id, matricula, nome, status, voluntario_departamento(departamentos(nome))')
      .order('nome');
    if (error) { div.innerHTML = '<p class="muted">' + esc(traduzErro(error)) + '</p>'; return; }
    if (!data.length) { div.innerHTML = '<p class="muted">Nenhum voluntário ainda.</p>'; return; }
    div.innerHTML = '<table class="tabela"><thead><tr><th>Matríc.</th><th>Nome</th><th>Deptos</th><th></th></tr></thead><tbody>' +
      data.map(function (v) {
        const deps = (v.voluntario_departamento || [])
          .map(function (x) { return x.departamentos ? x.departamentos.nome : ''; })
          .filter(Boolean).join(', ');
        const inativo = (v.status || '') === 'inativo';
        const dados = encodeURIComponent(JSON.stringify(v));
        return '<tr' + (inativo ? ' style="opacity:.5"' : '') + '><td>' + esc(v.matricula || '–') + '</td>' +
               '<td>' + esc(v.nome) + '</td><td>' + esc(deps || '–') + '</td>' +
               '<td><button class="link-acao" data-edit-vol="' + dados + '">editar</button></td></tr>';
      }).join('') + '</tbody></table>';
    div.querySelectorAll('[data-edit-vol]').forEach(function (b) {
      b.addEventListener('click', function () { editarVol(JSON.parse(decodeURIComponent(b.getAttribute('data-edit-vol')))); });
    });
  }

  function editarVol(v) {
    document.getElementById('vol-id').value = v.id;
    document.getElementById('vol-nome').value = v.nome || '';
    document.getElementById('vol-matricula').value = v.matricula || '';
    document.getElementById('vol-status').value = v.status || 'ativo';
    // marca os checkboxes pelos nomes dos departamentos vinculados.
    const nomes = {}; (v.voluntario_departamento || []).forEach(function (x) { if (x.departamentos) nomes[x.departamentos.nome] = true; });
    const marcados = deptosCache.filter(function (d) { return nomes[d.nome]; }).map(function (d) { return d.id; });
    renderChecksDeptos(marcados);
    document.getElementById('btn-salvar-vol').textContent = 'Salvar alterações';
    document.getElementById('vol-cancelar').hidden = false;
    msg('vol-msg', '');
    document.getElementById('vol-nome').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function limparFormVol() {
    document.getElementById('vol-id').value = '';
    document.getElementById('vol-nome').value = '';
    document.getElementById('vol-matricula').value = '';
    document.getElementById('vol-status').value = 'ativo';
    document.getElementById('btn-salvar-vol').textContent = 'Adicionar voluntário';
    document.getElementById('vol-cancelar').hidden = true;
    msg('vol-msg', '');
    renderChecksDeptos([]);
  }
  document.getElementById('vol-cancelar').addEventListener('click', function (e) { e.preventDefault(); limparFormVol(); });

  document.getElementById('btn-salvar-vol').addEventListener('click', async function () {
    const id = val('vol-id'), nome = val('vol-nome'), matricula = val('vol-matricula'), status = val('vol-status');
    msg('vol-msg', '');
    if (!nome) { msg('vol-msg', 'Informe o nome.', true); return; }
    const deptosSel = Array.prototype.slice
      .call(document.querySelectorAll('#vol-deptos input:checked')).map(function (c) { return c.value; });
    trava(this, 'Salvando…');
    try {
      let volId = id;
      if (id) {
        const { error } = await sb.from('voluntarios')
          .update({ nome: nome, matricula: matricula || null, status: status }).eq('id', id);
        if (error) { msg('vol-msg', erroVol(error), true); return; }
        await sb.from('voluntario_departamento').delete().eq('voluntario_id', id);
      } else {
        const { data, error } = await sb.from('voluntarios')
          .insert({ igreja_id: igrejaId, nome: nome, matricula: matricula || null, status: status })
          .select('id').single();
        if (error) { msg('vol-msg', erroVol(error), true); return; }
        volId = data.id;
      }
      if (deptosSel.length) {
        const links = deptosSel.map(function (depId) {
          return { igreja_id: igrejaId, voluntario_id: volId, departamento_id: depId };
        });
        await sb.from('voluntario_departamento').upsert(links, { onConflict: 'voluntario_id,departamento_id', ignoreDuplicates: true });
      }
      limparFormVol();
      msg('vol-msg', '✓ Salvo.'); carregarVoluntarios();
    } catch (e) { msg('vol-msg', 'Falha de conexão.', true); }
    finally { destrava(this, 'Adicionar voluntário'); }
  });

  function erroVol(error) {
    return error.code === '23505' ? 'Já existe um voluntário com essa matrícula.' : traduzErro(error);
  }

  /* ============================================================ */
  /* IMPORTAR CSV                                                 */
  /* ============================================================ */
  let linhasImport = [];

  function resetImport() {
    linhasImport = [];
    document.getElementById('imp-texto').value = '';
    document.getElementById('imp-file').value = '';
    document.getElementById('imp-preview').innerHTML = '';
    document.getElementById('btn-importar').hidden = true;
    msg('imp-msg', '');
  }

  document.getElementById('imp-file').addEventListener('change', function () {
    const f = this.files[0]; if (!f) return;
    msg('imp-msg', '');
    const ehExcel = /\.(xlsx|xls)$/i.test(f.name);
    if (ehExcel) {
      if (typeof XLSX === 'undefined') { msg('imp-msg', 'Leitor de Excel não carregou. Verifique a internet.', true); return; }
      const r = new FileReader();
      r.onload = function () {
        try {
          const wb = XLSX.read(new Uint8Array(r.result), { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          // converte para CSV e reaproveita o mesmo fluxo de pré-visualização.
          document.getElementById('imp-texto').value = XLSX.utils.sheet_to_csv(ws);
          msg('imp-msg', '✓ Planilha lida. Toque em "Pré-visualizar".');
        } catch (e) { msg('imp-msg', 'Não consegui ler a planilha. Salve como .xlsx ou .csv.', true); }
      };
      r.readAsArrayBuffer(f);
    } else {
      const r = new FileReader();
      r.onload = function () { document.getElementById('imp-texto').value = r.result; msg('imp-msg', '✓ Arquivo lido. Toque em "Pré-visualizar".'); };
      r.readAsText(f, 'utf-8');
    }
  });

  // Baixar planilha modelo (CSV que abre no Excel/Sheets).
  document.getElementById('btn-modelo').addEventListener('click', function () {
    const modelo =
      'Codigo,Nome completo,Departamento(s),Status\n' +
      '101,Maria Oliveira,Louvor; Staff,Ativo\n' +
      '102,João Pereira,Recepção,Ativo\n' +
      '103,Ana Souza,Kids,Inativo\n';
    const blob = new Blob(['﻿' + modelo], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'modelo-voluntarios.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  });

  document.getElementById('btn-preview').addEventListener('click', function () {
    msg('imp-msg', '');
    const texto = document.getElementById('imp-texto').value.trim();
    if (!texto) { msg('imp-msg', 'Cole o conteúdo ou escolha um arquivo.', true); return; }
    const linhas = parseCSV(texto);
    if (linhas.length < 2) { msg('imp-msg', 'Não encontrei dados (só o cabeçalho?).', true); return; }
    // ignora cabeçalho (linha 0). Colunas: 0=Codigo 1=Nome 2=Deptos 3=Status
    linhasImport = [];
    for (let i = 1; i < linhas.length; i++) {
      const c = linhas[i];
      const nome = (c[1] || '').trim();
      if (!nome) continue;
      linhasImport.push({
        codigo: (c[0] || '').trim(),
        nome: nome,
        deptos: String(c[2] || '').split(/[;,\/]/).map(function (x) { return x.trim(); }).filter(Boolean),
        status: /inativ/i.test(c[3] || '') ? 'inativo' : 'ativo'
      });
    }
    const deptos = [].concat.apply([], linhasImport.map(function (r) { return r.deptos; }));
    const uniqDep = deptos.filter(function (v, i) { return deptos.indexOf(v) === i; });
    document.getElementById('imp-preview').innerHTML =
      '<div class="aviso">Encontrados <strong>' + linhasImport.length + ' voluntário(s)</strong> e <strong>' +
      uniqDep.length + ' departamento(s)</strong>:<br><span class="muted">' + esc(uniqDep.join(', ')) + '</span></div>';
    document.getElementById('btn-importar').hidden = linhasImport.length === 0;
  });

  document.getElementById('btn-importar').addEventListener('click', async function () {
    if (!linhasImport.length) return;
    msg('imp-msg', ''); trava(this, 'Importando…');
    try {
      // 1) departamentos únicos -> upsert
      const todos = [].concat.apply([], linhasImport.map(function (r) { return r.deptos; }));
      const uniq = todos.filter(function (v, i) { return todos.indexOf(v) === i; });
      if (uniq.length) {
        const payload = uniq.map(function (n) { return { igreja_id: igrejaId, nome: n }; });
        const up = await sb.from('departamentos').upsert(payload, { onConflict: 'igreja_id,nome', ignoreDuplicates: true });
        if (up.error) { msg('imp-msg', traduzErro(up.error), true); return; }
      }
      const depRes = await sb.from('departamentos').select('id, nome');
      if (depRes.error) { msg('imp-msg', traduzErro(depRes.error), true); return; }
      const depMap = {}; depRes.data.forEach(function (d) { depMap[d.nome] = d.id; });

      // 2) voluntários -> upsert por (igreja_id, matrícula)
      const volPayload = linhasImport.map(function (r) {
        return { igreja_id: igrejaId, matricula: r.codigo || null, nome: r.nome, status: r.status };
      });
      const volRes = await sb.from('voluntarios')
        .upsert(volPayload, { onConflict: 'igreja_id,matricula' }).select('id, matricula');
      if (volRes.error) { msg('imp-msg', traduzErro(volRes.error), true); return; }
      const volMap = {}; volRes.data.forEach(function (v) { volMap[v.matricula] = v.id; });

      // 3) vínculos voluntário-departamento
      const links = [];
      linhasImport.forEach(function (r) {
        const vid = volMap[r.codigo];
        if (!vid) return;
        r.deptos.forEach(function (dn) {
          if (depMap[dn]) links.push({ igreja_id: igrejaId, voluntario_id: vid, departamento_id: depMap[dn] });
        });
      });
      if (links.length) {
        const lr = await sb.from('voluntario_departamento')
          .upsert(links, { onConflict: 'voluntario_id,departamento_id', ignoreDuplicates: true });
        if (lr.error) { msg('imp-msg', traduzErro(lr.error), true); return; }
      }
      msg('imp-msg', '✓ Importados ' + volRes.data.length + ' voluntário(s), ' + uniq.length +
        ' departamento(s) e ' + links.length + ' vínculo(s).');
      document.getElementById('btn-importar').hidden = true;
    } catch (e) { msg('imp-msg', 'Falha ao importar. Tente de novo.', true); }
    finally { destrava(this, 'Importar'); }
  });

  /** Parser simples de CSV/TSV com suporte a aspas. Detecta , ou tab. */
  function parseCSV(texto) {
    const sep = texto.split('\n')[0].indexOf('\t') >= 0 ? '\t' : ',';
    const linhas = []; let campo = '', linha = [], aspas = false;
    for (let i = 0; i < texto.length; i++) {
      const ch = texto[i];
      if (aspas) {
        if (ch === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else aspas = false; }
        else campo += ch;
      } else if (ch === '"') aspas = true;
      else if (ch === sep) { linha.push(campo); campo = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && texto[i + 1] === '\n') i++;
        linha.push(campo); linhas.push(linha); campo = ''; linha = [];
      } else campo += ch;
    }
    if (campo.length || linha.length) { linha.push(campo); linhas.push(linha); }
    return linhas.filter(function (l) { return l.some(function (c) { return (c || '').trim(); }); });
  }

  /* ============================================================ */
  /* CULTOS FIXOS DA IGREJA                                       */
  /* ============================================================ */
  const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  async function carregarCultosFixos() {
    const div = document.getElementById('cf-lista');
    div.innerHTML = '<p class="muted">Carregando…</p>';
    const { data, error } = await sb.from('cultos_fixos')
      .select('id, dia_semana, horario, descricao').order('dia_semana');
    if (error) { div.innerHTML = '<p class="muted">' + esc(traduzErro(error)) + '</p>'; return; }
    if (!data.length) { div.innerHTML = '<p class="muted">Nenhum culto fixo definido ainda.</p>'; return; }
    div.innerHTML = data.map(function (c) {
      const rotulo = DIAS[c.dia_semana] + (c.horario ? ' · ' + c.horario : '') +
                     (c.descricao ? ' · ' + c.descricao : '');
      return '<div class="item"><span>' + esc(rotulo) + '</span>' +
             '<button class="link-acao link-excluir" data-del-cf="' + c.id + '">excluir</button></div>';
    }).join('');
    div.querySelectorAll('[data-del-cf]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!confirm('Excluir este culto fixo?')) return;
        await sb.from('cultos_fixos').delete().eq('id', b.getAttribute('data-del-cf'));
        carregarCultosFixos();
      });
    });
  }

  document.getElementById('btn-add-cf').addEventListener('click', async function () {
    const dia = document.getElementById('cf-dia').value;
    const hora = val('cf-hora'), desc = val('cf-desc');
    msg('cf-msg', '');
    if (!hora) { msg('cf-msg', 'Informe o horário.', true); return; }
    trava(this, '…');
    try {
      const { error } = await sb.from('cultos_fixos').insert({
        igreja_id: igrejaId, dia_semana: Number(dia), horario: hora, descricao: desc || null
      });
      if (error) { msg('cf-msg', traduzErro(error), true); return; }
      document.getElementById('cf-hora').value = ''; document.getElementById('cf-desc').value = '';
      msg('cf-msg', '✓ Adicionado.'); carregarCultosFixos();
    } catch (e) { msg('cf-msg', 'Falha de conexão.', true); }
    finally { destrava(this, 'Adicionar culto fixo'); }
  });

  /* ============================================================ */
  /* CULTOS DO MÊS                                                */
  /* ============================================================ */
  function abrirCultos() {
    const el = document.getElementById('cul-mes');
    if (!el.value) { const h = new Date(); el.value = h.getFullYear() + '-' + pad(h.getMonth() + 1); }
    carregarCultosMes();
  }
  document.getElementById('cul-mes').addEventListener('change', carregarCultosMes);

  async function carregarCultosMes() {
    const div = document.getElementById('cul-lista');
    const mv = document.getElementById('cul-mes').value;
    if (!mv) return;
    const p = mv.split('-'), ano = Number(p[0]), mes = Number(p[1]);
    const ini = ano + '-' + pad(mes) + '-01';
    const fim = ano + '-' + pad(mes) + '-' + pad(new Date(ano, mes, 0).getDate());
    div.innerHTML = '<p class="muted">Carregando…</p>';
    const { data, error } = await sb.from('cultos')
      .select('id, data, horario, descricao').gte('data', ini).lte('data', fim).order('data');
    if (error) { div.innerHTML = '<p class="muted">' + esc(traduzErro(error)) + '</p>'; return; }
    if (!data.length) { div.innerHTML = '<p class="muted">Nenhum culto neste mês. Use "Gerar fixos" ou adicione um avulso.</p>'; return; }
    div.innerHTML = '<table class="tabela"><thead><tr><th>Data</th><th>Hora</th><th>Culto</th><th></th></tr></thead><tbody>' +
      data.map(function (c) {
        return '<tr><td>' + dataBR(c.data) + '</td><td>' + esc(c.horario || '–') + '</td>' +
               '<td>' + esc(c.descricao || '–') + '</td>' +
               '<td><button class="link-acao link-excluir" data-del-cul="' + c.id + '">excluir</button></td></tr>';
      }).join('') + '</tbody></table>';
    div.querySelectorAll('[data-del-cul]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!confirm('Excluir este culto? (a escala dele também sai)')) return;
        await sb.from('cultos').delete().eq('id', b.getAttribute('data-del-cul'));
        carregarCultosMes();
      });
    });
  }

  document.getElementById('btn-gerar-fixos').addEventListener('click', async function () {
    const mv = document.getElementById('cul-mes').value; msg('cul-msg', '');
    if (!mv) { msg('cul-msg', 'Escolha o mês.', true); return; }
    const p = mv.split('-'), ano = Number(p[0]), mes = Number(p[1]);
    trava(this, 'Gerando…');
    try {
      const { data: fixos, error } = await sb.from('cultos_fixos').select('dia_semana, horario, descricao');
      if (error) { msg('cul-msg', traduzErro(error), true); return; }
      if (!fixos.length) { msg('cul-msg', 'Defina os cultos fixos da igreja primeiro.', true); return; }
      const novos = [];
      const ultimo = new Date(ano, mes, 0).getDate();
      for (let d = 1; d <= ultimo; d++) {
        const dow = new Date(ano, mes - 1, d).getDay();
        fixos.forEach(function (f) {
          if (f.dia_semana === dow) {
            novos.push({ igreja_id: igrejaId, data: ano + '-' + pad(mes) + '-' + pad(d),
                         horario: f.horario || null, descricao: f.descricao || null });
          }
        });
      }
      if (!novos.length) { msg('cul-msg', 'Nenhuma data corresponde aos cultos fixos neste mês.', true); return; }
      const up = await sb.from('cultos').upsert(novos, { onConflict: 'igreja_id,data,horario', ignoreDuplicates: true });
      if (up.error) { msg('cul-msg', traduzErro(up.error), true); return; }
      msg('cul-msg', '✓ ' + novos.length + ' culto(s) processado(s) (repetidos são ignorados).');
      carregarCultosMes();
    } catch (e) { msg('cul-msg', 'Falha de conexão.', true); }
    finally { destrava(this, 'Gerar fixos'); }
  });

  document.getElementById('btn-add-culto').addEventListener('click', async function () {
    const data = val('cul-data'), hora = val('cul-hora'), desc = val('cul-desc'); msg('cul-msg', '');
    if (!data) { msg('cul-msg', 'Escolha a data.', true); return; }
    trava(this, '…');
    try {
      const { error } = await sb.from('cultos').insert({
        igreja_id: igrejaId, data: data, horario: hora || null, descricao: desc || null
      });
      if (error) { msg('cul-msg', error.code === '23505' ? 'Esse culto já existe.' : traduzErro(error), true); return; }
      document.getElementById('cul-data').value = ''; document.getElementById('cul-hora').value = '';
      document.getElementById('cul-desc').value = '';
      msg('cul-msg', '✓ Culto adicionado.');
      // se o avulso cair no mês exibido, recarrega.
      carregarCultosMes();
    } catch (e) { msg('cul-msg', 'Falha de conexão.', true); }
    finally { destrava(this, 'Adicionar avulso'); }
  });

  /* ============================================================ */
  /* MONTAR ESCALA                                                */
  /* ============================================================ */
  async function abrirEscala() {
    msg('esc-msg', '');
    document.getElementById('esc-vols').innerHTML = '<p class="muted">Escolha culto e departamento.</p>';
    const selCul = document.getElementById('esc-culto'), selDep = document.getElementById('esc-dep');
    selCul.innerHTML = '<option value="">Carregando…</option>';
    selDep.innerHTML = '<option value="">Carregando…</option>';
    const culRes = await sb.from('cultos').select('id, data, horario, descricao').order('data');
    selCul.innerHTML = '<option value="">Selecione…</option>' + (culRes.data || []).map(function (c) {
      return '<option value="' + c.id + '">' + esc(dataBR(c.data) + (c.horario ? ' ' + c.horario : '') +
             (c.descricao ? ' · ' + c.descricao : '')) + '</option>';
    }).join('');
    const depRes = await sb.from('departamentos').select('id, nome').order('nome');
    selDep.innerHTML = '<option value="">Selecione…</option>' + (depRes.data || []).map(function (d) {
      return '<option value="' + d.id + '">' + esc(d.nome) + '</option>';
    }).join('');
  }
  document.getElementById('esc-culto').addEventListener('change', carregarEscalaVols);
  document.getElementById('esc-dep').addEventListener('change', carregarEscalaVols);

  async function carregarEscalaVols() {
    const culId = document.getElementById('esc-culto').value;
    const depId = document.getElementById('esc-dep').value;
    const div = document.getElementById('esc-vols');
    msg('esc-msg', '');
    if (!culId || !depId) { div.innerHTML = '<p class="muted">Escolha culto e departamento.</p>'; return; }
    div.innerHTML = '<p class="muted">Carregando…</p>';
    // voluntários do departamento (ativos)
    const vdRes = await sb.from('voluntario_departamento')
      .select('voluntarios(id, nome, status)').eq('departamento_id', depId);
    let vols = (vdRes.data || []).map(function (x) { return x.voluntarios; })
      .filter(function (v) { return v && v.status !== 'inativo'; });
    vols.sort(function (a, b) { return a.nome.localeCompare(b.nome); });
    if (!vols.length) { div.innerHTML = '<p class="muted">Nenhum voluntário ativo neste departamento.</p>'; return; }
    // escala existente (para pré-marcar)
    const escRes = await sb.from('escalas')
      .select('id, escala_itens(voluntario_id)').eq('culto_id', culId).eq('departamento_id', depId).maybeSingle();
    const marc = {};
    if (escRes.data && escRes.data.escala_itens) escRes.data.escala_itens.forEach(function (i) { marc[i.voluntario_id] = true; });
    div.innerHTML = vols.map(function (v) {
      return '<label class="check"><input type="checkbox" value="' + v.id + '"' + (marc[v.id] ? ' checked' : '') + '>' +
             '<span>' + esc(v.nome) + '</span></label>';
    }).join('');
  }

  document.getElementById('btn-salvar-escala').addEventListener('click', async function () {
    const culId = document.getElementById('esc-culto').value;
    const depId = document.getElementById('esc-dep').value;
    msg('esc-msg', '');
    if (!culId || !depId) { msg('esc-msg', 'Escolha culto e departamento.', true); return; }
    const ids = Array.prototype.slice
      .call(document.querySelectorAll('#esc-vols input:checked')).map(function (c) { return c.value; });
    trava(this, 'Salvando…');
    try {
      const escRes = await sb.from('escalas')
        .upsert({ igreja_id: igrejaId, culto_id: culId, departamento_id: depId }, { onConflict: 'culto_id,departamento_id' })
        .select('id').single();
      if (escRes.error) { msg('esc-msg', traduzErro(escRes.error), true); return; }
      const escalaId = escRes.data.id;
      await sb.from('escala_itens').delete().eq('escala_id', escalaId);
      if (ids.length) {
        const itens = ids.map(function (vid) { return { escala_id: escalaId, voluntario_id: vid }; });
        const ir = await sb.from('escala_itens').insert(itens);
        if (ir.error) { msg('esc-msg', traduzErro(ir.error), true); return; }
      }
      msg('esc-msg', '✓ Escala salva: ' + ids.length + ' voluntário(s).');
    } catch (e) { msg('esc-msg', 'Falha de conexão.', true); }
    finally { destrava(this, 'Salvar escala'); }
  });

  /* ============================================================ */
  /* CHECK-IN (o líder marca quem serviu na escala)               */
  /* ============================================================ */
  let chkEscalaId = null;    // escala aberta no momento
  let chkIds = [];           // voluntários escalados nessa escala

  async function abrirCheckin() {
    msg('chk-msg', '');
    chkEscalaId = null; chkIds = [];
    document.getElementById('chk-vols').innerHTML = '<p class="muted">Escolha culto e departamento.</p>';
    document.getElementById('chk-todos').hidden = true;
    document.getElementById('chk-limpar').hidden = true;
    const selCul = document.getElementById('chk-culto'), selDep = document.getElementById('chk-dep');
    selCul.innerHTML = '<option value="">Carregando…</option>';
    selDep.innerHTML = '<option value="">Carregando…</option>';
    const culRes = await sb.from('cultos').select('id, data, horario, descricao').order('data');
    selCul.innerHTML = '<option value="">Selecione…</option>' + (culRes.data || []).map(function (c) {
      return '<option value="' + c.id + '">' + esc(dataBR(c.data) + (c.horario ? ' ' + c.horario : '') +
             (c.descricao ? ' · ' + c.descricao : '')) + '</option>';
    }).join('');
    const depRes = await sb.from('departamentos').select('id, nome').order('nome');
    selDep.innerHTML = '<option value="">Selecione…</option>' + (depRes.data || []).map(function (d) {
      return '<option value="' + d.id + '">' + esc(d.nome) + '</option>';
    }).join('');
  }
  document.getElementById('chk-culto').addEventListener('change', carregarCheckinVols);
  document.getElementById('chk-dep').addEventListener('change', carregarCheckinVols);

  async function carregarCheckinVols() {
    const culId = document.getElementById('chk-culto').value;
    const depId = document.getElementById('chk-dep').value;
    const div = document.getElementById('chk-vols');
    msg('chk-msg', '');
    chkEscalaId = null; chkIds = [];
    document.getElementById('chk-todos').hidden = true;
    document.getElementById('chk-limpar').hidden = true;
    if (!culId || !depId) { div.innerHTML = '<p class="muted">Escolha culto e departamento.</p>'; return; }
    div.innerHTML = '<p class="muted">Carregando…</p>';
    const escRes = await sb.from('escalas')
      .select('id, escala_itens(compareceu, voluntarios(id, nome))')
      .eq('culto_id', culId).eq('departamento_id', depId).maybeSingle();
    if (escRes.error) { div.innerHTML = '<p class="muted">' + esc(traduzErro(escRes.error)) + '</p>'; return; }
    if (!escRes.data) {
      div.innerHTML = '<p class="muted">Ainda não há escala para este culto e departamento. ' +
        'Monte a escala primeiro em <strong>Montar escala</strong>.</p>';
      return;
    }
    chkEscalaId = escRes.data.id;
    const itens = (escRes.data.escala_itens || [])
      .map(function (i) { return { v: i.voluntarios, compareceu: !!i.compareceu }; })
      .filter(function (x) { return x.v; });
    itens.sort(function (a, b) { return a.v.nome.localeCompare(b.v.nome); });
    if (!itens.length) { div.innerHTML = '<p class="muted">Ninguém escalado neste culto/departamento.</p>'; return; }
    chkIds = itens.map(function (x) { return x.v.id; });
    div.innerHTML = itens.map(function (x) {
      return '<label class="check"><input type="checkbox" value="' + x.v.id + '"' + (x.compareceu ? ' checked' : '') + '>' +
             '<span>' + esc(x.v.nome) + '</span></label>';
    }).join('');
    document.getElementById('chk-todos').hidden = false;
    document.getElementById('chk-limpar').hidden = false;
  }

  document.getElementById('chk-todos').addEventListener('click', function () {
    document.querySelectorAll('#chk-vols input[type="checkbox"]').forEach(function (c) { c.checked = true; });
  });
  document.getElementById('chk-limpar').addEventListener('click', function () {
    document.querySelectorAll('#chk-vols input[type="checkbox"]').forEach(function (c) { c.checked = false; });
  });

  document.getElementById('btn-salvar-checkin').addEventListener('click', async function () {
    msg('chk-msg', '');
    if (!chkEscalaId) { msg('chk-msg', 'Escolha um culto e um departamento com escala montada.', true); return; }
    const marcados = Array.prototype.slice
      .call(document.querySelectorAll('#chk-vols input:checked')).map(function (c) { return c.value; });
    const mSet = {}; marcados.forEach(function (id) { mSet[id] = true; });
    const naoMarcados = chkIds.filter(function (id) { return !mSet[id]; });
    trava(this, 'Salvando…');
    try {
      if (marcados.length) {
        const up = await sb.from('escala_itens')
          .update({ compareceu: true, checkin_em: new Date().toISOString() })
          .eq('escala_id', chkEscalaId).in('voluntario_id', marcados);
        if (up.error) { msg('chk-msg', traduzErro(up.error), true); return; }
      }
      if (naoMarcados.length) {
        const up2 = await sb.from('escala_itens')
          .update({ compareceu: false, checkin_em: null })
          .eq('escala_id', chkEscalaId).in('voluntario_id', naoMarcados);
        if (up2.error) { msg('chk-msg', traduzErro(up2.error), true); return; }
      }
      msg('chk-msg', '✓ Check-in salvo: ' + marcados.length + ' de ' + chkIds.length + ' compareceram.');
    } catch (e) { msg('chk-msg', 'Falha de conexão.', true); }
    finally { destrava(this, 'Salvar check-in'); }
  });

  /* ============================================================ */
  /* MAPA DE PRESENÇA (TESTE) — quem esteve no culto, mesmo sem escala */
  /* ============================================================ */
  let prVolIds = [];             // voluntários do departamento carregado
  let prPresentes = {};          // presenças já registradas (voluntario_id -> true)
  let prEscalado = {};           // quem estava escalado (voluntario_id -> true)

  async function abrirPresenca() {
    msg('pr-msg', '');
    prVolIds = []; prPresentes = {}; prEscalado = {};
    document.getElementById('pr-vols').innerHTML = '<p class="muted">Escolha culto e departamento.</p>';
    document.getElementById('pr-todos').hidden = true;
    document.getElementById('pr-limpar').hidden = true;
    const selCul = document.getElementById('pr-culto'), selDep = document.getElementById('pr-dep');
    selCul.innerHTML = '<option value="">Carregando…</option>';
    selDep.innerHTML = '<option value="">Carregando…</option>';
    const culRes = await sb.from('cultos').select('id, data, horario, descricao').order('data');
    selCul.innerHTML = '<option value="">Selecione…</option>' + (culRes.data || []).map(function (c) {
      return '<option value="' + c.id + '" data-data="' + c.data + '">' + esc(dataBR(c.data) +
             (c.horario ? ' ' + c.horario : '') + (c.descricao ? ' · ' + c.descricao : '')) + '</option>';
    }).join('');
    const depRes = await sb.from('departamentos').select('id, nome').order('nome');
    selDep.innerHTML = '<option value="">Selecione…</option>' + (depRes.data || []).map(function (d) {
      return '<option value="' + d.id + '">' + esc(d.nome) + '</option>';
    }).join('');
  }
  document.getElementById('pr-culto').addEventListener('change', carregarPresencaVols);
  document.getElementById('pr-dep').addEventListener('change', carregarPresencaVols);

  async function carregarPresencaVols() {
    const culId = document.getElementById('pr-culto').value;
    const depId = document.getElementById('pr-dep').value;
    const div = document.getElementById('pr-vols');
    msg('pr-msg', '');
    prVolIds = []; prPresentes = {}; prEscalado = {};
    document.getElementById('pr-todos').hidden = true;
    document.getElementById('pr-limpar').hidden = true;
    if (!culId || !depId) { div.innerHTML = '<p class="muted">Escolha culto e departamento.</p>'; return; }
    div.innerHTML = '<p class="muted">Carregando…</p>';
    // voluntários do departamento (todos, escalados ou não)
    const vdRes = await sb.from('voluntario_departamento')
      .select('voluntarios(id, nome, status)').eq('departamento_id', depId);
    if (vdRes.error) { div.innerHTML = '<p class="muted">' + esc(traduzErro(vdRes.error)) + '</p>'; return; }
    let vols = (vdRes.data || []).map(function (x) { return x.voluntarios; })
      .filter(function (v) { return v && v.status !== 'inativo'; });
    vols.sort(function (a, b) { return a.nome.localeCompare(b.nome); });
    if (!vols.length) { div.innerHTML = '<p class="muted">Nenhum voluntário ativo neste departamento.</p>'; return; }
    prVolIds = vols.map(function (v) { return v.id; });
    // quem estava escalado neste culto/departamento (só para marcar com a tag)
    const escRes = await sb.from('escalas')
      .select('escala_itens(voluntario_id)').eq('culto_id', culId).eq('departamento_id', depId).maybeSingle();
    if (escRes.data && escRes.data.escala_itens) escRes.data.escala_itens.forEach(function (i) { prEscalado[i.voluntario_id] = true; });
    // presenças já registradas neste culto
    const regRes = await sb.from('registros').select('voluntario_id').eq('culto_id', culId).in('voluntario_id', prVolIds);
    (regRes.data || []).forEach(function (r) { prPresentes[r.voluntario_id] = true; });
    div.innerHTML = vols.map(function (v) {
      const tag = prEscalado[v.id] ? ' <span class="dep-tag">escalado</span>' : '';
      return '<label class="check"><input type="checkbox" value="' + v.id + '"' + (prPresentes[v.id] ? ' checked' : '') + '>' +
             '<span>' + esc(v.nome) + tag + '</span></label>';
    }).join('');
    document.getElementById('pr-todos').hidden = false;
    document.getElementById('pr-limpar').hidden = false;
  }

  document.getElementById('pr-todos').addEventListener('click', function () {
    document.querySelectorAll('#pr-vols input[type="checkbox"]').forEach(function (c) { c.checked = true; });
  });
  document.getElementById('pr-limpar').addEventListener('click', function () {
    document.querySelectorAll('#pr-vols input[type="checkbox"]').forEach(function (c) { c.checked = false; });
  });

  document.getElementById('btn-salvar-presenca').addEventListener('click', async function () {
    msg('pr-msg', '');
    const selCul = document.getElementById('pr-culto');
    const culId = selCul.value;
    const opt = selCul.options[selCul.selectedIndex];
    const data = opt ? opt.getAttribute('data-data') : null;
    if (!culId || !data) { msg('pr-msg', 'Escolha um culto.', true); return; }
    if (!prVolIds.length) { msg('pr-msg', 'Escolha um departamento com voluntários.', true); return; }
    const marcados = Array.prototype.slice
      .call(document.querySelectorAll('#pr-vols input:checked')).map(function (c) { return c.value; });
    const mSet = {}; marcados.forEach(function (id) { mSet[id] = true; });
    // insere os novos presentes; remove os que foram desmarcados
    const inserir = marcados.filter(function (id) { return !prPresentes[id]; }).map(function (id) {
      return { igreja_id: igrejaId, voluntario_id: id, culto_id: culId, data: data, escalado: !!prEscalado[id] };
    });
    const remover = prVolIds.filter(function (id) { return prPresentes[id] && !mSet[id]; });
    trava(this, 'Salvando…');
    try {
      if (inserir.length) {
        const r = await sb.from('registros').insert(inserir);
        if (r.error) { msg('pr-msg', traduzErro(r.error), true); return; }
      }
      if (remover.length) {
        const r2 = await sb.from('registros').delete().eq('culto_id', culId).in('voluntario_id', remover);
        if (r2.error) { msg('pr-msg', traduzErro(r2.error), true); return; }
      }
      prPresentes = {}; marcados.forEach(function (id) { prPresentes[id] = true; });
      const foraDeEscala = marcados.filter(function (id) { return !prEscalado[id]; }).length;
      msg('pr-msg', '✓ Presença salva: ' + marcados.length + ' presente(s)' +
        (foraDeEscala ? ' · ' + foraDeEscala + ' fora da escala' : '') + '.');
    } catch (e) { msg('pr-msg', 'Falha de conexão.', true); }
    finally { destrava(this, 'Salvar presença'); }
  });

  /* ============================================================ */
  /* DASHBOARD (4 abas: Geral / Por Culto / Departamento / Alertas + PDF) */
  /* ============================================================ */
  const LIMITE_FALTAS = 2;
  let abaDash = 'geral';
  let dadosDash = null;       // dados do mês carregados
  let dadosAlertas = null;    // alertas (histórico) — carregados sob demanda
  let deptosDash = [];

  function abrirDashboard() {
    const el = document.getElementById('dash-mes');
    if (!el.value) { const h = new Date(); el.value = h.getFullYear() + '-' + pad(h.getMonth() + 1); }
    mostrarAbaDash(abaDash);
    carregarDashboard();
  }
  document.getElementById('btn-dash').addEventListener('click', carregarDashboard);
  document.getElementById('btn-pdf').addEventListener('click', exportarPDF);
  document.getElementById('dep-rel').addEventListener('change', renderDepto);
  document.querySelectorAll('#tela-dashboard .aba').forEach(function (a) {
    a.addEventListener('click', function () { mostrarAbaDash(a.getAttribute('data-aba')); });
  });

  function mostrarAbaDash(nome) {
    abaDash = nome;
    document.querySelectorAll('#tela-dashboard .aba').forEach(function (a) {
      a.classList.toggle('is-on', a.getAttribute('data-aba') === nome);
    });
    document.getElementById('painel-geral').hidden = nome !== 'geral';
    document.getElementById('painel-culto').hidden = nome !== 'culto';
    document.getElementById('painel-depto').hidden = nome !== 'depto';
    document.getElementById('painel-alertas').hidden = nome !== 'alertas';
    if (!dadosDash) return;
    if (nome === 'geral') renderGeral();
    else if (nome === 'culto') renderCulto();
    else if (nome === 'depto') renderDepto();
    else if (nome === 'alertas') renderAlertas();
  }

  async function carregarDashboard() {
    const mv = document.getElementById('dash-mes').value;
    msg('dash-msg', '');
    if (!mv) { msg('dash-msg', 'Escolha o mês.', true); return; }
    const p = mv.split('-'), ano = Number(p[0]), mes = Number(p[1]);
    const ini = ano + '-' + pad(mes) + '-01';
    const fim = ano + '-' + pad(mes) + '-' + pad(new Date(ano, mes, 0).getDate());
    msg('dash-msg', 'Carregando…');
    const culR = await sb.from('cultos').select('id, data, descricao').gte('data', ini).lte('data', fim).order('data');
    const depR = await sb.from('departamentos').select('id, nome').order('nome');
    if (culR.error || depR.error) { msg('dash-msg', 'Erro ao carregar.', true); return; }
    const cultos = culR.data || [];
    deptosDash = depR.data || [];
    const cultoMap = {}; cultos.forEach(function (c) { cultoMap[c.id] = c; });
    const cultoIds = cultos.map(function (c) { return c.id; });

    // escalas do mês + seus itens (voluntário escalado e se compareceu)
    let escData = [];
    if (cultoIds.length) {
      const escR = await sb.from('escalas')
        .select('culto_id, departamento_id, departamentos(nome), escala_itens(compareceu, voluntarios(id, nome))')
        .in('culto_id', cultoIds);
      if (escR.error) { msg('dash-msg', 'Erro ao carregar.', true); return; }
      escData = escR.data || [];
    }
    msg('dash-msg', '');

    // achata em "escalações": uma por voluntário escalado em cada culto/departamento
    const itens = [];
    escData.forEach(function (e) {
      const cul = cultoMap[e.culto_id]; if (!cul) return;
      const depNome = e.departamentos ? e.departamentos.nome : '';
      (e.escala_itens || []).forEach(function (it) {
        const v = it.voluntarios; if (!v) return;
        itens.push({ volId: v.id, volNome: v.nome, cultoId: e.culto_id, data: cul.data,
                     descricao: cul.descricao, depId: e.departamento_id, depNome: depNome, compareceu: !!it.compareceu });
      });
    });

    // agregados por voluntário e por culto
    const volAgg = {}, culAgg = {};
    cultos.forEach(function (c) { culAgg[c.id] = { esc: 0, comp: 0 }; });
    let totalEsc = 0, totalComp = 0;
    itens.forEach(function (it) {
      const a = volAgg[it.volId] || (volAgg[it.volId] = { nome: it.volNome, esc: 0, comp: 0 });
      a.esc++; if (it.compareceu) a.comp++;
      if (culAgg[it.cultoId]) { culAgg[it.cultoId].esc++; if (it.compareceu) culAgg[it.cultoId].comp++; }
      totalEsc++; if (it.compareceu) totalComp++;
    });

    dadosDash = { ano: ano, mes: mes, cultos: cultos, itens: itens, volAgg: volAgg,
                  culAgg: culAgg, totalEsc: totalEsc, totalComp: totalComp };
    dadosAlertas = null;

    const sel = document.getElementById('dep-rel');
    sel.innerHTML = '<option value="">Selecione…</option>' + deptosDash.map(function (d) {
      return '<option value="' + d.id + '">' + esc(d.nome) + '</option>';
    }).join('');

    mostrarAbaDash(abaDash);
  }

  /* --- Aba Geral --- */
  function renderGeral() {
    const d = dadosDash;
    if (!d.totalEsc) {
      document.getElementById('dash-kpis').innerHTML = '<p class="muted">Nenhuma escalação neste mês. Monte as escalas e faça o check-in.</p>';
      document.getElementById('dash-cultos').innerHTML = '';
      document.getElementById('dash-maior').innerHTML = '';
      document.getElementById('dash-menor').innerHTML = '';
      return;
    }
    const taxa = d.totalEsc ? Math.round(d.totalComp / d.totalEsc * 1000) / 10 : 0;
    const nVol = Object.keys(d.volAgg).length;
    document.getElementById('dash-kpis').innerHTML =
      kpiBox(taxa + '%', 'Comparecimento') + kpiBox(d.totalComp, 'Check-ins') +
      kpiBox(Math.max(d.totalEsc - d.totalComp, 0), 'Faltas') + kpiBox(d.totalEsc, 'Escalações') +
      '<p class="muted" style="width:100%;margin:6px 0 0">' + nVol + ' voluntário(s) escalado(s) · ' + d.cultos.length + ' culto(s)</p>';
    document.getElementById('dash-cultos').innerHTML =
      '<table class="tabela"><thead><tr><th>Data</th><th>Culto</th><th>Escal.</th><th>Check-in</th><th>%</th></tr></thead><tbody>' +
      d.cultos.map(function (c) {
        const a = d.culAgg[c.id] || { esc: 0, comp: 0 };
        const pct = a.esc ? Math.round(a.comp / a.esc * 1000) / 10 : 0;
        return '<tr><td>' + dataBR(c.data) + '</td><td>' + esc(c.descricao || '–') + '</td><td>' + a.esc + '</td><td>' + a.comp + '</td><td>' + pct + '%</td></tr>';
      }).join('') + '</tbody></table>';
    const lista = listaConf(d);
    document.getElementById('dash-maior').innerHTML = rankHtml(lista.slice().sort(function (a, b) { return b.pct - a.pct || b.comp - a.comp || a.nome.localeCompare(b.nome); }).slice(0, 8));
    document.getElementById('dash-menor').innerHTML = rankHtml(lista.slice().sort(function (a, b) { return a.pct - b.pct || a.comp - b.comp || a.nome.localeCompare(b.nome); }).slice(0, 8));
  }
  function listaConf(d) {
    return Object.keys(d.volAgg).map(function (id) {
      const a = d.volAgg[id];
      return { nome: a.nome, comp: a.comp, esc: a.esc, pct: a.esc ? Math.round(a.comp / a.esc * 1000) / 10 : 0 };
    });
  }

  /* --- Aba Por Culto --- */
  function renderCulto() {
    const d = dadosDash;
    document.getElementById('culto-detalhe').innerHTML = '';
    if (!d.cultos.length) { document.getElementById('culto-lista').innerHTML = '<p class="muted">Nenhum culto neste mês.</p>'; return; }
    document.getElementById('culto-lista').innerHTML =
      '<table class="tabela"><thead><tr><th>Data</th><th>Culto</th><th>Escal.</th><th>Check-in</th><th>Faltas</th><th></th></tr></thead><tbody>' +
      d.cultos.map(function (c) {
        const a = d.culAgg[c.id] || { esc: 0, comp: 0 };
        return '<tr><td>' + dataBR(c.data) + '</td><td>' + esc(c.descricao || '–') + '</td><td>' + a.esc + '</td><td>' + a.comp + '</td>' +
               '<td>' + Math.max(a.esc - a.comp, 0) + '</td><td>' + (a.esc ? '<button class="link-acao" data-ver="' + c.id + '">ver</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table>';
    document.querySelectorAll('#culto-lista [data-ver]').forEach(function (b) {
      b.addEventListener('click', function () { verDetalheCulto(b.getAttribute('data-ver')); });
    });
  }
  function verDetalheCulto(cultoId) {
    const d = dadosDash;
    const c = d.cultos.filter(function (x) { return x.id === cultoId; })[0];
    const presentes = [], ausentes = [];
    d.itens.forEach(function (it) {
      if (it.cultoId !== cultoId) return;
      const item = { nome: it.volNome, dep: it.depNome };
      if (it.compareceu) presentes.push(item); else ausentes.push(item);
    });
    presentes.sort(function (a, b) { return a.nome.localeCompare(b.nome); });
    ausentes.sort(function (a, b) { return a.nome.localeCompare(b.nome); });
    document.getElementById('culto-detalhe').innerHTML =
      '<p class="label">Culto de ' + (c ? dataBR(c.data) : '') + (c && c.descricao ? ' · ' + esc(c.descricao) : '') + '</p>' +
      '<p class="sub-ok">✓ Compareceram (' + presentes.length + ')</p>' + nomesHtml(presentes) +
      '<p class="sub-falta">✗ Faltaram (' + ausentes.length + ')</p>' + nomesHtml(ausentes);
    document.getElementById('culto-detalhe').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function nomesHtml(arr) {
    if (!arr.length) return '<p class="muted">—</p>';
    return '<ul class="nomes">' + arr.map(function (v) {
      return '<li>' + esc(v.nome) + (v.dep ? ' <span class="dep-tag">' + esc(v.dep) + '</span>' : '') + '</li>';
    }).join('') + '</ul>';
  }

  /* --- Aba Departamento --- */
  function renderDepto() {
    const d = dadosDash, div = document.getElementById('depto-conteudo');
    if (!d) { return; }
    const depId = document.getElementById('dep-rel').value;
    if (!depId) { div.innerHTML = '<p class="muted">Selecione um departamento.</p>'; return; }
    const agg = {};
    d.itens.forEach(function (it) {
      if (it.depId !== depId) return;
      const a = agg[it.volId] || (agg[it.volId] = { nome: it.volNome, esc: 0, comp: 0 });
      a.esc++; if (it.compareceu) a.comp++;
    });
    const lista = Object.keys(agg).map(function (id) {
      const a = agg[id], pct = a.esc ? Math.round(a.comp / a.esc * 1000) / 10 : 0;
      return { nome: a.nome, comp: a.comp, esc: a.esc, faltas: Math.max(a.esc - a.comp, 0), pct: pct, alerta: a.esc > 0 && pct < 50 };
    }).sort(function (a, b) { return a.nome.localeCompare(b.nome); });
    if (!lista.length) { div.innerHTML = '<p class="muted">Ninguém escalado neste departamento no mês.</p>'; return; }
    const alertas = lista.filter(function (v) { return v.alerta; }).map(function (v) { return v.nome; });
    let html = '';
    if (alertas.length) html += '<div class="aviso">⚠️ Atenção: <strong>' + alertas.map(esc).join(', ') + '</strong> compareceram a menos da metade das escalas.</div>';
    html += '<p class="label">Comparecimento por voluntário</p>';
    html += '<table class="tabela"><thead><tr><th>Voluntário</th><th>Escal.</th><th>Check-in</th><th>Faltas</th><th>%</th></tr></thead><tbody>' +
      lista.map(function (v) {
        return '<tr' + (v.alerta ? ' class="linha-alerta"' : '') + '><td>' + esc(v.nome) + '</td><td>' + v.esc + '</td><td>' + v.comp + '</td><td>' + v.faltas + '</td><td>' + v.pct + '%</td></tr>';
      }).join('') + '</tbody></table>';
    div.innerHTML = html;
  }

  /* --- Aba Alertas (histórico de faltas seguidas) --- */
  async function renderAlertas() {
    if (dadosAlertas) { pintarAlertas(dadosAlertas); return; }
    const div = document.getElementById('dash-alertas');
    div.innerHTML = '<p class="muted">Carregando…</p>';
    const h = new Date();
    const hojeISO = h.getFullYear() + '-' + pad(h.getMonth() + 1) + '-' + pad(h.getDate());
    const culR = await sb.from('cultos').select('id, data').lte('data', hojeISO).order('data');
    const cultoData = {}; (culR.data || []).forEach(function (c) { cultoData[c.id] = c.data; });
    const cultoIds = (culR.data || []).map(function (c) { return c.id; });
    let escData = [];
    if (cultoIds.length) {
      const escR = await sb.from('escalas')
        .select('culto_id, escala_itens(compareceu, voluntario_id, voluntarios(nome))')
        .in('culto_id', cultoIds);
      escData = escR.data || [];
    }
    // por voluntário: histórico das escalas que assumiu (ordenado por data)
    const porVol = {};
    escData.forEach(function (e) {
      const data = cultoData[e.culto_id]; if (!data) return;
      (e.escala_itens || []).forEach(function (it) {
        const o = porVol[it.voluntario_id] || (porVol[it.voluntario_id] = { nome: it.voluntarios ? it.voluntarios.nome : '', occ: [] });
        o.occ.push({ data: data, compareceu: !!it.compareceu });
      });
    });
    const alertas = [];
    Object.keys(porVol).forEach(function (vid) {
      const o = porVol[vid];
      o.occ.sort(function (a, b) { return a.data < b.data ? -1 : a.data > b.data ? 1 : 0; });
      let streak = 0;
      for (let i = o.occ.length - 1; i >= 0; i--) { if (o.occ[i].compareceu) break; streak++; }
      if (streak >= LIMITE_FALTAS) alertas.push({ nome: o.nome, faltas: streak });
    });
    alertas.sort(function (a, b) { return b.faltas - a.faltas || a.nome.localeCompare(b.nome); });
    dadosAlertas = alertas;
    pintarAlertas(alertas);
  }
  function pintarAlertas(alertas) {
    const div = document.getElementById('dash-alertas');
    if (!alertas.length) { div.innerHTML = '<p class="muted">Ninguém com faltas seguidas nas escalas. 🎉</p>'; return; }
    div.innerHTML = '<table class="tabela"><thead><tr><th>Voluntário</th><th>Faltas seguidas</th></tr></thead><tbody>' +
      alertas.map(function (a) { return '<tr class="linha-alerta"><td>' + esc(a.nome) + '</td><td>' + a.faltas + '</td></tr>'; }).join('') + '</tbody></table>';
  }

  function kpiBox(num, label) { return '<div class="kpi"><div class="kpi-num">' + num + '</div><div class="kpi-lb">' + label + '</div></div>'; }
  function rankHtml(arr) {
    if (!arr.length) return '<p class="muted">—</p>';
    return '<ol class="rank">' + arr.map(function (v) {
      return '<li>' + esc(v.nome) + ' <span class="muted">' + v.comp + '/' + v.esc + ' (' + v.pct + '%)</span></li>';
    }).join('') + '</ol>';
  }

  /* --- Exportar PDF da aba ativa --- */
  function exportarPDF() {
    if (!window.jspdf || !window.jspdf.jsPDF) { msg('dash-msg', 'Gerador de PDF não carregou. Verifique a internet.', true); return; }
    if (!dadosDash) { msg('dash-msg', 'Toque em Atualizar antes de baixar.', true); return; }
    const d = dadosDash;
    const doc = new window.jspdf.jsPDF('p', 'pt', 'a4');
    const margin = 40, AMARELO = [255, 196, 0];
    let y = margin;
    const titulos = { geral: 'Visão Geral', culto: 'Por Culto', depto: 'Por Departamento', alertas: 'Alertas de Afastamento' };
    const mesTxt = pad(d.mes) + '/' + d.ano;
    const igrejaEl = document.getElementById('sb-igreja');
    const igreja = (igrejaEl && igrejaEl.textContent && igrejaEl.textContent !== '—') ? igrejaEl.textContent : 'Igreja';

    function quebra(min) { if (y > doc.internal.pageSize.getHeight() - (min || 60)) { doc.addPage(); y = margin; } }
    function tituloPdf(t) { quebra(); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(60); doc.text(t, margin, y); y += 15; doc.setTextColor(0); doc.setFont('helvetica', 'normal'); }
    function textoPdf(t) { quebra(); doc.setFontSize(10); const ls = doc.splitTextToSize(t, doc.internal.pageSize.getWidth() - margin * 2); doc.text(ls, margin, y); y += ls.length * 13 + 4; }
    function tabelaPdf(head, body) { quebra(80); doc.autoTable({ head: [head], body: body, startY: y, margin: { left: margin, right: margin }, styles: { fontSize: 9, cellPadding: 4 }, headStyles: { fillColor: AMARELO, textColor: 20 }, theme: 'grid' }); y = doc.lastAutoTable.finalY + 14; }

    doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
    doc.text(igreja + ' — Relatório de Check-in', margin, y); y += 20;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
    doc.text(titulos[abaDash] + '   ·   ' + mesTxt, margin, y); y += 14;
    doc.setFontSize(9); doc.setTextColor(120); doc.text('Gerado em ' + new Date().toLocaleString('pt-BR'), margin, y); y += 18; doc.setTextColor(0);

    if (abaDash === 'geral') {
      const taxa = d.totalEsc ? Math.round(d.totalComp / d.totalEsc * 1000) / 10 : 0;
      textoPdf('Comparecimento: ' + taxa + '%   |   Check-ins: ' + d.totalComp + '   |   Faltas: ' + Math.max(d.totalEsc - d.totalComp, 0) + '   |   Escalações: ' + d.totalEsc);
      tituloPdf('Participação por culto');
      tabelaPdf(['Data', 'Culto', 'Escal.', 'Check-in', '%'], d.cultos.map(function (c) { const a = d.culAgg[c.id] || { esc: 0, comp: 0 }; return [dataBR(c.data), c.descricao || '-', a.esc, a.comp, (a.esc ? Math.round(a.comp / a.esc * 1000) / 10 : 0) + '%']; }));
      const lista = listaConf(d);
      tituloPdf('Maior comparecimento'); tabelaPdf(['Voluntário', 'Check-in', 'Escal.', '%'], lista.slice().sort(function (a, b) { return b.pct - a.pct || b.comp - a.comp; }).slice(0, 12).map(function (v) { return [v.nome, v.comp, v.esc, v.pct + '%']; }));
      tituloPdf('Menor comparecimento'); tabelaPdf(['Voluntário', 'Check-in', 'Escal.', '%'], lista.slice().sort(function (a, b) { return a.pct - b.pct || a.comp - b.comp; }).slice(0, 12).map(function (v) { return [v.nome, v.comp, v.esc, v.pct + '%']; }));
    } else if (abaDash === 'culto') {
      tabelaPdf(['Data', 'Culto', 'Escal.', 'Check-in', 'Faltas'], d.cultos.map(function (c) { const a = d.culAgg[c.id] || { esc: 0, comp: 0 }; return [dataBR(c.data), c.descricao || '-', a.esc, a.comp, Math.max(a.esc - a.comp, 0)]; }));
    } else if (abaDash === 'depto') {
      const depId = document.getElementById('dep-rel').value;
      if (!depId) { textoPdf('Selecione um departamento na tela antes de baixar.'); }
      else {
        const dep = deptosDash.filter(function (x) { return x.id === depId; })[0] || {};
        const agg = {};
        d.itens.forEach(function (it) { if (it.depId !== depId) return; const a = agg[it.volId] || (agg[it.volId] = { nome: it.volNome, esc: 0, comp: 0 }); a.esc++; if (it.compareceu) a.comp++; });
        tituloPdf('Departamento: ' + (dep.nome || ''));
        tabelaPdf(['Voluntário', 'Escal.', 'Check-in', 'Faltas', '%'], Object.keys(agg).map(function (id) { const a = agg[id]; return [a.nome, a.esc, a.comp, Math.max(a.esc - a.comp, 0), (a.esc ? Math.round(a.comp / a.esc * 1000) / 10 : 0) + '%']; }));
      }
    } else if (abaDash === 'alertas') {
      if (!dadosAlertas) { textoPdf('Abra a aba "Alertas" na tela para carregar os dados antes de baixar.'); }
      else { tabelaPdf(['Voluntário', 'Faltas seguidas'], dadosAlertas.map(function (a) { return [a.nome, a.faltas]; })); }
    }
    doc.save('relatorio-' + abaDash + '-' + d.mes + '-' + d.ano + '.pdf');
    msg('dash-msg', '✓ PDF gerado.');
    setTimeout(function () { msg('dash-msg', ''); }, 4000);
  }

  /* ----- Utilidades ----- */
  function pad(n) { return ('0' + n).slice(-2); }
  function dataBR(iso) {
    const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? (m[3] + '/' + m[2] + '/' + m[1]) : esc(iso);
  }
  function val(id) { return (document.getElementById(id).value || '').trim(); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function msg(id, texto, erro) {
    const el = document.getElementById(id);
    el.textContent = texto || '';
    el.className = 'msg' + (erro ? ' erro' : (texto ? ' ok' : ''));
  }
  function trava(btn, t) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = t; }
  function destrava(btn, t) { btn.disabled = false; btn.textContent = t; }

  function traduzErro(error) {
    const m = (error && error.message ? error.message : String(error)).toLowerCase();
    if (m.indexOf('invalid login') >= 0) return 'E-mail ou senha incorretos.';
    if (m.indexOf('already registered') >= 0) return 'Este e-mail já tem conta. Faça login.';
    if (m.indexOf('cnpj') >= 0) return 'Já existe uma conta para este CNPJ.';
    if (m.indexOf('já pertence') >= 0) return 'Sua conta já tem uma igreja.';
    if (m.indexOf('password') >= 0) return 'Senha muito curta (mínimo 6).';
    if (m.indexOf('email not confirmed') >= 0) return 'Confirme seu e-mail antes de entrar.';
    return (error && error.message) ? error.message : 'Algo deu errado. Tente de novo.';
  }

  init();
})();
