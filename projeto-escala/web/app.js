/* Projeto Escala — frontend Fase 1 (auth + criar igreja) */
(function () {
  'use strict';

  const cfg = window.SUPA_CONFIG || {};
  const configOk = cfg.URL && cfg.ANON_KEY &&
    cfg.URL.indexOf('COLE_AQUI') === -1 && cfg.ANON_KEY.indexOf('COLE_AQUI') === -1;

  let sb = null;
  if (configOk) sb = supabase.createClient(cfg.URL, cfg.ANON_KEY);

  /* ----- Navegação entre telas ----- */
  function irPara(id) {
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('is-active'); });
    const alvo = document.getElementById(id);
    if (alvo) alvo.classList.add('is-active');
  }

  /* ----- Início ----- */
  async function init() {
    if (!configOk) {
      irPara('tela-auth');
      msg('auth-msg', 'Configure o config.js com a URL e a anon key do Supabase.', true);
      return;
    }
    const { data } = await sb.auth.getSession();
    if (data && data.session) await rotearLogado();
    else irPara('tela-auth');
  }

  /* Decide a tela de quem está logado: tem igreja -> home; senão -> criar igreja. */
  async function rotearLogado() {
    irPara('tela-load');
    const { data: igreja, error } = await sb.from('igrejas').select('id, nome').maybeSingle();
    if (error) { irPara('tela-auth'); msg('auth-msg', traduzErro(error), true); return; }
    if (igreja) {
      document.getElementById('home-igreja').textContent = igreja.nome;
      const { data: u } = await sb.from('usuarios').select('papel').maybeSingle();
      document.getElementById('home-papel').textContent = u ? ('Papel: ' + u.papel) : '';
      irPara('tela-home');
    } else {
      irPara('tela-igreja');
    }
  }

  /* ----- Abas login/cadastro ----- */
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

  /* ----- Cadastro ----- */
  document.getElementById('btn-cadastro').addEventListener('click', async function () {
    const email = val('cad-email'), senha = val('cad-senha');
    msg('auth-msg', '');
    if (!email || !senha) { msg('auth-msg', 'Preencha e-mail e senha.', true); return; }
    const btn = this; trava(btn, 'Criando…');
    try {
      const { data, error } = await sb.auth.signUp({ email: email, password: senha });
      if (error) { msg('auth-msg', traduzErro(error), true); return; }
      if (data.session) {            // confirmação de e-mail desligada -> já entra
        await rotearLogado();
      } else {                       // confirmação ligada -> precisa confirmar
        msg('auth-msg', 'Conta criada! Confirme pelo link enviado ao seu e-mail e depois entre.');
      }
    } catch (e) { msg('auth-msg', 'Falha de conexão.', true); }
    finally { destrava(btn, 'Criar conta'); }
  });

  /* ----- Login ----- */
  document.getElementById('btn-login').addEventListener('click', async function () {
    const email = val('login-email'), senha = val('login-senha');
    msg('auth-msg', '');
    if (!email || !senha) { msg('auth-msg', 'Preencha e-mail e senha.', true); return; }
    const btn = this; trava(btn, 'Entrando…');
    try {
      const { error } = await sb.auth.signInWithPassword({ email: email, password: senha });
      if (error) { msg('auth-msg', traduzErro(error), true); return; }
      await rotearLogado();
    } catch (e) { msg('auth-msg', 'Falha de conexão.', true); }
    finally { destrava(btn, 'Entrar'); }
  });

  /* ----- Criar igreja ----- */
  document.getElementById('btn-criar-igreja').addEventListener('click', async function () {
    const nome = val('ig-nome');
    const cnpj = val('ig-cnpj').replace(/\D/g, '');   // só dígitos
    const admin = val('ig-admin');
    msg('igreja-msg', '');
    if (!nome || !cnpj || !admin) { msg('igreja-msg', 'Preencha todos os campos.', true); return; }
    if (cnpj.length !== 14) { msg('igreja-msg', 'CNPJ deve ter 14 dígitos.', true); return; }
    const btn = this; trava(btn, 'Criando…');
    try {
      const { error } = await sb.rpc('criar_igreja', {
        p_cnpj: cnpj, p_nome_igreja: nome, p_nome_admin: admin
      });
      if (error) { msg('igreja-msg', traduzErro(error), true); return; }
      await rotearLogado();
    } catch (e) { msg('igreja-msg', 'Falha de conexão.', true); }
    finally { destrava(btn, 'Criar igreja'); }
  });

  /* ----- Sair ----- */
  function sair(e) {
    if (e) e.preventDefault();
    sb.auth.signOut().then(function () {
      ['login-email','login-senha','cad-email','cad-senha','ig-nome','ig-cnpj','ig-admin']
        .forEach(function (id) { const el = document.getElementById(id); if (el) el.value = ''; });
      msg('auth-msg', ''); irPara('tela-auth');
    });
  }
  document.getElementById('btn-sair-1').addEventListener('click', sair);
  document.getElementById('btn-sair-2').addEventListener('click', sair);

  /* ----- Utilidades ----- */
  function val(id) { return (document.getElementById(id).value || '').trim(); }
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
