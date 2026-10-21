import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2';

export type AuthContext = {
  user: User;
  userClient: SupabaseClient;
  adminClient: SupabaseClient;
};

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`);
  return value;
}

export async function authenticate(req: Request): Promise<AuthContext> {
  const authorization = req.headers.get('Authorization');
  if (!authorization) throw new Error('Sessão ausente. Entre novamente no FinanZen.');

  const url = requiredEnv('SUPABASE_URL');
  const publicKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  if (!publicKey) throw new Error('Chave pública do Supabase não configurada.');

  const userClient = createClient(url, publicKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) throw new Error('Sessão inválida ou expirada.');

  const adminClient = createClient(url, requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  return { user: data.user, userClient, adminClient };
}
