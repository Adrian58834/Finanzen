/**
 * FinanZen - Testes unitários da lógica de negócio (js/state.js).
 * Execução: node --test tests/
 */
const { test } = require('node:test');
const assert = require('node:assert');
const setup = require('./helpers/setup');

function pad(n) {
  return String(n).padStart(2, '0');
}

function fresh() {
  setup.storage.clear();
  return new setup.FinancialState();
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

test('seed data estrutura inicial', () => {
  const s = fresh();
  assert.ok(Array.isArray(s.data.transactions) && s.data.transactions.length > 0, 'deve ter transações de exemplo');
  assert.ok(Array.isArray(s.data.budgets) && s.data.budgets.length > 0, 'deve ter orçamentos de exemplo');
  assert.ok(Array.isArray(s.data.goals) && s.data.goals.length > 0, 'deve ter metas de exemplo');
  assert.ok(Array.isArray(s.data.accounts) && s.data.accounts.length >= 6, 'deve ter contas padrão');
  assert.ok(s.data.accounts.every(a => a.id && a.name && a.type), 'contas têm id, nome e tipo');
  assert.deepStrictEqual(s.data.customCategories, [], 'seed não deve ter categorias customizadas');
  assert.ok(s.getAllCategories().length >= 13, 'categorias padrão presentes');
  assert.strictEqual(s.settings.currency, 'BRL');
});

test('CRUD de transações', () => {
  const s = fresh();
  const tx = s.addTransaction({
    description: 'Teste Pizza',
    amount: '42.50',
    type: 'expense',
    category: 'cat_lazer',
    date: '2026-09-10',
    account: 'Nubank',
    status: 'pending',
    notes: 'jantar'
  });
  assert.ok(tx.id, 'deve gerar id');
  assert.strictEqual(tx.amount, 42.5);
  assert.strictEqual(s.getTransactionById(tx.id).description, 'Teste Pizza');
  assert.strictEqual(s.getTransactionById(tx.id).type, 'expense');

  const updated = s.updateTransaction(tx.id, { amount: '20', status: 'paid' });
  assert.strictEqual(updated.amount, 20);
  assert.strictEqual(updated.status, 'paid');

  s.deleteTransaction(tx.id);
  assert.strictEqual(s.getTransactionById(tx.id), undefined);
});

test('transação sem categoria usa padrão do tipo', () => {
  const s = fresh();
  const tx = s.addTransaction({ description: 'X', amount: 5, type: 'income' });
  assert.strictEqual(tx.category, 'cat_outros_inc');
});

test('filtros combinados (mês, tipo, categoria, status, busca, conta)', () => {
  const s = fresh();
  const m = currentMonth();

  const income = s.getFilteredTransactions({ month: m, type: 'income' });
  assert.ok(income.length > 0 && income.every(t => t.type === 'income' && t.date.startsWith(m)));

  const found = s.getFilteredTransactions({ search: 'supermercado' });
  assert.ok(found.some(t => t.description.toLowerCase().includes('supermercado')));

  const byAccount = s.getFilteredTransactions({ account: 'Nubank' });
  assert.ok(byAccount.length > 0 && byAccount.every(t => t.account === 'Nubank'));

  const pending = s.getFilteredTransactions({ status: 'pending' });
  assert.ok(pending.length > 0 && pending.every(t => t.status === 'pending'));

  const cat = s.getCategoryById('cat_moradia');
  assert.ok(cat.name.includes('Moradia'));
});

test('getMetrics calcula receitas, despesas, pendentes e taxa de poupança', () => {
  const s = fresh();
  s.data.transactions = [
    { id: 'a', date: '2026-09-05', type: 'income', amount: 1000, status: 'paid' },
    { id: 'b', date: '2026-09-06', type: 'expense', amount: 200, status: 'paid' },
    { id: 'c', date: '2026-09-07', type: 'expense', amount: 300, status: 'pending' },
    { id: 'd', date: '2026-10-01', type: 'income', amount: 50, status: 'paid' }
  ];

  const m = s.getMetrics('2026-09');
  assert.strictEqual(m.totalIncome, 1000);
  assert.strictEqual(m.totalExpense, 500);
  assert.strictEqual(m.netBalance, 500);
  assert.strictEqual(m.pendingExpense, 300);
  assert.strictEqual(m.savingsRate, 50);

  const all = s.getMetrics('all');
  assert.strictEqual(all.totalIncome, 1050);
  assert.strictEqual(all.totalExpense, 500);

  // Período por ano também funciona
  const year = s.getMetrics('2026');
  assert.strictEqual(year.totalIncome, 1050);
});

test('getExpensesByCategory agrega e ordena', () => {
  const s = fresh();
  s.data.transactions = [
    { id: '1', date: '2026-09-01', type: 'expense', category: 'cat_alimentacao', amount: 100 },
    { id: '2', date: '2026-09-02', type: 'expense', category: 'cat_alimentacao', amount: 50 },
    { id: '3', date: '2026-09-03', type: 'expense', category: 'cat_transporte', amount: 200 },
    { id: '4', date: '2026-09-04', type: 'income', category: 'cat_salario', amount: 999 }
  ];
  const list = s.getExpensesByCategory('2026-09');
  assert.strictEqual(list[0].id, 'cat_transporte');
  assert.strictEqual(list[0].total, 200);
  assert.strictEqual(list[1].id, 'cat_alimentacao');
  assert.strictEqual(list[1].total, 150);
  assert.strictEqual(list.length, 2, 'receitas não entram na divisão de despesas');
});

test('getMonthlyFlow agrega por mês no ano', () => {
  const s = fresh();
  s.data.transactions = [
    { id: '1', date: '2026-01-10', type: 'income', amount: 1000 },
    { id: '2', date: '2026-01-20', type: 'expense', amount: 300 },
    { id: '3', date: '2026-12-01', type: 'expense', amount: 500 }
  ];
  const flow = s.getMonthlyFlow(2026);
  assert.strictEqual(flow.income[0], 1000);
  assert.strictEqual(flow.expense[0], 300);
  assert.strictEqual(flow.expense[11], 500);
  assert.strictEqual(flow.labels.length, 12);
});

test('CRUD de orçamentos (criação e atualização pelo mesmo método)', () => {
  const s = fresh();
  const before = s.data.budgets.length;
  s.addOrUpdateBudget('cat_saude', 800);
  assert.strictEqual(s.data.budgets.length, before + 1);
  assert.strictEqual(s.data.budgets.find(b => b.categoryId === 'cat_saude').monthlyLimit, 800);

  s.addOrUpdateBudget('cat_saude', 900);
  assert.strictEqual(s.data.budgets.length, before + 1, 'não deve duplicar');
  assert.strictEqual(s.data.budgets.find(b => b.categoryId === 'cat_saude').monthlyLimit, 900);

  s.deleteBudget('cat_saude');
  assert.strictEqual(s.data.budgets.length, before);
});

test('CRUD de metas + aporte', () => {
  const s = fresh();
  const g = s.addGoal({ title: 'Meta Teste', targetAmount: 1000, currentAmount: 100, deadline: '2027-01-01', icon: 'ri-plane-line' });
  assert.ok(g.id);
  assert.strictEqual(s.data.goals.find(x => x.id === g.id).currentAmount, 100);

  s.depositToGoal(g.id, 150);
  assert.strictEqual(s.data.goals.find(x => x.id === g.id).currentAmount, 250);

  s.updateGoal(g.id, { targetAmount: 2000 });
  assert.strictEqual(s.data.goals.find(x => x.id === g.id).targetAmount, 2000);

  s.deleteGoal(g.id);
  assert.strictEqual(s.data.goals.find(x => x.id === g.id), undefined);
});

test('categorias customizadas: criar, atualizar, excluir e redirecionar transações', () => {
  const s = fresh();
  const c = s.addCategory({ name: 'Pets', type: 'expense', color: '#ff0000' });
  assert.ok(c && c.id, 'deve criar categoria com id');
  assert.strictEqual(s.data.customCategories.length, 1);
  assert.strictEqual(s.getCategoriesByType('expense').some(x => x.id === c.id), true);
  assert.strictEqual(s.getCategoriesByType('income').some(x => x.id === c.id), false);
  assert.strictEqual(s.getCategoryById(c.id).color, '#ff0000');

  s.updateCategory(c.id, { name: 'Animais' });
  assert.strictEqual(s.data.customCategories[0].name, 'Animais');

  const tx = s.addTransaction({ description: 'Ração', amount: 50, type: 'expense', category: c.id });
  assert.strictEqual(s.getTransactionById(tx.id).category, c.id);

  const bdCount = s.data.budgets.length;
  s.addOrUpdateBudget(c.id, 500);
  assert.strictEqual(s.data.budgets.length, bdCount + 1);

  assert.strictEqual(s.deleteCategory(c.id), true);
  assert.strictEqual(s.data.customCategories.length, 0);
  assert.strictEqual(s.getTransactionById(tx.id).category, 'cat_outros_exp', 'transação movida para Outras Despesas');
  assert.strictEqual(s.data.budgets.some(b => b.categoryId === c.id), false, 'orçamento da categoria removido');
});

test('contas: adicionar (com tipo), renomear, excluir e proteger a última', () => {
  const s = fresh();
  const added = s.addAccount({ name: 'PicPay', type: 'bank' });
  assert.ok(added && added.id, 'conta criada com id');

  const broker = s.addAccount({ name: 'XP Investimentos', type: 'broker', openingBalance: 1000 });
  assert.strictEqual(broker.openingBalance, 1000);
  assert.strictEqual(broker.type, 'broker');

  const card = s.addAccount({ name: 'Cartão Platinum', type: 'credit', creditLimit: 8000 });
  assert.strictEqual(card.creditLimit, 8000);
  assert.strictEqual(card.type, 'credit');

  assert.strictEqual(s.renameAccount('PicPay', 'PicPay Plus'), 'PicPay Plus');
  assert.strictEqual(s.getAccountNames().includes('PicPay'), false);
  assert.ok(s.getAccountNames().includes('PicPay Plus'));

  const tx = s.data.transactions[0];
  s.data.transactions[0].account = 'PicPay Plus';
  assert.strictEqual(s.deleteAccount('PicPay Plus'), true);
  assert.strictEqual(s.getAccountNames().includes('PicPay Plus'), false);
  assert.strictEqual(s.data.transactions.find(t => t.id === tx.id).account, s.data.accounts[0].name);

  s.data.accounts = [{ id: 'only', name: 'Só Existe', type: 'bank', openingBalance: 0, creditLimit: 0 }];
  assert.strictEqual(s.deleteAccount('Só Existe'), false, 'não pode excluir a última conta');
  assert.strictEqual(s.data.accounts.length, 1);
});

test('updateAccount altera tipo, saldo inicial e limite do cartão', () => {
  const s = fresh();
  s.addAccount({ name: 'Minha Conta', type: 'bank' });
  const updated = s.updateAccount('Minha Conta', { type: 'credit', creditLimit: 3000, openingBalance: 0 });
  assert.strictEqual(updated.type, 'credit');
  assert.strictEqual(updated.creditLimit, 3000);
});

test('contas antigas (string) são migradas para objetos com tipo inferido', () => {
  const s = fresh();
  const migrated = s.normalizeAccounts([
    'Conta Corrente',
    'Cartão de Crédito',
    'XP Investimentos',
    'Carteira / Dinheiro'
  ]);
  assert.strictEqual(migrated.length, 4);
  assert.strictEqual(migrated[0].type, 'bank');
  assert.strictEqual(migrated[1].type, 'credit');
  assert.strictEqual(migrated[2].type, 'broker');
  assert.strictEqual(migrated[3].type, 'wallet');
  assert.ok(migrated.every(a => a.id && typeof a.name === 'string'), 'todas ganham id e nome');
});

test('merge de conta duplicada é rejeitado', () => {
  const s = fresh();
  assert.strictEqual(s.addAccount('Nubank'), null, 'conta já existente');
  assert.strictEqual(s.addAccount('   '), null, 'nome vazio');
  assert.strictEqual(s.addAccount({ name: 'Novo Banco', type: 'invalido' }).type, 'bank', 'tipo inválido cai para banco');
});

test('getAccountMetrics calcula patrimônio líquido, saldo por conta e crédito', () => {
  const s = fresh();
  s.data.accounts = [
    { id: 'a1', name: 'Conta', type: 'bank', openingBalance: 1000, creditLimit: 0 },
    { id: 'a2', name: 'Corretora XP', type: 'broker', openingBalance: 0, creditLimit: 0 },
    { id: 'a3', name: 'Cartão', type: 'credit', openingBalance: 0, creditLimit: 5000 }
  ];
  s.data.transactions = [
    { id: 't1', date: '2026-09-01', description: 'Salário', amount: 2000, type: 'income', category: 'cat_salario', account: 'Conta', status: 'paid', notes: '' },
    { id: 't2', date: '2026-09-02', description: 'Mercado', amount: 500, type: 'expense', category: 'cat_alimentacao', account: 'Conta', status: 'paid', notes: '' },
    { id: 't3', date: '2026-09-03', description: 'Aporte', amount: 1000, type: 'income', category: 'cat_salario', account: 'Corretora XP', status: 'paid', notes: '' },
    { id: 't4', date: '2026-09-04', description: 'Compra cartão', amount: 800, type: 'expense', category: 'cat_lazer', account: 'Cartão', status: 'pending', notes: '' }
  ];

  const m = s.getAccountMetrics('all');
  const conta = m.accounts.find(a => a.name === 'Conta');
  const broker = m.accounts.find(a => a.name === 'Corretora XP');
  const card = m.accounts.find(a => a.name === 'Cartão');

  assert.strictEqual(conta.value, 2500, 'saldo inicial + receitas - despesas');
  assert.strictEqual(broker.value, 1000);
  assert.strictEqual(card.used, 800);
  assert.strictEqual(card.available, 4200);
  assert.strictEqual(card.value, -800, 'cartão entra como passivo');

  assert.strictEqual(m.byType.bank, 2500);
  assert.strictEqual(m.byType.broker, 1000);
  assert.strictEqual(m.byType.credit, 800);
  assert.strictEqual(m.totals.assets, 3500);
  assert.strictEqual(m.totals.netWorth, 2700, 'patrimônio = ativos - usado no cartão');
  assert.strictEqual(m.totals.creditAvailable, 4200);

  assert.strictEqual(s.getAccountMetrics('2026-08').accounts.find(a => a.name === 'Cartão').used, 0, 'período sem gastos zera o usado');
});

test('transferência move saldo entre contas sem contar como receita/despesa', () => {
  const s = fresh();
  s.data.accounts = [
    { id: 'a1', name: 'Banco', type: 'bank', openingBalance: 1000, creditLimit: 0 },
    { id: 'a2', name: 'Corretora', type: 'broker', openingBalance: 0, creditLimit: 0 }
  ];
  s.data.transactions = [];

  const tx = s.addTransaction({ type: 'transfer', account: 'Banco', toAccount: 'Corretora', amount: 400, date: '2026-09-10' });
  assert.strictEqual(tx.type, 'transfer');
  assert.strictEqual(tx.toAccount, 'Corretora');

  const metrics = s.getMetrics('2026-09');
  assert.strictEqual(metrics.totalIncome, 0, 'transferência não é receita');
  assert.strictEqual(metrics.totalExpense, 0, 'transferência não é despesa');
  assert.strictEqual(s.getExpensesByCategory('2026-09').length, 0, 'transferência não entra no donut de categorias');

  const m = s.getAccountMetrics('all');
  assert.strictEqual(m.accounts.find(a => a.name === 'Banco').value, 600);
  assert.strictEqual(m.accounts.find(a => a.name === 'Corretora').value, 400);
  assert.strictEqual(m.totals.netWorth, 1000, 'patrimônio não muda com transferência');

  const flow = s.getMonthlyFlow(2026);
  assert.deepStrictEqual(flow.income, new Array(12).fill(0));
  assert.deepStrictEqual(flow.expense, new Array(12).fill(0), 'fluxo mensal ignora transferências');
});

test('transferência para o cartão de crédito reduz o usado (pagamento de fatura)', () => {
  const s = fresh();
  s.data.accounts = [
    { id: 'a1', name: 'Banco', type: 'bank', openingBalance: 2000, creditLimit: 0 },
    { id: 'a2', name: 'Cartão', type: 'credit', openingBalance: 0, creditLimit: 3000 }
  ];
  s.data.transactions = [
    { id: 'e1', date: '2026-09-01', description: 'Compra', amount: 500, type: 'expense', category: 'cat_lazer', account: 'Cartão', status: 'paid', notes: '' }
  ];
  s.addTransaction({ type: 'transfer', account: 'Banco', toAccount: 'Cartão', amount: 200, date: '2026-09-05' });

  const m = s.getAccountMetrics('all');
  const card = m.accounts.find(a => a.name === 'Cartão');
  assert.strictEqual(card.used, 300, 'usado = 500 de compras - 200 pagos');
  assert.strictEqual(card.available, 2700);
  assert.strictEqual(m.accounts.find(a => a.name === 'Banco').value, 1800);
  assert.strictEqual(m.totals.netWorth, 1500, 'ativos 1800 - passivo 300');
});

test('renomear e excluir conta atualiza transferências (origem e destino)', () => {
  const s = fresh();
  s.data.accounts = [
    { id: 'a0', name: 'Poupança', type: 'bank', openingBalance: 0, creditLimit: 0 },
    { id: 'a1', name: 'Banco', type: 'bank', openingBalance: 0, creditLimit: 0 },
    { id: 'a2', name: 'Corretora', type: 'broker', openingBalance: 0, creditLimit: 0 }
  ];
  s.data.transactions = [];
  s.addTransaction({ type: 'transfer', account: 'Banco', toAccount: 'Corretora', amount: 100, date: '2026-09-01' });

  s.renameAccount('Corretora', 'Corretora XP');
  assert.strictEqual(s.data.transactions[0].toAccount, 'Corretora XP');

  s.deleteAccount('Corretora XP');
  assert.strictEqual(s.data.transactions[0].toAccount, 'Poupança', 'destino redirecionado para a primeira conta restante');
});

test('importCSV reconhece transferências e o destino', () => {
  const s = fresh();
  const csv = [
    'ID,Data,Descricao,Tipo,Categoria,Valor,Conta,Destino,Status,Notas',
    'x1,2026-09-10,Aporte,Transferência,Transferência,400.00,"Banco","Corretora",Pago,""'
  ].join('\n');

  assert.strictEqual(s.importCSV(csv), true);
  const tx = s.data.transactions[0];
  assert.strictEqual(tx.type, 'transfer');
  assert.strictEqual(tx.account, 'Banco');
  assert.strictEqual(tx.toAccount, 'Corretora');
  assert.strictEqual(tx.category, '', 'transferência não recebe categoria');
});

test('loadData normaliza formato antigo de customCategories e contas ausentes', () => {
  const legacy = {
    transactions: [],
    budgets: [],
    goals: [],
    customCategories: {
      income: [
        { id: 'cat_salario', name: 'Salário & Renda', icon: 'ri-money-dollar-circle-line', color: '#10b981' }
      ],
      expense: [
        { id: 'cat_moradia', name: 'Moradia & Contas', icon: 'ri-home-4-line', color: '#6366f1' },
        { id: 'cat_x', name: 'Loja X', icon: 'ri-store-line', color: '#123456' }
      ]
    }
  };
  setup.storage.setItem(setup.STORAGE_KEY, JSON.stringify(legacy));

  const s = new setup.FinancialState();
  const names = s.data.customCategories.map(c => c.name);
  assert.strictEqual(names.includes('Loja X'), true, 'categoria nova mantida');
  assert.strictEqual(names.includes('Moradia & Contas'), false, 'categoria padrão descartada');
  assert.strictEqual(names.includes('Salário & Renda'), false, 'categoria padrão descartada');
  assert.ok(Array.isArray(s.data.accounts) && s.data.accounts.length > 0, 'contas padrão injetadas');
});

test('importCSV valida e importa no formato exportado', () => {
  const s = fresh();
  const csv = [
    'ID,Data,Descricao,Tipo,Categoria,Valor,Conta,Status,Notas',
    'tx1,2026-09-05,"Mercado Mês","Despesa","Alimentação & Mercado",123.45,"Cartão de Crédito","Pago","compras"',
    'tx2,2026-09-06,Salário,"Receita","Salário & Renda",5000.00,"Conta Corrente","Pago",""',
    'tx3,2026-09-07,"Nota ""com aspas""","Despesa","Transporte & Combustível",80.00,Nubank,"Pendente",x'
  ].join('\n');

  assert.strictEqual(s.importCSV(csv), true);
  assert.strictEqual(s.data.transactions.length, 3);
  const [t1, t2, t3] = s.data.transactions;
  assert.strictEqual(t1.type, 'expense');
  assert.strictEqual(t1.amount, 123.45);
  assert.strictEqual(t1.category, 'cat_alimentacao');
  assert.strictEqual(t2.type, 'income');
  assert.strictEqual(t2.category, 'cat_salario');
  assert.strictEqual(t2.amount, 5000);
  assert.strictEqual(t3.status, 'pending');
  assert.ok(t3.description.includes('"com aspas"'), 'aspas escapadas suportadas');
});

test('importCSV rejeita arquivos inválidos', () => {
  const s = fresh();
  assert.strictEqual(s.importCSV(''), false);
  assert.strictEqual(s.importCSV('apenas,uma,linha'), false);
  assert.strictEqual(s.importCSV('Data,Valor\n2026-09-01,abc'), false, 'linha sem valor numérico é filtrada');
});

test('importJSON aceita / rejeita', () => {
  const s = fresh();
  assert.strictEqual(s.importJSON('{invalid'), false);
  assert.strictEqual(s.importJSON('"apenas string"'), false);

  const payload = JSON.stringify({
    transactions: [{ id: 't1', description: 'Novo', amount: 1, type: 'income', category: 'cat_salario', date: '2026-09-01', account: 'Outro', status: 'paid', notes: '' }],
    budgets: [],
    goals: []
  });
  assert.strictEqual(s.importJSON(payload), true);
  assert.strictEqual(s.data.transactions.length, 1);
  assert.ok(Array.isArray(s.data.accounts), 'contas renormalizadas');
});

test('exportCSV gera cabeçalho e dados válidos', () => {
  const s = fresh();
  s.data.transactions = [
    { id: 'a', date: '2026-09-01', description: 'Recebido', amount: 100, type: 'income', category: 'cat_salario', account: 'Outro', status: 'paid', notes: '' }
  ];
  s.exportCSV(); // não deve lançar erro; grava em bloco de dados URI
  assert.ok(true);
});

test('resetAllData regenera dados de demonstração', () => {
  const s = fresh();
  const before = s.data.transactions.length;
  s.data.transactions = [];
  s.data.goals = [];
  s.resetAllData();
  assert.strictEqual(s.data.transactions.length, before);
  assert.ok(s.data.goals.length > 0);
  assert.ok(s.data.accounts.length >= 6);
});

test('saveSettings persiste preferências (moeda)', () => {
  const s = fresh();
  s.saveSettings({ currency: 'USD' });
  assert.strictEqual(s.settings.currency, 'USD');
  const s2 = new setup.FinancialState();
  assert.strictEqual(s2.settings.currency, 'USD');
});

test('taxa de transferência entra como despesa em Tarifas & Juros', () => {
  const s = fresh();
  s.data.accounts = [
    { id: 'a1', name: 'Banco', type: 'bank', openingBalance: 1000, creditLimit: 0 },
    { id: 'a2', name: 'Corretora', type: 'broker', openingBalance: 0, creditLimit: 0 }
  ];
  s.data.transactions = [];
  s.addTransaction({ type: 'transfer', account: 'Banco', toAccount: 'Corretora', amount: 400, fee: 10, date: '2026-09-10' });

  const metrics = s.getMetrics('2026-09');
  assert.strictEqual(metrics.totalIncome, 0);
  assert.strictEqual(metrics.totalExpense, 10, 'apenas a taxa conta como despesa');

  const cats = s.getExpensesByCategory('2026-09');
  assert.strictEqual(cats.length, 1);
  assert.strictEqual(cats[0].id, 'cat_tarifas');
  assert.strictEqual(cats[0].total, 10);

  const flow = s.getMonthlyFlow(2026);
  assert.strictEqual(flow.expense[8], 10);
  assert.strictEqual(flow.income[8], 0);

  const m = s.getAccountMetrics('all');
  assert.strictEqual(m.accounts.find(a => a.name === 'Banco').value, 590, 'origem debita valor + taxa');
  assert.strictEqual(m.accounts.find(a => a.name === 'Corretora').value, 400);
  assert.strictEqual(m.totals.netWorth, 990, 'patrimônio cai o valor da taxa');
});

test('recorrência mensal gera lançamento fixo e não duplica', () => {
  const s = fresh();
  s.data.transactions = [];
  const rule = s.addRecurring({
    type: 'expense',
    description: 'Aluguel',
    amount: 1500,
    category: 'cat_moradia',
    account: 'Conta Corrente',
    frequency: 'monthly',
    dayOfMonth: 5,
    nextDate: '2026-09-05',
    status: 'paid'
  });
  assert.ok(rule && rule.id);

  assert.strictEqual(s.processRecurring('2026-09-30'), 1);
  const tx = s.data.transactions.find(t => t.description === 'Aluguel');
  assert.strictEqual(tx.date, '2026-09-05');
  assert.strictEqual(tx.status, 'paid');
  assert.strictEqual(tx.fixed, true);
  assert.strictEqual(tx.recurringId, rule.id);

  assert.strictEqual(s.processRecurring('2026-09-30'), 0, 'reprocessar não duplica');
  assert.strictEqual(s.data.transactions.filter(t => t.description === 'Aluguel').length, 1);
});

test('materializar meses futuros cria lançamentos Agendados e o vencimento os confirma', () => {
  const s = fresh();
  s.data.transactions = [];
  s.addRecurring({
    type: 'income',
    description: 'Salário',
    amount: 5000,
    category: 'cat_salario',
    account: 'Conta Corrente',
    frequency: 'monthly',
    dayOfMonth: 10,
    nextDate: '2026-10-10',
    status: 'paid'
  });

  const created = s.processRecurring(s.endOfMonth('2026-11'));
  assert.strictEqual(created, 2, 'outubro e novembro');
  const fixedTxs = s.data.transactions.filter(t => t.fixed);
  assert.strictEqual(fixedTxs.length, 2);
  assert.ok(fixedTxs.every(t => t.status === 'pending'), 'meses futuros entram como Agendado');

  assert.strictEqual(s.settleDueFixedTransactions('2026-11-30'), 2);
  assert.ok(s.data.transactions.filter(t => t.fixed).every(t => t.status === 'paid'));
});

test('endOfMonth calcula o último dia do mês', () => {
  const s = fresh();
  assert.strictEqual(s.endOfMonth('2026-02'), '2026-02-28');
  assert.strictEqual(s.endOfMonth('2024-02'), '2024-02-29');
  assert.strictEqual(s.endOfMonth('2026-12'), '2026-12-31');
});

test('pausar e excluir recorrência interrompe a geração', () => {
  const s = fresh();
  s.data.transactions = [];
  const rule = s.addRecurring({
    type: 'expense',
    description: 'Assinatura',
    amount: 30,
    frequency: 'monthly',
    dayOfMonth: 1,
    nextDate: '2026-09-01'
  });

  s.toggleRecurring(rule.id);
  assert.strictEqual(s.processRecurring('2026-12-31'), 0, 'pausada não gera');

  s.toggleRecurring(rule.id);
  assert.strictEqual(s.processRecurring('2026-09-30'), 1, 'reativada volta a gerar');

  s.deleteRecurring(rule.id);
  assert.strictEqual(s.processRecurring('2027-01-31'), 0, 'excluída não gera');
});

test('updateRecurring altera dados e nunca retrocede a próxima ocorrência', () => {
  const s = fresh();
  s.data.transactions = [];
  const rule = s.addRecurring({
    type: 'expense',
    description: 'Internet',
    amount: 100,
    frequency: 'monthly',
    dayOfMonth: 10,
    nextDate: '2026-12-10'
  });

  const updated = s.updateRecurring(rule.id, { amount: 120, description: 'Internet Fibra', nextDate: '2026-10-10' });
  assert.strictEqual(updated.amount, 120);
  assert.strictEqual(updated.description, 'Internet Fibra');
  assert.strictEqual(updated.nextDate, '2026-12-10', 'não retrocede para não regerar meses');
  assert.strictEqual(s.data.recurring.length, 1, 'não duplica a regra');
  assert.strictEqual(s.updateRecurring('nao_existe', { amount: 1 }), null);
});

test('getDataStats resume os dados armazenados', () => {
  const s = fresh();
  const stats = s.getDataStats();
  assert.strictEqual(stats.transactions, s.data.transactions.length);
  assert.strictEqual(stats.accounts, s.data.accounts.length);
  assert.strictEqual(stats.categories, s.getAllCategories().length);
  assert.strictEqual(stats.recurring, 0);
  assert.strictEqual(stats.goals, s.data.goals.length);
  assert.ok(stats.bytes > 0, 'calcula o tamanho em bytes');
});

test('getReport consolida métricas, top despesas, pendentes e categorias', () => {
  const s = fresh();
  s.data.transactions = [];
  s.addTransaction({ description: 'Salário', amount: 5000, type: 'income', date: '2026-09-05' });
  s.addTransaction({ description: 'Aluguel', amount: 1500, type: 'expense', category: 'cat_moradia', date: '2026-09-06' });
  s.addTransaction({ description: 'Mercado', amount: 300, type: 'expense', category: 'cat_alimentacao', date: '2026-09-07' });
  s.addTransaction({ description: 'Luz', amount: 200, type: 'expense', category: 'cat_transporte', date: '2026-09-20', status: 'pending' });

  const report = s.getReport('2026-09');
  assert.strictEqual(report.month, '2026-09');
  assert.strictEqual(report.metrics.totalIncome, 5000);
  assert.strictEqual(report.metrics.totalExpense, 2000);
  assert.strictEqual(report.metrics.netBalance, 3000);
  assert.strictEqual(report.topExpenses.length, 3, 'lista até 5 despesas');
  assert.strictEqual(report.topExpenses[0].description, 'Aluguel', 'ordenado por valor desc');
  assert.strictEqual(report.topCategory.name, 'Moradia & Contas');
  assert.strictEqual(report.pending.length, 1);
  assert.strictEqual(report.pending[0].description, 'Luz');
  assert.ok(report.byCategory.length >= 3);
  assert.ok(typeof report.generatedAt === 'string');
});

test('computeInvoiceDates calcula fechamento e vencimento da fatura', () => {
  const s = fresh();
  assert.deepStrictEqual(s.computeInvoiceDates('2026-09-10', 25, 5), { closingDate: '2026-09-25', dueDate: '2026-10-05' });
  assert.deepStrictEqual(s.computeInvoiceDates('2026-09-28', 25, 5), { closingDate: '2026-10-25', dueDate: '2026-11-05' });
  assert.deepStrictEqual(s.computeInvoiceDates('2026-09-03', 5, 15), { closingDate: '2026-09-05', dueDate: '2026-09-15' });
  assert.deepStrictEqual(s.computeInvoiceDates('2026-02-10', 31, 10), { closingDate: '2026-02-28', dueDate: '2026-03-10' });
});

test('getAccountInvoice agrega compras do ciclo do cartão', () => {
  const s = fresh();
  s.data.transactions = [];
  s.addTransaction({ description: 'Compra 1', amount: 100, type: 'expense', category: 'cat_lazer', account: 'Cartão de Crédito', date: '2026-09-10', status: 'pending' });
  s.addTransaction({ description: 'Compra 2', amount: 50, type: 'expense', category: 'cat_lazer', account: 'Cartão de Crédito', date: '2026-09-24', status: 'pending' });
  s.addTransaction({ description: 'Compra fora', amount: 999, type: 'expense', category: 'cat_lazer', account: 'Cartão de Crédito', date: '2026-09-28', status: 'pending' });

  const inv = s.getAccountInvoice('Cartão de Crédito', '2026-09-15');
  assert.strictEqual(inv.closingDate, '2026-09-25');
  assert.strictEqual(inv.dueDate, '2026-10-05');
  assert.strictEqual(inv.transactions.length, 2);
  assert.strictEqual(inv.pendingTotal, 150);
  assert.strictEqual(s.getAccountInvoice('Conta Corrente', '2026-09-15'), null, 'só cartão de crédito gera fatura');
});

test('getDueReminders classifica atrasados, hoje e próximos e some ao pagar', () => {
  const s = fresh();
  s.data.transactions = [];
  const today = s.todayStr();

  s.addTransaction({ description: 'Atrasada', amount: 100, type: 'expense', category: 'cat_moradia', account: 'Conta Corrente', date: s.addDays(today, -1), status: 'pending' });
  s.addTransaction({ description: 'Hoje', amount: 200, type: 'expense', category: 'cat_moradia', account: 'Conta Corrente', date: today, status: 'pending' });
  s.addTransaction({ description: 'Receita', amount: 500, type: 'income', category: 'cat_salario', account: 'Conta Corrente', date: s.addDays(today, 3), status: 'pending' });
  s.addTransaction({ description: 'Distante', amount: 999, type: 'expense', category: 'cat_moradia', account: 'Conta Corrente', date: s.addDays(today, 10), status: 'pending' });

  const r = s.getDueReminders(today);
  assert.strictEqual(r.counts.overdue, 1);
  assert.strictEqual(r.counts.today, 1);
  assert.strictEqual(r.counts.upcoming, 1);
  assert.strictEqual(r.later.length, 1, 'fora da janela de 7 dias');
  assert.strictEqual(r.totals.overdueExpense, 100);
  assert.strictEqual(r.totals.todayExpense, 200);
  assert.strictEqual(r.totals.upcomingIncome, 500);

  assert.strictEqual(s.markTransactionsPaid(r.overdue[0].txIds), 1);
  assert.strictEqual(s.getDueReminders(today).counts.overdue, 0);
});

test('vencimento próprio (dueDate) prevalece sobre a data do lançamento', () => {
  const s = fresh();
  s.data.transactions = [];
  const today = s.todayStr();
  s.addTransaction({
    description: 'Conta com vencimento',
    amount: 80,
    type: 'expense',
    category: 'cat_moradia',
    account: 'Conta Corrente',
    date: s.addDays(today, 20),
    dueDate: today,
    status: 'pending'
  });

  const r = s.getDueReminders(today);
  assert.strictEqual(r.counts.today, 1, 'usa o vencimento, não a data de compra');
});

test('conta de crédito guarda dia de fechamento e vencimento', () => {
  const s = fresh();
  const acc = s.addAccount({ name: 'Visa Teste', type: 'credit', creditLimit: 3000, closingDay: 20, dueDay: 10 });
  assert.strictEqual(acc.closingDay, 20);
  assert.strictEqual(acc.dueDay, 10);

  const updated = s.updateAccount('Visa Teste', { closingDay: 15, dueDay: 25 });
  assert.strictEqual(updated.closingDay, 15);
  assert.strictEqual(updated.dueDay, 25);
});