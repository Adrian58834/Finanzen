/**
 * FinanZen - cliente de Open Finance
 *
 * Este módulo nunca recebe credenciais bancárias ou secrets do provedor.
 * Ele consulta dados protegidos por RLS e invoca Edge Functions autenticadas.
 */
(function () {
  const config = window.FINANZEN_OPEN_FINANCE || {};

  const openFinance = {
    connections: [],
    status: 'idle', // idle | loading | ready | error
    lastError: null,
    _refreshPromise: null,
    _generation: 0,

    isEnabled() {
      return config.enabled === true && Boolean(config.provider);
    },

    syncModule() {
      return window.financeSync || null;
    },

    client() {
      const sync = this.syncModule();
      return sync && sync.client ? sync.client : null;
    },

    user() {
      const sync = this.syncModule();
      return sync && sync.user ? sync.user : null;
    },

    isReady() {
      return this.isEnabled() && Boolean(this.client() && this.user());
    },

    render() {
      if (window.app && typeof window.app.renderOpenFinancePanel === 'function') {
        window.app.renderOpenFinancePanel();
      }
    },

    async onAuthChanged() {
      this._generation += 1;
      this._refreshPromise = null;
      this.connections = [];
      if (!this.user()) {
        this.connections = [];
        this.status = 'idle';
        this.lastError = null;
        this.render();
        return;
      }

      if (this.isEnabled()) await this.refresh();
      else this.render();
    },

    async refresh() {
      if (!this.isReady()) {
        this.connections = [];
        this.status = 'idle';
        this.render();
        return { ok: true, disabled: !this.isEnabled() };
      }

      if (this._refreshPromise) return this._refreshPromise;
      const generation = this._generation;
      this.status = 'loading';
      this.lastError = null;
      this.render();

      this._refreshPromise = (async () => {
        const { data, error } = await this.client()
          .from('open_finance_connections')
          .select('id, provider, institution_id, institution_name, institution_logo_url, status, consent_expires_at, last_synced_at, last_error_message, created_at')
          .order('created_at', { ascending: false });

        if (generation !== this._generation) return { error: 'A sessão mudou.' };

        if (error) {
          this.status = 'error';
          this.lastError = error.message || 'Não foi possível carregar as conexões bancárias.';
          this.render();
          return { error: this.lastError };
        }

        this.connections = Array.isArray(data) ? data : [];
        this.status = 'ready';
        this.render();
        return { ok: true, connections: this.connections };
      })();

      try {
        return await this._refreshPromise;
      } finally {
        if (generation === this._generation) this._refreshPromise = null;
      }
    },

    functionName(action) {
      const functions = config.functions || {};
      return functions[action] || `open-finance-${action}`;
    },

    async invoke(action, body) {
      if (!this.isReady()) {
        return { error: !this.isEnabled()
          ? 'O provedor de Open Finance ainda não foi configurado.'
          : 'Entre na sincronização em nuvem para continuar.' };
      }

      const generation = this._generation;
      this.status = 'loading';
      this.lastError = null;
      this.render();

      const { data, error } = await this.client().functions.invoke(this.functionName(action), {
        body: body || {}
      });

      if (generation !== this._generation) return { error: 'A sessão mudou.' };

      if (error || (data && data.error)) {
        const message = (data && (data.message || data.error)) || (error && error.message) || 'Falha na operação de Open Finance.';
        this.status = 'error';
        this.lastError = message;
        this.render();
        return { error: message };
      }

      this.status = 'ready';
      return { ok: true, data: data || {} };
    },

    async connect() {
      const callbackUrl = `${window.location.origin}${window.location.pathname}#settings`;
      const result = await this.invoke('connect', { callbackUrl });
      if (result.error) return result;

      const authorizationUrl = result.data.authorizationUrl;
      if (!authorizationUrl) {
        return { error: 'O provedor não retornou a URL de autorização.' };
      }

      let target;
      try {
        target = new URL(authorizationUrl);
      } catch (e) {
        return { error: 'O provedor retornou uma URL de autorização inválida.' };
      }

      if (target.protocol !== 'https:') {
        return { error: 'A autorização deve usar uma conexão HTTPS segura.' };
      }

      window.location.assign(target.href);
      return { ok: true, redirecting: true };
    },

    async sync(connectionId) {
      const result = await this.invoke('sync', { connectionId });
      if (!result.error) await this.refresh();
      return result;
    },

    async disconnect(connectionId) {
      const result = await this.invoke('disconnect', { connectionId });
      if (!result.error) await this.refresh();
      return result;
    }
  };

  window.financeOpenFinance = openFinance;

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => openFinance.onAuthChanged(), 0);
  });
})();
