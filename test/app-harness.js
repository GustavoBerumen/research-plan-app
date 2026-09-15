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

// Fixture helpers for tests that need a template slightly different from the
// live one. They used to patch it with an exact string like
// "Methods (list):", which broke the moment anything was added to that line —
// adding key= to every field broke two of them at once. Matching on the
// field's declared key survives label, flag and hint edits.
function fieldLinePattern(key) {
  return new RegExp('^([^\\n]*\\()([^)]*\\bkey=' + key + ')(\\)[^\\n]*)$', 'm');
}

// Adds a flag ("eval", "optional", ...) to one field's spec.
function withFieldFlag(template, key, flag) {
  const pattern = fieldLinePattern(key);
  if (!pattern.test(template)) {
    throw new Error(`No field declares key=${key}, so the fixture cannot add "${flag}" to it`);
  }
  return template.replace(pattern, (whole, open, spec, close) => open + spec + ', ' + flag + close);
}

// Brings a dormant (commented-out) field back, with its Hint and Guidance
// lines, however many follow it.
function withFieldUncommented(template, key) {
  // The following Hint/Guidance lines must stay adjacent on Windows too.
  template = template.replace(/\r\n?/g, '\n');
  const pattern = new RegExp(
    '^<!--\\s*([^\\n]*\\bkey=' + key + '[^\\n]*?)\\s*-->$'
      + '((?:\\n<!--\\s*(?:Hint|Guidance):[^\\n]*?\\s*-->$)*)',
    'm'
  );
  if (!pattern.test(template)) {
    throw new Error(`No dormant field declares key=${key}, so the fixture cannot enable it`);
  }
  return template.replace(pattern, (whole, field, notes) =>
    field + notes.replace(/\n<!--\s*((?:Hint|Guidance):[^\n]*?)\s*-->$/gm, '\n  $1'));
}

function response(body, status = 200) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
    json: async () => JSON.parse(text),
  };
}

// Timeouts here are ceilings, not budgets: waitFor returns the moment the
// predicate holds, so a generous number costs nothing on a healthy run and
// only changes how long a genuinely broken one takes to report. They are set
// well above what the app needs because the suite runs its files in parallel,
// and under that load a wait that normally settles in ~200ms was seen taking
// over 2s — enough to fail intermittently against the 1500ms these used to
// carry. Nothing here asserts a performance budget; if one ever should, it
// wants its own explicit assertion rather than a tight waitFor.
async function waitFor(predicate, options = {}) {
  const timeout = options.timeout || 5000;
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
  const frameworkRequests = [];
  const frameworkLookups = [];
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
  if (typeof options.textareaScrollHeight === 'function') {
    Object.defineProperty(window.HTMLTextAreaElement.prototype, 'scrollHeight', {
      configurable: true,
      get() {
        return options.textareaScrollHeight(this);
      },
    });
  }

  if (options.draft) {
    // A draft from before RPA-99 has no email address; one is put in, the
    // way the person would have given it, unless the test says email: false
    // to meet the page that asks, or names the address itself.
    let draft = options.draft;
    const asText = typeof draft === 'string';
    if (options.email !== false) {
      let parsed = draft;
      if (asText) { try { parsed = JSON.parse(draft); } catch (e) { parsed = null; } }
      if (parsed && typeof parsed === 'object' && parsed.fields && typeof parsed.fields === 'object' && !parsed.fields.emailAddress) {
        parsed = { ...parsed, fields: { ...parsed.fields, emailAddress: options.email || 'name@example.com' } };
        draft = asText ? JSON.stringify(parsed) : parsed;
      }
    }
    window.localStorage.setItem(
      DRAFT_KEY,
      typeof draft === 'string' ? draft : JSON.stringify(draft)
    );
  }
  for (const [key, value] of Object.entries(options.storage || {})) window.localStorage.setItem(key, value);

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
      if (options.configResponse) return options.configResponse();
      return response({ pilotMode: false, capabilities: { feedback: true, calibration: true, uploads: true, addFramework: true, jira: !!options.jiraEnabled, googleDrive: false }, jiraEnabled: !!options.jiraEnabled });
    }

    if (url.origin === window.location.origin && url.pathname === '/api/submissions' && options.submit) {
      return options.submit(JSON.parse(init.body), init);
    }

    if (url.origin === window.location.origin && url.pathname === '/api/jira/search') {
      if (!options.jiraSearch) throw new Error('No Jira search mock was configured');
      return options.jiraSearch(url.searchParams.get('q'));
    }

    if (url.origin === window.location.origin && url.pathname === '/api/evaluate') {
      const request = {
        // Record cancellation without settling the mock automatically: tests
        // can still deliver a late response to verify obsolete-result guards.
        signal: init.signal,
        method: init.method || 'GET',
        headers: init.headers || {},
        body: JSON.parse(init.body || '{}'),
      };
      evaluationRequests.push(request);
      if (!options.evaluate) throw new Error('No evaluation mock was configured');
      return response(await options.evaluate(request.body, request));
    }

    // RPA-91: the library lookup the details block reads. Mocked like the
    // suggestion — a test supplies the entry it wants back, or a status.
    if (url.origin === window.location.origin && url.pathname === '/api/framework') {
      const name = url.searchParams.get('name') || '';
      frameworkLookups.push(name);
      if (!options.frameworkLookup) throw new Error('No framework-lookup mock was configured');
      const result = await options.frameworkLookup(name);
      if (result && typeof result.status === 'number') return response(result.body || {}, result.status);
      return response(result);
    }
    if (url.origin === window.location.origin && url.pathname === '/api/suggest-framework') {
      const request = {
        method: init.method || 'GET',
        headers: init.headers || {},
        body: JSON.parse(init.body || '{}'),
      };
      frameworkRequests.push(request);
      if (!options.suggestFramework) throw new Error('No framework-suggestion mock was configured');
      return response(await options.suggestFramework(request.body, request));
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
    const script = fs.readFileSync(scriptPath, 'utf8');
    // Test-only instrumentation for callbacks that cannot be reached after a page is removed.
    window.eval((options.transformScript ? options.transformScript(source, script) : script) + '\n//# sourceURL=' + source);
    executedScripts.push(source);
  });

  if (dispatchDOMContentLoaded) {
    document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  }

  await waitFor(
    // .title-inp, not [data-field="title"]: field keys are derived from
    // labels, so keying this on one means a copy edit in the template stops
    // every booting test with a timeout instead of a useful failure.
    // A link nobody recognises leaves nothing of the plan in the page, so
    // that counts as finished rendering too (RPA-137).
    () => document.querySelector('.title-inp') || document.querySelector('.doc-error') || document.querySelector('.dead-link:not([hidden])'),
    { message: 'The real application did not finish rendering' }
  );
  const loadError = document.querySelector('.doc-error');
  if (loadError) throw new Error(loadError.textContent);

  // A first visit opens on the start page (RPA-81). A person presses Start
  // now, and so does every test, unless it asks to stay there (start: true).
  if (options.start !== true) {
    const start = document.querySelector('.start-step');
    if (start && !start.hidden) start.querySelector('.start-btn').click();
  }
  // The email address stands in front of the plan (RPA-99). A person gives
  // one and continues, and so does every test, unless it asks to stay on
  // that page (email: false) or names the address to give.
  if (options.email !== false) {
    const gate = document.querySelector('.email-step');
    if (gate && !gate.hidden) {
      setValue(window, gate.querySelector('[data-field="emailAddress"]'), options.email || 'name@example.com');
      gate.querySelector('.step-continue').click();
    }
  }

  return {
    alerts,
    document,
    dom,
    evaluationRequests,
    frameworkRequests,
    frameworkLookups,
    executedScripts,
    jsdomErrors,
    scriptSources,
    window,
    close() {
      window.close();
    },
  };
}

