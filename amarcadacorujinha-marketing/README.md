# A Marca da Corujinha — Base de Marketing 🦉

Cérebro de marketing da marca de roupas cristãs **A Marca da Corujinha**
(`@amarcadacorujinha` · www.amarcadacorujinha.com.br).

Marketing tratado como código: contexto da marca + skills reutilizáveis +
planejamento, tudo versionado. Veja [`CLAUDE.md`](./CLAUDE.md) para as
regras de uso.

## Estrutura

| Pasta | O que é |
|-------|---------|
| `marca/` | Quem é a marca: brand bible, público, voz, identidade, produtos |
| `skills/` | Receitas reutilizáveis (planejamento, roteiros, etc.) |
| `planejamento/` | Planos trimestrais e calendário editorial |
| `roteiros/` | Roteiros de vídeo (Reels/TikTok) + exemplos |
| `biblioteca/` | Arquivo do que já foi produzido |

## Como começar a usar

1. Abra esta pasta no Claude Code.
2. Peça, por exemplo: *"Crie 5 roteiros de Reels para a campanha de Dia dos
   Pais seguindo `skills/roteiro-reels.md`"*.
3. O Claude lê o cérebro da marca, segue a skill e entrega a peça.

## Como transformar isto no seu repositório dedicado

Esta base foi construída dentro do repositório `comunidadeaava` por uma
limitação de ambiente, mas é **100% autônoma**. Para movê-la para um repo
próprio:

```bash
# 1. Copie a pasta para fora
cp -r amarcadacorujinha-marketing ~/amarcadacorujinha-marketing
cd ~/amarcadacorujinha-marketing

# 2. Inicialize o repositório
git init
git add .
git commit -m "Base de marketing inicial"

# 3. Crie o repo no GitHub (via site ou gh) e conecte
git remote add origin git@github.com:SEU-USUARIO/amarcadacorujinha-marketing.git
git push -u origin main
```
