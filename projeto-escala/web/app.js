/* Projeto Escala — frontend (Fase 1 auth + Fase 2 voluntários/CSV) */
(function () {
  'use strict';

  const cfg = window.SUPA_CONFIG || {};
  const configOk = cfg.URL && cfg.ANON_KEY &&
    cfg.URL.indexOf('COLE_AQUI') === -1 && cfg.ANON_KEY.indexOf('COLE_AQUI') === -1;

  let sb = null;
  let igrejaId = null;          // igreja do usuário logado
  let deptosCache = [];          // [{id, nome, ativo}]

  /* ----- Navegação ----- */
  function irPara(id) {
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('is-active'); });
    const alvo = document.getElementById(id);
    if (alvo) alvo.classList.add('is-active');
  }
  // Botões que só trocam de tela (data-go).
  document.querySelectorAll('[data-go]').forEach(function (b) {
    b.addEventListener('click', function (e) {
      e.preventDefault();
      const destino = b.getAttribute('data-go');
      irPara(destino);
      if (destino === 'tela-departamentos') carregarDepartamentos();
      if (destino === 'tela-voluntarios') abrirVoluntarios();
      if (destino === 'tela-importar') resetImport();
      if (destino === 'tela-cultos-fixos') carregarCultosFixos();
      if (destino === 'tela-cultos') abrirCultos();
      if (destino === 'tela-escala') abrirEscala();
      if (destino === 'tela-dashboard') abrirDashboard();
    });
  });

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
      sb = supabase.createClient(cfg.URL, cfg.ANON_KEY);
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
    const { data: igreja, error } = await sb.from('igrejas').select('id, nome').maybeSingle();
    if (error) { irPara('tela-auth'); msg('auth-msg', traduzErro(error), true); return; }
    if (igreja) {
      igrejaId = igreja.id;
      document.getElementById('home-igreja').textContent = igreja.nome;
      document.getElementById('home-presenca').href = 'presenca.html?igreja=' + igrejaId;
      const { data: u } = await sb.from('usuarios').select('papel').maybeSingle();
      document.getElementById('home-papel').textContent = u ? ('Papel: ' + u.papel) : '';
      irPara('tela-home');
    } else {
      igrejaId = null;
      irPara('tela-igreja');
    }
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
             '<button class="link-acao link-excluir" data-del-dep="' + d.id + '">excluir</button></div>';
    }).join('');
    div.querySelectorAll('[data-del-dep]').forEach(function (b) {
      b.addEventListener('click', function () { excluirDepartamento(b.getAttribute('data-del-dep')); });
    });
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
    const r = new FileReader();
    r.onload = function () { document.getElementById('imp-texto').value = r.result; };
    r.readAsText(f, 'utf-8');
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
  /* DASHBOARD                                                    */
  /* ============================================================ */
  const LIMITE_FALTAS = 2;

  function abrirDashboard() {
    const el = document.getElementById('dash-mes');
    if (!el.value) { const h = new Date(); el.value = h.getFullYear() + '-' + pad(h.getMonth() + 1); }
    carregarDashboard();
  }
  document.getElementById('btn-dash').addEventListener('click', carregarDashboard);

  async function carregarDashboard() {
    const mv = document.getElementById('dash-mes').value;
    msg('dash-msg', '');
    if (!mv) { msg('dash-msg', 'Escolha o mês.', true); return; }
    const p = mv.split('-'), ano = Number(p[0]), mes = Number(p[1]);
    const ini = ano + '-' + pad(mes) + '-01';
    const fim = ano + '-' + pad(mes) + '-' + pad(new Date(ano, mes, 0).getDate());
    msg('dash-msg', 'Carregando…');
    const culR = await sb.from('cultos').select('id, data, descricao').gte('data', ini).lte('data', fim).order('data');
    const regR = await sb.from('registros').select('voluntario_id, data').gte('data', ini).lte('data', fim);
    const volR = await sb.from('voluntarios').select('id, nome, status');
    if (culR.error || regR.error || volR.error) { msg('dash-msg', 'Erro ao carregar.', true); return; }
    msg('dash-msg', '');

    const cultos = culR.data || [];
    const vols = (volR.data || []).filter(function (v) { return v.status !== 'inativo'; });
    const nVol = vols.length, nCultos = cultos.length;

    if (!nCultos) {
      renderKpis(0, 0, 0, 0, nVol, 0);
      document.getElementById('dash-cultos').innerHTML = '<p class="muted">Nenhum culto neste mês.</p>';
      document.getElementById('dash-maior').innerHTML = '';
      document.getElementById('dash-menor').innerHTML = '';
    } else {
      const ehCulto = {}; cultos.forEach(function (c) { ehCulto[c.data] = true; });
      const volMap = {}; vols.forEach(function (v) { volMap[v.id] = { nome: v.nome, count: 0 }; });
      const presPorData = {}; cultos.forEach(function (c) { presPorData[c.data] = {}; });
      const vistos = {};
      (regR.data || []).forEach(function (r) {
        if (ehCulto[r.data] && volMap[r.voluntario_id]) {
          const k = r.voluntario_id + '|' + r.data;
          if (!vistos[k]) { vistos[k] = true; volMap[r.voluntario_id].count++; presPorData[r.data][r.voluntario_id] = true; }
        }
      });
      const possiveis = nVol * nCultos;
      let presentes = 0; Object.keys(volMap).forEach(function (id) { presentes += volMap[id].count; });
      const faltas = Math.max(possiveis - presentes, 0);
      const taxaP = possiveis ? Math.round(presentes / possiveis * 1000) / 10 : 0;
      renderKpis(taxaP, possiveis ? Math.round((100 - taxaP) * 10) / 10 : 0, presentes, faltas, nVol, nCultos);

      document.getElementById('dash-cultos').innerHTML =
        '<table class="tabela"><thead><tr><th>Data</th><th>Culto</th><th>Pres.</th><th>%</th></tr></thead><tbody>' +
        cultos.map(function (c) {
          const pp = Object.keys(presPorData[c.data]).length;
          const pct = nVol ? Math.round(pp / nVol * 1000) / 10 : 0;
          return '<tr><td>' + dataBR(c.data) + '</td><td>' + esc(c.descricao || '–') + '</td><td>' + pp + '</td><td>' + pct + '%</td></tr>';
        }).join('') + '</tbody></table>';

      const lista = Object.keys(volMap).map(function (id) {
        return { nome: volMap[id].nome, c: volMap[id].count, pct: nCultos ? Math.round(volMap[id].count / nCultos * 1000) / 10 : 0 };
      });
      const maior = lista.slice().sort(function (a, b) { return b.c - a.c || a.nome.localeCompare(b.nome); }).slice(0, 8);
      const menor = lista.slice().sort(function (a, b) { return a.c - b.c || a.nome.localeCompare(b.nome); }).slice(0, 8);
      document.getElementById('dash-maior').innerHTML = rankHtml(maior);
      document.getElementById('dash-menor').innerHTML = rankHtml(menor);
    }

    carregarAlertas();
  }

  function renderKpis(tp, tf, pres, falt, nVol, nCultos) {
    document.getElementById('dash-kpis').innerHTML =
      kpiBox(tp + '%', 'Presença') + kpiBox(tf + '%', 'Falta') + kpiBox(pres, 'Presenças') + kpiBox(falt, 'Faltas') +
      '<p class="muted" style="width:100%;margin:6px 0 0">' + nVol + ' voluntário(s) · ' + nCultos + ' culto(s)</p>';
  }
  function kpiBox(num, label) { return '<div class="kpi"><div class="kpi-num">' + num + '</div><div class="kpi-lb">' + label + '</div></div>'; }
  function rankHtml(arr) {
    if (!arr.length) return '<p class="muted">—</p>';
    return '<ol class="rank">' + arr.map(function (v) {
      return '<li>' + esc(v.nome) + ' <span class="muted">' + v.c + ' (' + v.pct + '%)</span></li>';
    }).join('') + '</ol>';
  }

  // Alerta pastoral: voluntários com faltas seguidas (em todos os cultos já realizados).
  async function carregarAlertas() {
    const div = document.getElementById('dash-alertas');
    div.innerHTML = '<p class="muted">Carregando…</p>';
    const h = new Date();
    const hojeISO = h.getFullYear() + '-' + pad(h.getMonth() + 1) + '-' + pad(h.getDate());
    const culR = await sb.from('cultos').select('data').lte('data', hojeISO).order('data');
    const datas = (culR.data || []).map(function (c) { return c.data; });
    if (!datas.length) { div.innerHTML = '<p class="muted">Sem histórico ainda.</p>'; return; }
    const volR = await sb.from('voluntarios').select('id, nome, status');
    const vols = (volR.data || []).filter(function (v) { return v.status !== 'inativo'; });
    const regR = await sb.from('registros').select('voluntario_id, data');
    const presSet = {}, totalPres = {};
    (regR.data || []).forEach(function (r) {
      presSet[r.data + '|' + r.voluntario_id] = true;
      totalPres[r.voluntario_id] = (totalPres[r.voluntario_id] || 0) + 1;
    });
    const alertas = [];
    vols.forEach(function (v) {
      if (!totalPres[v.id]) return;             // só quem já tem histórico
      let streak = 0;
      for (let i = datas.length - 1; i >= 0; i--) {
        if (presSet[datas[i] + '|' + v.id]) break;
        streak++;
      }
      if (streak >= LIMITE_FALTAS) alertas.push({ nome: v.nome, faltas: streak });
    });
    alertas.sort(function (a, b) { return b.faltas - a.faltas || a.nome.localeCompare(b.nome); });
    if (!alertas.length) { div.innerHTML = '<p class="muted">Ninguém com faltas seguidas. 🎉</p>'; return; }
    div.innerHTML = '<table class="tabela"><thead><tr><th>Voluntário</th><th>Faltas seguidas</th></tr></thead><tbody>' +
      alertas.map(function (a) { return '<tr><td>' + esc(a.nome) + '</td><td>' + a.faltas + '</td></tr>'; }).join('') +
      '</tbody></table>';
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