// Fills every required control of one step (RPA-100): the cheapest true
// answer per control type, so a section reads as complete and the one after
// it unlocks. Optional fields and the Additional information hatch are
// skipped, because completeness skips them too.
function completeStep(app, stepEl) {
  const { window } = app;
  const groups = stepEl.classList.contains('doc-header')
    ? Array.from(stepEl.querySelectorAll('.title-field, .mf')).filter((mf) => !mf.querySelector('.fopt') && !mf.querySelector('[data-field="lastUpdated"]'))
    : stepEl.classList.contains('review-step')
      ? Array.from(stepEl.querySelectorAll('.review-signoffs .field'))
      : Array.from(stepEl.querySelectorAll('.acc-body .field:not(.field-custom)')).filter((f) => !f.querySelector('.fopt'));
  groups.forEach((g) => {
    const box = g.querySelector('input[type=checkbox]');
    if (box) { if (!box.checked) box.click(); return; }
    const radio = g.querySelector('input[type=radio]');
    if (radio) { radio.click(); return; }
    // Steps other than the current one are hidden by design, so hidden is no
    // reason to skip. A date group is answered through its native date
    // input, never by typing into a day segment.
    const pick = (sel) => Array.from(g.querySelectorAll(sel)).find((c) => !c.disabled);
    const ctl = pick('input[type=date][data-field]') || pick('input[type=email][data-field]') || pick('textarea') || pick('input[type=text][data-field]') || pick('input[type=text]') || pick('input:not([type]):not([type=hidden])') || pick('select');
    if (!ctl) return;
    if (ctl.tagName === 'SELECT') {
      if (ctl.options.length > 1) { ctl.value = ctl.options[1].value; ctl.dispatchEvent(new window.Event('change', { bubbles: true })); ctl.dispatchEvent(new window.Event('input', { bubbles: true })); }
      return;
    }
    // An email address is judged by shape (RPA-99), so the answer has one.
    setValue(window, ctl, ctl.type === 'date' ? '2026-10-01' : ctl.type === 'email' ? 'name@example.com' : 'Filled.');
  });
}

// Presses Save and continue through the step's pages (RPA-108) and, when the
// section is complete, Continue on the check page that follows (RPA-103), so
// "moves on" keeps its meaning. Stops where the person would: on errors, on
// the check page, or on the step it returned to.
function saveAndContinue(stepEl) {
  for (let presses = 0; presses < 20; presses++) {
    stepEl.querySelector('.step-continue').click();
    const summary = stepEl.querySelector('.error-summary');
    if (summary && !summary.hidden) return;
    const check = Array.from(stepEl.children).find((c) => c.classList.contains('check-answers'));
    if (check && !check.hidden) { check.querySelector('.check-continue').click(); return; }
    if (stepEl.hidden) return;
  }
}

// Presses Save and continue through the step's pages until the check page
// shows (RPA-103, RPA-108), or until a page refuses with errors.
function toCheckPage(stepEl) {
  for (let presses = 0; presses < 20; presses++) {
    if (stepEl.classList.contains('step-checking')) return;
    stepEl.querySelector('.step-continue').click();
    const summary = stepEl.querySelector('.error-summary');
    if (summary && !summary.hidden) return;
    if (stepEl.hidden) return;
  }
}

module.exports = {
  DRAFT_KEY,
  saveAndContinue,
  toCheckPage,
  withFieldFlag,
  withFieldUncommented,
  bootApp,
  listInputs,
  setValue,
  waitFor, completeStep };
