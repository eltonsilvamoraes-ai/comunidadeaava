-- =====================================================================
-- PROJETO ESCALA — Migração 11: corrige RECURSÃO INFINITA em RLS
--
-- Sintoma: "infinite recursion detected in policy for relation
--           'voluntarios'" ao importar/ler voluntários.
--
-- Causa: as políticas de 'voluntarios' e 'voluntario_departamento'
--        (migração 08) se consultavam mutuamente -> loop.
--
-- Solução (padrão Supabase): mover as consultas cruzadas para funções
-- SECURITY DEFINER, que rodam sem reaplicar RLS e, portanto, não recursam.
--
-- Idempotente. Cole no SQL Editor e clique em Run.
-- =====================================================================

-- 1) Helpers SECURITY DEFINER (não disparam RLS -> sem recursão) ----------

-- Este voluntário pertence a algum departamento que EU (líder) gerencio?
create or replace function public.voluntario_nos_meus_deps(p_vol uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from voluntario_departamento vd
    where vd.voluntario_id = p_vol
      and vd.departamento_id in (select public.auth_meus_deps())
  );
$$;
grant execute on function public.voluntario_nos_meus_deps(uuid) to authenticated;

-- Este voluntário é a MINHA própria ficha (login vinculado)?
create or replace function public.voluntario_e_meu(p_vol uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from voluntarios v where v.id = p_vol and v.usuario_id = auth.uid()
  );
$$;
grant execute on function public.voluntario_e_meu(uuid) to authenticated;

-- 2) Recria as políticas que se cruzavam, agora usando os helpers --------

-- VOLUNTÁRIOS: seleção
drop policy if exists vol_sel on public.voluntarios;
create policy vol_sel on public.voluntarios for select using (
  igreja_id = public.auth_igreja_id() and (
    public.auth_papel() = 'admin'
    or usuario_id = auth.uid()
    or (public.auth_papel() = 'lider' and public.voluntario_nos_meus_deps(id))
  ));

-- VOLUNTÁRIOS: edição (admin, ou líder do departamento do voluntário)
drop policy if exists vol_upd on public.voluntarios;
create policy vol_upd on public.voluntarios for update using (
  igreja_id = public.auth_igreja_id() and (
    public.auth_papel() = 'admin'
    or (public.auth_papel() = 'lider' and public.voluntario_nos_meus_deps(id))
  )) with check (igreja_id = public.auth_igreja_id() and public.auth_papel() in ('admin','lider'));

-- VOLUNTÁRIO ↔ DEPARTAMENTO: seleção
drop policy if exists vd_sel on public.voluntario_departamento;
create policy vd_sel on public.voluntario_departamento for select using (
  igreja_id = public.auth_igreja_id() and (
    public.auth_papel() = 'admin'
    or departamento_id in (select public.auth_meus_deps())
    or public.voluntario_e_meu(voluntario_id)
  ));

-- REGISTROS (legado): seleção
drop policy if exists reg_sel on public.registros;
create policy reg_sel on public.registros for select using (
  igreja_id = public.auth_igreja_id() and (
    public.auth_papel() = 'admin'
    or public.voluntario_e_meu(voluntario_id)
    or (public.auth_papel() = 'lider' and public.voluntario_nos_meus_deps(voluntario_id))
  ));

-- ESCALA_ITENS: seleção (pela escala em escopo OU se é a minha ficha)
drop policy if exists ei_sel on public.escala_itens;
create policy ei_sel on public.escala_itens for select using (
  exists (
    select 1 from public.escalas e
    where e.id = escala_id and e.igreja_id = public.auth_igreja_id()
      and (public.auth_papel() = 'admin'
           or (public.auth_papel() = 'lider' and e.departamento_id in (select public.auth_meus_deps())))
  )
  or public.voluntario_e_meu(voluntario_id)
);

-- =====================================================================
-- PRONTO. A importação e a leitura de voluntários voltam a funcionar,
-- mantendo o escopo por papel (admin vê tudo; líder só a sua equipe).
-- =====================================================================
