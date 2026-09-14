'use strict';

// RPA-114, reframed on Gus's review of 14 September. Not a character count:
// a word guide. A hint under the box sets the expectation once — "A good
// answer is around 40 to 60 words." — and a running count stays silent
// while the answer is anywhere near the range, appearing only once it is
// well past, worded as description ("You've written about 80 words."),
// never judgement, styled as a hint, never red, and announced through a
// polite live region about once a second rather than per keystroke. The
// design system's own research is the reason: a visible running count reads
// as a rule even when nothing enforces it. Two tiers: 40-60 words for a long
// answer, 20-30 for a short one; nothing is ever blocked.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp, setValue, waitFor } = require('./app-harness');

const ROOT = path.join(__dirname, '..');
const CSS = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
const TEMPLATE = fs.readFileSync(path.join(ROOT, 'research-plan-template.md'), 'utf8');
const wrapOf = (d, key) => d.querySelector('[data-field="' + key + '"]').closest('.field');
const guideOf = (d, key) => wrapOf(d, key).querySelector('.word-guide');
const countOf = (d, key) => wrapOf(d, key).querySelector('.word-count');
const words = (n) => Array.from({ length: n }, (_, i) => 'word' + i).join(' ');
const settle = () => new Promise((r) => setTimeout(r, 1150));

test('each free-text field states its range once, as a hint the field is described by; the count is silent at rest', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const d = app.document;
  const tiers = { background: '40 to 60', problemStatement: '40 to 60', comments: '40 to 60', goal: '20 to 30', objective: '20 to 30', hypothesis: '20 to 30' };
  for (const [key, range] of Object.entries(tiers)) {
    assert.equal(guideOf(d, key).textContent, 'A good answer is around ' + range + ' words.', key);
    assert.equal(countOf(d, key).hidden, true, key + ': nothing to say yet');
    const ids = (d.querySelector('[data-field="' + key + '"]').getAttribute('aria-describedby') || '').split(/\s+/);
    assert.ok(ids.includes(guideOf(d, key).id), key + ': the guide is part of the description');
    assert.ok(!ids.includes(countOf(d, key).id || '__none__'), key + ': the count is not, it announces itself');
  }
  assert.equal(d.querySelectorAll('.word-guide').length, 6, 'and nowhere else');
  assert.equal(d.querySelector('[data-field="theory"]'), null, 'Theory is dormant (RPA-117)');
  assert.deepEqual(app.jsdomErrors, []);
});

test('the count stays silent anywhere near the range and speaks only once well past it, as description', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  const ta = d.querySelector('[data-field="goal"]');   // 20 to 30 words
  setValue(window, ta, words(30));
  await settle();
  assert.equal(countOf(d, 'goal').hidden, true, 'at the top of the range: silent');
  setValue(window, ta, words(37));
  await settle();
  assert.equal(countOf(d, 'goal').hidden, true, 'a little past: still silent');
  setValue(window, ta, words(48));
  await waitFor(() => !countOf(d, 'goal').hidden, { message: 'well past the range, it should appear' });
  assert.equal(countOf(d, 'goal').textContent, "You've written about 50 words.");
  assert.doesNotMatch(countOf(d, 'goal').textContent, /over|too|limit|remaining/i, 'description, not judgement');
  assert.equal(ta.value.split(/\s+/).length, 48, 'never a limit');
  setValue(window, ta, words(25));
  await waitFor(() => countOf(d, 'goal').hidden, { message: 'back in range, it goes' });
});

test('it is a hint, never an error: no red, no border, no error class, not in the print hide-list; the count does not print', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  setValue(window, d.querySelector('[data-field="goal"]'), words(60));
  await waitFor(() => !countOf(d, 'goal').hidden);
  for (const el of [guideOf(d, 'goal'), countOf(d, 'goal')]) {
    assert.ok(!Array.from(el.classList).some((c) => /error|over|invalid|warn/i.test(c)), el.className);
  }
  assert.equal(wrapOf(d, 'goal').classList.contains('field-invalid'), false);
  assert.match(CSS, /\.word-guide,\.word-count\{[^}]*color:var\(--text-2\)/, 'hint colour, the same as a hint');
  assert.doesNotMatch(CSS, /\.word-(guide|count)[^{]*\{[^}]*--red/, 'never red');
  // The print hide-list is the one selector list that starts with .section-evaluation.
  const hideList = CSS.slice(CSS.indexOf('.section-evaluation,.field-eval-progress')).split('{')[0];
  assert.ok(hideList.includes('.word-count,'), 'the running count does not print');
  assert.ok(!hideList.includes('.word-guide'), 'the guide prints like any hint');
});

test('a screen reader is told calmly: a polite live region, updated on a debounce rather than per keystroke', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  const ta = d.querySelector('[data-field="goal"]');
  assert.equal(countOf(d, 'goal').getAttribute('aria-live'), 'polite');
  setValue(window, ta, words(60));
  assert.equal(countOf(d, 'goal').hidden, true, 'not on the keystroke');
  await waitFor(() => !countOf(d, 'goal').hidden, { message: 'after the debounce' });
});

test('Clear Form silences the count at once, without saving an empty draft', async (t) => {
  // Max's case from #74, in the new shape.
  const app = await bootApp();
  t.after(() => app.close());
  const { document: d, window } = app;
  const ta = d.querySelector('[data-field="background"]');   // 40 to 60 words
  setValue(window, ta, words(90));
  await waitFor(() => !countOf(d, 'background').hidden);
  d.getElementById('clear-btn').click();
  assert.equal(ta.value, '');
  assert.equal(countOf(d, 'background').hidden, true, 'reset immediately, not after the debounce');
  await new Promise((resolve) => setTimeout(resolve, 550));
  assert.equal(window.localStorage.getItem('research-plan-app:draft'), null);
});

test('a restored draft well past the range gets its count after the debounce, and words= on anything but a textarea is ignored', async (t) => {
  const app = await bootApp({ draft: { version: 7, fields: { goal: words(80) }, lists: {}, tables: {} } });
  t.after(() => app.close());
  await waitFor(() => !countOf(app.document, 'goal').hidden, { message: 'the count for a restored answer' });
  assert.equal(countOf(app.document, 'goal').textContent, "You've written about 80 words.");
  const other = await bootApp({ textAssets: { 'research-plan-template.md': TEMPLATE.replace('(text, width=20, key=signOffResearcher)', '(text, width=20, words=20-30, key=signOffResearcher)') } });
  t.after(() => other.close());
  assert.equal(other.document.querySelector('[data-field="signOffResearcher"]').closest('.field').querySelector('.word-guide'), null);
});
