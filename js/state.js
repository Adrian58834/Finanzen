/**
 * FinanZen - Gerenciamento de Estado e Persistência de Dados
 */

class FinancialState {
  constructor() {
    this.STORAGE_KEY = 'finanzen_data_v1';
    this.SETTINGS_KEY = 'finanzen_settings_v1';
    this.LAST_CHANGE_KEY = 'finanzen_last_local_change';
    this.RECOVERY_KEY = 'finanzen_recovery_v1';
    this.MAX_RECOVERY_SNAPSHOTS = 8;

    this.defaultCategories = {
      income: [
        { id: 'cat_salario', name: 'Salário & Renda', icon: 'ri-money-dollar-circle-line', color: '#10b981' },
        { id: 'cat_freelance', name: 'Freelance & Extras', icon: 'ri-briefcase-line', color: '#06b6d4' },
        { id: 'cat_investimentos', name: 'Rendimentos & Dividendos', icon: 'ri-line-chart-line', color: '#8b5cf6' },
        { id: 'cat_vendas', name: 'Vendas', icon: 'ri-shopping-bag-line', color: '#f59e0b' },
        { id: 'cat_outros_inc', name: 'Outras Receitas', icon: 'ri-wallet-3-line', color: '#64748b' }
      ],
      expense: [
        { id: 'cat_moradia', name: 'Moradia & Contas', icon: 'ri-home-4-line', color: '#6366f1' },
        { id: 'cat_alimentacao', name: 'Alimentação & Mercado', icon: 'ri-restaurant-line', color: '#f97316' },
        { id: 'cat_transporte', name: 'Transporte & Combustível', icon: 'ri-car-line', color: '#0ea5e9' },
        { id: 'cat_saude', name: 'Saúde & Cuidados', icon: 'ri-heart-pulse-line', color: '#ec4899' },
        { id: 'cat_educacao', name: 'Educação & Cursos', icon: 'ri-book-open-line', color: '#14b8a6' },
        { id: 'cat_lazer', name: 'Lazer & Viagens', icon: 'ri-gamepad-line', color: '#eab308' },
        { id: 'cat_assinaturas', name: 'Assinaturas & Serviços', icon: 'ri-tv-line', color: '#a855f7' },
        { id: 'cat_tarifas', name: 'Tarifas & Juros', icon: 'ri-bank-line', color: '#ef4444' },
        { id: 'cat_outros_exp', name: 'Outras Despesas', icon: 'ri-more-fill', color: '#64748b' }
      ]
    };

    this.ACCOUNT_TYPES = {
      bank: { label: 'Banco', icon: 'ri-bank-line' },
      broker: { label: 'Corretora', icon: 'ri-line-chart-line' },
      credit: { label: 'Cartão de Crédito', icon: 'ri-bank-card-line' },
      wallet: { label: 'Carteira / Dinheiro', icon: 'ri-wallet-3-line' }
    };

    this.DEFAULT_ACCOUNTS = [
      { id: 'acc_conta_corrente', name: 'Conta Corrente', type: 'bank', openingBalance: 0, creditLimit: 0 },
      { id: 'acc_nubank', name: 'Nubank', type: 'bank', openingBalance: 0, creditLimit: 0 },
      { id: 'acc_investimentos', name: 'Investimentos / Poupança', type: 'broker', openingBalance: 0, creditLimit: 0 },
      { id: 'acc_carteira', name: 'Carteira / Dinheiro', type: 'wallet', openingBalance: 0, creditLimit: 0 },
      { id: 'acc_cartao', name: 'Cartão de Crédito', type: 'credit', openingBalance: 0, creditLimit: 5000, closingDay: 25, dueDay: 5 },
      { id: 'acc_outro', name: 'Outro', type: 'bank', openingBalance: 0, creditLimit: 0 }
    ];

    this.data = this.loadData();
    this.settings = this.loadSettings();
  }

  loadSettings() {
    try {
      const stored = localStorage.getItem(this.SETTINGS_KEY);
      return this.normalizeSettings(stored ? JSON.parse(stored) : {});
    } catch (e) {
      return { theme: 'dark', currency: 'BRL' };
    }
  }

