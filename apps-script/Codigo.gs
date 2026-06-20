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
  return json({ ok: true, mensagem: 'API AAVA ativa', versao: 10 });
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

  return {
    ok: true, jaRegistrado: false,
    nome: vol.nome, departamento: vol.departamento,
    data: dataStr, hora: horaStr, escalado: escalado
  };
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

/** Lista a escala já salva de uma data + departamento (para pré-marcar). */
function listarEscala(req) {
  if (String(req.pin || '') !== PIN_LIDER) return { ok: false, erro: 'PIN incorreto.' };
  const dataBR = isoParaBR(req.data);
  const departamento = String(req.departamento || '').trim();
  const dados = getEscalaSheet().getDataRange().getValues();
  const codigos = [];
  let horario = '';
  for (let i = 1; i < dados.length; i++) {
    if (formatData(dados[i][0]) === dataBR && String(dados[i][4] || '').trim() === departamento) {
      codigos.push(String(dados[i][2]).trim());
      if (!horario) horario = formatHora(dados[i][1]);
    }
  }
  return { ok: true, codigos: codigos, horario: horario };
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
