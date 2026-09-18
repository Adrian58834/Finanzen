# FinanZen - Guia detalhado: usar no PC e no celular

Este guia é para quem **nunca publicou um site**. São 4 partes:

1. Colocar o app no GitHub
2. Publicar (GitHub Pages)
3. Instalar no PC e no celular
4. Sincronizar os aparelhos (Supabase)

Tempo estimado: ~20 minutos. Não precisa saber programar.

---

## Pré-requisitos

- Uma conta no **GitHub** (grátis): https://github.com/signup
- Um navegador atualizado (Chrome, Edge ou Safari)
- Os arquivos do projeto FinanZen (a pasta onde está o `index.html`)

> Importante: no plano grátis do GitHub, o repositório precisa ser **público**
> para o GitHub Pages funcionar. Isso é tranquilo: seus **dados financeiros não
> vão para o GitHub** — eles ficam no seu navegador (e no Supabase, se você
> ativar a sincronização). No repositório vão apenas os arquivos do app.

---

## PARTE 1 - Colocar o app no GitHub

### 1.1 Criar a conta (se ainda não tiver)
1. Acesse https://github.com/signup
2. Informe e-mail, crie uma senha e escolha um nome de usuário (ex: `adrian-santos`).
3. Confirme o e-mail.

### 1.2 Criar o repositório
1. Faça login e clique no **+** (canto superior direito) → **New repository**.
2. Em **Repository name**, escreva: `finanzen`
3. Em **Description** (opcional): `App de gestão financeira pessoal`
4. Marque **Public**.
5. **Não** marque "Add a README file".
6. Clique em **Create repository**.
7. Você verá uma página com instruções e um link. Deixe essa aba aberta.

### 1.3 Enviar os arquivos (jeito mais fácil, sem instalar nada)
1. Na página do repositório recém-criado, clique no link
   **uploading an existing file** (ou no botão **Add file → Upload files**).
2. Abra a pasta do FinanZen no seu computador.
3. **Selecione TODOS os arquivos e pastas** de dentro da pasta do projeto
   (selecione o *conteúdo*, não a pasta em si) e arraste para a área do GitHub.
   - Devem subir: `index.html`, `manifest.webmanifest`, `sw.js`, `package.json`,
     `README.md`, `DEPLOY.md`, e as pastas `css/`, `js/`, `icons/`, `tests/`,
     `supabase/`.
   - O importante é que o `index.html` fique na **raiz** do repositório
     (primeiro nível), não dentro de outra pasta.
4. Embaixo, no campo de mensagem, escreva: `Versão inicial do FinanZen`.
5. Clique em **Commit changes**.
6. Aguarde o upload terminar (barra de progresso). Recarregue a página do
   repositório: você deve ver `index.html` listado na raiz.

> Se o upload pelo navegador falhar por causa de muitos arquivos, veja a
> alternativa com Git na seção **Solução de problemas (A)**.

---

## PARTE 2 - Publicar no GitHub Pages

1. Na página do seu repositório, clique em **Settings** (menu superior).
2. No menu da esquerda, clique em **Pages**.
3. Em **Build and deployment** → **Source**, escolha **Deploy from a branch**.
4. Em **Branch**, selecione **main** e a pasta **/ (root)**. Clique em **Save**.
5. Aguarde de 1 a 3 minutos. Atualize a página de **Pages**.
6. No topo aparecerá:
   **"Your site is live at https://SEU-USUARIO.github.io/finanzen/"**
7. Clique nesse link. O FinanZen deve abrir no navegador.

> Se aparecer erro 404, espere mais 2 minutos e recarregue. Na primeira vez o
> GitHub leva um tempinho para publicar.

### 2.1 Anotar sua URL
Sua URL final será sempre:
`https://SEU-USUARIO.github.io/finanzen/`
Troque `SEU-USUARIO` pelo seu nome de usuário do GitHub. Guarde essa URL:
é a mesma para PC e celular.

---

## PARTE 3 - Instalar no PC e no celular

### 3.1 No celular Android (Chrome)
1. Abra o **Chrome** e visite `https://SEU-USUARIO.github.io/finanzen/`.
2. Toque no menu **⋮** (três pontinhos, canto superior direito).
3. Toque em **Instalar app** (ou **Adicionar à tela inicial**).
4. Confirme. Um ícone do FinanZen aparecerá na tela inicial.
5. Abra pelo ícone: ele roda em tela cheia, como um app normal.

