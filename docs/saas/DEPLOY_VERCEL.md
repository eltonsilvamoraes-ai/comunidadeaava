# Publicar o Diakun na Vercel (com domínio diakun.com.br)

O frontend é estático (HTML/CSS/JS) e o backend é o Supabase (já no ar).
Publicar = hospedar a pasta `projeto-escala/web` na Vercel e apontar o domínio.

## 1) Conta + importar o repositório
1. Acesse https://vercel.com → **Sign Up** → **Continue with GitHub**.
2. **Add New… → Project** → autorize e escolha o repositório `eltonsilvamoraes-ai/comunidadeaava`.
3. Na tela de configuração do projeto:
   - **Root Directory:** clique em **Edit** e selecione `projeto-escala/web`.
   - **Framework Preset:** `Other` (é site estático, sem build).
   - **Build Command / Output:** deixe em branco.
4. **Deploy**. Em ~1 min sai um endereço tipo `diakun.vercel.app`.

## 2) Branch de produção
- A Vercel publica como **produção** a branch principal do repositório.
- Cada `git push` que eu fizer atualiza o site sozinho (sem você mexer em arquivo).
- Pushes em outras branches viram **Preview** (URL de teste separada).

## 3) Conectar o domínio diakun.com.br
1. No projeto da Vercel: **Settings → Domains → Add** → digite `diakun.com.br`.
2. A Vercel vai mostrar os registros de DNS a criar. Normalmente:
   - `A`  →  `@`  →  `76.76.21.21`
   - `CNAME`  →  `www`  →  `cname.vercel-dns.com`
   (use exatamente os valores que a Vercel exibir.)
3. No **Registro.br** (painel do domínio) → **DNS / Editar Zona** → adicione esses registros.
4. Aguarde a propagação (minutos a algumas horas). HTTPS é automático.

## 4) Supabase — autorizar o domínio do login
No painel do Supabase → **Authentication → URL Configuration**:
- **Site URL:** `https://diakun.com.br`
- **Redirect URLs:** adicione `https://diakun.com.br/*`
(A chave publishable no `config.js` já funciona de qualquer origem.)

## Depois (quando começar a cobrar)
- Vercel: subir do plano gratuito para o **Pro** (mesmo host, mesmo domínio, sem migração).
- Supabase: configurar **SMTP próprio** para e-mails de "recuperar senha".
