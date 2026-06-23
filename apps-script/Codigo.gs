/**
 * AAVA — Registro de Presença de Voluntários
 * Backend em Google Apps Script (ligado ao Google Sheet)
 *
 * Como publicar:
 *   1. Abra o Google Sheet do projeto.
 *   2. Menu  Extensões > Apps Script.
 *   3. Apague o conteúdo padrão e cole TODO este arquivo.
 *   4. Salve. Depois  Implantar > Nova implantação > tipo "App da Web".
 *        - Executar como: "Eu"
 *        - Quem pode acessar: "Qualquer pessoa"
 *   5. Copie a URL gerada (termina em /exec) e cole em web/config.js.
 *
 * Abas esperadas na planilha (nomes EXATOS, em maiúsculas):
 *   VOLUNTARIOS  ->  A: Codigo | B: Nome completo | C: Departamento | D: Status (Ativo/Inativo)
 *   REGISTROS    ->  A: Data   | B: Hora chegada  | C: Codigo       | D: Nome | E: Departamento | F: Estava escalado?
 */

const ABA_VOLUNTARIOS = 'VOLUNTARIOS';
const ABA_REGISTROS   = 'REGISTROS';
const ABA_ESCALA      = 'ESCALA';
const ABA_CULTOS      = 'CULTOS';
const FUSO            = 'America/Sao_Paulo';

// PIN genérico da Área do Líder. Troque aqui quando quiser (e republique).
const PIN_LIDER = '2024';

// Restrição de localização: só registra presença perto da igreja.
const RESTRINGIR_LOCAL = true;        // mude para false para desligar a checagem
const IGREJA_LAT  = -23.3122366;
const IGREJA_LNG  = -45.988886;
const RAIO_METROS = 200;

// Quantas faltas seguidas em cultos para gerar alerta pastoral de afastamento.
const LIMITE_FALTAS = 2;

/** Recebe as chamadas POST do app (corpo em texto/JSON). */
function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    let resultado;
    switch (req.action) {
      case 'registrarPresenca':
        resultado = registrarPresenca(req);
        break;
      case 'buscarVoluntario':
        resultado = buscarVoluntario(req);
        break;
      case 'listarDepartamentos':
        resultado = listarDepartamentos(req);
        break;
      case 'listarVoluntarios':
        resultado = listarVoluntarios(req);
        break;
      case 'verificarPin':
        resultado = verificarPin(req);
        break;
      case 'salvarEscala':
        resultado = salvarEscala(req);
        break;
      case 'listarEscala':
        resultado = listarEscala(req);
        break;
      case 'listarEscalasDepartamento':
        resultado = listarEscalasDepartamento(req);
        break;
      case 'excluirEscala':
        resultado = excluirEscala(req);
        break;
      case 'minhasEscalas':
        resultado = minhasEscalas(req.codigo);
        break;
      case 'gerarCultosMes':
        resultado = gerarCultosMes(req);
        break;
      case 'adicionarCulto':
        resultado = adicionarCulto(req);
        break;
      case 'listarCultos':
        resultado = listarCultos(req);
        break;
      case 'dashboard':
        resultado = dashboard(req);
        break;
      case 'presencasPorCulto':
        resultado = presencasPorCulto(req);
        break;
      case 'detalheCulto':
        resultado = detalheCulto(req);
        break;
      case 'relatorioDepartamento':
        resultado = relatorioDepartamento(req);
        break;
      case 'alertasAfastamento':
        resultado = alertasAfastamento(req);
        break;
      case 'listarTodosVoluntarios':
        resultado = listarTodosVoluntarios(req);
        break;
      case 'salvarVoluntario':
        resultado = salvarVoluntario(req);
        break;
      default:
        resultado = { ok: false, erro: 'Ação desconhecida: ' + req.action };
    }
    return json(resultado);
  } catch (err) {
    Logger.log('Erro: ' + err);                 // detalhe fica só no log do servidor
    return json({ ok: false, erro: 'Erro no servidor. Tente novamente.' });
  }
}

/** Permite testar a URL no navegador e serve de "check de saúde". */
function doGet() {
  return json({ ok: true, mensagem: 'API AAVA ativa', versao: 14 });
}

/* ------------------------------------------------------------------ */
/* Regras de negócio                                                  */
/* ------------------------------------------------------------------ */

