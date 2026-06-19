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
const FUSO            = 'America/Sao_Paulo';

// PIN genérico da Área do Líder. Troque aqui quando quiser (e republique).
const PIN_LIDER = '2024';

/** Recebe as chamadas POST do app (corpo em texto/JSON). */
function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    let resultado;
    switch (req.action) {
      case 'registrarPresenca':
        resultado = registrarPresenca(req.codigo);
        break;
      case 'buscarVoluntario':
        resultado = buscarVoluntario(req.codigo);
        break;
      case 'listarDepartamentos':
        resultado = listarDepartamentos();
        break;
      case 'listarVoluntarios':
        resultado = listarVoluntarios(req.departamento);
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
      default:
        resultado = { ok: false, erro: 'Ação desconhecida: ' + req.action };
    }
    return json(resultado);
  } catch (err) {
    return json({ ok: false, erro: 'Erro no servidor: ' + err.message });
  }
}

/** Permite testar a URL no navegador e serve de "check de saúde". */
function doGet() {
  return json({ ok: true, mensagem: 'API AAVA ativa', versao: 7 });
}

/* ------------------------------------------------------------------ */
/* Regras de negócio                                                  */
/* ------------------------------------------------------------------ */

/** Registra a presença de um voluntário a partir do código. */
function registrarPresenca(codigo) {
  codigo = String(codigo || '').trim();
  if (!codigo) return { ok: false, erro: 'Informe um código.' };

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

/** Retorna os dados públicos de um voluntário (para o modo QR Code). */
function buscarVoluntario(codigo) {
  const vol = buscarVoluntarioRaw(String(codigo || '').trim());
  if (!vol) return { ok: false, erro: 'Código não encontrado.' };
  return { ok: true, nome: vol.nome, departamento: vol.departamento };
}

/* ------------------------------------------------------------------ */
/* ESCALA                                                             */
/* ------------------------------------------------------------------ */

/** Lista os departamentos distintos a partir da aba VOLUNTARIOS. */
function listarDepartamentos() {
  const dados = getSheet(ABA_VOLUNTARIOS).getDataRange().getValues();
  const set = {};
  for (let i = 1; i < dados.length; i++) {
    const d = String(dados[i][2] || '').trim();
    if (d) set[d] = true;
  }
  return { ok: true, departamentos: Object.keys(set).sort() };
}

/** Lista os voluntários ATIVOS de um departamento (para montar a escala). */
function listarVoluntarios(departamento) {
  departamento = String(departamento || '').trim();
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
