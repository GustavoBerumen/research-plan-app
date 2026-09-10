'use strict';

// RPA-91. Accepting a suggestion kept two lines in Theory and threw the rest
// away, so a chosen framework could not be read about again — and the moment
// a person wants to re-read what it means is while writing the methodology
// it is supposed to ground. This is the way back: a details block, closed by
// default, filled from the library by the framework's name on the field's
// first line, through GET /api/framework?name=.
//
// It follows the field rather than the panel, so it survives a reload and
// works for a framework typed by hand. What it cannot hold is what the
// library does not: the per-plan rationale and application steps are
// accepted as lost once the panel is dismissed — the cost of the endpoint
// option over persisting a copy, and the one Gus chose.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp, setValue, waitFor } = require('./app-harness');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');

const ENTRY = [
  '### Technology Acceptance Model (TAM) & UTAUT',
  '* **Core Focus:** Models behavioural intent to adopt new technology.',
  '* **UXR Application:** Enterprise rollout and feature adoption studies.',
  '* **Key References:**',
  '  * Davis, F. D. (1989). Perceived usefulness, perceived ease of use, and user acceptance of information technology. *MIS Quarterly*, 13(3), 319–340. https://doi.org/10.2307/249008',
  '  * Venkatesh, V., Morris, M. G., Davis, G. B., & Davis, F. D. (2003). User acceptance of information technology: Toward a unified view. *MIS Quarterly*, 27(3), 425–478.',
].join('\n');
const NAME = 'Technology Acceptance Model (TAM) & UTAUT';

// A lookup that knows one framework, by name, case-insensitively — like the server.
const library = (name) => (name.trim().toLowerCase() === NAME.toLowerCase()
  ? { name: NAME, entry: ENTRY }
  : { status: 404, body: { error: 'No framework in the library is called that' } });

function theory(app) {
  const input = app.document.querySelector('[data-field="theory"]');
  const field = input.closest('.field');
  return {
    input, field,
    about: field.querySelector('.fw-about'),
    button: Array.from(field.querySelectorAll('button')).find((b) => /suggest a/i.test(b.textContent)),
  };
}

function openMethodology(document) {
  const acc = Array.from(document.querySelectorAll('.acc'))
    .find((a) => a.querySelector('.acc-title').textContent.trim() === 'Methodology');
  if (acc.querySelector('.acc-body').hidden) acc.querySelector('.acc-head').click();
}

test('an empty field shows no block and offers a suggestion', async (t) => {
  const app = await bootApp({ frameworkLookup: library });
  t.after(() => app.close());
  const th = theory(app);
  assert.ok(th.about, 'the details element exists');
  assert.equal(th.about.tagName, 'DETAILS', 'GOV.UK details pattern: a native details element');
  assert.equal(th.about.hidden, true);
  assert.equal(th.button.textContent.trim(), 'Suggest a framework');
});

test('typing a known framework fills the block, closed, and changes what the button offers', async (t) => {
  const app = await bootApp({ frameworkLookup: library });
  t.after(() => app.close());
  const { document, window } = app;
  openMethodology(document);
  const th = theory(app);

  setValue(window, th.input, NAME + '\nDavis (1989). Perceived usefulness.');
  await waitFor(() => !th.about.hidden, { message: 'the block never appeared' });

  assert.equal(th.about.open, false, 'closed by default');
  assert.equal(th.about.querySelector('summary').textContent, 'About ' + NAME);
  assert.deepEqual(app.frameworkLookups, [NAME], 'looked up by the first line of the field');
  assert.equal(th.button.textContent.trim(), 'Suggest a different framework',
    'once a framework is there, the button offers another rather than a first');
});

