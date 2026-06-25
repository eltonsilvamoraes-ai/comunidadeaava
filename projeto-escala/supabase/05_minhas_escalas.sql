-- =====================================================================
-- PROJETO ESCALA — Migração 05: Área do voluntário (consultar escalas)
-- O voluntário (sem login) informa igreja + matrícula e vê as escalas
-- futuras dele. Função pública (SECURITY DEFINER), liberada para "anon".
--
-- COMO USAR: cole no SQL Editor do Supabase e clique em Run.
-- =====================================================================

create or replace function public.minhas_escalas(
  p_igreja_id uuid,
  p_matricula text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vol  record;
  v_fuso text;
  v_hoje date;
  v_res  json;
begin
  select * into v_vol from voluntarios
    where igreja_id = p_igreja_id and matricula = trim(p_matricula)
    limit 1;
  if v_vol is null then
    return json_build_object('ok', false, 'erro', 'Código não encontrado. Confira com a liderança.');
  end if;

  select coalesce(fuso, 'America/Sao_Paulo') into v_fuso from igrejas where id = p_igreja_id;
  v_hoje := (now() at time zone v_fuso)::date;

  select coalesce(json_agg(t order by t.data, t.horario), '[]'::json) into v_res
  from (
    select c.data, c.horario, c.descricao, d.nome as departamento
    from escala_itens ei
    join escalas e        on e.id = ei.escala_id
    join cultos  c        on c.id = e.culto_id
    join departamentos d  on d.id = e.departamento_id
    where ei.voluntario_id = v_vol.id
      and c.igreja_id = p_igreja_id
      and c.data >= v_hoje
  ) t;

  return json_build_object('ok', true, 'nome', v_vol.nome, 'escalas', v_res);
end;
$$;

grant execute on function public.minhas_escalas(uuid, text) to anon, authenticated;
