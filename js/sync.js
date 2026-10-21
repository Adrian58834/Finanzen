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
    _generation: 0,
    _queue: Promise.resolve(),

    metaKey() {
      return this.user ? `${META_KEY}:${this.user.id}` : META_KEY;
    },

    changeUser(user) {
      if ((this.user && this.user.id) === (user && user.id)) {
        this.user = user || null;
        return;
      }
      clearTimeout(this._pushTimer);
      this._pushTimer = null;
      this._generation += 1;
      this._queue = Promise.resolve();
      this.user = user || null;
      window.financialState.switchScope(user && user.id);
      this.lastSyncedAt = this.loadMeta().lastSyncedAt || null;
      this.notifyOpenFinance();
      if (window.app) {
        if (window.app.onAccountChanged) window.app.onAccountChanged();
        else if (window.app.renderAll) window.app.renderAll();
      }
    },

    context() {
      return { id: this.user && this.user.id, generation: this._generation };
    },

    assertContext(context) {
      if (!context.id || !this.user || context.id !== this.user.id || context.generation !== this._generation) {
        throw new Error('A sessão mudou. A sincronização anterior foi cancelada.');
      }
      if (window.financialState._loadError) throw new Error(window.financialState._loadError);
    },

    enqueue(method, options) {
      const context = this.context();
      const task = this._queue.then(async () => {
        try {
          this.assertContext(context);
          return await this[method](options || {}, context);
        } catch (error) {
          if (context.generation === this._generation && context.id === (this.user && this.user.id)) this.setError(error.message);
          return { error: error.message };
        }
      });
      this._queue = task.then(() => undefined, () => undefined);
      return task;
    },

    push(options) { return this.enqueue('_push', options); },
    pull(options) { return this.enqueue('_pull', options); },
    pullIfNewer() { return this.enqueue('_pullIfNewer'); },

    // ---- Configuração ----
    isConfigured() {
      return Boolean(config.url && config.anonKey && supported);
    },

    loadMeta() {
      try {
        return JSON.parse(localStorage.getItem(this.metaKey()) || '{}') || {};
      } catch (e) {
        return {};
      }
    },

    saveMeta(partial) {
      const meta = { ...this.loadMeta(), ...partial };
      localStorage.setItem(this.metaKey(), JSON.stringify(meta));
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
        this.changeUser(session ? session.user : null);
        if (event === 'SIGNED_IN' && this.user) {
          this.status = 'syncing';
          this.render();
          // Supabase auth callbacks must finish before starting API requests.
          const context = this.context();
          setTimeout(() => {
            if (context.generation === this._generation) this.pullIfNewer().then(() => this.render());
          }, 0);
        } else if (event === 'SIGNED_OUT') {
          this.setStatus('signed-out');
        }
      });

      const generation = this._generation;
      const { data } = await this.client.auth.getSession();
      if (generation === this._generation) this.changeUser(data.session ? data.session.user : null);
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
        const context = this.context();
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
        this.assertContext(context);
        return { ok: true };
      } catch (error) {
        return { error: 'Não foi possível validar a senha.' };
      }
    },

    async signOut() {
      if (!this.client) return;
      const context = this.context();
      const { error } = await this.client.auth.signOut();
      if (error) { this.setError(error.message); return { error: error.message }; }
      if (context.generation === this._generation) this.changeUser(null);
      if (!this.user) this.setStatus('signed-out');
      return { ok: true };
    },

    // ---- Push / Pull ----
    async _push(options, context) {
      this.assertContext(context);
      if (this.table() !== 'finanzen_data') throw new Error('A sincronização segura requer a tabela finanzen_data.');
      this.setStatus('syncing');
      const state = window.financialState;
      state.persist(state.data, state.settings, false);
      state.createRecoverySnapshot('Antes de enviar dados para a nuvem');
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const { row, error } = await this.fetchRemote(context);
        this.assertContext(context);
        if (error) return { error };
        let data = state.data;
        let settings = state.settings;
        if (row && options.replaceRemote) {
          state.createRecoverySnapshot('Cópia da nuvem antes da substituição', row.data, row.settings, { source: 'cloud' });
        }
        if (row && !options.replaceRemote) {
          const remote = state.normalizeData(row.data);
          if (!remote) throw new Error('A cópia da nuvem é inválida e não foi sobrescrita.');
          state.createRecoverySnapshot('Cópia da nuvem antes da sincronização', remote, row.settings, { source: 'cloud' });
          const meta = this.loadMeta();
          const preferLocal = options.preferLocal === true || state.changeVersion > Number(meta.lastLocalChangeAt || 0);
          data = preferLocal ? state.mergeSyncData(meta.baseData, remote, state.data) : state.mergeData(remote, state.data, false);
          if (!preferLocal || (meta.baseSettings && JSON.stringify(meta.baseSettings) === JSON.stringify(state.settings))) {
            settings = state.normalizeSettings(row.settings);
          }
        }
        const sentChange = state.changeVersion;
        const sentLocal = JSON.parse(JSON.stringify(state.data));
        const sentSettings = JSON.stringify(state.settings);
        const payload = JSON.parse(JSON.stringify({ data, settings }));
        const result = await this.client.rpc('finanzen_compare_and_set', {
          expected_user_id: context.id,
          expected_revision: row ? row.revision : null,
          next_data: payload.data,
          next_settings: payload.settings
        });
        this.assertContext(context);
        if (result.error) throw new Error(result.error.message + ' Verifique se supabase/schema.sql está atualizado.');
        if (!result.data) throw new Error('O servidor não confirmou a gravação.');
        if (result.data.conflict) continue;
        const saved = result.data.row;
        if (!saved || !saved.updated_at) throw new Error('O servidor não confirmou a gravação.');
        const changed = state.changeVersion !== sentChange;
        const merged = changed ? state.mergeSyncData(sentLocal, payload.data, state.data) : payload.data;
        state.persist(merged, changed && JSON.stringify(state.settings) !== sentSettings ? state.settings : payload.settings, false);
        this.saveMeta({ lastSyncedAt: saved.updated_at, revision: saved.revision, lastLocalChangeAt: sentChange,
          baseData: payload.data, baseSettings: payload.settings });
        this.lastSyncedAt = saved.updated_at;
        if (window.app && window.app.renderAll) window.app.renderAll();
        if (changed) this.schedulePush();
        this.setStatus(changed ? 'syncing' : 'synced');
        return { ok: true };
      }
      throw new Error('Outro aparelho está alterando os dados. Tente sincronizar novamente. Seus dados locais foram preservados.');
    },

    async fetchRemote(context = this.context()) {
      this.assertContext(context);
      const { data, error } = await this.client
        .from(this.table())
        .select('data, settings, updated_at, revision')
        .eq('user_id', context.id)
        .maybeSingle();
      this.assertContext(context);
      if (error) { this.setError(error.message); return { error: error.message }; }
      return { row: data || null };
    },

    importCloudHistoryToRecovery() { return this.enqueue('_importCloudHistoryToRecovery'); },

    async _importCloudHistoryToRecovery(options, context) {
      if (!this.user) return { error: 'Entre na sua conta para acessar o histórico da nuvem.' };
      const state = window.financialState;
      const { data, error } = await this.client
        .from('finanzen_data_history')
        .select('history_id, data, settings, source_updated_at, archived_at')
        .eq('user_id', context.id)
        .order('archived_at', { ascending: false })
        .limit(8);

      this.assertContext(context);

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

    async _pull(options, context) {
      const { row, error } = await this.fetchRemote(context);
      this.assertContext(context);
      if (error) return { error };
      if (!row || !row.data) return { ok: true, empty: true };
      const state = window.financialState;
      const normalized = state.normalizeData(row.data);
      if (!normalized) throw new Error('Dados inválidos recebidos da nuvem.');
      state.createRecoverySnapshot('Cópia local antes de receber dados da nuvem');
      state.createRecoverySnapshot('Cópia recebida da nuvem', normalized, row.settings || {}, { source: 'cloud' });
      const localChange = state.changeVersion;
      const pending = localChange > Number(this.loadMeta().lastLocalChangeAt || 0);
      const preferLocal = options.preferLocal === true || pending;
      const meta = this.loadMeta();
      const merged = options.replaceLocal ? normalized : (preferLocal
        ? state.mergeSyncData(meta.baseData, normalized, state.data) : state.mergeData(state.data, normalized, true));
      const keepSettings = !options.replaceLocal && preferLocal && (!meta.baseSettings || JSON.stringify(meta.baseSettings) !== JSON.stringify(state.settings));
      state.persist(merged, keepSettings ? state.settings : state.normalizeSettings(row.settings), false);
      this.saveMeta({ lastSyncedAt: row.updated_at, revision: row.revision, baseData: normalized, baseSettings: state.normalizeSettings(row.settings),
        lastLocalChangeAt: pending && !options.replaceLocal ? Number(this.loadMeta().lastLocalChangeAt || 0) : localChange });
      this.lastSyncedAt = row.updated_at;
      this.setStatus(pending && !options.replaceLocal ? 'syncing' : 'synced');
      if (pending && !options.replaceLocal) this.schedulePush();
      if (window.app && window.app.renderAll) window.app.renderAll();
      return { ok: true };
    },

    async _pullIfNewer(options, context) {
      const { row, error } = await this.fetchRemote(context);
      this.assertContext(context);
      if (error) return { error };
      const meta = this.loadMeta();
      const pending = this.localChangeTime() > Number(meta.lastLocalChangeAt || 0);
      if (!row || pending) return this._push({ preferLocal: pending }, context);
      if (row.revision !== meta.revision || row.updated_at !== meta.lastSyncedAt) return this._pull({}, context);
      this.lastSyncedAt = row.updated_at;
      this.setStatus('synced');
      return { ok: true, unchanged: true };
    },

    localChangeTime() {
      return window.financialState.changeVersion || 0;
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
