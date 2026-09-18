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
  url: '',      // 'https://rodhpdsfkdkayxegqfah.supabase.co'
  anonKey: '',  // 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvZGhwZHNma2RrYXl4ZWdxZmFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2ODU1MDUsImV4cCI6MjEwNTI2MTUwNX0.WajR2uV5Z2PmYPgk3Gx2cNB55X8csUbRY0MH7yMQBkE'
  table: 'finanzen_data'
};
