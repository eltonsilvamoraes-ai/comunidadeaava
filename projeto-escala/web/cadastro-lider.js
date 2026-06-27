/* Projeto Escala — Cadastro de Líder (signup + cadastrar_lider, fica pendente até o Admin autorizar) */
(function () {
  'use strict';

  const cfg = window.SUPA_CONFIG || {};
  const igrejaId = new URLSearchParams(location.search).get('igreja');
  let sb = null;

  function irPara(id) {
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('is-active'); });
    const el = document.getElementById(id); if (el) el.classList.add('is-active');
    // painel azul da marca ao lado (desktop) só nas telas de entrada.
    document.body.classList.toggle('modo-login', id === 'cl-load' || id === 'cl-form');
  }
  function msg(t, erro) { const el = document.getElementById('cl-msg'); el.textContent = t || ''; el.className = 'msg' + (erro ? ' erro' : (t ? ' ok' : '')); }
  function val(id) { return (document.getElementById(id).value || '').trim(); }
  function trava(b, t) { b.disabled = true; b.dataset.l = b.textContent; b.textContent = t; }
  function destrava(b) { b.disabled = false; b.textContent = b.dataset.l || b.textContent; }

  if (typeof supabase === 'undefined' || !supabase.createClient) {
    irPara('cl-form'); msg('Não carregou a biblioteca. Desative o bloqueador (Brave Shields) e recarregue.', true); return;
  }
  if (!cfg.URL || cfg.URL.indexOf('COLE_AQUI') >= 0) {
    irPara('cl-form'); msg('Configuração ausente (config.js).', true); return;
  }
  // mesma sessão do painel: depois de autorizado, o líder entra no index.html já logado.
  sb = supabase.createClient(cfg.URL, cfg.ANON_KEY, { auth: { storageKey: 'pe-painel' } });

  if (!igrejaId) {
    irPara('cl-form');
    msg('Link sem a igreja. Peça ao administrador o link de cadastro de líderes.', true);
    document.getElementById('cl-btn').disabled = true;
  } else {
    irPara('cl-form');
  }

  document.getElementById('cl-btn').addEventListener('click', async function () {
    const nome = val('cl-nome'), email = val('cl-email'), senha = val('cl-senha'); msg('');
    if (!igrejaId) { msg('Link sem a igreja. Peça o link ao administrador.', true); return; }
    if (!nome || !email || !senha) { msg('Preencha nome, e-mail e senha.', true); return; }
    if (senha.length < 6) { msg('A senha precisa ter ao menos 6 caracteres.', true); return; }
    trava(this, 'Criando…');
    try {
      // 1) cria a conta; se o e-mail já existe (tentativa anterior), entra para concluir o vínculo.
      let session = null;
      const up = await sb.auth.signUp({ email: email, password: senha });
      if (up.error) {
        if (/already|registered|exists/i.test(up.error.message || '')) {
          const si = await sb.auth.signInWithPassword({ email: email, password: senha });
          if (si.error) { msg('Este e-mail já tem conta, mas a senha não confere. Use "Já tenho acesso — entrar".', true); return; }
          session = si.data.session;
        } else { msg(traduz(up.error), true); return; }
      } else { session = up.data.session; }

      if (!session) {
        msg('Conta criada! Confirme o e-mail (ou peça ao admin para desligar "Confirm email") e use "Criar acesso" de novo.', true); return;
      }
      // 2) registra como líder PENDENTE (inativo até o Admin autorizar).
      const rv = await sb.rpc('cadastrar_lider', { p_igreja_id: igrejaId, p_nome: nome });
      if (rv.error) { msg('Erro ao cadastrar: ' + (rv.error.message || ''), true); return; }
      if (!rv.data || !rv.data.ok) {
        if (rv.data && /vinculada/i.test(rv.data.erro || '')) { irPara('cl-ok'); return; } // já estava cadastrado
        msg((rv.data && rv.data.erro) || 'Não consegui concluir o cadastro.', true); return;
      }
      irPara('cl-ok');
    } catch (e) { msg('Falha de conexão.', true); }
    finally { destrava(this); }
  });

  function traduz(error) {
    const m = (error && error.message ? error.message : String(error)).toLowerCase();
    if (m.indexOf('already registered') >= 0) return 'Este e-mail já tem conta. Use "Já tenho acesso — entrar".';
    if (m.indexOf('password') >= 0) return 'Senha muito curta (mínimo 6).';
    return (error && error.message) ? error.message : 'Algo deu errado. Tente de novo.';
  }
})();
