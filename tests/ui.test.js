/**
 * FinanZen - smoke tests de interface em um Chrome real, sem dependencias externas.
 *
 * Valida os fluxos que mais costumam quebrar entre desktop e celular:
 * abertura do menu "Novo", abertura/fechamento do modal de lancamento,
 * navegacao principal e ausencia de estouro horizontal.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
].filter(Boolean);

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
};

let server;
let browser;
let profileDirectory;
let cdp;
let appUrl;
let currentMobile = false;
let runtimeErrors = [];

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(error => error ? reject(error) : resolve(port));
    });
  });
}

function startStaticServer() {
  return new Promise((resolve, reject) => {
    const instance = http.createServer((request, response) => {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
      const filename = path.resolve(ROOT, relative);

      if (!filename.startsWith(ROOT + path.sep)) {
        response.writeHead(403).end('Forbidden');
        return;
      }

      fs.readFile(filename, (error, content) => {
        if (error) {
          response.writeHead(error.code === 'ENOENT' ? 404 : 500).end('Not found');
          return;
        }
        response.writeHead(200, {
          'Content-Type': MIME_TYPES[path.extname(filename)] || 'application/octet-stream',
          'Cache-Control': 'no-store'
        });
        response.end(content);
      });
    });
    instance.once('error', reject);
    instance.listen(0, '127.0.0.1', () => resolve(instance));
  });
}

class CdpClient {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.method && this.listeners.has(message.method)) {
        for (const listener of this.listeners.get(message.method)) listener(message.params || {});
      }
      if (!message.id || !this.pending.has(message.id)) return;
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result || {});
    });
  }

  on(method, listener) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(listener);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text || 'Falha ao avaliar codigo no navegador');
    }
    return result.result?.value;
  }
}

async function waitForJsonList(port) {
  const endpoint = `http://127.0.0.1:${port}/json/list`;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(endpoint);
      const targets = await response.json();
      const page = targets.find(target => target.type === 'page');
      if (page?.webSocketDebuggerUrl) return page;
    } catch (_) {
      // O Chrome ainda esta iniciando.
    }
    await delay(100);
  }
  throw new Error('Chrome nao disponibilizou o protocolo de testes');
}

async function waitForApp() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const ready = await cdp.evaluate(`Boolean(
      document.readyState === 'complete' &&
      document.getElementById('quick-create-btn') &&
      document.getElementById('modal-transaction') &&
      window.financialState
    )`);
    if (ready) {
      await delay(250);
      return;
    }
    await delay(100);
  }
  throw new Error('A interface do FinanZen nao terminou de carregar');
}

async function tap(selector) {
  const target = await cdp.evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(x, y);
    return {
      x,
      y,
      width: rect.width,
      height: rect.height,
      hitMatches: Boolean(hit && (hit === element || element.contains(hit)))
    };
  })()`);
  assert.ok(target, `Elemento nao encontrado: ${selector}`);
  assert.ok(target.width >= 40 && target.height >= 40, `${selector} deve ter alvo de toque minimo de 40px`);
  assert.ok(target.hitMatches, `${selector} esta coberto por outro elemento`);

  if (currentMobile) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: target.x, y: target.y, radiusX: 2, radiusY: 2, force: 1 }]
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: target.x, y: target.y, button: 'left', clickCount: 1 });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: target.x, y: target.y, button: 'left', clickCount: 1 });
  }
  await delay(360);
}

async function openViewport({ width, height, mobile }) {
  currentMobile = mobile;
  runtimeErrors = [];
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile,
    screenWidth: width,
    screenHeight: height
  });
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: mobile ? 5 : 1 });
  await cdp.send('Page.navigate', { url: `${appUrl}?qa=${Date.now()}` });
  await waitForApp();
}

async function assertQuickCreateFlow(viewport) {
  await openViewport(viewport);

  const layout = await cdp.evaluate(`({
    viewport: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth
  })`);
  assert.ok(layout.scrollWidth <= layout.viewport + 1, `pagina com estouro horizontal: ${JSON.stringify(layout)}`);
  assert.ok(layout.bodyScrollWidth <= layout.viewport + 1, `body com estouro horizontal: ${JSON.stringify(layout)}`);

  await tap(viewport.mobile ? '#quick-create-mobile-btn' : '#quick-create-btn');
  const opened = await cdp.evaluate(`(() => {
    const root = document.getElementById('quick-create');
    const menu = document.getElementById('quick-create-menu');
    const rect = menu.getBoundingClientRect();
    const style = getComputedStyle(menu);
    return {
      open: root.classList.contains('open'),
      expanded: document.getElementById('quick-create-btn').getAttribute('aria-expanded'),
      visible: style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0,
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
      withinViewport: rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight,
      rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }
    };
  })()`);
  assert.equal(opened.open, true, 'o botao Novo deve abrir o menu');
  assert.equal(opened.expanded, 'true');
  assert.equal(opened.visible, true, `o menu Novo deve estar visivel: ${JSON.stringify(opened)}`);
  assert.equal(opened.withinViewport, true, `menu Novo fora da tela: ${JSON.stringify(opened.rect)}`);

  await tap('.quick-create-expense');
  const modalState = await cdp.evaluate(`(() => {
    const modal = document.getElementById('modal-transaction');
    const dialog = modal.querySelector('.modal-dialog');
    const rect = dialog.getBoundingClientRect();
    return {
      active: modal.classList.contains('active'),
      title: document.getElementById('tx-modal-title').textContent,
      type: document.getElementById('tx-toggle-expense').classList.contains('active'),
      withinViewport: rect.left >= -1 && rect.right <= innerWidth + 1 && rect.top >= -1 && rect.bottom <= innerHeight + 1,
      rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, viewportHeight: innerHeight }
    };
  })()`);
  assert.equal(modalState.active, true, 'Despesa deve abrir o modal de transacao');
  assert.match(modalState.title, /Nova Transa/);
  assert.equal(modalState.type, true);
  assert.equal(modalState.withinViewport, true, `modal deve permanecer dentro da viewport: ${JSON.stringify(modalState.rect)}`);

  await tap('#modal-transaction .modal-close-btn');
  assert.equal(await cdp.evaluate(`document.getElementById('modal-transaction').classList.contains('active')`), false);
}

before(async () => {
  const chrome = CHROME_CANDIDATES.find(candidate => fs.existsSync(candidate));
  assert.ok(chrome, 'Chrome ou Edge precisa estar instalado para os testes de interface');

  server = await startStaticServer();
  const address = server.address();
  appUrl = `http://127.0.0.1:${address.port}/`;

  const debugPort = await getFreePort();
  profileDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'finanzen-ui-'));
  browser = childProcess.spawn(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--disable-gpu-sandbox',
    '--no-sandbox',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-default-apps',
    '--host-resolver-rules=MAP * 127.0.0.1, EXCLUDE 127.0.0.1',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profileDirectory}`,
    'about:blank'
  ], { stdio: 'ignore', windowsHide: true });

  const page = await waitForJsonList(debugPort);
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  cdp = new CdpClient(socket);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  cdp.on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
    runtimeErrors.push(exceptionDetails?.exception?.description || exceptionDetails?.text || 'Erro desconhecido');
  });
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `globalThis.Chart = class ChartStub {
      constructor(_target, config = {}) { this.data = config.data || { labels: [], datasets: [] }; }
      update() {}
      destroy() {}
      resize() {}
    };`
  });
}, { timeout: 20000 });

after(async () => {
  try {
    cdp?.socket?.close();
    if (browser && browser.exitCode === null) {
      const exited = new Promise(resolve => browser.once('exit', resolve));
      browser.kill();
      await Promise.race([exited, delay(1500)]);
    }
    server?.closeAllConnections?.();
    await new Promise(resolve => server?.close(resolve));
  } finally {
    if (profileDirectory) {
      try {
        fs.rmSync(profileDirectory, { recursive: true, force: true });
      } catch (_) {
        // O Chrome no Windows pode liberar os arquivos alguns instantes depois.
      }
    }
  }
}, { timeout: 10000 });

test('fluxo Novo funciona no desktop', async () => {
  await assertQuickCreateFlow({ width: 1440, height: 900, mobile: false });
  assert.deepEqual(runtimeErrors, []);
});

test('fluxo Novo funciona no mobile', async () => {
  await assertQuickCreateFlow({ width: 390, height: 844, mobile: true });
  assert.deepEqual(runtimeErrors, []);
});

test('seletor de período mobile abre organizado e aplica a escolha', async () => {
  await openViewport({ width: 390, height: 844, mobile: true });
  await tap('#period-selector-btn');

  const opened = await cdp.evaluate(`(() => {
    const menu = document.getElementById('period-selector-menu');
    const rect = menu.getBoundingClientRect();
    const monthsGrid = menu.querySelector('.period-option-section-months .period-option-grid');
    return {
      open: document.body.classList.contains('period-menu-open'),
      hidden: menu.getAttribute('aria-hidden'),
      visible: getComputedStyle(menu).display !== 'none',
      withinViewport: rect.left >= -1 && rect.right <= innerWidth + 1 && rect.top >= -1 && rect.bottom <= innerHeight + 1,
      groupCount: menu.querySelectorAll('.period-option-section').length,
      activeCount: menu.querySelectorAll('.period-menu-item.active').length,
      monthColumns: getComputedStyle(monthsGrid).gridTemplateColumns.split(' ').length
    };
  })()`);
  assert.equal(opened.open, true);
  assert.equal(opened.hidden, 'false');
  assert.equal(opened.visible, true);
  assert.equal(opened.withinViewport, true);
  assert.ok(opened.groupCount >= 4, 'períodos devem estar separados por grupos');
  assert.equal(opened.activeCount, 1, 'somente o período atual deve estar destacado');
  assert.equal(opened.monthColumns, 2, 'meses devem usar duas colunas no celular');

  await cdp.evaluate(`document.querySelector('.period-menu-item[data-value="all"]').scrollIntoView({ block: 'center' })`);
  await delay(180);
  await tap('.period-menu-item[data-value="all"]');
  const selected = await cdp.evaluate(`({
    value: document.getElementById('global-period-select').value,
    appValue: window.app?.selectedPeriod,
    label: document.getElementById('period-selector-label').textContent,
    closed: !document.body.classList.contains('period-menu-open')
  })`);
  assert.equal(selected.value, 'all');
  assert.equal(selected.label, 'Todos os períodos');
  assert.equal(selected.closed, true);

  await tap('#period-selector-btn');
  await tap('#period-menu-close');
  assert.equal(await cdp.evaluate(`document.getElementById('period-selector-menu').getAttribute('aria-hidden')`), 'true');
  assert.deepEqual(runtimeErrors, []);
});

test('navegacao mobile abre todas as areas principais', async () => {
  await openViewport({ width: 390, height: 844, mobile: true });
  for (const tab of ['dashboard', 'transactions', 'reports']) {
    await tap(`.bottom-nav-item[data-tab="${tab}"]`);
    const result = await cdp.evaluate(`({
      visible: document.getElementById('tab-${tab}').classList.contains('active'),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    })`);
    assert.equal(result.visible, true, `aba ${tab} deve ficar ativa`);
    assert.equal(result.overflow, false, `aba ${tab} nao deve criar rolagem horizontal`);
  }

  for (const tab of ['cards', 'budgets', 'goals', 'settings']) {
    await tap('#mobile-more-btn');
    assert.equal(await cdp.evaluate(`document.getElementById('mobile-more-menu').classList.contains('open')`), true);
    await tap(`.mobile-more-item[data-tab="${tab}"]`);
    const result = await cdp.evaluate(`({
      visible: document.getElementById('tab-${tab}').classList.contains('active'),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      moreActive: document.getElementById('mobile-more-btn').classList.contains('active')
    })`);
    assert.equal(result.visible, true, `aba ${tab} deve ficar ativa`);
    assert.equal(result.overflow, false, `aba ${tab} nao deve criar rolagem horizontal`);
    assert.equal(result.moreActive, true, `Mais deve representar a aba ${tab}`);
  }
  assert.deepEqual(runtimeErrors, []);
});

test('todos os atalhos do Novo mobile abrem o modulo correto', async () => {
  await openViewport({ width: 390, height: 844, mobile: true });
  const actions = [
    ['.quick-create-income', 'modal-transaction'],
    ['.quick-create-expense', 'modal-transaction'],
    ['.quick-create-transfer', 'modal-transfer'],
    ['[data-create-action="account"]', 'modal-account'],
    ['[data-create-action="budget"]', 'modal-budget'],
    ['[data-create-action="goal"]', 'modal-goal']
  ];

  for (const [selector, modalId] of actions) {
    await tap('#quick-create-mobile-btn');
    await tap(`#quick-create-menu ${selector}`);
    assert.equal(
      await cdp.evaluate(`document.getElementById('${modalId}').classList.contains('active')`),
      true,
      `${selector} deve abrir ${modalId}`
    );
    await tap(`#${modalId} .modal-close-btn`);
  }
  assert.deepEqual(runtimeErrors, []);
});

test('cadastro de despesa funciona pela interface mobile', async () => {
  await openViewport({ width: 390, height: 844, mobile: true });
  const initialCount = await cdp.evaluate('window.financialState.data.transactions.length');
  await tap('#quick-create-mobile-btn');
  await tap('#quick-create-menu .quick-create-expense');
  await cdp.evaluate(`(() => {
    document.getElementById('tx-desc-input').value = 'Teste automatizado mobile';
    document.getElementById('tx-amount-input').value = '12.34';
    document.getElementById('tx-date-input').value = '2026-10-21';
    document.getElementById('tx-form').requestSubmit();
  })()`);
  await delay(450);
  const saved = await cdp.evaluate(`({
    count: window.financialState.data.transactions.length,
    modalOpen: document.getElementById('modal-transaction').classList.contains('active'),
    found: window.financialState.data.transactions.some(tx => tx.description === 'Teste automatizado mobile' && tx.amount === 12.34)
  })`);
  assert.equal(saved.count, initialCount + 1);
  assert.equal(saved.modalOpen, false);
  assert.equal(saved.found, true);
  assert.deepEqual(runtimeErrors, []);
});

test('layout nao estoura em larguras critica de celular, tablet e desktop', async () => {
  const viewports = [
    { width: 320, height: 700, mobile: true },
    { width: 768, height: 900, mobile: false },
    { width: 1440, height: 900, mobile: false }
  ];

  for (const viewport of viewports) {
    await openViewport(viewport);
    const layout = await cdp.evaluate(`({
      width: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      headerWidth: document.querySelector('.top-header').getBoundingClientRect().width,
      offenders: [...document.querySelectorAll('body *')]
        .map(element => {
          const rect = element.getBoundingClientRect();
          return { tag: element.tagName, id: element.id, className: String(element.className || ''), left: rect.left, right: rect.right, width: rect.width };
        })
        .filter(item => item.width > innerWidth + 1 || item.right > innerWidth + 1 || item.left < -1)
        .sort((a, b) => b.right - a.right)
        .slice(0, 8)
    })`);
    assert.ok(layout.documentWidth <= layout.width + 1, `documento estourou em ${viewport.width}px: ${JSON.stringify(layout)}`);
    assert.ok(layout.bodyWidth <= layout.width + 1, `body estourou em ${viewport.width}px: ${JSON.stringify(layout)}`);
    assert.ok(layout.headerWidth <= layout.width + 1, `cabecalho estourou em ${viewport.width}px: ${JSON.stringify(layout)}`);
  }
});

test('design sólido permanece legível nos temas escuro e claro', async () => {
  await openViewport({ width: 390, height: 844, mobile: true });

  const darkTheme = await cdp.evaluate(`(() => {
    const card = document.querySelector('.metric-card');
    const header = document.querySelector('.top-header');
    const cardStyle = getComputedStyle(card);
    const headerStyle = getComputedStyle(header);
    return {
      light: document.body.classList.contains('light-theme'),
      bodyImage: getComputedStyle(document.body).backgroundImage,
      cardImage: cardStyle.backgroundImage,
      cardBackdrop: cardStyle.backdropFilter || cardStyle.webkitBackdropFilter,
      cardTransform: cardStyle.transform,
      headerBackdrop: headerStyle.backdropFilter || headerStyle.webkitBackdropFilter
    };
  })()`);
  assert.equal(darkTheme.light, false);
  assert.equal(darkTheme.bodyImage, 'none');
  assert.equal(darkTheme.cardImage, 'none');
  assert.equal(darkTheme.cardBackdrop, 'none');
  assert.equal(darkTheme.cardTransform, 'none');
  assert.equal(darkTheme.headerBackdrop, 'none');

  await tap('#theme-toggle-mobile-btn');
  const lightTheme = await cdp.evaluate(`(() => {
    const cardStyle = getComputedStyle(document.querySelector('.metric-card'));
    return {
      light: document.body.classList.contains('light-theme'),
      cardBackground: cardStyle.backgroundColor,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    };
  })()`);
  assert.equal(lightTheme.light, true);
  assert.equal(lightTheme.cardBackground, 'rgb(255, 255, 255)');
  assert.equal(lightTheme.overflow, false);

  await tap('#theme-toggle-mobile-btn');
  assert.equal(await cdp.evaluate(`document.body.classList.contains('light-theme')`), false);
  assert.deepEqual(runtimeErrors, []);
});

test('gera capturas de QA quando solicitado', { skip: !process.env.FINANZEN_SCREENSHOT_DIR }, async () => {
  const directory = process.env.FINANZEN_SCREENSHOT_DIR;
  fs.mkdirSync(directory, { recursive: true });

  await openViewport({ width: 390, height: 844, mobile: true });
  let capture = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(directory, 'finanzen-mobile-cdp.png'), Buffer.from(capture.data, 'base64'));

  await tap('#period-selector-btn');
  capture = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(directory, 'finanzen-mobile-period-cdp.png'), Buffer.from(capture.data, 'base64'));

  await openViewport({ width: 1440, height: 900, mobile: false });
  capture = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(directory, 'finanzen-desktop-cdp.png'), Buffer.from(capture.data, 'base64'));
});
