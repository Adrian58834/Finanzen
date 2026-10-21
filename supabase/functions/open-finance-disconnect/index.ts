import { authenticate } from '../_shared/auth.ts';
import { getProviderAdapter, ProviderNotConfiguredError, type ProviderConnection } from '../_shared/provider.ts';
import { errorMessage, handleOptions, json } from '../_shared/http.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== 'POST') return json({ error: 'method_not_allowed', message: 'Use POST.' }, 405);

  try {
    const auth = await authenticate(req);
    const body = await req.json().catch(() => ({}));
    const connectionId = typeof body.connectionId === 'string' ? body.connectionId : '';
    if (!UUID.test(connectionId)) return json({ error: 'invalid_connection', message: 'Conexão inválida.' }, 400);

    const { data: row, error } = await auth.userClient
      .from('open_finance_connections')
      .select('id, provider, provider_connection_id, institution_id, institution_name')
      .eq('id', connectionId)
      .maybeSingle();
    if (error) throw error;
    if (!row) return json({ error: 'not_found', message: 'Conexão não encontrada.' }, 404);
    if (!row.provider_connection_id) {
      return json({ error: 'connection_pending', message: 'A conexão ainda não possui autorização para revogar.' }, 409);
    }

    const adapter = getProviderAdapter();
    const connection: ProviderConnection = {
      id: row.id,
      provider: row.provider,
      providerConnectionId: row.provider_connection_id,
      institutionId: row.institution_id || undefined,
      institutionName: row.institution_name
    };
    await adapter.disconnect(connection);

    const { error: updateError } = await auth.adminClient
      .from('open_finance_connections')
      .update({ status: 'revoked', consent_expires_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('user_id', auth.user.id);
    if (updateError) throw updateError;

    return json({ ok: true });
  } catch (error) {
    const status = error instanceof ProviderNotConfiguredError ? 503 : 500;
    return json({ error: status === 503 ? 'provider_not_configured' : 'disconnect_failed', message: errorMessage(error) }, status);
  }
});
