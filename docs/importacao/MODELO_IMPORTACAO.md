# Modelo de importação de voluntários

Este é o formato que o sistema AAVA (e, futuramente, o SaaS multi-igrejas) usa
para importar voluntários em massa. Serve tanto para **colar na planilha-banco**
quanto como **modelo de arquivo de importação** do produto.

## Colunas (nesta ordem)

| Coluna | Campo | Obrigatório | Observação |
|---|---|---|---|
| A | **Codigo** | sim | Matrícula do membro (texto/número). Identifica o voluntário em tudo (presença, escala, "Minha Escala"). |
| B | **Nome completo** | sim | Nome do voluntário. |
| C | **Departamento(s)** | sim | Um ou vários. Separe por `;` — ex.: `Louvor; Staff`. Aceita também `,` ou `/`. |
| D | **Status** | não | `Ativo` (padrão) ou `Inativo`. Inativo não registra presença nem entra em escalas. |

> A primeira linha é o **cabeçalho** e não deve ser importada como dado.

## Como gerar a partir da planilha "matriz" (departamentos nas colunas)

Modelo comum: cada **departamento é uma coluna** e marca-se `1` onde a pessoa serve.
A conversão para este formato:

1. `Codigo` = a matrícula da pessoa.
2. `Nome completo` = o nome da pessoa.
3. `Departamento(s)` = junta, com `; `, os nomes das colunas em que há `1` naquela linha.
4. `Status` = `Ativo` (padrão).

Validações recomendadas antes de importar:
- a quantidade de `1` de cada pessoa bate com o "TOTAL" da linha (se houver);
- a soma de cada departamento bate com o total de cada coluna;
- não há matrícula vazia nem repetida;
- ninguém fica sem departamento.

## Como colar no banco (Google Sheet)

1. Abra a aba `VOLUNTARIOS`.
2. Apague os dados antigos (mantendo o cabeçalho), se for substituir tudo.
3. Selecione a célula `A1`, cole o conteúdo (TSV cola já separado em colunas;
   CSV/`.xlsx`: abra o arquivo, selecione tudo e copie).
4. Garanta a coluna `Codigo` como **texto** (Formatar > Número > Texto puro) para
   não perder zeros à esquerda, se houver.

## Arquivo de exemplo

`VOLUNTARIOS_AAVA.csv` neste diretório é a base real da AAVA já convertida
(96 voluntários, 13 departamentos), gerada a partir da matriz do pastor.
