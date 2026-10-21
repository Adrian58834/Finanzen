import { authenticate } from '../_shared/auth.ts';
import { getProviderAdapter, ProviderNotConfiguredError, type ProviderConnection } from '../_shared/provider.ts';
import { errorMessage, handleOptions, json } from '../_shared/http.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== 'POST') return json({ error: 'method_not_allowed', message: 'Use POST.' }, 405);

  let runId: string | null = null;
  let admin: Awaited<ReturnType<typeof authenticate>>['adminClient'] | null = null;

  try {
    const auth = await authenticate(req);
    admin = auth.adminClient;
    const body = await req.json().catch(() => ({}));
    const connectionId = typeof body.connectionId === 'string' ? body.connectionId : '';
    if (!UUID.test(connectionId)) return json({ error: 'invalid_connection', message: 'Conexão inválida.' }, 400);

    const { data: row, error: connectionError } = await auth.userClient
      .from('open_finance_connections')
      .select('id, provider, provider_connection_id, institution_id, institution_name, metadata')
      .eq('id', connectionId)
      .maybeSingle();

    if (connectionError) throw connectionError;
    if (!row) return json({ error: 'not_found', message: 'Conexão não encontrada.' }, 404);
    if (!row.provider_connection_id) {
      return json({ error: 'connection_pending', message: 'A instituição ainda não concluiu a autorização.' }, 409);
    }

    const adapter = getProviderAdapter();
    const { data: run, error: runError } = await admin
      .from('open_finance_sync_runs')
      .insert({ user_id: auth.user.id, connection_id: row.id, trigger_source: 'manual', status: 'running', started_at: new Date().toISOString() })
      .select('id')
      .single();
    if (runError) throw runError;
    runId = run.id;

    const connection: ProviderConnection = {
      id: row.id,
      provider: row.provider,
      providerConnectionId: row.provider_connection_id,
      institutionId: row.institution_id || undefined,
      institutionName: row.institution_name
    };
    const result = await adapter.syncConnection(connection);
    const now = new Date().toISOString();

    const accountRows = result.accounts.map((account) => ({
      user_id: auth.user.id,
      connection_id: row.id,
      provider_account_id: account.externalId,
      type: account.type,
      subtype: account.subtype || null,
      name: account.name,
      official_name: account.officialName || null,
      mask: account.mask || null,
      currency: account.currency || 'BRL',
      current_balance: account.currentBalance ?? null,
      available_balance: account.availableBalance ?? null,
      credit_limit: account.creditLimit ?? null,
      metadata: account.metadata || {},
      last_synced_at: now
    }));

    if (accountRows.length) {
      const { error } = await admin.from('open_finance_accounts')
        .upsert(accountRows, { onConflict: 'connection_id,provider_account_id' });
      if (error) throw error;
    }

    const { data: savedAccounts, error: accountsError } = await admin
      .from('open_finance_accounts')
      .select('id, provider_account_id')
      .eq('connection_id', row.id);
    if (accountsError) throw accountsError;
    const accountIds = new Map((savedAccounts || []).map((account) => [account.provider_account_id, account.id]));

    const transactionRows = result.transactions.map((transaction) => ({
      user_id: auth.user.id,
      connection_id: row.id,
      account_id: accountIds.get(transaction.externalAccountId),
      provider_transaction_id: transaction.externalId || null,
      deduplication_key: transaction.deduplicationKey,
      type: transaction.type,
      status: transaction.status,
      amount: Math.abs(transaction.amount),
      currency: transaction.currency || 'BRL',
      transaction_date: transaction.date,
      posted_at: transaction.postedAt || null,
      description: transaction.description,
      raw_description: transaction.rawDescription || null,
      merchant_name: transaction.merchantName || null,
      category_key: transaction.categoryKey || null,
      metadata: transaction.metadata || {}
    })).filter((transaction) => transaction.account_id);

    if (transactionRows.length) {
      const { error } = await admin.from('open_finance_transactions')
        .upsert(transactionRows, { onConflict: 'connection_id,deduplication_key' });
      if (error) throw error;
    }

    await admin.from('open_finance_connections').update({ status: 'active', last_synced_at: now, last_error_code: null, last_error_message: null }).eq('id', row.id);
    await admin.from('open_finance_sync_runs').update({
      status: 'succeeded',
      cursor_after: result.cursor || null,
      accounts_processed: accountRows.length,
      transactions_updated: transactionRows.length,
      finished_at: now
    }).eq('id', runId);

    return json({ ok: true, accounts: accountRows.length, transactions: transactionRows.length });
  } catch (error) {
    if (admin && runId) {
      await admin.from('open_finance_sync_runs').update({
        status: 'failed', error_message: errorMessage(error), finished_at: new Date().toISOString()
      }).eq('id', runId);
    }
    const status = error instanceof ProviderNotConfiguredError ? 503 : 500;
    return json({ error: status === 503 ? 'provider_not_configured' : 'sync_failed', message: errorMessage(error) }, status);
  }
});
