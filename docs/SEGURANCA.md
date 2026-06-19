# Revisão de Segurança — AAVA Voluntários

Documento de referência sobre como os dados são protegidos e o que ainda
pode ser melhorado. Atualizado para a API **versão 9**.

## Como o sistema é montado (superfície de ataque)

```
Navegador (público)  ──►  Apps Script /exec (público)  ──►  Google Sheet (privado)
```

- O **site** (HTML/CSS/JS) é público — qualquer um pode abrir e ver o código.
- A **URL do Apps Script** (`/exec`) fica visível no `config.js`, então deve-se
  assumir que **qualquer pessoa pode chamar a API**. Por isso a segurança real
  precisa estar **no servidor (Apps Script)**, nunca só no navegador.
- A **planilha** nunca é exposta diretamente: só o Apps Script (rodando como o
  dono) a acessa, e apenas pelas funções abaixo.

## Ações da API e nível de acesso

| Ação | Acesso | Observação |
|------|--------|------------|
| `registrarPresenca` | Público | Necessário para o totem. Revela o nome ao digitar um código válido e grava presença. |
| `minhasEscalas` | Público | Autoatendimento: o voluntário vê a própria escala pelo seu código. |
| `verificarPin` | Público | Só responde ok/erro; não devolve dados. |
| `listarDepartamentos` | **PIN** | 🔒 corrigido — exige PIN no servidor. |
| `listarVoluntarios` | **PIN** | 🔒 corrigido — exige PIN no servidor. |
| `buscarVoluntario` | **PIN** | 🔒 protegido (não é usado pelo site hoje). |
| `salvarEscala` | **PIN** | Edita a escala. |
| `listarEscala` | **PIN** | Lê a escala de uma data/departamento. |

## Correções já aplicadas

1. **PIN validado no servidor** (antes era só no navegador). As ações que listam
   ou editam dados sensíveis agora **recusam** sem o PIN correto ("Acesso restrito").
2. **`buscarVoluntario` protegido** por PIN (reduz enumeração silenciosa de nomes).
3. **Mensagens de erro genéricas** — detalhes internos ficam só no log do servidor.
4. **Proteção contra XSS** no site: todo dado vindo da planilha é "escapado"
   antes de virar HTML (nome, departamento, código).
5. **Códigos aleatórios**: função `gerarCodigosFaltantes()` cria códigos não
   sequenciais para novos voluntários (dificulta adivinhação).

## Riscos residuais (e como conviver com eles)

| Risco | Gravidade | Mitigação |
|-------|-----------|-----------|
| Quem souber um **código** vê o nome/escala daquela pessoa (1 por vez) | Baixa | Usar **códigos aleatórios** (não 1001, 1002…). Não é possível listar todos. |
| **PIN único** compartilhado entre líderes | Média | Trocar o PIN periodicamente. Evoluir para **PIN por departamento** no futuro. |
| **Injeção de fórmula** se um nome começar com `=` | Baixa | Nomes são cadastrados pela liderança (confiável). |
| Sem **limite de tentativas** (Apps Script não oferece nativamente) | Baixa | Códigos aleatórios tornam força-bruta impraticável. |

## Recomendações operacionais (checklist)

- [ ] **Trocar o PIN**: em `Codigo.gs`, `const PIN_LIDER = '2024'` → um valor seu
      (6+ dígitos) e republicar.
- [ ] **Manter a planilha privada**: em *Compartilhar*, deixar como **"Restrito"**
      (somente você/pastor). Ninguém precisa do link da planilha.
- [ ] **Usar códigos aleatórios**: rodar `gerarCodigosFaltantes()` ao cadastrar
      novos voluntários. (Os códigos de teste 1001–1007 podem ser trocados manualmente.)
- [ ] **HTTPS ativo** no subdomínio (cadeado) — já configurado na KingHost.
- [ ] **Não compartilhar** a URL `/exec` publicamente além do necessário.

## Próximas evoluções possíveis (se desejar mais segurança)

- **PIN por departamento** (cada líder só acessa o seu).
- **Login individual** para líderes (Google Login / token).
- **Auditoria**: registrar quem montou/alterou cada escala.
