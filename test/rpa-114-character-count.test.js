'use strict';

// RPA-114, in the design system's own words and place (Gus's review, 14
// September): under the box, "You have 30 words remaining", counting down
// as the person types. Advisory all the way: past the top it turns to
// description, "You've written about 35 words", never "5 words too many";
// hint-grey, never red; never a limit. As in the component, the visible
// message is aria-hidden and the field is described by it, while a visually
// hidden polite live region repeats it on a one-second debounce. Two tiers:
// 60 words for a long answer, 30 for a short one. Clear Form resets it at
// once (Max, #74).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp, setValue, waitFor } = require('./app-harness');

const ROOT = path.join(__dirname, '..');
const CSS = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
const TEMPLATE = fs.readFileSync(path.join(ROOT, 'research-plan-template.md'), 'utf8');
const wrapOf = (d, key) => d.querySelector('[data-field="' + key + '"]').closest('.field');
const countOf = (d, key) => wrapOf(d, key).querySelector('.word-count');
const spokenOf = (d, key) => wrapOf(d, key).querySelector('.word-count-status');
const words = (n) => Array.from({ length: n }, (_, i) => 'word' + i).join(' ');

test('every free-text field says what remains, from the start, right under its box', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const d = app.document;
  const tiers = { background: 60, problemStatement: 60, comments: 60, goal: 30, objective: 30 };
  for (const [key, n] of Object.entries(tiers)) {
    const ta = d.querySelector('[data-field="' + key + '"]');
    assert.equal(countOf(d, key).textContent, 'You have ' + n + ' words remaining', key);
    assert.ok(ta.compareDocumentPosition(countOf(d, key)) & 4, key + ': below the box, as in the component');
    assert.equal(countOf(d, key).getAttribute('aria-hidden'), 'true', key + ': the visible message is for sighted people');
    assert.ok((ta.getAttribute('aria-describedby') || '').split(/\s+/).includes(countOf(d, key).id), key + ': the field is described by it');
    assert.equal(spokenOf(d, key).getAttribute('aria-live'), 'polite', key);
  }
  assert.equal(d.querySelectorAll('.word-count').length, 5, 'and nowhere else');
  assert.equal(d.querySelector('[data-field="theory"]'), null, 'Theory is dormant (RPA-117)');
  assert.equal(d.querySelector('[data-field="hypothesis"]'), null, 'and so is Hypothesis');
  assert.deepEqual(app.jsdomErrors, []);
});

test('it counts down as you type, reaches zero without complaint, and past the top describes rather than judges', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  const ta = d.querySelector('[data-field="goal"]');   // 30
  setValue(window, ta, words(10));
  assert.equal(countOf(d, 'goal').textContent, 'You have 20 words remaining', 'visible at once, as in the component');
  setValue(window, ta, words(29));
  assert.equal(countOf(d, 'goal').textContent, 'You have 1 word remaining');
  setValue(window, ta, words(30));
  assert.equal(countOf(d, 'goal').textContent, 'You have 0 words remaining');
  setValue(window, ta, words(37));
  assert.equal(countOf(d, 'goal').textContent, "You've written about 35 words");
  assert.doesNotMatch(countOf(d, 'goal').textContent, /too many|over|limit/i, 'description, not judgement');
  assert.equal(ta.value.split(/\s+/).length, 37, 'never a limit');
});

test('a screen reader hears it on arrival and on a one-second debounce, not per keystroke', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  const ta = d.querySelector('[data-field="goal"]');
  assert.equal(spokenOf(d, 'goal').textContent, 'You have 30 words remaining', 'the live region starts with the message');
  setValue(window, ta, words(10));
  assert.equal(spokenOf(d, 'goal').textContent, 'You have 30 words remaining', 'not on the keystroke');
  await waitFor(() => spokenOf(d, 'goal').textContent === 'You have 20 words remaining', { message: 'after the debounce' });
});

test('it is a hint, never an error: hint-grey, no error class, the field never marked; not printed', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  setValue(window, d.querySelector('[data-field="goal"]'), words(60));
  assert.ok(!Array.from(countOf(d, 'goal').classList).some((c) => /error|over|invalid|warn/i.test(c)));
  assert.equal(wrapOf(d, 'goal').classList.contains('field-invalid'), false);
  assert.match(CSS, /\.word-count\{[^}]*color:var\(--text-2\)/, 'the same grey as a hint');
  assert.doesNotMatch(CSS, /\.word-count[^{]*\{[^}]*--red/, 'never red');
  const hideList = CSS.slice(CSS.indexOf('.section-evaluation,.field-eval-progress')).split('{')[0];
  assert.ok(hideList.includes('.word-count,'), 'the count does not print');
});

test('Clear Form resets it at once, without saving an empty draft', async (t) => {
  // Max's case from #74, in the new shape.
  const app = await bootApp();
  t.after(() => app.close());
  const { document: d, window } = app;
  const ta = d.querySelector('[data-field="background"]');   // 60
  setValue(window, ta, words(90));
  assert.equal(countOf(d, 'background').textContent, "You've written about 90 words");
  d.getElementById('clear-btn').click();
  assert.equal(ta.value, '');
  assert.equal(countOf(d, 'background').textContent, 'You have 60 words remaining', 'reset immediately');
  assert.equal(spokenOf(d, 'background').textContent, 'You have 60 words remaining', 'and told at once');
  await new Promise((resolve) => setTimeout(resolve, 550));
  assert.equal(window.localStorage.getItem('research-plan-app:draft'), null);
});

test('a restored draft shows its count, and words= on anything but a textarea is ignored', async (t) => {
  const app = await bootApp({ draft: { version: 7, fields: { goal: words(12) }, lists: {}, tables: {} } });
  t.after(() => app.close());
  assert.equal(countOf(app.document, 'goal').textContent, 'You have 18 words remaining');
  const other = await bootApp({ textAssets: { 'research-plan-template.md': TEMPLATE.replace('(text, width=20, key=signOffResearcher)', '(text, width=20, words=30, key=signOffResearcher)') } });
  t.after(() => other.close());
  assert.equal(other.document.querySelector('[data-field="signOffResearcher"]').closest('.field').querySelector('.word-count'), null);
});