  saveSettings(settings) {
    this.settings = this.normalizeSettings({ ...this.settings, ...settings });
    localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(this.settings));
    this.notifyDataChanged();
  }

  normalizeSettings(settings) {
    const source = settings && typeof settings === 'object' ? settings : {};
    const currency = String(source.currency || 'BRL').toUpperCase();
    const normalized = {
      theme: source.theme === 'light' ? 'light' : 'dark',
      currency: /^[A-Z]{3}$/.test(currency) ? currency : 'BRL'
    };
    const backupTime = typeof source.lastBackupAt === 'string' ? Date.parse(source.lastBackupAt) : NaN;
    if (Number.isFinite(backupTime)) normalized.lastBackupAt = new Date(backupTime).toISOString();
    const notifyDate = String(source.lastNotifyDate || '');
    if (/^\d{4}-\d{2}-\d{2}$/.test(notifyDate)) normalized.lastNotifyDate = notifyDate;
    return normalized;
  }

  loadData() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const data = this.normalizeData(JSON.parse(stored));
        if (data) return data;
      }
    } catch (e) {
      console.error('Erro ao carregar dados locais:', e);
    }
    // Carga inicial com dados demonstrativos inteligentes no mês corrente
    return this.generateSeedData();
  }

  safeText(value, fallback = '', maxLength = 200) {
    const text = String(value ?? fallback)
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .trim();
    return (text || fallback).slice(0, maxLength);
  }

  safeId(value, prefix = 'id') {
    const id = String(value || '').trim();
    if (/^[A-Za-z0-9_-]{1,100}$/.test(id)) return id;
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  safeIcon(value, fallback = 'ri-price-tag-3-line') {
    const icon = String(value || '').trim();
    return /^ri-[a-z0-9-]{1,80}$/.test(icon) ? icon : fallback;
  }

  safeColor(value, fallback = '#8b5cf6') {
    const color = String(value || '').trim();
    return /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : fallback;
  }

  safeDate(value, fallback = '') {
    const date = String(value || '').trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!match) return fallback;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = new Date(year, month - 1, day);
    if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return fallback;
    return date;
  }

  safeAmount(value, fallback = 0) {
    const amount = Number(value);
    return Number.isFinite(amount) && amount >= 0 && amount <= Number.MAX_SAFE_INTEGER ? amount : fallback;
  }

  safeSignedAmount(value, fallback = 0) {
    const amount = Number(value);
    return Number.isFinite(amount) && Math.abs(amount) <= Number.MAX_SAFE_INTEGER ? amount : fallback;
  }

  normalizeTransactions(raw) {
    if (!Array.isArray(raw)) return [];
    const seen = new Set();
    return raw.map(item => {
      if (!item || typeof item !== 'object') return null;
      const amount = this.safeAmount(item.amount, -1);
      if (amount < 0) return null;
      let id = this.safeId(item.id, 'tx');
      if (seen.has(id)) id = this.safeId('', 'tx');
      seen.add(id);

      const type = ['income', 'expense', 'transfer'].includes(item.type) ? item.type : 'expense';
      const tx = {
        id,
        description: this.safeText(item.description, type === 'transfer' ? 'Transferência entre contas' : 'Sem descrição', 160),
        amount,
        type,
        category: type === 'transfer'
          ? ''
          : (/^[A-Za-z0-9_-]{1,100}$/.test(String(item.category || ''))
            ? String(item.category)
            : (type === 'income' ? 'cat_outros_inc' : 'cat_outros_exp')),
        date: this.safeDate(item.date, this.todayStr()),
        account: this.safeText(item.account, 'Conta Corrente', 100),
        status: item.status === 'pending' ? 'pending' : 'paid',
        dueDate: this.safeDate(item.dueDate, ''),
        notes: this.safeText(item.notes, '', 1000)
      };

      if (type === 'transfer') {
        tx.toAccount = this.safeText(item.toAccount, '', 100);
        tx.fee = this.safeAmount(item.fee, 0);
      }
      if (item.fixed === true) {
        tx.fixed = true;
        tx.recurringId = item.recurringId ? this.safeId(item.recurringId, 'rec') : null;
      }
      if (item.installmentGroup) {
        tx.installmentGroup = this.safeId(item.installmentGroup, 'inst');
        tx.installmentCurrent = Math.max(1, parseInt(item.installmentCurrent, 10) || 1);
        tx.installmentTotal = Math.max(tx.installmentCurrent, parseInt(item.installmentTotal, 10) || tx.installmentCurrent);
        tx.totalAmount = this.safeAmount(item.totalAmount, amount);
      }
      return tx;
    }).filter(Boolean);
  }

  normalizeData(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !Array.isArray(raw.transactions)) return null;

    const customCategories = this.normalizeCustomCategories(raw.customCategories);
    const budgets = Array.isArray(raw.budgets) ? raw.budgets.map(item => {
      if (!item || typeof item !== 'object') return null;
      const monthlyLimit = this.safeAmount(item.monthlyLimit, -1);
      if (monthlyLimit < 0) return null;
      return {
        id: this.safeId(item.id, 'bdg'),
        categoryId: /^[A-Za-z0-9_-]{1,100}$/.test(String(item.categoryId || ''))
          ? String(item.categoryId)
          : 'cat_outros_exp',
        monthlyLimit
      };
    }).filter(Boolean) : [];

    const goals = Array.isArray(raw.goals) ? raw.goals.map(item => {
      if (!item || typeof item !== 'object') return null;
      return {
        id: this.safeId(item.id, 'goal'),
        title: this.safeText(item.title, 'Nova Meta', 120),
        targetAmount: this.safeAmount(item.targetAmount, 0),
        currentAmount: this.safeAmount(item.currentAmount, 0),
        deadline: this.safeDate(item.deadline, ''),
        icon: this.safeIcon(item.icon, 'ri-money-dollar-circle-line')
      };
    }).filter(Boolean) : [];

    return {
      transactions: this.normalizeTransactions(raw.transactions),
      budgets,
      goals,
      accounts: this.normalizeAccounts(raw.accounts),
      customCategories,
      recurring: this.normalizeRecurring(raw.recurring),
      tombstones: this.normalizeTombstones(raw.tombstones)
    };
  }

  emptyTombstones() {
    return {
      transactions: {},
      budgets: {},
      goals: {},
      accounts: {},
      customCategories: {},
      recurring: {}
    };
  }

  normalizeTombstones(raw) {
    const result = this.emptyTombstones();
    const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    Object.keys(result).forEach(collection => {
      const entries = source[collection];
      if (!entries || typeof entries !== 'object' || Array.isArray(entries)) return;
      Object.entries(entries).forEach(([id, timestamp]) => {
        if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) return;
        const time = Number(timestamp);
        if (Number.isFinite(time) && time > 0) result[collection][id] = time;
      });
    });
    return result;
  }

  markDeleted(collection, id) {
    if (!id || !this.emptyTombstones()[collection]) return;
    if (!this.data.tombstones) this.data.tombstones = this.emptyTombstones();
    this.data.tombstones[collection][String(id)] = Date.now();
  }

  clearDeleted(collection, id) {
    if (this.data.tombstones && this.data.tombstones[collection]) {
      delete this.data.tombstones[collection][String(id)];
    }
  }

  mergeData(first, second, preferSecond = true) {
    const left = this.normalizeData(first);
    const right = this.normalizeData(second);
    if (!left) return right;
    if (!right) return left;

    const tombstones = this.emptyTombstones();
    Object.keys(tombstones).forEach(collection => {
      tombstones[collection] = {
        ...(left.tombstones[collection] || {}),
        ...(right.tombstones[collection] || {})
      };
    });

    const mergeCollection = (collection, key = 'id') => {
      const map = new Map();
      const preferred = preferSecond ? (right[collection] || []) : (left[collection] || []);
      const fallback = preferSecond ? (left[collection] || []) : (right[collection] || []);
      preferred.forEach(item => {
        const id = item && item[key];
        if (id) map.set(String(id), item);
      });
      fallback.forEach(item => {
        const id = item && item[key];
        if (id && !map.has(String(id))) map.set(String(id), item);
      });
      return [...map.values()].filter(item => !tombstones[collection][String(item[key])]);
    };

    return {
      transactions: mergeCollection('transactions'),
      budgets: mergeCollection('budgets'),
      goals: mergeCollection('goals'),
      accounts: mergeCollection('accounts'),
      customCategories: mergeCollection('customCategories'),
      recurring: mergeCollection('recurring'),
      tombstones
    };
  }

  saveData() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.error('Erro ao salvar dados no localStorage:', e);
    }
    this.notifyDataChanged();
  }

  // Avisa o módulo de sincronização (quando presente) que houve alteração
  notifyDataChanged() {
    if (this._suspendSync) return;
    // Marca o instante real da última alteração local: usado pelo sync para
    // decidir entre baixar da nuvem ou enviar (evita sobrescrever edição local).
    try {
      localStorage.setItem(this.LAST_CHANGE_KEY, String(Date.now()));
    } catch (e) {
      console.error('Erro ao registrar alteração local:', e);
    }
    if (typeof window !== 'undefined' && window.financeSync && typeof window.financeSync.schedulePush === 'function') {
      window.financeSync.schedulePush();
    }
  }

  generateSeedData() {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');

    const seedTransactions = [
      {
        id: 'tx_seed_1',
        description: 'Salário Mensal',
        amount: 6500.00,
        type: 'income',
        category: 'cat_salario',
        date: `${y}-${m}-05`,
        account: 'Conta Corrente',
        status: 'paid',
        notes: 'Depósito em conta principal'
      },
      {
        id: 'tx_seed_2',
        description: 'Projeto Freelance Web',
        amount: 1800.00,
        type: 'income',
        category: 'cat_freelance',
        date: `${y}-${m}-12`,
        account: 'Nubank',
        status: 'paid',
        notes: 'Landing page entregue'
      },
      {
        id: 'tx_seed_3',
        description: 'Aluguel do Apartamento',
        amount: 1950.00,
        type: 'expense',
        category: 'cat_moradia',
        date: `${y}-${m}-06`,
        account: 'Conta Corrente',
        status: 'paid',
        notes: 'Boleto pago via débito'
      },
      {
        id: 'tx_seed_4',
        description: 'Supermercado Mensal',
        amount: 840.50,
        type: 'expense',
        category: 'cat_alimentacao',
        date: `${y}-${m}-08`,
        account: 'Cartão de Crédito',
        status: 'paid',
        notes: 'Compras do mês'
      },
      {
        id: 'tx_seed_5',
        description: 'Combustível Posto Ipiranga',
        amount: 220.00,
        type: 'expense',
        category: 'cat_transporte',
        date: `${y}-${m}-11`,
        account: 'Cartão de Crédito',
        status: 'paid',
        notes: 'Tanque cheio'
      },
      {
        id: 'tx_seed_6',
        description: 'Netflix, Spotify & Prime',
        amount: 89.90,
        type: 'expense',
        category: 'cat_assinaturas',
        date: `${y}-${m}-14`,
        account: 'Cartão de Crédito',
        status: 'paid',
        notes: 'Cobrança recorrente'
      },
      {
        id: 'tx_seed_7',
        description: 'Jantar Restaurante',
        amount: 165.00,
        type: 'expense',
        category: 'cat_lazer',
        date: `${y}-${m}-15`,
        account: 'Cartão de Crédito',
        status: 'paid',
        notes: 'Comemoração em família'
      },
      {
        id: 'tx_seed_8',
        description: 'Curso de Especialização',
        amount: 249.00,
        type: 'expense',
        category: 'cat_educacao',
        date: `${y}-${m}-18`,
        account: 'Cartão de Crédito',
        status: 'pending',
        notes: 'Vence no dia 20'
      }
    ];

    const seedBudgets = [
      {
        id: 'bdg_1',
        categoryId: 'cat_alimentacao',
        monthlyLimit: 1200.00
      },
      {
        id: 'bdg_2',
        categoryId: 'cat_moradia',
        monthlyLimit: 2200.00
      },
      {
        id: 'bdg_3',
        categoryId: 'cat_transporte',
        monthlyLimit: 500.00
      },
      {
        id: 'bdg_4',
        categoryId: 'cat_lazer',
        monthlyLimit: 600.00
      }
    ];

    const seedGoals = [
      {
        id: 'goal_1',
        title: 'Reserva de Emergência',
        targetAmount: 25000.00,
        currentAmount: 14200.00,
        deadline: `${y + 1}-12-31`,
        icon: 'ri-shield-check-line'
      },
      {
        id: 'goal_2',
        title: 'Viagem de Férias',
        targetAmount: 8000.00,
        currentAmount: 4500.00,
        deadline: `${y + 1}-07-15`,
        icon: 'ri-plane-line'
      },
      {
        id: 'goal_3',
        title: 'Notebook Novo',
        targetAmount: 6000.00,
        currentAmount: 2100.00,
        deadline: `${y}-11-30`,
        icon: 'ri-macbook-line'
      }
    ];

    const initialData = {
      transactions: seedTransactions,
      budgets: seedBudgets,
      goals: seedGoals,
      accounts: this.cloneDefaultAccounts(),
      customCategories: [],
      recurring: [],
      tombstones: this.emptyTombstones()
    };

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(initialData));
    return initialData;
  }

  normalizeCustomCategories(raw) {
    const defaultIds = [
      ...this.defaultCategories.income,
      ...this.defaultCategories.expense
    ].map(c => c.id);

    let list = [];
    if (Array.isArray(raw)) {
      list = raw.map(c => ({ ...c, type: c.type === 'income' ? 'income' : 'expense' }));
    } else if (raw && typeof raw === 'object') {
      (Array.isArray(raw.income) ? raw.income : []).forEach(c => list.push({ ...c, type: 'income' }));
      (Array.isArray(raw.expense) ? raw.expense : []).forEach(c => list.push({ ...c, type: 'expense' }));
    }
    // Mantém apenas categorias realmente customizadas (IDs que não existem nos padrões)
    const seen = new Set(defaultIds);
    return list.map(c => {
      if (!c || typeof c !== 'object') return null;
      const name = this.safeText(c.name, '', 80);
      if (!name) return null;
      const id = this.safeId(c.id, 'cat_c');
      if (seen.has(id)) return null;
      seen.add(id);
      return {
        id,
        name,
        icon: this.safeIcon(c.icon),
        color: this.safeColor(c.color),
        type: c.type === 'income' ? 'income' : 'expense'
      };
    }).filter(Boolean);
  }

  normalizeAccounts(raw) {
    let list = [];
    if (Array.isArray(raw) && raw.length > 0) {
      list = raw.map(a => this.normalizeAccount(a)).filter(Boolean);
    }
    if (list.length === 0) {
      return this.cloneDefaultAccounts();
    }
    // Garante IDs únicos
    const seen = new Set();
    list.forEach(a => {
      if (!a.id || seen.has(a.id)) {
        a.id = 'acc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      }
      seen.add(a.id);
    });
    return list;
  }

  normalizeAccount(account) {
    if (typeof account === 'string') {
      const name = this.safeText(account, '', 100);
      if (!name) return null;
      return {
        id: 'acc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        name,
        type: this.inferAccountType(name),
        openingBalance: 0,
        creditLimit: 0,
        closingDay: 0,
        dueDay: 0
      };
    }
    if (account && typeof account === 'object' && account.name) {
      const name = this.safeText(account.name, '', 100);
      if (!name) return null;
      return {
        id: this.safeId(account.id, 'acc'),
        name,
        type: this.ACCOUNT_TYPES[account.type] ? account.type : this.inferAccountType(name),
        openingBalance: this.safeSignedAmount(account.openingBalance, 0),
        creditLimit: this.safeAmount(account.creditLimit, 0),
        closingDay: this.clampDayOfMonth(account.closingDay),
        dueDay: this.clampDayOfMonth(account.dueDay)
      };
    }
    return null;
  }

  clampDayOfMonth(value) {
    const n = parseInt(value, 10);
    if (!n || n < 1) return 0;
    return Math.min(n, 31);
  }

  inferAccountType(name) {
    const n = String(name).toLowerCase();
    if (n.includes('carteira') || n.includes('dinheiro') || n.includes('esp') || n.includes('cash')) return 'wallet';
    if (n.includes('cartão') || n.includes('cartao') || n.includes('crédito') || n.includes('credito')) return 'credit';
    if (n.includes('corret') || n.includes('invest') || n.includes('poupan')) return 'broker';
    return 'bank';
  }

  cloneDefaultAccounts() {
    return this.DEFAULT_ACCOUNTS.map(a => ({ ...a }));
  }

  getAccountTypeMeta(type) {
    return this.ACCOUNT_TYPES[type] || this.ACCOUNT_TYPES.bank;
  }

  // --- CRUD Transações ---
  addTransaction(tx, options = {}) {
    const type = ['income', 'expense', 'transfer'].includes(tx.type) ? tx.type : 'expense';
    const newTx = {
      id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      amount: this.safeAmount(tx.amount, 0),
      description: this.safeText(tx.description, type === 'transfer' ? 'Transferência entre contas' : 'Sem descrição', 160),
      type,
      category: type === 'transfer'
        ? ''
        : (/^[A-Za-z0-9_-]{1,100}$/.test(String(tx.category || ''))
          ? String(tx.category)
          : (type === 'income' ? 'cat_outros_inc' : 'cat_outros_exp')),
      date: this.safeDate(tx.date, this.todayStr()),
      account: this.safeText(tx.account, 'Conta Corrente', 100),
      status: tx.status === 'pending' ? 'pending' : 'paid',
      dueDate: this.safeDate(tx.dueDate, ''),
      notes: this.safeText(tx.notes, '', 1000)
    };

    if (type === 'transfer') {
      newTx.toAccount = this.safeText(tx.toAccount, '', 100);
      newTx.fee = this.safeAmount(tx.fee, 0);
    }

    // Compra no cartão de crédito vira dívida da fatura: só é paga quando a
    // fatura for paga, e o vencimento segue o ciclo do cartão.
    if (type === 'expense' && this.isCreditCardAccount(newTx.account)) {
      newTx.status = 'pending';
      if (!newTx.dueDate) {
        const account = this.getAccountByName(newTx.account);
        const cfg = this.getCardInvoiceConfig(account);
        newTx.dueDate = this.computeInvoiceDates(newTx.date, cfg.closingDay, cfg.dueDay).dueDate;
      }
    }

    if (tx.fixed) {
      newTx.fixed = true;
      newTx.recurringId = tx.recurringId || null;
    }

    this.clearDeleted('transactions', newTx.id);
    this.data.transactions.unshift(newTx);
    if (options.save !== false) this.saveData();
    return newTx;
  }

  // --- Lançamento de Compras Parceladas no Cartão ---
  addInstallmentTransactions(tx, installmentsCount = 1) {
    const count = parseInt(installmentsCount, 10) || 1;
    if (count <= 1) {
      return [this.addTransaction(tx)];
    }

    const totalAmount = parseFloat(tx.amount) || 0;
    const installmentAmount = Math.round((totalAmount / count) * 100) / 100;
    const remainder = Math.round((totalAmount - (installmentAmount * count)) * 100) / 100;

    const groupId = 'inst_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

    let year = new Date().getFullYear();
    let month = new Date().getMonth();
    let day = new Date().getDate();

    if (tx.date) {
      const parts = String(tx.date).split('-').map(Number);
      if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
        year = parts[0];
        month = parts[1] - 1;
        day = parts[2];
      }
    }

    const createdList = [];
    for (let i = 1; i <= count; i++) {
      // Adiciona o ajuste de centavos na primeira parcela
      const currentAmount = i === 1 ? (installmentAmount + remainder) : installmentAmount;

      // Calcula a data de cada parcela sem bug de UTC
      const pDate = new Date(year, month + (i - 1), day);
      const pYear = pDate.getFullYear();
      const pMonth = String(pDate.getMonth() + 1).padStart(2, '0');
      const pDay = String(pDate.getDate()).padStart(2, '0');
      const formattedDate = `${pYear}-${pMonth}-${pDay}`;

      const installmentTx = {
        id: 'tx_' + Date.now() + '_' + i + '_' + Math.random().toString(36).substring(2, 4),
        amount: currentAmount,
        description: `${tx.description || 'Compra Parcelada'} (${i}/${count})`,
        type: 'expense',
        category: tx.category || 'cat_outros_exp',
        date: formattedDate,
        account: tx.account || 'Cartão de Crédito',
        status: tx.status || 'paid',
        dueDate: tx.dueDate || '',
        notes: tx.notes || `Parcela ${i} de ${count} (Valor total: R$ ${totalAmount.toFixed(2)})`,
        installmentGroup: groupId,
        installmentCurrent: i,
        installmentTotal: count,
        totalAmount
      };

      // Cada parcela entra na fatura do mês que recebe a compra e só é paga
      // junto com a fatura.
      if (this.isCreditCardAccount(installmentTx.account)) {
        installmentTx.status = 'pending';
        if (!installmentTx.dueDate) {
          const account = this.getAccountByName(installmentTx.account);
          const cfg = this.getCardInvoiceConfig(account);
          installmentTx.dueDate = this.computeInvoiceDates(formattedDate, cfg.closingDay, cfg.dueDay).dueDate;
        }
      }

      this.data.transactions.unshift(installmentTx);
      createdList.push(installmentTx);
    }

    this.saveData();
    return createdList;
  }

  // --- Módulo Avançado de Cartão de Crédito ---
  getCreditCardAccounts() {
    return this.getAccounts().filter(a => a.type === 'credit' || this.inferAccountType(a.name) === 'credit');
  }

  // A conta informada é um cartão de crédito?
  isCreditCardAccount(accountName) {
    if (!accountName) return false;
    const account = this.getAccountByName(accountName);
    if (!account) return false;
    return account.type === 'credit' || this.inferAccountType(account.name) === 'credit';
  }

  // Despesa lançada em cartão de crédito: só existe como dívida da fatura
  isCreditCardExpense(tx) {
    return Boolean(tx && tx.type === 'expense' && this.isCreditCardAccount(tx.account));
  }

  // Dias de fechamento/vencimento do cartão (padrões: dia 25 e dia 5)
  getCardInvoiceConfig(account) {
    return {
      closingDay: account && account.closingDay > 0 ? account.closingDay : 25,
      dueDay: account && account.dueDay > 0 ? account.dueDay : 5
    };
  }

  // Período da fatura (AAAA-MM) que recebe uma compra feita em dateStr
  getInvoicePeriodForAccount(account, dateStr) {
    const { closingDay } = this.getCardInvoiceConfig(account);
    return this.getInvoicePeriodForDate(dateStr, closingDay);
  }

  // Identifica a qual período de fatura pertence uma compra no cartão
  getInvoicePeriodForDate(dateStr, closingDay = 25) {
    if (!dateStr) return '';
    const parts = dateStr.split('-').map(Number);
    if (parts.length < 3) return dateStr.substring(0, 7);

    let year = parts[0];
    let month = parts[1];
    const day = parts[2];

    const actualClosingDay = closingDay > 0 ? closingDay : 25;

    // Se a compra foi feita DEPOIS do fechamento da fatura, ela entra na fatura do mês seguinte
    if (day > actualClosingDay) {
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }

    return `${year}-${String(month).padStart(2, '0')}`;
  }

  getCreditCardDetails(accountName) {
    const account = this.getAccountByName(accountName);
    if (!account) return null;

    const { closingDay, dueDay } = this.getCardInvoiceConfig(account);
    const creditLimit = account.creditLimit > 0 ? account.creditLimit : 5000;

    const cardTxs = this.data.transactions.filter(t => t.account === accountName && t.type === 'expense');

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();

    // Melhor dia de compra: nos 3 dias seguintes ao fechamento da fatura
    let isBestDayToBuy = false;
    if (currentDay > closingDay && currentDay <= closingDay + 3) {
      isBestDayToBuy = true;
    } else if (closingDay >= 28 && currentDay <= 2) {
      isBestDayToBuy = true;
    }

    // Período da fatura aberta atual (ex: 2026-10)
    let currentInvoicePeriod = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    if (currentDay > closingDay) {
      let nextM = currentMonth + 1;
      let nextY = currentYear;
      if (nextM > 12) { nextM = 1; nextY += 1; }
      currentInvoicePeriod = `${nextY}-${String(nextM).padStart(2, '0')}`;
    }

    // Próxima fatura
    const currentInvoiceDateObj = new Date(Number(currentInvoicePeriod.split('-')[0]), Number(currentInvoicePeriod.split('-')[1]) - 1, 1);
    const nextInvoiceDateObj = new Date(currentInvoiceDateObj.getFullYear(), currentInvoiceDateObj.getMonth() + 1, 1);
    const nextInvoicePeriod = `${nextInvoiceDateObj.getFullYear()}-${String(nextInvoiceDateObj.getMonth() + 1).padStart(2, '0')}`;

    let currentInvoiceTotal = 0;
    let nextInvoiceTotal = 0;
    let totalLimitUsed = 0;

    // Agrupa transações por fatura
    const invoiceMap = {};

    cardTxs.forEach(tx => {
      const invPeriod = this.getInvoicePeriodForDate(tx.date, closingDay);
      if (!invoiceMap[invPeriod]) {
        invoiceMap[invPeriod] = {
          period: invPeriod,
          total: 0,
          paidTotal: 0,
          pendingTotal: 0,
          transactions: []
        };
      }

      invoiceMap[invPeriod].transactions.push(tx);
      invoiceMap[invPeriod].total += tx.amount;

      if (tx.status === 'paid') {
        invoiceMap[invPeriod].paidTotal += tx.amount;
      } else {
        invoiceMap[invPeriod].pendingTotal += tx.amount;
        totalLimitUsed += tx.amount;
      }

      if (invPeriod === currentInvoicePeriod) {
        currentInvoiceTotal += tx.amount;
      } else if (invPeriod === nextInvoicePeriod) {
        nextInvoiceTotal += tx.amount;
      }
    });

    const limitAvailable = Math.max(0, creditLimit - totalLimitUsed);

    return {
      account,
      closingDay,
      dueDay,
      creditLimit,
      totalLimitUsed,
      limitAvailable,
      currentInvoicePeriod,
      currentInvoiceTotal,
      nextInvoicePeriod,
      nextInvoiceTotal,
      isBestDayToBuy,
      invoiceMap
    };
  }

  // Paga a fatura de um período: as compras do ciclo deixam de ser "futura"
  // e passam a constar como pagas. O débito sai da conta de origem.
  payCreditCardInvoice(accountName, period, paymentSourceAccount = 'Conta Corrente') {
    const account = this.getAccountByName(accountName);
    if (!account) return { countPaid: 0, totalPaid: 0 };

    const cardTxs = this.data.transactions.filter(t => t.account === accountName && t.type === 'expense');

    let countPaid = 0;
    let totalPaid = 0;

    cardTxs.forEach(t => {
      if (this.getInvoicePeriodForAccount(account, t.date) === period && t.status !== 'paid') {
        t.status = 'paid';
        countPaid++;
        totalPaid += t.amount;
      }
    });

    if (totalPaid > 0) {
      // Quitação é uma transferência da conta pagadora para o cartão:
      // zera a dívida sem contabilizar como nova despesa (a compra já foi).
      const source = paymentSourceAccount && paymentSourceAccount !== accountName
        ? paymentSourceAccount
        : 'Conta Corrente';

      if (source !== accountName) {
        this.addTransaction({
          description: `Pagamento Fatura ${accountName} (${period})`,
          amount: totalPaid,
          type: 'transfer',
          date: this.todayStr(),
          account: source,
          toAccount: accountName,
          status: 'paid',
          notes: `Quitação de ${countPaid} item(ns) da fatura do cartão`
        });
      } else {
        this.saveData();
      }
    }

    return { countPaid, totalPaid };
  }

  updateTransaction(id, updatedFields) {
    const index = this.data.transactions.findIndex(t => t.id === id);
    if (index !== -1) {
      const before = this.data.transactions[index];
      const mergedInput = {
        ...before,
        ...updatedFields,
        id: before.id
      };
      const merged = this.normalizeTransactions([mergedInput])[0];
      if (!merged) return null;

      // Compra no cartão só pode ser marcada como paga pelo pagamento da fatura
      if (before.status === 'pending' && merged.status === 'paid' && this.isCreditCardExpense(merged)) {
        merged.status = 'pending';
      }

      this.data.transactions[index] = merged;
      this.clearDeleted('transactions', id);
      this.saveData();
      return this.data.transactions[index];
    }
    return null;
  }

  deleteTransaction(id) {
    this.markDeleted('transactions', id);
    this.data.transactions = this.data.transactions.filter(t => t.id !== id);
    this.saveData();
  }

  getTransactionById(id) {
    return this.data.transactions.find(t => t.id === id);
  }

  // --- CRUD Orçamentos ---
  addOrUpdateBudget(categoryId, limit) {
    const existing = this.data.budgets.find(b => b.categoryId === categoryId);
    if (existing) {
      existing.monthlyLimit = parseFloat(limit) || 0;
      this.clearDeleted('budgets', existing.id);
    } else {
      const budget = {
        id: 'bdg_' + Date.now(),
        categoryId,
        monthlyLimit: parseFloat(limit) || 0
      };
      this.clearDeleted('budgets', budget.id);
      this.data.budgets.push(budget);
    }
    this.saveData();
  }

  deleteBudget(categoryId) {
    this.data.budgets
      .filter(b => b.categoryId === categoryId)
      .forEach(b => this.markDeleted('budgets', b.id));
    this.data.budgets = this.data.budgets.filter(b => b.categoryId !== categoryId);
    this.saveData();
  }

  // --- CRUD Metas ---
  addGoal(goal) {
    const newGoal = {
      id: 'goal_' + Date.now(),
      title: this.safeText(goal.title, 'Nova Meta', 120),
      targetAmount: this.safeAmount(goal.targetAmount, 0),
      currentAmount: this.safeAmount(goal.currentAmount, 0),
      deadline: this.safeDate(goal.deadline, ''),
      icon: this.safeIcon(goal.icon, 'ri-money-dollar-circle-line')
    };
    this.clearDeleted('goals', newGoal.id);
    this.data.goals.push(newGoal);
    this.saveData();
    return newGoal;
  }

  updateGoal(id, fields) {
    const goal = this.data.goals.find(g => g.id === id);
    if (goal) {
      if (fields.title !== undefined) goal.title = this.safeText(fields.title, goal.title, 120);
      if (fields.targetAmount !== undefined) goal.targetAmount = this.safeAmount(fields.targetAmount, 0);
      if (fields.currentAmount !== undefined) goal.currentAmount = this.safeAmount(fields.currentAmount, 0);
      if (fields.deadline !== undefined) goal.deadline = this.safeDate(fields.deadline, '');
      if (fields.icon !== undefined) goal.icon = this.safeIcon(fields.icon, goal.icon);
      this.clearDeleted('goals', id);
      this.saveData();
      return goal;
    }
    return null;
  }

  depositToGoal(id, amount) {
    const goal = this.data.goals.find(g => g.id === id);
    if (goal) {
      goal.currentAmount = (goal.currentAmount || 0) + (parseFloat(amount) || 0);
      this.saveData();
      return goal;
    }
    return null;
  }

  deleteGoal(id) {
    this.markDeleted('goals', id);
    this.data.goals = this.data.goals.filter(g => g.id !== id);
    this.saveData();
  }

  // --- Helpers de Categoria ---
  getAllCategories() {
    return [
      ...this.defaultCategories.income,
      ...this.defaultCategories.expense,
      ...this.data.customCategories
    ];
  }

  getCategoriesByType(type) {
    const base = this.defaultCategories[type] || [];
    const customs = this.data.customCategories.filter(c => c.type === type);
    return [...base, ...customs];
  }

  getCategoryById(id) {
    const cat = this.getAllCategories().find(c => c.id === id);
    if (cat) return cat;
    return {
      id: 'unknown',
      name: 'Geral',
      icon: 'ri-wallet-line',
      color: '#94a3b8'
    };
  }

  // --- CRUD Categorias Personalizadas ---
  addCategory({ name, icon, color, type } = {}) {
    const newCat = {
      id: 'cat_c' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: this.safeText(name, '', 80),
      icon: this.safeIcon(icon),
      color: this.safeColor(color),
      type: type === 'income' ? 'income' : 'expense'
    };
    if (!newCat.name) return null;
    this.clearDeleted('customCategories', newCat.id);
    this.data.customCategories.push(newCat);
    this.saveData();
    return newCat;
  }

  updateCategory(id, fields = {}) {
    const cat = this.data.customCategories.find(c => c.id === id);
    if (!cat) return null;
    if (fields.name !== undefined) cat.name = this.safeText(fields.name, cat.name, 80);
    if (fields.color !== undefined) cat.color = this.safeColor(fields.color, cat.color);
    if (fields.icon !== undefined) cat.icon = this.safeIcon(fields.icon, cat.icon);
    this.clearDeleted('customCategories', id);
    this.saveData();
    return cat;
  }

  deleteCategory(id) {
    const index = this.data.customCategories.findIndex(c => c.id === id);
    if (index === -1) return false;
    const cat = this.data.customCategories[index];
    const fallbackId = cat.type === 'income' ? 'cat_outros_inc' : 'cat_outros_exp';
    // Redireciona transações e orçamentos dessa categoria para o padrão "Outros"
    this.data.transactions.forEach(t => {
      if (t.category === id) t.category = fallbackId;
    });
    this.data.budgets
      .filter(b => b.categoryId === id)
      .forEach(b => this.markDeleted('budgets', b.id));
    this.data.budgets = this.data.budgets.filter(b => b.categoryId !== id);
    this.markDeleted('customCategories', id);
    this.data.customCategories.splice(index, 1);
    this.saveData();
    return true;
  }

  // --- CRUD Contas / Instituições (Banco, Corretora, Cartão) ---
  getAccounts() {
    return Array.isArray(this.data.accounts) && this.data.accounts.length > 0
      ? this.data.accounts
      : this.cloneDefaultAccounts();
  }

  getAccountNames() {
    return this.getAccounts().map(a => a.name);
  }

  getAccountByName(name) {
    return this.getAccounts().find(a => a.name === name) || null;
  }

  addAccount(input) {
    const fields = typeof input === 'string' ? { name: input } : (input || {});
    const name = String(fields.name || '').trim();
    if (!name || this.getAccountNames().includes(name)) return null;

    const account = {
      id: 'acc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name,
      type: this.ACCOUNT_TYPES[fields.type] ? fields.type : this.inferAccountType(name),
      openingBalance: parseFloat(fields.openingBalance) || 0,
      creditLimit: parseFloat(fields.creditLimit) || 0,
      closingDay: this.clampDayOfMonth(fields.closingDay),
      dueDay: this.clampDayOfMonth(fields.dueDay)
    };
    this.clearDeleted('accounts', account.id);
    this.data.accounts.push(account);
    this.saveData();
    return account;
  }

  updateAccount(name, fields = {}) {
    const account = this.getAccountByName(name);
    if (!account) return null;

    if (fields.name !== undefined) {
      const newName = String(fields.name).trim();
      if (newName && newName !== account.name && !this.getAccountNames().includes(newName)) {
        this.data.transactions.forEach(t => {
          if (t.account === account.name) t.account = newName;
          if (t.toAccount === account.name) t.toAccount = newName;
        });
        account.name = newName;
      }
    }
    if (fields.type !== undefined && this.ACCOUNT_TYPES[fields.type]) {
      account.type = fields.type;
    }
    if (fields.openingBalance !== undefined) {
      account.openingBalance = parseFloat(fields.openingBalance) || 0;
    }
    if (fields.creditLimit !== undefined) {
      account.creditLimit = parseFloat(fields.creditLimit) || 0;
    }
    if (fields.closingDay !== undefined) {
      account.closingDay = this.clampDayOfMonth(fields.closingDay);
    }
    if (fields.dueDay !== undefined) {
      account.dueDay = this.clampDayOfMonth(fields.dueDay);
    }
    this.clearDeleted('accounts', account.id);
    this.saveData();
    return account;
  }

  renameAccount(oldName, newName) {
    const account = this.updateAccount(oldName, { name: newName });
    return account ? account.name : null;
  }

  deleteAccount(name) {
    const accounts = this.getAccounts();
    if (accounts.length <= 1) return false;
    if (!this.getAccountByName(name)) return false;

    const removedAccount = this.getAccountByName(name);
    if (removedAccount) this.markDeleted('accounts', removedAccount.id);
    this.data.accounts = accounts.filter(a => a.name !== name);
    const fallback = this.data.accounts[0].name;
    this.data.transactions = this.data.transactions.filter(t => {
      if (t.account === name) t.account = fallback;
      if (t.toAccount === name) t.toAccount = fallback;
      // Evita transferência da conta para ela mesma após o redirecionamento
      if (t.type === 'transfer' && t.account === t.toAccount) {
        this.markDeleted('transactions', t.id);
        return false;
      }
      return true;
    });
    this.saveData();
    return true;
  }

  // --- Análise de Patrimônio / Crédito por Conta ---
  getAccountMetrics(monthStr = 'all') {
    const accounts = this.getAccounts();

    const result = accounts.map(acc => {
      let income = 0;
      let expense = 0;

      this.data.transactions.forEach(tx => {
        const isTransfer = tx.type === 'transfer';
        const isSource = (tx.account || '') === acc.name;
        const isDest = isTransfer && (tx.toAccount || '') === acc.name;
        if (!isSource && !isDest) return;
        if (monthStr !== 'all' && !String(tx.date || '').startsWith(monthStr)) return;

        const val = parseFloat(tx.amount) || 0;
        if (isTransfer) {
          // Transferência não é receita/despesa: só move dinheiro entre contas.
          // A taxa, quando houver, é um custo real debitado da origem.
          const fee = parseFloat(tx.fee) || 0;
          if (isSource) expense += val + fee;
          else income += val;
        } else if (tx.type === 'income') {
          income += val;
        } else if (tx.type === 'expense') {
          expense += val;
        }
      });

      const type = this.ACCOUNT_TYPES[acc.type] ? acc.type : 'bank';
      const openingBalance = parseFloat(acc.openingBalance) || 0;
      const creditLimit = parseFloat(acc.creditLimit) || 0;

      let value;
      let used = 0;
      let available = 0;

      if (type === 'credit') {
        used = Math.max(0, expense - income);
        available = Math.max(0, creditLimit - used);
        value = -used;
      } else {
        value = openingBalance + income - expense;
      }

      return {
        id: acc.id,
        name: acc.name,
        type,
        openingBalance,
        creditLimit,
        income,
        expense,
        value,
        used,
        available
      };
    });

    const byType = { bank: 0, broker: 0, wallet: 0, credit: 0 };
    let assets = 0;
    let creditUsed = 0;
    let creditLimit = 0;
    let creditAvailable = 0;

    result.forEach(a => {
      if (a.type === 'credit') {
        creditUsed += a.used;
        creditLimit += a.creditLimit;
        creditAvailable += a.available;
        byType.credit += a.used;
      } else {
        assets += a.value;
        byType[a.type] = (byType[a.type] || 0) + a.value;
      }
    });

    return {
      accounts: result.sort((a, b) => b.value - a.value),
      byType,
      totals: {
        assets,
        creditUsed,
        creditLimit,
        creditAvailable,
        netWorth: assets - creditUsed
      }
    };
  }

  // --- Consultas & Métricas Financeiras ---
  getFilteredTransactions(filters = {}) {
    return this.data.transactions.filter(tx => {
      // Filtro de Mês/Ano (ex: "2026-09" ou "all")
      if (filters.month && filters.month !== 'all') {
        if (!tx.date.startsWith(filters.month)) return false;
      }
      // Filtro de Tipo (income, expense)
      if (filters.type && filters.type !== 'all') {
        if (tx.type !== filters.type) return false;
      }
      // Filtro de Categoria
      if (filters.category && filters.category !== 'all') {
        if (tx.category !== filters.category) return false;
      }
      // Filtro de Status
      if (filters.status && filters.status !== 'all') {
        if (tx.status !== filters.status) return false;
      }
      // Filtro de Conta / Forma de Pagamento (considera origem e destino)
      if (filters.account && filters.account !== 'all') {
        if ((tx.account || '') !== filters.account && (tx.toAccount || '') !== filters.account) return false;
      }
      // Busca por Texto
      if (filters.search && filters.search.trim() !== '') {
        const term = filters.search.toLowerCase().trim();
        const descMatch = tx.description.toLowerCase().includes(term);
        const notesMatch = tx.notes ? tx.notes.toLowerCase().includes(term) : false;
        const cat = this.getCategoryById(tx.category);
        const catMatch = cat.name.toLowerCase().includes(term);
        if (!descMatch && !notesMatch && !catMatch) return false;
      }
      return true;
    });
  }

  getMetrics(monthStr = 'all') {
    let list = this.data.transactions;
    if (monthStr !== 'all') {
      list = list.filter(t => t.date.startsWith(monthStr));
    }

    let income = 0;
    let expense = 0;
    let pendingExpense = 0;

    list.forEach(tx => {
      const val = parseFloat(tx.amount) || 0;
      if (tx.type === 'income') {
        income += val;
      } else if (tx.type === 'expense') {
        expense += val;
        if (tx.status === 'pending') {
          pendingExpense += val;
        }
      } else if (tx.type === 'transfer') {
        // Taxa de transferência é uma despesa real
        expense += parseFloat(tx.fee) || 0;
      }
    });

    const balance = income - expense;
    const savingsRate = income > 0 ? Math.max(0, ((income - expense) / income) * 100) : 0;

    return {
      totalIncome: income,
      totalExpense: expense,
      netBalance: balance,
      pendingExpense,
      savingsRate: Math.round(savingsRate),
      txCount: list.length
    };
  }

  getExpensesByCategory(monthStr = 'all') {
    let list = this.data.transactions.filter(t => t.type === 'expense');
    if (monthStr !== 'all') {
      list = list.filter(t => t.date.startsWith(monthStr));
    }

    const map = {};
    list.forEach(tx => {
      const catId = tx.category;
      map[catId] = (map[catId] || 0) + (parseFloat(tx.amount) || 0);
    });

    // Taxas de transferência são despesas reais (categoria Tarifas & Juros)
    let transfers = this.data.transactions.filter(t => t.type === 'transfer' && (parseFloat(t.fee) || 0) > 0);
    if (monthStr !== 'all') {
      transfers = transfers.filter(t => t.date.startsWith(monthStr));
    }
    transfers.forEach(tx => {
      map['cat_tarifas'] = (map['cat_tarifas'] || 0) + (parseFloat(tx.fee) || 0);
    });

    return Object.keys(map).map(catId => {
      const cat = this.getCategoryById(catId);
      return {
        id: catId,
        name: cat.name,
        color: cat.color,
        icon: cat.icon,
        total: map[catId]
      };
    }).sort((a, b) => b.total - a.total);
  }

  getMonthlyFlow(year) {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const incomeData = new Array(12).fill(0);
    const expenseData = new Array(12).fill(0);

    this.data.transactions.forEach(tx => {
      const parts = String(tx.date || '').split('-').map(Number);
      if (parts.length === 3 && parts[0] === year && parts[1] >= 1 && parts[1] <= 12) {
        const m = parts[1] - 1;
        const val = parseFloat(tx.amount) || 0;
        if (tx.type === 'income') {
          incomeData[m] += val;
        } else if (tx.type === 'expense') {
          expenseData[m] += val;
        } else if (tx.type === 'transfer') {
          expenseData[m] += parseFloat(tx.fee) || 0;
        }
      }
    });

    return { labels: months, income: incomeData, expense: expenseData };
  }

  getIncomeByCategory(monthStr = 'all') {
    let list = this.data.transactions.filter(t => t.type === 'income');
    if (monthStr !== 'all') {
      list = list.filter(t => t.date.startsWith(monthStr));
    }

    const map = {};
    list.forEach(tx => {
      const catId = tx.category;
      map[catId] = (map[catId] || 0) + (parseFloat(tx.amount) || 0);
    });

    return Object.keys(map).map(catId => {
      const cat = this.getCategoryById(catId);
      return {
        id: catId,
        name: cat.name,
        color: cat.color,
        icon: cat.icon,
        total: map[catId]
      };
    }).sort((a, b) => b.total - a.total);
  }

  // --- Score Financeiro Pessoal (0 - 100) ---
  getFinancialScore(monthStr = 'all') {
    const metrics = this.getMetrics(monthStr);
    const budgets = this.data.budgets || [];
    const goals = this.data.goals || [];
    const expensesByCat = this.getExpensesByCategory(monthStr);

    // 1. Taxa de Poupança (peso 30) - 20%+ = pontuação máxima
    let savingsScore = 0;
    if (metrics.totalIncome > 0) {
      const rate = metrics.savingsRate;
      savingsScore = Math.min(100, Math.max(0, (rate / 25) * 100)) * 0.30;
    } else {
      savingsScore = 15;
    }

    // 2. Aderência ao Orçamento (peso 25)
    let budgetScore = 25;
    if (budgets.length > 0) {
      let overBudgetCount = 0;
      budgets.forEach(b => {
        const catSpent = expensesByCat.find(c => c.id === b.categoryId)?.total || 0;
        if (catSpent > b.monthlyLimit) overBudgetCount++;
      });
      const adheredRatio = (budgets.length - overBudgetCount) / budgets.length;
      budgetScore = adheredRatio * 25;
    }

    // 3. Diversificação de Receitas (peso 15)
    let incomeScore = 5;
    const incomes = this.getIncomeByCategory(monthStr);
    if (incomes.length >= 3) incomeScore = 15;
    else if (incomes.length >= 2) incomeScore = 12;
    else if (incomes.length === 1) incomeScore = 8;

    // 4. Progresso em Metas (peso 15)
    let goalsScore = 5;
    if (goals.length > 0) {
      const avgProgress = goals.reduce((acc, g) => {
        const target = parseFloat(g.targetAmount) || 1;
        const current = parseFloat(g.currentAmount) || 0;
        return acc + Math.min(100, (current / target) * 100);
      }, 0) / goals.length;
      goalsScore = (avgProgress / 100) * 15;
    }

    // 5. Controle de Contas Pendentes (peso 15)
    let pendingScore = 15;
    if (metrics.totalExpense > 0 && metrics.pendingExpense > 0) {
      const pendingRatio = metrics.pendingExpense / metrics.totalExpense;
      pendingScore = Math.max(0, (1 - pendingRatio) * 15);
    }

    const totalScore = Math.round(savingsScore + budgetScore + incomeScore + goalsScore + pendingScore);
    const clampedScore = Math.min(100, Math.max(0, totalScore));

    let label = 'Atenção';
    let color = '#ef4444';
    let icon = 'ri-alarm-warning-line';
    let message = 'Suas finanças exigem cuidado imediato. Reduza despesas supérfluas.';

    if (clampedScore >= 80) {
      label = 'Excelente';
      color = '#10b981';
      icon = 'ri-shield-star-line';
      message = 'Saúde financeira impecável! Você poupa bem e controla seus gastos.';
    } else if (clampedScore >= 65) {
      label = 'Bom';
      color = '#06b6d4';
      icon = 'ri-thumb-up-line';
      message = 'Suas finanças estão equilibradas. Mantenha o foco em suas metas.';
    } else if (clampedScore >= 50) {
      label = 'Regular';
      color = '#f59e0b';
      icon = 'ri-alert-line';
      message = 'Você está quase no limite. Monitore seus orçamentos de perto.';
    }

    return {
      score: clampedScore,
      label,
      color,
      icon,
      message,
      breakdown: {
        savings: Math.round((savingsScore / 30) * 100),
        budget: Math.round((budgetScore / 25) * 100),
        income: Math.round((incomeScore / 15) * 100),
        goals: Math.round((goalsScore / 15) * 100),
        pending: Math.round((pendingScore / 15) * 100)
      }
    };
  }

  // --- Comparativo Mês a Mês ---
  getMonthComparison(currentPeriod = null) {
    let currPeriod = currentPeriod;
    if (!currPeriod || currPeriod === 'all') {
      const now = new Date();
      currPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    const [y, m] = currPeriod.split('-').map(Number);
    let prevYear = y;
    let prevMonth = m - 1;
    if (prevMonth < 1) {
      prevMonth = 12;
      prevYear -= 1;
    }
    const prevPeriod = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;

    const currMetrics = this.getMetrics(currPeriod);
    const prevMetrics = this.getMetrics(prevPeriod);

    const calcDelta = (curr, prev) => {
      const diff = curr - prev;
      const pct = prev > 0 ? ((diff / prev) * 100) : (curr > 0 ? 100 : 0);
      return { diff, pct: Math.round(pct) };
    };

    return {
      currentPeriod: currPeriod,
      previousPeriod: prevPeriod,
      current: currMetrics,
      previous: prevMetrics,
      income: calcDelta(currMetrics.totalIncome, prevMetrics.totalIncome),
      expense: calcDelta(currMetrics.totalExpense, prevMetrics.totalExpense),
      balance: calcDelta(currMetrics.netBalance, prevMetrics.netBalance),
      savings: { diff: currMetrics.savingsRate - prevMetrics.savingsRate }
    };
  }

  // --- Previsão de Gastos para o Mês ---
  getExpenseForecast(monthStr = null) {
    const today = new Date();
    const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const targetPeriod = (monthStr && monthStr !== 'all') ? monthStr : currentMonthKey;

    const [y, m] = targetPeriod.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const isCurrentMonth = targetPeriod === currentMonthKey;
    const currentDay = isCurrentMonth ? today.getDate() : daysInMonth;

    const metrics = this.getMetrics(targetPeriod);
    const spentSoFar = metrics.totalExpense;

    const dailyAvg = currentDay > 0 ? (spentSoFar / currentDay) : 0;
    const projectedTotal = isCurrentMonth ? Math.round(dailyAvg * daysInMonth) : spentSoFar;

    const budgets = this.data.budgets || [];
    const totalBudget = budgets.reduce((sum, b) => sum + (parseFloat(b.monthlyLimit) || 0), 0);

    const remainingDays = Math.max(0, daysInMonth - currentDay);
    const isOverBudget = totalBudget > 0 && projectedTotal > totalBudget;

    return {
      period: targetPeriod,
      daysInMonth,
      currentDay,
      remainingDays,
      spentSoFar,
      dailyAvg,
      projectedTotal,
      totalBudget,
      isOverBudget,
      budgetPercent: totalBudget > 0 ? Math.round((projectedTotal / totalBudget) * 100) : 0
    };
  }

  // --- Evolução Patrimonial (Últimos N meses) ---
  getNetWorthEvolution(monthsCount = 12) {
    const labels = [];
    const values = [];
    const now = new Date();
    const monthNamesShort = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    const periods = [];
    for (let i = monthsCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const periodStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      periods.push({
        key: periodStr,
        label: `${monthNamesShort[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`
      });
    }

    periods.forEach(p => {
      labels.push(p.label);
      let netAccum = 0;
      this.data.transactions.forEach(tx => {
        if (tx.date <= `${p.key}-31`) {
          const val = parseFloat(tx.amount) || 0;
          if (tx.type === 'income') netAccum += val;
          else if (tx.type === 'expense') netAccum -= val;
          else if (tx.type === 'transfer') netAccum -= (parseFloat(tx.fee) || 0);
        }
      });
      const opening = (this.data.accounts || []).reduce((acc, a) => {
        if (a.type !== 'credit') return acc + (parseFloat(a.openingBalance) || 0);
        return acc;
      }, 0);

      values.push(Math.round(netAccum + opening));
    });

    return { labels, values };
  }


  // --- Lançamentos Recorrentes / Agendados ---
  todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  addDays(dateStr, days) {
    const [y, m, d] = String(dateStr).split('-').map(Number);
    const dt = new Date(y, m - 1, d + days);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  }

  computeNextOccurrence(rule, fromDate) {
    const [y, m, d] = String(fromDate).split('-').map(Number);

    if (rule.frequency === 'weekly') {
      const weekday = Math.min(Math.max(parseInt(rule.weekday, 10) || 0, 0), 6);
      for (let i = 0; i < 8; i++) {
        const dt = new Date(y, m - 1, d + i);
        if (dt.getDay() === weekday) {
          return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
        }
      }
      return this.addDays(fromDate, 7);
    }

    const day = Math.min(Math.max(parseInt(rule.dayOfMonth, 10) || 1, 1), 28);
    let year = y;
    let month = m;
    if (d > day) {
      month += 1;
      if (month > 12) { month = 1; year += 1; }
    }
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  normalizeRecurring(raw) {
    if (!Array.isArray(raw)) return [];
    const seen = new Set();
    return raw.filter(r => r && this.safeAmount(r.amount, 0) > 0).map(r => {
      let id = this.safeId(r.id, 'rec');
      if (seen.has(id)) id = this.safeId('', 'rec');
      seen.add(id);
      return {
        id,
        type: ['income', 'expense', 'transfer'].includes(r.type) ? r.type : 'expense',
        description: this.safeText(r.description, 'Lançamento recorrente', 160),
        amount: this.safeAmount(r.amount, 0),
        category: /^[A-Za-z0-9_-]{1,100}$/.test(String(r.category || '')) ? String(r.category) : '',
        account: this.safeText(r.account, '', 100),
        toAccount: this.safeText(r.toAccount, '', 100),
        fee: this.safeAmount(r.fee, 0),
        frequency: r.frequency === 'weekly' ? 'weekly' : 'monthly',
        dayOfMonth: Math.min(Math.max(parseInt(r.dayOfMonth, 10) || 1, 1), 28),
        weekday: Math.min(Math.max(parseInt(r.weekday, 10) || 0, 0), 6),
        nextDate: this.safeDate(r.nextDate, this.todayStr()),
        status: r.status === 'pending' ? 'pending' : 'paid',
        active: r.active !== false
      };
    });
  }

  addRecurring(rule) {
    const base = this.normalizeRecurring([{ ...rule }])[0];
    if (!base) return null;
    if (!rule || !rule.nextDate) {
      base.nextDate = this.computeNextOccurrence(base, this.todayStr());
    }
    this.clearDeleted('recurring', base.id);
    this.data.recurring.push(base);
    this.saveData();
    return base;
  }

  updateRecurring(id, fields) {
    const rule = this.data.recurring.find(r => r.id === id);
    if (!rule) return null;

    const normalized = this.normalizeRecurring([{ ...rule, ...fields, id }])[0];
    if (!normalized) return null;

    // Nunca retrocede a próxima ocorrência (evita regenerar meses já lançados)
    if (fields && fields.nextDate && rule.nextDate && fields.nextDate < rule.nextDate) {
      normalized.nextDate = rule.nextDate;
    }

    this.data.recurring = this.data.recurring.map(r => (r.id === id ? normalized : r));
    this.clearDeleted('recurring', id);
    this.saveData();
    return normalized;
  }

  endOfMonth(monthStr) {
    const [y, m] = String(monthStr).split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    return `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  }

  processRecurring(untilDate = this.todayStr(), referenceDate = this.todayStr()) {
    if (!Array.isArray(this.data.recurring) || this.data.recurring.length === 0) return 0;
    let created = 0;

    this.data.recurring.forEach(rule => {
      if (rule.active === false) return;
      let guard = 0;
      while (rule.nextDate && rule.nextDate <= untilDate && guard < 240) {
        const txData = {
          type: rule.type,
          description: rule.description,
          amount: rule.amount,
          category: rule.category,
          account: rule.account,
          date: rule.nextDate,
          dueDate: rule.nextDate,
          status: rule.nextDate > referenceDate ? 'pending' : (rule.status || 'paid'),
          notes: 'Gerado automaticamente (recorrente)',
          fixed: true,
          recurringId: rule.id
        };
        if (rule.type === 'transfer') {
          txData.toAccount = rule.toAccount;
          txData.fee = rule.fee;
        }
        this.addTransaction(txData, { save: false });
        created++;
        guard++;
        rule.nextDate = this.computeNextOccurrence(rule, this.addDays(rule.nextDate, 1));
      }
    });

    if (created > 0) this.saveData();
    return created;
  }

  // Converte lançamentos fixos já vencidos de "Pendente" para o status da regra (normalmente "Pago")
  settleDueFixedTransactions(today = this.todayStr()) {
    let settled = 0;
    this.data.transactions.forEach(tx => {
      if (!tx.fixed || tx.status !== 'pending') return;
      if (String(tx.date || '') > today) return;
      if (this.isCreditCardExpense(tx)) return; // espera a fatura

      const rule = this.data.recurring.find(r => r.id === tx.recurringId);
      if (rule && rule.status === 'pending') return;

      tx.status = 'paid';
      settled++;
    });

    if (settled > 0) this.saveData();
    return settled;
  }

  deleteRecurring(id) {
    const before = this.data.recurring.length;
    this.data.recurring = this.data.recurring.filter(r => r.id !== id);
    if (this.data.recurring.length !== before) {
      this.markDeleted('recurring', id);
      this.saveData();
      return true;
    }
    return false;
  }

  toggleRecurring(id) {
    const rule = this.data.recurring.find(r => r.id === id);
    if (!rule) return null;
    rule.active = rule.active === false;
    this.saveData();
    return rule;
  }

  // --- Vencimentos, Faturas e Lembretes ---
  pad2(n) {
    return String(n).padStart(2, '0');
  }

  // Data efetiva de vencimento: campo próprio ou, na falta, a data do lançamento
  getDueDate(tx) {
    if (!tx) return '';
    return tx.dueDate || tx.date || '';
  }

  // Diferença em dias (dateStr - fromStr); positivo = no futuro
  diffDays(dateStr, fromStr = this.todayStr()) {
    const [ay, am, ad] = String(dateStr).split('-').map(Number);
    const [by, bm, bd] = String(fromStr).split('-').map(Number);
    if (!ay || !by) return 0;
    const a = Date.UTC(ay, am - 1, ad);
    const b = Date.UTC(by, bm - 1, bd);
    return Math.round((a - b) / 86400000);
  }

  // Data de um dia do mês, respeitando meses curtos (ex: dia 31 em fevereiro)
  dateInMonth(year, month, day) {
    const last = new Date(year, month, 0).getDate();
    const d = Math.min(Math.max(parseInt(day, 10) || 1, 1), last);
    return `${year}-${this.pad2(month)}-${this.pad2(d)}`;
  }

  // Calcula fechamento e vencimento da fatura para uma data de compra
  computeInvoiceDates(purchaseDate, closingDay, dueDay) {
    const [y, m] = String(purchaseDate || this.todayStr()).split('-').map(Number);
    const C = Math.min(Math.max(parseInt(closingDay, 10) || 0, 1), 31);
    const U = Math.min(Math.max(parseInt(dueDay, 10) || 0, 1), 31);

    let closingYear = y;
    let closingMonth = m;
    const closingThisMonth = this.dateInMonth(y, m, C);
    if (String(purchaseDate) > closingThisMonth) {
      closingMonth += 1;
      if (closingMonth > 12) { closingMonth = 1; closingYear += 1; }
    }
    const closingDate = this.dateInMonth(closingYear, closingMonth, C);

    let dueYear = closingYear;
    let dueMonth = closingMonth;
    if (U <= C) {
      dueMonth += 1;
      if (dueMonth > 12) { dueMonth = 1; dueYear += 1; }
    }
    const dueDate = this.dateInMonth(dueYear, dueMonth, U);

    return { closingDate, dueDate };
  }

  // Fatura do cartão no ciclo que contém refDate
  getAccountInvoice(accountName, refDate = this.todayStr()) {
    const account = this.getAccountByName(accountName);
    if (!account || account.type !== 'credit') return null;

    const { closingDay, dueDay } = this.getCardInvoiceConfig(account);
    const { closingDate, dueDate } = this.computeInvoiceDates(refDate, closingDay, dueDay);

    const transactions = this.data.transactions.filter(t =>
      t.type === 'expense' &&
      t.account === accountName &&
      this.computeInvoiceDates(t.date, closingDay, dueDay).closingDate === closingDate
    );

    const total = transactions.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
    const pendingList = transactions.filter(t => t.status === 'pending');
    const pendingTotal = pendingList.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

    return {
      account,
      closingDate,
      dueDate,
      transactions,
      pendingList,
      total,
      pendingTotal,
      status: this.diffDays(dueDate, refDate) < 0 ? 'overdue' : (this.diffDays(dueDate, refDate) === 0 ? 'today' : 'open')
    };
  }

  // Lembretes de vencimento (atrasados, hoje e próximos N dias)
  getDueReminders(today = this.todayStr(), windowDays = 7) {
    const items = [];
    const invoiceMap = {};

    this.data.transactions.forEach(tx => {
      if (tx.status !== 'pending') return;

      const account = this.getAccountByName(tx.account);

      // Cartão de crédito: agrupa por fatura (fechamento + vencimento)
      if (this.isCreditCardExpense(tx)) {
        const { closingDay, dueDay } = this.getCardInvoiceConfig(account);
        const { dueDate, closingDate } = this.computeInvoiceDates(tx.date || today, closingDay, dueDay);
        const period = this.getInvoicePeriodForAccount(account, tx.date || today);
        const key = `${account.name}|${dueDate}`;
        if (!invoiceMap[key]) {
          invoiceMap[key] = {
            kind: 'invoice',
            account: account.name,
            period,
            title: `Fatura ${account.name}`,
            dueDate,
            closingDate,
            amount: 0,
            txIds: [],
            count: 0
          };
        }
        invoiceMap[key].amount += parseFloat(tx.amount) || 0;
        invoiceMap[key].txIds.push(tx.id);
        invoiceMap[key].count += 1;
        return;
      }

      // Demais lançamentos (despesas, receitas e transferências)
      items.push({
        kind: tx.type === 'income' ? 'income' : (tx.type === 'transfer' ? 'transfer' : 'expense'),
        id: tx.id,
        txIds: [tx.id],
        title: tx.description,
        amount: parseFloat(tx.amount) || 0,
        dueDate: this.getDueDate(tx),
        account: tx.account,
        category: tx.category,
        count: 1
      });
    });

    Object.values(invoiceMap).forEach(inv => items.push(inv));

    const overdue = [];
    const dueToday = [];
    const upcoming = [];
    const later = [];

    items.forEach(it => {
      it.daysDiff = this.diffDays(it.dueDate, today);
      if (it.daysDiff < 0) { it.bucket = 'overdue'; overdue.push(it); }
      else if (it.daysDiff === 0) { it.bucket = 'today'; dueToday.push(it); }
      else if (it.daysDiff <= windowDays) { it.bucket = 'upcoming'; upcoming.push(it); }
      else { it.bucket = 'later'; later.push(it); }
    });

    const byDue = (a, b) => (a.dueDate < b.dueDate ? -1 : (a.dueDate > b.dueDate ? 1 : 0));
    overdue.sort(byDue);
    dueToday.sort(byDue);
    upcoming.sort(byDue);
    later.sort(byDue);

    const sumExpense = arr => arr.filter(i => i.kind !== 'income').reduce((s, i) => s + i.amount, 0);
    const sumIncome = arr => arr.filter(i => i.kind === 'income').reduce((s, i) => s + i.amount, 0);

    return {
      today,
      windowDays,
      overdue,
      today: dueToday,
      upcoming,
      later,
      all: [...overdue, ...dueToday, ...upcoming],
      counts: {
        overdue: overdue.length,
        today: dueToday.length,
        upcoming: upcoming.length,
        total: overdue.length + dueToday.length + upcoming.length
      },
      totals: {
        overdueExpense: sumExpense(overdue),
        overdueIncome: sumIncome(overdue),
        todayExpense: sumExpense(dueToday),
        todayIncome: sumIncome(dueToday),
        upcomingExpense: sumExpense(upcoming),
        upcomingIncome: sumIncome(upcoming)
      }
    };
  }

  // Marca como pago. Compras no cartão de crédito são ignoradas aqui:
  // elas só são quitadas junto com a fatura (payCreditCardInvoice).
  markTransactionsPaid(ids) {
    const set = new Set(Array.isArray(ids) ? ids : [ids]);
    let changed = 0;
    this.data.transactions.forEach(tx => {
      if (!set.has(tx.id) || tx.status === 'paid') return;
      if (this.isCreditCardExpense(tx)) return;
      tx.status = 'paid';
      changed += 1;
    });
    if (changed > 0) this.saveData();
    return changed;
  }

  // --- Relatório Consolidado ---
  getReport(month = 'all') {
    const metrics = this.getMetrics(month);
    const byCategory = this.getExpensesByCategory(month);

    const topExpenses = [...this.getFilteredTransactions({ month, type: 'expense' })]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    const pending = this.getFilteredTransactions({ month, type: 'expense', status: 'pending' })
      .sort((a, b) => (this.getDueDate(a) < this.getDueDate(b) ? -1 : 1));

    return {
      month,
      metrics,
      byCategory,
      topExpenses,
      pending,
      topCategory: byCategory[0] || null,
      generatedAt: new Date().toISOString()
    };
  }

  // --- Export / Import ---
  getDataStats() {
    const json = JSON.stringify(this.data);
    let bytes = json.length;
    if (typeof TextEncoder !== 'undefined') {
      bytes = new TextEncoder().encode(json).length;
    }
    return {
      transactions: this.data.transactions.length,
      accounts: this.data.accounts.length,
      categories: this.getAllCategories().length,
      customCategories: this.data.customCategories.length,
      recurring: (this.data.recurring || []).length,
      goals: this.data.goals.length,
      budgets: this.data.budgets.length,
      bytes
    };
  }

  snapshotFingerprint(data, settings) {
    const text = JSON.stringify({ data, settings });
    let hash = 5381;
    for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash) ^ text.charCodeAt(i);
    return String(hash >>> 0);
  }

  getRecoverySnapshots() {
    try {
      const parsed = JSON.parse(localStorage.getItem(this.RECOVERY_KEY) || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(item => item && typeof item === 'object' && item.id && item.data && item.createdAt);
    } catch (e) {
      console.error('Erro ao carregar pontos de recuperação:', e);
      return [];
    }
  }

  createRecoverySnapshot(reason = 'Cópia de segurança automática', data = this.data, settings = this.settings, meta = {}) {
    const normalized = this.normalizeData(data);
    if (!normalized) return null;

    const safeSettings = this.normalizeSettings(settings || {});
    const fingerprint = this.snapshotFingerprint(normalized, safeSettings);
    const snapshots = this.getRecoverySnapshots();
    if (snapshots[0] && snapshots[0].fingerprint === fingerprint) return snapshots[0].id;

    const requestedTime = typeof meta.createdAt === 'string' ? Date.parse(meta.createdAt) : NaN;
    const snapshot = {
      id: `recovery_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: Number.isFinite(requestedTime) ? new Date(requestedTime).toISOString() : new Date().toISOString(),
      reason: this.safeText(reason, 'Cópia de segurança automática', 120),
      source: ['local', 'cloud', 'manual', 'import', 'reset', 'sync'].includes(meta.source) ? meta.source : 'local',
      fingerprint,
      stats: {
        transactions: normalized.transactions.length,
        accounts: normalized.accounts.length,
        goals: normalized.goals.length,
        budgets: normalized.budgets.length
      },
      data: normalized,
      settings: safeSettings
    };

    snapshots.unshift(snapshot);
    while (snapshots.length > this.MAX_RECOVERY_SNAPSHOTS) snapshots.pop();

    while (snapshots.length > 0) {
      try {
        localStorage.setItem(this.RECOVERY_KEY, JSON.stringify(snapshots));
        return snapshot.id;
      } catch (e) {
        snapshots.pop();
      }
    }
    return null;
  }

  restoreRecoverySnapshot(id) {
    const snapshot = this.getRecoverySnapshots().find(item => item.id === id);
    if (!snapshot) return false;
    const normalized = this.normalizeData(snapshot.data);
    if (!normalized) return false;

    this.createRecoverySnapshot('Antes de restaurar um ponto de recuperação', this.data, this.settings, { source: 'manual' });
    this.data = normalized;
    this.settings = this.normalizeSettings(snapshot.settings || this.settings);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
    localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(this.settings));
    this.notifyDataChanged();
    return true;
  }

  deleteRecoverySnapshot(id) {
    const snapshots = this.getRecoverySnapshots().filter(item => item.id !== id);
    localStorage.setItem(this.RECOVERY_KEY, JSON.stringify(snapshots));
    return true;
  }

  exportRecoverySnapshot(id) {
    const snapshot = this.getRecoverySnapshots().find(item => item.id === id);
    if (!snapshot) return false;
    const content = encodeURIComponent(JSON.stringify(snapshot.data, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', `data:text/json;charset=utf-8,${content}`);
    link.setAttribute('download', `finanzen_recuperacao_${snapshot.createdAt.slice(0, 10)}.json`);
    link.click();
    return true;
  }

  exportJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.data, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `finanzen_backup_${new Date().toISOString().split('T')[0]}.json`);
    dlAnchorElem.click();
  }

  exportCSV() {
    const headers = ["ID", "Data", "Vencimento", "Descricao", "Tipo", "Categoria", "Valor", "Conta", "Destino", "Taxa", "Status", "Notas"];
    const rows = this.data.transactions.map(tx => {
      const typeLabel = tx.type === 'income'
        ? 'Receita'
        : (tx.type === 'transfer' ? 'Transferência' : 'Despesa');

      return [
        tx.id,
        tx.date,
        tx.dueDate || '',
        `"${(tx.description || '').replace(/"/g, '""')}"`,
        typeLabel,
        `"${tx.type === 'transfer' ? 'Transferência' : this.getCategoryById(tx.category).name}"`,
        tx.amount.toFixed(2),
        `"${tx.account || ''}"`,
        `"${tx.toAccount || ''}"`,
        (parseFloat(tx.fee) || 0).toFixed(2),
        tx.status === 'paid' ? 'Pago' : 'Pendente',
        `"${(tx.notes || '').replace(/"/g, '""')}"`
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `transacoes_finanzen_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  importJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      const normalized = this.normalizeData(parsed);
      if (normalized) {
        this.createRecoverySnapshot('Antes de importar um backup JSON', this.data, this.settings, { source: 'import' });
        this.data = normalized;
        this.saveData();
        return true;
      }
    } catch (e) {
      console.error('Falha ao importar arquivo JSON:', e);
    }
    return false;
  }

  parseCSV(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field);
        field = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(field);
        field = '';
        if (row.some(c => String(c).trim() !== '')) rows.push(row);
        row = [];
      } else {
        field += ch;
      }
    }
    if (field !== '' || row.length > 0) {
      row.push(field);
      if (row.some(c => String(c).trim() !== '')) rows.push(row);
    }
    return rows;
  }

  importCSV(csvText) {
    try {
      const rows = this.parseCSV(String(csvText || ''));
      if (rows.length < 2) return false;

      const header = rows[0].map(h => String(h).trim().toLowerCase());
      const idx = (key, aliases) => {
        const h = header.indexOf(key);
        return h !== -1 ? h : aliases ? header.findIndex(x => aliases.includes(x)) : -1;
      };

      const iData = idx('data');
      const iVenc = idx('vencimento');
      const iDesc = idx('descricao');
      const iTipo = idx('tipo');
      const iCat = idx('categoria');
      const iValor = idx('valor');
      const iConta = idx('conta');
      const iDestino = idx('destino');
      const iTaxa = idx('taxa');
      const iStatus = idx('status');
      const iNotas = idx('notas');

      if (iData === -1 || iValor === -1) return false;

      const imported = rows.slice(1).map(row => {
        const tipoRaw = String(row[iTipo] || '').toLowerCase();
        let type = 'expense';
        if (tipoRaw.startsWith('r')) type = 'income';
        else if (tipoRaw.startsWith('t') || tipoRaw.includes('transfer')) type = 'transfer';

        let categoryId = '';
        if (type !== 'transfer') {
          const catName = String(row[iCat] || '').trim();
          const category = this.getAllCategories().find(c => c.name.toLowerCase() === catName.toLowerCase());
          categoryId = category ? category.id : (type === 'income' ? 'cat_outros_inc' : 'cat_outros_exp');
        }

        const tx = {
          id: 'tx_imp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          description: String(row[iDesc] || (type === 'transfer' ? 'Transferência' : 'Importação CSV')).trim(),
          amount: parseFloat(String(row[iValor] || '0').replace(/[^\d.,-]/g, '').replace(',', '.')) || 0,
          type,
          category: categoryId,
          date: String(row[iData] || '').trim() || new Date().toISOString().split('T')[0],
          dueDate: iVenc !== -1 ? String(row[iVenc] || '').trim() : '',
          account: String(row[iConta] || 'Outro').trim() || 'Outro',
          status: String(row[iStatus] || '').toLowerCase().includes('pend') ? 'pending' : 'paid',
          notes: String(row[iNotas] || '').trim()
        };

        if (type === 'transfer') {
          tx.toAccount = iDestino !== -1 ? String(row[iDestino] || '').trim() : '';
          tx.fee = iTaxa !== -1
            ? (parseFloat(String(row[iTaxa] || '0').replace(/[^\d.,-]/g, '').replace(',', '.')) || 0)
            : 0;
        }

        return tx;
      }).filter(t => t.amount > 0);

      if (imported.length === 0) return false;
      this.createRecoverySnapshot('Antes de importar uma planilha CSV', this.data, this.settings, { source: 'import' });
      this.data.transactions = imported;
      this.saveData();
      return true;
    } catch (e) {
      console.error('Falha ao importar CSV:', e);
      return false;
    }
  }

  resetAllData() {
    this.createRecoverySnapshot('Antes de restaurar os dados iniciais', this.data, this.settings, { source: 'reset' });
    this.data = this.generateSeedData();
    this.saveData();
  }
}

// Instância Global do Estado
window.financialState = new FinancialState();