test('the block carries what the library holds: focus, application, and every reference in full', async (t) => {
  const app = await bootApp({ frameworkLookup: library });
  t.after(() => app.close());
  const { document, window } = app;
  openMethodology(document);
  const th = theory(app);
  setValue(window, th.input, NAME);
  await waitFor(() => !th.about.hidden);

  th.about.open = true;
  const pairs = Array.from(th.about.querySelectorAll('.fw-detail > *')).map((n) => [n.tagName, n.textContent]);
  assert.deepEqual(pairs, [
    ['DT', 'Core focus'], ['DD', 'Models behavioural intent to adopt new technology.'],
    ['DT', 'Where it helps'], ['DD', 'Enterprise rollout and feature adoption studies.'],
  ]);
  const refs = Array.from(th.about.querySelectorAll('.fw-about-refs li')).map((li) => li.textContent);
  assert.equal(refs.length, 2, 'every reference, not the condensed first one the field carries');
  assert.match(refs[0], /^Davis, F\. D\. \(1989\)\. Perceived usefulness/, 'in full, verbatim');
  assert.match(refs[1], /^Venkatesh/);
});

test('it survives a reload: a saved draft names the framework, and the block comes back', async (t) => {
  // Restore writes the value and fires no input event, so this is the path
  // that needed its own hook. The acceptance criterion the ticket cares most
  // about: available on returning to a saved draft, not only in the session
  // where the suggestion was made.
  const app = await bootApp({
    frameworkLookup: library,
    draft: { version: 7, fields: { theory: NAME + '\nDavis (1989). Perceived usefulness.' }, lists: {}, tables: {} },
  });
  t.after(() => app.close());
  const th = theory(app);
  await waitFor(() => !th.about.hidden, { message: 'the block did not come back after restore' });
  assert.equal(th.about.querySelector('summary').textContent, 'About ' + NAME);
  assert.equal(th.button.textContent.trim(), 'Suggest a different framework');
});

test('a framework typed by hand that the library does not know is handled without an error', async (t) => {
  const app = await bootApp({ frameworkLookup: library });
  t.after(() => app.close());
  const { document, window } = app;
  openMethodology(document);
  const th = theory(app);

  setValue(window, th.input, 'Phlogiston Theory\nSomeone (1700). A treatise.');
  await waitFor(() => app.frameworkLookups.length === 1, { message: 'the lookup was never attempted' });
  await new Promise((r) => setTimeout(r, 30));

  assert.equal(th.about.hidden, true, 'no block, rather than an empty one');
  assert.equal(th.button.textContent.trim(), 'Suggest a framework');
  assert.deepEqual(app.jsdomErrors, [], 'and nothing thrown');
});

test('clearing the field takes the block away again', async (t) => {
  const app = await bootApp({ frameworkLookup: library });
  t.after(() => app.close());
  const { document, window } = app;
  openMethodology(document);
  const th = theory(app);
  setValue(window, th.input, NAME);
  await waitFor(() => !th.about.hidden);

  setValue(window, th.input, '');
  await waitFor(() => th.about.hidden, { message: 'the block should go with the framework' });
  assert.equal(th.button.textContent.trim(), 'Suggest a framework');
});

test('a different suggestion is still possible once one is chosen', async (t) => {
  // Not a one-way door: the button's label changes, its job does not.
  const app = await bootApp({
    frameworkLookup: library,
    suggestFramework: () => ({ matched: true, name: NAME, rationale: 'Fits.', guidance: ['a', 'b', 'c'], entry: ENTRY }),
  });
  t.after(() => app.close());
  const { document, window } = app;
  openMethodology(document);
  const th = theory(app);
  setValue(window, th.input, NAME);
  await waitFor(() => !th.about.hidden);
  assert.equal(th.button.textContent.trim(), 'Suggest a different framework');

  th.button.click();
  await waitFor(() => !th.field.querySelector('.fw-panel').hidden, { message: 'the panel did not open' });
});

test('accepting a suggestion fills the block at once, without a round trip', async (t) => {
  const app = await bootApp({
    frameworkLookup: library,
    suggestFramework: () => ({ matched: true, name: NAME, rationale: 'Fits.', guidance: ['a', 'b', 'c'], entry: ENTRY }),
  });
  t.after(() => app.close());
  const { document } = app;
  openMethodology(document);
  const th = theory(app);
  th.button.click();
  await waitFor(() => !th.field.querySelector('.fw-panel').hidden);
  Array.from(th.field.querySelectorAll('.fw-panel button')).find((b) => b.textContent.trim() === 'Use this framework').click();

  assert.equal(th.about.hidden, false, 'filled from the entry already in hand');
  assert.equal(th.about.querySelector('summary').textContent, 'About ' + NAME);
  assert.deepEqual(app.frameworkLookups, [], 'no lookup was needed for what the panel already had');
  await new Promise((r) => setTimeout(r, 500));
  assert.deepEqual(app.frameworkLookups, [], 'and none follows the debounce: the block already shows this framework');
});

