-- =====================================================================
-- PROJETO ESCALA — Migração 06: Fundação de ACESSO (papéis + RLS por papel)
--
-- O que muda:
--   • Papéis: admin, lider, voluntario, kiosk
--   • usuarios.ativo (líder nasce inativo até o Admin autorizar)
--   • voluntarios.usuario_id (liga o login à ficha do voluntário)
--   • voluntario_departamento.aprovado (líder aprova → voluntário ativo no depto)
--   • usuario_departamento (líder ↔ departamentos que ele gerencia)
--   • RLS POR PAPEL: admin/líder (igreja), voluntário (só o seu), kiosk (presença)
--   • RPCs: reivindicar_voluntario(), cadastrar_lider()
--
-- ⚠️ Esta migração REESCREVE as políticas de segurança. Rode o
--    verificar_acesso.sql depois e teste o login do Admin (deve ver tudo).
-- COMO USAR: cole no SQL Editor do Supabase e clique em Run.
-- =====================================================================

/* ---------- 1) Colunas e tabelas novas ---------- */

-- Papéis: troca o CHECK para incluir voluntario e kiosk.
alter table public.usuarios drop constraint if exists usuarios_papel_check;
alter table public.usuarios add constraint usuarios_papel_check
  check (papel in ('admin','lider','voluntario','kiosk'));

-- ativo: líder via link nasce inativo; demais ativos.
alter table public.usuarios add column if not exists ativo boolean not null default true;

-- liga o login (auth) à ficha do voluntário.
alter table public.voluntarios add column if not exists usuario_id uuid references auth.users(id) on delete set null;
create unique index if not exists uq_voluntarios_usuario on public.voluntarios (usuario_id) where usuario_id is not null;

-- aprovação do vínculo voluntário↔departamento.
-- Default TRUE: o que o ADMIN cria/importa já entra aprovado.
-- O pedido self-service do voluntário (Passo 4) gravará aprovado=false explicitamente.
alter table public.voluntario_departamento add column if not exists aprovado boolean not null default true;

-- líderes ↔ departamentos que gerenciam.
create table if not exists public.usuario_departamento (
  igreja_id       uuid not null references public.igrejas(id) on delete cascade,
  usuario_id      uuid not null references public.usuarios(id) on delete cascade,
  departamento_id uuid not null references public.departamentos(id) on delete cascade,
  primary key (usuario_id, departamento_id)
);
alter table public.usuario_departamento enable row level security;

/* ---------- 2) Função auxiliar: papel do usuário logado ----------
   Se a conta estiver INATIVA (ex.: líder aguardando autorização do Admin),
   retorna 'pendente' -> as políticas não concedem acesso até ser ativado.   */
create or replace function public.auth_papel()
returns text language sql stable security definer set search_path = public
as $$ select case when ativo then papel else 'pendente' end from public.usuarios where id = auth.uid() $$;
grant execute on function public.auth_papel() to authenticated;

/* ---------- 3) RLS POR PAPEL (reescreve as políticas) ----------
   Regra geral:
     admin/líder  -> dados da própria igreja
     voluntário   -> apenas os próprios dados
     kiosk        -> apenas inserir presença da própria igreja
   (Escopo do líder por departamento será refinado no Passo 3.)            */

-- igrejas: ler = membros da igreja; editar = só admin.
drop policy if exists tenant_igrejas on public.igrejas;
create policy igrejas_sel on public.igrejas for select using (id = public.auth_igreja_id());
create policy igrejas_upd on public.igrejas for update using (id = public.auth_igreja_id() and public.auth_papel() = 'admin')
  with check (id = public.auth_igreja_id() and public.auth_papel() = 'admin');

-- usuarios: admin/líder veem a igreja; cada um vê a si mesmo.
drop policy if exists tenant_usuarios on public.usuarios;
create policy usuarios_sel on public.usuarios for select
  using (igreja_id = public.auth_igreja_id() and (public.auth_papel() in ('admin','lider') or id = auth.uid()));
create policy usuarios_upd on public.usuarios for update
  using (igreja_id = public.auth_igreja_id() and (public.auth_papel() = 'admin' or id = auth.uid()))
  with check (igreja_id = public.auth_igreja_id() and (public.auth_papel() = 'admin' or id = auth.uid()));

-- Tabelas de gestão (só admin/líder da igreja):
do $$
declare t text;
begin
  foreach t in array array['departamentos','cultos','cultos_fixos','escalas','assinaturas','usuario_departamento']
  loop
    execute format('drop policy if exists tenant_%1$s on public.%1$s', t);
    execute format('drop policy if exists gestao_%1$s on public.%1$s', t);
    execute format($f$create policy gestao_%1$s on public.%1$s for all
      using (igreja_id = public.auth_igreja_id() and public.auth_papel() in ('admin','lider'))
      with check (igreja_id = public.auth_igreja_id() and public.auth_papel() in ('admin','lider'))$f$, t);
  end loop;
end $$;

