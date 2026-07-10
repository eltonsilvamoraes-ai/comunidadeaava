-- =====================================================================
-- DIAKUN — Migração 13: relatório do próprio voluntário
--
-- O voluntário logado vê os PRÓPRIOS números de comparecimento (escalas
-- que assumiu × quantas compareceu) e o histórico. Como a RLS impede o
-- voluntário de ler cultos/escalas diretamente, usamos uma função
-- SECURITY DEFINER (igual ao minhas_escalas_eu).
--
-- Base: escala_itens.compareceu (o check-in feito pelo líder), apenas de
-- cultos já ocorridos (data <= hoje).
--
-- Idempotente. Cole no SQL Editor e clique em Run.
-- =====================================================================

create or replace function public.meu_relatorio_eu()
returns json language plpgsql security definer set search_path = public
as $$
declare
  v_vol   record;
  v_esc   int;
  v_comp  int;
  v_hist  json;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'erro', 'Precisa estar autenticado.');
  end if;

  select v.id, v.nome, i.nome as igreja
    into v_vol
    from voluntarios v
    join igrejas i on i.id = v.igreja_id
    where v.usuario_id = auth.uid()
    limit 1;

  if v_vol is null then
    return json_build_object('ok', false, 'erro', 'Conta sem voluntário vinculado.');
  end if;

  -- totais (escalas passadas que o voluntário assumiu)
  select coalesce(count(*), 0),
         coalesce(sum(case when ei.compareceu then 1 else 0 end), 0)
    into v_esc, v_comp
    from escala_itens ei
    join escalas e on e.id = ei.escala_id
    join cultos  c on c.id = e.culto_id
   where ei.voluntario_id = v_vol.id
     and c.data <= current_date;

  -- histórico detalhado (últimos 40)
  select coalesce(json_agg(t), '[]'::json)
    into v_hist
    from (
      select c.data, c.descricao, d.nome as departamento, ei.compareceu
        from escala_itens ei
        join escalas e on e.id = ei.escala_id
        join cultos  c on c.id = e.culto_id
        join departamentos d on d.id = e.departamento_id
       where ei.voluntario_id = v_vol.id
         and c.data <= current_date
       order by c.data desc
       limit 40
    ) t;

  return json_build_object(
    'ok', true,
    'nome', v_vol.nome,
    'igreja', v_vol.igreja,
    'escalado', v_esc,
    'compareceu', v_comp,
    'faltas', greatest(v_esc - v_comp, 0),
    'pct', case when v_esc > 0 then round(v_comp::numeric / v_esc * 100, 1) else 0 end,
    'historico', v_hist
  );
end; $$;

grant execute on function public.meu_relatorio_eu() to authenticated;

-- =====================================================================
-- PRONTO. A Área do Voluntário passa a mostrar "Meu comparecimento".
-- =====================================================================
