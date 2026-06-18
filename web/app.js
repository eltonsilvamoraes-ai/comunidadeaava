/* AAVA — Registro de Presença (frontend) */
(function () {
  'use strict';

  const cfg = window.CONFIG || {};
  const MODO_DEMO = !cfg.APPS_SCRIPT_URL;

  // Voluntários fictícios para o MODO DEMONSTRAÇÃO (sem backend).
  const DEMO = {
    '1001': { nome: 'Maria Oliveira', departamento: 'Louvor' },
    '1002': { nome: 'João Pereira',   departamento: 'Recepção' },
    '1003': { nome: 'Ana Souza',      departamento: 'Infantil' }
  };

  // Elementos
  const telaCodigo = document.getElementById('tela-codigo');
  const telaOk     = document.getElementById('tela-ok');
  const campo      = document.getElementById('campo-codigo');
  const erro       = document.getElementById('msg-erro');
  const btn        = document.getElementById('btn-confirmar');
  const btnNovo    = document.getElementById('btn-novo');
  const avisoDemo  = document.getElementById('aviso-demo');
  const okNome     = document.getElementById('ok-nome');
  const okTitulo   = document.getElementById('ok-titulo');
  const okDetalhe  = document.getElementById('ok-detalhe');

  if (MODO_DEMO) avisoDemo.hidden = false;

  // Se o QR Code abrir a página com ?codigo=123, já preenche.
  const params = new URLSearchParams(location.search);
  if (params.get('codigo')) {
    campo.value = params.get('codigo').trim();
    confirmar();
  }

  btn.addEventListener('click', confirmar);
  campo.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') confirmar();
  });
  campo.addEventListener('input', () => { erro.textContent = ''; });
  btnNovo.addEventListener('click', reiniciar);

  async function confirmar() {
    const codigo = campo.value.trim();
    erro.textContent = '';
    if (!codigo) {
      erro.textContent = 'Digite seu código.';
      campo.focus();
      return;
    }

    setCarregando(true);
    try {
      const r = await registrarPresenca(codigo);
      if (!r.ok) {
        erro.textContent = r.erro || 'Não foi possível registrar.';
        campo.focus();
        return;
      }
      mostrarConfirmacao(r);
    } catch (e) {
      erro.textContent = 'Falha de conexão. Verifique a internet e tente de novo.';
    } finally {
      setCarregando(false);
    }
  }

  async function registrarPresenca(codigo) {
    if (MODO_DEMO) {
      await espera(500);
      const v = DEMO[codigo];
      if (!v) return { ok: false, erro: 'Código não encontrado (modo demonstração).' };
      const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      return { ok: true, nome: v.nome, departamento: v.departamento, hora, jaRegistrado: false };
    }
    const resp = await fetch(cfg.APPS_SCRIPT_URL, {
      method: 'POST',
      // text/plain evita o "preflight" de CORS no Apps Script.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'registrarPresenca', codigo })
    });
    return resp.json();
  }

  function mostrarConfirmacao(r) {
    okTitulo.textContent = r.jaRegistrado ? 'Presença já registrada' : 'Presença registrada!';
    okNome.textContent   = r.nome;
    const partes = [];
    if (r.departamento) partes.push(r.departamento);
    if (r.hora) partes.push('Chegada às ' + r.hora);
    okDetalhe.textContent = partes.join(' · ');
    telaCodigo.classList.remove('is-active');
    telaOk.classList.add('is-active');
  }

  function reiniciar() {
    campo.value = '';
    erro.textContent = '';
    telaOk.classList.remove('is-active');
    telaCodigo.classList.add('is-active');
    campo.focus();
  }

  function setCarregando(v) {
    btn.disabled = v;
    btn.textContent = v ? 'Registrando...' : 'Confirmar';
  }

  const espera = (ms) => new Promise((res) => setTimeout(res, ms));
})();