/** Registra a presença de um voluntário a partir do código. req: {codigo, lat, lng} */
function registrarPresenca(req) {
  const codigo = String((req && req.codigo) || '').trim();
  if (!codigo) return { ok: false, erro: 'Informe um código.' };

  // Restrição de localização: precisa estar dentro do raio da igreja.
  if (RESTRINGIR_LOCAL) {
    const lat = parseFloat(req && req.lat);
    const lng = parseFloat(req && req.lng);
    if (isNaN(lat) || isNaN(lng)) {
      return { ok: false, erro: 'Ative a localização do celular para registrar na igreja.' };
    }
    if (distanciaMetros(lat, lng, IGREJA_LAT, IGREJA_LNG) > RAIO_METROS) {
      return { ok: false, erro: 'Você precisa estar na igreja para registrar a presença.' };
    }
  }

  const vol = buscarVoluntarioRaw(codigo);
  if (!vol) {
    return { ok: false, erro: 'Código não encontrado. Confira com a liderança.' };
  }
  if (vol.status && vol.status.toLowerCase() === 'inativo') {
    return { ok: false, erro: 'Cadastro inativo. Procure a liderança.' };
  }

  const agora   = new Date();
  const dataStr = Utilities.formatDate(agora, FUSO, 'dd/MM/yyyy');
  const horaStr = Utilities.formatDate(agora, FUSO, 'HH:mm');

  // Validação automática: o voluntário estava na ESCALA de hoje?
  const escalado = estaEscalado(codigo, dataStr);   // true / false
  const escaladoTxt = escalado ? 'Sim' : 'Não';

  const sh = getSheet(ABA_REGISTROS);
  sh.getRange('A:B').setNumberFormat('@'); // Data e Hora como TEXTO (evita virar data serial 30/12/1899).

  // SEMPRE insere uma NOVA linha (log puro). Coluna F = Sim/Não conforme a escala.
  sh.appendRow([dataStr, horaStr, codigo, vol.nome, vol.departamento, escaladoTxt]);

  // Reconhecimento: marcos de presença + palavra de incentivo.
  const totalPresencas = contarPresencas(codigo);

  return {
    ok: true, jaRegistrado: false,
    nome: vol.nome, departamento: vol.departamento,
    data: dataStr, hora: horaStr, escalado: escalado,
    reconhecimento: mensagemReconhecimento(totalPresencas)
  };
}

/** Conta quantas presenças um voluntário já registrou (total de check-ins). */
function contarPresencas(codigo) {
  const dados = getSheet(ABA_REGISTROS).getDataRange().getValues();
  let n = 0;
  for (let i = 1; i < dados.length; i++) {
    if (String(dados[i][2]).trim() === String(codigo).trim()) n++;
  }
  return n;
}

/** Monta a mensagem de reconhecimento (marco ou incentivo). */
function mensagemReconhecimento(total) {
  const marcos = {
    1:   'Bem-vindo(a) ao time! 🎉 Sua 1ª presença.',
    5:   '5 presenças! Que constância. 🙌',
    10:  '10ª presença! Você faz diferença. 💙',
    25:  '25 presenças! Servo(a) fiel. 👏',
    50:  '50ª presença! Inspirador(a). 🌟',
    100: '100 presenças! Que legado. 🏆',
    200: '200 presenças! Lenda. 👑'
  };
  if (marcos[total]) return { marco: true, mensagem: marcos[total], total: total };
  const frases = [
    'Obrigado por servir! 💙',
    'Sua presença abençoa. 🙏',
    'Que bom ter você aqui!',
    'Deus recompense o seu servir. 🌟'
  ];
  return { marco: false, mensagem: frases[total % frases.length], total: total };
}

/** Retorna os dados de um voluntário por código. (restrito por PIN) */
function buscarVoluntario(req) {
  if (!pinValido(req)) return { ok: false, erro: 'Acesso restrito.' };
  const vol = buscarVoluntarioRaw(String((req && req.codigo) || '').trim());
  if (!vol) return { ok: false, erro: 'Código não encontrado.' };
  return { ok: true, nome: vol.nome, departamento: vol.departamento };
}

/* ------------------------------------------------------------------ */
/* ESCALA                                                             */
/* ------------------------------------------------------------------ */

/** Confere se o PIN enviado é o do líder. Usado por todas as ações restritas. */
function pinValido(req) {
  return String((req && req.pin) || '') === PIN_LIDER;
}

/** Verifica o PIN (a tela do líder chama antes de abrir a área). */
function verificarPin(req) {
  if (!pinValido(req)) return { ok: false, erro: 'PIN incorreto.' };
  return { ok: true };
}

/** Lista os departamentos distintos a partir da aba VOLUNTARIOS. (restrito) */
function listarDepartamentos(req) {
  if (!pinValido(req)) return { ok: false, erro: 'Acesso restrito.' };
  const dados = getSheet(ABA_VOLUNTARIOS).getDataRange().getValues();
  const set = {};
  for (let i = 1; i < dados.length; i++) {
    const d = String(dados[i][2] || '').trim();
    if (d) set[d] = true;
  }
  return { ok: true, departamentos: Object.keys(set).sort() };
}

/** Lista os voluntários ATIVOS de um departamento (para montar a escala). (restrito) */
function listarVoluntarios(req) {
  if (!pinValido(req)) return { ok: false, erro: 'Acesso restrito.' };
  const departamento = String((req && req.departamento) || '').trim();
  const dados = getSheet(ABA_VOLUNTARIOS).getDataRange().getValues();
  const lista = [];
  for (let i = 1; i < dados.length; i++) {
    const dep = String(dados[i][2] || '').trim();
    const status = String(dados[i][3] || '').trim().toLowerCase();
    if (dep === departamento && status !== 'inativo') {
      lista.push({ codigo: String(dados[i][0]).trim(), nome: String(dados[i][1] || '').trim() });
    }
  }
  lista.sort(function (a, b) { return a.nome.localeCompare(b.nome); });
  return { ok: true, voluntarios: lista };
}

/**
 * Salva a escala de uma data/departamento. Substitui o que já existia para
 * essa mesma data+departamento (permite reabrir e editar). req:
 *   { pin, data (yyyy-mm-dd), horario, departamento, codigos: [..] }
 */
