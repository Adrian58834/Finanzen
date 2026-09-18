/**
 * FinanZen - Ambiente de teste do módulo de sincronização (sem rede).
 * Carrega js/state.js e js/sync.js em um contexto isolado (vm) com um
 * cliente Supabase falso em memória.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class MemoryStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

// Cliente Supabase simulado: guarda as linhas em um Map (user_id -> row).
function makeFakeSupabase(initialRows) {
  const rows = new Map();
  const state = { createClientCalls: 0 };
  (initialRows || []).forEach(row => rows.set(row.user_id, { ...row }));

  const supabase = {
    createClient() {
      state.createClientCalls += 1;
      const subs = [];
      const auth = {
        _session: null,
        async getSession() {
          return { data: { session: auth._session } };
        },
        onAuthStateChange(cb) {
          subs.push(cb);
          return { data: { subscription: { unsubscribe() {} } } };
        },
        async signInWithPassword({ email, password }) {
          if (!password || password.length < 6) {
            return { data: { session: null }, error: { message: 'Senha inválida' } };
          }
          auth._session = { user: { id: 'user-1', email } };
          subs.forEach(cb => cb('SIGNED_IN', auth._session));
          return { data: { session: auth._session }, error: null };
        },
        async signUp({ email, password }) {
          if (!password || password.length < 6) {
            return { data: { session: null }, error: { message: 'Senha curta' } };
          }
          auth._session = { user: { id: 'user-1', email } };
          subs.forEach(cb => cb('SIGNED_IN', auth._session));
          return { data: { session: auth._session }, error: null };
        },
        async signOut() {
          auth._session = null;
          subs.forEach(cb => cb('SIGNED_OUT', null));
          return { error: null };
        }
      };

      const client = {
        auth,
        from() {
          return {
            upsert(payload) {
              rows.set(payload.user_id, {
                data: payload.data,
                settings: payload.settings,
                updated_at: payload.updated_at
              });
              return Promise.resolve({ error: null });
            },
            select() {
              const q = {
                _uid: null,
                eq(col, val) {
                  q._uid = val;
                  return q;
                },
                maybeSingle() {
                  const row = rows.get(q._uid);
                  return Promise.resolve({ data: row ? { ...row } : null, error: null });
                }
              };
              return q;
            }
          };
        }
      };
      return client;
    }
  };

  return { supabase, rows, state };
}

function readJs(file) {
  return fs.readFileSync(path.resolve(__dirname, '..', '..', 'js', file), 'utf8');
}

function createSyncEnv({ config = {}, rows = [] } = {}) {
  const storage = new MemoryStorage();
  const domReady = [];
  const window = { FINANZEN_SUPABASE: config, financialState: null };
  const document = {
    addEventListener(type, cb) {
      if (type === 'DOMContentLoaded') domReady.push(cb);
    },
    getElementById() {
      return null;
    },
    createElement: () => ({ style: {}, setAttribute() {}, click() {}, remove() {} }),
    body: { appendChild() {}, removeChild() {} }
  };
  const fake = makeFakeSupabase(rows);

  const sandbox = {
    window,
    document,
    localStorage: storage,
    supabase: fake.supabase,
    console,
    setTimeout,
    clearTimeout
  };
  window.localStorage = storage;

  const context = vm.createContext(sandbox);
  vm.runInContext(readJs('state.js'), context, { filename: 'js/state.js' });
  vm.runInContext(readJs('sync.js'), context, { filename: 'js/sync.js' });

  return {
    window,
    document,
    storage,
    fake,
    domReady,
    state: window.financialState,
    sync: window.financeSync
  };
}

// Aguarda o escoamento das microtasks (promessas) pendentes.
const flush = () => new Promise(resolve => setImmediate(resolve));

module.exports = { createSyncEnv, MemoryStorage, flush };
