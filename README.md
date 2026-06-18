# AAVA — Registro de Presença de Voluntários

Aplicação **web** (abre no navegador de qualquer celular ou tablet) para
registrar a presença dos voluntários da igreja nos dias de culto.

- **Frontend:** página responsiva em HTML/CSS/JS — pasta [`web/`](./web).
- **Backend:** Google Apps Script ligado a um Google Sheet — pasta [`apps-script/`](./apps-script).
- **Hospedagem:** subdomínio `escala.comunidadeaava.com.br` (KingHost).

## Etapa atual (MVP) — Captura do voluntário
Fluxo completo: voluntário **digita o código → o sistema o identifica → grava a
presença** (data, hora, nome, departamento) na planilha.

Abas usadas nesta etapa: **VOLUNTARIOS** (base de dados) e **REGISTROS**.

### Telas
1. **Inserir Código** — campo + botão Confirmar (visual do Figma).
2. **Confirmação** — "Presença registrada, [Nome]".

> Suporta também QR Code: um link `?codigo=1001` já preenche e confirma.

## Como rodar localmente (visualizar as telas)
Não precisa de servidor; abra `web/index.html` no navegador. Sem backend
configurado, roda em **modo demonstração** (códigos de teste 1001, 1002, 1003).

## Como publicar
Passo a passo em [`docs/DEPLOY.md`](./docs/DEPLOY.md).
Modelo da planilha em [`docs/PLANILHA.md`](./docs/PLANILHA.md).

## Próximas fases
- Cadastro de Departamentos.
- **Escala por departamento/data** (líder escala voluntários; o "Estava
  escalado? Sim/Não" passa a ser automático).
- Registro de datas de culto por mês (pastor).
- Relatórios de presença.
