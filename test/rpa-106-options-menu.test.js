'use strict';

// RPA-106. The actions live in one menu, as in the model application: a Menu
// button in the bar opens a panel with the plan's name and the same four
// actions as before, same ids, same order. Escape and a click outside close
// it. Gus, 14 September 2026: the plan's name, not a person's, since there
// is no sign in (RPA-99, so no sign out either); and no Save progress,
// because autosave already does it.

const test = require('node:test');
const assert = require('node:assert/strict');
const { bootApp, setValue, waitFor } = require('./app-harness');
const { smallBackup } = require('./rpa-40-fixtures.cjs');

const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();

test('one Menu button in the bar; the panel is closed until pressed, and holds the actions, the plan as a document first', async (t) => {
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
  // RPA-77 added Download as Word and grouped them: the plan as a document, the backup of this form, then Clear Form.
  assert.deepEqual(Array.from(menu.querySelectorAll('.tb-btns button')).map((b) => b.id), ['download-word-btn', 'print-btn', 'download-backup-btn', 'restore-backup-btn', 'clear-btn']);
  assert.deepEqual(Array.from(menu.querySelectorAll('button')).map((b) => b.id), ['options-plan-change', 'download-word-btn', 'print-btn', 'download-backup-btn', 'restore-backup-btn', 'clear-btn'], 'nothing else but Change on the email address (RPA-99): no Save progress, autosave does it; no sign out, there is no account to sign out of');
  assert.equal(d.getElementById('save-status'), null, 'and no save confirmation line in the page');
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

test('the menu follows a replacement plan, later edits and reset; rejected backups keep its name', async (t) => {
  const app = await bootApp(); t.after(() => app.close());
  const { document: d, window } = app;
  const title = () => d.querySelector('[data-field="researchTitle"]');
  const name = () => text(d.getElementById('options-plan-name'));
  const restore = async backup => {
    const picker = d.getElementById('backup-file');
    Object.defineProperty(picker, 'files', { configurable: true,
      value: [new window.File([JSON.stringify(backup)], 'synthetic.json', { type: 'application/json' })] });
    picker.dispatchEvent(new window.Event('change', { bubbles: true }));
    await waitFor(() => !d.getElementById('restore-backup-btn').disabled);
  };
  setValue(window, title(), 'Old plan');
  await restore(smallBackup());
  assert.equal(name(), 'A smaller plan');
  setValue(window, title(), 'Edited replacement');
  assert.equal(name(), 'Edited replacement');
  await restore({ version: 999, fields: {} });
  assert.equal(name(), 'Edited replacement', 'a rejected import does not relabel the current plan');
  d.getElementById('clear-btn').click();
  assert.equal(name(), 'Untitled plan');
  setValue(window, title(), 'Next participant');
  assert.equal(name(), 'Next participant');
});

test('Escape closes it and returns focus to the button; a click outside closes it; Restore keeps it open', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  const toggle = d.getElementById('menu-btn');
  const menu = d.getElementById('options-menu');
  toggle.click();
  d.getElementById('clear-btn').focus();
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
