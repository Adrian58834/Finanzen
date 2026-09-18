/**
 * FinanZen - Configuração do Supabase (sincronização em nuvem)
 *
 * 1. Crie um projeto grátis em https://supabase.com
 * 2. Em "Project Settings > API", copie a "Project URL" e a chave "anon public".
 * 3. Cole abaixo e rode o SQL de `supabase/schema.sql` no SQL Editor do Supabase.
 *
 * Enquanto os campos estiverem vazios, o app funciona 100% local e a
 * sincronização fica desativada (nenhum dado sai do dispositivo).
 */
window.FINANZEN_SUPABASE = {
  url: '',      // ex: 'https://abcdefghij.supabase.co'
  anonKey: '',  // ex: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  table: 'finanzen_data'
};
