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
const FUSO            = 'America/Sao_Paulo';

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
  return json({ ok: true, mensagem: 'API AAVA ativa', versao: 4 });
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

  const sh = getSheet(ABA_REGISTROS);
  sh.getRange('A:B').setNumberFormat('@'); // Data e Hora como TEXTO (evita virar data serial 30/12/1899).

  // SEMPRE insere uma NOVA linha (log puro). Sem verificação de duplicidade.
  // Coluna F (Estava escalado?) fica "—" até a aba ESCALA existir (próxima etapa).
  sh.appendRow([dataStr, horaStr, codigo, vol.nome, vol.departamento, '—']);

  return {
    ok: true, jaRegistrado: false,
    nome: vol.nome, departamento: vol.departamento,
    data: dataStr, hora: horaStr
  };
}

/** Retorna os dados públicos de um voluntário (para o modo QR Code). */
function buscarVoluntario(codigo) {
  const vol = buscarVoluntarioRaw(String(codigo || '').trim());
  if (!vol) return { ok: false, erro: 'Código não encontrado.' };
  return { ok: true, nome: vol.nome, departamento: vol.departamento };
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