function salvarEscala(req) {
  if (String(req.pin || '') !== PIN_LIDER) return { ok: false, erro: 'PIN incorreto.' };

  const dataBR = isoParaBR(req.data);
  const horario = String(req.horario || '').trim();
  const departamento = String(req.departamento || '').trim();
  const codigos = Array.isArray(req.codigos) ? req.codigos.map(function (c) { return String(c).trim(); }) : [];
  if (!dataBR)        return { ok: false, erro: 'Data inválida.' };
  if (!departamento)  return { ok: false, erro: 'Informe o departamento.' };

  const sh = getEscalaSheet();
  sh.getRange('A:B').setNumberFormat('@'); // Data e Horário como texto.

  // Remove linhas antigas dessa data + horário + departamento (permite reeditar
  // sem apagar outra escala do MESMO dia em horário diferente — ex.: manhã x noite).
  const dados = sh.getDataRange().getValues();
  for (let i = dados.length - 1; i >= 1; i--) {
    if (formatData(dados[i][0]) === dataBR &&
        formatHora(dados[i][1]) === horario &&
        String(dados[i][4] || '').trim() === departamento) {
      sh.deleteRow(i + 1);
    }
  }

  // Insere os novos escalados.
  let inseridos = 0;
  codigos.forEach(function (cod) {
    const vol = buscarVoluntarioRaw(cod);
    const nome = vol ? vol.nome : '';
    sh.appendRow([dataBR, horario, cod, nome, departamento]);
    inseridos++;
  });

  return { ok: true, data: dataBR, departamento: departamento, total: inseridos };
}

/** Lista os códigos escalados de uma data+horário+departamento (para pré-marcar ao editar). */
function listarEscala(req) {
  if (!pinValido(req)) return { ok: false, erro: 'Acesso restrito.' };
  const dataBR = isoParaBR(req.data);
  const horario = String(req.horario || '').trim();
  const departamento = String(req.departamento || '').trim();
  const dados = getEscalaSheet().getDataRange().getValues();
  const codigos = [];
  for (let i = 1; i < dados.length; i++) {
    if (formatData(dados[i][0]) === dataBR &&
        formatHora(dados[i][1]) === horario &&
        String(dados[i][4] || '').trim() === departamento) {
      codigos.push(String(dados[i][2]).trim());
    }
  }
  return { ok: true, codigos: codigos };
}

/** Lista as escalas já criadas de um departamento (agrupadas por data+horário). */
function listarEscalasDepartamento(req) {
  if (!pinValido(req)) return { ok: false, erro: 'Acesso restrito.' };
  const departamento = String(req.departamento || '').trim();
  const dados = getEscalaSheet().getDataRange().getValues();
  const grupos = {};
  for (let i = 1; i < dados.length; i++) {
    if (String(dados[i][4] || '').trim() === departamento) {
      const data = formatData(dados[i][0]);
      const horario = formatHora(dados[i][1]);
      const key = data + '|' + horario;
      if (!grupos[key]) grupos[key] = { data: data, horario: horario, total: 0 };
      grupos[key].total++;
    }
  }
  const lista = Object.keys(grupos).map(function (k) { return grupos[k]; });
  lista.sort(function (a, b) {
    return (brParaOrdenavel(a.data) - brParaOrdenavel(b.data)) || a.horario.localeCompare(b.horario);
  });
  return { ok: true, escalas: lista };
}

/** Exclui a escala de uma data+horário+departamento. */
function excluirEscala(req) {
  if (!pinValido(req)) return { ok: false, erro: 'Acesso restrito.' };
  const dataBR = isoParaBR(req.data);
  const horario = String(req.horario || '').trim();
  const departamento = String(req.departamento || '').trim();
  const sh = getEscalaSheet();
  const dados = sh.getDataRange().getValues();
  let removidos = 0;
  for (let i = dados.length - 1; i >= 1; i--) {
    if (formatData(dados[i][0]) === dataBR &&
        formatHora(dados[i][1]) === horario &&
        String(dados[i][4] || '').trim() === departamento) {
      sh.deleteRow(i + 1);
      removidos++;
    }
  }
  return { ok: true, removidos: removidos };
}

/** Escalas de um voluntário (todas as datas em que ele está escalado). */
function minhasEscalas(codigo) {
  codigo = String(codigo || '').trim();
  if (!codigo) return { ok: false, erro: 'Informe seu código.' };
  const vol = buscarVoluntarioRaw(codigo);
  if (!vol) return { ok: false, erro: 'Código não encontrado.' };

  const dados = getEscalaSheet().getDataRange().getValues();
  const escalas = [];
  for (let i = 1; i < dados.length; i++) {
    if (String(dados[i][2]).trim() === codigo) {
      escalas.push({
        data: formatData(dados[i][0]),
        horario: formatHora(dados[i][1]),
        departamento: String(dados[i][4] || '').trim()
      });
    }
  }
  escalas.sort(function (a, b) { return brParaOrdenavel(a.data) - brParaOrdenavel(b.data); });
  return { ok: true, nome: vol.nome, departamento: vol.departamento, escalas: escalas };
}

