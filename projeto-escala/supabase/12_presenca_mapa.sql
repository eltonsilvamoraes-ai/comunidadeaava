-- =====================================================================
-- PROJETO ESCALA — Migração 12: Mapa de presença (TESTE)
--
-- Objetivo: permitir que o LÍDER registre quem ESTEVE no culto, mesmo
-- sem estar na escala. Usa a tabela 'registros' (log de presença).
--
-- ⚠️ Observação de negócio: registrar presença de não-escalados é o ponto
-- que levantamos como risco (controle de ponto / vínculo). Esta migração
-- existe para TESTES; reavaliar antes de virar recurso oficial.
--
-- O que muda:
--   • registros.culto_id  -> amarra a presença ao culto (não só à data)
--   • política reg_del     -> líder/admin podem REMOVER presença (desmarcar)
--
-- Idempotente. Cole no SQL Editor e clique em Run.
-- =====================================================================

alter table public.registros
  add column if not exists culto_id uuid references public.cultos(id) on delete cascade;

create index if not exists idx_registros_culto on public.registros (culto_id);

-- excluir presença: admin (igreja) ou líder do departamento do voluntário.
drop policy if exists reg_del on public.registros;
create policy reg_del on public.registros for delete using (
  igreja_id = public.auth_igreja_id() and (
    public.auth_papel() = 'admin'
    or (public.auth_papel() = 'lider' and public.voluntario_nos_meus_deps(voluntario_id))
  ));

-- =====================================================================
-- PRONTO. (reg_sel e reg_ins já existem das migrações 08/11.)
-- =====================================================================
