-- =====================================================================
-- DIAKUN — Migração 14: cadastro da igreja mais completo
--
-- A aba "Criar conta" passa a coletar: nome da igreja, CNPJ, endereço,
-- cidade/estado, número de voluntários, e-mail e senha.
--
-- Adiciona colunas na tabela igrejas e amplia a função criar_igreja.
-- Idempotente. Cole no SQL Editor e Run.
-- =====================================================================

alter table public.igrejas add column if not exists endereco        text;
alter table public.igrejas add column if not exists cidade          text;
alter table public.igrejas add column if not exists estado          text;
alter table public.igrejas add column if not exists num_voluntarios int;

-- substitui a função antiga (3 args) pela versão ampliada (com defaults).
drop function if exists public.criar_igreja(text, text, text);

create or replace function public.criar_igreja(
  p_cnpj            text,
  p_nome_igreja     text,
  p_nome_admin      text,
  p_endereco        text default null,
  p_cidade          text default null,
  p_estado          text default null,
  p_num_voluntarios int  default null
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_igreja_id uuid;
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

  insert into public.igrejas (cnpj, nome, endereco, cidade, estado, num_voluntarios)
    values (p_cnpj, p_nome_igreja, p_endereco, p_cidade, p_estado, p_num_voluntarios)
    returning id into v_igreja_id;

  insert into public.usuarios (id, igreja_id, nome, email, papel)
    values (auth.uid(), v_igreja_id, p_nome_admin,
            (select email from auth.users where id = auth.uid()), 'admin');

  return v_igreja_id;
end; $$;

grant execute on function public.criar_igreja(text,text,text,text,text,text,int) to authenticated;

-- =====================================================================
-- PRONTO.
-- =====================================================================
