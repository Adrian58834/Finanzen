/**
 * FinanZen - Testes do módulo de sincronização (js/sync.js) com Supabase falso.
 * Nenhuma rede é usada: o cliente simulado guarda as linhas em memória.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { createSyncEnv, flush } = require('./helpers/sync-setup');

const CONFIG = { url: 'https://teste.supabase.co', anonKey: 'anon-key', table: 'finanzen_data' };
const META_KEY = 'finanzen_sync_v1:user-1';

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

test('edição local pendente prevalece sem depender do relógio da nuvem', async () => {
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

  env.state.saveData();

  await env.sync.pullIfNewer();

  assert.strictEqual(env.state.data.transactions[0].description, localDesc, 'local preservado');
  assert.strictEqual(env.fake.rows.get('user-1').data.transactions[0].description, localDesc, 'local enviado');
});

test('edição local depois do último sync vence nuvem mais nova (sem perda de dados)', async () => {
  const env = createSyncEnv({
    config: CONFIG,
    rows: [{
      user_id: 'user-1',
      data: remoteData('Registro de outro aparelho'),
      settings: {},
      updated_at: '2050-01-01T00:00:00.000Z'
    }]
  });
  // Último sync antigo, mas o usuário alterou os dados localmente depois disso.
  env.storage.setItem(META_KEY, JSON.stringify({ lastSyncedAt: '2025-06-01T00:00:00.000Z' }));
  env.storage.setItem('finanzen_last_local_change', String(new Date('2060-01-01T00:00:00.000Z').getTime()));

  await env.sync.init();
  env.sync.user = { id: 'user-1', email: 'eu@teste.com' };
  const localDesc = env.state.data.transactions[0].description;

  env.state.saveData();

  await env.sync.pullIfNewer();

  assert.strictEqual(env.state.data.transactions[0].description, localDesc, 'edição local preservada');
  assert.strictEqual(env.fake.rows.get('user-1').data.transactions[0].description, localDesc, 'edição local enviada');
  assert.ok(env.state.data.transactions.some(tx => tx.id === 'tx-remoto'), 'registro exclusivo da nuvem também é preservado');
  assert.ok(env.fake.rows.get('user-1').data.transactions.some(tx => tx.id === 'tx-remoto'), 'merge seguro é salvo na nuvem');
  assert.ok(env.state.getRecoverySnapshots().length > 0, 'sincronização cria ponto de recuperação');
});

test('push seguro não apaga registros que existem apenas na nuvem', async () => {
  const env = createSyncEnv({
    config: CONFIG,
    rows: [{
      user_id: 'user-1',
      data: remoteData('Somente na nuvem'),
      settings: {},
      updated_at: '2026-01-01T00:00:00.000Z'
    }]
  });
  await env.sync.init();
  env.sync.user = { id: 'user-1', email: 'eu@teste.com' };
  env.state.addTransaction({ id: 'tx-local-nova', description: 'Somente local', amount: 50, type: 'income', date: '2026-10-01' });

  await env.sync.push({ preferLocal: true });

  const saved = env.fake.rows.get('user-1').data.transactions;
  assert.ok(saved.some(tx => tx.id === 'tx-remoto'));
  assert.ok(saved.some(tx => tx.description === 'Somente local'));
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

test('pull rejeita documento remoto inválido sem sobrescrever dados locais', async () => {
  const env = createSyncEnv({
    config: CONFIG,
    rows: [{
      user_id: 'user-1',
      data: { transactions: 'não-é-array' },
      settings: {},
      updated_at: '2099-01-01T00:00:00.000Z'
    }]
  });
  await env.sync.init();
  env.sync.user = { id: 'user-1', email: 'eu@teste.com' };
  const localDescription = env.state.data.transactions[0].description;

  const result = await env.sync.pull();

  assert.ok(result.error);
  assert.strictEqual(env.state.data.transactions[0].description, localDescription);
  assert.strictEqual(env.sync.status, 'error');
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

test('push registra o timestamp retornado pelo servidor', async () => {
  const env = createSyncEnv({ config: CONFIG });
  await env.sync.init();
  env.sync.user = { id: 'user-1', email: 'eu@teste.com' };
  env.fake.state.serverUpdatedAt = '2035-04-05T10:20:30.000Z';

  await env.sync.push();

  const meta = JSON.parse(env.storage.getItem(META_KEY));
  assert.strictEqual(meta.lastSyncedAt, '2035-04-05T10:20:30.000Z');
  assert.strictEqual(env.sync.lastSyncedAt, '2035-04-05T10:20:30.000Z');
});

test('signIn com senha curta retorna erro e não conecta', async () => {
  const env = createSyncEnv({ config: CONFIG });
  await env.sync.init();

  const r = await env.sync.signIn('eu@teste.com', '123');

  assert.ok(r.error);
  assert.strictEqual(env.sync.user, null);
  assert.strictEqual(env.sync.status, 'error');
});

test('verificação de senha usa cliente isolado e preserva a sessão principal', async () => {
  const env = createSyncEnv({ config: CONFIG });
  await env.sync.init();
  env.sync.user = { id: 'user-1', email: 'eu@teste.com' };

  const invalid = await env.sync.verifyPassword('123');
  const valid = await env.sync.verifyPassword('segredo1');

  assert.ok(invalid.error);
  assert.strictEqual(valid.ok, true);
  assert.strictEqual(env.sync.user.email, 'eu@teste.com');
  assert.strictEqual(env.fake.state.createClientCalls, 2, 'deve criar um cliente temporário para validar');
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

function selectUser(env, id) {
  const user = id ? { id, email: `${id}@teste.com` } : null;
  env.sync.client.auth._session = user ? { user } : null;
  env.sync.changeUser(user);
}

test('contas isolam dados, preferências, recuperação e metadados sem migrar o legado automaticamente', async () => {
  const env = createSyncEnv({ config: CONFIG });
  env.state.saveSettings({ currency: 'EUR' });
  const legacy = env.storage.getItem(env.state.STORAGE_KEY);
  await env.sync.init();
  selectUser(env, 'user-1');
  assert.strictEqual(env.state.data.transactions.length, 0);
  env.state.addTransaction({ description: 'Privado A', amount: 10, type: 'income' });
  env.state.saveSettings({ currency: 'USD' });
  env.state.createRecoverySnapshot('A');
  await env.sync.push();
  selectUser(env, 'user-2');
  assert.strictEqual(env.state.data.transactions.length, 0);
  assert.strictEqual(env.state.settings.currency, 'BRL');
  assert.strictEqual(env.state.getRecoverySnapshots().length, 0);
  assert.strictEqual(env.sync.lastSyncedAt, null);
  await env.sync.push();
  assert.strictEqual(env.fake.rows.get('user-2').data.transactions.length, 0);
  selectUser(env, 'user-1');
  assert.strictEqual(env.state.data.transactions[0].description, 'Privado A');
  assert.strictEqual(env.state.settings.currency, 'USD');
  assert.ok(env.state.getRecoverySnapshots().length);
  await env.sync.signOut();
  assert.strictEqual(env.state.settings.currency, 'EUR');
  assert.strictEqual(env.storage.getItem('finanzen_data_v1'), legacy);
  clearTimeout(env.sync._pushTimer);
});

test('resposta de leitura da sessão anterior não altera a conta atual', async () => {
  const env = createSyncEnv({ config: CONFIG, rows: [{ user_id: 'user-1', data: remoteData('Segredo A'), settings: {}, updated_at: '2099-01-01' }] });
  await env.sync.init();
  selectUser(env, 'user-1');
  let release;
  let started;
  const reading = new Promise(resolve => { started = resolve; });
  env.fake.state.beforeRead = () => { started(); return new Promise(resolve => { release = resolve; }); };
  const pending = env.sync.pull();
  await reading;
  selectUser(env, 'user-2');
  release();
  assert.ok((await pending).error);
  assert.strictEqual(env.state.data.transactions.length, 0);
  assert.strictEqual(env.storage.getItem(env.sync.metaKey()), null);
});

test('troca de sessão durante envio não grava dados A na conta B', async () => {
  const env = createSyncEnv({ config: CONFIG });
  await env.sync.init();
  selectUser(env, 'user-1');
  env.state.addTransaction({ description: 'Privado A', amount: 12, type: 'income' });
  let release;
  let started;
  const writing = new Promise(resolve => { started = resolve; });
  env.fake.state.beforeWrite = () => { started(); return new Promise(resolve => { release = resolve; }); };
  const pending = env.sync.push();
  await writing;
  selectUser(env, 'user-2');
  release();
  assert.ok((await pending).error);
  assert.strictEqual(env.fake.rows.has('user-2'), false);
  assert.strictEqual(env.state.data.transactions.length, 0);
});

test('conflito de revisão relê a nuvem e preserva registros de ambos os aparelhos', async () => {
  const env = createSyncEnv({ config: CONFIG, rows: [{ user_id: 'user-1', data: remoteData('Inicial'), settings: {}, updated_at: '2026-01-01' }] });
  await env.sync.init();
  selectUser(env, 'user-1');
  env.state.addTransaction({ description: 'Local', amount: 12, type: 'income' });
  env.fake.state.beforeWrite = () => {
    env.fake.state.beforeWrite = null;
    const row = env.fake.rows.get('user-1');
    row.data.transactions.push({ ...row.data.transactions[0], id: 'tx-outro-aparelho', description: 'Concorrente' });
    row.revision += 1;
  };
  assert.strictEqual((await env.sync.push()).ok, true);
  const saved = env.fake.rows.get('user-1').data.transactions;
  assert.ok(saved.some(tx => tx.description === 'Local'));
  assert.ok(saved.some(tx => tx.description === 'Concorrente'));
  assert.strictEqual(env.fake.state.rpcCalls, 2);
  clearTimeout(env.sync._pushTimer);
});

test('conflitos contínuos encerram com erro sem marcar sincronização concluída', async () => {
  const env = createSyncEnv({ config: CONFIG, rows: [{ user_id: 'user-1', data: remoteData('Original'), settings: {}, updated_at: '2026-01-01' }] });
  await env.sync.init();
  selectUser(env, 'user-1');
  env.fake.state.beforeWrite = () => { env.fake.rows.get('user-1').revision += 1; };
  assert.ok((await env.sync.push()).error);
  assert.strictEqual(env.fake.state.rpcCalls, 3);
  assert.strictEqual(env.sync.status, 'error');
  assert.strictEqual(env.storage.getItem(env.sync.metaKey()), null);
});

test('edição durante envio continua pendente e é enviada na próxima sincronização', async () => {
  const env = createSyncEnv({ config: CONFIG });
  await env.sync.init();
  selectUser(env, 'user-1');
  env.state.addTransaction({ description: 'Primeira', amount: 12, type: 'income' });
  env.fake.state.beforeWrite = () => {
    env.fake.state.beforeWrite = null;
    env.state.addTransaction({ description: 'Durante envio', amount: 20, type: 'income' });
  };
  await env.sync.push();
  assert.ok(env.state.changeVersion > env.sync.loadMeta().lastLocalChangeAt);
  assert.strictEqual(env.sync.status, 'syncing');
  assert.strictEqual(env.fake.rows.get('user-1').data.transactions.length, 1);
  await env.sync.push();
  assert.strictEqual(env.fake.rows.get('user-1').data.transactions.length, 2);
  assert.strictEqual(env.sync.status, 'synced');
  clearTimeout(env.sync._pushTimer);
});

test('merge de três vias preserva alterações independentes em registros já existentes', async () => {
  const env = createSyncEnv({ config: CONFIG });
  await env.sync.init();
  selectUser(env, 'user-1');
  const first = env.state.addTransaction({ description: 'Primeiro', amount: 12, type: 'income' });
  const second = env.state.addTransaction({ description: 'Segundo', amount: 20, type: 'income' });
  await env.sync.push();
  env.state.updateTransaction(first.id, { description: 'Editado localmente' });
  const row = env.fake.rows.get('user-1');
  row.data.transactions.find(tx => tx.id === second.id).description = 'Editado remotamente';
  row.revision += 1;
  await env.sync.push();
  const saved = env.fake.rows.get('user-1').data.transactions;
  assert.strictEqual(saved.find(tx => tx.id === first.id).description, 'Editado localmente');
  assert.strictEqual(saved.find(tx => tx.id === second.id).description, 'Editado remotamente');
  clearTimeout(env.sync._pushTimer);
});

test('envios solicitados juntos são serializados', async () => {
  const env = createSyncEnv({ config: CONFIG });
  await env.sync.init();
  selectUser(env, 'user-1');
  let active = 0;
  let maximum = 0;
  env.fake.state.beforeWrite = async () => {
    active += 1;
    maximum = Math.max(maximum, active);
    await flush();
    active -= 1;
  };
  const results = await Promise.all([env.sync.push(), env.sync.push(), env.sync.pullIfNewer()]);
  assert.ok(results.every(result => result.ok));
  assert.strictEqual(maximum, 1);
});

test('backend sem RPC falha com instrução de atualização e preserva dados locais', async () => {
  const env = createSyncEnv({ config: CONFIG });
  await env.sync.init();
  selectUser(env, 'user-1');
  env.sync.client.rpc = async () => ({ error: { message: 'Function not found' } });
  const before = JSON.stringify(env.state.data);
  const result = await env.sync.push();
  assert.match(result.error, /schema.sql/);
  assert.strictEqual(JSON.stringify(env.state.data), before);
  assert.strictEqual(env.sync.status, 'error');
});

test('falha de persistência ao receber não atualiza dados nem metadados de sucesso', async () => {
  const env = createSyncEnv({ config: CONFIG, rows: [{ user_id: 'user-1', data: remoteData('Remoto'), settings: {}, updated_at: '2099-01-01' }] });
  await env.sync.init();
  selectUser(env, 'user-1');
  const original = env.storage.setItem.bind(env.storage);
  env.storage.setItem = (key, value) => {
    if (key === env.state.STORAGE_KEY) throw new Error('QuotaExceededError');
    original(key, value);
  };
  assert.ok((await env.sync.pull()).error);
  assert.strictEqual(env.state.data.transactions.length, 0);
  assert.strictEqual(env.storage.getItem(env.sync.metaKey()), null);
  assert.strictEqual(env.sync.status, 'error');
});
