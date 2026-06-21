# ESCALA AÍ — Planejamento de Produto

> Documento vivo. Objetivo: transformar o app da AAVA num SaaS de **escalas de
> voluntários** para igrejas. Atualize conforme as decisões evoluem.

## 1. Visão e posicionamento

**ESCALA AÍ** é o app **especialista em escala de voluntários** para igrejas —
simples, rápido e em português. Enquanto os concorrentes fazem "tudo"
(membresia, dízimo, transmissão) e tratam escala como um detalhe, nós resolvemos
**muito bem uma dor específica**: organizar quem serve, confirmar presença e dar
ao pastor um **panorama de engajamento**.

- **Tagline (opções):** "Escalas de voluntários, sem complicação." ·
  "A escala da sua igreja, na palma da mão."
- **Mantra:** simplicidade radical. Se um líder não usa em 2 minutos, falhamos.

## 2. Público-alvo (ICP)

- Igrejas **pequenas e médias** no Brasil (50–800 membros) que hoje fazem escala
  em planilha/WhatsApp.
- **Quem decide/usa:** pastor (visão geral) e **líderes de ministério** (montam escala).
- **Beachhead:** rede de relacionamento da AAVA (igrejas amigas, convenções).

## 3. Proposta de valor / diferenciais

1. **Foco em escala** (não um sistema gigante e caro).
2. **Presença com geolocalização** (registra só na igreja) — controle real de frequência.
3. **Cuidado pastoral, não só logística:** dashboard de frequência + **alerta de
   voluntário se afastando** (faltas seguidas). Isso é único e tem apelo emocional.
4. **Sem instalar app:** roda no navegador (celular, tablet, totem).
5. **Preço acessível** para igrejas pequenas.
6. **Português e suporte próximo.**

### Concorrência (para conhecer, não copiar)
- **inChurch / Ministério (BR):** completos, mais caros, escala é secundária.
- **Planning Center Services (EUA):** referência em escala, porém em inglês,
  caro e complexo para a igreja brasileira pequena.
- Nossa brecha: **simples + barato + foco em escala + cuidado pastoral, em PT-BR.**

## 4. Funcionalidades

### Já temos (MVP de 1 igreja) ✅
- Registro de presença por código (+ geolocalização)
- Montar/editar/excluir escala por departamento (manhã/noite)
- Calendário de cultos (fixos + avulsos)
- "Minhas Escalas" para o voluntário
- Dashboard de frequência (geral, por culto, por departamento) com alertas
- Área do líder com PIN · responsivo

### Para virar SaaS (a construir)
- **Cadastro self-service** de igreja (sem instalação manual)
- **Login** (líderes/pastor) e **isolamento de dados** por igreja (multi-tenant)
- **White-label:** logo, cores e dias de culto configuráveis por igreja
- **Cobrança automática** (assinatura)
- **Painel do dono** (admin do SaaS): igrejas, planos, status

### Futuro (diferenciais de retenção)
- Notificação por **WhatsApp/e-mail** ("você está escalado domingo")
- **Troca de escala** entre voluntários (pedir substituição)
- **PWA instalável** + QR rotativo no totem
- Confirmação de disponibilidade do voluntário

## 5. Modelo de negócio

Assinatura por **igreja** (não por departamento). Camada grátis como amostra.

| Plano | Preço | Limite |
|---|---|---|
| **Grátis** | R$ 0 | até **10 voluntários**, 1 igreja, recursos básicos (amostra) |
| **Profissional** | **R$ 99/mês** | ilimitado: voluntários, departamentos, dashboard, relatórios |
| **Anual** (futuro) | 11× R$ 99 (**1 mês grátis**) | igual ao Profissional, com desconto |

- **Regra-chave: 1 conta por CNPJ.** Impede a mesma igreja abrir várias contas
  grátis (ex.: um login por departamento). A conta é da **igreja inteira**.
- **Break-even:** ~3 igrejas no Profissional já cobrem infra + MEI.

## 5.1 Modelo de contas (multi-tenant) — resolve o risco do "grátis"

- **Conta = Igreja (1 por CNPJ).** O CNPJ é a chave única do sistema.
- **Usuários dentro da igreja**, com papéis:
  - **Pastor / Admin:** cria a igreja, gerencia departamentos, vê tudo, cuida da assinatura.
  - **Líder:** monta a escala do seu departamento e vê seus relatórios.
