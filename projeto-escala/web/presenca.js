/* Projeto Escala — Tela pública de PRESENÇA do voluntário (sem login) */
(function () {
  'use strict';

  const cfg = window.SUPA_CONFIG || {};
  const igrejaId = new URLSearchParams(location.search).get('igreja');

  const elMsg = document.getElementById('pr-msg');
  const elCod = document.getElementById('pr-cod');
  const btn = document.getElementById('pr-btn');

  let sb = null;

  function irPara(id) {
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('is-active'); });
    document.getElementById(id).classList.add('is-active');
  }
  function msg(t, erro) { elMsg.textContent = t || ''; elMsg.className = 'msg' + (erro ? ' erro' : ''); }

  // Validações iniciais.
  if (typeof supabase === 'undefined' || !supabase.createClient) {
    msg('Não carregou a biblioteca. Desative o bloqueador (Brave Shields) e recarregue.', true); btn.disabled = true;
  } else if (!cfg.URL || cfg.URL.indexOf('COLE_AQUI') >= 0) {
    msg('Configuração ausente (config.js).', true); btn.disabled = true;
  } else if (!igrejaId) {
    msg('Link inválido: falta o identificador da igreja (?igreja=...).', true); btn.disabled = true;
  } else {
    sb = supabase.createClient(cfg.URL, cfg.ANON_KEY);
    carregarNomeIgreja();
  }

  async function carregarNomeIgreja() {
    // anon não enxerga a tabela igrejas (RLS), então deixamos um título genérico.
    document.getElementById('pr-igreja').textContent = 'Presença';
  }

  btn.addEventListener('click', confirmar);
  elCod.addEventListener('keydown', function (e) { if (e.key === 'Enter') confirmar(); });
  elCod.addEventListener('input', function () { msg(''); });
  document.getElementById('pr-novo').addEventListener('click', function () {
    elCod.value = ''; msg(''); irPara('pr-form'); elCod.focus();
  });

  // ?codigo=123 -> registra direto (QR Code).
  const qr = new URLSearchParams(location.search).get('codigo');
  if (qr && sb) { elCod.value = qr.trim(); confirmar(); }

  async function confirmar() {
    const cod = elCod.value.trim();
    msg('');
    if (!cod) { msg('Digite sua matrícula.', true); return; }
    btn.disabled = true; btn.textContent = 'Localizando…';
    try {
      const coords = await obterLocalizacao();
      btn.textContent = 'Registrando…';
      const { data, error } = await sb.rpc('registrar_presenca', {
        p_igreja_id: igrejaId, p_matricula: cod,
        p_lat: coords ? coords.lat : null, p_lng: coords ? coords.lng : null
      });
      if (error) { msg('Não foi possível registrar. Tente de novo.', true); return; }
      if (!data || !data.ok) { msg((data && data.erro) || 'Não foi possível registrar.', true); return; }
      mostrar(data);
    } catch (e) {
      msg('Falha de conexão. Verifique a internet.', true);
    } finally {
      btn.disabled = false; btn.textContent = 'Confirmar presença';
    }
  }

  function mostrar(r) {
    document.getElementById('pr-nome').textContent = r.nome || '';
    const esc = document.getElementById('pr-escala');
    esc.textContent = r.escalado ? '✓ Você está na escala de hoje' : 'Você não estava escalado(a) hoje';
    document.getElementById('pr-rec').textContent = reconhecimento(r.total);
    irPara('pr-ok');
  }

  function reconhecimento(total) {
    const marcos = { 1: 'Bem-vindo(a) ao time! 🎉 Sua 1ª presença.', 5: '5 presenças! Que constância. 🙌',
      10: '10ª presença! Você faz diferença. 💙', 25: '25 presenças! Servo(a) fiel. 👏',
      50: '50ª presença! Inspirador(a). 🌟', 100: '100 presenças! Que legado. 🏆' };
    if (marcos[total]) return marcos[total];
    const frases = ['Obrigado por servir! 💙', 'Sua presença abençoa. 🙏', 'Que bom ter você aqui!', 'Deus recompense o seu servir. 🌟'];
    return frases[(total || 0) % frases.length];
  }

  function obterLocalizacao() {
    return new Promise(function (resolve) {
      if (!navigator.geolocation) { resolve(null); return; }
      navigator.geolocation.getCurrentPosition(
        function (pos) { resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
        function () { resolve(null); },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    });
  }
})();
