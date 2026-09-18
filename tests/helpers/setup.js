/**
 * FinanZen - Ambiente de teste para o estado (sem dependências externas).
 * Carrega js/state.js em escopo global com shims de localStorage, window e document.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class MemoryStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

const storage = new MemoryStorage();

const fakeElement = () => {
  const el = {
    attributes: {},
    style: {},
    href: '',
    click() {},
    setAttribute(k, v) { el.attributes[k] = v; },
    remove() {}
  };
  return el;
};

global.localStorage = storage;
global.window = { financialState: null };
global.document = {
  createElement: () => fakeElement(),
  body: {
    appendChild() {},
    removeChild() {}
  },
  getElementById() {
    return null;
  }
};

const srcPath = path.resolve(__dirname, '..', '..', 'js', 'state.js');
const code = fs.readFileSync(srcPath, 'utf8');
vm.runInThisContext(code + '\n;globalThis.__FinanZenFinancialState = FinancialState;', {
  filename: srcPath
});

module.exports = {
  storage,
  FinancialState: globalThis.__FinanZenFinancialState,
  STORAGE_KEY: 'finanzen_data_v1'
};