test('the block does not print', () => {
  // Reference material, like the panel and the header. The field itself
  // carries the name and the citation into print.
  const print = CSS.slice(CSS.indexOf('@media print{'));
  assert.match(print, /\.fw-about,/, 'the details block is in the print hide-list');
});

// RPA-96: completing a request must describe the field as it is now, even
// when writing or a library lookup changed while the suggestion was pending.
const ACTIVITY = 'Activity Theory';
const ACTIVITY_ENTRY = [
  '### Activity Theory',
  '* **Core Focus:** How people use tools together.',
  '* **UXR Application:** Studying collaborative work.',
  '* **Key References:**',
  '  * Example, A. (2026). Synthetic activity reference.',
].join('\n');
const twoFrameworks = (name) => name.trim().toLowerCase() === ACTIVITY.toLowerCase()
  ? { name: ACTIVITY, entry: ACTIVITY_ENTRY } : library(name);
const suggestion = { matched: true, name: NAME, entry: ENTRY, rationale: 'Fits this synthetic plan.',
  guidance: ['Observe shared tools.', 'Ask about collaboration.', 'Compare roles.'] };
const selectedLabel = 'Suggest a different framework';
const emptyLabel = 'Suggest a framework';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function pendingSuggestion(t, value = ACTIVITY, lookup = twoFrameworks) {
  const request = deferred();
  const app = await bootApp({
    frameworkLookup: lookup,
    suggestFramework: () => request.promise,
    draft: { version: 7, fields: { theory: value }, lists: {}, tables: {} },
  });
  t.after(() => app.close());
  openMethodology(app.document);
  const th = theory(app);
  if (value) await waitFor(() => !th.about.hidden);
  th.input.focus();
  th.button.click();
  await waitFor(() => app.frameworkRequests.length === 1);
  assert.equal(th.button.disabled, true);
  return { app, th, request };
}

async function completeSuggestion(ui, outcome) {
  if (outcome === 'success') ui.request.resolve(suggestion);
  else ui.request.reject(new Error('Synthetic suggestion failure'));
  await waitFor(() => !ui.th.button.disabled);
  assert.equal(ui.th.button.classList.contains('loading'), false);
  assert.equal(ui.app.frameworkRequests.length, 1, 'completion does not send another request');
  assert.deepEqual(ui.app.alerts, outcome === 'success' ? []
    : ['Framework suggestion failed: Synthetic suggestion failure']);
  const panel = ui.th.field.querySelector('.fw-panel');
  assert.equal(panel.hidden, outcome !== 'success');
  if (outcome === 'success') panel.querySelector('.eval-x').click();
  assert.equal(panel.hidden, true);
}

