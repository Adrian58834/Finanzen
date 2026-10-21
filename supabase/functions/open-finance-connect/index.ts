import { authenticate } from '../_shared/auth.ts';
import { getProviderAdapter, ProviderNotConfiguredError } from '../_shared/provider.ts';
import { errorMessage, handleOptions, json } from '../_shared/http.ts';

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== 'POST') return json({ error: 'method_not_allowed', message: 'Use POST.' }, 405);

  try {
    const { user } = await authenticate(req);
    const body = await req.json().catch(() => ({}));
    const callbackUrl = typeof body.callbackUrl === 'string' ? body.callbackUrl : '';
    const allowedOrigin = Deno.env.get('APP_ORIGIN');

    if (!allowedOrigin) return json({ error: 'missing_app_origin', message: 'Configure APP_ORIGIN no backend.' }, 503);

    let callback: URL;
    try {
      callback = new URL(callbackUrl);
    } catch {
      return json({ error: 'invalid_callback', message: 'URL de retorno inválida.' }, 400);
    }

    if (callback.origin !== new URL(allowedOrigin).origin) {
      return json({ error: 'invalid_callback_origin', message: 'Origem de retorno não permitida.' }, 400);
    }

    const adapter = getProviderAdapter();
    const session = await adapter.createConnectSession({ userId: user.id, callbackUrl: callback.href });
    return json({ authorizationUrl: session.authorizationUrl });
  } catch (error) {
    const status = error instanceof ProviderNotConfiguredError ? 503 : 401;
    return json({ error: status === 503 ? 'provider_not_configured' : 'unauthorized', message: errorMessage(error) }, status);
  }
});
