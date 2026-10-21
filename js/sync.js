/**
 * FinanZen - Sincronização em nuvem (Supabase)
 *
 * Estratégia conservadora: combina registros locais e remotos, registra
 * exclusões e cria pontos de recuperação antes de qualquer substituição.
 * Sem configuração em sync-config.js o módulo fica inativo e o app segue local.
 */
(function () {
  const META_KEY = 'finanzen_sync_v1';
  const PUSH_DEBOUNCE = 1500;
  const AUTO_PULL_INTERVAL = 60000; // 1 min: compara com a nuvem e baixa se mais novo

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
        this.notifyOpenFinance();
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
      this.notifyOpenFinance();

      // Sessão já existente (ex.: reabrir o app): busca novidades da nuvem
      if (this.user) {
        await this.pullIfNewer();
        this.render();
      }

      this.startAutoPull();
    },

    // ---- Sincronização 100% automática ----
    // Só atua se estiver conectado; intervalos e eventos são descartáveis.
    startAutoPull() {
      if (this._autoPullStarted) return;
      this._autoPullStarted = true;

      // 1) A cada minuto: compara com a nuvem e baixa se estiver mais nova
      setInterval(() => {
        if (this.user && !this._pullTimer) this.pullIfNewer();
      }, AUTO_PULL_INTERVAL);

      // 2) Ao voltar para o app (ex.: fechar e reabrir / trocar de aba)
      const onVisible = () => {
        if (document.visibilityState !== 'visible' || !this.user) return;
        this.pullIfNewer();
      };
      document.addEventListener('visibilitychange', onVisible);
      window.addEventListener('focus', onVisible);

      // 3) Reconectou à internet: envia o que estiver local e busca novidades
      window.addEventListener('online', () => {
        if (!this.user) return;
        this.schedulePush();
        this.pullIfNewer();
      });
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

    // Confere a senha sem alterar a sessão principal nem disparar uma nova sincronização.
    async verifyPassword(password) {
      if (!this.client || !this.user || !this.user.email) return { error: 'Não autenticado.' };
      if (typeof password !== 'string' || password.length < 6) return { error: 'Senha inválida.' };

      try {
        const verifier = supabase.createClient(config.url, config.anonKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
          }
        });
        const { error } = await verifier.auth.signInWithPassword({
          email: this.user.email,
          password
        });
        if (error) return { error: 'Senha inválida.' };
        await verifier.auth.signOut();
        return { ok: true };
      } catch (error) {
        return { error: 'Não foi possível validar a senha.' };
      }
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

    async push(options = {}) {
      if (!this.user) return { error: 'Não autenticado.' };
      this.setStatus('syncing');
      const state = window.financialState;

      if (state && typeof state.createRecoverySnapshot === 'function') {
        state.createRecoverySnapshot('Antes de enviar dados para a nuvem', state.data, state.settings, { source: 'sync' });
      }

      if (!options.replaceRemote && !options.skipRemoteMerge) {
        const remoteResult = await this.fetchRemote();
        if (remoteResult.error) return { error: remoteResult.error };
        const remoteRow = remoteResult.row;
        if (remoteRow && remoteRow.data) {
          const normalizedRemote = state.normalizeData(remoteRow.data);
          if (!normalizedRemote) {
            this.setError('A cópia da nuvem é inválida e não foi sobrescrita.');
            return { error: this.lastError };
          }

          state.createRecoverySnapshot('Cópia da nuvem antes da sincronização', normalizedRemote, remoteRow.settings || {}, { source: 'cloud' });
          const remoteTime = new Date(remoteRow.updated_at || 0).getTime();
          const preferLocal = options.preferLocal === true || this.localChangeTime() >= remoteTime;
          const merged = state.mergeData(normalizedRemote, state.data, preferLocal);

          state._suspendSync = true;
          try {
            state.data = merged;
            if (!preferLocal && remoteRow.settings) state.settings = state.normalizeSettings(remoteRow.settings);
            localStorage.setItem(state.STORAGE_KEY, JSON.stringify(state.data));
            localStorage.setItem(state.SETTINGS_KEY, JSON.stringify(state.settings));
          } finally {
            state._suspendSync = false;
          }
        }
      } else if (options.replaceRemote) {
        const remoteResult = await this.fetchRemote();
        if (remoteResult.error) return { error: remoteResult.error };
        if (remoteResult.row && remoteResult.row.data && state && typeof state.createRecoverySnapshot === 'function') {
          state.createRecoverySnapshot('Cópia da nuvem antes da substituição', remoteResult.row.data, remoteResult.row.settings || {}, { source: 'cloud' });
        }
      }

      const payload = this.payload();
      const { error } = await this.client
        .from(this.table())
        .upsert(payload, { onConflict: 'user_id' });

      if (error) { this.setError(error.message); return { error: error.message }; }

      // Usa o timestamp persistido pelo servidor. Comparar horário do servidor
      // com o relógio local pode fazer um aparelho adiantado ignorar mudanças.
      const { data: savedRow } = await this.client
        .from(this.table())
        .select('updated_at')
        .eq('user_id', this.user.id)
        .maybeSingle();
      this.lastSyncedAt = (savedRow && savedRow.updated_at) || payload.updated_at;
      this.saveMeta({
        lastSyncedAt: this.lastSyncedAt,
        lastLocalChangeAt: this.localChangeTime()
      });
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

    async importCloudHistoryToRecovery() {
      if (!this.user) return { error: 'Entre na sua conta para acessar o histórico da nuvem.' };
      const state = window.financialState;
      const { data, error } = await this.client
        .from('finanzen_data_history')
        .select('history_id, data, settings, source_updated_at, archived_at')
        .eq('user_id', this.user.id)
        .order('archived_at', { ascending: false })
        .limit(8);

      if (error) {
        return { error: 'Histórico indisponível. Execute novamente supabase/schema.sql no SQL Editor.' };
      }

      const rows = Array.isArray(data) ? data : [];
      rows.forEach(row => {
        state.createRecoverySnapshot(
          'Versão anterior salva na nuvem',
          row.data,
          row.settings || {},
          { source: 'cloud', createdAt: row.source_updated_at || row.archived_at }
        );
      });
      return { ok: true, count: rows.length };
    },

    async pull(options = {}) {
      const { row, error } = await this.fetchRemote();
      if (error) return { error };
      if (!row || !row.data) return { ok: true, empty: true };

      const state = window.financialState;
      const normalized = state.normalizeData(row.data);
      if (!normalized) {
        this.setError('Dados inválidos recebidos da nuvem.');
        return { error: this.lastError };
      }

      if (typeof state.createRecoverySnapshot === 'function') {
        state.createRecoverySnapshot('Cópia local antes de receber dados da nuvem', state.data, state.settings, { source: 'sync' });
        state.createRecoverySnapshot('Cópia recebida da nuvem', normalized, row.settings || {}, { source: 'cloud' });
      }

      const merged = options.replaceLocal
        ? normalized
        : state.mergeData(state.data, normalized, options.preferLocal !== true);
      state._suspendSync = true;
      try {
        state.data = merged;
        if (row.settings && options.preferLocal !== true) state.settings = state.normalizeSettings(row.settings);
        localStorage.setItem(state.STORAGE_KEY, JSON.stringify(state.data));
        localStorage.setItem(state.SETTINGS_KEY, JSON.stringify(state.settings));
      } finally {
        state._suspendSync = false;
      }

      this.lastSyncedAt = row.updated_at || new Date().toISOString();
      this.saveMeta({
        lastSyncedAt: this.lastSyncedAt,
        lastLocalChangeAt: this.localChangeTime()
      });
      this.setStatus('synced');
      if (window.app && typeof window.app.renderAll === 'function') window.app.renderAll();
      return { ok: true };
    },

    // Decide o que fazer no login: remoto mais novo baixa, senão envia
    async pullIfNewer() {
      const { row, error } = await this.fetchRemote();
      if (error) return { error };

      if (!row || !row.data) return this.push();

      const meta = this.loadMeta();
      const remoteTime = new Date(row.updated_at || 0).getTime();
      const syncedTime = new Date(meta.lastSyncedAt || 0).getTime();
      const lastRecordedLocalChange = parseInt(meta.lastLocalChangeAt || '0', 10) || 0;
      const hasUnsyncedLocalChanges = this.localChangeTime() > lastRecordedLocalChange;

      if (hasUnsyncedLocalChanges && remoteTime > syncedTime) {
        const pullResult = await this.pull({ preferLocal: this.localChangeTime() >= remoteTime });
        if (pullResult && pullResult.error) return pullResult;
        return this.push({ skipRemoteMerge: true });
      }
      if (hasUnsyncedLocalChanges) return this.push({ preferLocal: true });
      if (remoteTime > syncedTime) return this.pull();
      if (remoteTime < syncedTime) return this.push({ preferLocal: true });

      this.lastSyncedAt = row.updated_at || this.lastSyncedAt;
      this.setStatus('synced');
      return { ok: true, unchanged: true };
    },

    localChangeTime() {
      const state = window.financialState;
      const key = (state && state.LAST_CHANGE_KEY) || 'finanzen_last_local_change';
      try {
        return parseInt(localStorage.getItem(key) || '0', 10) || 0;
      } catch (e) {
        return 0;
      }
    },

    // Hora real da última alteração local (não apenas do último sync).
    // Usada para decidir entre baixar da nuvem ou enviar: se o usuário editou
    // depois do último sync, o local tem prioridade e não pode ser sobrescrito.
    lastLocalChangeTime() {
      const meta = this.loadMeta();
      const syncedAt = new Date(meta.lastSyncedAt || 0).getTime();

      return Math.max(syncedAt, this.localChangeTime());
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

    notifyOpenFinance() {
      if (window.financeOpenFinance && typeof window.financeOpenFinance.onAuthChanged === 'function') {
        window.financeOpenFinance.onAuthChanged();
      }
    },

    // ---- UI ----
    render() {
      if (window.app && typeof window.app.renderSyncPanel === 'function') {
        window.app.renderSyncPanel();
      }
      if (window.app && typeof window.app.renderOpenFinancePanel === 'function') {
        window.app.renderOpenFinancePanel();
      }
    }
  };

  window.financeSync = sync;

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(async () => {
      await sync.init();
      if (window.app && typeof window.app.processRecurringOnLoad === 'function') {
        window.app.processRecurringOnLoad();
        if (typeof window.app.renderAll === 'function') window.app.renderAll();
      }
    }, 0);
  });
})();
