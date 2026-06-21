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
    document.querySelector('.card').classList.toggle('card--wide', id === 'tela-dashboard');
    const foco = alvo && alvo.querySelector('input, select');
    if (foco && id !== 'tela-inicio') setTimeout(function () { foco.focus(); }, 50);
  }
  document.querySelectorAll('[data-ir]').forEach(function (el) {
    el.addEventListener('click', function () {
      const destino = el.getAttribute('data-ir');
      irPara(destino);
      if (destino === 'tela-cultos') abrirCultos();
      if (destino === 'tela-dashboard') abrirDashboard();
    });
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

    btn.disabled = true;
    try {
      let coords = null;
      if (!MODO_DEMO) {
        btn.textContent = 'Localizando...';
        coords = await obterLocalizacao();   // null se o usuário negar/falhar
      }
      btn.textContent = 'Registrando...';
      const r = await api({
        action: 'registrarPresenca', codigo: codigo,
        lat: coords ? coords.lat : '', lng: coords ? coords.lng : ''
      });
      if (!r.ok) { erro.textContent = r.erro || 'Não foi possível registrar.'; return; }
      mostrarConfirmacao(r);
    } catch (e) {
      erro.textContent = 'Falha de conexão. Verifique a internet e tente de novo.';
    } finally {
      btn.disabled = false; btn.textContent = 'Confirmar';
    }
  }

  /** Pede a localização do navegador. Resolve {lat,lng} ou null (o servidor decide). */
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

  async function entrarLider() {
    const pin = campoPin.value.trim();
    pinErro.textContent = '';
    if (!pin) { pinErro.textContent = 'Digite o PIN.'; return; }

    const btnP = document.getElementById('btn-pin');
    btnP.disabled = true; btnP.textContent = 'Entrando...';
    try {
      const r = await api({ action: 'verificarPin', pin: pin });
      if (!r.ok) { pinErro.textContent = r.erro || 'PIN incorreto.'; return; }
      pinLider = pin;          // guardado só após validação no servidor
      campoPin.value = '';
      irPara('tela-menu');
      carregarDepartamentos();
    } catch (e) {
      pinErro.textContent = 'Falha de conexão. Tente de novo.';
    } finally {
      btnP.disabled = false; btnP.textContent = 'Entrar';
    }
  }

  /* ============================================================= */
  /* MONTAR ESCALA                                                 */
  /* ============================================================= */
  const selDep   = document.getElementById('esc-departamento');
  const inpData  = document.getElementById('esc-data');
  const inpHora  = document.getElementById('esc-horario');
  const divLista = document.getElementById('esc-lista');
  const escMsg   = document.getElementById('esc-msg');
  const escExistentes = document.getElementById('esc-existentes');
  let depsCarregados = false;

  async function carregarDepartamentos() {
    if (depsCarregados) return;
    try {
      const r = await api({ action: 'listarDepartamentos', pin: pinLider });
      if (r.ok) {
        selDep.innerHTML = '<option value="">Selecione...</option>' +
          r.departamentos.map(function (d) { return '<option>' + escapeHtml(d) + '</option>'; }).join('');
        depsCarregados = true;
      }
    } catch (e) { /* silencioso */ }
  }

  selDep.addEventListener('change', function () {
    inpData.value = ''; inpHora.value = '';
    carregarVoluntarios();
    carregarEscalasDepartamento();
  });
  inpData.addEventListener('change', preCheck);
  inpHora.addEventListener('change', preCheck);

  // Renderiza os voluntários do departamento (todos desmarcados).
  async function carregarVoluntarios() {
    const dep = selDep.value;
    escMsg.textContent = '';
    if (!dep) { divLista.innerHTML = '<p class="lista-vazia">Selecione um departamento.</p>'; return; }
    divLista.innerHTML = '<p class="lista-vazia">Carregando...</p>';
    try {
      const r = await api({ action: 'listarVoluntarios', departamento: dep, pin: pinLider });
      if (!r.ok || !r.voluntarios.length) {
        divLista.innerHTML = '<p class="lista-vazia">Nenhum voluntário neste departamento.</p>';
        return;
      }
      divLista.innerHTML = r.voluntarios.map(function (v) {
        return '<label class="voluntario-item">' +
                 '<input type="checkbox" value="' + escapeHtml(v.codigo) + '">' +
                 '<span>' + escapeHtml(v.nome) + '</span>' +
               '</label>';
      }).join('');
      preCheck();
    } catch (e) {
      divLista.innerHTML = '<p class="lista-vazia">Erro ao carregar. Tente de novo.</p>';
    }
  }

  // Marca os voluntários já escalados para a data+horário selecionados.
  async function preCheck() {
    const dep = selDep.value;
    const boxes = divLista.querySelectorAll('input[type=checkbox]');
    if (!dep || !inpData.value || !boxes.length) return;
    try {
      const r = await api({ action: 'listarEscala', pin: pinLider,
        data: inpData.value, horario: inpHora.value, departamento: dep });
      if (!r.ok) return;
      const marcados = {};
      (r.codigos || []).forEach(function (c) { marcados[c] = true; });
      boxes.forEach(function (b) { b.checked = !!marcados[b.value]; });
    } catch (e) { /* silencioso */ }
  }

  // Lista as escalas já criadas do departamento, com Editar/Excluir.
  async function carregarEscalasDepartamento() {
    const dep = selDep.value;
    escExistentes.innerHTML = '';
    if (!dep) return;
    try {
      const r = await api({ action: 'listarEscalasDepartamento', pin: pinLider, departamento: dep });
      if (!r.ok || !r.escalas.length) return;
      escExistentes.innerHTML = '<p class="campo-label">Escalas já criadas</p>' +
        r.escalas.map(function (e) {
          const rotulo = e.data + (e.horario ? ' · ' + e.horario : '') + ' · ' + e.total + ' voluntário(s)';
          const chave = e.data + '|' + e.horario;
          return '<div class="esc-item"><span>' + escapeHtml(rotulo) + '</span>' +
                   '<span class="esc-acoes">' +
                     '<button type="button" class="link-acao" data-edit="' + escapeHtml(chave) + '">Editar</button>' +
                     '<button type="button" class="link-acao link-excluir" data-del="' + escapeHtml(chave) + '">Excluir</button>' +
                   '</span></div>';
        }).join('');
      escExistentes.querySelectorAll('[data-edit]').forEach(function (b) {
        b.addEventListener('click', function () { const p = b.getAttribute('data-edit').split('|'); editarEscala(p[0], p[1]); });
      });
      escExistentes.querySelectorAll('[data-del]').forEach(function (b) {
        b.addEventListener('click', function () { const p = b.getAttribute('data-del').split('|'); removerEscala(p[0], p[1]); });
      });
    } catch (e) { /* silencioso */ }
  }

  function editarEscala(dataBR, horario) {
    inpData.value = brParaIso(dataBR);
    inpHora.value = horario || '';
    escMsg.textContent = ''; escMsg.style.color = '';
    preCheck();
    inpData.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function removerEscala(dataBR, horario) {
    if (!confirm('Excluir a escala de ' + dataBR + (horario ? ' (' + horario + ')' : '') + '?')) return;
    try {
      const r = await api({ action: 'excluirEscala', pin: pinLider,
        data: dataBR, horario: horario, departamento: selDep.value });
      if (!r.ok) { escMsg.textContent = r.erro || 'Não foi possível excluir.'; return; }
      escMsg.style.color = '#27ae60';
      escMsg.textContent = '✓ Escala de ' + dataBR + ' excluída.';
      setTimeout(function () { escMsg.style.color = ''; }, 4000);
      carregarEscalasDepartamento();
      preCheck();
    } catch (e) {
      escMsg.textContent = 'Falha de conexão. Tente de novo.';
    }
  }

  document.getElementById('btn-salvar-escala').addEventListener('click', salvarEscala);

  async function salvarEscala() {
    escMsg.textContent = ''; escMsg.style.color = '';
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
      carregarEscalasDepartamento();
    } catch (e) {
      escMsg.textContent = 'Falha de conexão. Tente de novo.';
    } finally {
      btnS.disabled = false; btnS.textContent = 'Salvar escala';
    }
  }

  /** 'dd/MM/yyyy' -> 'yyyy-MM-dd' (para preencher input date). */
  function brParaIso(dataBR) {
    const m = String(dataBR || '').match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    return m ? (m[3] + '-' + m[2] + '-' + m[1]) : '';
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

  /* ============================================================= */
  /* CULTOS DO MÊS (líder)                                         */
  /* ============================================================= */
  const culMes  = document.getElementById('cul-mes');
  const culData = document.getElementById('cul-data');
  const culHora = document.getElementById('cul-hora');
  const culDesc = document.getElementById('cul-desc');
  const culMsg  = document.getElementById('cul-msg');
  const culLista = document.getElementById('cul-lista');

  document.getElementById('btn-gerar-cultos').addEventListener('click', gerarCultos);
  document.getElementById('btn-add-culto').addEventListener('click', adicionarCulto);

  function abrirCultos() {
    if (!culMes.value) {
      const h = new Date();
      culMes.value = h.getFullYear() + '-' + ('0' + (h.getMonth() + 1)).slice(-2);
    }
    carregarCultos();
  }

  async function carregarCultos() {
    culLista.innerHTML = '<p class="lista-vazia">Carregando...</p>';
    try {
      const r = await api({ action: 'listarCultos', pin: pinLider });
      if (!r.ok) { culLista.innerHTML = '<p class="lista-vazia">' + escapeHtml(r.erro || 'Erro.') + '</p>'; return; }
      if (!r.cultos.length) { culLista.innerHTML = '<p class="lista-vazia">Nenhum culto cadastrado ainda.</p>'; return; }
      const linhas = r.cultos.map(function (c) {
        return '<tr><td class="td-data">' + escapeHtml(c.data) + '</td>' +
               '<td>' + escapeHtml(c.horario || '–') + '</td>' +
               '<td>' + escapeHtml(c.descricao || '–') + '</td></tr>';
      }).join('');
      culLista.innerHTML =
        '<table class="tabela"><thead><tr><th>Data</th><th>Horário</th><th>Descrição</th></tr></thead>' +
        '<tbody>' + linhas + '</tbody></table>';
    } catch (e) {
      culLista.innerHTML = '<p class="lista-vazia">Falha de conexão.</p>';
    }
  }

  async function gerarCultos() {
    culMsg.textContent = ''; culMsg.style.color = '';
    if (!culMes.value) { culMsg.textContent = 'Escolha o mês.'; return; }
    const partes = culMes.value.split('-');
    const btn = document.getElementById('btn-gerar-cultos');
    btn.disabled = true; btn.textContent = '...';
    try {
      const r = await api({ action: 'gerarCultosMes', pin: pinLider, ano: partes[0], mes: partes[1] });
      if (!r.ok) { culMsg.textContent = r.erro || 'Não foi possível gerar.'; return; }
      culMsg.style.color = '#27ae60';
      culMsg.textContent = '✓ ' + r.criados + ' culto(s) gerado(s).';
      carregarCultos();
    } catch (e) {
      culMsg.textContent = 'Falha de conexão. Tente de novo.';
    } finally {
      btn.disabled = false; btn.textContent = 'Gerar';
    }
  }

  async function adicionarCulto() {
    culMsg.textContent = ''; culMsg.style.color = '';
    if (!culData.value) { culMsg.textContent = 'Escolha a data do culto.'; return; }
    const btn = document.getElementById('btn-add-culto');
    btn.disabled = true; btn.textContent = 'Adicionando...';
    try {
      const r = await api({
        action: 'adicionarCulto', pin: pinLider,
        data: culData.value, horario: culHora.value, descricao: culDesc.value
      });
      if (!r.ok) { culMsg.textContent = r.erro || 'Não foi possível adicionar.'; return; }
      culMsg.style.color = '#27ae60';
      culMsg.textContent = '✓ Culto de ' + r.data + ' adicionado.';
      culData.value = ''; culHora.value = ''; culDesc.value = '';
      carregarCultos();
    } catch (e) {
      culMsg.textContent = 'Falha de conexão. Tente de novo.';
    } finally {
      btn.disabled = false; btn.textContent = 'Adicionar culto';
    }
  }

  /* ============================================================= */
  /* DASHBOARD                                                     */
  /* ============================================================= */
  const dashMes      = document.getElementById('dash-mes');
  const dashMsg      = document.getElementById('dash-msg');
  const dashConteudo = document.getElementById('dash-conteudo');
  document.getElementById('btn-dash').addEventListener('click', carregarDashboard);

  function abrirDashboard() {
    if (!dashMes.value) {
      const h = new Date();
      dashMes.value = h.getFullYear() + '-' + ('0' + (h.getMonth() + 1)).slice(-2);
    }
    carregarDashboard();
  }

  async function carregarDashboard() {
    dashMsg.textContent = ''; dashMsg.style.color = '';
    if (!dashMes.value) { dashMsg.textContent = 'Escolha o mês.'; return; }
    const partes = dashMes.value.split('-');
    const btn = document.getElementById('btn-dash');
    btn.disabled = true; btn.textContent = '...';
    try {
      const r = await api({ action: 'dashboard', pin: pinLider, ano: partes[0], mes: partes[1] });
      if (!r.ok) { dashConteudo.hidden = true; dashMsg.textContent = r.erro || 'Erro.'; return; }
      if (r.nCultos === 0) {
        dashConteudo.hidden = true;
        dashMsg.textContent = 'Nenhum culto cadastrado nesse mês. Gere os cultos primeiro.';
        return;
      }
      renderDashboard(r);
      dashConteudo.hidden = false;
    } catch (e) {
      dashMsg.textContent = 'Falha de conexão. Tente de novo.';
    } finally {
      btn.disabled = false; btn.textContent = 'Atualizar';
    }
  }

  function renderDashboard(r) {
    document.getElementById('kpi-presenca').textContent  = r.taxaPresenca + '%';
    document.getElementById('kpi-falta').textContent     = r.taxaFalta + '%';
    document.getElementById('kpi-presentes').textContent = r.presentes;
    document.getElementById('kpi-faltas').textContent    = r.faltas;
    document.getElementById('dash-resumo').textContent   =
      r.nVol + ' voluntário(s) · ' + r.nCultos + ' culto(s) no mês';

    document.getElementById('dash-cultos').innerHTML = r.porCulto.length
      ? tabelaCultos(r.porCulto) : '<p class="lista-vazia">Sem cultos.</p>';
    document.getElementById('dash-menor').innerHTML = tabelaFreq(r.menor);
    document.getElementById('dash-maior').innerHTML = tabelaFreq(r.maior);
  }

  function tabelaCultos(arr) {
    const linhas = arr.map(function (c) {
      return '<tr><td class="td-data">' + escapeHtml(c.data) + '</td>' +
             '<td>' + escapeHtml(c.descricao || '–') + '</td>' +
             '<td>' + barra(c.pct) + '</td></tr>';
    }).join('');
    return '<table class="tabela"><thead><tr><th>Data</th><th>Culto</th><th>Participação</th></tr></thead>' +
           '<tbody>' + linhas + '</tbody></table>';
  }

  function tabelaFreq(arr) {
    if (!arr || !arr.length) return '<p class="lista-vazia">Sem dados.</p>';
    const linhas = arr.map(function (v) {
      return '<tr><td>' + escapeHtml(v.nome) + '</td>' +
             '<td class="num">' + v.presencas + '</td>' +
             '<td>' + barra(v.pct) + '</td></tr>';
    }).join('');
    return '<table class="tabela"><thead><tr><th>Voluntário</th><th>Pres.</th><th>%</th></tr></thead>' +
           '<tbody>' + linhas + '</tbody></table>';
  }

  function barra(pct) {
    const w = Math.max(0, Math.min(100, Number(pct) || 0));
    return '<div class="barra"><div class="barra-fill" style="width:' + w + '%"></div></div>' +
           '<span class="barra-pct">' + pct + '%</span>';
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
      case 'verificarPin':
        return p.pin === '2024' ? { ok: true } : { ok: false, erro: 'PIN incorreto.' };
      case 'listarDepartamentos':
        return { ok: true, departamentos: ['Infantil', 'Louvor', 'Recepção'] };
      case 'listarVoluntarios':
        return { ok: true, voluntarios: [
          { codigo: '1001', nome: 'Maria Oliveira' },
          { codigo: '1002', nome: 'João Pereira' }
        ] };
      case 'listarEscala':  return { ok: true, codigos: ['1001'] };
      case 'listarEscalasDepartamento':
        return { ok: true, escalas: [
          { data: '21/06/2026', horario: '09:00', total: 2 },
          { data: '24/06/2026', horario: '19:30', total: 1 }
        ] };
      case 'excluirEscala': return { ok: true, removidos: 1 };
      case 'salvarEscala':  return { ok: true, data: '21/06/2026', total: (p.codigos || []).length };
      case 'minhasEscalas':
        return { ok: true, nome: 'Maria Oliveira', departamento: 'Louvor', escalas: [
          { data: '21/06/2026', horario: '09:00', departamento: 'Louvor' },
          { data: '24/06/2026', horario: '19:30', departamento: 'Louvor' }
        ] };
      case 'listarCultos':
        return { ok: true, cultos: [
          { data: '24/06/2026', horario: '19:30', descricao: 'Culto de Ensino' },
          { data: '26/06/2026', horario: '20:00', descricao: 'Encontro de Jovens' },
          { data: '28/06/2026', horario: '09:00', descricao: 'Culto Família' }
        ] };
      case 'gerarCultosMes':  return { ok: true, criados: 13 };
      case 'adicionarCulto':  return { ok: true, data: '30/06/2026' };
      case 'dashboard':
        return { ok: true, nVol: 7, nCultos: 4, presentes: 18, faltas: 10,
          taxaPresenca: 64.3, taxaFalta: 35.7,
          porCulto: [
            { data: '03/06/2026', descricao: 'Culto de Ensino',    presentes: 5, pct: 71.4 },
            { data: '05/06/2026', descricao: 'Encontro de Jovens', presentes: 4, pct: 57.1 },
            { data: '07/06/2026', descricao: 'Culto Família',      presentes: 6, pct: 85.7 },
            { data: '10/06/2026', descricao: 'Culto de Ensino',    presentes: 3, pct: 42.9 }
          ],
          menor: [{ nome: 'Ryan', presencas: 1, pct: 25 }, { nome: 'Yan', presencas: 1, pct: 25 }, { nome: 'Davi', presencas: 2, pct: 50 }],
          maior: [{ nome: 'Elton', presencas: 4, pct: 100 }, { nome: 'Lucas', presencas: 3, pct: 75 }, { nome: 'Maria', presencas: 3, pct: 75 }]
        };
      default: return { ok: false, erro: 'Ação demo desconhecida.' };
    }
  }
})();
