/**
 * FinanZen - Testes do módulo de sincronização (js/sync.js) com Supabase falso.
 * Nenhuma rede é usada: o cliente simulado guarda as linhas em memória.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { createSyncEnv, flush } = require('./helpers/sync-setup');

const CONFIG = { url: 'https://teste.supabase.co', anonKey: 'anon-key', table: 'finanzen_data' };
const META_KEY = 'finanzen_sync_v1';

function remoteData(desc) {
  return {
    transactions: [{
      id: 'tx-remoto',
      description: desc,
      amount: 10,
      type: 'expense',
      category: 'cat_outros_exp',
      date: '2026-01-01',
      status: 'paid'
    }],
    budgets: [],
    goals: [],
    accounts: [],
    customCategories: [],
    recurring: []
  };
}

test('sem config o módulo fica desativado', () => {
  const env = createSyncEnv({ config: {} });
  assert.strictEqual(env.sync.isConfigured(), false);
});

test('init cria o cliente e fica "não conectado"', async () => {
  const env = createSyncEnv({ config: CONFIG });
  assert.strictEqual(env.sync.isConfigured(), true);
  await env.sync.init();
  assert.strictEqual(env.fake.state.createClientCalls, 1);
  assert.strictEqual(env.sync.status, 'signed-out');
  assert.strictEqual(env.sync.user, null);
});

test('entrar baixa automaticamente quando a nuvem é mais recente (regressão syncUp)', async () => {
  const env = createSyncEnv({
    config: CONFIG,
    rows: [{
      user_id: 'user-1',
      data: remoteData('Compra vinda da nuvem'),
      settings: { theme: 'light', currency: 'USD' },
      updated_at: '2099-01-01T00:00:00.000Z'
    }]
  });

  await env.sync.init();
  await env.sync.signIn('eu@teste.com', 'segredo1');
  await flush();

  assert.strictEqual(env.sync.user.id, 'user-1');
  assert.strictEqual(env.sync.status, 'synced');
  assert.strictEqual(env.state.data.transactions[0].description, 'Compra vinda da nuvem');
  assert.strictEqual(env.state.settings.theme, 'light');
  assert.ok(env.storage.getItem(META_KEY), 'metadados de sync gravados');
});

test('primeiro login sem dados na nuvem envia o estado local', async () => {
  const env = createSyncEnv({ config: CONFIG });
  await env.sync.init();
  env.sync.user = { id: 'user-1', email: 'eu@teste.com' };

  const r = await env.sync.pullIfNewer();

  assert.strictEqual(r.ok, true);
  const row = env.fake.rows.get('user-1');
  assert.ok(row, 'linha criada na nuvem');
  assert.strictEqual(row.data.transactions.length, env.state.data.transactions.length);
});

test('nuvem mais antiga não sobrescreve o local (last-write-wins)', async () => {
  const env = createSyncEnv({
    config: CONFIG,
    rows: [{
      user_id: 'user-1',
      data: remoteData('Registro antigo'),
      settings: {},
      updated_at: '2000-01-01T00:00:00.000Z'
    }]
  });
  env.storage.setItem(META_KEY, JSON.stringify({ lastSyncedAt: '2025-06-01T00:00:00.000Z' }));

  await env.sync.init();
  env.sync.user = { id: 'user-1', email: 'eu@teste.com' };
  const localDesc = env.state.data.transactions[0].description;

  await env.sync.pullIfNewer();

  assert.strictEqual(env.state.data.transactions[0].description, localDesc, 'local preservado');
  assert.strictEqual(env.fake.rows.get('user-1').data.transactions[0].description, localDesc, 'local enviado');
});

test('pull normaliza coleções e atualiza a interface', async () => {
  const env = createSyncEnv({
    config: CONFIG,
    rows: [{
      user_id: 'user-1',
      data: {
        transactions: [],
        budgets: [],
        goals: [],
        accounts: [{ name: 'Conta X', type: 'bank', openingBalance: 5 }],
        customCategories: [{ name: 'Pets' }],
        recurring: []
      },
      settings: { theme: 'light', currency: 'USD' },
      updated_at: '2099-01-01T00:00:00.000Z'
    }]
  });

  await env.sync.init();
  env.sync.user = { id: 'user-1', email: 'eu@teste.com' };
  let rendered = 0;
  env.window.app = { renderAll() { rendered += 1; } };

  await env.sync.pull();

  assert.ok(env.state.data.accounts[0].id, 'conta normalizada ganhou id');
  assert.strictEqual(env.state.settings.currency, 'USD');
  assert.strictEqual(rendered, 1, 'renderAll chamado após o pull');
});

test('alterações locais não são enviadas quando não há usuário', async () => {
  const env = createSyncEnv({ config: CONFIG });
  await env.sync.init();

  env.state.addTransaction({ description: 'Offline', amount: 9, type: 'expense' });
  await flush();

  assert.strictEqual(env.sync._pushTimer, null, 'nenhum envio agendado');
  assert.strictEqual(env.fake.rows.size, 0, 'nuvem intocada');
});

test('push grava os dados e atualiza lastSyncedAt', async () => {
  const env = createSyncEnv({ config: CONFIG });
  await env.sync.init();
  env.sync.user = { id: 'user-1', email: 'eu@teste.com' };

  const r = await env.sync.push();

  assert.strictEqual(r.ok, true);
  assert.ok(env.fake.rows.get('user-1').data.transactions.length > 0);
  const meta = JSON.parse(env.storage.getItem(META_KEY));
  assert.ok(meta.lastSyncedAt, 'lastSyncedAt salvo');
  assert.strictEqual(env.sync.status, 'synced');
});

test('signIn com senha curta retorna erro e não conecta', async () => {
  const env = createSyncEnv({ config: CONFIG });
  await env.sync.init();

  const r = await env.sync.signIn('eu@teste.com', '123');

  assert.ok(r.error);
  assert.strictEqual(env.sync.user, null);
  assert.strictEqual(env.sync.status, 'error');
});

test('signOut limpa o usuário', async () => {
  const env = createSyncEnv({ config: CONFIG });
  await env.sync.init();
  await env.sync.signIn('eu@teste.com', 'segredo1');
  await flush();

  await env.sync.signOut();

  assert.strictEqual(env.sync.user, null);
  assert.strictEqual(env.sync.status, 'signed-out');
});
