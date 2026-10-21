# Open Finance no FinanZen

Esta versão cria a fundação segura para coleta automática. Ela **não conecta
bancos em produção ainda**, porque a jornada de autorização, os endpoints e a
assinatura dos webhooks dependem do provedor contratado.

## O que já está pronto

- Modelo normalizado para conexões, contas, transações, sincronizações e webhooks.
- RLS: o navegador só pode ler registros pertencentes ao usuário autenticado.
- Gravações restritas ao backend com `service role`.
- Interface de conexões bancárias em **Conta & Ajustes → Open Finance**.
- Cliente web que invoca Edge Functions autenticadas.
- Funções de conectar, sincronizar, revogar e receber webhooks.
- Contrato único de provedor em `supabase/functions/_shared/provider.ts`.
- Deduplicação por conexão e chave externa da transação.

## Implantar a fundação

1. Execute `supabase/schema.sql` no SQL Editor do Supabase.
2. Execute `supabase/open-finance-schema.sql` no mesmo projeto.
3. Escolha o provedor e implemente um adaptador que satisfaça a interface
   `OpenFinanceProvider` de `supabase/functions/_shared/provider.ts`.
4. Faça deploy das funções:

   ```text
   open-finance-connect
   open-finance-sync
   open-finance-disconnect
   open-finance-webhook
   ```

5. Cadastre nos secrets das Edge Functions:

   ```text
   APP_ORIGIN=https://seu-dominio.example
   OPEN_FINANCE_PROVIDER=nome-do-provedor
   OPEN_FINANCE_CLIENT_ID=...
   OPEN_FINANCE_CLIENT_SECRET=...
   OPEN_FINANCE_WEBHOOK_SECRET=...
   ```

6. Cadastre no provedor a URL pública da função `open-finance-webhook`.
7. Depois de validar tudo no sandbox, altere em `js/sync-config.js`:

   ```js
   window.FINANZEN_OPEN_FINANCE = {
     enabled: true,
     provider: 'nome-do-provedor',
     functions: {
       connect: 'open-finance-connect',
       sync: 'open-finance-sync',
       disconnect: 'open-finance-disconnect'
     }
   };
   ```

O nome público do provedor pode aparecer no navegador; os secrets nunca podem
ser adicionados a esse arquivo.

## Regras obrigatórias para o adaptador

- A autenticação do banco acontece fora do FinanZen.
- `parseWebhook` deve rejeitar qualquer evento com assinatura inválida ou fora
  da janela de tolerância contra replay.
- Valores devem ser normalizados como positivos, usando `type` para indicar
  receita, despesa ou transferência.
- `deduplicationKey` deve ser estável. Prefira o ID imutável fornecido pelo
  banco/provedor; quando ele não existir, gere um hash determinístico.
- Uma transação pendente e sua versão contabilizada precisam atualizar o mesmo
  registro, não criar duas transações.
- Tokens de acesso e renovação devem ficar em secrets/cofre no backend e nunca
  em tabelas expostas ao navegador, logs, `localStorage` ou arquivos do projeto.
- A revogação só deve ser marcada localmente depois de confirmada pelo provedor.

## Próxima etapa técnica

Após escolher o provedor, implementar o adaptador, o processamento automático
dos eventos de webhook e o mapeamento das transações normalizadas para as telas
atuais do FinanZen. Até lá, `enabled` deve permanecer `false`.
