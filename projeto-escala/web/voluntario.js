/* Projeto Escala — Área do Voluntário (login + minhas escalas + PDF + trocar senha) */
(function () {
  'use strict';

  const cfg = window.SUPA_CONFIG || {};
  const igrejaId = new URLSearchParams(location.search).get('igreja');
  let sb = null;
  let ultimaEscala = null;   // guarda os dados para o PDF

  function irPara(id) {
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('is-active'); });
    document.getElementById(id).classList.add('is-active');
    document.body.classList.toggle('modo-login', id === 'v-load' || id === 'v-auth');
  }
  function msg(id, t, erro) { const el = document.getElementById(id); el.textContent = t || ''; el.className = 'msg' + (erro ? ' erro' : (t ? ' ok' : '')); }
  function val(id) { return (document.getElementById(id).value || '').trim(); }
  function trava(b, t) { b.disabled = true; b.dataset.l = b.textContent; b.textContent = t; }
  function destrava(b) { b.disabled = false; b.textContent = b.dataset.l || b.textContent; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  if (typeof supabase === 'undefined' || !supabase.createClient) {
    irPara('v-auth'); msg('v-auth-msg', 'Não carregou a biblioteca. Desative o bloqueador (Brave Shields) e recarregue.', true); return;
  }
  if (!cfg.URL || cfg.URL.indexOf('COLE_AQUI') >= 0) {
    irPara('v-auth'); msg('v-auth-msg', 'Configuração ausente (config.js).', true); return;
  }
  // storageKey próprio: a sessão do voluntário não interfere na do painel do líder.
  sb = supabase.createClient(cfg.URL, cfg.ANON_KEY, { auth: { storageKey: 'pe-voluntario' } });

  /* ----- Abas ----- */
  document.querySelectorAll('#v-auth .aba').forEach(function (a) {
    a.addEventListener('click', function () {
      document.querySelectorAll('#v-auth .aba').forEach(function (x) { x.classList.remove('is-on'); });
      a.classList.add('is-on');
      const aba = a.getAttribute('data-aba');
      document.getElementById('v-painel-entrar').hidden = aba !== 'entrar';
      document.getElementById('v-painel-criar').hidden = aba !== 'criar';
      msg('v-auth-msg', '');
    });
  });

  /* ----- Início ----- */
  (async function init() {
    const { data } = await sb.auth.getSession();
    if (data && data.session) carregarArea();
    else irPara('v-auth');
  })();

  /* ----- Entrar ----- */
  document.getElementById('v-btn-login').addEventListener('click', async function () {
    const email = val('v-login-email'), senha = val('v-login-senha'); msg('v-auth-msg', '');
    if (!email || !senha) { msg('v-auth-msg', 'Preencha e-mail e senha.', true); return; }
    trava(this, 'Entrando…');
    try {
      const { error } = await sb.auth.signInWithPassword({ email: email, password: senha });
      if (error) { msg('v-auth-msg', erroAuth(error), true); return; }
      carregarArea();
    } catch (e) { msg('v-auth-msg', 'Falha de conexão.', true); }
    finally { destrava(this); }
  });

  /* ----- Criar acesso (reivindica a ficha pelo código) ----- */
  document.getElementById('v-btn-cad').addEventListener('click', async function () {
    const cod = val('v-cad-cod'), email = val('v-cad-email'), senha = val('v-cad-senha'); msg('v-auth-msg', '');
    if (!igrejaId) { msg('v-auth-msg', 'Link sem a igreja. Peça o link de cadastro à sua liderança.', true); return; }
    if (!cod || !email || !senha) { msg('v-auth-msg', 'Preencha código, e-mail e senha.', true); return; }
    trava(this, 'Criando…');
    try {
      // 1) cria a conta; se o e-mail já existe (tentativa anterior travada), entra para concluir.
      let session = null;
      const up = await sb.auth.signUp({ email: email, password: senha });
      if (up.error) {
        if (/already|registered|exists/i.test(up.error.message || '')) {
          const si = await sb.auth.signInWithPassword({ email: email, password: senha });
          if (si.error) { msg('v-auth-msg', 'Este e-mail já tem conta, mas a senha não confere. Use "Entrar" ou recupere a senha.', true); return; }
          session = si.data.session;
        } else { msg('v-auth-msg', erroAuth(up.error), true); return; }
      } else {
        session = up.data.session;
      }
      if (!session) {
        msg('v-auth-msg', 'Conta criada! Desligue "Confirm email" no Supabase (ou confirme o e-mail) e use "Criar acesso" de novo para concluir.', true); return;
      }
      // 2) vincula o login à ficha do voluntário pelo código.
      const rv = await sb.rpc('reivindicar_voluntario', { p_igreja_id: igrejaId, p_codigo: cod });
      if (rv.error) { msg('v-auth-msg', 'Erro ao vincular: ' + (rv.error.message || ''), true); return; }
      if (!rv.data || !rv.data.ok) {
        if (rv.data && /vinculada/i.test(rv.data.erro || '')) { carregarArea(); return; } // já estava vinculada
        msg('v-auth-msg', (rv.data && rv.data.erro) || 'Não consegui vincular o código.', true); return;
      }
      carregarArea();
    } catch (e) { msg('v-auth-msg', 'Falha de conexão.', true); }
    finally { destrava(this); }
  });

  /* ----- Área pessoal ----- */
  async function carregarArea() {
    irPara('v-load');
    const { data, error } = await sb.rpc('minhas_escalas_eu');
    if (error) {
      // mostra o erro REAL do banco (ex.: função não publicada).
      irPara('v-auth');
      msg('v-auth-msg', 'Erro ao ler a escala: ' + (error.message || error.code || JSON.stringify(error)), true);
      return;
    }
    if (!data || !data.ok) {
      irPara('v-auth');
      msg('v-auth-msg', (data && data.erro) || 'Conta sem voluntário vinculado.', true);
      return;
    }
    ultimaEscala = data;
    document.getElementById('v-saud').textContent = 'Graça e Paz, ' + (data.nome || '') + '! 🙏';
    const esc_ = data.escalas || [];
    const div = document.getElementById('v-escalas');
    if (!esc_.length) {
      div.innerHTML = '<p class="muted">Você não tem escalas futuras no momento.</p>';
    } else {
      div.innerHTML = '<table class="tabela"><thead><tr><th>Data</th><th>Dia</th><th>Culto</th><th>Departamento</th></tr></thead><tbody>' +
        esc_.map(function (e) {
          return '<tr><td>' + dataBR(e.data) + '</td><td>' + diaSemana(e.data) + '</td>' +
                 '<td>' + esc(e.descricao || '–') + '</td><td>' + esc(e.departamento || '–') + '</td></tr>';
        }).join('') + '</tbody></table>';
    }
    irPara('v-home');
  }

  /* ----- Baixar PDF da minha escala ----- */
  document.getElementById('v-btn-pdf').addEventListener('click', function () {
    if (!window.jspdf || !window.jspdf.jsPDF) { alert('Gerador de PDF não carregou. Verifique a internet.'); return; }
    if (!ultimaEscala) return;
    const doc = new window.jspdf.jsPDF('p', 'pt', 'a4');
    const margin = 40; let y = margin;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
    doc.text((ultimaEscala.igreja || 'Minha escala'), margin, y); y += 20;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
    doc.text('Escala de ' + (ultimaEscala.nome || ''), margin, y); y += 14;
    doc.setFontSize(9); doc.setTextColor(120); doc.text('Gerado em ' + new Date().toLocaleString('pt-BR'), margin, y); y += 16; doc.setTextColor(0);
    const linhas = (ultimaEscala.escalas || []).map(function (e) { return [dataBR(e.data), diaSemana(e.data), e.descricao || '-', e.departamento || '-']; });
    doc.autoTable({ head: [['Data', 'Dia', 'Culto', 'Departamento']], body: linhas.length ? linhas : [['—', '', 'Sem escalas futuras', '']],
      startY: y, margin: { left: margin, right: margin }, styles: { fontSize: 10, cellPadding: 5 }, headStyles: { fillColor: [45, 156, 219] }, theme: 'grid' });
    doc.save('minha-escala.pdf');
  });

  /* ----- Trocar senha ----- */
  document.getElementById('v-btn-senha').addEventListener('click', async function () {
    const nova = val('v-nova-senha'); msg('v-senha-msg', '');
    if (nova.length < 6) { msg('v-senha-msg', 'A senha precisa ter ao menos 6 caracteres.', true); return; }
    trava(this, 'Salvando…');
    try {
      const { error } = await sb.auth.updateUser({ password: nova });
      if (error) { msg('v-senha-msg', erroAuth(error), true); return; }
      document.getElementById('v-nova-senha').value = '';
      msg('v-senha-msg', '✓ Senha alterada.');
    } catch (e) { msg('v-senha-msg', 'Falha de conexão.', true); }
    finally { destrava(this); }
  });

  /* ----- Sair ----- */
  document.getElementById('v-sair').addEventListener('click', function (e) {
    e.preventDefault();
    sb.auth.signOut().then(function () {
      ['v-login-email', 'v-login-senha', 'v-cad-cod', 'v-cad-email', 'v-cad-senha'].forEach(function (id) { document.getElementById(id).value = ''; });
      msg('v-auth-msg', ''); irPara('v-auth');
    });
  });

  /* ----- utilidades ----- */
  function dataBR(iso) { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? (m[3] + '/' + m[2] + '/' + m[1]) : esc(iso); }
  function diaSemana(iso) {
    const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); if (!m) return '–';
    const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    return dias[new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getDay()];
  }
  function erroAuth(error) {
    const m = (error && error.message ? error.message : String(error)).toLowerCase();
    if (m.indexOf('invalid login') >= 0) return 'E-mail ou senha incorretos.';
    if (m.indexOf('already registered') >= 0) return 'Este e-mail já tem conta. Use "Entrar".';
    if (m.indexOf('password') >= 0) return 'Senha muito curta (mínimo 6).';
    if (m.indexOf('email not confirmed') >= 0) return 'Confirme seu e-mail antes de entrar.';
    return (error && error.message) ? error.message : 'Algo deu errado. Tente de novo.';
  }
})();
