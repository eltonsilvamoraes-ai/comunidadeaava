-- =====================================================================
-- PROJETO ESCALA — Verificação da migração 06 (Acesso)
-- Rode DEPOIS do 06_acesso.sql. Confere colunas, tabela, funções e políticas.
-- (Consulta única com UNION — o editor só mostra a última.)
-- =====================================================================

select 'COLUNA' as tipo, 'usuarios.ativo' as nome,
       case when exists (select 1 from information_schema.columns where table_schema='public' and table_name='usuarios' and column_name='ativo') then 'ok' else 'FALTA' end as detalhe
union all
select 'COLUNA', 'voluntarios.usuario_id',
       case when exists (select 1 from information_schema.columns where table_schema='public' and table_name='voluntarios' and column_name='usuario_id') then 'ok' else 'FALTA' end
union all
select 'COLUNA', 'voluntario_departamento.aprovado',
       case when exists (select 1 from information_schema.columns where table_schema='public' and table_name='voluntario_departamento' and column_name='aprovado') then 'ok' else 'FALTA' end
union all
select 'TABELA', 'usuario_departamento',
       case when exists (select 1 from pg_tables where schemaname='public' and tablename='usuario_departamento') then 'ok' else 'FALTA' end
union all
select 'FUNCAO', proname, 'ok' from pg_proc
  where proname in ('auth_papel','reivindicar_voluntario','cadastrar_lider')
union all
select 'POLITICA', tablename || ' · ' || policyname, cmd
  from pg_policies where schemaname='public'
order by tipo, nome;

-- =====================================================================
-- TESTE REAL (pelo app, após aplicar):
--   1) Faça login com o ADMIN (sua conta atual).
--   2) Abra Voluntários, Cultos do mês, Dashboard -> deve continuar vendo TUDO.
--      (Se o Admin parou de ver os dados, me avise: revertemos na hora.)
--   3) O teste do papel "voluntário" (ver só o seu) acontece no Passo 2,
--      quando existir a tela de cadastro/login do voluntário.
-- =====================================================================
