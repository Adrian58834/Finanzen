/**
 * FinanZen - testes do cliente Open Finance sem rede.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');

function createEnv(config = {}) {
  const assigned = [];
  const listeners = [];
  const window = {
    FINANZEN_OPEN_FINANCE: config,
    financeSync: { client: null, user: null },
    location: {
      origin: 'https://finanzen.example',
      pathname: '/app/',
      assign(url) { assigned.push(url); }
    }
  };
  const document = {
    addEventListener(type, callback) {
      if (type === 'DOMContentLoaded') listeners.push(callback);
    }
  };
  const context = vm.createContext({ window, document, URL, setTimeout, clearTimeout, console });
  const source = fs.readFileSync(path.join(ROOT, 'js', 'open-finance.js'), 'utf8');
  vm.runInContext(source, context, { filename: 'js/open-finance.js' });
  return { service: window.financeOpenFinance, window, assigned };
}

test('Open Finance permanece bloqueado enquanto o provedor não está configurado', async () => {
  const { service } = createEnv({ enabled: false, provider: '' });
  assert.strictEqual(service.isEnabled(), false);

  const result = await service.invoke('connect', {});
  assert.match(result.error, /provedor/i);
});

test('Open Finance exige usuário autenticado mesmo quando habilitado', async () => {
  const { service } = createEnv({ enabled: true, provider: 'sandbox' });
  assert.strictEqual(service.isEnabled(), true);
  assert.strictEqual(service.isReady(), false);

  const result = await service.invoke('connect', {});
  assert.match(result.error, /entre/i);
});

test('cliente rejeita redirecionamento de autorização sem HTTPS', async () => {
  const { service, assigned } = createEnv({ enabled: true, provider: 'sandbox' });
  service.invoke = async () => ({ ok: true, data: { authorizationUrl: 'http://inseguro.example/autorizar' } });

  const result = await service.connect();

  assert.match(result.error, /HTTPS/i);
  assert.deepStrictEqual(assigned, []);
});

test('schema Open Finance mantém dados normalizados e RLS habilitado', () => {
  const sql = fs.readFileSync(path.join(ROOT, 'supabase', 'open-finance-schema.sql'), 'utf8');
  for (const table of ['open_finance_connections', 'open_finance_accounts', 'open_finance_transactions', 'open_finance_sync_runs', 'open_finance_webhook_events']) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
  }
  assert.doesNotMatch(sql, /client_secret|access_token|refresh_token/i, 'tokens não devem existir nas tabelas públicas');
});

test('resposta antiga de Open Finance é descartada após sair da conta', async () => {
  const { service, window } = createEnv({ enabled: true, provider: 'sandbox' });
  let release;
  window.financeSync.user = { id: 'A' };
  window.financeSync.client = { from() { return { select() { return { order() {
    return new Promise(resolve => { release = resolve; });
  } }; } }; } };
  const pending = service.refresh();
  window.financeSync.user = null;
  await service.onAuthChanged();
  release({ data: [{ id: 'conexao-privada-A' }], error: null });
  assert.ok((await pending).error);
  assert.strictEqual(service.connections.length, 0);
  assert.strictEqual(service.status, 'idle');
});
