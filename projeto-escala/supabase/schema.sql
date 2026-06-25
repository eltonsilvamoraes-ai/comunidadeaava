-- =====================================================================
-- PROJETO ESCALA — Schema multi-tenant (Supabase / Postgres)
-- Fase 1: fundação (tabelas + isolamento por igreja via RLS + cadastro 1/CNPJ)
--
-- COMO USAR:
--   1. No Supabase, abra "SQL Editor" > "New query".
--   2. Cole TODO este arquivo e clique em "Run".
--   3. Rode também o verificar.sql para conferir que deu tudo certo.
--
-- IDEIA-CHAVE: toda tabela "da igreja" tem a coluna igreja_id.
-- A RLS (Row Level Security) só deixa o usuário ver/alterar linhas da
-- PRÓPRIA igreja. É isso que torna "uma igreja ver a outra" impossível.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) TABELAS
-- ---------------------------------------------------------------------

-- A igreja é a "conta". O CNPJ é único => 1 conta por CNPJ.
create table if not exists public.igrejas (
  id          uuid primary key default gen_random_uuid(),
  cnpj        text unique not null,
  nome        text not null,
  logo_url    text,
  cor         text default '#111111',
  fuso        text default 'America/Sao_Paulo',
  gps_lat     double precision,
  gps_lng     double precision,
  raio_m      integer default 200,
  plano       text not null default 'gratis' check (plano in ('gratis','pro')),
  criada_em   timestamptz not null default now()
);

-- Usuários com login (pastor/admin e líderes). Ligados ao Auth do Supabase.
create table if not exists public.usuarios (
  id          uuid primary key references auth.users(id) on delete cascade,
  igreja_id   uuid not null references public.igrejas(id) on delete cascade,
  nome        text not null,
  email       text,
  papel       text not null default 'lider' check (papel in ('admin','lider')),
  criado_em   timestamptz not null default now()
);

create table if not exists public.departamentos (
  id          uuid primary key default gen_random_uuid(),
  igreja_id   uuid not null references public.igrejas(id) on delete cascade,
  nome        text not null,
  ativo       boolean not null default true,
  unique (igreja_id, nome)
);

create table if not exists public.voluntarios (
  id          uuid primary key default gen_random_uuid(),
  igreja_id   uuid not null references public.igrejas(id) on delete cascade,
  matricula   text,
  nome        text not null,
  status      text not null default 'ativo' check (status in ('ativo','inativo')),
  criado_em   timestamptz not null default now(),
  unique (igreja_id, matricula)
);

-- Ligação N:N — um voluntário em VÁRIOS departamentos (Louvor + Staff).
-- (igreja_id repetido aqui só para deixar a RLS simples e rápida.)
create table if not exists public.voluntario_departamento (
  igreja_id        uuid not null references public.igrejas(id) on delete cascade,
  voluntario_id    uuid not null references public.voluntarios(id) on delete cascade,
  departamento_id  uuid not null references public.departamentos(id) on delete cascade,
  primary key (voluntario_id, departamento_id)
);

create table if not exists public.cultos (
  id          uuid primary key default gen_random_uuid(),
  igreja_id   uuid not null references public.igrejas(id) on delete cascade,
  data        date not null,
  horario     text,
  descricao   text,
  unique (igreja_id, data, horario)
);

-- Uma escala = um culto + um departamento. Os voluntários ficam em escala_itens.
create table if not exists public.escalas (
  id              uuid primary key default gen_random_uuid(),
  igreja_id       uuid not null references public.igrejas(id) on delete cascade,
  culto_id        uuid not null references public.cultos(id) on delete cascade,
  departamento_id uuid not null references public.departamentos(id) on delete cascade,
  criada_em       timestamptz not null default now(),
  unique (culto_id, departamento_id)
);

create table if not exists public.escala_itens (
  escala_id     uuid not null references public.escalas(id) on delete cascade,
  voluntario_id uuid not null references public.voluntarios(id) on delete cascade,
  primary key (escala_id, voluntario_id)
);

-- Log puro de presença (sempre nova linha).
create table if not exists public.registros (
  id            uuid primary key default gen_random_uuid(),
  igreja_id     uuid not null references public.igrejas(id) on delete cascade,
  voluntario_id uuid references public.voluntarios(id) on delete set null,
  data          date not null,
  hora          text,
  escalado      boolean,
  lat           double precision,
  lng           double precision,
  criado_em     timestamptz not null default now()
);

create table if not exists public.assinaturas (
  id          uuid primary key default gen_random_uuid(),
  igreja_id   uuid not null references public.igrejas(id) on delete cascade,
  plano       text not null default 'gratis',
  status      text not null default 'ativa',
  gateway_id  text,
  validade    date,
  criada_em   timestamptz not null default now()
);

