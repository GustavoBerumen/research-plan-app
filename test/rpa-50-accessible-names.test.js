'use strict';

// RPA-50. The ticket asks for verification where the form already satisfies
// it and fixes only for demonstrated gaps. This file is both: an audit of a
// fully populated form — every section open, one of every repeatable thing
// added — asserting that every control a person can reach has an accessible
// name from a source a screen reader honours, plus the specific gaps the
// audit found on 11 September 2026 and the fixes that closed them.
//
// The name computation is deliberately narrower than the browser's: a title
// or a placeholder does not count. Both are announced inconsistently and the
// placeholder vanishes on typing, which is the failure RPA-58 removed.

const test = require('node:test');
const assert = require('node:assert/strict');
const { bootApp } = require('./app-harness');

const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function populated(t) {
  const app = await bootApp({});
  t.after(() => app.close());
  const d = app.document;
  d.querySelectorAll('.acc').forEach((a) => { const b = a.querySelector('.acc-body'); if (b && b.hidden) a.querySelector('.acc-head').click(); });
  for (const b of Array.from(d.querySelectorAll('button'))) {
    if (/^\+?\s*add\b/i.test(text(b)) && !/drive|all for|library|suggest/i.test(text(b)) && !b.disabled) b.click();
  }
  // One step is on screen at a time (RPA-101). The audit is of the whole
  // form, so every step is revealed the way print reveals them; otherwise
  // the reachability filter below would quietly skip five sixths of it.
  d.querySelectorAll('.step').forEach((step) => { step.hidden = false; });
  d.querySelectorAll('.acc-body').forEach((body) => { body.hidden = false; });
  await pause(60);
  return app;
}