/** true se o código está escalado na data informada (dd/MM/yyyy). */
function estaEscalado(codigo, dataBR) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA_ESCALA);
  if (!sh) return false; // aba ESCALA ainda não existe
  const dados = sh.getDataRange().getValues();
  for (let i = 1; i < dados.length; i++) {
    if (String(dados[i][2]).trim() === String(codigo).trim() && formatData(dados[i][0]) === dataBR) {
      return true;
    }
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* CULTOS (calendário)                                                */
/* ------------------------------------------------------------------ */

/** Padrão semanal de culto por dia da semana (0=Dom ... 6=Sáb). */
function padraoCulto(dow) {
  switch (dow) {
    case 3: return { horario: '19:30', descricao: 'Culto de Ensino' };    // quarta
    case 5: return { horario: '20:00', descricao: 'Encontro de Jovens' }; // sexta
    case 0: return { horario: '09:00', descricao: 'Culto Família' };      // domingo
    default: return null;
  }
}

/** Gera os cultos fixos (Qua/Sex/Dom) de um mês. req: {pin, ano, mes(1-12)} */
function gerarCultosMes(req) {
  if (!pinValido(req)) return { ok: false, erro: 'Acesso restrito.' };
  const ano = Number(req.ano), mes = Number(req.mes);
  if (!ano || !mes || mes < 1 || mes > 12) return { ok: false, erro: 'Mês inválido.' };

  const sh = getCultosSheet();
  sh.getRange('A:B').setNumberFormat('@');

  const existentes = {};
  const dados = sh.getDataRange().getValues();
  for (let i = 1; i < dados.length; i++) existentes[formatData(dados[i][0])] = true;

  let criados = 0;
  const ultimoDia = new Date(ano, mes, 0).getDate();
  for (let d = 1; d <= ultimoDia; d++) {
    const dt = new Date(ano, mes - 1, d);
    const p = padraoCulto(dt.getDay());
    if (p) {
      const dataBR = Utilities.formatDate(dt, FUSO, 'dd/MM/yyyy');
      if (!existentes[dataBR]) {
        sh.appendRow([dataBR, p.horario, p.descricao]);
        existentes[dataBR] = true;
        criados++;
      }
    }
  }
  return { ok: true, criados: criados };
}

/** Adiciona um culto avulso (esporádico). req: {pin, data(yyyy-mm-dd), horario, descricao} */
function adicionarCulto(req) {
  if (!pinValido(req)) return { ok: false, erro: 'Acesso restrito.' };
  const dataBR = isoParaBR(req.data);
  if (!dataBR) return { ok: false, erro: 'Data inválida.' };
  const horario = String(req.horario || '').trim();
  const descricao = String(req.descricao || '').trim();

  const sh = getCultosSheet();
  sh.getRange('A:B').setNumberFormat('@');
  const dados = sh.getDataRange().getValues();
  for (let i = 1; i < dados.length; i++) {
    if (formatData(dados[i][0]) === dataBR && formatHora(dados[i][1]) === horario) {
      return { ok: false, erro: 'Esse culto já está cadastrado.' };
    }
  }
  sh.appendRow([dataBR, horario, descricao]);
  return { ok: true, data: dataBR };
}

/** Lista os cultos cadastrados, em ordem de data. req: {pin} */
function listarCultos(req) {
  if (!pinValido(req)) return { ok: false, erro: 'Acesso restrito.' };
  const dados = getCultosSheet().getDataRange().getValues();
  const cultos = [];
  for (let i = 1; i < dados.length; i++) {
    if (!dados[i][0]) continue;
    cultos.push({
      data: formatData(dados[i][0]),
      horario: formatHora(dados[i][1]),
      descricao: String(dados[i][2] || '').trim()
    });
  }
  cultos.sort(function (a, b) { return brParaOrdenavel(a.data) - brParaOrdenavel(b.data); });
  return { ok: true, cultos: cultos };
}

/** Obtém a aba CULTOS, criando-a com cabeçalho se não existir. */
function getCultosSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(ABA_CULTOS);
  if (!sh) {
    sh = ss.insertSheet(ABA_CULTOS);
    sh.appendRow(['Data', 'Horário', 'Descrição']);
    sh.setFrozenRows(1);
  }
  return sh;
}

/* ------------------------------------------------------------------ */
/* DASHBOARD                                                          */
/* ------------------------------------------------------------------ */

