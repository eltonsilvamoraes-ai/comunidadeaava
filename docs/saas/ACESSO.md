# Modelo de Acesso e Cadastro — Projeto Escala (Diakun)

> Especificação do modelo multi-igreja de **logins, papéis e aprovações**.
> Decidido com o cliente. Guia a implementação (mexe em RLS — construir com cuidado).

## Papéis

| Papel | Quem | Acesso |
|---|---|---|
| **Master / Admin** | Pastor presidente (1 por igreja) | Tudo na igreja; autoriza líderes; cobrança (futuro) |
| **Líder** | Demais pastores e líderes | Escala/relatórios **dos seus departamentos**; **aprova voluntários** dos seus departamentos |
| **Voluntário** | Cada servo | **Área pessoal**: sua escala, sua presença (futuro: disponibilidade/troca) |
| **Presença (kiosk)** | Tablet da entrada | Login geral da igreja; **só registra presença** (digita código) |

## Identificador do voluntário (“Código”)
- O **Código** pode ser **matrícula OU CPF** — cada igreja decide. Campo livre, **único por igreja**.
- ⚠️ Se for CPF: é dado sensível (LGPD) → nunca exibir publicamente; tratar com cuidado.

## Cadastro (cada link carrega `?igreja=<id>` → vincula ao `id_igreja`)

### 🔗 Link Cadastro Voluntário
1. Voluntário abre o link da **sua** igreja.
2. Informa **Código** + e-mail (senha **padrão** definida; troca depois).
3. Sistema **reivindica a ficha existente** (importada do sistema antigo) pelo Código
   **naquela igreja** → cria login (papel voluntário) ligado à ficha.
4. Fica **pendente** no departamento até a **aprovação do líder** (vira “ativo”).

### 🔗 Link Cadastro Líder
1. Pessoa abre o link → cria conta (papel líder).
2. Conta nasce **inativa**: só funciona após o **Admin autorizar** e **atribuir departamento(s)**.

## Ativação (aprovações)
- **Voluntário:** login funciona, mas a participação num departamento exige
  **aprovação do líder daquele departamento** (`voluntario_departamento.aprovado = true`).
  Os voluntários **importados pelo admin já entram aprovados**.
- **Líder:** conta criada via link fica **inativa** até **autorização do Admin** (`usuarios.ativo = true`).

## Presença (sempre em contexto logado da igreja — sem link anônimo)
- **Tablet da entrada:** um **login de Presença geral** da igreja (papel `kiosk`) fica logado;
  quem chega digita o **Código** e registra. A igreja é identificada pelo login (não pela URL).
- **No próprio celular:** o voluntário logado registra a **própria** presença.
- Mantém GPS/raio por igreja.

## Senha padrão
- Voluntários criados com **senha padrão** (ex.: o próprio Código ou uma definida pela igreja),
  com recomendação de **trocar no primeiro acesso**.

## Troca de senha (todos os papéis)
- **Qualquer login** (Admin, Líder, Voluntário) pode **alterar a própria senha** a qualquer
  momento (via `auth.updateUser`), além do fluxo de “esqueci minha senha” por e-mail.

## Segurança — RLS por papel (travado no banco, não só na tela)
- **Admin:** tudo da própria igreja.
- **Líder:** apenas os **seus departamentos**.
- **Voluntário:** apenas os **próprios** dados (escala, presença).
- **Kiosk:** apenas **inserir presença** da própria igreja.

## Mudanças no modelo de dados
- `usuarios`: `papel ∈ {admin, lider, voluntario, kiosk}`; **`ativo boolean`** (autorização do líder).
- `voluntarios`: **`usuario_id`** (FK do login, nullable, único) — liga login ↔ ficha.
- `voluntario_departamento`: **`aprovado boolean`** (default false; importados = true).
- **`usuario_departamento`** (nova): líderes ↔ departamentos que gerenciam.
- Funções (RPC, SECURITY DEFINER): `reivindicar_voluntario`, `cadastrar_lider`,
  `aprovar_voluntario` (líder), `autorizar_lider` (admin).

## Ordem de construção (incremental, testando a cada passo)
1. **Fundação SQL:** papéis, colunas, `usuario_departamento`, **RLS por papel** (re-testar isolamento).
2. **Cadastro de voluntário** (reivindicação + senha padrão) + **área pessoal** com **PDF da escala**.
3. **Cadastro/autorização de líderes** + atribuição de departamentos.
4. **Aprovação de voluntários** pelo líder.
5. **Presença logada** (kiosk + voluntário) substituindo o link anônimo atual.
