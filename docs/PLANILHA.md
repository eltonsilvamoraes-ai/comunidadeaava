# Modelo da Planilha (Google Sheets)

Crie **uma** planilha no Google Sheets (ex.: "AAVA — Voluntários") com as
**2 abas** abaixo desta etapa. Os nomes das abas devem ser **exatamente**
estes, em maiúsculas, sem acento.

> Dica: a primeira linha de cada aba é o cabeçalho (não apague).

## Aba `VOLUNTARIOS` — Base de dados

| A: Codigo | B: Nome completo | C: Departamento | D: Status |
|-----------|------------------|-----------------|-----------|
| 1001      | Maria Oliveira   | Louvor          | Ativo     |
| 1002      | João Pereira     | Recepção        | Ativo     |
| 1003      | Ana Souza        | Infantil        | Ativo     |

- **Codigo**: número/identificador único que o voluntário vai digitar (ou que vira o QR Code).
- **Status**: `Ativo` ou `Inativo`. Inativos não conseguem registrar presença.

## Aba `REGISTROS` — Registro de presenças

O app preenche esta aba automaticamente. Você só cria o cabeçalho:

| A: Data | B: Hora chegada | C: Codigo | D: Nome completo | E: Departamento | F: Estava escalado? |
|---------|-----------------|-----------|------------------|-----------------|---------------------|
|         |                 |           |                  |                 |                     |

- **Data / Hora chegada**: preenchidas no momento do registro (fuso de São Paulo).
- **Estava escalado?**: fica `—` nesta etapa. Será preenchido automaticamente
  quando criarmos a aba **ESCALA** (próxima fase).
- O sistema **não duplica**: se a mesma pessoa registrar de novo no mesmo dia,
  o app apenas confirma o registro existente.

---

### Próximas abas (fases seguintes — ainda não usadas)
- `DEPARTAMENTOS` — Código + Nome do departamento.
- `ESCALA` — quem está escalado por data (resolve o "Estava escalado? Sim/Não").
- Abas por mês — datas/horários de culto cadastrados pelo pastor.
