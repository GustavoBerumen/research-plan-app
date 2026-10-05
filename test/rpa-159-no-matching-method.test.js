'use strict';

// RPA-159, found cataloguing the app's empty states on 2 October 2026. The
// Methods box is free text with a dropdown of suggestions. Typing a word
// that matched nothing removed the dropdown from the page and said nothing:
// no message, no empty list, nothing announced. A person could not tell
// apart "no method matches what I typed", "the suggestions are broken" and
// "this field never had suggestions".
//
// It says so now, in the shape the Jira picker already used for the same
// moment (app.js:4756): a polite live region under the box, naming what was
// not found and making clear that what you typed is still your answer. The
// field remains free text: the message is a note, never a refusal.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp, setValue, waitFor } = require('./app-harness');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();
const settle = (ms = 150) => new Promise((r) => setTimeout(r, ms));
const NO_MATCH = 'No matching research methods. You can still enter a method of your own.';

const methodInput = (d) => d.querySelector('.methods-group .list-rows[data-list-key="methods"] .list-input');
const statusOf = (input) => input.closest('.list-row').querySelector('.combo-status');
const openMenu = (d) => Array.from(d.querySelectorAll('.combo-menu')).find((m) => !m.hidden);
const type = async (app, input, value) => { setValue(app.window, input, value); await settle(); };

test('a term that matches nothing says so, and says the answer is still yours', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d } = app;
  const input = methodInput(d);

  await type(app, input, 'zzzqqq');
  assert.equal(openMenu(d), undefined, 'no dropdown, as before');
  assert.equal(text(statusOf(input)), NO_MATCH, 'and now it says why');
  assert.equal(input.getAttribute('aria-expanded'), 'false');
  assert.deepEqual(app.jsdomErrors, []);
});

test('the message is a polite live region of its own, not part of the box\'s description', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const input = methodInput(app.document);
  const status = statusOf(input);
  assert.equal(status.getAttribute('role'), 'status');
  assert.equal(status.getAttribute('aria-live'), 'polite');
  assert.equal(status.getAttribute('aria-atomic'), 'true');
  assert.equal(text(status), '', 'silent until there is something to say');
  // Not in aria-describedby: a status that is read on arrival would announce
  // an empty string every time the box is focused.
  assert.equal((input.getAttribute('aria-describedby') || '').includes(status.id || 'x'), false);
  assert.deepEqual(app.jsdomErrors, []);
});

test('a match shows the dropdown and nothing else; going back to one clears the message', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d } = app;
  const input = methodInput(d);

  await type(app, input, 'affinity');
  const menu = openMenu(d);
  assert.ok(menu, 'the dropdown is open');
  assert.deepEqual(Array.from(menu.querySelectorAll('.combo-item')).map(text), ['Affinity Diagramming']);
  assert.equal(text(statusOf(input)), '', 'a match says nothing');

  await type(app, input, 'zzzqqq');
  assert.equal(text(statusOf(input)), NO_MATCH);

  await type(app, input, 'affinity');
  assert.ok(openMenu(d), 'the dropdown comes back');
  assert.equal(text(statusOf(input)), '', 'and the message goes');
  assert.deepEqual(app.jsdomErrors, []);
});

test('emptying the box clears the message: nothing typed is not nothing found', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const input = methodInput(app.document);
  await type(app, input, 'zzzqqq');
  assert.equal(text(statusOf(input)), NO_MATCH);
  await type(app, input, '');
  assert.equal(text(statusOf(input)), '');
  assert.deepEqual(app.jsdomErrors, []);
});

test('leaving the box clears the message, so a method of your own carries no standing note', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  const input = methodInput(d);
  await type(app, input, 'Diary study with our own prompts');
  assert.equal(text(statusOf(input)), NO_MATCH, 'while typing, it explains the silence');

  input.dispatchEvent(new window.Event('blur', { bubbles: false }));
  await waitFor(() => text(statusOf(input)) === '', { message: 'the message goes when the box is left' });
  assert.equal(input.value, 'Diary study with our own prompts', 'and the answer is untouched');
  assert.deepEqual(app.jsdomErrors, []);
});

test('with the suggestions list unavailable the box is a plain box, and does not pretend otherwise', async (t) => {
  const app = await bootApp({ textAssets: { 'research-methods.md': '' } });
  t.after(() => app.close());
  const { document: d } = app;
  const input = methodInput(d);

  assert.equal(input.getAttribute('role'), null, 'not announced as a combobox');
  assert.equal(input.getAttribute('aria-expanded'), null);
  assert.equal(input.getAttribute('aria-autocomplete'), null);
  assert.equal(statusOf(input), null, 'and no live region that could never have anything to say');

  await type(app, input, 'affinity');
  assert.equal(openMenu(d), undefined, 'nothing opens');
  assert.deepEqual(app.jsdomErrors, []);
});

test('the message sits on its own line under the box, and never prints', () => {
  // jsdom lays nothing out; the rules that hold this are the stylesheet's.
  assert.match(CSS, /\.list-row:has\(>\.combo-status:not\(:empty\)\)\{[^}]*flex-wrap:wrap/, 'the row wraps for it');
  assert.match(CSS, /\.list-row>\.combo-status\{[^}]*flex:0 0 100%/, 'and it takes the whole line');
  assert.match(CSS, /\.combo-status:empty\{display:none\}/, 'an empty one takes no room');
  assert.match(CSS, /\.combo-status\{[^}]*overflow-wrap:anywhere/, 'a long message wraps rather than overflows');
  assert.match(CSS, /@media print[\s\S]*?\.combo-status\{display:none!important\}/, 'and a status is not part of the plan');
});
