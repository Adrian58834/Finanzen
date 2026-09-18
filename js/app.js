/**
 * FinanZen - Aplicação Principal e Controle de Interface (DOM)
 */

document.addEventListener('DOMContentLoaded', () => {
  const app = {
    currentTab: 'dashboard',
    selectedPeriod: 'all', // 'YYYY-MM' ou 'all'
    activeTxType: 'expense',
    editingTxId: null,
    editingGoalId: null,
    editingAccountId: null,
    editingTransferId: null,
    editingRecurringId: null,

    init() {
      this.initTheme();
      this.setupPeriodSelector();
      this.setupNavigation();
      this.setupModals();
      this.setupForms();
      this.setupFilters();
      this.setupBackupActions();
      this.setupReportActions();
      this.setupDueReminders();
      this.setupSyncActions();
      this.setupPwaInstall();
      this.setupCustomization();
      this.setupMobileMenu();
      this.processRecurringOnLoad();
      this.renderAll();
      this.renderSyncPanel();
    },

    processRecurringOnLoad() {
      const created = window.financialState.processRecurring();
      if (created > 0) {
        setTimeout(() => {
          this.showToast(`${created} lançamento(s) recorrente(s) gerado(s) automaticamente.`, 'info');
        }, 500);
      }
    },

    // --- Tema Dark / Light ---
    initTheme() {
      const savedTheme = window.financialState.settings.theme || 'dark';
      if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
      }
      this.updateThemeButtonUI(savedTheme);

      const themeBtn = document.getElementById('theme-toggle-btn');
      if (themeBtn) {
        themeBtn.addEventListener('click', () => {
          const isLight = document.body.classList.toggle('light-theme');
          const newTheme = isLight ? 'light' : 'dark';
          window.financialState.saveSettings({ theme: newTheme });
          this.updateThemeButtonUI(newTheme);
          this.showToast(`Modo ${newTheme === 'light' ? 'Claro' : 'Escuro'} ativado`, 'info');
        });
      }
    },

    updateThemeButtonUI(theme) {
      const icon = document.getElementById('theme-icon');
      const text = document.getElementById('theme-text');
      if (icon && text) {
        if (theme === 'light') {
          icon.className = 'ri-moon-line';
          text.textContent = 'Modo Escuro';
        } else {
          icon.className = 'ri-sun-line';
          text.textContent = 'Modo Claro';
        }
      }
    },

    // --- Seletor de Período Global ---
    setupPeriodSelector() {
      const selector = document.getElementById('global-period-select');
      if (!selector) return;

      const date = new Date();
      const currentYear = date.getFullYear();
      const currentMonth = date.getMonth() + 1;

      selector.innerHTML = '';

      // Opção Todos
      const optAll = document.createElement('option');
      optAll.value = 'all';
      optAll.textContent = 'Todos os períodos';
      selector.appendChild(optAll);

      // Opções de Ano (para o gráfico de fluxo)
      for (let yi = 2; yi >= 0; yi--) {
        const optYear = document.createElement('option');
        optYear.value = String(currentYear - yi);
        optYear.textContent = `Ano ${currentYear - yi}`;
        selector.appendChild(optYear);
      }

      // Opção Mês Atual
      const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
      this.monthNames = monthNames;

      // 12 meses passados + 6 meses futuros (transição automática de período)
      for (let offset = -12; offset <= 6; offset++) {
        const d = new Date(currentYear, currentMonth - 1 + offset, 1);
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const val = `${y}-${String(m).padStart(2, '0')}`;
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = `${monthNames[m - 1]} de ${y}`;
        if (offset === 0) {
          opt.selected = true;
          this.selectedPeriod = val;
        }
        selector.appendChild(opt);
      }

      selector.addEventListener('change', (e) => {
        this.selectedPeriod = e.target.value;
        this.materializeFixedForPeriod(this.selectedPeriod);
        this.renderAll();
      });
    },

    periodLabel(period) {
      const [y, m] = String(period).split('-').map(Number);
      const names = this.monthNames || ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
      if (!y || !m) return period;
      return `${names[m - 1]} de ${y}`;
    },

    // Gera e salva os lançamentos fixos até o fim do período selecionado (inclui meses futuros)
    materializeFixedForPeriod(period) {
      if (!/^\d{4}-\d{2}$/.test(period)) return 0;
      const target = window.financialState.endOfMonth(period);
      const created = window.financialState.processRecurring(target);
      if (created > 0) {
        this.showToast(`${this.periodLabel(period)}: ${created} lançamento(s) fixo(s) gerado(s) e salvo(s).`, 'info');
      }
      return created;
    },

    // --- Navegação entre Abas ---
    setupNavigation() {
      const navItems = document.querySelectorAll('.nav-item, .bottom-nav-item');
      navItems.forEach(item => {
        item.addEventListener('click', (e) => {
          e.preventDefault();
          const targetTab = item.getAttribute('data-tab');
          if (!targetTab) return;

          navItems.forEach(n => n.classList.remove('active'));
          item.classList.add('active');

          document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
          });

          const activeSection = document.getElementById(`tab-${targetTab}`);
          if (activeSection) {
            activeSection.classList.add('active');
          }

          this.currentTab = targetTab;
          this.updateHeaderTitle(targetTab);

          // Fechar sidebar mobile ao navegar
          document.querySelector('.sidebar').classList.remove('open');

          this.renderAll();
        });
      });
    },

    updateHeaderTitle(tab) {
      const titleElem = document.getElementById('header-page-title');
      const subtitleElem = document.getElementById('header-page-subtitle');
      if (!titleElem || !subtitleElem) return;

      switch (tab) {
        case 'dashboard':
          titleElem.textContent = 'Painel Geral';
          subtitleElem.textContent = 'Visão ampla do seu patrimônio e fluxo de caixa';
          break;
        case 'transactions':
          titleElem.textContent = 'Transações';
          subtitleElem.textContent = 'Gerencie todas as suas receitas e despesas com filtros';
          break;
        case 'budgets':
          titleElem.textContent = 'Orçamentos Mensais';
          subtitleElem.textContent = 'Monitore seus tetos de gastos por categoria';
          break;
        case 'goals':
          titleElem.textContent = 'Metas & Cofrinhos';
          subtitleElem.textContent = 'Acompanhe seus objetivos e economias planejadas';
          break;
        case 'reports':
          titleElem.textContent = 'Relatórios & Análise';
          subtitleElem.textContent = 'Estatísticas detalhadas e evolução financeira';
          break;
        case 'settings':
          titleElem.textContent = 'Backup & Dados';
          subtitleElem.textContent = 'Resumo, exportação, restauração e personalização dos seus dados';
          break;
      }
    },

    setupMobileMenu() {
      const menuBtn = document.getElementById('mobile-menu-btn');
      const sidebar = document.querySelector('.sidebar');
      if (menuBtn && sidebar) {
        menuBtn.addEventListener('click', () => {
          sidebar.classList.toggle('open');
        });
      }
    },

    // --- Formatação Monetária ---
    formatCurrency(val) {
      const currency = (window.financialState.settings.currency) || 'BRL';
      try {
        return new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency
        }).format(val || 0);
      } catch (e) {
        return 'R$ ' + (Number(val) || 0).toFixed(2);
      }
    },

    escapeHtml(str) {
      return String(str ?? '').replace(/[&<>"']/g, (m) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[m]));
    },

    formatDate(dateStr) {
      if (!dateStr) return '';
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return dateStr;
    },

    // --- Renderizador Geral ---
    renderAll() {
      this.renderDashboardMetrics();
      this.renderRecentTransactions();
      this.renderAccountBalances();
      this.renderFullTransactionsTable();
      this.renderBudgets();
      this.renderGoals();
      this.renderCharts();
      this.renderReports();
      this.renderSettingsLists();
      this.renderDataSummary();
      this.renderDueReminders();
    },

    // --- Resumo de Dados (Aba Backup & Dados) ---
    renderDataSummary() {
      const container = document.getElementById('data-stat-transactions');
      if (!container) return;

      const state = window.financialState;
      const stats = state.getDataStats();
      const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
      };

      setText('data-stat-transactions', stats.transactions);
      setText('data-stat-accounts', stats.accounts);
      setText('data-stat-categories', stats.categories);
      setText('data-stat-recurring', stats.recurring);
      setText('data-stat-storage', stats.bytes < 1024
        ? `${stats.bytes} B`
        : `${(stats.bytes / 1024).toFixed(1)} KB`);

      const lastBackup = state.settings.lastBackupAt;
      setText('data-stat-last-backup', lastBackup ? this.formatDate(lastBackup.slice(0, 10)) : 'Nunca');
    },

    // --- Vencimentos e Lembretes ---
    dueBucketMeta(bucket) {
      const meta = {
        overdue: { label: 'Atrasados', icon: 'ri-alarm-warning-line', className: 'overdue' },
        today: { label: 'Vencem hoje', icon: 'ri-calendar-check-line', className: 'today' },
        upcoming: { label: 'Próximos 7 dias', icon: 'ri-calendar-2-line', className: 'upcoming' }
      };
      return meta[bucket] || meta.upcoming;
    },

    dueKindMeta(item) {
      if (item.kind === 'invoice') return { icon: 'ri-bank-card-line', label: 'Fatura do cartão' };
      if (item.kind === 'income') return { icon: 'ri-arrow-down-circle-line', label: 'Receita a conferir' };
      if (item.kind === 'transfer') return { icon: 'ri-swap-box-line', label: 'Transferência agendada' };
      return { icon: 'ri-arrow-up-circle-line', label: 'Despesa a pagar' };
    },

    dueRelativeLabel(daysDiff) {
      if (daysDiff < 0) {
        const n = Math.abs(daysDiff);
        return `${n} dia${n > 1 ? 's' : ''} em atraso`;
      }
      if (daysDiff === 0) return 'Vence hoje';
      if (daysDiff === 1) return 'Vence amanhã';
      return `Vence em ${daysDiff} dias`;
    },

    dueBadgeHTML(tx) {
      if (!tx || tx.status !== 'pending') return '';
      const due = window.financialState.getDueDate(tx);
      if (!due) return '';
      const diff = window.financialState.diffDays(due);
      if (diff > 7) return '';
      const cls = diff < 0 ? 'due-badge-overdue' : (diff === 0 ? 'due-badge-today' : 'due-badge-upcoming');
      return `<span class="due-badge ${cls}" title="Vencimento: ${this.formatDate(due)}"><i class="ri-alarm-line"></i> ${this.dueRelativeLabel(diff)}</span>`;
    },

    renderDueReminders() {
      const reminders = window.financialState.getDueReminders();
      this.dueReminders = reminders;

      const alertCount = reminders.counts.overdue + reminders.counts.today;
      const badge = document.getElementById('due-bell-badge');
      if (badge) {
        badge.textContent = alertCount > 99 ? '99+' : String(alertCount);
        badge.style.display = alertCount > 0 ? '' : 'none';
        badge.classList.toggle('has-overdue', reminders.counts.overdue > 0);
      }

      const bell = document.getElementById('due-bell-btn');
      if (bell) {
        bell.classList.toggle('has-alerts', alertCount > 0);
        bell.title = alertCount > 0
          ? `${alertCount} vencimento(s) exigindo atenção`
          : 'Vencimentos e lembretes';
      }

      this.renderDuePanel();
      this.renderDashboardDueAlert();
      this.syncDueNotifications();
    },

    renderDuePanel() {
      const body = document.getElementById('due-panel-body');
      if (!body) return;
      const reminders = this.dueReminders || window.financialState.getDueReminders();

      const subtitle = document.getElementById('due-panel-subtitle');
      if (subtitle) {
        subtitle.textContent = reminders.counts.total > 0
          ? `${reminders.counts.total} vencimento(s) nos próximos ${reminders.windowDays} dias`
          : 'Nenhum vencimento próximo';
      }

      const groups = [
        { bucket: 'overdue', items: reminders.overdue },
        { bucket: 'today', items: reminders.today },
        { bucket: 'upcoming', items: reminders.upcoming }
      ];

      if (groups.every(g => g.items.length === 0)) {
        body.innerHTML = `<div class="due-empty">
          <i class="ri-checkbox-circle-line"></i>
          <p>Tudo em dia! Nenhuma conta a pagar ou receita a conferir por aqui.</p>
        </div>`;
        return;
      }

      body.innerHTML = groups.map(group => {
        if (group.items.length === 0) return '';
        const meta = this.dueBucketMeta(group.bucket);
        return `
          <section class="due-group due-group-${meta.className}">
            <header class="due-group-head">
              <i class="${meta.icon}"></i>
              <span>${meta.label}</span>
              <em>${group.items.length}</em>
            </header>
            ${group.items.map(item => this.dueItemHTML(item)).join('')}
          </section>`;
      }).join('');
    },

    dueItemHTML(item) {
      const kind = this.dueKindMeta(item);
      const isIncome = item.kind === 'income';
      const actionLabel = isIncome
        ? 'Confirmar recebimento'
        : (item.kind === 'invoice' ? 'Pagar fatura' : 'Marcar como pago');
      const actionIcon = isIncome ? 'ri-check-double-line' : 'ri-check-line';
      const txIds = (item.txIds || []).join(',');
      const sign = isIncome ? '+' : '−';
      const amountClass = isIncome ? 'income' : 'expense';
      const accountLabel = item.account ? ` • ${this.escapeHtml(item.account)}` : '';
      const countLabel = item.kind === 'invoice' ? ` • ${item.count} lançamento(s)` : '';

      return `
        <div class="due-item due-item-${item.bucket}">
          <span class="due-item-icon"><i class="${kind.icon}"></i></span>
          <div class="due-item-main">
            <strong>${this.escapeHtml(item.title)}</strong>
            <span class="due-item-meta">${kind.label}${accountLabel}${countLabel}</span>
            <span class="due-item-date">${this.formatDate(item.dueDate)} • ${this.dueRelativeLabel(item.daysDiff)}</span>
          </div>
          <div class="due-item-side">
            <span class="tx-amount ${amountClass}">${sign} ${this.formatCurrency(item.amount)}</span>
            <button class="btn btn-primary btn-sm due-action-btn" type="button"
              data-tx-ids="${txIds}" data-kind="${item.kind}">
              <i class="${actionIcon}"></i> ${actionLabel}
            </button>
          </div>
        </div>`;
    },

    renderDashboardDueAlert() {
      const container = document.getElementById('dashboard-due-alert');
      if (!container) return;
      const reminders = this.dueReminders || window.financialState.getDueReminders();
      const items = [...reminders.overdue, ...reminders.today];

      if (items.length === 0) {
        container.style.display = 'none';
        container.innerHTML = '';
        return;
      }

      const total = items
        .filter(i => i.kind !== 'income')
        .reduce((s, i) => s + i.amount, 0);
      const income = items
        .filter(i => i.kind === 'income')
        .reduce((s, i) => s + i.amount, 0);
      const hasOverdue = reminders.counts.overdue > 0;

      const parts = [];
      if (reminders.counts.overdue) parts.push(`${reminders.counts.overdue} atrasado(s)`);
      if (reminders.counts.today) parts.push(`${reminders.counts.today} vencendo hoje`);
      const detail = [];
      if (total > 0) detail.push(`a pagar ${this.formatCurrency(total)}`);
      if (income > 0) detail.push(`a receber ${this.formatCurrency(income)}`);

      container.className = `due-alert ${hasOverdue ? 'due-alert-overdue' : 'due-alert-today'}`;
      container.style.display = '';
      container.innerHTML = `
        <i class="${hasOverdue ? 'ri-alarm-warning-line' : 'ri-calendar-check-line'}"></i>
        <div class="due-alert-text">
          <strong>${parts.join(' • ')}</strong>
          <span>${detail.join(' • ') || 'Confira os vencimentos'}</span>
        </div>
        <button class="btn btn-secondary btn-sm" type="button" id="due-alert-open">
          Ver vencimentos <i class="ri-arrow-right-line"></i>
        </button>`;

      const openBtn = document.getElementById('due-alert-open');
      if (openBtn) openBtn.addEventListener('click', () => this.openDuePanel());
    },

    openDuePanel() {
      const panel = document.getElementById('due-panel');
      const overlay = document.getElementById('due-panel-overlay');
      if (panel) panel.classList.add('open');
      if (overlay) overlay.classList.add('open');
      this.renderDuePanel();
    },

    closeDuePanel() {
      const panel = document.getElementById('due-panel');
      const overlay = document.getElementById('due-panel-overlay');
      if (panel) panel.classList.remove('open');
      if (overlay) overlay.classList.remove('open');
    },

    handleDueAction(txIds, kind) {
      const ids = String(txIds || '').split(',').filter(Boolean);
      if (ids.length === 0) return;

      const changed = window.financialState.markTransactionsPaid(ids);
      if (changed === 0) {
        this.showToast('Nada para atualizar.', 'info');
        return;
      }

      const messages = {
        income: 'Recebimento confirmado!',
        invoice: 'Fatura marcada como paga!',
        transfer: 'Transferência concluída!'
      };
      this.showToast(messages[kind] || 'Lançamento marcado como pago!', 'success');
      this.renderAll();
    },

    updateNotifyButton() {
      const btn = document.getElementById('due-enable-notify');
      if (!btn) return;
      const supported = typeof Notification !== 'undefined';
      const granted = supported && Notification.permission === 'granted';
      btn.style.display = (supported && !granted) ? '' : 'none';
    },

    requestDueNotifications() {
      if (typeof Notification === 'undefined') {
        this.showToast('Este navegador não suporta notificações.', 'warning');
        return;
      }
      Notification.requestPermission().then(perm => {
        if (perm === 'granted') {
          this.showToast('Avisos ativados! Você será lembrado dos vencimentos.', 'success');
        } else {
          this.showToast('Permissão de notificação não concedida.', 'info');
        }
        this.updateNotifyButton();
      });
    },

    syncDueNotifications(force = false) {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      const reminders = this.dueReminders || window.financialState.getDueReminders();
      const alertItems = [...reminders.overdue, ...reminders.today];
      if (alertItems.length === 0) return;

      const state = window.financialState;
      const today = reminders.today;
      if (!force && state.settings.lastNotifyDate === today) return;

      const parts = [];
      if (reminders.counts.overdue) parts.push(`${reminders.counts.overdue} atrasado(s)`);
      if (reminders.counts.today) parts.push(`${reminders.counts.today} vencendo hoje`);

      try {
        new Notification('FinanZen • Vencimentos', {
          body: `${parts.join(' • ')}. Abra o app para ver os detalhes.`,
          tag: `finanzen-due-${today}`
        });
        state.saveSettings({ lastNotifyDate: today });
      } catch (e) {
        // Notificações indisponíveis (ex: contexto não seguro)
      }
    },

    setupDueReminders() {
      const bell = document.getElementById('due-bell-btn');
      const close = document.getElementById('due-panel-close');
      const overlay = document.getElementById('due-panel-overlay');
      const notify = document.getElementById('due-enable-notify');
      const body = document.getElementById('due-panel-body');

      if (bell) bell.addEventListener('click', () => this.openDuePanel());
      if (close) close.addEventListener('click', () => this.closeDuePanel());
      if (overlay) overlay.addEventListener('click', () => this.closeDuePanel());
      if (notify) notify.addEventListener('click', () => this.requestDueNotifications());

      if (body) {
        body.addEventListener('click', (e) => {
          const btn = e.target.closest('.due-action-btn');
          if (!btn) return;
          this.handleDueAction(btn.getAttribute('data-tx-ids'), btn.getAttribute('data-kind'));
        });
      }

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.closeDuePanel();
      });

      this.updateNotifyButton();
    },

    // --- Sincronização em Nuvem (UI) ---
    formatDateTime(value) {
      const d = value instanceof Date ? value : new Date(value);
      if (isNaN(d.getTime())) return '—';
      return `${d.toLocaleDateString('pt-BR')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    },

    renderSyncPanel() {
      const panel = document.getElementById('sync-panel');
      if (!panel) return;
      const sync = window.financeSync;

      if (!sync) {
        panel.innerHTML = `<p class="sync-note">Módulo de sincronização indisponível.</p>`;
        return;
      }

      if (!sync.isConfigured()) {
        panel.innerHTML = `
          <div class="sync-status sync-status-idle">
            <i class="ri-information-line"></i>
            <div>
              <strong>Não configurado</strong>
              <span>Preencha <code>js/sync-config.js</code> com a URL e a chave do Supabase para ativar. Enquanto isso, tudo fica salvo apenas neste dispositivo.</span>
            </div>
          </div>`;
        return;
      }

      const statusLabel = {
        disabled: 'Desativado',
        'signed-out': 'Não conectado',
        syncing: 'Sincronizando...',
        synced: 'Conectado',
        error: 'Erro'
      }[sync.status] || sync.status;

      const statusClass = sync.status === 'error'
        ? 'sync-status-error'
        : (sync.user ? 'sync-status-ok' : 'sync-status-idle');

      if (!sync.user) {
        panel.innerHTML = `
          <div class="sync-status ${statusClass}">
            <i class="ri-cloud-off-line"></i>
            <div>
              <strong>${statusLabel}</strong>
              <span>Entre para sincronizar seus dados entre aparelhos.</span>
            </div>
          </div>
          <form id="sync-auth-form" class="sync-auth-form" onsubmit="return false;">
            <input type="email" id="sync-email" class="form-control" placeholder="seu@email.com" autocomplete="email">
            <input type="password" id="sync-password" class="form-control" placeholder="Senha (mín. 6 caracteres)" autocomplete="current-password">
            <div class="sync-auth-actions">
              <button type="button" id="sync-signin-btn" class="btn btn-primary btn-sm"><i class="ri-login-box-line"></i> Entrar</button>
              <button type="button" id="sync-signup-btn" class="btn btn-secondary btn-sm"><i class="ri-user-add-line"></i> Criar conta</button>
            </div>
          </form>
          ${sync.lastError ? `<p class="sync-error">${this.escapeHtml(sync.lastError)}</p>` : ''}`;
        return;
      }

      const last = sync.lastSyncedAt ? this.formatDateTime(sync.lastSyncedAt) : 'Nunca';

      panel.innerHTML = `
        <div class="sync-status ${statusClass}">
          <i class="${sync.status === 'error' ? 'ri-error-warning-line' : 'ri-cloud-line'}"></i>
          <div>
            <strong>${statusLabel}</strong>
            <span>${this.escapeHtml(sync.user.email || '')}</span>
            <span class="sync-last">Última sincronização: ${last}</span>
          </div>
        </div>
        ${sync.lastError ? `<p class="sync-error">${this.escapeHtml(sync.lastError)}</p>` : ''}
        <div class="settings-actions">
          <button id="sync-now-btn" class="btn btn-primary btn-sm" type="button"><i class="ri-refresh-line"></i> Sincronizar agora</button>
          <button id="sync-push-btn" class="btn btn-secondary btn-sm" type="button"><i class="ri-upload-cloud-2-line"></i> Enviar</button>
          <button id="sync-pull-btn" class="btn btn-secondary btn-sm" type="button"><i class="ri-download-cloud-2-line"></i> Baixar</button>
          <button id="sync-signout-btn" class="btn btn-secondary btn-sm" type="button"><i class="ri-logout-box-line"></i> Sair</button>
        </div>`;
    },

    setupSyncActions() {
      const panel = document.getElementById('sync-panel');
      if (!panel) return;

      panel.addEventListener('click', async (e) => {
        const button = e.target.closest('button');
        if (!button || !button.id) return;
        const sync = window.financeSync;
        if (!sync) return;

        if (button.id === 'sync-signin-btn' || button.id === 'sync-signup-btn') {
          const email = (document.getElementById('sync-email') || {}).value || '';
          const password = (document.getElementById('sync-password') || {}).value || '';
          if (!email.trim() || password.length < 6) {
            this.showToast('Informe e-mail e senha (mín. 6 caracteres).', 'warning');
            return;
          }
          const result = button.id === 'sync-signin-btn'
            ? await sync.signIn(email.trim(), password)
            : await sync.signUp(email.trim(), password);

          if (result && result.error) {
            this.showToast('Erro: ' + result.error, 'error');
          } else if (button.id === 'sync-signup-btn') {
            this.showToast('Conta criada! Confirme o e-mail se solicitado.', 'success');
          } else {
            this.showToast('Conectado!', 'success');
          }
          this.renderSyncPanel();
          return;
        }

        if (button.id === 'sync-now-btn') {
          this.showToast('Sincronizando...', 'info');
          const r = await sync.pullIfNewer();
          if (r && r.error) this.showToast('Erro ao sincronizar.', 'error');
          else { this.showToast('Sincronizado!', 'success'); this.renderAll(); }
          this.renderSyncPanel();
          return;
        }

        if (button.id === 'sync-push-btn') {
          const r = await sync.push();
          this.showToast(r && r.error ? 'Erro ao enviar.' : 'Dados enviados para a nuvem!', r && r.error ? 'error' : 'success');
          this.renderSyncPanel();
          return;
        }

        if (button.id === 'sync-pull-btn') {
          const r = await sync.pull();
          if (r && r.error) this.showToast('Erro ao baixar.', 'error');
          else { this.showToast('Dados baixados da nuvem!', 'success'); this.renderAll(); }
          this.renderSyncPanel();
          return;
        }

        if (button.id === 'sync-signout-btn') {
          await sync.signOut();
          this.showToast('Desconectado.', 'info');
          this.renderSyncPanel();
        }
      });
    },

    // --- Instalação do PWA ---
    setupPwaInstall() {
      const buttons = Array.from(document.querySelectorAll('.pwa-install-btn'));
      if (buttons.length === 0) return;

      const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
      if (standalone) {
        buttons.forEach(b => { b.style.display = 'none'; });
        return;
      }

      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        this.deferredInstallPrompt = e;
        buttons.forEach(b => { b.style.display = ''; });
      });

      buttons.forEach(button => {
        button.addEventListener('click', async () => {
          if (!this.deferredInstallPrompt) {
            this.showToast('Para instalar: use o menu do navegador e escolha "Adicionar à tela inicial".', 'info');
            return;
          }
          this.deferredInstallPrompt.prompt();
          const choice = await this.deferredInstallPrompt.userChoice;
          if (choice && choice.outcome === 'accepted') this.showToast('Instalando o FinanZen...', 'success');
          this.deferredInstallPrompt = null;
          buttons.forEach(b => { b.style.display = 'none'; });
        });
      });

      window.addEventListener('appinstalled', () => {
        this.showToast('FinanZen instalado com sucesso!', 'success');
        buttons.forEach(b => { b.style.display = 'none'; });
      });
    },

    // --- Métricas do Dashboard ---
    renderDashboardMetrics() {
      const metrics = window.financialState.getMetrics(this.selectedPeriod);

      const elBalance = document.getElementById('metric-total-balance');
      const elIncome = document.getElementById('metric-total-income');
      const elExpense = document.getElementById('metric-total-expense');
      const elSavings = document.getElementById('metric-savings-rate');

      if (elBalance) elBalance.textContent = this.formatCurrency(metrics.netBalance);
      if (elIncome) elIncome.textContent = this.formatCurrency(metrics.totalIncome);
      if (elExpense) elExpense.textContent = this.formatCurrency(metrics.totalExpense);
      if (elSavings) elSavings.textContent = `${metrics.savingsRate}%`;

      // Atualizar aviso de despesas pendentes
      const elPending = document.getElementById('metric-pending-expense');
      if (elPending) {
        elPending.textContent = metrics.pendingExpense > 0 
          ? `(Pendentes: ${this.formatCurrency(metrics.pendingExpense)})`
          : 'Tudo pago neste período';
      }
    },

    // --- Transações Recentes (no Dashboard) ---
    renderRecentTransactions() {
      const container = document.getElementById('dashboard-recent-transactions');
      if (!container) return;

      const txs = window.financialState.getFilteredTransactions({
        month: this.selectedPeriod
      }).slice(0, 5); // Últimas 5 transações

      if (txs.length === 0) {
        container.innerHTML = `
          <tr>
            <td colspan="5" class="empty-state">
              <i class="ri-inbox-line empty-state-icon"></i>
              <p class="empty-state-title">Nenhuma transação encontrada</p>
              <p class="empty-state-desc">Cadastre sua primeira receita ou despesa no botão acima.</p>
            </td>
          </tr>
        `;
        return;
      }

      container.innerHTML = txs.map(tx => {
        const isTransfer = tx.type === 'transfer';
        const cat = isTransfer
          ? { name: 'Transferência', icon: 'ri-swap-box-line', color: 'var(--accent-primary)' }
          : window.financialState.getCategoryById(tx.category);
        const isIncome = tx.type === 'income';
        const sign = isTransfer ? '' : (isIncome ? '+ ' : '- ');
        const amtClass = isTransfer ? 'tx-transfer' : (isIncome ? 'income' : 'expense');
        const statusLabel = tx.status === 'paid' ? 'Pago' : 'Pendente';
        const statusClass = tx.status === 'paid' ? 'status-paid' : 'status-pending';

        return `
          <tr>
            <td data-label="Categoria">
              <span class="tx-category-badge">
                <i class="${cat.icon}" style="color: ${cat.color};"></i>
                ${this.escapeHtml(cat.name)}
              </span>
            </td>
            <td data-label="Descrição">
              <div class="cell">
                <strong>${this.escapeHtml(tx.description)}</strong>
                ${tx.fixed ? '<span class="fixed-badge" title="Lançamento fixo gerado automaticamente"><i class="ri-refresh-line"></i> Fixado</span>' : ''}
                ${isTransfer ? `<div style="font-size: 0.76rem; color: var(--text-muted);">${this.escapeHtml(tx.account)} → ${this.escapeHtml(tx.toAccount || '?')}${tx.fee ? ` • taxa ${this.formatCurrency(tx.fee)}` : ''}</div>` : ''}
              </div>
            </td>
            <td data-label="Data">${this.formatDate(tx.date)}</td>
            <td data-label="Status">
              <div class="cell">
                <span class="status-pill ${statusClass}">${statusLabel}</span>${this.dueBadgeHTML(tx)}
              </div>
            </td>
            <td data-label="Valor" class="tx-amount ${amtClass}">${sign}${this.formatCurrency(tx.amount)}</td>
          </tr>
        `;
      }).join('');
    },

    // --- Patrimônio / Saldo por Conta (Dashboard) ---
    renderAccountBalances() {
      const container = document.getElementById('account-balance-container');
      if (!container) return;

      const state = window.financialState;
      const metrics = state.getAccountMetrics(this.selectedPeriod);
      const accounts = metrics.accounts;

      if (accounts.length === 0) {
        container.innerHTML = `
          <div class="empty-state" style="padding: 20px; grid-column: 1 / -1;">
            <i class="ri-bank-line empty-state-icon" style="font-size: 2rem;"></i>
            <p class="empty-state-title" style="font-size: 0.95rem;">Sem contas cadastradas</p>
            <p class="empty-state-desc" style="font-size: 0.8rem;">Cadastre um banco, corretora ou cartão em Configurações.</p>
          </div>
        `;
        return;
      }

      const rows = accounts.map(acc => {
        const meta = state.getAccountTypeMeta(acc.type);
        const isCredit = acc.type === 'credit';
        const valueClass = acc.value >= 0 ? 'income' : 'expense';
        const detail = isCredit
          ? `${meta.label} • Usado ${this.formatCurrency(acc.used)} de ${this.formatCurrency(acc.creditLimit)} • disp. ${this.formatCurrency(acc.available)}`
          : meta.label;

        return `
          <div class="account-balance-row">
            <span class="account-balance-name">
              <i class="${meta.icon}"></i>
              <span class="account-balance-text">
                <span class="account-name">${this.escapeHtml(acc.name)}</span>
                <span class="account-type">${this.escapeHtml(detail)}</span>
              </span>
            </span>
            <span class="tx-amount ${valueClass}">${this.formatCurrency(acc.value)}</span>
          </div>
        `;
      }).join('');

      const t = metrics.totals;
      const footer = `
        <div class="account-balance-total">
          <div class="account-total-line">
            <span>Patrimônio Líquido</span>
            <strong class="${t.netWorth >= 0 ? 'tx-amount income' : 'tx-amount expense'}">${this.formatCurrency(t.netWorth)}</strong>
          </div>
          <div class="account-total-breakdown">
            <span><i class="ri-bank-line"></i> Bancos: ${this.formatCurrency(metrics.byType.bank)}</span>
            <span><i class="ri-line-chart-line"></i> Corretoras: ${this.formatCurrency(metrics.byType.broker)}</span>
            ${metrics.byType.wallet ? `<span><i class="ri-wallet-3-line"></i> Carteiras: ${this.formatCurrency(metrics.byType.wallet)}</span>` : ''}
            ${t.creditLimit > 0 ? `<span><i class="ri-bank-card-line"></i> Cartões: ${this.formatCurrency(t.creditUsed)} de ${this.formatCurrency(t.creditLimit)} • disponível ${this.formatCurrency(t.creditAvailable)}</span>` : ''}
          </div>
        </div>
      `;

      container.innerHTML = rows + footer;
    },

    // --- Tabela Completa de Transações com Ações ---
    renderFullTransactionsTable() {
      const container = document.getElementById('transactions-table-body');
      if (!container) return;

      const searchInput = document.getElementById('tx-search-input');
      const typeSelect = document.getElementById('tx-type-filter');
      const catSelect = document.getElementById('tx-category-filter');
      const statusSelect = document.getElementById('tx-status-filter');
      const accountSelect = document.getElementById('tx-account-filter');

      const filters = {
        month: this.selectedPeriod,
        search: searchInput ? searchInput.value : '',
        type: typeSelect ? typeSelect.value : 'all',
        category: catSelect ? catSelect.value : 'all',
        status: statusSelect ? statusSelect.value : 'all',
        account: accountSelect ? accountSelect.value : 'all'
      };

      const txs = window.financialState.getFilteredTransactions(filters);

      if (txs.length === 0) {
        container.innerHTML = `
          <tr>
            <td colspan="7" class="empty-state">
              <i class="ri-search-line empty-state-icon"></i>
              <p class="empty-state-title">Nenhum lançamento corresponde aos filtros</p>
              <p class="empty-state-desc">Tente ajustar seus termos de busca ou filtros selecionados.</p>
            </td>
          </tr>
        `;
        return;
      }

      container.innerHTML = txs.map(tx => {
        const isTransfer = tx.type === 'transfer';
        const cat = isTransfer
          ? { name: 'Transferência', icon: 'ri-swap-box-line', color: 'var(--accent-primary)' }
          : window.financialState.getCategoryById(tx.category);
        const isIncome = tx.type === 'income';
        const sign = isTransfer ? '' : (isIncome ? '+ ' : '- ');
        const amtClass = isTransfer ? 'tx-transfer' : (isIncome ? 'income' : 'expense');
        const statusLabel = tx.status === 'paid' ? 'Pago' : 'Pendente';
        const statusClass = tx.status === 'paid' ? 'status-paid' : 'status-pending';
        const accountLabel = isTransfer
          ? `${tx.account || '?'} → ${tx.toAccount || '?'}${tx.fee ? ` (taxa ${this.formatCurrency(tx.fee)})` : ''}`
          : (tx.account || 'Conta Principal');

        return `
          <tr>
            <td data-label="Data">${this.formatDate(tx.date)}</td>
            <td data-label="Descrição">
              <div class="cell">
                <strong>${this.escapeHtml(tx.description)}</strong>
                ${tx.fixed ? '<span class="fixed-badge" title="Lançamento fixo gerado automaticamente"><i class="ri-refresh-line"></i> Fixado</span>' : ''}
                ${tx.notes ? `<div style="font-size: 0.78rem; color: var(--text-muted);">${this.escapeHtml(tx.notes)}</div>` : ''}
              </div>
            </td>
            <td data-label="Categoria">
              <span class="tx-category-badge">
                <i class="${cat.icon}" style="color: ${cat.color};"></i>
                ${this.escapeHtml(cat.name)}
              </span>
            </td>
            <td data-label="Conta">
              <div class="cell"><small style="color: var(--text-secondary);">${this.escapeHtml(accountLabel)}</small></div>
            </td>
            <td data-label="Status">
              <div class="cell">
                <span class="status-pill ${statusClass}">${statusLabel}</span>${this.dueBadgeHTML(tx)}
              </div>
            </td>
            <td data-label="Valor" class="tx-amount ${amtClass}">${sign}${this.formatCurrency(tx.amount)}</td>
            <td class="actions-cell">
              <button class="action-btn edit-tx" data-id="${tx.id}" title="Editar Transação">
                <i class="ri-edit-line"></i>
              </button>
              <button class="action-btn delete delete-tx" data-id="${tx.id}" title="Excluir Transação">
                <i class="ri-delete-bin-line"></i>
              </button>
            </td>
          </tr>
        `;
      }).join('');

      // Eventos de clique para editar e excluir
      container.querySelectorAll('.edit-tx').forEach(btn => {
        btn.addEventListener('click', () => {
          this.openEditTxModal(btn.getAttribute('data-id'));
        });
      });

      container.querySelectorAll('.delete-tx').forEach(btn => {
        btn.addEventListener('click', () => {
          this.confirmDeleteTx(btn.getAttribute('data-id'));
        });
      });
    },

    // --- Orçamentos (Budgets) ---
    renderBudgets() {
      const container = document.getElementById('budgets-grid-container');
      if (!container) return;

      const budgets = window.financialState.data.budgets;
      const monthExpenses = window.financialState.getExpensesByCategory(this.selectedPeriod);

      if (budgets.length === 0) {
        container.innerHTML = `
          <div class="empty-state" style="grid-column: 1 / -1;">
            <i class="ri-compasses-2-line empty-state-icon"></i>
            <p class="empty-state-title">Nenhum orçamento configurado</p>
            <p class="empty-state-desc">Defina tetos de gastos para suas principais categorias para não estourar seu salário.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = budgets.map(b => {
        const cat = window.financialState.getCategoryById(b.categoryId);
        const spentObj = monthExpenses.find(e => e.id === b.categoryId);
        const spent = spentObj ? spentObj.total : 0;
        const limit = b.monthlyLimit || 1;
        const percent = Math.min(Math.round((spent / limit) * 100), 100);
        const actualPercent = Math.round((spent / limit) * 100);

        let progressClass = '';
        let statusBadge = `<span style="color: var(--income); font-weight: 700;">${actualPercent}%</span>`;

        if (actualPercent >= 100) {
          progressClass = 'danger';
          statusBadge = `<span style="color: var(--expense); font-weight: 700;">Estourado (${actualPercent}%)</span>`;
        } else if (actualPercent >= 75) {
          progressClass = 'warning';
          statusBadge = `<span style="color: var(--warning); font-weight: 700;">Atenção (${actualPercent}%)</span>`;
        }

        const remaining = Math.max(0, limit - spent);

        return `
          <div class="budget-card">
            <div class="budget-card-header">
              <div class="budget-category">
                <div class="budget-icon" style="color: ${cat.color};">
                  <i class="${cat.icon}"></i>
                </div>
                <div>
                  <h4 style="font-size: 1rem; font-weight: 700;">${this.escapeHtml(cat.name)}</h4>
                  <p style="font-size: 0.8rem; color: var(--text-secondary);">Limite: ${this.formatCurrency(limit)}</p>
                </div>
              </div>
              <button class="action-btn edit-budget-btn" data-cat="${b.categoryId}" title="Editar Orçamento">
                <i class="ri-edit-line"></i>
              </button>
              <button class="action-btn delete-budget-btn" data-cat="${b.categoryId}" title="Remover Orçamento">
                <i class="ri-delete-bin-line"></i>
              </button>
            </div>

            <div class="budget-progress-track">
              <div class="budget-progress-bar ${progressClass}" style="width: ${percent}%;"></div>
            </div>

            <div class="budget-info-row">
              <span>Gasto: <strong>${this.formatCurrency(spent)}</strong></span>
              <span>${statusBadge}</span>
            </div>
            <div class="budget-info-row" style="color: var(--text-muted); font-size: 0.78rem;">
              <span>Restante: ${this.formatCurrency(remaining)}</span>
            </div>
          </div>
        `;
      }).join('');

      container.querySelectorAll('.delete-budget-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const catId = btn.getAttribute('data-cat');
          if (confirm('Deseja realmente remover o orçamento desta categoria?')) {
            window.financialState.deleteBudget(catId);
            this.renderBudgets();
            this.showToast('Orçamento removido', 'info');
          }
        });
      });

      container.querySelectorAll('.edit-budget-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this.openEditBudgetModal(btn.getAttribute('data-cat'));
        });
      });
    },

    // --- Metas / Cofrinhos ---
    renderGoals() {
      const container = document.getElementById('goals-grid-container');
      if (!container) return;

      const goals = window.financialState.data.goals;

      if (goals.length === 0) {
        container.innerHTML = `
          <div class="empty-state" style="grid-column: 1 / -1;">
            <i class="ri-flag-line empty-state-icon"></i>
            <p class="empty-state-title">Nenhuma meta cadastrada</p>
            <p class="empty-state-desc">Crie objetivos para guardar dinheiro (viagens, reserva de emergência, compras).</p>
          </div>
        `;
        return;
      }

      container.innerHTML = goals.map(g => {
        const percent = Math.min(Math.round((g.currentAmount / (g.targetAmount || 1)) * 100), 100);

        return `
          <div class="goal-card">
            <div class="goal-card-top">
              <div class="goal-avatar">
                <i class="${g.icon || 'ri-money-dollar-circle-line'}"></i>
              </div>
              <div class="goal-percent-badge">${percent}%</div>
            </div>

            <div>
              <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 4px;">${this.escapeHtml(g.title)}</h3>
              ${g.deadline ? `<p style="font-size: 0.8rem; color: var(--text-muted);">Prazo: ${this.formatDate(g.deadline)}</p>` : ''}
            </div>

            <div class="budget-progress-track">
              <div class="budget-progress-bar" style="width: ${percent}%; background: linear-gradient(90deg, var(--accent-primary), #06b6d4);"></div>
            </div>

            <div class="goal-values">
              <div>
                <span style="font-size: 0.75rem; color: var(--text-secondary); display: block;">Guardado</span>
                <span class="goal-current-val">${this.formatCurrency(g.currentAmount)}</span>
              </div>
              <div style="text-align: right;">
                <span style="font-size: 0.75rem; color: var(--text-secondary); display: block;">Objetivo</span>
                <span class="goal-target-val">${this.formatCurrency(g.targetAmount)}</span>
              </div>
            </div>

            <div style="display: flex; gap: 8px; margin-top: 8px;">
              <button class="btn btn-secondary btn-sm deposit-goal-btn" style="flex: 1;" data-id="${g.id}">
                <i class="ri-add-circle-line"></i> Guardar +
              </button>
              <button class="action-btn edit-goal-btn" data-id="${g.id}" title="Editar Meta">
                <i class="ri-edit-line"></i>
              </button>
              <button class="action-btn delete-goal-btn" data-id="${g.id}" title="Excluir Meta">
                <i class="ri-delete-bin-line"></i>
              </button>
            </div>
          </div>
        `;
      }).join('');

      container.querySelectorAll('.deposit-goal-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this.openDepositModal(btn.getAttribute('data-id'));
        });
      });

      container.querySelectorAll('.delete-goal-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          if (confirm('Deseja excluir esta meta financeira?')) {
            window.financialState.deleteGoal(id);
            this.renderGoals();
            this.showToast('Meta excluída', 'info');
          }
        });
      });

      container.querySelectorAll('.edit-goal-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this.openEditGoalModal(btn.getAttribute('data-id'));
        });
      });
    },

    // --- Relatórios Detalhados ---
    renderReports() {
      const report = window.financialState.getReport(this.selectedPeriod);
      const metrics = report.metrics;

      const periodLabel = document.getElementById('report-period-label');
      if (periodLabel) periodLabel.textContent = this.periodLabelFor(this.selectedPeriod);

      // Resumo do período
      const elIncome = document.getElementById('report-summary-income');
      const elExpense = document.getElementById('report-summary-expense');
      const elBalance = document.getElementById('report-summary-balance');
      const elTopCat = document.getElementById('report-summary-topcat');
      const elTopCatDetail = document.getElementById('report-summary-topcat-detail');

      if (elIncome) elIncome.textContent = this.formatCurrency(metrics.totalIncome);
      if (elExpense) elExpense.textContent = this.formatCurrency(metrics.totalExpense);
      if (elBalance) {
        elBalance.textContent = this.formatCurrency(metrics.netBalance);
        elBalance.style.color = metrics.netBalance >= 0 ? 'var(--income)' : 'var(--expense)';
      }

      const topCat = report.topCategory;
      if (elTopCat && elTopCatDetail) {
        if (topCat) {
          const pct = metrics.totalExpense > 0 ? Math.round((topCat.total / metrics.totalExpense) * 100) : 0;
          elTopCat.textContent = topCat.name;
          elTopCatDetail.textContent = `${this.formatCurrency(topCat.total)} (${pct}% das despesas)`;
        } else {
          elTopCat.textContent = '—';
          elTopCatDetail.textContent = 'Sem despesas no período';
        }
      }

      // Top 5 maiores despesas
      const topExpenseContainer = document.getElementById('report-top-expenses');
      if (topExpenseContainer) {
        const txs = report.topExpenses;

        if (txs.length === 0) {
          topExpenseContainer.innerHTML = `<p class="empty-state-desc" style="padding: 16px 0;">Sem despesas no período selecionado.</p>`;
        } else {
          topExpenseContainer.innerHTML = txs.map(tx => {
            const cat = window.financialState.getCategoryById(tx.category);
            return `
              <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border-color);">
                <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                  <span class="tx-category-badge"><i class="${cat.icon}" style="color: ${cat.color};"></i> ${this.escapeHtml(cat.name)}</span>
                  <span style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"><strong>${this.escapeHtml(tx.description)}</strong></span>
                </div>
                <span class="tx-amount expense">${this.formatCurrency(tx.amount)}</span>
              </div>
            `;
          }).join('');
        }
      }

      // Despesas pendentes a pagar
      const pendingContainer = document.getElementById('report-pending-expenses');
      if (pendingContainer) {
        const pending = report.pending.slice(0, 6);

        if (pending.length === 0) {
          pendingContainer.innerHTML = `<p class="empty-state-desc" style="padding: 16px 0;">Nenhuma despesa pendente no período. Tudo em dia!</p>`;
        } else {
          pendingContainer.innerHTML = pending.map(tx => {
            const cat = window.financialState.getCategoryById(tx.category);
            return `
              <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border-color);">
                <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                  <span class="tx-category-badge"><i class="${cat.icon}" style="color: ${cat.color};"></i></span>
                  <div style="min-width: 0;">
                    <div style="font-weight: 600; font-size: 0.88rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${this.escapeHtml(tx.description)}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">Venc.: ${this.formatDate(window.financialState.getDueDate(tx))}</div>
                  </div>
                </div>
                <span class="tx-amount expense">${this.formatCurrency(tx.amount)}</span>
              </div>
            `;
          }).join('');
        }
      }
    },

    // --- Compartilhar / Converter Relatórios ---
    periodLabelFor(period) {
      if (!period || period === 'all') return 'Todos os períodos';
      if (/^\d{4}$/.test(period)) return `Ano ${period}`;
      if (/^\d{4}-\d{2}$/.test(period)) return this.periodLabel(period);
      return String(period);
    },

    buildReportSummaryText() {
      const state = window.financialState;
      const report = state.getReport(this.selectedPeriod);
      const m = report.metrics;
      const lines = [];

      lines.push(`Relatório FinanZen — ${this.periodLabelFor(this.selectedPeriod)}`);
      lines.push(`Receitas: ${this.formatCurrency(m.totalIncome)}`);
      lines.push(`Despesas: ${this.formatCurrency(m.totalExpense)}`);
      lines.push(`Resultado: ${this.formatCurrency(m.netBalance)}`);
      if (!Number.isNaN(m.savingsRate)) lines.push(`Taxa de poupança: ${m.savingsRate}%`);

      if (report.topCategory) {
        lines.push(`Maior categoria: ${report.topCategory.name} (${this.formatCurrency(report.topCategory.total)})`);
      }
      if (report.topExpenses.length > 0) {
        lines.push('');
        lines.push('Top despesas:');
        report.topExpenses.forEach(tx => {
          lines.push(`• ${tx.description} — ${this.formatCurrency(tx.amount)}`);
        });
      }
      if (report.pending.length > 0) {
        lines.push('');
        lines.push(`Despesas pendentes: ${report.pending.length} (${this.formatCurrency(m.pendingExpense)})`);
      }

      lines.push('');
      lines.push(`Gerado em ${this.formatDate(state.todayStr())}`);
      return lines.join('\n');
    },

    buildReportCSV() {
      const state = window.financialState;
      const report = state.getReport(this.selectedPeriod);
      const m = report.metrics;
      const esc = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
      const rows = [];

      rows.push(['Relatório FinanZen']);
      rows.push(['Período', this.periodLabelFor(this.selectedPeriod)]);
      rows.push(['Receitas', m.totalIncome.toFixed(2)]);
      rows.push(['Despesas', m.totalExpense.toFixed(2)]);
      rows.push(['Resultado', m.netBalance.toFixed(2)]);
      rows.push(['Pendentes', m.pendingExpense.toFixed(2)]);

      rows.push([]);
      rows.push(['Top Despesas']);
      rows.push(['Descrição', 'Categoria', 'Data', 'Valor']);
      report.topExpenses.forEach(tx => {
        rows.push([tx.description, state.getCategoryById(tx.category).name, tx.date, tx.amount.toFixed(2)]);
      });

      rows.push([]);
      rows.push(['Despesas Pendentes']);
      rows.push(['Descrição', 'Data', 'Valor']);
      report.pending.forEach(tx => {
        rows.push([tx.description, tx.date, tx.amount.toFixed(2)]);
      });

      rows.push([]);
      rows.push(['Despesas por Categoria']);
      rows.push(['Categoria', 'Total']);
      report.byCategory.forEach(c => rows.push([c.name, c.total.toFixed(2)]));

      return '\uFEFF' + rows.map(r => r.map(esc).join(',')).join('\n');
    },

    exportReportCSV() {
      const csv = this.buildReportCSV();
      const uri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
      const link = document.createElement('a');
      link.setAttribute('href', uri);
      link.setAttribute('download', `relatorio_finanzen_${this.selectedPeriod}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      this.showToast('Relatório convertido em CSV!', 'success');
    },

    async copyReportSummary(text = this.buildReportSummaryText()) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }
        this.showToast('Resumo copiado para a área de transferência!', 'success');
        return true;
      } catch (e) {
        this.showToast('Não foi possível copiar o resumo.', 'error');
        return false;
      }
    },

    async shareReport() {
      const text = this.buildReportSummaryText();
      if (navigator.share) {
        try {
          await navigator.share({ title: 'Relatório FinanZen', text });
          this.showToast('Relatório compartilhado!', 'success');
          return;
        } catch (err) {
          if (err && err.name === 'AbortError') return;
        }
      }
      const copied = await this.copyReportSummary(text);
      if (copied) this.showToast('Compartilhamento indisponível — resumo copiado!', 'info');
    },

    printReport() {
      this.showToast('Na janela de impressão, escolha "Salvar como PDF".', 'info');
      setTimeout(() => window.print(), 150);
    },

    setupReportActions() {
      const share = document.getElementById('btn-report-share');
      const pdf = document.getElementById('btn-report-pdf');
      const csv = document.getElementById('btn-report-csv');
      const copy = document.getElementById('btn-report-copy');

      if (share) share.addEventListener('click', () => this.shareReport());
      if (pdf) pdf.addEventListener('click', () => this.printReport());
      if (csv) csv.addEventListener('click', () => this.exportReportCSV());
      if (copy) copy.addEventListener('click', () => this.copyReportSummary());
    },

    // --- Atualização dos Gráficos ---
    renderCharts() {
      let year = new Date().getFullYear();
      if (/^\d{4}$/.test(this.selectedPeriod)) {
        year = parseInt(this.selectedPeriod, 10);
      }
      window.financeCharts.initOrUpdateFlowChart('flowCashChart', year);
      window.financeCharts.initOrUpdateCategoryChart('categoryExpenseChart', this.selectedPeriod);
    },

    // --- Personalização: Categorias, Contas e Moeda ---
    setupCustomization() {
      const newCatForm = document.getElementById('new-category-form');
      if (newCatForm) {
        newCatForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const nameEl = document.getElementById('new-category-name');
          const typeEl = document.getElementById('new-category-type');
          const colorEl = document.getElementById('new-category-color');
          const name = nameEl.value.trim();
          if (!name) {
            this.showToast('Informe um nome para a nova categoria.', 'warning');
            return;
          }
          const type = typeEl.value === 'income' ? 'income' : 'expense';
          const icon = type === 'income' ? 'ri-money-dollar-circle-line' : 'ri-price-tag-3-line';
          window.financialState.addCategory({ name, type, color: colorEl.value, icon });
          nameEl.value = '';
          this.afterCustomizationChange();
          this.showToast('Categoria personalizada criada!', 'success');
        });
      }

      const currencySelect = document.getElementById('settings-currency-select');
      if (currencySelect) {
        currencySelect.addEventListener('change', () => {
          window.financialState.saveSettings({ currency: currencySelect.value });
          this.renderAll();
          this.showToast('Moeda exibida atualizada.', 'info');
        });
      }
    },

    afterCustomizationChange() {
      this.populateCategoryFilterSelect();
      this.populateAccountFilterSelect();
      this.renderAll();
    },

    renderSettingsLists() {
      const currencySelect = document.getElementById('settings-currency-select');
      if (currencySelect) {
        currencySelect.value = window.financialState.settings.currency || 'BRL';
      }

      // Categorias personalizadas
      const catList = document.getElementById('custom-categories-list');
      if (catList) {
        const customs = window.financialState.data.customCategories;
        if (customs.length === 0) {
          catList.innerHTML = `<p style="font-size: 0.82rem; color: var(--text-muted); padding: 6px 0;">Nenhuma categoria personalizada ainda +</p>`;
        } else {
          catList.innerHTML = customs.map(c => `
            <div class="customize-row" data-id="${c.id}">
              <span class="color-dot" style="background: ${this.escapeHtml(c.color)};"></span>
              <span class="row-name">${this.escapeHtml(c.name)}</span>
              <span class="badge-type ${c.type === 'income' ? 'income' : 'expense'}">${c.type === 'income' ? 'Receita' : 'Despesa'}</span>
              <div class="row-actions">
                <input type="color" value="${this.escapeHtml(c.color)}" title="Alterar cor" data-action="color">
                <button class="action-btn" data-action="rename" title="Renomear"><i class="ri-edit-line"></i></button>
                <button class="action-btn delete" data-action="delete" title="Excluir"><i class="ri-delete-bin-line"></i></button>
              </div>
            </div>
          `).join('');
        }

        catList.querySelectorAll('.customize-row').forEach(row => {
          const id = row.getAttribute('data-id');
          const colorInput = row.querySelector('input[type="color"]');
          if (colorInput) {
            colorInput.addEventListener('change', () => {
              window.financialState.updateCategory(id, { color: colorInput.value });
              this.renderSettingsLists();
            });
          }
          row.querySelectorAll('button[data-action]').forEach(btn => {
            btn.addEventListener('click', () => {
              const action = btn.getAttribute('data-action');
              if (action === 'rename') {
                const current = window.financialState.data.customCategories.find(c => c.id === id);
                const name = prompt('Novo nome da categoria:', current ? current.name : '');
                if (name && name.trim()) {
                  window.financialState.updateCategory(id, { name: name.trim() });
                  this.afterCustomizationChange();
                }
              } else if (action === 'delete') {
                if (confirm('Excluir esta categoria? As transações desta categoria serão movidas para "Outras".')) {
                  window.financialState.deleteCategory(id);
                  this.afterCustomizationChange();
                  this.showToast('Categoria excluída.', 'info');
                }
              }
            });
          });
        });
      }

      // Contas / Instituições (Banco, Corretora, Cartão)
      const accList = document.getElementById('accounts-list');
      if (accList) {
        const metrics = window.financialState.getAccountMetrics('all');
        accList.innerHTML = metrics.accounts.map(acc => {
          const meta = window.financialState.getAccountTypeMeta(acc.type);
          const isCredit = acc.type === 'credit';
          const info = isCredit
            ? `Limite ${this.formatCurrency(acc.creditLimit)} • Usado ${this.formatCurrency(acc.used)} • Disp. ${this.formatCurrency(acc.available)}`
            : `Saldo ${this.formatCurrency(acc.value)}`;

          return `
            <div class="customize-row" data-name="${this.escapeHtml(acc.name)}">
              <i class="${meta.icon}" style="color: var(--accent-primary);"></i>
              <span class="row-name">
                ${this.escapeHtml(acc.name)}
                <small style="display: block; font-weight: 400; color: var(--text-muted); font-size: 0.72rem; margin-top: 2px;">${this.escapeHtml(meta.label)} • ${this.escapeHtml(info)}</small>
              </span>
              <div class="row-actions">
                <button class="action-btn" data-action="edit" title="Editar"><i class="ri-edit-line"></i></button>
                <button class="action-btn delete" data-action="delete" title="Excluir"><i class="ri-delete-bin-line"></i></button>
              </div>
            </div>
          `;
        }).join('');

        accList.querySelectorAll('.customize-row').forEach(row => {
          const name = row.getAttribute('data-name');
          row.querySelectorAll('[data-action]').forEach(ctl => {
            ctl.addEventListener('click', () => {
              const action = ctl.getAttribute('data-action');
              if (action === 'edit') {
                this.openEditAccountModal(name);
              } else if (action === 'delete') {
                if (confirm(`Excluir a conta "${name}"? As transações dela serão movidas para a primeira conta restante.`)) {
                  if (window.financialState.deleteAccount(name)) {
                    this.afterCustomizationChange();
                    this.showToast('Conta excluída.', 'info');
                  } else {
                    this.showToast('Não é possível excluir a última conta.', 'warning');
                  }
                }
              }
            });
          });
        });
      }

      // Lançamentos recorrentes
      const recList = document.getElementById('recurring-list');
      if (recList) {
        const rules = window.financialState.data.recurring || [];
        if (rules.length === 0) {
          recList.innerHTML = `<p style="font-size: 0.82rem; color: var(--text-muted); padding: 6px 0;">Nenhum lançamento recorrente. Marque "Repetir" ao criar um lançamento ou uma transferência.</p>`;
        } else {
          const freqLabel = (r) => r.frequency === 'weekly'
            ? 'Semanal'
            : `Mensal (dia ${r.dayOfMonth})`;

          recList.innerHTML = rules.map(r => {
            const route = r.type === 'transfer'
              ? `${r.account} → ${r.toAccount}`
              : `${r.type === 'income' ? 'Receita' : 'Despesa'}${r.account ? ' • ' + r.account : ''}`;
            const statusLabel = r.status === 'pending' ? 'Agendado' : 'Pago';
            return `
              <div class="customize-row" data-id="${r.id}">
                <i class="ri-repeat-line" style="color: ${r.active === false ? 'var(--text-muted)' : 'var(--accent-primary)'};"></i>
                <span class="row-name">
                  ${this.escapeHtml(r.description)}
                  <small style="display: block; font-weight: 400; color: var(--text-muted); font-size: 0.72rem; margin-top: 2px;">
                    ${this.escapeHtml(route)} • ${this.formatCurrency(r.amount)} • ${this.escapeHtml(freqLabel(r))} • ${statusLabel} • próxima ${r.nextDate ? this.formatDate(r.nextDate) : '-'}
                  </small>
                </span>
                <div class="row-actions">
                  <button class="action-btn" data-action="toggle" title="${r.active === false ? 'Reativar' : 'Pausar'}">
                    <i class="${r.active === false ? 'ri-play-line' : 'ri-pause-line'}"></i>
                  </button>
                  <button class="action-btn delete" data-action="delete" title="Excluir"><i class="ri-delete-bin-line"></i></button>
                </div>
              </div>
            `;
          }).join('');

          recList.querySelectorAll('.customize-row').forEach(row => {
            const id = row.getAttribute('data-id');
            row.querySelectorAll('[data-action]').forEach(ctl => {
              ctl.addEventListener('click', () => {
                const action = ctl.getAttribute('data-action');
                if (action === 'toggle') {
                  const rule = window.financialState.toggleRecurring(id);
                  this.renderSettingsLists();
                  this.showToast(rule && rule.active === false ? 'Recorrência pausada.' : 'Recorrência reativada.', 'info');
                } else if (action === 'delete') {
                  if (confirm('Excluir este lançamento recorrente? Os lançamentos já gerados não serão removidos.')) {
                    window.financialState.deleteRecurring(id);
                    this.renderSettingsLists();
                    this.showToast('Recorrência excluída.', 'info');
                  }
                }
              });
            });
          });
        }
      }
    },

    // --- Configuração dos Modais e Formulários ---
    setupModals() {
      // Botão Nova Transação
      const openTxBtns = document.querySelectorAll('.open-tx-modal-btn');
      openTxBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const initialType = btn.getAttribute('data-type') || 'expense';
          this.openNewTxModal(initialType);
        });
      });

      // Botão Novo Orçamento
      const openBudgetBtn = document.getElementById('open-budget-modal-btn');
      if (openBudgetBtn) {
        openBudgetBtn.addEventListener('click', () => {
          this.openNewBudgetModal();
        });
      }

      // Botão Nova Meta
      const openGoalBtn = document.getElementById('open-goal-modal-btn');
      if (openGoalBtn) {
        openGoalBtn.addEventListener('click', () => {
          this.openNewGoalModal();
        });
      }

      // Botão Nova Conta / Instituição
      const openAccountBtn = document.getElementById('open-account-modal-btn');
      if (openAccountBtn) {
        openAccountBtn.addEventListener('click', () => {
          this.openNewAccountModal();
        });
      }

      // Botões de Transferência entre contas
      document.querySelectorAll('.open-transfer-modal-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this.openNewTransferModal();
        });
      });

      const repeatSelect = document.getElementById('transfer-repeat-select');
      if (repeatSelect) {
        repeatSelect.addEventListener('change', () => {
          this.updateRepeatFields(repeatSelect.value);
        });
      }

      const txRepeatSelect = document.getElementById('tx-repeat-select');
      if (txRepeatSelect) {
        txRepeatSelect.addEventListener('change', () => {
          this.updateTxRepeatFields(txRepeatSelect.value);
        });
      }

      // Fechar modais ao clicar no X ou backdrop
      document.querySelectorAll('.modal-close-btn, .modal-cancel-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const modal = e.target.closest('.modal-backdrop');
          if (modal) modal.classList.remove('active');
        });
      });

      document.querySelectorAll('.modal-backdrop').forEach(modal => {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            modal.classList.remove('active');
          }
        });
      });
    },

    openModal(modalId) {
      const modal = document.getElementById(modalId);
      if (modal) modal.classList.add('active');
    },

    closeModal(modalId) {
      const modal = document.getElementById(modalId);
      if (modal) modal.classList.remove('active');
    },

    setupForms() {
      // Toggle de Tipo (Receita / Despesa) dentro do Modal
      const toggleIncomeBtn = document.getElementById('tx-toggle-income');
      const toggleExpenseBtn = document.getElementById('tx-toggle-expense');

      if (toggleIncomeBtn && toggleExpenseBtn) {
        toggleIncomeBtn.addEventListener('click', () => {
          this.activeTxType = 'income';
          toggleIncomeBtn.className = 'type-toggle-btn active income';
          toggleExpenseBtn.className = 'type-toggle-btn';
          this.populateTxCategories('income');
        });

        toggleExpenseBtn.addEventListener('click', () => {
          this.activeTxType = 'expense';
          toggleExpenseBtn.className = 'type-toggle-btn active expense';
          toggleIncomeBtn.className = 'type-toggle-btn';
          this.populateTxCategories('expense');
        });
      }

      // Submissão do Form de Transação
      const txForm = document.getElementById('tx-form');
      if (txForm) {
        txForm.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleSaveTransaction();
        });
      }

      // Submissão do Form de Orçamento
      const budgetForm = document.getElementById('budget-form');
      if (budgetForm) {
        budgetForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const cat = document.getElementById('budget-category-select').value;
          const limit = parseFloat(document.getElementById('budget-amount-input').value) || 0;
          if (!cat || limit <= 0) {
            this.showToast('Preencha a categoria e um limite válido.', 'warning');
            return;
          }
          window.financialState.addOrUpdateBudget(cat, limit);
          this.closeModal('modal-budget');
          this.renderBudgets();
          this.showToast('Orçamento salvo com sucesso!', 'success');
        });
      }

      // Submissão do Form de Meta
      const goalForm = document.getElementById('goal-form');
      if (goalForm) {
        goalForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const title = document.getElementById('goal-title-input').value;
          const target = parseFloat(document.getElementById('goal-target-input').value) || 0;
          const current = parseFloat(document.getElementById('goal-current-input').value) || 0;
          const deadline = document.getElementById('goal-deadline-input').value;
          const icon = document.getElementById('goal-icon-select').value;

          if (!title || target <= 0) {
            this.showToast('Informe o nome da meta e um valor alvo válido.', 'warning');
            return;
          }

          if (this.editingGoalId) {
            window.financialState.updateGoal(this.editingGoalId, {
              title,
              targetAmount: target,
              currentAmount: current,
              deadline,
              icon
            });
            this.showToast('Meta financeira atualizada com sucesso!', 'success');
          } else {
            window.financialState.addGoal({ title, targetAmount: target, currentAmount: current, deadline, icon });
            this.showToast('Meta financeira criada com sucesso!', 'success');
          }
          this.closeModal('modal-goal');
          this.renderGoals();
        });
      }

      // Submissão do Form de Conta / Instituição
      const accountForm = document.getElementById('account-form');
      if (accountForm) {
        accountForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const name = document.getElementById('account-name-input').value.trim();
          const type = document.getElementById('account-type-select').value;
          const openingBalance = parseFloat(document.getElementById('account-opening-input').value) || 0;
          const creditLimit = type === 'credit'
            ? (parseFloat(document.getElementById('account-limit-input').value) || 0)
            : 0;
          const closingDay = type === 'credit'
            ? (parseInt(document.getElementById('account-closing-input').value, 10) || 0)
            : 0;
          const dueDay = type === 'credit'
            ? (parseInt(document.getElementById('account-due-input').value, 10) || 0)
            : 0;

          if (!name) {
            this.showToast('Informe um nome para a conta.', 'warning');
            return;
          }

          if (this.editingAccountId) {
            const current = window.financialState.getAccounts().find(a => a.id === this.editingAccountId);
            if (!current || !window.financialState.updateAccount(current.name, { name, type, openingBalance, creditLimit, closingDay, dueDay })) {
              this.showToast('Não foi possível salvar (nome já em uso?).', 'warning');
              return;
            }
            this.showToast('Conta atualizada!', 'success');
          } else {
            if (!window.financialState.addAccount({ name, type, openingBalance, creditLimit, closingDay, dueDay })) {
              this.showToast('Conta já existe ou nome inválido.', 'warning');
              return;
            }
            this.showToast('Conta criada!', 'success');
          }

          this.closeModal('modal-account');
          this.afterCustomizationChange();
        });
      }

      const accountTypeSelect = document.getElementById('account-type-select');
      if (accountTypeSelect) {
        accountTypeSelect.addEventListener('change', () => {
          this.updateAccountTypeFields(accountTypeSelect.value);
        });
      }

      // Submissão do Form de Transferência entre Contas
      const transferForm = document.getElementById('transfer-form');
      if (transferForm) {
        transferForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const from = document.getElementById('transfer-from-select').value;
          const to = document.getElementById('transfer-to-select').value;
          const amount = parseFloat(document.getElementById('transfer-amount-input').value) || 0;
          const date = document.getElementById('transfer-date-input').value;
          const description = document.getElementById('transfer-desc-input').value.trim();
          const notes = document.getElementById('transfer-notes-input').value.trim();

          if (!from || !to || from === to) {
            this.showToast('Escolha contas de origem e destino diferentes.', 'warning');
            return;
          }
          if (amount <= 0) {
            this.showToast('Informe um valor maior que zero.', 'warning');
            return;
          }

          const fee = parseFloat(document.getElementById('transfer-fee-input').value) || 0;
          const repeat = document.getElementById('transfer-repeat-select').value;
          const repeatDay = parseInt(document.getElementById('transfer-repeat-day-input').value, 10) || 1;

          const payload = {
            type: 'transfer',
            account: from,
            toAccount: to,
            amount,
            fee,
            date,
            description: description || 'Transferência entre contas',
            notes,
            category: '',
            status: 'paid'
          };

          if (this.editingTransferId) {
            window.financialState.updateTransaction(this.editingTransferId, payload);
            if (repeat === 'none') {
              if (this.editingRecurringId) {
                window.financialState.deleteRecurring(this.editingRecurringId);
                this.editingRecurringId = null;
                this.showToast('Transferência atualizada e recorrência removida.', 'success');
              } else {
                this.showToast('Transferência atualizada!', 'success');
              }
            } else {
              this.upsertRecurring({
                id: this.editingRecurringId,
                type: 'transfer',
                description: description || 'Transferência entre contas',
                amount,
                account: from,
                toAccount: to,
                fee,
                category: '',
                date,
                repeat,
                repeatDay,
                status: 'paid'
              });
              this.showToast('Transferência atualizada e marcada como fixa.', 'success');
            }
          } else {
            window.financialState.addTransaction(payload);

            if (repeat !== 'none') {
              this.upsertRecurring({
                type: 'transfer',
                description: description || 'Transferência entre contas',
                amount,
                account: from,
                toAccount: to,
                fee,
                category: '',
                date,
                repeat,
                repeatDay,
                status: 'paid'
              });
              this.showToast('Transferência realizada e agendada!', 'success');
            } else {
              this.showToast('Transferência realizada!', 'success');
            }
          }

          this.closeModal('modal-transfer');
          this.renderAll();
        });
      }

      // Submissão de Depósito em Meta
      const depositForm = document.getElementById('deposit-form');
      if (depositForm) {
        depositForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const goalId = document.getElementById('deposit-goal-id').value;
          const amount = parseFloat(document.getElementById('deposit-amount-input').value) || 0;

          if (amount <= 0) {
            this.showToast('Informe um valor de aporte maior que zero.', 'warning');
            return;
          }

          window.financialState.depositToGoal(goalId, amount);
          this.closeModal('modal-deposit');
          this.renderGoals();
          this.showToast(`Aporte de ${this.formatCurrency(amount)} adicionado!`, 'success');
        });
      }
    },

populateTxCategories(type, selectedCatId = null) {
      const select = document.getElementById('tx-category-select');
      if (!select) return;

      const categories = window.financialState.getCategoriesByType(type);
      select.innerHTML = categories.map(c => `
        <option value="${c.id}" ${selectedCatId === c.id ? 'selected' : ''}>${this.escapeHtml(c.name)}</option>
      `).join('');
    },

    populateBudgetCategorySelect(selectedCatId = null) {
      const select = document.getElementById('budget-category-select');
      if (!select) return;

      const expenseCats = window.financialState.getCategoriesByType('expense');
      select.innerHTML = expenseCats.map(c => `
        <option value="${c.id}" ${selectedCatId === c.id ? 'selected' : ''}>${this.escapeHtml(c.name)}</option>
      `).join('');
    },

    populateTxAccountSelect(selectedAccount = null) {
      const select = document.getElementById('tx-account-input');
      if (!select) return;

      const accounts = window.financialState.getAccountNames();
      select.innerHTML = accounts.map(a => `
        <option value="${this.escapeHtml(a)}" ${selectedAccount === a ? 'selected' : ''}>${this.escapeHtml(a)}</option>
      `).join('');
    },

    populateCategoryFilterSelect() {
      const catSelect = document.getElementById('tx-category-filter');
      if (!catSelect) return;
      const allCats = window.financialState.getAllCategories();
      const current = catSelect.value || 'all';
      catSelect.innerHTML = `<option value="all">Todas as Categorias</option>` +
        allCats.map(c => `<option value="${c.id}" ${current === c.id ? 'selected' : ''}>${this.escapeHtml(c.name)}</option>`).join('');
    },

    populateAccountFilterSelect() {
      const accSelect = document.getElementById('tx-account-filter');
      if (!accSelect) return;
      const accounts = window.financialState.getAccountNames();
      const current = accSelect.value || 'all';
      accSelect.innerHTML = `<option value="all">Todas as Contas</option>` +
        accounts.map(a => `<option value="${this.escapeHtml(a)}" ${current === a ? 'selected' : ''}>${this.escapeHtml(a)}</option>`).join('');
    },

    openNewBudgetModal() {
      document.getElementById('budget-modal-title').textContent = 'Definir Teto de Orçamento';
      document.getElementById('budget-form').reset();
      this.populateBudgetCategorySelect();
      this.openModal('modal-budget');
    },

    openEditBudgetModal(categoryId) {
      const existing = window.financialState.data.budgets.find(b => b.categoryId === categoryId);
      document.getElementById('budget-modal-title').textContent = 'Editar Orçamento';
      this.populateBudgetCategorySelect(categoryId);
      document.getElementById('budget-amount-input').value = existing ? existing.monthlyLimit : '';
      this.openModal('modal-budget');
    },

    openNewGoalModal() {
      this.editingGoalId = null;
      document.getElementById('goal-modal-title').textContent = 'Nova Meta Financeira';
      document.getElementById('goal-form').reset();
      this.openModal('modal-goal');
    },

    openEditGoalModal(id) {
      const goal = window.financialState.data.goals.find(g => g.id === id);
      if (!goal) return;

      this.editingGoalId = id;
      document.getElementById('goal-modal-title').textContent = 'Editar Meta Financeira';
      document.getElementById('goal-title-input').value = goal.title;
      document.getElementById('goal-target-input').value = goal.targetAmount;
      document.getElementById('goal-current-input').value = goal.currentAmount;
      document.getElementById('goal-deadline-input').value = goal.deadline || '';
      document.getElementById('goal-icon-select').value = goal.icon || 'ri-money-dollar-circle-line';
      this.openModal('modal-goal');
    },

    openNewAccountModal() {
      this.editingAccountId = null;
      document.getElementById('account-modal-title').textContent = 'Nova Conta / Instituição';
      const form = document.getElementById('account-form');
      if (form) form.reset();
      document.getElementById('account-type-select').value = 'bank';
      document.getElementById('account-opening-input').value = '';
      document.getElementById('account-limit-input').value = '';
      this.updateAccountTypeFields('bank');
      this.openModal('modal-account');
    },

    openEditAccountModal(name) {
      const acc = window.financialState.getAccountByName(name);
      if (!acc) return;

      this.editingAccountId = acc.id;
      document.getElementById('account-modal-title').textContent = 'Editar Conta / Instituição';
      document.getElementById('account-name-input').value = acc.name;
      document.getElementById('account-type-select').value = acc.type;
      document.getElementById('account-opening-input').value = acc.openingBalance || '';
      document.getElementById('account-limit-input').value = acc.creditLimit || '';
      document.getElementById('account-closing-input').value = acc.closingDay || '';
      document.getElementById('account-due-input').value = acc.dueDay || '';
      this.updateAccountTypeFields(acc.type);
      this.openModal('modal-account');
    },

    updateAccountTypeFields(type) {
      const openingGroup = document.getElementById('account-opening-group');
      const limitGroup = document.getElementById('account-limit-group');
      const invoiceGroup = document.getElementById('account-invoice-group');
      const isCredit = type === 'credit';
      if (openingGroup) openingGroup.style.display = isCredit ? 'none' : '';
      if (limitGroup) limitGroup.style.display = isCredit ? '' : 'none';
      if (invoiceGroup) invoiceGroup.style.display = isCredit ? '' : 'none';
    },

    populateTransferAccountSelects(fromName = null, toName = null) {
      const names = window.financialState.getAccountNames();
      const fromSel = document.getElementById('transfer-from-select');
      const toSel = document.getElementById('transfer-to-select');

      if (fromSel) {
        fromSel.innerHTML = names.map(n =>
          `<option value="${this.escapeHtml(n)}" ${fromName === n ? 'selected' : ''}>${this.escapeHtml(n)}</option>`
        ).join('');
      }
      if (toSel) {
        toSel.innerHTML = names.map(n =>
          `<option value="${this.escapeHtml(n)}" ${toName === n ? 'selected' : ''}>${this.escapeHtml(n)}</option>`
        ).join('');
      }
    },

    updateRepeatFields(value) {
      const group = document.getElementById('transfer-repeat-day-group');
      if (group) group.style.display = value === 'monthly' ? '' : 'none';
    },

    updateTxRepeatFields(value) {
      const group = document.getElementById('tx-repeat-day-group');
      if (group) group.style.display = value === 'monthly' ? '' : 'none';
    },

    openNewTransferModal() {
      this.editingTransferId = null;
      this.editingRecurringId = null;
      document.getElementById('transfer-modal-title').textContent = 'Transferir entre Contas';
      const form = document.getElementById('transfer-form');
      if (form) form.reset();

      const names = window.financialState.getAccountNames();
      this.populateTransferAccountSelects(names[0], names[1] || names[0]);

      const today = new Date().toISOString().split('T')[0];
      document.getElementById('transfer-date-input').value = today;
      document.getElementById('transfer-fee-input').value = '';
      document.getElementById('transfer-repeat-select').value = 'none';
      document.getElementById('transfer-repeat-day-input').value = parseInt(today.split('-')[2], 10) || 1;
      this.updateRepeatFields('none');
      this.openModal('modal-transfer');
    },

    openEditTransferModal(id) {
      const tx = window.financialState.getTransactionById(id);
      if (!tx || tx.type !== 'transfer') return;

      this.editingTransferId = id;
      document.getElementById('transfer-modal-title').textContent = 'Editar Transferência';
      this.populateTransferAccountSelects(tx.account, tx.toAccount);
      document.getElementById('transfer-amount-input').value = tx.amount;
      document.getElementById('transfer-date-input').value = tx.date;
      document.getElementById('transfer-fee-input').value = tx.fee || '';
      document.getElementById('transfer-desc-input').value =
        tx.description === 'Transferência entre contas' ? '' : tx.description;
      document.getElementById('transfer-notes-input').value = tx.notes || '';

      // Se a transferência já pertence a uma regra, exibe a recorrência atual
      const rule = tx.recurringId
        ? (window.financialState.data.recurring || []).find(r => r.id === tx.recurringId)
        : null;
      this.editingRecurringId = rule ? rule.id : null;
      const repeatSelect = document.getElementById('transfer-repeat-select');
      if (rule) {
        repeatSelect.value = rule.frequency;
        document.getElementById('transfer-repeat-day-input').value = rule.dayOfMonth || 1;
      } else {
        repeatSelect.value = 'none';
      }
      this.updateRepeatFields(repeatSelect.value);

      this.openModal('modal-transfer');
    },

    openNewTxModal(type = 'expense') {
      this.editingTxId = null;
      this.editingRecurringId = null;
      document.getElementById('tx-form').reset();
      document.getElementById('tx-modal-title').textContent = 'Nova Transação';

      // Data padrão de hoje
      document.getElementById('tx-date-input').value = new Date().toISOString().split('T')[0];

      // Ajustar toggle de tipo
      this.activeTxType = type;
      const toggleIncome = document.getElementById('tx-toggle-income');
      const toggleExpense = document.getElementById('tx-toggle-expense');
      if (type === 'income') {
        toggleIncome.className = 'type-toggle-btn active income';
        toggleExpense.className = 'type-toggle-btn';
      } else {
        toggleExpense.className = 'type-toggle-btn active expense';
        toggleIncome.className = 'type-toggle-btn';
      }
      this.populateTxCategories(type);
      this.populateTxAccountSelect('Conta Corrente');

      const todayDay = new Date().getDate();
      document.getElementById('tx-repeat-select').value = 'none';
      document.getElementById('tx-repeat-day-input').value = todayDay > 28 ? 28 : todayDay;
      this.updateTxRepeatFields('none');

      this.openModal('modal-transaction');
    },

    openEditTxModal(id) {
      const tx = window.financialState.getTransactionById(id);
      if (!tx) return;

      if (tx.type === 'transfer') {
        this.openEditTransferModal(id);
        return;
      }

      this.editingTxId = id;
      document.getElementById('tx-modal-title').textContent = 'Editar Transação';
      document.getElementById('tx-desc-input').value = tx.description;
      document.getElementById('tx-amount-input').value = tx.amount;
      document.getElementById('tx-date-input').value = tx.date;
      document.getElementById('tx-status-select').value = tx.status || 'paid';
      document.getElementById('tx-due-input').value = tx.dueDate || '';
      document.getElementById('tx-notes-input').value = tx.notes || '';

      this.activeTxType = tx.type;
      const toggleIncome = document.getElementById('tx-toggle-income');
      const toggleExpense = document.getElementById('tx-toggle-expense');
      if (tx.type === 'income') {
        toggleIncome.className = 'type-toggle-btn active income';
        toggleExpense.className = 'type-toggle-btn';
      } else {
        toggleExpense.className = 'type-toggle-btn active expense';
        toggleIncome.className = 'type-toggle-btn';
      }
      this.populateTxCategories(tx.type, tx.category);
      this.populateTxAccountSelect(tx.account || 'Conta Corrente');

      // Se a transação já pertence a uma regra, exibe a recorrência atual
      const rule = tx.recurringId
        ? (window.financialState.data.recurring || []).find(r => r.id === tx.recurringId)
        : null;
      this.editingRecurringId = rule ? rule.id : null;
      const repeatSelect = document.getElementById('tx-repeat-select');
      const repeatDayInput = document.getElementById('tx-repeat-day-input');
      if (rule) {
        repeatSelect.value = rule.frequency;
        repeatDayInput.value = rule.dayOfMonth || repeatDayInput.value;
      } else {
        repeatSelect.value = 'none';
      }
      this.updateTxRepeatFields(repeatSelect.value);

      this.openModal('modal-transaction');
    },

    // Cria ou atualiza a regra recorrente a partir de um lançamento
    upsertRecurring({ id, type, description, amount, category, account, toAccount, fee, date, repeat, repeatDay, status }) {
      const state = window.financialState;
      const anchor = date && date > state.todayStr() ? date : state.todayStr();
      const rule = {
        type,
        description,
        amount,
        category: category || '',
        account: account || '',
        toAccount: toAccount || '',
        fee: fee || 0,
        frequency: repeat,
        dayOfMonth: repeatDay,
        weekday: new Date(`${date || anchor}T00:00:00`).getDay(),
        status,
        nextDate: null
      };
      rule.nextDate = state.computeNextOccurrence(rule, state.addDays(anchor, 1));

      if (id) {
        return state.updateRecurring(id, rule);
      }
      return state.addRecurring(rule);
    },

    handleSaveTransaction() {
      const desc = document.getElementById('tx-desc-input').value.trim();
      const amount = parseFloat(document.getElementById('tx-amount-input').value) || 0;
      const date = document.getElementById('tx-date-input').value;
      const category = document.getElementById('tx-category-select').value;
      const account = document.getElementById('tx-account-input').value;
      const status = document.getElementById('tx-status-select').value;
      const dueDate = document.getElementById('tx-due-input').value;
      const notes = document.getElementById('tx-notes-input').value.trim();
      const repeat = document.getElementById('tx-repeat-select').value;
      const repeatDay = Math.min(Math.max(parseInt(document.getElementById('tx-repeat-day-input').value, 10) || 1, 1), 28);

      if (!desc || amount <= 0) {
        this.showToast('Informe uma descrição e um valor positivo.', 'warning');
        return;
      }

      const txPayload = {
        description: desc,
        amount,
        type: this.activeTxType,
        category,
        date,
        account,
        status,
        dueDate,
        notes
      };

      if (this.editingTxId) {
        window.financialState.updateTransaction(this.editingTxId, txPayload);
        if (repeat === 'none') {
          if (this.editingRecurringId) {
            window.financialState.deleteRecurring(this.editingRecurringId);
            this.editingRecurringId = null;
            this.showToast('Transação atualizada e recorrência removida.', 'success');
          } else {
            this.showToast('Transação atualizada com sucesso!', 'success');
          }
        } else {
          this.upsertRecurring({
            id: this.editingRecurringId,
            type: this.activeTxType,
            description: desc,
            amount,
            category,
            account,
            date,
            repeat,
            repeatDay,
            status
          });
          this.showToast('Transação atualizada e marcada como fixa.', 'success');
        }
      } else {
        window.financialState.addTransaction(txPayload);
        if (repeat === 'monthly' || repeat === 'weekly') {
          this.upsertRecurring({
            type: this.activeTxType,
            description: desc,
            amount,
            category,
            account,
            date,
            repeat,
            repeatDay,
            status
          });
          this.showToast('Lançamento fixo salvo: será gerado automaticamente nos próximos períodos.', 'info');
        } else {
          this.showToast('Nova transação registrada!', 'success');
        }
      }

      this.closeModal('modal-transaction');
      this.renderAll();
    },

    confirmDeleteTx(id) {
      if (confirm('Tem certeza que deseja excluir esta transação?')) {
        window.financialState.deleteTransaction(id);
        this.renderAll();
        this.showToast('Transação excluída.', 'info');
      }
    },

    openDepositModal(goalId) {
      const goal = window.financialState.data.goals.find(g => g.id === goalId);
      if (!goal) return;

      document.getElementById('deposit-goal-id').value = goal.id;
      document.getElementById('deposit-goal-title').textContent = goal.title;
      document.getElementById('deposit-amount-input').value = '';
      this.openModal('modal-deposit');
    },

    // --- Filtros de Tabela de Transações ---
    setupFilters() {
      const searchInput = document.getElementById('tx-search-input');
      const typeSelect = document.getElementById('tx-type-filter');
      const catSelect = document.getElementById('tx-category-filter');
      const statusSelect = document.getElementById('tx-status-filter');
      const accountSelect = document.getElementById('tx-account-filter');

      // Popular categorias e contas nos filtros
      this.populateCategoryFilterSelect();
      this.populateAccountFilterSelect();

      const applyFilters = () => this.renderFullTransactionsTable();

      if (searchInput) searchInput.addEventListener('input', applyFilters);
      if (typeSelect) typeSelect.addEventListener('change', applyFilters);
      if (catSelect) catSelect.addEventListener('change', applyFilters);
      if (statusSelect) statusSelect.addEventListener('change', applyFilters);
      if (accountSelect) accountSelect.addEventListener('change', applyFilters);
    },

    // --- Backup, Exportação e Importação ---
    setupBackupActions() {
      const btnExportJSON = document.getElementById('btn-export-json');
      const btnExportCSV = document.getElementById('btn-export-csv');
      const btnImportJSON = document.getElementById('btn-import-json');
      const inputFile = document.getElementById('import-json-file');
      const btnImportCSV = document.getElementById('btn-import-csv');
      const inputCSVFile = document.getElementById('import-csv-file');
      const btnReset = document.getElementById('btn-reset-data');

      if (btnExportJSON) {
        btnExportJSON.addEventListener('click', () => {
          window.financialState.exportJSON();
          window.financialState.saveSettings({ lastBackupAt: new Date().toISOString() });
          this.renderDataSummary();
          this.showToast('Backup JSON exportado com sucesso!', 'success');
        });
      }

      if (btnExportCSV) {
        btnExportCSV.addEventListener('click', () => {
          window.financialState.exportCSV();
          this.showToast('Planilha CSV baixada com sucesso!', 'success');
        });
      }

      if (btnImportJSON && inputFile) {
        btnImportJSON.addEventListener('click', () => inputFile.click());

        inputFile.addEventListener('change', (e) => {
          const file = e.target.files[0];
          if (!file) return;

          const reader = new FileReader();
          reader.onload = (event) => {
            const success = window.financialState.importJSON(event.target.result);
            if (success) {
              this.showToast('Dados restaurados com sucesso!', 'success');
              this.renderAll();
            } else {
              this.showToast('Arquivo de backup inválido.', 'error');
            }
          };
          reader.readAsText(file);
          inputFile.value = '';
        });
      }

      if (btnImportCSV && inputCSVFile) {
        btnImportCSV.addEventListener('click', () => inputCSVFile.click());

        inputCSVFile.addEventListener('change', (e) => {
          const file = e.target.files[0];
          if (!file) return;

          const reader = new FileReader();
          reader.onload = (event) => {
            if (confirm('Importar CSV substituirá TODAS as transações atuais pelas do arquivo. Continuar?')) {
              const success = window.financialState.importCSV(event.target.result);
              if (success) {
                this.showToast('Transações importadas do CSV com sucesso!', 'success');
                this.renderAll();
              } else {
                this.showToast('Arquivo CSV inválido. Use o formato exportado pelo FinanZen.', 'error');
              }
            }
          };
          reader.readAsText(file);
          inputCSVFile.value = '';
        });
      }

      if (btnReset) {
        btnReset.addEventListener('click', () => {
          if (confirm('Atenção: Isso irá apagar seus dados personalizados e restaurar os dados de exemplo. Continuar?')) {
            window.financialState.resetAllData();
            this.renderAll();
            this.showToast('Dados restaurados para o padrão de demonstração.', 'info');
          }
        });
      }
    },

    // --- Toast Notifications ---
    showToast(message, type = 'info') {
      let container = document.getElementById('toast-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
      }

      const toast = document.createElement('div');
      toast.className = `toast ${type}`;

      let icon = 'ri-information-line';
      if (type === 'success') icon = 'ri-checkbox-circle-line';
      if (type === 'error') icon = 'ri-error-warning-line';
      if (type === 'warning') icon = 'ri-alert-line';

      toast.innerHTML = `
        <i class="${icon}" style="font-size: 1.2rem;"></i>
        <span>${message}</span>
      `;

      container.appendChild(toast);

      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(50px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
      }, 3500);
    }
  };

  window.app = app;
  app.init();
});