/** Indicadores de frequência de um mês. req: {pin, ano, mes(1-12)} */
function dashboard(req) {
  if (!pinValido(req)) return { ok: false, erro: 'Acesso restrito.' };
  const ano = Number(req.ano), mes = Number(req.mes);
  if (!ano || !mes || mes < 1 || mes > 12) return { ok: false, erro: 'Mês inválido.' };

  // 1) Cultos do mês (datas que de fato aconteceram).
  const cultosDados = getCultosSheet().getDataRange().getValues();
  const cultosMes = [];
  const ehCulto = {};
  for (let i = 1; i < cultosDados.length; i++) {
    const dataBR = formatData(cultosDados[i][0]);
    const m = dataBR.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (m && Number(m[2]) === mes && Number(m[3]) === ano && !ehCulto[dataBR]) {
      ehCulto[dataBR] = true;
      cultosMes.push({ data: dataBR, descricao: String(cultosDados[i][2] || '').trim() });
    }
  }
  const nCultos = cultosMes.length;

  // 2) Voluntários ativos.
  const volDados = getSheet(ABA_VOLUNTARIOS).getDataRange().getValues();
  const vols = {};
  let nVol = 0;
  for (let i = 1; i < volDados.length; i++) {
    const cod = String(volDados[i][0] || '').trim();
    const status = String(volDados[i][3] || '').trim().toLowerCase();
    if (cod && status !== 'inativo') {
      vols[cod] = { nome: String(volDados[i][1] || '').trim(), count: 0 };
      nVol++;
    }
  }

  // 3) Presenças distintas (código+data) que caem em datas de culto do mês.
  const presPorCulto = {};
  cultosMes.forEach(function (c) { presPorCulto[c.data] = {}; });
  const vistos = {};
  const regDados = getSheet(ABA_REGISTROS).getDataRange().getValues();
  for (let i = 1; i < regDados.length; i++) {
    const dataBR = formatData(regDados[i][0]);
    const cod = String(regDados[i][2] || '').trim();
    if (ehCulto[dataBR] && vols[cod]) {
      const chave = cod + '|' + dataBR;
      if (!vistos[chave]) {
        vistos[chave] = true;
        vols[cod].count++;
        presPorCulto[dataBR][cod] = true;
      }
    }
  }

  // 4) Totais e taxas.
  const possiveis = nVol * nCultos;
  let presentes = 0;
  Object.keys(vols).forEach(function (c) { presentes += vols[c].count; });
  const faltas = Math.max(possiveis - presentes, 0);
  const taxaPresenca = possiveis ? Math.round(presentes / possiveis * 1000) / 10 : 0;
  const taxaFalta = possiveis ? Math.round((100 - taxaPresenca) * 10) / 10 : 0;

  // 5) Frequência por voluntário (para os rankings).
  const lista = Object.keys(vols).map(function (c) {
    return {
      nome: vols[c].nome, presencas: vols[c].count,
      pct: nCultos ? Math.round(vols[c].count / nCultos * 1000) / 10 : 0
    };
  });
  const menor = lista.slice().sort(function (a, b) {
    return (a.presencas - b.presencas) || a.nome.localeCompare(b.nome);
  }).slice(0, 10);
  const maior = lista.slice().sort(function (a, b) {
    return (b.presencas - a.presencas) || a.nome.localeCompare(b.nome);
  }).slice(0, 10);

  // 6) Participação por culto.
  const porCulto = cultosMes.map(function (c) {
    const p = Object.keys(presPorCulto[c.data]).length;
    return { data: c.data, descricao: c.descricao, presentes: p,
             pct: nVol ? Math.round(p / nVol * 1000) / 10 : 0 };
  }).sort(function (a, b) { return brParaOrdenavel(a.data) - brParaOrdenavel(b.data); });

  return {
    ok: true, nVol: nVol, nCultos: nCultos,
    presentes: presentes, faltas: faltas,
    taxaPresenca: taxaPresenca, taxaFalta: taxaFalta,
    porCulto: porCulto, menor: menor, maior: maior
  };
}

/* --- Auxiliares de relatório --- */

/** Lista de voluntários ativos: [{codigo, nome, departamento}]. */
function voluntariosAtivos() {
  const dados = getSheet(ABA_VOLUNTARIOS).getDataRange().getValues();
  const vols = [];
  for (let i = 1; i < dados.length; i++) {
    const cod = String(dados[i][0] || '').trim();
    const status = String(dados[i][3] || '').trim().toLowerCase();
    if (cod && status !== 'inativo') {
      vols.push({ codigo: cod, nome: String(dados[i][1] || '').trim(), departamento: String(dados[i][2] || '').trim() });
    }
  }
  return vols;
}

/** Cultos de um mês: [{data, descricao}] ordenados. */
function cultosDoMesArr(ano, mes) {
  const dados = getCultosSheet().getDataRange().getValues();
  const arr = [], seen = {};
  for (let i = 1; i < dados.length; i++) {
    const dataBR = formatData(dados[i][0]);
    const m = dataBR.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (m && Number(m[2]) === mes && Number(m[3]) === ano && !seen[dataBR]) {
      seen[dataBR] = true;
      arr.push({ data: dataBR, descricao: String(dados[i][2] || '').trim() });
    }
  }
  arr.sort(function (a, b) { return brParaOrdenavel(a.data) - brParaOrdenavel(b.data); });
  return arr;
}

/** Mapa data -> {codigo: true} de presenças (somente códigos do conjunto informado). */
function mapaPresencas(codSet) {
  const reg = getSheet(ABA_REGISTROS).getDataRange().getValues();
  const map = {};
  for (let i = 1; i < reg.length; i++) {
    const dataBR = formatData(reg[i][0]);
    const cod = String(reg[i][2] || '').trim();
    if (codSet[cod]) {
      if (!map[dataBR]) map[dataBR] = {};
      map[dataBR][cod] = true;
    }
  }
  return map;
}

