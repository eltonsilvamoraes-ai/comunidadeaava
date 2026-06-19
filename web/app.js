/* AAVA — Voluntários (frontend) */
(function () {
  'use strict';

  const cfg = window.CONFIG || {};
  const MODO_DEMO = !cfg.APPS_SCRIPT_URL;
  let pinLider = '';

  const DEMO_VOL = {
    '1001': { nome: 'Maria Oliveira', departamento: 'Louvor' },
    '1002': { nome: 'João Pereira',   departamento: 'Recepção' },
    '1003': { nome: 'Ana Souza',      departamento: 'Infantil' }
  };

  /* ----- Navegação entre telas ----- */
  function irPara(id) {
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('is-active'); });
    const alvo = document.getElementById(id);
    if (alvo) alvo.classList.add('is-active');
    const foco = alvo && alvo.querySelector('input, select');
    if (foco && id !== 'tela-inicio') setTimeout(function () { foco.focus(); }, 50);
  }
  document.querySelectorAll('[data-ir]').forEach(function (el) {
    el.addEventListener('click', function () { irPara(el.getAttribute('data-ir')); });
  });

  /* ----- Chamada ao backend ----- */
  async function api(payload) {
    if (MODO_DEMO) return demo(payload);
    const resp = await fetch(cfg.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    return resp.json();
  }

  /* ============================================================= */
  /* PRESENÇA                                                      */
  /* ============================================================= */
  const campo = document.getElementById('campo-codigo');
  const erro  = document.getElementById('msg-erro');
  const btn   = document.getElementById('btn-confirmar');

  if (MODO_DEMO) document.getElementById('aviso-demo').hidden = false;

  // QR Code: ?codigo=123 abre direto na presença e confirma.
  const params = new URLSearchParams(location.search);
  if (params.get('codigo')) {
    irPara('tela-inicio');
    campo.value = params.get('codigo').trim();
    confirmarPresenca();
  }

  btn.addEventListener('click', confirmarPresenca);
  campo.addEventListener('keydown', function (e) { if (e.key === 'Enter') confirmarPresenca(); });
  campo.addEventListener('input', function () { erro.textContent = ''; });
  document.getElementById('btn-novo').addEventListener('click', function () {
    campo.value = ''; erro.textContent = ''; irPara('tela-inicio');
  });

  async function confirmarPresenca() {
    const codigo = campo.value.trim();
    erro.textContent = '';
    if (!codigo) { erro.textContent = 'Digite seu código.'; return; }

    btn.disabled = true; btn.textContent = 'Registrando...';
    try {
      const r = await api({ action: 'registrarPresenca', codigo: codigo });
      if (!r.ok) { erro.textContent = r.erro || 'Não foi possível registrar.'; return; }
      mostrarConfirmacao(r);
    } catch (e) {
      erro.textContent = 'Falha de conexão. Verifique a internet e tente de novo.';
    } finally {
      btn.disabled = false; btn.textContent = 'Confirmar';
    }
  }

  function mostrarConfirmacao(r) {
    document.getElementById('ok-titulo').textContent = 'Presença registrada!';
    document.getElementById('ok-nome').textContent = r.nome;
    const partes = [];
    if (r.departamento) partes.push(r.departamento);
    const dataHora = [r.data, r.hora].filter(Boolean).join(' às ');
    if (dataHora) partes.push('Chegada: ' + dataHora);
    document.getElementById('ok-detalhe').textContent = partes.join(' · ');

    const escala = document.getElementById('ok-escala');
    if (r.escalado === true) {
      escala.textContent = '✓ Você está na escala de hoje';
      escala.className = 'ok__escala sim';
    } else if (r.escalado === false) {
      escala.textContent = 'Você não estava escalado(a) hoje';
      escala.className = 'ok__escala nao';
    } else {
      escala.textContent = '';
    }
    irPara('tela-ok');
  }

  /* ============================================================= */
  /* PIN DA ÁREA DO LÍDER                                          */
  /* ============================================================= */
  const campoPin = document.getElementById('campo-pin');
  const pinErro  = document.getElementById('pin-erro');
  document.getElementById('btn-pin').addEventListener('click', entrarLider);
  campoPin.addEventListener('keydown', function (e) { if (e.key === 'Enter') entrarLider(); });

  function entrarLider() {
    const pin = campoPin.value.trim();
    if (!pin) { pinErro.textContent = 'Digite o PIN.'; return; }
    pinLider = pin;
    pinErro.textContent = '';
    campoPin.value = '';
    irPara('tela-menu');
    carregarDepartamentos();
  }

  /* ============================================================= */
  /* MONTAR ESCALA                                                 */
  /* ============================================================= */
  const selDep   = document.getElementById('esc-departamento');
  const inpData  = document.getElementById('esc-data');
  const inpHora  = document.getElementById('esc-horario');
  const divLista = document.getElementById('esc-lista');
  const escMsg   = document.getElementById('esc-msg');
  let depsCarregados = false;

  async function carregarDepartamentos() {
    if (depsCarregados) return;
    try {
      const r = await api({ action: 'listarDepartamentos' });
      if (r.ok) {
        selDep.innerHTML = '<option value="">Selecione...</option>' +
          r.departamentos.map(function (d) { return '<option>' + escapeHtml(d) + '</option>'; }).join('');
        depsCarregados = true;
      }
    } catch (e) { /* silencioso */ }
  }

  selDep.addEventListener('change', atualizarLista);
  inpData.addEventListener('change', atualizarLista);

  async function atualizarLista() {
    const dep = selDep.value;
    escMsg.textContent = '';
    if (!dep) { divLista.innerHTML = '<p class="lista-vazia">Selecione um departamento.</p>'; return; }

    divLista.innerHTML = '<p class="lista-vazia">Carregando...</p>';
    try {
      const r = await api({ action: 'listarVoluntarios', departamento: dep });
      if (!r.ok || !r.voluntarios.length) {
        divLista.innerHTML = '<p class="lista-vazia">Nenhum voluntário neste departamento.</p>';
        return;
      }
      // Marca quem já estava escalado nessa data (se data informada).
      let jaEscalados = [];
      if (inpData.value) {
        const e = await api({ action: 'listarEscala', pin: pinLider, data: inpData.value, departamento: dep });
        if (e.ok) { jaEscalados = e.codigos || []; if (e.horario && !inpHora.value) inpHora.value = e.horario; }
      }
      divLista.innerHTML = r.voluntarios.map(function (v) {
        const checked = jaEscalados.indexOf(v.codigo) >= 0 ? 'checked' : '';
        return '<label class="voluntario-item">' +
                 '<input type="checkbox" value="' + escapeHtml(v.codigo) + '" ' + checked + '>' +
                 '<span>' + escapeHtml(v.nome) + '</span>' +
               '</label>';
      }).join('');
    } catch (e) {
      divLista.innerHTML = '<p class="lista-vazia">Erro ao carregar. Tente de novo.</p>';
    }
  }

  document.getElementById('btn-salvar-escala').addEventListener('click', salvarEscala);

  async function salvarEscala() {
    escMsg.textContent = '';
    const dep = selDep.value;
    if (!dep)          { escMsg.textContent = 'Selecione o departamento.'; return; }
    if (!inpData.value){ escMsg.textContent = 'Escolha a data do culto.'; return; }

    const codigos = Array.prototype.slice
      .call(divLista.querySelectorAll('input[type=checkbox]:checked'))
      .map(function (c) { return c.value; });

    const btnS = document.getElementById('btn-salvar-escala');
    btnS.disabled = true; btnS.textContent = 'Salvando...';
    try {
      const r = await api({
        action: 'salvarEscala', pin: pinLider,
        data: inpData.value, horario: inpHora.value,
        departamento: dep, codigos: codigos
      });
      if (!r.ok) { escMsg.textContent = r.erro || 'Não foi possível salvar.'; return; }
      escMsg.style.color = '#27ae60';
      escMsg.textContent = '✓ Escala salva: ' + r.total + ' voluntário(s) em ' + r.data + '.';
      setTimeout(function () { escMsg.style.color = ''; }, 4000);
    } catch (e) {
      escMsg.textContent = 'Falha de conexão. Tente de novo.';
    } finally {
      btnS.disabled = false; btnS.textContent = 'Salvar escala';
    }
  }

  /* ============================================================= */
  /* MINHAS ESCALAS                                                */
  /* ============================================================= */
  const campoMinhas  = document.getElementById('campo-minhas');
  const minhasErro   = document.getElementById('minhas-erro');
  const minhasResult = document.getElementById('minhas-resultado');
  document.getElementById('btn-minhas').addEventListener('click', verMinhas);
  campoMinhas.addEventListener('keydown', function (e) { if (e.key === 'Enter') verMinhas(); });

  async function verMinhas() {
    const codigo = campoMinhas.value.trim();
    minhasErro.textContent = ''; minhasResult.innerHTML = '';
    if (!codigo) { minhasErro.textContent = 'Digite seu código.'; return; }
    try {
      const r = await api({ action: 'minhasEscalas', codigo: codigo });
      if (!r.ok) { minhasErro.textContent = r.erro || 'Não encontrado.'; return; }

      const saudacao =
        '<p class="saudacao">Graça e Paz, <strong>' + escapeHtml(r.nome) + '</strong>! 🙏<br>' +
        'Veja abaixo todos os dias em que você irá servir.</p>' +
        (r.departamento ? '<p class="indice">Departamento: <strong>' + escapeHtml(r.departamento) + '</strong></p>' : '');

      if (!r.escalas.length) {
        minhasResult.innerHTML = saudacao + '<p class="lista-vazia">Você ainda não tem escalas cadastradas.</p>';
        return;
      }
      const linhas = r.escalas.map(function (e) {
        return '<tr>' +
                 '<td class="td-data">' + escapeHtml(e.data) + '</td>' +
                 '<td>' + escapeHtml(cultoDoDia(e.data)) + '</td>' +
                 '<td>' + escapeHtml(e.departamento || '–') + '</td>' +
               '</tr>';
      }).join('');
      minhasResult.innerHTML = saudacao +
        '<table class="tabela"><thead><tr><th>Data</th><th>Dia de Culto</th><th>Departamento</th></tr></thead>' +
        '<tbody>' + linhas + '</tbody></table>';
    } catch (e) {
      minhasErro.textContent = 'Falha de conexão. Tente de novo.';
    }
  }

  /** Nome do culto a partir do dia da semana da data (dd/MM/yyyy). */
  function cultoDoDia(dataBR) {
    const m = String(dataBR || '').match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (!m) return '—';
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    switch (d.getDay()) {
      case 3: return 'Culto de Ensino';     // quarta
      case 5: return 'Encontro de Jovens';  // sexta
      case 0: return 'Culto Família';       // domingo
      default: {                            // encontro esporádico
        const dia = d.toLocaleDateString('pt-BR', { weekday: 'long' });
        return dia.charAt(0).toUpperCase() + dia.slice(1);
      }
    }
  }

  /* ----- Utilidades ----- */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ----- Modo demonstração (sem backend) ----- */
  async function demo(p) {
    await new Promise(function (r) { setTimeout(r, 300); });
    switch (p.action) {
      case 'registrarPresenca': {
        const v = DEMO_VOL[p.codigo];
        if (!v) return { ok: false, erro: 'Código não encontrado (demo).' };
        const now = new Date();
        return { ok: true, nome: v.nome, departamento: v.departamento,
                 data: now.toLocaleDateString('pt-BR'),
                 hora: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                 escalado: p.codigo === '1001' };
      }
      case 'listarDepartamentos':
        return { ok: true, departamentos: ['Infantil', 'Louvor', 'Recepção'] };
      case 'listarVoluntarios':
        return { ok: true, voluntarios: [
          { codigo: '1001', nome: 'Maria Oliveira' },
          { codigo: '1002', nome: 'João Pereira' }
        ] };
      case 'listarEscala':  return { ok: true, codigos: ['1001'], horario: '09:00' };
      case 'salvarEscala':  return { ok: true, data: '21/06/2026', total: (p.codigos || []).length };
      case 'minhasEscalas':
        return { ok: true, nome: 'Maria Oliveira', departamento: 'Louvor', escalas: [
          { data: '21/06/2026', horario: '09:00', departamento: 'Louvor' },
          { data: '24/06/2026', horario: '19:30', departamento: 'Louvor' }
        ] };
      default: return { ok: false, erro: 'Ação demo desconhecida.' };
    }
  }
})();
