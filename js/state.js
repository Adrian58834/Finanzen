/**
 * FinanZen - Gerenciamento de Estado e Persistência de Dados
 */

class FinancialState {
  constructor() {
    this.STORAGE_KEY = 'finanzen_data_v1';
    this.SETTINGS_KEY = 'finanzen_settings_v1';

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
      return stored ? JSON.parse(stored) : { theme: 'dark', currency: 'BRL' };
    } catch (e) {
      return { theme: 'dark', currency: 'BRL' };
    }
  }

  saveSettings(settings) {
    this.settings = { ...this.settings, ...settings };
    localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(this.settings));
  }

  loadData() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        data.accounts = this.normalizeAccounts(data.accounts);
        data.customCategories = this.normalizeCustomCategories(data.customCategories);
        data.recurring = this.normalizeRecurring(data.recurring);
        return data;
      }
    } catch (e) {
      console.error('Erro ao carregar dados locais:', e);
    }
    // Carga inicial com dados demonstrativos inteligentes no mês corrente
    return this.generateSeedData();
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
      recurring: []
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
    return list.filter(c => c && c.name && c.name.trim() !== '' && !defaultIds.includes(c.id));
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
      const name = account.trim();
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
      const name = String(account.name).trim();
      if (!name) return null;
      return {
        id: account.id || ('acc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)),
        name,
        type: this.ACCOUNT_TYPES[account.type] ? account.type : this.inferAccountType(name),
        openingBalance: parseFloat(account.openingBalance) || 0,
        creditLimit: parseFloat(account.creditLimit) || 0,
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
  addTransaction(tx) {
    const type = tx.type || 'expense';
    const newTx = {
      id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      amount: parseFloat(tx.amount) || 0,
      description: tx.description || (type === 'transfer' ? 'Transferência entre contas' : 'Sem descrição'),
      type,
      category: type === 'transfer'
        ? (tx.category || '')
        : (tx.category || (type === 'income' ? 'cat_outros_inc' : 'cat_outros_exp')),
      date: tx.date || new Date().toISOString().split('T')[0],
      account: tx.account || 'Conta Corrente',
      status: tx.status || 'paid',
      dueDate: tx.dueDate || '',
      notes: tx.notes || ''
    };

    if (type === 'transfer') {
      newTx.toAccount = tx.toAccount || '';
      newTx.fee = parseFloat(tx.fee) || 0;
    }

    if (tx.fixed) {
      newTx.fixed = true;
      newTx.recurringId = tx.recurringId || null;
    }

    this.data.transactions.unshift(newTx);
    this.saveData();
    return newTx;
  }

  updateTransaction(id, updatedFields) {
    const index = this.data.transactions.findIndex(t => t.id === id);
    if (index !== -1) {
      this.data.transactions[index] = {
        ...this.data.transactions[index],
        ...updatedFields,
        amount: parseFloat(updatedFields.amount ?? this.data.transactions[index].amount)
      };
      this.saveData();
      return this.data.transactions[index];
    }
    return null;
  }

  deleteTransaction(id) {
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
    } else {
      this.data.budgets.push({
        id: 'bdg_' + Date.now(),
        categoryId,
        monthlyLimit: parseFloat(limit) || 0
      });
    }
    this.saveData();
  }

  deleteBudget(categoryId) {
    this.data.budgets = this.data.budgets.filter(b => b.categoryId !== categoryId);
    this.saveData();
  }

  // --- CRUD Metas ---
  addGoal(goal) {
    const newGoal = {
      id: 'goal_' + Date.now(),
      title: goal.title || 'Nova Meta',
      targetAmount: parseFloat(goal.targetAmount) || 0,
      currentAmount: parseFloat(goal.currentAmount) || 0,
      deadline: goal.deadline || '',
      icon: goal.icon || 'ri-money-dollar-circle-line'
    };
    this.data.goals.push(newGoal);
    this.saveData();
    return newGoal;
  }

  updateGoal(id, fields) {
    const goal = this.data.goals.find(g => g.id === id);
    if (goal) {
      Object.assign(goal, fields);
      if (fields.targetAmount !== undefined) goal.targetAmount = parseFloat(fields.targetAmount) || 0;
      if (fields.currentAmount !== undefined) goal.currentAmount = parseFloat(fields.currentAmount) || 0;
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
      name: String(name || '').trim(),
      icon: icon || 'ri-price-tag-3-line',
      color: color || '#8b5cf6',
      type: type === 'income' ? 'income' : 'expense'
    };
    if (!newCat.name) return null;
    this.data.customCategories.push(newCat);
    this.saveData();
    return newCat;
  }

  updateCategory(id, fields = {}) {
    const cat = this.data.customCategories.find(c => c.id === id);
    if (!cat) return null;
    if (fields.name !== undefined) cat.name = String(fields.name).trim() || cat.name;
    if (fields.color !== undefined) cat.color = fields.color;
    if (fields.icon !== undefined) cat.icon = fields.icon;
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
    this.data.budgets = this.data.budgets.filter(b => b.categoryId !== id);
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

    this.data.accounts = accounts.filter(a => a.name !== name);
    const fallback = this.data.accounts[0].name;
    this.data.transactions = this.data.transactions.filter(t => {
      if (t.account === name) t.account = fallback;
      if (t.toAccount === name) t.toAccount = fallback;
      // Evita transferência da conta para ela mesma após o redirecionamento
      if (t.type === 'transfer' && t.account === t.toAccount) return false;
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
    return raw.filter(r => r && parseFloat(r.amount) > 0).map(r => ({
      id: r.id || ('rec_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)),
      type: ['income', 'expense', 'transfer'].includes(r.type) ? r.type : 'expense',
      description: String(r.description || 'Lançamento recorrente').trim(),
      amount: parseFloat(r.amount) || 0,
      category: r.category || '',
      account: r.account || '',
      toAccount: r.toAccount || '',
      fee: parseFloat(r.fee) || 0,
      frequency: r.frequency === 'weekly' ? 'weekly' : 'monthly',
      dayOfMonth: Math.min(Math.max(parseInt(r.dayOfMonth, 10) || 1, 1), 28),
      weekday: Math.min(Math.max(parseInt(r.weekday, 10) || 0, 0), 6),
      nextDate: r.nextDate || this.todayStr(),
      status: r.status === 'pending' ? 'pending' : 'paid',
      active: r.active !== false
    }));
  }

  addRecurring(rule) {
    const base = this.normalizeRecurring([{ ...rule }])[0];
    if (!base) return null;
    if (!rule || !rule.nextDate) {
      base.nextDate = this.computeNextOccurrence(base, this.todayStr());
    }
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
    this.saveData();
    return normalized;
  }

  endOfMonth(monthStr) {
    const [y, m] = String(monthStr).split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    return `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  }

  processRecurring(today = this.todayStr()) {
    if (!Array.isArray(this.data.recurring) || this.data.recurring.length === 0) return 0;
    let created = 0;

    this.data.recurring.forEach(rule => {
      if (rule.active === false) return;
      let guard = 0;
      while (rule.nextDate && rule.nextDate <= today && guard < 240) {
        const txData = {
          type: rule.type,
          description: rule.description,
          amount: rule.amount,
          category: rule.category,
          account: rule.account,
          date: rule.nextDate,
          dueDate: rule.nextDate,
          status: rule.nextDate > this.todayStr() ? 'pending' : (rule.status || 'paid'),
          notes: 'Gerado automaticamente (recorrente)',
          fixed: true,
          recurringId: rule.id
        };
        if (rule.type === 'transfer') {
          txData.toAccount = rule.toAccount;
          txData.fee = rule.fee;
        }
        this.addTransaction(txData);
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

    const closingDay = account.closingDay || 1;
    const dueDay = account.dueDay || closingDay;
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
      if (tx.type === 'expense' && account && account.type === 'credit') {
        const closingDay = account.closingDay || 1;
        const dueDay = account.dueDay || closingDay;
        const { dueDate, closingDate } = this.computeInvoiceDates(tx.date || today, closingDay, dueDay);
        const key = `${account.name}|${dueDate}`;
        if (!invoiceMap[key]) {
          invoiceMap[key] = {
            kind: 'invoice',
            account: account.name,
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

  markTransactionsPaid(ids) {
    const set = new Set(Array.isArray(ids) ? ids : [ids]);
    let changed = 0;
    this.data.transactions.forEach(tx => {
      if (set.has(tx.id) && tx.status !== 'paid') {
        tx.status = 'paid';
        changed += 1;
      }
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
      if (parsed && parsed.transactions && Array.isArray(parsed.transactions)) {
        this.data = parsed;
        this.data.accounts = this.normalizeAccounts(this.data.accounts);
        this.data.customCategories = this.normalizeCustomCategories(this.data.customCategories);
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
      this.data.transactions = imported;
      this.saveData();
      return true;
    } catch (e) {
      console.error('Falha ao importar CSV:', e);
      return false;
    }
  }

  resetAllData() {
    localStorage.removeItem(this.STORAGE_KEY);
    this.data = this.generateSeedData();
  }
}

// Instância Global do Estado
window.financialState = new FinancialState();