/** Presenças/faltas por culto do mês. req: {pin, ano, mes} */
function presencasPorCulto(req) {
  if (!pinValido(req)) return { ok: false, erro: 'Acesso restrito.' };
  const ano = Number(req.ano), mes = Number(req.mes);
  if (!ano || !mes) return { ok: false, erro: 'Mês inválido.' };

  const vols = voluntariosAtivos();
  const codSet = {}; vols.forEach(function (v) { codSet[v.codigo] = true; });
  const nVol = vols.length;
  const cultos = cultosDoMesArr(ano, mes);
  const presMap = mapaPresencas(codSet);

  const lista = cultos.map(function (c) {
    const p = presMap[c.data] ? Object.keys(presMap[c.data]).length : 0;
    return { data: c.data, descricao: c.descricao, presentes: p,
             faltas: Math.max(nVol - p, 0), pct: nVol ? Math.round(p / nVol * 1000) / 10 : 0 };
  });
  return { ok: true, nVol: nVol, cultos: lista };
}

/** Quem compareceu e quem faltou num culto. req: {pin, data} */
function detalheCulto(req) {
  if (!pinValido(req)) return { ok: false, erro: 'Acesso restrito.' };
  const dataBR = isoParaBR(req.data);
  const vols = voluntariosAtivos();
  const codSet = {}; vols.forEach(function (v) { codSet[v.codigo] = true; });
  const presMap = mapaPresencas(codSet);
  const presentesSet = presMap[dataBR] || {};

  const presentes = [], ausentes = [];
  vols.forEach(function (v) {
    const item = { nome: v.nome, departamento: v.departamento };
    if (presentesSet[v.codigo]) presentes.push(item); else ausentes.push(item);
  });
  presentes.sort(function (a, b) { return a.nome.localeCompare(b.nome); });
  ausentes.sort(function (a, b) { return a.nome.localeCompare(b.nome); });
  return { ok: true, data: dataBR, presentes: presentes, ausentes: ausentes };
}

/** Relatório de frequência de um departamento. req: {pin, ano, mes, departamento} */
function relatorioDepartamento(req) {
  if (!pinValido(req)) return { ok: false, erro: 'Acesso restrito.' };
  const ano = Number(req.ano), mes = Number(req.mes);
  const departamento = String(req.departamento || '').trim();
  if (!ano || !mes) return { ok: false, erro: 'Mês inválido.' };
  if (!departamento) return { ok: false, erro: 'Informe o departamento.' };

  const cultos = cultosDoMesArr(ano, mes);
  const nCultos = cultos.length;
  const cultoSet = {}; cultos.forEach(function (c) { cultoSet[c.data] = true; });

  const vols = voluntariosAtivos().filter(function (v) { return v.departamento === departamento; });
  const codSet = {}; vols.forEach(function (v) { codSet[v.codigo] = true; });

  const count = {}; vols.forEach(function (v) { count[v.codigo] = 0; });
  const vistos = {};
  const reg = getSheet(ABA_REGISTROS).getDataRange().getValues();
  for (let i = 1; i < reg.length; i++) {
    const dataBR = formatData(reg[i][0]);
    const cod = String(reg[i][2] || '').trim();
    if (cultoSet[dataBR] && codSet[cod]) {
      const k = cod + '|' + dataBR;
      if (!vistos[k]) { vistos[k] = true; count[cod]++; }
    }
  }

  const lista = vols.map(function (v) {
    const p = count[v.codigo];
    const pct = nCultos ? Math.round(p / nCultos * 1000) / 10 : 0;
    return { nome: v.nome, presencas: p, faltas: Math.max(nCultos - p, 0), pct: pct, alerta: nCultos > 0 && pct < 50 };
  });
  lista.sort(function (a, b) { return a.nome.localeCompare(b.nome); });

  const maior = lista.slice().sort(function (a, b) { return (b.presencas - a.presencas) || a.nome.localeCompare(b.nome); }).slice(0, 3);
  const menor = lista.slice().sort(function (a, b) { return (a.presencas - b.presencas) || a.nome.localeCompare(b.nome); }).slice(0, 3);
  const alertas = lista.filter(function (v) { return v.alerta; }).map(function (v) { return v.nome; });

  return { ok: true, departamento: departamento, nCultos: nCultos, voluntarios: lista, maior: maior, menor: menor, alertas: alertas };
}

/* ------------------------------------------------------------------ */
/* ALERTA PASTORAL (afastamento)                                      */
/* ------------------------------------------------------------------ */

