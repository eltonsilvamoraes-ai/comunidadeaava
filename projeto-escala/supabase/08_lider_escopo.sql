-- =====================================================================
-- PROJETO ESCALA — Migração 08: escopo do LÍDER por departamento
--
-- Antes (migração 06): líder via a igreja inteira (como o admin).
-- Agora: líder enxerga/gerencia apenas o(s) DEPARTAMENTO(S) dele.
--   admin       -> igreja inteira
--   lider       -> só seus departamentos (escala, voluntários, dashboard)
--   voluntario  -> só os próprios dados
--   kiosk       -> só inserir presença
--
-- Idempotente (pode rodar de novo). Cole no SQL Editor e Run.
-- =====================================================================

-- Departamentos que o líder logado gerencia.
create or replace function public.auth_meus_deps()
returns setof uuid language sql stable security definer set search_path = public
as $$ select departamento_id from public.usuario_departamento where usuario_id = auth.uid() $$;
grant execute on function public.auth_meus_deps() to authenticated;

-- ---- Remove as políticas anteriores (06) e as desta migração (idempotência) ----
do $$
declare p record;
begin
  for p in
    select policyname, tablename from pg_policies
    where schemaname='public' and tablename in
      ('departamentos','cultos','cultos_fixos','escalas','assinaturas',
       'usuario_departamento','voluntarios','voluntario_departamento','registros','escala_itens')
  loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- ---------- DEPARTAMENTOS ----------
create policy dep_sel on public.departamentos for select using (
  igreja_id = public.auth_igreja_id() and (
    public.auth_papel() = 'admin'
    or (public.auth_papel() = 'lider' and id in (select public.auth_meus_deps()))
  ));
create policy dep_ins on public.departamentos for insert with check (igreja_id = public.auth_igreja_id() and public.auth_papel() = 'admin');
create policy dep_upd on public.departamentos for update using (igreja_id = public.auth_igreja_id() and public.auth_papel() = 'admin') with check (igreja_id = public.auth_igreja_id() and public.auth_papel() = 'admin');
create policy dep_del on public.departamentos for delete using (igreja_id = public.auth_igreja_id() and public.auth_papel() = 'admin');

-- ---------- CULTOS (líder lê; admin gerencia) ----------
create policy cul_sel on public.cultos for select using (igreja_id = public.auth_igreja_id() and public.auth_papel() in ('admin','lider'));
create policy cul_ins on public.cultos for insert with check (igreja_id = public.auth_igreja_id() and public.auth_papel() = 'admin');
create policy cul_upd on public.cultos for update using (igreja_id = public.auth_igreja_id() and public.auth_papel() = 'admin') with check (igreja_id = public.auth_igreja_id() and public.auth_papel() = 'admin');
create policy cul_del on public.cultos for delete using (igreja_id = public.auth_igreja_id() and public.auth_papel() = 'admin');

-- ---------- CULTOS FIXOS / ASSINATURAS / USUARIO_DEPARTAMENTO (admin) ----------
create policy cf_all on public.cultos_fixos for all using (igreja_id = public.auth_igreja_id() and public.auth_papel() = 'admin') with check (igreja_id = public.auth_igreja_id() and public.auth_papel() = 'admin');
create policy ass_all on public.assinaturas for all using (igreja_id = public.auth_igreja_id() and public.auth_papel() = 'admin') with check (igreja_id = public.auth_igreja_id() and public.auth_papel() = 'admin');
create policy ud_sel on public.usuario_departamento for select using (igreja_id = public.auth_igreja_id() and (public.auth_papel() = 'admin' or usuario_id = auth.uid()));
create policy ud_mut on public.usuario_departamento for all using (igreja_id = public.auth_igreja_id() and public.auth_papel() = 'admin') with check (igreja_id = public.auth_igreja_id() and public.auth_papel() = 'admin');

-- ---------- ESCALAS (admin: igreja; líder: seus deptos) ----------
create policy esc_all on public.escalas for all using (
  igreja_id = public.auth_igreja_id() and (
    public.auth_papel() = 'admin'
    or (public.auth_papel() = 'lider' and departamento_id in (select public.auth_meus_deps()))
  )) with check (
  igreja_id = public.auth_igreja_id() and (
    public.auth_papel() = 'admin'
    or (public.auth_papel() = 'lider' and departamento_id in (select public.auth_meus_deps()))
  ));

