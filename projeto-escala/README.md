# Projeto Escala (SaaS)

Codinome do produto **multi-igreja** que nasce a partir do app da AAVA.
Visão, roadmap e decisões: ver `../docs/saas/` e `../docs/PLANEJAMENTO.md`.

> O app atual da AAVA (Google Sheets + Apps Script) continua em `../web` e
> `../apps-script`, rodando em produção, sem relação com esta pasta.

## Estrutura

```
projeto-escala/
  supabase/
    schema.sql      -> cria o banco multi-tenant (tabelas + RLS + cadastro 1/CNPJ)
    verificar.sql   -> confere que tudo subiu e a RLS está ligada
  (frontend Next.js virá aqui na Fase 2)
```

## Como subir o banco (Fase 1)

1. Crie a conta e o projeto no **Supabase** (region São Paulo).
2. No painel: **SQL Editor > New query**.
3. Cole o conteúdo de `supabase/schema.sql` e clique em **Run**.
4. Cole o `supabase/verificar.sql` e rode para conferir (10 tabelas, RLS ligada,
   políticas e funções criadas).

## Próximos passos

- [ ] Subir o `schema.sql` no Supabase.
- [ ] Frontend (Next.js) com login (Supabase Auth) + tela "Criar igreja".
- [ ] Teste de isolamento com 2 igrejas (ver fim do `verificar.sql`).
- [ ] RPC pública de presença do voluntário (sem login).
