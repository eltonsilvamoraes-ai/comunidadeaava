# CLAUDE.md — Cérebro de Marketing da *A Marca da Corujinha* 🦉

> Este arquivo é lido automaticamente pelo Claude Code sempre que ele
> trabalha neste repositório. Ele explica **o que é este projeto**, **como
> está organizado** e **as regras que o Claude deve seguir** ao gerar
> qualquer peça de marketing.

## O que é este repositório

Este NÃO é um repositório de software. É o **cérebro de marketing** da marca
de roupas cristãs *A Marca da Corujinha*. Tratamos marketing como código:
contexto, skills e workflows versionados, para que toda peça gerada saia
"com a cara da marca" — e melhore com o tempo.

Inspiração: o método que Austin Lau (@helloitsaustin) descreveu para
gerenciar o marketing da Anthropic — contexto rico + skills reutilizáveis +
agentes especialistas.

## Como está organizado

```
marca/         → A FONTE DA VERDADE. Quem é a marca. LER SEMPRE ANTES DE CRIAR.
skills/        → Receitas reutilizáveis (como fazer X). Seguir o passo a passo.
planejamento/  → Estratégia: planos trimestrais, calendário editorial.
roteiros/      → Roteiros de vídeo (Reels/TikTok/YouTube).
biblioteca/    → Arquivo do que já foi feito (posts, banners, anúncios).
```

## Regras de ouro (o Claude DEVE seguir)

1. **Antes de gerar QUALQUER peça**, leia os arquivos de `marca/`. Eles
   definem voz, público e identidade. Nada de conteúdo genérico.
2. **A marca é cristã.** O propósito (evangelizar / testemunhar a fé) vem
   antes da venda. Toda peça deve honrar isso — nunca apelativo vazio,
   nunca usar a fé apenas como "gancho de marketing".
3. **Tagline-âncora:** *"Cada camiseta é um testemunho vivo."*
4. **Tom:** acolhedor, inspirador, jovem, com fé genuína — não "igrejês"
   pesado nem prosperidade. Fala com a geração que usa streetwear.
5. **Sempre cite a skill usada** ao entregar uma peça (ex.: "gerado via
   `skills/roteiro-reels.md`").
6. **Toda peça boa volta para `biblioteca/`** — é assim que o cérebro
   aprende o que funciona.
7. Quando faltar um dado da marca, **pergunte** em vez de inventar. Itens a
   confirmar estão marcados com `⚠️ CONFIRMAR` nos arquivos de `marca/`.

## Fluxo recomendado para uma nova demanda

1. Ler `marca/` (contexto).
2. Identificar a skill certa em `skills/`.
3. Conferir o `planejamento/` vigente (a peça encaixa na estratégia?).
4. Gerar a peça seguindo a skill.
5. Salvar o resultado em `biblioteca/`.

## Status de construção

- [x] Fundação — cérebro da marca (`marca/`)
- [x] Aplicação 1 — Planejamento estratégico + Roteiros
- [ ] Aplicação 2 — Feed do Instagram
- [ ] Aplicação 3 — Banners do site
- [ ] Aplicação 4 — Campanhas publicitárias
- [ ] Aplicação 5 — Google Ads
- [ ] Aplicação 6 — Meta Ads
- [ ] SEO do site