// Only sources a screen reader reliably uses: aria-labelledby, aria-label,
// an associated <label>, or (for buttons and links) visible content and alt.
function accName(d, el) {
  const lb = el.getAttribute('aria-labelledby');
  if (lb) return lb.split(/\s+/).map((i) => text(d.getElementById(i))).filter(Boolean).join(' ');
  const al = el.getAttribute('aria-label');
  if (al && al.trim()) return al.trim();
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) {
    if (el.id) { const l = d.querySelector('label[for="' + el.id.replace(/"/g, '\\"') + '"]'); if (l) return text(l); }
    const wl = el.closest('label'); if (wl) return text(wl);
    return '';
  }
  const img = el.querySelector('img[alt]');
  return text(el) || (img ? img.alt : '');
}
const reachable = (el) => !el.hidden && !el.closest('[hidden]');
const CONTROLS = 'input:not([type=hidden]), textarea, select, button, a[href], [role="button"]';

test('every control a person can reach has a real accessible name, with letters in it', async (t) => {
  const app = await populated(t);
  const d = app.document;
  const failures = Array.from(d.querySelectorAll(CONTROLS)).filter(reachable)
    .filter((el) => !/\p{L}/u.test(accName(d, el)))
    .map((el) => el.tagName.toLowerCase() + (el.type ? '[' + el.type + ']' : '') + ' "' + text(el) + '" class=' + el.className);
  assert.deepEqual(failures, []);
  assert.deepEqual(app.jsdomErrors, []);
});

test('a file cell names the native file input and its add button by column and row, and renumbers on removal', async (t) => {
  // The demonstrated gap: nameRowCells named the hidden value carrier
  // (input.cinput) and never the native file input a person reaches.
  const app = await populated(t);
  const d = app.document;
  const field = Array.from(d.querySelectorAll('.field')).find((f) => /^Previous Knowledge/.test(text(f.querySelector('.flabel'))));
  assert.ok(field, 'Previous Knowledge field');
  const names = () => Array.from(field.querySelectorAll('tbody tr')).map((tr) => [
    tr.querySelector('input.file-native')?.getAttribute('aria-label'),
    tr.querySelector('.file-add-btn')?.getAttribute('aria-label'),
  ]);
  assert.deepEqual(names(), [['File, row 1', 'Add a file, row 1'], ['File, row 2', 'Add a file, row 2']]);

  Array.from(d.querySelectorAll('button')).find((b) => /^\+?\s*add previous knowledge/i.test(text(b))).click();
  await pause(30);
  assert.equal(names()[2][0], 'File, row 3', 'a new row is named with its own number');

  const remove = Array.from(field.querySelectorAll('tbody tr:first-child button')).find((b) => /remove|delete|✕|×/i.test(text(b) + (b.getAttribute('aria-label') || '')));
  assert.ok(remove, 'a remove control on the first row');
  remove.click();
  await pause(30);
  assert.deepEqual(names().map((n) => n[0]), ['File, row 1', 'File, row 2'], 'remaining rows are renumbered, not left with a gap');
});

test('every dismiss cross says what it closes', async (t) => {
  // The evaluation panel's ✕ was named; the framework and methods panels'
  // were not — same class, same glyph, no name.
  const app = await populated(t);
  const d = app.document;
  const names = Array.from(d.querySelectorAll('.eval-x')).map((b) => b.getAttribute('aria-label') || '');
  assert.ok(names.length >= 3, 'evaluation, framework and methods crosses exist');
  assert.ok(names.every((n) => /\p{L}/u.test(n)), 'none is left to the glyph: ' + JSON.stringify(names));
  assert.ok(names.includes('Close the framework suggestion'));
  assert.ok(names.includes('Close the methods suggestion'));
});

test('the list-fallback chevron is named, not only titled', async (t) => {
  const app = await populated(t);
  const backs = Array.from(app.document.querySelectorAll('.select-other-back'));
  assert.ok(backs.length > 0);
  for (const b of backs) assert.equal(b.getAttribute('aria-label'), b.title, 'aria-label matches the title a sighted person hovers');
});

test('ids stay unique and labels resolve through add and remove', async (t) => {
  const app = await populated(t);
  const d = app.document;
  const dupes = () => { const ids = Array.from(d.querySelectorAll('[id]')).map((e) => e.id); return [...new Set(ids.filter((i, k) => ids.indexOf(i) !== k))]; };
  const dangling = () => Array.from(d.querySelectorAll('label[for]')).filter((l) => !d.getElementById(l.htmlFor)).map(text);
  assert.deepEqual(dupes(), []); assert.deepEqual(dangling(), []);
  const li = d.querySelector('[data-field="researchQuestions"]')?.closest('li') || d.querySelector('.field li');
  const rm = li && Array.from(li.querySelectorAll('button')).find((b) => /remove|delete|✕|×/i.test(text(b) + (b.getAttribute('aria-label') || '')));
  if (rm) { rm.click(); await pause(30); }
  const add = Array.from(d.querySelectorAll('button')).find((b) => /^\+?\s*add research question/i.test(text(b)));
  add.click(); add.click(); await pause(30);
  assert.deepEqual(dupes(), [], 'after removing one and adding two'); assert.deepEqual(dangling(), []);
});

test('the sample-size radios are a group named by the visible label', async (t) => {
  // A <label for> cannot name a set of radios; the group carries the name.
  const app = await populated(t);
  const d = app.document;
  const radios = Array.from(d.querySelectorAll('input[type=radio]'));
  assert.ok(radios.length >= 4);
  const group = radios[0].closest('[role=radiogroup], fieldset');
  assert.ok(group, 'radios sit in a radiogroup');
  const name = accName(d, group);
  assert.match(name, /Sample Size/);
  for (const r of radios) assert.ok(/\p{L}/u.test(accName(d, r)), 'each radio is named: ' + r.value);
});

test('every hint is connected to its control, or to the named group around repeated controls', async (t) => {
  // Single fields wire aria-describedby on the control; lists, tables and the
  // custom section wire it on their role="group" wrapper, which a screen
  // reader announces on entry. Verified, not fixed: both paths were in place.
  const app = await populated(t);
  const d = app.document;
  const unwired = [];
  for (const f of Array.from(d.querySelectorAll('.field'))) {
    const hint = f.querySelector('.field-hint-text'); if (!hint) continue;
    const refs = (el) => (el.getAttribute('aria-describedby') || '').split(/\s+/).includes(hint.id);
    const ok = refs(f) || Array.from(f.querySelectorAll('input, textarea, select, [role=group], [role=radiogroup]')).some(refs);
    if (!ok) unwired.push(text(f.querySelector('.flabel, label')) || hint.id);
  }
  assert.deepEqual(unwired, []);
});
