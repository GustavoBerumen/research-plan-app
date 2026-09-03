'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const INDEX_HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const DRAFT_KEY = 'research-plan-app:draft';
const REAL_TEXT_ASSETS = new Set([
  'research-plan-template.md',
  'research-plan-rubric.md',
  'research-methods.md',
]);

function response(body, status = 200) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
    json: async () => JSON.parse(text),
  };
}

async function waitFor(predicate, options = {}) {
  const timeout = options.timeout || 2000;
  const interval = options.interval || 5;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    const value = predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(options.message || 'Timed out waiting for the application');
}

function setValue(window, input, value) {
  input.value = value;
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  input.dispatchEvent(new window.Event('change', { bubbles: true }));
}

function listInputs(document, key) {
  return Array.from(document.querySelectorAll(
    '.list-rows[data-list-key="' + key + '"] > .list-row > .list-input'
  ));
}

async function bootApp(options = {}) {
  const virtualConsole = new VirtualConsole();
  const jsdomErrors = [];
  const alerts = [];
  const evaluationRequests = [];
  virtualConsole.on('jsdomError', (error) => jsdomErrors.push(error));

  const dom = new JSDOM(INDEX_HTML, {
    pretendToBeVisual: true,
    runScripts: 'outside-only',
    url: options.url || 'https://research-plan.test/',
    virtualConsole,
  });
  const { window } = dom;
  const { document } = window;
  const dispatchDOMContentLoaded = document.readyState !== 'loading';

  window.alert = (message) => alerts.push(String(message));
  window.confirm = options.confirm || (() => true);
  window.print = () => {};
  if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = () => {};
  }

  if (options.draft) {
    window.localStorage.setItem(
      DRAFT_KEY,
      typeof options.draft === 'string' ? options.draft : JSON.stringify(options.draft)
    );
  }

  window.fetch = async (input, init = {}) => {
    const rawUrl = typeof input === 'string' ? input : input.url;
    const url = new URL(rawUrl, window.location.href);
    const assetName = url.pathname.replace(/^\//, '');

    if (url.origin === window.location.origin && REAL_TEXT_ASSETS.has(assetName)) {
      const override = options.textAssets && options.textAssets[assetName];
      return response(override === undefined
        ? fs.readFileSync(path.join(ROOT, assetName), 'utf8')
        : override);
    }

    if (url.origin === window.location.origin && url.pathname === '/api/config') {
      return response({ googleClientId: '', googleApiKey: '', jiraEnabled: false });
    }

    if (url.origin === window.location.origin && url.pathname === '/api/evaluate') {
      const request = {
        method: init.method || 'GET',
        headers: init.headers || {},
        body: JSON.parse(init.body || '{}'),
      };
      evaluationRequests.push(request);
      if (!options.evaluate) throw new Error('No evaluation mock was configured');
      return response(await options.evaluate(request.body, request));
    }

    throw new Error('Unexpected network request in characterization test: ' + url.href);
  };

  const scriptSources = Array.from(document.querySelectorAll('script[src]'))
    .map((script) => script.getAttribute('src'));
  const executedScripts = [];
  scriptSources.forEach((source) => {
    if (/^https?:\/\//i.test(source)) return;
    const scriptPath = path.resolve(ROOT, source);
    if (!scriptPath.startsWith(ROOT + path.sep)) {
      throw new Error('Refusing to load script outside the repository: ' + source);
    }
    window.eval(fs.readFileSync(scriptPath, 'utf8') + '\n//# sourceURL=' + source);
    executedScripts.push(source);
  });

  if (dispatchDOMContentLoaded) {
    document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  }

  await waitFor(
    () => document.querySelector('[data-field="title"]') || document.querySelector('.doc-error'),
    { message: 'The real application did not finish rendering' }
  );
  const loadError = document.querySelector('.doc-error');
  if (loadError) throw new Error(loadError.textContent);

  return {
    alerts,
    document,
    dom,
    evaluationRequests,
    executedScripts,
    jsdomErrors,
    scriptSources,
    window,
    close() {
      window.close();
    },
  };
}

module.exports = {
  DRAFT_KEY,
  bootApp,
  listInputs,
  setValue,
  waitFor,
};