- **Voluntários:** **não precisam de login** — usam o código (presença) e consultam a própria escala.
- **Plano grátis** limita a **igreja** (10 voluntários), não o departamento. Assim,
  uma igreja com 5 departamentos **não** consegue 5 contas grátis: é **uma conta só**.
- Caso da AAVA (referência): ~200 membros, ~90 voluntários, ~5 departamentos →
  **1 conta** (Profissional), vários líderes, presença sem login.

## 6. Arquitetura em fases

- **Fase 0 (feito):** app de 1 igreja (Google Sheets + Apps Script + KingHost).
- **Fase 1 — White-label:** configurações por igreja (logo/cores/dias de culto).
- **Fase 2 — Multi-tenant:** migrar de Sheets para **Supabase/Firebase**
  (banco + login + dados isolados). Cadastro self-service.
- **Fase 3 — Cobrança:** gateway (Asaas/Mercado Pago/Stripe) + controle de assinatura.
- **Fase 4 — Extras:** WhatsApp, troca de escala, PWA, QR rotativo.

> Estratégia: **validar com o "Kit"** (replicar o que já existe) antes de investir
> na Fase 2. Gasta quase R$ 0 até ter igreja pagando.

## 7. Custos (resumo — ver detalhe na conversa)

- **Início:** infra ~R$ 0–50/mês (planos grátis) + **MEI ~R$ 76/mês**.
- **Crescendo:** ~R$ 350–500/mês de infra.
- **Taxas de pagamento:** ~3–5% por transação.
- **Legal (LGPD):** termos + política (modelo R$ 0–500 ou advogado R$ 1–3k).

## 8. Go-to-market

1. **Piloto:** AAVA + 2–3 igrejas amigas (feedback + depoimentos).
2. **Indicação:** pastores se conhecem — programa "indique uma igreja".
3. **Conteúdo:** Instagram/TikTok com dicas de organização de voluntários.
4. **Parcerias:** convenções e redes de igrejas.

## 9. Métricas de sucesso

- Nº de igrejas ativas · **MRR** (receita recorrente) · Churn (cancelamento)
- Ativação (igreja que montou 1ª escala) · Frequência de uso · NPS

## 10. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Igrejas com baixo orçamento | Plano grátis + preço baixo; provar ROI (engajamento) |
| LGPD (dados pessoais) | Termos, consentimento, dados privados, segurança |
| Concorrente grande copiar | Velocidade + foco no nicho + relacionamento |
| Suporte cresce com clientes | Onboarding self-service + central de ajuda |

## 11. Marca (ESCALA AÍ)

- **Nome:** ESCALA AÍ ✅
- **Verificar:** domínios (`escalaai.com.br`, `escalaai.app`), redes sociais, marca (INPI).
- **Tom:** leve, acolhedor, próximo da realidade da igreja.

## 12. Estratégia de execução (decidida)

- **AAVA primeiro:** a igreja continua usando a versão atual (Sheets + Apps
  Script) em produção, sem parar.
- **SaaS em paralelo:** começamos a construir o **ESCALA AÍ** como produto
  multi-tenant, num stack próprio, reaproveitando as **telas que já temos**.

### Reaproveitamento (o que migra)
- **Frontend (telas):** presença, escala, cultos, dashboard, minhas escalas —
  praticamente tudo reaproveitável. Só troca para onde elas "conversam".
- **Backend:** sai o Apps Script/Sheets, entra um backend real **multi-tenant**
  com **login** e **dados isolados por igreja**.

### Stack recomendado para o SaaS
- **Supabase** (Postgres + Auth + isolamento por igreja) — banco relacional
  combina com nossos dados (igrejas, departamentos, voluntários, escalas, cultos,
  registros); plano grátis generoso; login pronto.
- **Frontend** hospedado em Vercel/Cloudflare (grátis no início).
- **Cobrança** (Fase 3): Asaas/Mercado Pago (Pix/boleto BR) ou Stripe (cartão).

## 13. Próximos passos

1. Confirmar **stack** (Supabase) e identidade da marca ESCALA AÍ.
2. Modelar o **banco multi-tenant** (igreja/CNPJ, usuários/papéis, departamentos,
   voluntários, cultos, escalas, registros).
3. Construir **cadastro de igreja + login** (com regra 1 conta por CNPJ).
4. Migrar as **telas** para o novo backend.
5. **Cobrança** (assinatura) + painel do dono.
6. **MEI** ao fechar o 1º cliente pagante.