-- ---------- VOLUNTÁRIOS ----------
create policy vol_sel on public.voluntarios for select using (
  igreja_id = public.auth_igreja_id() and (
    public.auth_papel() = 'admin'
    or usuario_id = auth.uid()
    or (public.auth_papel() = 'lider' and exists (
        select 1 from public.voluntario_departamento vd
        where vd.voluntario_id = voluntarios.id and vd.departamento_id in (select public.auth_meus_deps())))
  ));
create policy vol_ins on public.voluntarios for insert with check (igreja_id = public.auth_igreja_id() and public.auth_papel() in ('admin','lider'));
create policy vol_upd on public.voluntarios for update using (
  igreja_id = public.auth_igreja_id() and (
    public.auth_papel() = 'admin'
    or (public.auth_papel() = 'lider' and exists (
        select 1 from public.voluntario_departamento vd
        where vd.voluntario_id = voluntarios.id and vd.departamento_id in (select public.auth_meus_deps())))
  )) with check (igreja_id = public.auth_igreja_id() and public.auth_papel() in ('admin','lider'));
create policy vol_del on public.voluntarios for delete using (igreja_id = public.auth_igreja_id() and public.auth_papel() = 'admin');

-- ---------- VOLUNTÁRIO ↔ DEPARTAMENTO ----------
create policy vd_sel on public.voluntario_departamento for select using (
  igreja_id = public.auth_igreja_id() and (
    public.auth_papel() = 'admin'
    or departamento_id in (select public.auth_meus_deps())
    or exists (select 1 from public.voluntarios v where v.id = voluntario_id and v.usuario_id = auth.uid())
  ));
create policy vd_mut on public.voluntario_departamento for all using (
  igreja_id = public.auth_igreja_id() and (public.auth_papel() = 'admin' or departamento_id in (select public.auth_meus_deps()))
  ) with check (
  igreja_id = public.auth_igreja_id() and (public.auth_papel() = 'admin' or departamento_id in (select public.auth_meus_deps()))
  );

-- ---------- REGISTROS (presença) ----------
create policy reg_sel on public.registros for select using (
  igreja_id = public.auth_igreja_id() and (
    public.auth_papel() = 'admin'
    or exists (select 1 from public.voluntarios v where v.id = voluntario_id and v.usuario_id = auth.uid())
    or (public.auth_papel() = 'lider' and exists (
        select 1 from public.voluntario_departamento vd
        where vd.voluntario_id = registros.voluntario_id and vd.departamento_id in (select public.auth_meus_deps())))
  ));
create policy reg_ins on public.registros for insert with check (igreja_id = public.auth_igreja_id() and public.auth_papel() in ('admin','lider','kiosk'));

-- ---------- ESCALA_ITENS (pela escala em escopo) ----------
create policy ei_sel on public.escala_itens for select using (
  exists (select 1 from public.escalas e where e.id = escala_id and e.igreja_id = public.auth_igreja_id()
          and (public.auth_papel() = 'admin' or (public.auth_papel() = 'lider' and e.departamento_id in (select public.auth_meus_deps()))))
  or exists (select 1 from public.voluntarios v where v.id = voluntario_id and v.usuario_id = auth.uid())
);
create policy ei_mut on public.escala_itens for all using (
  exists (select 1 from public.escalas e where e.id = escala_id and e.igreja_id = public.auth_igreja_id()
          and (public.auth_papel() = 'admin' or (public.auth_papel() = 'lider' and e.departamento_id in (select public.auth_meus_deps()))))
  ) with check (
  exists (select 1 from public.escalas e where e.id = escala_id and e.igreja_id = public.auth_igreja_id()
          and (public.auth_papel() = 'admin' or (public.auth_papel() = 'lider' and e.departamento_id in (select public.auth_meus_deps()))))
  );

-- =====================================================================
-- PRONTO. Rode o teste abaixo (09_teste_lider.sql) para virar líder e testar.
-- Se o ADMIN parar de ver tudo, me avise: revertemos re-rodando o 06_acesso.sql.
-- =====================================================================
