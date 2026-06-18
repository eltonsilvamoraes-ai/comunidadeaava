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
  return json({ ok: true, mensagem: 'API AAVA ativa', versao: 1 });
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

  const sh    = getSheet(ABA_REGISTROS);
  const dados = sh.getDataRange().getValues();

  // Evita registrar a mesma pessoa duas vezes no mesmo dia.
  for (let i = 1; i < dados.length; i++) {
    if (String(dados[i][2]).trim() === codigo && formatCell(dados[i][0]) === dataStr) {
      return {
        ok: true, jaRegistrado: true,
        nome: vol.nome, departamento: vol.departamento,
        hora: formatCell(dados[i][1])
      };
    }
  }

  // Coluna F (Estava escalado?) fica "—" até a aba ESCALA existir (próxima etapa).
  sh.appendRow([dataStr, horaStr, codigo, vol.nome, vol.departamento, '—']);

  return {
    ok: true, jaRegistrado: false,
    nome: vol.nome, departamento: vol.departamento, hora: horaStr
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

function formatCell(v) {
  if (v instanceof Date) return Utilities.formatDate(v, FUSO, 'dd/MM/yyyy');
  return String(v).trim();
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
