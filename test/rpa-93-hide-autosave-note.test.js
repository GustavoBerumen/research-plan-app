'use strict';

// RPA-93. The sentence above the form — autosave, and download a backup —
// was the first thing on the page after the header. Gus asked for it to go
// for now; the information returns in a different format later.
//
// It is hidden, not removed. The Download and Restore buttons are described
// by it through aria-describedby, and an accessible description is computed
// from hidden referenced content — so hidden keeps the buttons described while
// taking the sentence out of view. Deleting the element would strip that
// description silently, which is what this file exists to catch.

const test = require('node:test');
const assert = require('node:assert/strict');
const { bootApp } = require('./app-harness');

test('the autosave note is not shown above the form', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const note = app.document.getElementById('backup-help');
  assert.ok(note, 'the element is still there');
  assert.equal(note.hidden, true, 'and hidden, not merely styled away');
});

test('the backup buttons are still described by it', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const { document } = app;
  for (const id of ['download-backup-btn', 'restore-backup-btn']) {
    const btn = document.getElementById(id);
    const ids = (btn.getAttribute('aria-describedby') || '').split(/\s+/);
    assert.ok(ids.includes('backup-help'), id + ' points at the note');
    const target = document.getElementById('backup-help');
    assert.ok(target && target.textContent.trim(), id + ' — the note it points at still has its text');
  }
});

test('the status regions beside the actions stay visible', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const { document } = app;
  for (const id of ['backup-status', 'capability-status']) {
    const el = document.getElementById(id);
    assert.ok(el, id + ' exists');
    assert.equal(el.hidden, false, id + ' is not hidden');
    assert.equal(el.getAttribute('role'), 'status', id + ' is still a live status region');
  }
});

test('nothing else in the aside is visible text', async (t) => {
  // With the note hidden and the status regions empty at rest, the aside
  // should show nothing until something happens — so the form is the first
  // thing after the header, which was the point.
  const app = await bootApp();
  t.after(() => app.close());
  const aside = app.document.querySelector('.backup-help');
  const visibleText = Array.from(aside.children)
    .filter((el) => !el.hidden && el.id !== 'capability-status')
    .map((el) => el.textContent.trim()).filter(Boolean);
  assert.deepEqual(visibleText, [], 'only the capability check, while it runs, has anything to say');
});