### 3.2 No iPhone (Safari)
1. Abra o **Safari** e visite a mesma URL.
2. Toque no botão **Compartilhar** (quadrado com seta para cima).
3. Role e toque em **Adicionar à Tela de Início**.
4. Dê o nome **FinanZen** e toque em **Adicionar**.
5. Abra pelo ícone na tela inicial.

### 3.3 No PC (Chrome ou Edge)
1. Abra a URL no navegador.
2. Na barra de endereço, aparecerá um **ícone de instalação** (monitorzinho com
   seta) à direita. Clique nele e depois em **Instalar**.
   - Alternativa: menu **⋮** → **Instalar FinanZen**.
3. O app abrirá em uma janela própria e ganhará atalho no menu Iniciar.

> O botão **Instalar app** também aparece dentro do app em
> *Backup & Dados*, quando o navegador permite a instalação.

Pronto! Agora o app funciona **offline** nos dois aparelhos (cada aparelho com
seus próprios dados, por enquanto).

---

## PARTE 4 - Sincronizar os aparelhos (Supabase)

Opcional. Faça esta parte quando quiser que a mesma informação apareça no PC e
no celular automaticamente. Enquanto não configurar, cada aparelho fica
independente.

### 4.1 Criar o projeto no Supabase
1. Acesse https://supabase.com e clique em **Start your project**.
2. Crie a conta (pode entrar com GitHub).
3. Clique em **New project**.
4. Preencha:
   - **Name**: `finanzen`
   - **Database Password**: uma senha forte (guarde, mas você quase não vai usá-la)
   - **Region**: escolha a mais próxima (ex: *South America (São Paulo)*)
5. Clique em **Create new project** e aguarde ~2 minutos (ele prepara o banco).

### 4.2 Criar a tabela (rodar o SQL)
1. No menu da esquerda, clique em **SQL Editor**.
2. Clique em **New query**.
3. Abra o arquivo `supabase/schema.sql` do projeto, **copie todo o conteúdo** e
   cole na área do editor.
4. Clique em **Run** (ou Ctrl+Enter). Deve aparecer **Success. No rows returned**.
5. Pronto: a tabela `finanzen_data`, o gatilho de data e as regras de segurança
   (RLS) foram criados.

### 4.3 Copiar a URL e a chave do Supabase
1. No menu da esquerda, clique na **engrenagem (Project Settings)**.
2. Clique em **API** (em alguns projetos: **API Keys** ou **Data API**).
3. Copie e guarde dois valores:
   - **Project URL** — algo como `https://abcdxyz.supabase.co`
   - **anon public** (chave pública) — um texto longo começando com `eyJ...`
4. Deixe esta aba aberta.

> A chave **anon** é feita para ser pública. Mesmo que alguém a veja, as regras
> de segurança (RLS) garantem que cada usuário só acessa os **próprios** dados.

### 4.4 Colocar as chaves no app
1. Volte ao seu repositório no GitHub.
2. Abra a pasta `js` e clique no arquivo `sync-config.js`.
3. Clique no ícone de **lápis (Edit this file)**.
4. Substitua o conteúdo por (mantendo as aspas):
   ```js
   window.FINANZEN_SUPABASE = {
     url: 'https://abcdxyz.supabase.co',
     anonKey: 'eyJ...cole-aqui-a-chave-anon...',
     table: 'finanzen_data'
   };
   ```
   Use exatamente a sua **Project URL** e a sua **anon key**.
5. Role até o fim e clique em **Commit changes** → **Commit changes**.
6. Aguarde ~1 minuto (o GitHub Pages republica sozinho).

### 4.5 Ativar login por e-mail no Supabase
1. No Supabase, menu da esquerda → **Authentication**.
2. Clique em **Providers** (ou **Sign In / Providers**) → **Email**.
3. Garanta que **Enable Email provider** está ligado.
4. Para testes rápidos, desligue **Confirm email** (assim você entra direto,
   sem precisar clicar em link no e-mail). Se deixar ligado, será preciso
   confirmar o e-mail antes do primeiro login.
5. Clique em **Save**.

### 4.6 Conectar no primeiro aparelho (ex: PC)
1. Abra o app (a URL publicada ou o app instalado).
2. Vá em **Backup & Dados** → card **Sincronização em Nuvem**.
3. Agora devem aparecer os campos de e-mail e senha.
4. Digite seu e-mail e uma senha (mínimo 6 caracteres) e clique em **Criar conta**.
5. Se pedir confirmação, confira seu e-mail e clique no link.
6. Depois, clique em **Entrar**. O status deve ficar **Conectado**.
7. Ao entrar, seus dados locais são **enviados** para a nuvem.

