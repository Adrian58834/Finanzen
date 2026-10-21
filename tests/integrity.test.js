/**
 * FinanZen - Teste de integridade estática.
 * Verifica: (1) todo ID referenciado pelo JS existe no HTML; (2) sem IDs duplicados;
 * (3) sintaxe válida em todos os arquivos JS da aplicação.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

// IDs criados dinamicamente pelo código (não existem no HTML inicial)
const DYNAMIC_IDS = new Set(['toast-container', 'due-alert-open', 'sync-email', 'sync-password', 'tx-prev-page', 'tx-next-page', 'empty-add-card-btn']);

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function collectReferencedIds(js) {
  const ids = new Set();
  const re = /getElementById\(\s*['"]([A-Za-z0-9_-]+)['"]\s*\)/g;
  let m;
  while ((m = re.exec(js)) !== null) ids.add(m[1]);
  return ids;
}

test('todos os IDs usados pelo JS existem no HTML', () => {
  const html = read('index.html');
  const js = ['app.js', 'state.js', 'charts.js'].map(f => read('js/' + f)).join('\n');

  const referenced = collectReferencedIds(js);
  assert.ok(referenced.size > 0, 'devem existir IDs referenciados');

  const missing = [...referenced].filter(id => !DYNAMIC_IDS.has(id) && !new RegExp(`id="${id}"`).test(html));
  assert.deepStrictEqual(missing, [], `IDs faltando no HTML: ${missing.join(', ')}`);
});

test('nenhum ID duplicado no HTML', () => {
  const html = read('index.html');
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
  const seen = new Set();
  const dupes = [];
  for (const id of ids) {
    if (seen.has(id)) dupes.push(id);
    seen.add(id);
  }
  assert.deepStrictEqual(dupes, []);
});

test('versão do app e cache offline permanecem sincronizados', () => {
  const html = read('index.html');
  const serviceWorker = read('sw.js');
  const packageData = JSON.parse(read('package.json'));
  const version = packageData.version;

  assert.match(version, /^\d+\.\d+\.\d+$/, 'package.json deve usar versão semântica');
  assert.ok(serviceWorker.includes(`const VERSION = 'finanzen-v${version}'`), 'versão divergente no service worker');

  for (const asset of ['css/style.css', 'js/state.js', 'js/charts.js', 'js/app.js', 'js/sync-config.js', 'js/sync.js', 'js/open-finance.js']) {
    assert.ok(html.includes(`${asset}?v=${version}`), `versão ausente no HTML para ${asset}`);
    assert.ok(serviceWorker.includes(`./${asset}?v=${version}`), `versão ausente no cache para ${asset}`);
  }
  assert.ok(serviceWorker.includes("key.startsWith('finanzen-v')"), 'limpeza do cache deve afetar apenas caches do FinanZen');
});

test('sintaxe válida em todos os JS da aplicação', () => {
  const files = ['js/state.js', 'js/charts.js', 'js/app.js', 'js/sync.js', 'js/open-finance.js', 'js/sync-config.js', 'sw.js'];
  for (const file of files) {
    const abs = path.join(ROOT, file);
    assert.doesNotThrow(() => {
      execFileSync(process.execPath, ['--check', abs], { stdio: 'pipe' });
    }, `node --check falhou em ${file}`);
  }
});

test('sync.js não chama métodos inexistentes (evita TypeError silencioso)', () => {
  const js = read('js/sync.js');
  const defined = new Set([...js.matchAll(/^ {4}(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(/gm)].map(m => m[1]));
  assert.ok(defined.size > 5, 'devem existir métodos definidos em sync.js');

  const called = new Set([...js.matchAll(/this\.([A-Za-z_$][\w$]*)\s*\(/g)].map(m => m[1]));
  const missing = [...called].filter(name => !defined.has(name));
  assert.deepStrictEqual(missing, [], `métodos inexistentes em sync.js: ${missing.join(', ')}`);
});

test('toast trata a mensagem como texto, sem interpolar HTML', () => {
  const js = read('js/app.js');
  const start = js.indexOf('showToast(message');
  assert.ok(start >= 0, 'showToast deve existir');
  const toastCode = js.slice(start);
  assert.ok(toastCode.includes("messageElement.textContent = String(message ?? '')"));
  assert.ok(!toastCode.includes('<span>${message}</span>'), 'mensagem não pode entrar em innerHTML');
});

test('estrutura principal do HTML preservada (7 abas + seções essenciais)', () => {  const html = read('index.html');
  const sections = (html.match(/class="tab-content/g) || []).length;
  assert.strictEqual(sections, 7);
  for (const id of ['tab-dashboard', 'tab-transactions', 'tab-cards', 'tab-budgets', 'tab-goals', 'tab-reports', 'tab-settings']) {
    assert.ok(html.includes(`id="${id}"`), `falta ${id}`);
  }
  for (const id of ['modal-transaction', 'modal-budget', 'modal-goal', 'modal-account', 'modal-transfer', 'modal-deposit', 'modal-credit-card', 'modal-reset-data']) {
    assert.ok(html.includes(`id="${id}"`), `falta ${id}`);
  }
});

test('botão Novo usa portal responsivo e possui gatilhos para desktop e mobile', () => {
  const html = read('index.html');
  const js = read('js/app.js');
  const css = read('css/style.css');

  const headerEnd = html.indexOf('</header>');
  const menuPosition = html.indexOf('id="quick-create-menu"');
  assert.ok(headerEnd > 0 && menuPosition > headerEnd, 'menu Novo deve ficar fora do header filtrado');
  assert.ok(html.includes('id="quick-create-btn"'), 'falta o gatilho desktop');
  assert.ok(html.includes('id="quick-create-mobile-btn"'), 'falta o gatilho mobile');
  assert.ok(html.includes('id="quick-create-veil"'), 'falta a camada de fechamento do menu');
  assert.ok(js.includes("document.getElementById('quick-create-mobile-btn')"), 'JS deve registrar o gatilho mobile');
  assert.ok(js.includes("menu.classList.toggle('open', open)"), 'JS deve controlar o portal diretamente');
  assert.ok(css.includes('.quick-create-menu.open'), 'CSS deve exibir o portal pelo estado open');
});

test('seletor de período possui painel mobile estruturado e acessível', () => {
  const html = read('index.html');
  const js = read('js/app.js');
  const css = read('css/style.css');

  for (const id of ['period-selector-menu', 'period-menu-title', 'period-menu-close', 'period-current-label', 'period-menu-options']) {
    assert.ok(html.includes(`id="${id}"`), `falta ${id}`);
  }
  assert.ok(html.includes('aria-labelledby="period-menu-title"'));
  assert.ok(js.includes("group: `meses-${y}`"), 'meses devem ser agrupados por ano');
  assert.ok(js.includes("setAttribute('aria-selected', String(isActive))"), 'seleção deve ser comunicada a leitores de tela');
  assert.ok(css.includes('.period-option-section-months .period-option-grid'), 'falta a grade de meses');
});

test('navegação mobile mantém cinco ações e acesso a todas as sete áreas', () => {
  const html = read('index.html');
  const nav = html.match(/<nav class="bottom-nav"[\s\S]*?<\/nav>/)?.[0] || '';
  const directActions = (nav.match(/class="bottom-nav-item/g) || []).length;
  assert.strictEqual(directActions, 5, 'barra inferior deve manter cinco alvos legíveis');

  for (const tab of ['dashboard', 'transactions', 'reports']) {
    assert.ok(nav.includes(`data-tab="${tab}"`), `falta ${tab} na barra inferior`);
  }
  for (const tab of ['cards', 'budgets', 'goals', 'settings']) {
    assert.ok(html.includes(`class="mobile-more-item" data-tab="${tab}"`), `falta ${tab} no menu Mais`);
  }
  assert.ok(html.includes('id="mobile-more-btn"'));
  assert.ok(html.includes('id="mobile-more-menu"'));
});

test('todas as abas usam o sistema visual unificado', () => {
  const html = read('index.html');
  const css = read('css/style.css');
  const js = read('js/app.js');

  assert.ok(css.includes('FINANZEN UI SYSTEM'), 'falta a camada final do sistema visual');
  assert.ok(css.includes('.tab-content.active'), 'falta o ritmo de layout compartilhado entre abas');
  assert.ok(css.includes('.tab-header-card > div'), 'falta a estrutura responsiva dos cabeçalhos de aba');
  assert.ok(css.includes('.filter-actions'), 'falta o padrão de ações dos filtros');

  for (const className of ['tab-intro-title', 'tab-intro-description', 'invoice-kpi-card', 'financial-tip']) {
    assert.ok(html.includes(className), `falta o componente visual ${className}`);
  }
  for (const className of ['budget-card-actions', 'goal-card-actions', 'report-list-row', 'credit-card-actions']) {
    assert.ok(js.includes(className), `falta o componente dinâmico ${className}`);
  }
});

test('configurações usam uma central de blocos que abre um módulo por vez', () => {
  const html = read('index.html');
  const js = read('js/app.js');
  const modules = [
    'settings-account',
    'settings-summary',
    'settings-recovery',
    'settings-export',
    'settings-import',
    'settings-recurring',
    'settings-currency',
    'settings-categories',
    'settings-accounts',
    'settings-open-finance',
    'settings-install'
  ];

  assert.ok(html.includes('id="settings-home"'), 'falta a central de configurações');
  assert.ok(html.includes('id="settings-detail"'), 'falta a área de detalhe das configurações');
  assert.ok(html.includes('id="settings-back-btn"'), 'falta a ação para voltar à central');
  for (const id of modules) {
    assert.ok(html.includes(`id="${id}"`), `falta o módulo ${id}`);
    assert.ok(html.includes(`data-settings-target="${id}"`), `falta o bloco para ${id}`);
    assert.match(html, new RegExp(`id="${id}"[^>]*\\shidden(?:\\s|>)`), `${id} deve iniciar oculto`);
  }
  assert.ok(js.includes('openSettingsModule(moduleId'), 'falta a abertura isolada dos módulos');
  assert.ok(js.includes('showSettingsHome(restoreFocus'), 'falta o retorno à central');
});

test('proteção contra perda de dados possui histórico local e no Supabase', () => {
  const state = read('js/state.js');
  const sync = read('js/sync.js');
  const schema = read('supabase/schema.sql');
  assert.ok(state.includes("RECOVERY_KEY = 'finanzen_recovery_v1'"));
  assert.ok(state.includes('createRecoverySnapshot('));
  assert.ok(state.includes('mergeData(first, second'));
  assert.ok(sync.includes("Cópia da nuvem antes da sincronização"));
  assert.ok(schema.includes('create table if not exists public.finanzen_data_history'));
  assert.ok(schema.includes('trg_archive_finanzen_data'));
});

test('design sólido não inicializa efeitos 3D ou ondas de clique', () => {
  const css = read('css/style.css');
  const js = read('js/app.js');

  assert.ok(css.includes('FINANZEN SOLID'), 'falta a camada visual sólida');
  assert.ok(css.includes('--accent-gradient: #2f80ed'), 'cor principal deve ser sólida');
  assert.ok(!js.includes('setupSpatialInteractions'), 'efeitos espaciais não devem ser inicializados');
  assert.ok(!js.includes('interaction-ripple'), 'efeito de onda não deve ser criado no clique');
  assert.ok(!js.includes('getCardGradient'), 'cartões de crédito não devem depender de gradientes');
});
