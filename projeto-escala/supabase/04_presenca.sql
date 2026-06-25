-- =====================================================================
-- PROJETO ESCALA — Migração 04: Presença do voluntário (sem login)
-- O voluntário NÃO tem conta. Esta função pública recebe a igreja + a
-- matrícula, valida (existe? ativo? está na igreja pelo GPS?), grava o
-- registro e diz se a pessoa estava escalada hoje.
--
-- Segurança: SECURITY DEFINER (roda com privilégio, ignorando a RLS) mas
-- SÓ mexe na igreja informada. Liberada para o papel "anon" (visitante).
--
-- COMO USAR: cole no SQL Editor do Supabase e clique em Run.
-- =====================================================================

create or replace function public.registrar_presenca(
  p_igreja_id uuid,
  p_matricula text,
  p_lat double precision default null,
  p_lng double precision default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ig     record;
  v_vol    record;
  v_fuso   text;
  v_hoje   date;
  v_hora   text;
  v_dist   double precision;
  v_escalado boolean := false;
  v_total  int;
begin
  select * into v_ig from igrejas where id = p_igreja_id;
  if v_ig is null then
    return json_build_object('ok', false, 'erro', 'Igreja não encontrada.');
  end if;

  v_fuso := coalesce(v_ig.fuso, 'America/Sao_Paulo');
  v_hoje := (now() at time zone v_fuso)::date;
  v_hora := to_char(now() at time zone v_fuso, 'HH24:MI');

  select * into v_vol from voluntarios
    where igreja_id = p_igreja_id and matricula = trim(p_matricula)
    limit 1;
  if v_vol is null then
    return json_build_object('ok', false, 'erro', 'Código não encontrado. Confira com a liderança.');
  end if;
  if v_vol.status = 'inativo' then
    return json_build_object('ok', false, 'erro', 'Cadastro inativo. Procure a liderança.');
  end if;

  -- Restrição de localização (só se a igreja tiver coordenadas configuradas).
  if v_ig.gps_lat is not null and v_ig.gps_lng is not null then
    if p_lat is null or p_lng is null then
      return json_build_object('ok', false, 'erro', 'Ative a localização do celular para registrar na igreja.');
    end if;
    v_dist := 2 * 6371000 * asin(sqrt(
      power(sin(radians(p_lat - v_ig.gps_lat) / 2), 2) +
      cos(radians(v_ig.gps_lat)) * cos(radians(p_lat)) *
      power(sin(radians(p_lng - v_ig.gps_lng) / 2), 2)
    ));
    if v_dist > coalesce(v_ig.raio_m, 200) then
      return json_build_object('ok', false, 'erro', 'Você precisa estar na igreja para registrar a presença.');
    end if;
  end if;

  -- Estava escalado hoje? (em qualquer culto/departamento do dia)
  select exists(
    select 1 from escala_itens ei
    join escalas e on e.id = ei.escala_id
    join cultos  c on c.id = e.culto_id
    where ei.voluntario_id = v_vol.id and c.igreja_id = p_igreja_id and c.data = v_hoje
  ) into v_escalado;

  insert into registros (igreja_id, voluntario_id, data, hora, escalado, lat, lng)
    values (p_igreja_id, v_vol.id, v_hoje, v_hora, v_escalado, p_lat, p_lng);

  select count(*) into v_total from registros where voluntario_id = v_vol.id;

  return json_build_object('ok', true, 'nome', v_vol.nome,
                           'escalado', v_escalado, 'total', v_total);
end;
$$;

grant execute on function public.registrar_presenca(uuid, text, double precision, double precision)
  to anon, authenticated;
