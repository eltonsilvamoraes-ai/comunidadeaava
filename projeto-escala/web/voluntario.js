/* Diakun — Cadastro de Voluntário (claim pelo código; login é no index.html) */
(function () {
  'use strict';

  const cfg = window.SUPA_CONFIG || {};
  const igrejaId = new URLSearchParams(location.search).get('igreja');
  let sb = null;

  function irPara(id) {
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('is-active'); });
    const el = document.getElementById(id); if (el) el.classList.add('is-active');
    document.body.classList.toggle('modo-login', id === 'v-load' || id === 'v-form');
  }
  function msg(t, erro) { const el = document.getElementById('v-msg'); el.textContent = t || ''; el.className = 'msg' + (erro ? ' erro' : (t ? ' ok' : '')); }
  function val(id) { return (document.getElementById(id).value || '').trim(); }
  function trava(b, t) { b.disabled = true; b.dataset.l = b.textContent; b.textContent = t; }
  function destrava(b) { b.disabled = false; b.textContent = b.dataset.l || b.textContent; }

  if (typeof supabase === 'undefined' || !supabase.createClient) {
    irPara('v-form'); msg('Não carregou a biblioteca. Desative o bloqueador (Brave Shields) e recarregue.', true); return;
  }
  if (!cfg.URL || cfg.URL.indexOf('COLE_AQUI') >= 0) {
    irPara('v-form'); msg('Configuração ausente (config.js).', true); return;
  }
  // mesma sessão do app principal: ao concluir, o voluntário já entra logado no index.html.
  sb = supabase.createClient(cfg.URL, cfg.ANON_KEY, { auth: { storageKey: 'pe-painel' } });

  if (!igrejaId) {
    irPara('v-form');
    msg('Link sem a igreja. Peça o link de cadastro à sua liderança.', true);
    document.getElementById('v-btn').disabled = true;
  } else {
    irPara('v-form');
  }

  document.getElementById('v-btn').addEventListener('click', async function () {
    const cod = val('v-cod'), email = val('v-email'), senha = val('v-senha'); msg('');
    if (!igrejaId) { msg('Link sem a igreja. Peça o link à sua liderança.', true); return; }
    if (!cod || !email || !senha) { msg('Preencha código, e-mail e senha.', true); return; }
    if (senha.length < 6) { msg('A senha precisa ter ao menos 6 caracteres.', true); return; }
    trava(this, 'Criando…');
    try {
      // 1) cria a conta; se o e-mail já existe (tentativa anterior), entra para concluir.
      let session = null;
      const up = await sb.auth.signUp({ email: email, password: senha });
      if (up.error) {
        if (/already|registered|exists/i.test(up.error.message || '')) {
          const si = await sb.auth.signInWithPassword({ email: email, password: senha });
          if (si.error) { msg('Este e-mail já tem conta, mas a senha não confere. Vá para o login.', true); return; }
          session = si.data.session;
        } else { msg(traduz(up.error), true); return; }
      } else { session = up.data.session; }

      if (!session) {
        msg('Conta criada! Confirme o e-mail (ou peça ao admin para desligar "Confirm email") e use "Criar acesso" de novo.', true); return;
      }
      // 2) vincula o login à ficha do voluntário pelo código.
      const rv = await sb.rpc('reivindicar_voluntario', { p_igreja_id: igrejaId, p_codigo: cod });
      if (rv.error) { msg('Erro ao vincular: ' + (rv.error.message || ''), true); return; }
      if (!rv.data || !rv.data.ok) {
        if (rv.data && /vinculada/i.test(rv.data.erro || '')) { irPara('v-ok'); return; } // já estava vinculada
        msg((rv.data && rv.data.erro) || 'Não consegui vincular o código.', true); return;
      }
      irPara('v-ok');
    } catch (e) { msg('Falha de conexão.', true); }
    finally { destrava(this); }
  });

  function traduz(error) {
    const m = (error && error.message ? error.message : String(error)).toLowerCase();
    if (m.indexOf('already registered') >= 0) return 'Este e-mail já tem conta. Vá para o login.';
    if (m.indexOf('password') >= 0) return 'Senha muito curta (mínimo 6).';
    return (error && error.message) ? error.message : 'Algo deu errado. Tente de novo.';
  }
})();
