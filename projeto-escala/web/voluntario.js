/* Projeto Escala — Área do Voluntário (presença + minhas escalas, sem login) */
(function () {
  'use strict';

  const cfg = window.SUPA_CONFIG || {};
  const igrejaId = new URLSearchParams(location.search).get('igreja');
  const elCod = document.getElementById('v-cod');
  const elMsg = document.getElementById('v-msg');
  const btnP = document.getElementById('v-presenca');
  const btnE = document.getElementById('v-escalas');
  let sb = null;

  function irPara(id) {
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('is-active'); });
    document.getElementById(id).classList.add('is-active');
  }
  function msg(t, erro) { elMsg.textContent = t || ''; elMsg.className = 'msg' + (erro ? ' erro' : ''); }

  if (typeof supabase === 'undefined' || !supabase.createClient) {
    msg('Não carregou a biblioteca. Desative o bloqueador (Brave Shields) e recarregue.', true); desativa();
  } else if (!cfg.URL || cfg.URL.indexOf('COLE_AQUI') >= 0) {
    msg('Configuração ausente (config.js).', true); desativa();
  } else if (!igrejaId) {
    msg('Link inválido: falta o identificador da igreja (?igreja=...).', true); desativa();
  } else {
    sb = supabase.createClient(cfg.URL, cfg.ANON_KEY);
  }
  function desativa() { btnP.disabled = true; btnE.disabled = true; }

  elCod.addEventListener('input', function () { msg(''); });
  btnP.addEventListener('click', registrarPresenca);
  btnE.addEventListener('click', verEscalas);
  document.getElementById('v-volta-1').addEventListener('click', voltar);
  document.getElementById('v-volta-2').addEventListener('click', voltar);
  function voltar() { msg(''); irPara('v-entrada'); elCod.focus(); }

  // QR Code: ?codigo=143 já registra presença.
  const qr = new URLSearchParams(location.search).get('codigo');
  if (qr && sb) { elCod.value = qr.trim(); registrarPresenca(); }

  async function registrarPresenca() {
    const cod = elCod.value.trim(); msg('');
    if (!cod) { msg('Digite sua matrícula.', true); return; }
    trava(btnP, 'Localizando…');
    try {
      const coords = await obterLocalizacao();
      btnP.textContent = 'Registrando…';
      const { data, error } = await sb.rpc('registrar_presenca', {
        p_igreja_id: igrejaId, p_matricula: cod,
        p_lat: coords ? coords.lat : null, p_lng: coords ? coords.lng : null
      });
      if (error) { msg('Não foi possível registrar. Tente de novo.', true); return; }
      if (!data || !data.ok) { msg((data && data.erro) || 'Não foi possível registrar.', true); return; }
      document.getElementById('v-ok-nome').textContent = data.nome || '';
      document.getElementById('v-ok-escala').textContent = data.escalado ? '✓ Você está na escala de hoje' : 'Você não estava escalado(a) hoje';
      document.getElementById('v-ok-rec').textContent = reconhecimento(data.total);
      irPara('v-ok');
    } catch (e) { msg('Falha de conexão. Verifique a internet.', true); }
    finally { destrava(btnP, 'Registrar presença'); }
  }

  async function verEscalas() {
    const cod = elCod.value.trim(); msg('');
    if (!cod) { msg('Digite sua matrícula.', true); return; }
    trava(btnE, 'Buscando…');
    try {
      const { data, error } = await sb.rpc('minhas_escalas', { p_igreja_id: igrejaId, p_matricula: cod });
      if (error) { msg('Não foi possível buscar. Tente de novo.', true); return; }
      if (!data || !data.ok) { msg((data && data.erro) || 'Não encontrado.', true); return; }
      document.getElementById('v-saud').textContent = 'Graça e Paz, ' + (data.nome || '') + '! 🙏 Veja onde você vai servir:';
      const esc = data.escalas || [];
      const div = document.getElementById('v-escalas-conteudo');
      if (!esc.length) {
        div.innerHTML = '<p class="muted">Você não tem escalas futuras no momento.</p>';
      } else {
        div.innerHTML = '<table class="tabela"><thead><tr><th>Data</th><th>Dia</th><th>Culto</th><th>Departamento</th></tr></thead><tbody>' +
          esc.map(function (e) {
            return '<tr><td>' + dataBR(e.data) + '</td><td>' + diaSemana(e.data) + '</td>' +
                   '<td>' + escHtml(e.descricao || '–') + '</td><td>' + escHtml(e.departamento || '–') + '</td></tr>';
          }).join('') + '</tbody></table>';
      }
      irPara('v-lista');
    } catch (e) { msg('Falha de conexão. Verifique a internet.', true); }
    finally { destrava(btnE, 'Ver minhas escalas'); }
  }

  /* ----- utilidades ----- */
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
  function dataBR(iso) { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? (m[3] + '/' + m[2] + '/' + m[1]) : escHtml(iso); }
  function diaSemana(iso) {
    const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); if (!m) return '–';
    const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    return dias[new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getDay()];
  }
  function escHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function trava(b, t) { b.disabled = true; b.textContent = t; }
  function destrava(b, t) { b.disabled = false; b.textContent = t; }
})();
