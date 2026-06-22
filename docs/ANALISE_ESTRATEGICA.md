# Análise Estratégica — ESCALA AÍ

> Complementa `PESQUISA_CONCORRENTES.md`. **Aviso:** as marcações dos concorrentes
> se baseiam em informações públicas (sites, lojas de app) — podem estar
> imprecisas/desatualizadas. Confirmar caso a caso antes de usar em marketing.

Legenda: ✅ tem · 🟡 parcial / planejado · ❌ não tem · — não é o foco

## 1. Matriz de diferenciação

| Recurso | **ESCALA AÍ** | Voluts | Ministrary | Escala Igreja | inChurch | Planning Center |
|---|---|---|---|---|---|---|
| Foco em escala de voluntários | ✅ | ✅ | ✅ | ✅ | 🟡 (secundário) | ✅ |
| Escala manual | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Escala **automática** (por disponibilidade) | 🟡 roadmap | ✅ | 🟡 | ✅ | 🟡 | ✅ |
| Registro de **presença / check-in** | ✅ | ❓ | 🟡 (infantil) | ❌ | ✅ (eventos) | ✅ |
| **Presença com geolocalização** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Dashboard de frequência** | ✅ | 🟡 | ❓ | ❌ | 🟡 | 🟡 |
| **Alerta pastoral** (voluntário se afastando) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Notificação **WhatsApp** | 🟡 roadmap | ✅ | ✅ | ❓ | ✅ | ❌ |
| Sincroniza Google Calendar | 🟡 roadmap | ❓ | ❓ | ✅ | 🟡 | ✅ |
| **Sem instalar app** (web) | ✅ | ❌ (app) | ❓ | ✅ | ❌ (app) | 🟡 |
| Multi-departamento | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Preço transparente** | ✅ | ❌ | ❌ | ✅ (grátis) | ❌ | ✅ |
| Plano grátis | ✅ | 🟡 (p/ voluntário) | ❌ | ✅ | ❌ | ✅ (5 pessoas) |
| Português / suporte BR | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Gestão completa (membros/dízimo) | — | — | 🟡 | — | ✅ | ✅ |

### Onde somos únicos (colunas em que quase ninguém marca ✅)
1. **Presença com geolocalização** — só nós.
2. **Alerta pastoral de afastamento** — só nós.
3. **Presença verificada + dashboard + foco em escala + PT-BR**, tudo junto, sem instalar app.

### Onde estamos atrás (lacunas a fechar)
- **Escala automática** e **WhatsApp** — vários já têm. Prioridade de roadmap.

## 2. Análise SWOT

### 💪 Forças (internas, positivas)
- Diferencial real de **cuidado pastoral** (dashboard + alerta de afastamento).
- **Geolocalização** na presença (ninguém mais tem).
- **MVP já funcionando e validando** numa igreja real (AAVA) — conhecemos a dor de dentro.
- **Simplicidade** e **web sem instalar** (totem/celular/tablet).
- Preço **acessível e transparente**.

### ⚠️ Fraquezas (internas, negativas)
- Marca nova, **sem reputação nem base de clientes**.
- **Equipe pequena** (tempo limitado).
- Ainda no **Google Sheets** — precisa do rebuild multi-tenant para escalar.
- **Faltam recursos** que concorrentes já têm (escala automática, WhatsApp).
- Onboarding/suporte ainda **manual**; orçamento limitado.

### 🚀 Oportunidades (externas, positivas)
- Mercado **enorme** (87–110 mil igrejas; ~17 novas/dia).
- Concorrentes **escondem preço** → transparência como diferencial.
- Maioria foca **logística**, não **cuidado pastoral** → espaço aberto.
- Igrejas pequenas **mal atendidas** (preço/complexidade).
- **Rede de relacionamento** (pastores se indicam) e LGPD valorizando quem cuida de dados.

### 🛑 Ameaças (externas, negativas)
- Concorrente **grátis** (Escala Igreja).
- Players estabelecidos com mais recursos (inChurch, Voluts) podem **copiar** o diferencial.
- **Baixo orçamento** das igrejas / sensibilidade a preço.
- Dependência de plataformas (Google, Supabase, **API do WhatsApp** tem custo/regras).
- Risco de **churn** se o valor não ficar evidente rápido.

## 3. Roadmap priorizado (por lacuna competitiva)

> Ordem pensada para **manter a vantagem** (cuidado pastoral) e **fechar lacunas**
> (paridade) enquanto viramos SaaS.

- **Fase 0 — Vantagem atual (feito ✅):** presença + geolocalização, escala
  manual, cultos, dashboard de frequência, alerta pastoral, "minhas escalas".
- **Fase 1 — Base SaaS:** multi-tenant (1 conta por CNPJ), login por usuário/papel,
  white-label (logo/cores/dias de culto).
- **Fase 2 — Fechar lacunas (paridade):** **notificações WhatsApp** e **escala
  automática por disponibilidade** — onde os concorrentes hoje ganham.
- **Fase 3 — Monetização:** cobrança/assinatura + painel do dono; Google Calendar.
- **Fase 4 — Encantar/reter:** troca de escala entre voluntários, QR rotativo,
  PWA instalável, relatórios avançados de engajamento.

### Princípio de priorização
1. **Não perder o diferencial** (cuidado pastoral) — ele justifica o preço.
2. **Fechar o suficiente das lacunas** para a igreja não dizer "o concorrente tem e vocês não".
3. **Monetizar cedo** com quem já valoriza o diferencial.
