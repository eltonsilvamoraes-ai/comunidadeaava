-- =====================================================================
-- PROJETO ESCALA — Migração 07: escala do voluntário LOGADO
-- Usa o login (auth.uid) para achar a ficha do voluntário e devolver as
-- escalas futuras dele — sem precisar digitar o código.
-- COMO USAR: cole no SQL Editor do Supabase e clique em Run.
-- =====================================================================

create or replace function public.minhas_escalas_eu()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vol    record;
  v_fuso   text;
  v_hoje   date;
  v_igreja text;
  v_res    json;
begin
  select * into v_vol from voluntarios where usuario_id = auth.uid() limit 1;
  if v_vol is null then
    return json_build_object('ok', false, 'erro', 'Sua conta ainda não está vinculada a um voluntário.');
  end if;

  select coalesce(fuso, 'America/Sao_Paulo'), nome into v_fuso, v_igreja from igrejas where id = v_vol.igreja_id;
  v_hoje := (now() at time zone v_fuso)::date;

  select coalesce(json_agg(t order by t.data, t.horario), '[]'::json) into v_res
  from (
    select c.data, c.horario, c.descricao, d.nome as departamento
    from escala_itens ei
    join escalas e        on e.id = ei.escala_id
    join cultos  c        on c.id = e.culto_id
    join departamentos d  on d.id = e.departamento_id
    where ei.voluntario_id = v_vol.id and c.data >= v_hoje
  ) t;

  return json_build_object('ok', true, 'nome', v_vol.nome, 'igreja', v_igreja, 'escalas', v_res);
end;
$$;

grant execute on function public.minhas_escalas_eu() to authenticated;
