-- =====================================================================
-- PROJETO ESCALA — Migração 10: CHECK-IN por escala
--
-- Mudança de conceito (decisão de alinhamento):
--   • "Presença" passa a se chamar CHECK-IN.
--   • O CHECK-IN é feito pelo LÍDER, sobre a ESCALA (quem serviu de fato),
--     e não pelo voluntário. Isso evita "controle de ponto" (risco de
--     vínculo trabalhista) e amarra o dado ao serviço combinado.
--   • Métrica passa a ser ESCALADO × COMPARECEU (não mais presença solta).
--
-- Implementação: cada linha de escala_itens (um voluntário escalado num
-- culto/departamento) ganha o marcador "compareceu".
--
-- Segurança: NÃO precisa de política nova. A migração 08 já criou a
-- política ei_mut em escala_itens (admin, ou líder do departamento da
-- escala) — então o líder já pode marcar o check-in da sua equipe.
--
-- COMO USAR: cole no SQL Editor do Supabase e clique em Run. Idempotente.
-- =====================================================================

alter table public.escala_itens add column if not exists compareceu boolean not null default false;
alter table public.escala_itens add column if not exists checkin_em  timestamptz;

-- =====================================================================
-- PRONTO. A tabela "registros" (antigo log de presença) deixa de ser
-- usada pelos dashboards — fica preservada, sem uso, para não perder nada.
-- =====================================================================
