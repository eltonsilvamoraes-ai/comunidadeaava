-- =====================================================================
-- PROJETO ESCALA — Migração 03: Cultos fixos por igreja
-- Cada igreja define seus próprios cultos recorrentes (dia da semana +
-- horário + nome). O "gerar mês" usa esta configuração, não dias fixos.
--
-- COMO USAR: cole no SQL Editor do Supabase e clique em Run.
-- =====================================================================

create table if not exists public.cultos_fixos (
  id          uuid primary key default gen_random_uuid(),
  igreja_id   uuid not null references public.igrejas(id) on delete cascade,
  dia_semana  smallint not null check (dia_semana between 0 and 6), -- 0=Dom ... 6=Sáb
  horario     text,
  descricao   text,
  ativo       boolean not null default true
);

create index if not exists idx_cultos_fixos_igreja on public.cultos_fixos (igreja_id);

alter table public.cultos_fixos enable row level security;

drop policy if exists tenant_cultos_fixos on public.cultos_fixos;
create policy tenant_cultos_fixos on public.cultos_fixos
  for all using (igreja_id = public.auth_igreja_id())
  with check (igreja_id = public.auth_igreja_id());
