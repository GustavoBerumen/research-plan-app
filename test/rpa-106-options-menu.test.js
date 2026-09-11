'use strict';

// RPA-106. The actions live in one menu, as in the model application: a Menu
// button in the bar opens a panel with the plan's name, Save progress, and
// the same four actions as before, same ids, same order. Escape and a click
// outside close it. Save progress saves at the press and says so, because
// autosave is silent and people want to be sure. No sign out yet: there is
// no sign in (RPA-99).

const test = require('node:test');
const assert = require('node:assert/strict');
const { bootApp, setValue } = require('./app-harness');

const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();
function savedDraft(window) {
  const ls = window.localStorage;
  for (let i = 0; i < ls.length; i++) { try { const j = JSON.parse(ls.getItem(ls.key(i))); if (j && j.fields) return j; } catch (e) { /* not ours */ } }
  return null;
}

test('one Menu button in the bar; the panel is closed until pressed, and holds the actions in their old order', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const d = app.document;
  const toggle = d.querySelector('header .site-bar > .menu-btn');
  const menu = d.getElementById('options-menu');
  assert.ok(toggle && menu);
  assert.equal(text(toggle), 'Menu');
  assert.equal(menu.hidden, true);
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(toggle.getAttribute('aria-controls'), 'options-menu');
  toggle.click();
  assert.equal(menu.hidden, false);
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.deepEqual(Array.from(menu.querySelectorAll('.tb-btns button')).map((b) => b.id), ['download-backup-btn', 'restore-backup-btn', 'clear-btn', 'print-btn']);
  assert.equal(menu.querySelector('#save-progress-btn') !== null, true);
  assert.equal(menu.querySelector('#sign-out-btn'), null, 'no sign out without a sign in');
  toggle.click();
  assert.equal(menu.hidden, true);
  assert.deepEqual(app.jsdomErrors, []);
});

test('the panel names the plan, live', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  const name = d.getElementById('options-plan-name');
  assert.equal(text(name), 'Untitled plan');
  setValue(window, d.querySelector('[data-field="researchTitle"]'), 'Usability testing of checkout flow');
  assert.equal(text(name), 'Usability testing of checkout flow');
  setValue(window, d.querySelector('[data-field="researchTitle"]'), '   ');
  assert.equal(text(name), 'Untitled plan');
});

test('Save progress saves at the press and says so', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  setValue(window, d.querySelector('[data-field="leadResearcher"]'), 'Gus');
  d.getElementById('menu-btn').click();
  d.getElementById('save-progress-btn').click();
  assert.equal(savedDraft(window)?.fields?.leadResearcher, 'Gus', 'saved at the press, before any autosave timer');
  const status = d.getElementById('save-status');
  assert.match(text(status), /^Saved at \d\d:\d\d\.$/);
  assert.equal(status.getAttribute('role'), 'status');
  assert.equal(d.getElementById('options-menu').hidden, true, 'an action closes the menu');
});

test('Escape closes it and returns focus to the button; a click outside closes it; Restore keeps it open', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  const toggle = d.getElementById('menu-btn');
  const menu = d.getElementById('options-menu');
  toggle.click();
  d.getElementById('save-progress-btn').focus();
  d.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(menu.hidden, true);
  assert.equal(d.activeElement, toggle, 'focus comes back to the button');
  toggle.click();
  d.querySelector('main').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.equal(menu.hidden, true, 'a click outside closes it');
  toggle.click();
  d.getElementById('restore-backup-btn').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.equal(menu.hidden, false, 'Restore is about to open a file dialog; the menu stays');
});
