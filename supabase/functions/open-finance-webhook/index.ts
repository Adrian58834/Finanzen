import { createClient } from 'npm:@supabase/supabase-js@2';
import { getProviderAdapter, ProviderNotConfiguredError } from '../_shared/provider.ts';
import { errorMessage, json } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed', message: 'Use POST.' }, 405);

  try {
    // A validação da assinatura é obrigatória e pertence ao adaptador, pois o
    // cabeçalho e o algoritmo variam entre provedores.
    const adapter = getProviderAdapter();
    const event = await adapter.parseWebhook(req);
    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceKey) throw new Error('Supabase não configurado no backend.');
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const { error } = await admin.from('open_finance_webhook_events').upsert({
      provider: adapter.name,
      provider_event_id: event.id,
      event_type: event.type,
      connection_reference: event.providerConnectionId || null,
      payload: event.payload,
      status: 'received'
    }, { onConflict: 'provider,provider_event_id', ignoreDuplicates: true });
    if (error) throw error;

    if (event.providerConnectionId && event.connectionStatus) {
      await admin.from('open_finance_connections')
        .update({ status: event.connectionStatus })
        .eq('provider', adapter.name)
        .eq('provider_connection_id', event.providerConnectionId);
    }

    return json({ received: true }, 202);
  } catch (error) {
    const status = error instanceof ProviderNotConfiguredError ? 503 : 400;
    return json({ error: status === 503 ? 'provider_not_configured' : 'invalid_webhook', message: errorMessage(error) }, status);
  }
});
