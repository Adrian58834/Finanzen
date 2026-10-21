# FinanZen - GUIA RÁPIDO (1 página)

## 1. Subir no GitHub
1. Crie conta: github.com/signup
2. **+ → New repository** → nome `finanzen` → marque **Public** → **Create repository**
3. **Add file → Upload files** → arraste o **conteúdo** da pasta do projeto
   (não a pasta). `index.html` tem que ficar na **raiz**.
4. **Commit changes**

## 2. Publicar
1. Repo → **Settings → Pages**
2. Source: **Deploy from a branch** | Branch: **main** | Pasta: **/ (root)** → **Save**
3. Espere 1-3 min. Sua URL: `https://SEU-USUARIO.github.io/finanzen/`

## 3. Instalar
| Aparelho | Como |
|---|---|
| Android (Chrome) | menu **⋮** → **Instalar app** |
| iPhone (Safari) | **Compartilhar** → **Adicionar à Tela de Início** |
| PC (Chrome/Edge) | ícone de instalação na barra de endereço |

## 4. Sincronizar (opcional)
1. supabase.com → **New project** (Região: São Paulo) → espere ~2 min
2. **SQL Editor → New query** → cole `supabase/schema.sql` → **Run**
   (na versão 1.9.1, execute o SQL antes de publicar os novos arquivos)
3. **Project Settings → API**: copie **Project URL** + chave **anon public**
4. No GitHub, edite `js/sync-config.js`:
   ```js
   window.FINANZEN_SUPABASE = {
     url: 'https://SEU-PROJETO.supabase.co',
     anonKey: 'eyJ...sua-chave-anon...',
     table: 'finanzen_data'
   };
   ```
   → **Commit changes**
5. Supabase → **Authentication → Providers → Email** ligado
   (pode desligar *Confirm email* para testes)
6. Se já houver dados locais, exporte o backup JSON antes de entrar.
7. App → **Conta & Ajustes → Conta e acesso** → **Criar conta** (1º aparelho).
   Entre, importe o backup na conta correta e use a mesma conta no 2º aparelho.

## Atualizar o app depois
GitHub → edite/substitua o arquivo → **Commit changes** → espere ~1 min →
feche e reabra o app (recarregue 2x se necessário).

## Se der problema
- **404 no Pages**: `index.html` na raiz? Source = `main` / root? Espere mais.
- **Não instala no celular**: use `https://` (GitHub Pages). iPhone = Safari.
- **Sync não conecta**: confira URL/chave em `js/sync-config.js`; recarregue o app.
- **Dados "sumidos"**: sair mostra o espaço local; entrar mostra o espaço da
  conta. Use **Conta & Ajustes → Exportar backup** antes de migrar os dados.

## Checklist
- [ ] Repo público com `index.html` na raiz
- [ ] Pages ativo (branch `main` / root)
- [ ] App instalado no PC e no celular
- [ ] Backup JSON exportado antes da atualização
- [ ] `supabase/schema.sql` 1.9.1 executado antes do upload
- [ ] `js/sync-config.js` preenchido
- [ ] Conta criada e login no 2º aparelho

> Guia detalhado, com cada clique: `DEPLOY.md`
