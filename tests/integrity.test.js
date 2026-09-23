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
const DYNAMIC_IDS = new Set(['toast-container', 'due-alert-open', 'sync-email', 'sync-password', 'tx-prev-page', 'tx-next-page']);

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

test('sintaxe válida em todos os JS da aplicação', () => {
  const files = ['js/state.js', 'js/charts.js', 'js/app.js', 'js/sync.js', 'js/sync-config.js', 'sw.js'];
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

test('estrutura principal do HTML preservada (6 abas + seções essenciais)', () => {  const html = read('index.html');
  const sections = (html.match(/class="tab-content/g) || []).length;
  assert.strictEqual(sections, 6);
  for (const id of ['tab-dashboard', 'tab-transactions', 'tab-budgets', 'tab-goals', 'tab-reports', 'tab-settings']) {
    assert.ok(html.includes(`id="${id}"`), `falta ${id}`);
  }
  for (const id of ['modal-transaction', 'modal-budget', 'modal-goal', 'modal-account', 'modal-transfer', 'modal-deposit']) {
    assert.ok(html.includes(`id="${id}"`), `falta ${id}`);
  }
});