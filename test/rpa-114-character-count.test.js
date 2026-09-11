'use strict';

// RPA-114. A running character count under a textarea, as a recommendation:
// "A good answer is around 300 characters", then "You have written 120 of
// around 300 characters". It tells people what is expected and gives them
// confidence about what a good answer is; it never stops a longer one. The
// template declares the number with count=N; the message is a polite live
// region the field is described by, so a screen reader hears it on arrival
// and hears it change without leaving the field.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp, setValue } = require('./app-harness');

const ROOT = path.join(__dirname, '..');
const CSS = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
const TEMPLATE = fs.readFileSync(path.join(ROOT, 'research-plan-template.md'), 'utf8');
const counterOf = (d, key) => d.querySelector('[data-field="' + key + '"]').closest('.field').querySelector('.char-count');

test('exactly the fields the template gives a count to have one, with the recommended length in the message', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const d = app.document;
  const expected = { background: 400, goal: 200, problemStatement: 300, objective: 200, hypothesis: 150, comments: 500 };
  for (const [key, n] of Object.entries(expected)) {
    assert.equal(counterOf(d, key)?.textContent, 'A good answer is around ' + n + ' characters.', key);
  }
  assert.equal(counterOf(d, 'theory'), null, 'Theory is filled from a suggestion; no count');
  assert.equal(d.querySelectorAll('.char-count').length, Object.keys(expected).length, 'and nowhere else');
  assert.deepEqual(app.jsdomErrors, []);
});

test('the count follows what is written, counts spaces, and going over is said, not stopped', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  const ta = d.querySelector('[data-field="goal"]');
  const out = counterOf(d, 'goal');
  setValue(window, ta, 'Ship the new checkout.');
  assert.equal(out.textContent, 'You have written 22 of around 200 characters.');
  assert.equal(out.classList.contains('char-count-over'), false);
  setValue(window, ta, 'x'.repeat(250));
  assert.equal(out.textContent, 'You have written 250 of around 200 characters.');
  assert.equal(out.classList.contains('char-count-over'), true);
  assert.equal(ta.value.length, 250, 'a recommendation, never a limit');
  setValue(window, ta, '');
  assert.equal(out.textContent, 'A good answer is around 200 characters.', 'back to the recommendation when empty');
});

test('a screen reader hears it: a polite live region the field is described by, alongside its hint', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const d = app.document;
  const ta = d.querySelector('[data-field="background"]');
  const out = counterOf(d, 'background');
  assert.equal(out.getAttribute('aria-live'), 'polite');
  const ids = (ta.getAttribute('aria-describedby') || '').split(/\s+/);
  assert.ok(ids.includes(out.id), 'described by the count');
  assert.ok(ids.includes(ta.closest('.field').querySelector('.field-hint-text').id), 'and still by the hint');
});

test('a restored draft shows the count of what came back', async (t) => {
  const app = await bootApp({ draft: { version: 7, fields: { background: 'y'.repeat(60) }, lists: {}, tables: {} } });
  t.after(() => app.close());
  assert.equal(counterOf(app.document, 'background').textContent, 'You have written 60 of around 400 characters.');
});

test('the count does not print, and count= on anything but a textarea is ignored', async (t) => {
  const print = CSS.slice(CSS.indexOf('@media print{'));
  assert.match(print, /\.char-count,/, 'in the print hide-list');
  // A sign-off is a plain text input built by the same code as a textarea,
  // so this is the guard itself being tested, not a different builder.
  const app = await bootApp({ textAssets: { 'research-plan-template.md': TEMPLATE.replace('(text, key=signOffResearcher)', '(text, count=20, key=signOffResearcher)') } });
  t.after(() => app.close());
  assert.equal(app.document.querySelector('[data-field="signOffResearcher"]').closest('.field').querySelector('.char-count'), null);
});