/** Voluntários que faltaram a cultos seguidos (sinal de afastamento). req: {pin} */
function alertasAfastamento(req) {
  if (!pinValido(req)) return { ok: false, erro: 'Acesso restrito.' };

  const hojeOrd = brParaOrdenavel(Utilities.formatDate(new Date(), FUSO, 'dd/MM/yyyy'));

  // Cultos já realizados (data <= hoje), em ordem cronológica.
  const cultosDados = getCultosSheet().getDataRange().getValues();
  const cultos = [], seen = {};
  for (let i = 1; i < cultosDados.length; i++) {
    const d = formatData(cultosDados[i][0]);
    if (d && !seen[d] && brParaOrdenavel(d) <= hojeOrd) { seen[d] = true; cultos.push(d); }
  }
  cultos.sort(function (a, b) { return brParaOrdenavel(a) - brParaOrdenavel(b); });

  const vols = voluntariosAtivos();
  const codSet = {}; vols.forEach(function (v) { codSet[v.codigo] = true; });
  const presMap = mapaPresencas(codSet);

  // Total de presenças e última data por voluntário.
  const totalPorCod = {}, ultimaPorCod = {};
  vols.forEach(function (v) { totalPorCod[v.codigo] = 0; });
  const reg = getSheet(ABA_REGISTROS).getDataRange().getValues();
  for (let i = 1; i < reg.length; i++) {
    const cod = String(reg[i][2] || '').trim();
    const d = formatData(reg[i][0]);
    if (codSet[cod]) {
      totalPorCod[cod]++;
      if (!ultimaPorCod[cod] || brParaOrdenavel(d) > brParaOrdenavel(ultimaPorCod[cod])) ultimaPorCod[cod] = d;
    }
  }

  const lista = [];
  vols.forEach(function (v) {
    if (totalPorCod[v.codigo] < 1) return; // só quem já serviu (tem histórico)
    let streak = 0;
    for (let i = cultos.length - 1; i >= 0; i--) {
      if ((presMap[cultos[i]] || {})[v.codigo]) break;
      streak++;
    }
    if (streak >= LIMITE_FALTAS) {
      lista.push({ nome: v.nome, departamento: v.departamento, faltas: streak,
                   ultima: ultimaPorCod[v.codigo] || '—' });
    }
  });
  lista.sort(function (a, b) { return (b.faltas - a.faltas) || a.nome.localeCompare(b.nome); });
  return { ok: true, limite: LIMITE_FALTAS, alertas: lista };
}

/* ------------------------------------------------------------------ */
/* CADASTRO DE VOLUNTÁRIOS (pela web, líder)                          */
/* ------------------------------------------------------------------ */

/** Lista todos os voluntários (para a tela de cadastro). req: {pin} */
function listarTodosVoluntarios(req) {
  if (!pinValido(req)) return { ok: false, erro: 'Acesso restrito.' };
  const dados = getSheet(ABA_VOLUNTARIOS).getDataRange().getValues();
  const lista = [];
  for (let i = 1; i < dados.length; i++) {
    const cod = String(dados[i][0] || '').trim();
    const nome = String(dados[i][1] || '').trim();
    if (!cod && !nome) continue;
    lista.push({ codigo: cod, nome: nome,
                 departamento: String(dados[i][2] || '').trim(),
                 status: String(dados[i][3] || '').trim() || 'Ativo' });
  }
  lista.sort(function (a, b) { return a.nome.localeCompare(b.nome); });
  return { ok: true, voluntarios: lista };
}

/** Cria ou atualiza um voluntário. req: {pin, codigo?, nome, departamento, status} */
function salvarVoluntario(req) {
  if (!pinValido(req)) return { ok: false, erro: 'Acesso restrito.' };
  const nome = String(req.nome || '').trim();
  const departamento = String(req.departamento || '').trim();
  const status = String(req.status || 'Ativo').trim() || 'Ativo';
  let codigo = String(req.codigo || '').trim();
  if (!nome) return { ok: false, erro: 'Informe o nome.' };

  const sh = getSheet(ABA_VOLUNTARIOS);
  sh.getRange('A:A').setNumberFormat('@');
  const dados = sh.getDataRange().getValues();

  if (codigo) {
    for (let i = 1; i < dados.length; i++) {
      if (String(dados[i][0]).trim() === codigo) {
        sh.getRange(i + 1, 2).setValue(nome);
        sh.getRange(i + 1, 3).setValue(departamento);
        sh.getRange(i + 1, 4).setValue(status);
        return { ok: true, codigo: codigo, novo: false };
      }
    }
  } else {
    const usados = {};
    for (let i = 1; i < dados.length; i++) {
      const c = String(dados[i][0] || '').trim();
      if (c) usados[c] = true;
    }
    do { codigo = String(Math.floor(1000 + Math.random() * 9000)); } while (usados[codigo]);
  }
  sh.appendRow([codigo, nome, departamento, status]);
  return { ok: true, codigo: codigo, novo: true };
}

/* ------------------------------------------------------------------ */
/* Auxiliares                                                         */
/* ------------------------------------------------------------------ */

function buscarVoluntarioRaw(codigo) {
  if (!codigo) return null;
  const dados = getSheet(ABA_VOLUNTARIOS).getDataRange().getValues();
  for (let i = 1; i < dados.length; i++) {
    if (String(dados[i][0]).trim() === codigo) {
      return {
        codigo: codigo,
        nome: String(dados[i][1] || '').trim(),
        departamento: String(dados[i][2] || '').trim(),
        status: String(dados[i][3] || '').trim()
      };
    }
  }
  return null;
}

function getSheet(nome) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nome);
  if (!sh) throw new Error('Aba não encontrada: "' + nome + '". Crie a aba com esse nome exato.');
  return sh;
}

function formatData(v) {
  if (v instanceof Date) return Utilities.formatDate(v, FUSO, 'dd/MM/yyyy');
  return String(v).trim();
}

function formatHora(v) {
  if (v instanceof Date) return Utilities.formatDate(v, FUSO, 'HH:mm');
  return String(v).trim();
}

