-- =====================================================================
-- PROJETO ESCALA — Verificação pós-schema
-- Rode DEPOIS do schema.sql, no SQL Editor do Supabase.
-- Serve para conferir que tudo foi criado e a RLS está LIGADA.
-- =====================================================================

-- 1) Devem aparecer 10 tabelas, todas com rowsecurity = true.
select tablename, rowsecurity as rls_ligada
from pg_tables
where schemaname = 'public'
order by tablename;

-- 2) Deve listar uma política "tenant_..." para cada tabela.
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
order by tablename;

-- 3) As duas funções devem existir.
select proname as funcao
from pg_proc
where proname in ('auth_igreja_id', 'criar_igreja')
order by proname;

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