### 4.7 Conectar no segundo aparelho (ex: celular)
1. Abra o app no celular.
2. **Backup & Dados → Sincronização em Nuvem**.
3. Informe **o mesmo e-mail e senha** e clique em **Entrar**.
4. Como a nuvem tem os dados mais recentes, eles serão **baixados** para o
   celular automaticamente.

### 4.8 Como a sincronização funciona no dia a dia
- Toda alteração é enviada para a nuvem automaticamente (~1,5s depois).
- Estratégia **last-write-wins**: o aparelho que salvou por último vence.
- Botões manuais no card de sincronização:
  - **Sincronizar agora**: compara e decide (baixa se a nuvem for mais nova,
    senão envia).
  - **Enviar**: força o envio do aparelho para a nuvem.
  - **Baixar**: força trazer a nuvem para este aparelho.
  - **Sair**: desconecta (os dados locais permanecem).

> Dica: para evitar conflitos, edite um aparelho por vez. Se editar nos dois
> sem sincronizar, o "mais recente" sobrescreve o outro.

---

## PARTE 5 - Atualizar o app depois

Sempre que eu enviar uma versão nova (arquivos alterados):

1. No GitHub, abra o arquivo que mudou → ícone de **lápis** → cole o novo
   conteúdo → **Commit changes**.
   - Ou use **Add file → Upload files** para substituir arquivos.
2. O GitHub Pages republica sozinho em ~1 minuto.
3. No celular/PC, feche e reabra o app. Se ainda vir a versão antiga:
   - Recarregue a página (puxe para baixo no celular), ou
   - Feche o app de verdade (não só minimize) e abra de novo.

> Se o arquivo `sw.js` mudou, pode ser preciso recarregar duas vezes para o
> service worker novo assumir.

---

## Solução de problemas

### (A) Alternativa para enviar arquivos: Git (linha de comando)
Se o upload pelo navegador der problema com muitos arquivos:
1. Instale o **Git**: https://git-scm.com/downloads
2. Abra o **Git Bash** (Windows) na pasta do projeto.
3. Rode, um comando por vez:
   ```bash
   git init
   git add .
   git commit -m "Versao inicial do FinanZen"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/finanzen.git
   git push -u origin main
   ```
4. O GitHub vai pedir login (navegador ou token). Depois disso, atualizações
   futuras são: `git add . && git commit -m "ajustes" && git push`.

### (B) Página 404 no GitHub Pages
- Confirme que `index.html` está na **raiz** do repositório (não dentro de pasta).
- Em **Settings → Pages**, confira branch **main** e pasta **/ (root)**.
- Espere mais alguns minutos e recarregue.

### (C) "Instalar app" não aparece no celular
- Só funciona em **HTTPS** (o GitHub Pages já é). Confirme que está usando a URL
  `https://...` e não um arquivo local.
- No Android, use o **Chrome**. No iPhone, use o **Safari** (o Chrome do iOS não
  instala PWA).

### (D) Sincronização não conecta / erro de e-mail
- Confira se as chaves em `js/sync-config.js` estão **exatamente** iguais às do
  Supabase (URL sem barra no final, chave completa).
- Veja em **Authentication → Users** se o usuário foi criado.
- Se "Confirm email" estiver ligado, confirme pelo link enviado ao e-mail.
- Recarregue o app depois de editar o `sync-config.js` (pode levar ~1 min para
  o GitHub Pages publicar a mudança).

### (E) Meus dados sumiram
- Cada aparelho guarda seus dados no navegador até você **Entrar** na conta.
- Faça **Exportar JSON** periodicamente em *Backup & Dados* como cópia extra.

---

## Desenvolvimento local (para quem for mexer no código)

```bash
npm run check   # valida a sintaxe de todos os JS + service worker
npm test        # roda a suíte de testes
```

Para testar como PWA localmente (service worker não roda em `file://`):

```bash
npx serve .          # ou: python -m http.server 8080
```

Abra o endereço mostrado no terminal (ex: `http://localhost:3000`).

---

## Resumo rápido (checklist)

- [ ] Conta no GitHub criada
- [ ] Repositório `finanzen` público com os arquivos (index.html na raiz)
- [ ] Settings → Pages → branch `main` / root → URL publicada
- [ ] App instalado no PC (ícone na barra) e no celular (tela inicial)
- [ ] Projeto Supabase criado e `supabase/schema.sql` executado
- [ ] `js/sync-config.js` preenchido com URL + anon key
- [ ] Authentication → Email habilitado
- [ ] Criar conta no 1º aparelho e Entrar no 2º
