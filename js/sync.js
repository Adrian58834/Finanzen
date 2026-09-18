/**
 * FinanZen - Sincronização em nuvem (Supabase)
 *
 * Estratégia "last-write-wins": o registro mais recente (updated_at) vence.
 * Sem configuração em sync-config.js o módulo fica inativo e o app segue local.
 */
(function () {
  const META_KEY = 'finanzen_sync_v1';
  const PUSH_DEBOUNCE = 1500;

  const config = window.FINANZEN_SUPABASE || {};
  const supported = typeof supabase !== 'undefined' && supabase.createClient;

  const sync = {
    client: null,
    user: null,
    status: 'disabled', // disabled | signed-out | syncing | synced | error
    lastSyncedAt: null,
    lastError: null,
    _pushTimer: null,
    _ready: false,

    // ---- Configuração ----
    isConfigured() {
      return Boolean(config.url && config.anonKey && supported);
    },

    loadMeta() {
      try {
        return JSON.parse(localStorage.getItem(META_KEY) || '{}') || {};
      } catch (e) {
        return {};
      }
    },

    saveMeta(partial) {
      const meta = { ...this.loadMeta(), ...partial };
      localStorage.setItem(META_KEY, JSON.stringify(meta));
    },

    // ---- Inicialização ----
    async init() {
      this.lastSyncedAt = this.loadMeta().lastSyncedAt || null;

      if (!this.isConfigured()) {
        this.status = 'disabled';
        this.render();
        return;
      }

      try {
        this.client = supabase.createClient(config.url, config.anonKey, {
          auth: { persistSession: true, autoRefreshToken: true }
        });
      } catch (e) {
        this.status = 'error';
        this.lastError = 'Falha ao iniciar o Supabase.';
        this.render();
        return;
      }

      this.client.auth.onAuthStateChange((event, session) => {
        this.user = session ? session.user : null;
        if (event === 'SIGNED_IN' && this.user) {
          this.status = 'syncing';
          this.render();
          this.pullIfNewer().then(() => this.render());
        } else if (event === 'SIGNED_OUT') {
          this.setStatus('signed-out');
        }
      });

      const { data } = await this.client.auth.getSession();
      this.user = data.session ? data.session.user : null;
      this.status = this.user ? 'synced' : 'signed-out';
      this.render();

      // Sessão já existente (ex.: reabrir o app): busca novidades da nuvem
      if (this.user) {
        await this.pullIfNewer();
        this.render();
      }
    },

    table() {
      return config.table || 'finanzen_data';
    },

    // ---- Autenticação ----
    async signUp(email, password) {
      if (!this.client) return { error: 'Sincronização não configurada.' };
      this.setStatus('syncing');
      const { error } = await this.client.auth.signUp({ email, password });
      if (error) { this.setError(error.message); return { error: error.message }; }
      return { ok: true };
    },

    async signIn(email, password) {
      if (!this.client) return { error: 'Sincronização não configurada.' };
      this.setStatus('syncing');
      const { error } = await this.client.auth.signInWithPassword({ email, password });
      if (error) { this.setError(error.message); return { error: error.message }; }
      return { ok: true };
    },

    async signOut() {
      if (!this.client) return;
      await this.client.auth.signOut();
      this.user = null;
      this.setStatus('signed-out');
    },

    // ---- Push / Pull ----
    payload() {
      const state = window.financialState;
      return {
        user_id: this.user.id,
        data: state.data,
        settings: state.settings,
        updated_at: new Date().toISOString()
      };
    },

    async push() {
      if (!this.user) return { error: 'Não autenticado.' };
      this.setStatus('syncing');
      const { error } = await this.client
        .from(this.table())
        .upsert(this.payload(), { onConflict: 'user_id' });

      if (error) { this.setError(error.message); return { error: error.message }; }

      this.lastSyncedAt = new Date().toISOString();
      this.saveMeta({ lastSyncedAt: this.lastSyncedAt });
      this.setStatus('synced');
      return { ok: true };
    },

    async fetchRemote() {
      if (!this.user) return { error: 'Não autenticado.' };
      const { data, error } = await this.client
        .from(this.table())
        .select('data, settings, updated_at')
        .eq('user_id', this.user.id)
        .maybeSingle();

      if (error) { this.setError(error.message); return { error: error.message }; }
      return { row: data || null };
    },

    async pull() {
      const { row, error } = await this.fetchRemote();
      if (error) return { error };
      if (!row || !row.data) return { ok: true, empty: true };

      const state = window.financialState;
      state._suspendSync = true;
      try {
        state.data = row.data;
        state.data.accounts = state.normalizeAccounts(state.data.accounts);
        state.data.customCategories = state.normalizeCustomCategories(state.data.customCategories);
        state.data.recurring = state.normalizeRecurring(state.data.recurring);
        if (row.settings) state.saveSettings(row.settings);
        localStorage.setItem(state.STORAGE_KEY, JSON.stringify(state.data));
      } finally {
        state._suspendSync = false;
      }

      this.lastSyncedAt = row.updated_at || new Date().toISOString();
      this.saveMeta({ lastSyncedAt: this.lastSyncedAt });
      this.setStatus('synced');
      if (window.app && typeof window.app.renderAll === 'function') window.app.renderAll();
      return { ok: true };
    },

    // Decide o que fazer no login: remoto mais novo baixa, senão envia
    async pullIfNewer() {
      const { row, error } = await this.fetchRemote();
      if (error) return { error };

      if (!row || !row.data) return this.push();

      const remoteTime = new Date(row.updated_at).getTime();
      const localTime = this.lastLocalChangeTime();

      if (remoteTime > localTime) {
        return this.pull();
      }
      return this.push();
    },

    lastLocalChangeTime() {
      const meta = this.loadMeta();
      return new Date(meta.lastSyncedAt || 0).getTime();
    },

    // Chamado pelo app sempre que os dados mudam (com debounce)
    schedulePush() {
      if (!this.user) return;
      clearTimeout(this._pushTimer);
      this._pushTimer = setTimeout(() => {
        this.push().then(() => {
          if (window.app && window.app.renderSyncPanel) window.app.renderSyncPanel();
        });
      }, PUSH_DEBOUNCE);
    },

    setStatus(status) {
      this.status = status;
      if (status !== 'error') this.lastError = null;
      this.render();
    },

    setError(message) {
      this.status = 'error';
      this.lastError = message;
      this.render();
    },

    // ---- UI ----
    render() {
      if (window.app && typeof window.app.renderSyncPanel === 'function') {
        window.app.renderSyncPanel();
      }
    }
  };

  window.financeSync = sync;

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => sync.init(), 0);
  });
})();
