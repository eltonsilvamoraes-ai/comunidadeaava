# Projeto Escala (SaaS) — COMECE AQUI

> Ponto de partida para retomar o desenvolvimento do SaaS em uma **nova sessão**.
> Leia este arquivo primeiro; ele resume decisões e diz o próximo passo.

## O que é este projeto
"**Projeto Escala**" (codinome) é o **SaaS multi-igreja** que nasce a partir do app
da AAVA. O nome comercial/domínio fica **para depois** (decidir conforme o produto
toma forma).

- **AAVA – App Voluntários** = o app atual (Google Sheets + Apps Script + KingHost),
  em produção na igreja AAVA. Continua rodando e recebe ajustes próprios.
- **Projeto Escala** = o produto novo, multi-tenant, construído em paralelo.

## Decisões já tomadas
- **Banco/stack:** **Supabase** (Postgres + Auth + RLS). Motivo: dados relacionais,
  isolamento por igreja pronto (RLS), login incluído, grátis para começar, e é
  Postgres padrão (sem lock-in — dá para migrar depois).
- **Front sugerido:** Next.js + Supabase (a confirmar).
- **Onde mora o código:** por ora, pasta `projeto-escala/` neste repo
  (`comunidadeaava`); promover para repo próprio quando fizer sentido.
- **Modelo de negócio:** ver `docs/PLANEJAMENTO.md` (R$99/mês, grátis até 10
  voluntários, **1 conta por CNPJ**, diferencial = cuidado pastoral).
- **Roadmap e features:** ver `docs/saas/ROADMAP_SAAS.md` (mindmap + fases + MoSCoW).

## Status do setup
- [ ] Usuário criou a conta no **Supabase** (projeto `projeto-escala`, region
      South America / São Paulo, senha do banco guardada).
- [ ] Rodar o **SQL do schema + políticas RLS** (próxima entrega a gerar).
- [ ] Smoke test multi-tenant: duas igrejas que **não** se enxergam.
- [ ] Esqueleto do frontend com login (Supabase Auth).

## PRÓXIMO PASSO (retomar aqui)
Gerar o **SQL do banco multi-tenant** (tabelas + RLS) descrito no esboço do
`docs/saas/ROADMAP_SAAS.md`, com explicação de cada tabela em português, para o
usuário colar no **SQL Editor** do Supabase. Depois: login + smoke test de
isolamento.

> Para retomar numa sessão nova, basta dizer: **"continuar Projeto Escala — ver
> docs/saas/COMECE_AQUI.md"**.
