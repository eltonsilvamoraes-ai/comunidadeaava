-- =====================================================================
-- PROJETO ESCALA — Verificação pós-schema
-- Rode DEPOIS do schema.sql, no SQL Editor do Supabase.
-- Serve para conferir que tudo foi criado e a RLS está LIGADA.
--
-- IMPORTANTE: o SQL Editor só mostra o resultado da ÚLTIMA consulta.
-- Por isso a verificação abaixo é UMA consulta só (com UNION), que
-- devolve tabelas + políticas + funções juntas num resultado único.
-- Esperado: ~22 linhas (10 TABELA com detalhe=true, 10 POLITICA, 2 FUNCAO).
-- =====================================================================

select 'TABELA (rls)' as tipo, tablename as nome,
       rowsecurity::text as detalhe
from pg_tables where schemaname = 'public'
union all
select 'POLITICA', tablename || ' · ' || policyname, cmd
from pg_policies where schemaname = 'public'
union all
select 'FUNCAO', proname, ''
from pg_proc where proname in ('auth_igreja_id','criar_igreja')
order by tipo, nome;

-- =====================================================================
-- TESTE REAL DE ISOLAMENTO (feito pelo APP, não aqui):
-- O SQL Editor roda como "dono do banco" e ignora a RLS de propósito,
-- então ele NÃO é o lugar para testar isolamento.
-- O teste de verdade é na Fase 1, pelo app:
--   1. Crie a Igreja A (usuário A) e cadastre 1 voluntário.
--   2. Crie a Igreja B (usuário B) e cadastre 1 voluntário.
--   3. Logado como A, liste voluntários -> deve ver SÓ o da Igreja A.
--   4. Logado como B -> deve ver SÓ o da Igreja B.
-- Se cada um vê apenas o seu, a fundação multi-tenant está correta. ✅
-- =====================================================================