-- Índices para deixar as consultas por igreja/data rápidas.
create index if not exists idx_voluntarios_igreja on public.voluntarios (igreja_id);
create index if not exists idx_departamentos_igreja on public.departamentos (igreja_id);
create index if not exists idx_cultos_igreja_data on public.cultos (igreja_id, data);
create index if not exists idx_escalas_igreja on public.escalas (igreja_id);
create index if not exists idx_registros_igreja_data on public.registros (igreja_id, data);
create index if not exists idx_vol_dep_dep on public.voluntario_departamento (departamento_id);

-- ---------------------------------------------------------------------
-- 2) FUNÇÃO AUXILIAR — "qual a igreja do usuário logado?"
--    SECURITY DEFINER: lê a tabela usuarios ignorando a RLS (evita recursão).
-- ---------------------------------------------------------------------
create or replace function public.auth_igreja_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select igreja_id from public.usuarios where id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- 3) LIGA A RLS EM TODAS AS TABELAS
-- ---------------------------------------------------------------------
alter table public.igrejas                 enable row level security;
alter table public.usuarios                enable row level security;
alter table public.departamentos           enable row level security;
alter table public.voluntarios             enable row level security;
alter table public.voluntario_departamento enable row level security;
alter table public.cultos                  enable row level security;
alter table public.escalas                 enable row level security;
alter table public.escala_itens            enable row level security;
alter table public.registros               enable row level security;
alter table public.assinaturas             enable row level security;

-- ---------------------------------------------------------------------
-- 4) POLÍTICAS — só enxerga/altera dados da PRÓPRIA igreja
-- ---------------------------------------------------------------------

-- igrejas: vê/edita só a sua.
create policy tenant_igrejas on public.igrejas
  for all using (id = public.auth_igreja_id())
  with check (id = public.auth_igreja_id());

-- usuarios: vê os usuários da mesma igreja.
create policy tenant_usuarios on public.usuarios
  for all using (igreja_id = public.auth_igreja_id())
  with check (igreja_id = public.auth_igreja_id());

-- Tabelas com coluna igreja_id => regra igualzinha.
create policy tenant_departamentos on public.departamentos
  for all using (igreja_id = public.auth_igreja_id())
  with check (igreja_id = public.auth_igreja_id());

create policy tenant_voluntarios on public.voluntarios
  for all using (igreja_id = public.auth_igreja_id())
  with check (igreja_id = public.auth_igreja_id());

create policy tenant_vol_dep on public.voluntario_departamento
  for all using (igreja_id = public.auth_igreja_id())
  with check (igreja_id = public.auth_igreja_id());

create policy tenant_cultos on public.cultos
  for all using (igreja_id = public.auth_igreja_id())
  with check (igreja_id = public.auth_igreja_id());

create policy tenant_escalas on public.escalas
  for all using (igreja_id = public.auth_igreja_id())
  with check (igreja_id = public.auth_igreja_id());

create policy tenant_registros on public.registros
  for all using (igreja_id = public.auth_igreja_id())
  with check (igreja_id = public.auth_igreja_id());

create policy tenant_assinaturas on public.assinaturas
  for all using (igreja_id = public.auth_igreja_id())
  with check (igreja_id = public.auth_igreja_id());

-- escala_itens não tem igreja_id: validamos pela escala "dona".
create policy tenant_escala_itens on public.escala_itens
  for all using (
    exists (select 1 from public.escalas e
            where e.id = escala_id and e.igreja_id = public.auth_igreja_id())
  )
  with check (
    exists (select 1 from public.escalas e
            where e.id = escala_id and e.igreja_id = public.auth_igreja_id())
  );

-- ---------------------------------------------------------------------
-- 5) CADASTRO DE IGREJA (1 por CNPJ) + cria o admin
--    Chamada pelo app logo após o cadastro do usuário (signup).
-- ---------------------------------------------------------------------
create or replace function public.criar_igreja(
  p_cnpj        text,
  p_nome_igreja text,
  p_nome_admin  text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_igreja_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Precisa estar autenticado para criar uma igreja.';
  end if;

  if exists (select 1 from public.usuarios where id = auth.uid()) then
    raise exception 'Este usuário já pertence a uma igreja.';
  end if;

  if exists (select 1 from public.igrejas where cnpj = p_cnpj) then
    raise exception 'Já existe uma conta para este CNPJ.';
  end if;

  insert into public.igrejas (cnpj, nome)
    values (p_cnpj, p_nome_igreja)
    returning id into v_igreja_id;

  insert into public.usuarios (id, igreja_id, nome, email, papel)
    values (
      auth.uid(), v_igreja_id, p_nome_admin,
      (select email from auth.users where id = auth.uid()),
      'admin'
    );

  return v_igreja_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 6) PERMISSÕES de execução das funções
-- ---------------------------------------------------------------------
grant execute on function public.auth_igreja_id()                to authenticated;
grant execute on function public.criar_igreja(text,text,text)    to authenticated;

-- =====================================================================
-- PRONTO. A fundação está de pé.
-- Próximo (a fazer depois): RPC pública de PRESENÇA do voluntário
-- (sem login) via SECURITY DEFINER, recebendo igreja_id + matrícula.
-- =====================================================================