for (const outcome of ['success', 'failure']) {
  test(`RPA-96: ${outcome} retains a restored framework and its About block after dismissal`, async (t) => {
    const writing = ACTIVITY + '\nMy own reference and notes.';
    const ui = await pendingSuggestion(t, writing);
    ui.th.about.open = true;
    const aboutBefore = ui.th.about.innerHTML;
    await completeSuggestion(ui, outcome);
    assert.equal(ui.th.input.value, writing);
    assert.equal(ui.th.about.hidden, false);
    assert.equal(ui.th.about.open, true);
    assert.equal(ui.th.about.innerHTML, aboutBefore, 'library information remains unchanged');
    assert.equal(ui.th.about.querySelector('.fw-guidance, .fw-rationale'), null);
    assert.equal(ui.th.button.textContent, selectedLabel);
    assert.equal(ui.app.document.activeElement, ui.th.input, 'completion does not steal editing focus');
  });

  test(`RPA-96: ${outcome} with an empty field still offers a first framework`, async (t) => {
    const ui = await pendingSuggestion(t, '');
    await completeSuggestion(ui, outcome);
    assert.equal(ui.th.input.value, '');
    assert.equal(ui.th.about.hidden, true);
    assert.equal(ui.th.button.textContent, emptyLabel);
  });

  test(`RPA-96: ${outcome} follows a different known framework typed during the request`, async (t) => {
    const ui = await pendingSuggestion(t);
    const writing = NAME.toLowerCase() + '\nKeep my edited reference.';
    setValue(ui.app.window, ui.th.input, writing);
    await waitFor(() => ui.th.about.querySelector('summary').textContent === 'About ' + NAME);
    await completeSuggestion(ui, outcome);
    assert.equal(ui.th.input.value, writing, 'lookup canonicalisation does not rewrite the field');
    assert.equal(ui.th.about.hidden, false);
    assert.equal(ui.th.button.textContent, selectedLabel);
  });

  for (const writing of ['', 'My own unrecognised theory\nKeep this note.']) {
    test(`RPA-96: ${outcome} respects ${writing ? 'unknown writing' : 'clearing'} before its lookup debounce`, async (t) => {
      const ui = await pendingSuggestion(t);
      setValue(ui.app.window, ui.th.input, writing);
      await completeSuggestion(ui, outcome);
      assert.equal(ui.th.input.value, writing);
      assert.equal(ui.th.button.textContent, emptyLabel, 'the previous selection is no longer current');
      await waitFor(() => ui.th.about.hidden);
      assert.equal(ui.th.button.textContent, emptyLabel);
    });
  }

  test(`RPA-96: ${outcome} waits for confirmation of an edited framework with a delayed lookup`, async (t) => {
    const lookup = deferred();
    const ui = await pendingSuggestion(t, ACTIVITY, (name) => name === NAME ? lookup.promise : twoFrameworks(name));
    setValue(ui.app.window, ui.th.input, NAME);
    await waitFor(() => ui.app.frameworkLookups.includes(NAME));
    await completeSuggestion(ui, outcome);
    assert.equal(ui.th.input.value, NAME);
    assert.equal(ui.th.button.textContent, emptyLabel, 'nonempty text alone is not a confirmed framework');
    lookup.resolve(library(NAME));
    await waitFor(() => ui.th.about.querySelector('summary').textContent === 'About ' + NAME);
    assert.equal(ui.th.button.textContent, selectedLabel);
    assert.equal(ui.th.input.value, NAME);
  });
}

for (const lateResult of ['found', 'missing', 'rejected']) {
  test(`RPA-96: an obsolete ${lateResult} lookup cannot replace the retained selection after completion`, async (t) => {
    const lookup = deferred();
    const ui = await pendingSuggestion(t, ACTIVITY, (name) => name === NAME ? lookup.promise : twoFrameworks(name));
    setValue(ui.app.window, ui.th.input, NAME);
    await waitFor(() => ui.app.frameworkLookups.includes(NAME));
    setValue(ui.app.window, ui.th.input, ACTIVITY + '\nRevised notes.');
    await completeSuggestion(ui, 'success');
    if (lateResult === 'rejected') lookup.reject(new Error('Synthetic lookup failure'));
    else lookup.resolve(lateResult === 'found' ? library(NAME) : { status: 404 });
    // Drain the already-resolved mock response without waiting for a new input debounce.
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(ui.th.input.value, ACTIVITY + '\nRevised notes.');
    assert.equal(ui.th.about.hidden, false);
    assert.equal(ui.th.about.querySelector('summary').textContent, 'About ' + ACTIVITY);
    assert.equal(ui.th.button.textContent, selectedLabel);
  });
}

test('RPA-96: a delayed lookup cannot revive a framework cleared during the request', async (t) => {
  const lookup = deferred();
  const ui = await pendingSuggestion(t, ACTIVITY, (name) => name === NAME ? lookup.promise : twoFrameworks(name));
  setValue(ui.app.window, ui.th.input, NAME);
  await waitFor(() => ui.app.frameworkLookups.includes(NAME));
  setValue(ui.app.window, ui.th.input, '');
  await waitFor(() => ui.th.about.hidden);
  await completeSuggestion(ui, 'success');
  lookup.resolve(library(NAME));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(ui.th.input.value, '');
  assert.equal(ui.th.about.hidden, true);
  assert.equal(ui.th.button.textContent, emptyLabel);
});
