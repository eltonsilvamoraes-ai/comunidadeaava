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
      if (destino === 'tela-voluntarios') abrirVoluntarios();
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

    const rec = document.getElementById('ok-reconhecimento');
    if (r.reconhecimento && r.reconhecimento.mensagem) {
      rec.textContent = r.reconhecimento.mensagem;
      rec.className = 'ok__reconhecimento' + (r.reconhecimento.marco ? ' marco' : '');
    } else {
      rec.textContent = '';
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
  const cultoLista   = document.getElementById('culto-lista');
  const cultoDetalhe = document.getElementById('culto-detalhe');
  const relDep       = document.getElementById('rel-departamento');
  const relConteudo  = document.getElementById('rel-conteudo');
  let abaAtiva = 'geral';
  let relDepsLoaded = false;
  let dadosGeral = null, dadosCulto = null, dadosDepto = null, dadosAlertas = null;

  document.getElementById('btn-dash').addEventListener('click', carregarAba);
  document.getElementById('btn-pdf').addEventListener('click', exportarPDF);
  relDep.addEventListener('change', carregarDepto);
  document.querySelectorAll('.aba').forEach(function (a) {
    a.addEventListener('click', function () { mostrarAba(a.getAttribute('data-aba')); });
  });

  function abrirDashboard() {
    if (!dashMes.value) {
      const h = new Date();
      dashMes.value = h.getFullYear() + '-' + ('0' + (h.getMonth() + 1)).slice(-2);
    }
    carregarDepartamentosRel();
    mostrarAba(abaAtiva);
  }

  function mostrarAba(nome) {
    abaAtiva = nome;
    document.querySelectorAll('.aba').forEach(function (a) {
      a.classList.toggle('is-on', a.getAttribute('data-aba') === nome);
    });
    document.getElementById('painel-geral').hidden = nome !== 'geral';
    document.getElementById('painel-culto').hidden = nome !== 'culto';
    document.getElementById('painel-depto').hidden = nome !== 'depto';
    document.getElementById('painel-alertas').hidden = nome !== 'alertas';
    carregarAba();
  }

  function carregarAba() {
    if (abaAtiva === 'geral') carregarDashboard();
    else if (abaAtiva === 'culto') carregarPorCulto();
    else if (abaAtiva === 'depto') carregarDepto();
    else if (abaAtiva === 'alertas') carregarAlertas();
  }

  async function carregarDepartamentosRel() {
    if (relDepsLoaded) return;
    try {
      const r = await api({ action: 'listarDepartamentos', pin: pinLider });
      if (r.ok) {
        relDep.innerHTML = '<option value="">Selecione...</option>' +
          r.departamentos.map(function (d) { return '<option>' + escapeHtml(d) + '</option>'; }).join('');
        relDepsLoaded = true;
      }
    } catch (e) { /* silencioso */ }
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
      dadosGeral = r;
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

  /* ----- Aba: Por Culto ----- */
  async function carregarPorCulto() {
    dashMsg.textContent = '';
    if (!dashMes.value) { dashMsg.textContent = 'Escolha o mês.'; return; }
    const p = dashMes.value.split('-');
    cultoLista.innerHTML = '<p class="lista-vazia">Carregando...</p>'; cultoDetalhe.innerHTML = '';
    try {
      const r = await api({ action: 'presencasPorCulto', pin: pinLider, ano: p[0], mes: p[1] });
      if (!r.ok) { cultoLista.innerHTML = '<p class="lista-vazia">' + escapeHtml(r.erro || 'Erro.') + '</p>'; return; }
      dadosCulto = r;
      if (!r.cultos.length) { cultoLista.innerHTML = '<p class="lista-vazia">Nenhum culto cadastrado nesse mês.</p>'; return; }
      cultoLista.innerHTML =
        '<table class="tabela"><thead><tr><th>Data</th><th>Culto</th><th>Pres.</th><th>Faltas</th><th></th></tr></thead><tbody>' +
        r.cultos.map(function (c) {
          return '<tr><td class="td-data">' + escapeHtml(c.data) + '</td>' +
                 '<td>' + escapeHtml(c.descricao || '–') + '</td>' +
                 '<td class="num" style="color:var(--ok)">' + c.presentes + '</td>' +
                 '<td class="num" style="color:var(--erro)">' + c.faltas + '</td>' +
                 '<td><button type="button" class="link-acao" data-ver="' + escapeHtml(c.data) + '">Ver</button></td></tr>';
        }).join('') + '</tbody></table>';
      cultoLista.querySelectorAll('[data-ver]').forEach(function (b) {
        b.addEventListener('click', function () { verDetalheCulto(b.getAttribute('data-ver')); });
      });
    } catch (e) {
      cultoLista.innerHTML = '<p class="lista-vazia">Falha de conexão.</p>';
    }
  }

  async function verDetalheCulto(data) {
    cultoDetalhe.innerHTML = '<p class="lista-vazia">Carregando...</p>';
    try {
      const r = await api({ action: 'detalheCulto', pin: pinLider, data: data });
      if (!r.ok) { cultoDetalhe.innerHTML = '<p class="lista-vazia">' + escapeHtml(r.erro || 'Erro.') + '</p>'; return; }
      cultoDetalhe.innerHTML =
        '<p class="campo-label">Culto de ' + escapeHtml(data) + '</p>' +
        '<div class="dash-cols">' +
          '<div class="dash-col"><p class="sub-ok">✓ Compareceram (' + r.presentes.length + ')</p>' + listaNomes(r.presentes) + '</div>' +
          '<div class="dash-col"><p class="sub-falta">✗ Faltaram (' + r.ausentes.length + ')</p>' + listaNomes(r.ausentes) + '</div>' +
        '</div>';
      cultoDetalhe.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      cultoDetalhe.innerHTML = '<p class="lista-vazia">Falha de conexão.</p>';
    }
  }

  function listaNomes(arr) {
    if (!arr.length) return '<p class="lista-vazia">—</p>';
    return '<ul class="nomes">' + arr.map(function (v) {
      return '<li>' + escapeHtml(v.nome) +
             (v.departamento ? ' <span class="dep">' + escapeHtml(v.departamento) + '</span>' : '') + '</li>';
    }).join('') + '</ul>';
  }

  /* ----- Aba: Por Departamento ----- */
  async function carregarDepto() {
    dashMsg.textContent = '';
    const dep = relDep.value;
    if (!dep) { relConteudo.innerHTML = '<p class="lista-vazia">Selecione um departamento.</p>'; return; }
    if (!dashMes.value) { dashMsg.textContent = 'Escolha o mês.'; return; }
    const p = dashMes.value.split('-');
    relConteudo.innerHTML = '<p class="lista-vazia">Carregando...</p>';
    try {
      const r = await api({ action: 'relatorioDepartamento', pin: pinLider, ano: p[0], mes: p[1], departamento: dep });
      if (!r.ok) { relConteudo.innerHTML = '<p class="lista-vazia">' + escapeHtml(r.erro || 'Erro.') + '</p>'; return; }
      dadosDepto = r;
      renderDepto(r);
    } catch (e) {
      relConteudo.innerHTML = '<p class="lista-vazia">Falha de conexão.</p>';
    }
  }

  function renderDepto(r) {
    if (!r.nCultos) { relConteudo.innerHTML = '<p class="lista-vazia">Nenhum culto cadastrado nesse mês.</p>'; return; }
    let html = '';
    if (r.alertas.length) {
      html += '<div class="aviso-alerta">⚠️ Atenção: <strong>' + r.alertas.map(escapeHtml).join(', ') +
              '</strong> com alto índice de falta.</div>';
    }
    html += '<div class="dash-cols">' +
      '<div class="dash-col"><p class="campo-label">Maior frequência</p>' + miniRank(r.maior) + '</div>' +
      '<div class="dash-col"><p class="campo-label">Menor frequência</p>' + miniRank(r.menor) + '</div>' +
    '</div>';
    html += '<p class="campo-label">Todos os voluntários · ' + r.nCultos + ' culto(s)</p>';
    html += '<table class="tabela"><thead><tr><th>Voluntário</th><th>Pres.</th><th>Faltas</th><th>%</th></tr></thead><tbody>' +
      r.voluntarios.map(function (v) {
        return '<tr' + (v.alerta ? ' class="linha-alerta"' : '') + '><td>' + escapeHtml(v.nome) + '</td>' +
               '<td class="num">' + v.presencas + '</td>' +
               '<td class="num">' + v.faltas + '</td>' +
               '<td class="num"><span class="' + corPct(v.pct) + '">' + v.pct + '%</span></td></tr>';
      }).join('') + '</tbody></table>';
    relConteudo.innerHTML = html;
  }

  function miniRank(arr) {
    if (!arr || !arr.length) return '<p class="lista-vazia">—</p>';
    return '<ol class="rank">' + arr.map(function (v) {
      return '<li>' + escapeHtml(v.nome) + ' <span class="' + corPct(v.pct) + '">' + v.pct + '%</span></li>';
    }).join('') + '</ol>';
  }

  function corPct(pct) { return pct >= 75 ? 'pct-bom' : (pct >= 50 ? 'pct-medio' : 'pct-ruim'); }

  /* ----- Exportar relatório em PDF (aba ativa) ----- */
  function exportarPDF() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      dashMsg.style.color = ''; dashMsg.textContent = 'Gerador de PDF não carregou. Verifique a internet e tente de novo.';
      return;
    }
    const dados = { geral: dadosGeral, culto: dadosCulto, depto: dadosDepto, alertas: dadosAlertas }[abaAtiva];
    if (!dados) { dashMsg.style.color = ''; dashMsg.textContent = 'Toque em "Atualizar" para carregar o relatório antes de baixar.'; return; }

    const doc = new window.jspdf.jsPDF('p', 'pt', 'a4');
    const margin = 40;
    const larg = doc.internal.pageSize.getWidth() - margin * 2;
    const AZUL = [45, 156, 219];
    let y = margin;
    const titulos = { geral: 'Visão Geral', culto: 'Por Culto', depto: 'Por Departamento', alertas: 'Alertas de Afastamento' };
    const mes = dashMes.value ? dashMes.value.split('-').reverse().join('/') : '';

    function quebra(min) { if (y > doc.internal.pageSize.getHeight() - (min || 60)) { doc.addPage(); y = margin; } }
    function titulo(t) { quebra(); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(70); doc.text(t, margin, y); y += 14; doc.setTextColor(0); doc.setFont('helvetica', 'normal'); }
    function texto(t, cor) { quebra(); doc.setFontSize(10); if (cor) doc.setTextColor(cor[0], cor[1], cor[2]); const ls = doc.splitTextToSize(t, larg); doc.text(ls, margin, y); y += ls.length * 13 + 4; doc.setTextColor(0); }
    function tabela(head, body) {
      quebra(80);
      doc.autoTable({ head: [head], body: body, startY: y, margin: { left: margin, right: margin },
        styles: { fontSize: 9, cellPadding: 4 }, headStyles: { fillColor: AZUL }, theme: 'grid' });
      y = doc.lastAutoTable.finalY + 14;
    }

    // Cabeçalho
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
    doc.text((cfg.NOME_IGREJA || 'AAVA') + ' — Relatório de Frequência', margin, y); y += 20;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
    doc.text(titulos[abaAtiva] + (mes ? '   ·   ' + mes : ''), margin, y); y += 14;
    doc.setFontSize(9); doc.setTextColor(120);
    doc.text('Gerado em ' + new Date().toLocaleString('pt-BR'), margin, y); y += 18; doc.setTextColor(0);

    if (abaAtiva === 'geral') {
      texto('Taxa de presença: ' + dados.taxaPresenca + '%   |   Taxa de falta: ' + dados.taxaFalta +
            '%   |   Presenças: ' + dados.presentes + '   |   Faltas: ' + dados.faltas);
      texto(dados.nVol + ' voluntário(s) · ' + dados.nCultos + ' culto(s) no mês');
      titulo('Participação por culto');
      tabela(['Data', 'Culto', 'Presentes', '%'], dados.porCulto.map(function (c) { return [c.data, c.descricao || '-', c.presentes, c.pct + '%']; }));
      titulo('Menor frequência');
      tabela(['Voluntário', 'Pres.', '%'], dados.menor.map(function (v) { return [v.nome, v.presencas, v.pct + '%']; }));
      titulo('Maior frequência');
      tabela(['Voluntário', 'Pres.', '%'], dados.maior.map(function (v) { return [v.nome, v.presencas, v.pct + '%']; }));
    } else if (abaAtiva === 'culto') {
      tabela(['Data', 'Culto', 'Presentes', 'Faltas', '%'],
        dados.cultos.map(function (c) { return [c.data, c.descricao || '-', c.presentes, c.faltas, c.pct + '%']; }));
    } else if (abaAtiva === 'depto') {
      if (dados.alertas && dados.alertas.length) texto('Atenção (alto índice de falta): ' + dados.alertas.join(', '), [179, 38, 30]);
      titulo('Maior frequência'); tabela(['Voluntário', '%'], (dados.maior || []).map(function (v) { return [v.nome, v.pct + '%']; }));
      titulo('Menor frequência'); tabela(['Voluntário', '%'], (dados.menor || []).map(function (v) { return [v.nome, v.pct + '%']; }));
      titulo('Todos os voluntários · ' + dados.nCultos + ' culto(s)');
      tabela(['Voluntário', 'Pres.', 'Faltas', '%'], dados.voluntarios.map(function (v) { return [v.nome, v.presencas, v.faltas, v.pct + '%']; }));
    } else if (abaAtiva === 'alertas') {
      tabela(['Voluntário', 'Departamento', 'Faltas seguidas', 'Última presença'],
        (dados.alertas || []).map(function (a) { return [a.nome, a.departamento || '-', a.faltas, a.ultima || '-']; }));
    }

    doc.save('relatorio-' + abaAtiva + (mes ? '-' + mes.replace(/\//g, '-') : '') + '.pdf');
    dashMsg.style.color = '#27ae60'; dashMsg.textContent = '✓ PDF gerado.';
    setTimeout(function () { dashMsg.style.color = ''; dashMsg.textContent = ''; }, 4000);
  }

  /* ----- Aba: Alertas (afastamento) ----- */
  async function carregarAlertas() {
    const div = document.getElementById('alertas-conteudo');
    div.innerHTML = '<p class="lista-vazia">Carregando...</p>';
    try {
      const r = await api({ action: 'alertasAfastamento', pin: pinLider });
      if (!r.ok) { div.innerHTML = '<p class="lista-vazia">' + escapeHtml(r.erro || 'Erro.') + '</p>'; return; }
      dadosAlertas = r;
      if (!r.alertas.length) { div.innerHTML = '<p class="lista-vazia">Ninguém com faltas seguidas. 🎉</p>'; return; }
      div.innerHTML = '<table class="tabela"><thead><tr><th>Voluntário</th><th>Faltas seguidas</th><th>Última presença</th></tr></thead><tbody>' +
        r.alertas.map(function (a) {
          return '<tr class="linha-alerta"><td>' + escapeHtml(a.nome) +
                 '<span class="td-dia">' + escapeHtml(a.departamento || '') + '</span></td>' +
                 '<td class="num"><span class="pct-ruim">' + a.faltas + '</span></td>' +
                 '<td>' + escapeHtml(a.ultima || '—') + '</td></tr>';
        }).join('') + '</tbody></table>';
    } catch (e) {
      div.innerHTML = '<p class="lista-vazia">Falha de conexão.</p>';
    }
  }

  /* ============================================================= */
  /* CADASTRO DE VOLUNTÁRIOS (líder)                               */
  /* ============================================================= */
  const volNome   = document.getElementById('vol-nome');
  const volDepto  = document.getElementById('vol-depto');
  const volStatus = document.getElementById('vol-status');
  const volCodigo = document.getElementById('vol-codigo');
  const volMsg    = document.getElementById('vol-msg');
  const volLista  = document.getElementById('vol-lista');
  const volCancelar = document.getElementById('vol-cancelar');
  const btnSalvarVol = document.getElementById('btn-salvar-vol');

  btnSalvarVol.addEventListener('click', salvarVoluntarioCad);
  volCancelar.addEventListener('click', limparFormVol);

  function abrirVoluntarios() { carregarVoluntariosCadastro(); }

  async function carregarVoluntariosCadastro() {
    volLista.innerHTML = '<p class="lista-vazia">Carregando...</p>';
    try {
      const r = await api({ action: 'listarTodosVoluntarios', pin: pinLider });
      if (!r.ok) { volLista.innerHTML = '<p class="lista-vazia">' + escapeHtml(r.erro || 'Erro.') + '</p>'; return; }
      const deps = {};
      r.voluntarios.forEach(function (v) { if (v.departamento) deps[v.departamento] = true; });
      document.getElementById('lista-deptos').innerHTML =
        Object.keys(deps).sort().map(function (d) { return '<option value="' + escapeHtml(d) + '">'; }).join('');
      if (!r.voluntarios.length) { volLista.innerHTML = '<p class="lista-vazia">Nenhum voluntário ainda.</p>'; return; }
      volLista.innerHTML = '<table class="tabela"><thead><tr><th>Código</th><th>Nome</th><th>Depto</th><th></th></tr></thead><tbody>' +
        r.voluntarios.map(function (v) {
          const dados = encodeURIComponent(JSON.stringify(v));
          const inativo = (v.status || '').toLowerCase() === 'inativo';
          return '<tr' + (inativo ? ' style="opacity:.5"' : '') + '><td class="td-data">' + escapeHtml(v.codigo) + '</td>' +
                 '<td>' + escapeHtml(v.nome) + '</td><td>' + escapeHtml(v.departamento || '–') + '</td>' +
                 '<td><button type="button" class="link-acao" data-vol="' + dados + '">Editar</button></td></tr>';
        }).join('') + '</tbody></table>';
      volLista.querySelectorAll('[data-vol]').forEach(function (b) {
        b.addEventListener('click', function () { editarVol(JSON.parse(decodeURIComponent(b.getAttribute('data-vol')))); });
      });
    } catch (e) {
      volLista.innerHTML = '<p class="lista-vazia">Falha de conexão.</p>';
    }
  }

  function editarVol(v) {
    volCodigo.value = v.codigo;
    volNome.value = v.nome;
    volDepto.value = v.departamento || '';
    volStatus.value = v.status || 'Ativo';
    btnSalvarVol.textContent = 'Salvar alterações';
    volCancelar.hidden = false;
    volMsg.textContent = '';
    volNome.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function limparFormVol() {
    volCodigo.value = ''; volNome.value = ''; volDepto.value = ''; volStatus.value = 'Ativo';
    btnSalvarVol.textContent = 'Adicionar voluntário';
    volCancelar.hidden = true; volMsg.textContent = ''; volMsg.style.color = '';
  }

  async function salvarVoluntarioCad() {
    volMsg.textContent = ''; volMsg.style.color = '';
    if (!volNome.value.trim()) { volMsg.textContent = 'Informe o nome.'; return; }
    btnSalvarVol.disabled = true;
    try {
      const r = await api({ action: 'salvarVoluntario', pin: pinLider,
        codigo: volCodigo.value, nome: volNome.value, departamento: volDepto.value, status: volStatus.value });
      if (!r.ok) { volMsg.textContent = r.erro || 'Não foi possível salvar.'; return; }
      const msg = r.novo ? ('✓ Adicionado! Código: ' + r.codigo) : '✓ Atualizado.';
      limparFormVol();
      volMsg.style.color = '#27ae60';
      volMsg.textContent = msg;
      carregarVoluntariosCadastro();
    } catch (e) {
      volMsg.textContent = 'Falha de conexão. Tente de novo.';
    } finally {
      btnSalvarVol.disabled = false;
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
                 escalado: p.codigo === '1001',
                 reconhecimento: { marco: true, mensagem: '10ª presença! Você faz diferença. 💙', total: 10 } };
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
      case 'presencasPorCulto':
        return { ok: true, nVol: 7, cultos: [
          { data: '03/06/2026', descricao: 'Culto de Ensino',    presentes: 5, faltas: 2, pct: 71.4 },
          { data: '05/06/2026', descricao: 'Encontro de Jovens', presentes: 4, faltas: 3, pct: 57.1 },
          { data: '07/06/2026', descricao: 'Culto Família',      presentes: 6, faltas: 1, pct: 85.7 }
        ] };
      case 'detalheCulto':
        return { ok: true, data: p.data, presentes: [
          { nome: 'Elton de Moraes', departamento: 'Transmissão' }, { nome: 'Maria Oliveira', departamento: 'Louvor' }
        ], ausentes: [{ nome: 'Ryan', departamento: 'Jovens' }, { nome: 'Yan', departamento: 'Jovens' }] };
      case 'relatorioDepartamento':
        return { ok: true, departamento: p.departamento || 'Louvor', nCultos: 4, voluntarios: [
          { nome: 'Maria Oliveira', presencas: 4, faltas: 0, pct: 100, alerta: false },
          { nome: 'João Pereira',   presencas: 2, faltas: 2, pct: 50,  alerta: false },
          { nome: 'Ana Souza',      presencas: 1, faltas: 3, pct: 25,  alerta: true }
        ], maior: [{ nome: 'Maria Oliveira', pct: 100 }], menor: [{ nome: 'Ana Souza', pct: 25 }], alertas: ['Ana Souza'] };
      case 'alertasAfastamento':
        return { ok: true, limite: 2, alertas: [
          { nome: 'Ana Souza',   departamento: 'Infantil', faltas: 3, ultima: '01/06/2026' },
          { nome: 'João Pereira', departamento: 'Recepção', faltas: 2, ultima: '10/06/2026' }
        ] };
      case 'listarTodosVoluntarios':
        return { ok: true, voluntarios: [
          { codigo: '1001', nome: 'Maria Oliveira', departamento: 'Louvor',   status: 'Ativo' },
          { codigo: '1002', nome: 'João Pereira',   departamento: 'Recepção', status: 'Ativo' },
          { codigo: '1003', nome: 'Ana Souza',      departamento: 'Infantil', status: 'Inativo' }
        ] };
      case 'salvarVoluntario':
        return { ok: true, codigo: p.codigo || '4821', novo: !p.codigo };
      default: return { ok: false, erro: 'Ação demo desconhecida.' };
    }
  }
})();
