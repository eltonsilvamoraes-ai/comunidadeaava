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
- Funciona como um **log**: cada presença gera uma **nova linha**. Se a mesma
  pessoa servir em dois cultos no mesmo dia (manhã e noite), aparecem **dois
  registros**. A única proteção é contra toque-duplo (mesmo código no mesmo minuto).

---

## Aba `ESCALA` — quem está escalado por data (Fase 2)

Criada automaticamente pelo sistema (ou rode `criarAbaEscala` no Apps Script).
O líder monta a escala pela tela **Montar Escala** (Área do Líder, com PIN).

| A: Data | B: Horário | C: Codigo | D: Nome completo | E: Departamento |
|---------|-----------|-----------|------------------|-----------------|
| 21/06/2026 | 09:00 | 1001 | Elton de Moraes | Transmissão |

- Cada linha = um voluntário escalado para uma data.
- Ao salvar a escala de uma data+departamento, o sistema **substitui** as linhas
  anteriores daquela data+departamento (permite reabrir e editar).
- No **REGISTROS**, a coluna F *"Estava escalado?"* passa a ser preenchida
  automaticamente com **Sim/Não** comparando o registro com esta aba.

### Próximas abas (fases seguintes)
- `DEPARTAMENTOS` — Código + Nome do departamento (hoje os departamentos vêm da aba VOLUNTARIOS).
- `CULTOS` — datas/horários de culto cadastrados pelo pastor (para o líder só selecionar).
