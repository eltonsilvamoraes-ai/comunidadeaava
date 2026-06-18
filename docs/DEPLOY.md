# Publicação (Deploy)

São 2 partes: **(1)** o backend no Google e **(2)** os arquivos do site na KingHost.

---

## Parte 1 — Backend (Google Sheet + Apps Script)

1. Crie a planilha seguindo [`PLANILHA.md`](./PLANILHA.md) (abas `VOLUNTARIOS` e `REGISTROS`).
2. Na planilha: **Extensões → Apps Script**.
3. Apague o código de exemplo e cole todo o conteúdo de
   [`../apps-script/Codigo.gs`](../apps-script/Codigo.gs). Salve (💾).
4. Clique em **Implantar → Nova implantação**.
   - Tipo (engrenagem): **App da Web**.
   - **Executar como:** Eu (sua conta).
   - **Quem pode acessar:** **Qualquer pessoa**.
   - Implantar e **autorizar** o acesso quando pedir.
5. Copie a **URL do app da Web** (termina em `/exec`).
6. Para testar: cole a URL no navegador → deve aparecer
   `{"ok":true,"mensagem":"API AAVA ativa","versao":1}`.

> Sempre que **alterar o `Codigo.gs`**, use **Implantar → Gerenciar implantações
> → editar (lápis) → Nova versão**, para a mudança entrar no ar.

---

## Parte 2 — Site na KingHost (subdomínio)

### 2.1 Criar o subdomínio
No painel da KingHost: **Domínios/Subdomínios → criar** `escala.comunidadeaava.com.br`.
Anote a **pasta** que ele aponta (ex.: `/escala` ou `www/escala`).

### 2.2 Configurar a URL do backend
No arquivo [`../web/config.js`](../web/config.js), cole a URL do passo 5 acima:

```js
window.CONFIG = {
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/SEU_ID/exec',
  NOME_IGREJA: 'AAVA'
};
```

### 2.3 Enviar os arquivos
Envie **o conteúdo da pasta `web/`** para a pasta do subdomínio, via
**Gerenciador de Arquivos** da KingHost ou FTP. A estrutura final fica:

```
escala/  (raiz do subdomínio)
├── index.html
├── styles.css
├── app.js
├── config.js          <- já com a URL preenchida
└── assets/
    └── logo.svg
```

### 2.4 Testar
Abra `https://escala.comunidadeaava.com.br` no celular. Digite um código
cadastrado e confirme — a linha deve aparecer na aba `REGISTROS`.

> Como é um **subdomínio próprio**, ele não conflita com o WordPress do site
> principal. Nada precisa ser alterado no WordPress.

---

## Modo demonstração
Enquanto `APPS_SCRIPT_URL` estiver vazio, o app roda sem gravar nada, só para
visualizar as telas. Códigos de teste: **1001, 1002, 1003**.