-- voluntarios: admin/líder (igreja) OU o próprio voluntário (sua ficha).
drop policy if exists tenant_voluntarios on public.voluntarios;
create policy voluntarios_sel on public.voluntarios for select
  using (igreja_id = public.auth_igreja_id()
         and (public.auth_papel() in ('admin','lider') or usuario_id = auth.uid()));
create policy voluntarios_mut on public.voluntarios for all
  using (igreja_id = public.auth_igreja_id() and public.auth_papel() in ('admin','lider'))
  with check (igreja_id = public.auth_igreja_id() and public.auth_papel() in ('admin','lider'));

-- voluntario_departamento: admin/líder (igreja) OU o próprio voluntário (vê o seu).
drop policy if exists tenant_vol_dep on public.voluntario_departamento;
create policy voldep_sel on public.voluntario_departamento for select
  using (igreja_id = public.auth_igreja_id()
         and (public.auth_papel() in ('admin','lider')
              or exists (select 1 from public.voluntarios v where v.id = voluntario_id and v.usuario_id = auth.uid())));
create policy voldep_mut on public.voluntario_departamento for all
  using (igreja_id = public.auth_igreja_id() and public.auth_papel() in ('admin','lider'))
  with check (igreja_id = public.auth_igreja_id() and public.auth_papel() in ('admin','lider'));

-- registros: admin/líder (igreja) OU o próprio voluntário; kiosk pode inserir.
drop policy if exists tenant_registros on public.registros;
create policy registros_sel on public.registros for select
  using (igreja_id = public.auth_igreja_id()
         and (public.auth_papel() in ('admin','lider')
              or exists (select 1 from public.voluntarios v where v.id = voluntario_id and v.usuario_id = auth.uid())));
create policy registros_ins on public.registros for insert
  with check (igreja_id = public.auth_igreja_id() and public.auth_papel() in ('admin','lider','kiosk'));

-- escala_itens: pela escala (igreja); voluntário vê os seus.
drop policy if exists tenant_escala_itens on public.escala_itens;
create policy escitens_sel on public.escala_itens for select
  using (exists (select 1 from public.escalas e where e.id = escala_id and e.igreja_id = public.auth_igreja_id())
         and (public.auth_papel() in ('admin','lider')
              or exists (select 1 from public.voluntarios v where v.id = voluntario_id and v.usuario_id = auth.uid())));
create policy escitens_mut on public.escala_itens for all
  using (exists (select 1 from public.escalas e where e.id = escala_id and e.igreja_id = public.auth_igreja_id()) and public.auth_papel() in ('admin','lider'))
  with check (exists (select 1 from public.escalas e where e.id = escala_id and e.igreja_id = public.auth_igreja_id()) and public.auth_papel() in ('admin','lider'));

/* ---------- 4) RPCs de cadastro (rodam após o signup do Auth) ---------- */

-- Voluntário reivindica a ficha já existente (importada), pelo Código.
create or replace function public.reivindicar_voluntario(p_igreja_id uuid, p_codigo text)
returns json language plpgsql security definer set search_path = public
as $$
declare v_vol record;
begin
  if auth.uid() is null then return json_build_object('ok', false, 'erro', 'Precisa estar autenticado.'); end if;
  if exists (select 1 from usuarios where id = auth.uid()) then
    return json_build_object('ok', false, 'erro', 'Esta conta já está vinculada.');
  end if;
  select * into v_vol from voluntarios
    where igreja_id = p_igreja_id and matricula = trim(p_codigo) limit 1;
  if v_vol is null then return json_build_object('ok', false, 'erro', 'Código não encontrado nesta igreja.'); end if;
  if v_vol.usuario_id is not null then return json_build_object('ok', false, 'erro', 'Este código já tem login.'); end if;

  insert into usuarios (id, igreja_id, nome, email, papel, ativo)
    values (auth.uid(), p_igreja_id, v_vol.nome,
            (select email from auth.users where id = auth.uid()), 'voluntario', true);
  update voluntarios set usuario_id = auth.uid() where id = v_vol.id;
  return json_build_object('ok', true, 'nome', v_vol.nome);
end; $$;
grant execute on function public.reivindicar_voluntario(uuid, text) to authenticated;

-- Líder se cadastra (fica INATIVO até o Admin autorizar).
create or replace function public.cadastrar_lider(p_igreja_id uuid, p_nome text)
returns json language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then return json_build_object('ok', false, 'erro', 'Precisa estar autenticado.'); end if;
  if exists (select 1 from usuarios where id = auth.uid()) then
    return json_build_object('ok', false, 'erro', 'Esta conta já está vinculada.');
  end if;
  if not exists (select 1 from igrejas where id = p_igreja_id) then
    return json_build_object('ok', false, 'erro', 'Igreja não encontrada.');
  end if;
  insert into usuarios (id, igreja_id, nome, email, papel, ativo)
    values (auth.uid(), p_igreja_id, trim(p_nome),
            (select email from auth.users where id = auth.uid()), 'lider', false);
  return json_build_object('ok', true, 'pendente', true);
end; $$;
grant execute on function public.cadastrar_lider(uuid, text) to authenticated;

-- =====================================================================
-- PRONTO. Rode verificar_acesso.sql e teste o login do Admin.
-- =====================================================================