/** Obtém a aba ESCALA, criando-a com cabeçalho se ainda não existir. */
function getEscalaSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(ABA_ESCALA);
  if (!sh) {
    sh = ss.insertSheet(ABA_ESCALA);
    sh.appendRow(['Data', 'Horário', 'Codigo', 'Nome completo', 'Departamento']);
    sh.setFrozenRows(1);
  }
  return sh;
}

/** Converte 'yyyy-mm-dd' (input date) para 'dd/MM/yyyy'. Aceita já em BR. */
function isoParaBR(s) {
  s = String(s || '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[3] + '/' + m[2] + '/' + m[1];
  return s; // assume já estar em dd/MM/yyyy
}

/** 'dd/MM/yyyy' -> número aaaammdd para ordenar. */
function brParaOrdenavel(s) {
  const m = String(s || '').match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? Number(m[3] + m[2] + m[1]) : 0;
}

/** Distância em metros entre dois pontos GPS (fórmula de Haversine). */
function distanciaMetros(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = function (x) { return x * Math.PI / 180; };
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.asin(Math.sqrt(a));
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ------------------------------------------------------------------ */
/* Utilitários — RODE pelo editor (botão ▶ Executar).                 */
/* NÃO precisam de implantação/nova versão; só de salvar e executar.  */
/* ------------------------------------------------------------------ */

/**
 * Formata as abas VOLUNTARIOS e REGISTROS de forma discreta:
 * cabeçalho cinza-claro em negrito, sem zebra. (Roda pelo editor, sem implantar.)
 */
function formatarPlanilha() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const CINZA_CABECALHO = '#F1F3F4'; // cinza bem claro
  const TEXTO           = '#3C4043'; // cinza-escuro
  const BORDA           = '#DADCE0';

  [ABA_VOLUNTARIOS, ABA_REGISTROS].forEach(function (nome) {
    const sh = ss.getSheetByName(nome);
    if (!sh) return;

    const nCols = Math.max(sh.getLastColumn(), 1);

    // Remove zebra/bandas e cores antigas (deixa neutro antes de aplicar).
    sh.getBandings().forEach(function (b) { b.remove(); });
    sh.getRange(1, 1, sh.getMaxRows(), nCols).setBackground(null).setFontColor(null);

    // Cabeçalho discreto.
    sh.getRange(1, 1, 1, nCols)
      .setBackground(CINZA_CABECALHO)
      .setFontColor(TEXTO)
      .setFontWeight('bold')
      .setHorizontalAlignment('left')
      .setVerticalAlignment('middle')
      .setFontSize(10)
      .setBorder(false, false, true, false, false, false, BORDA, SpreadsheetApp.BorderStyle.SOLID);
    sh.setRowHeight(1, 30);
    sh.setFrozenRows(1);

    // Ajusta largura das colunas ao conteúdo.
    for (var c = 1; c <= nCols; c++) sh.autoResizeColumn(c);
  });

  ss.toast('Planilha formatada (estilo discreto).', 'AAVA', 5);
}

/**
 * Cria a aba ESCALA (com cabeçalho) caso ainda não exista.
 * Rode pelo editor (▶ Executar) — não precisa implantar.
 */
function criarAbaEscala() {
  getEscalaSheet();
  SpreadsheetApp.getActiveSpreadsheet().toast('Aba ESCALA pronta!', 'AAVA', 4);
}

/** Gera os cultos fixos (Qua/Sex/Dom) do MÊS ATUAL. Rode pelo editor (▶ Executar). */
function gerarCultosMesAtual() {
  const now = new Date();
  const r = gerarCultosMes({ pin: PIN_LIDER, ano: now.getFullYear(), mes: now.getMonth() + 1 });
  SpreadsheetApp.getActiveSpreadsheet().toast((r.criados || 0) + ' culto(s) criado(s).', 'AAVA', 5);
}

/**
 * SEGURANÇA: gera um código ALEATÓRIO único (4 dígitos) para cada voluntário
 * que ainda está SEM código. Não altera códigos já existentes — é seguro rodar
 * sempre que cadastrar gente nova. Rode pelo editor (▶ Executar).
 *
 * Por que: códigos sequenciais (1001, 1002...) são fáceis de adivinhar. Códigos
 * aleatórios dificultam que alguém consulte a escala de terceiros por tentativa.
 */
function gerarCodigosFaltantes() {
  const sh = getSheet(ABA_VOLUNTARIOS);
  const dados = sh.getDataRange().getValues();

  const usados = {};
  for (let i = 1; i < dados.length; i++) {
    const c = String(dados[i][0] || '').trim();
    if (c) usados[c] = true;
  }

  let gerados = 0;
  for (let i = 1; i < dados.length; i++) {
    const codigo = String(dados[i][0] || '').trim();
    const nome   = String(dados[i][1] || '').trim();
    if (!codigo && nome) {
      let novo;
      do { novo = String(Math.floor(1000 + Math.random() * 9000)); } while (usados[novo]);
      usados[novo] = true;
      sh.getRange(i + 1, 1).setNumberFormat('@').setValue(novo);
      gerados++;
    }
  }
  SpreadsheetApp.getActiveSpreadsheet().toast(gerados + ' código(s) aleatório(s) gerado(s).', 'AAVA', 5);
}
