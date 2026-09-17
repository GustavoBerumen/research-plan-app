'use strict';

// RPA-143: a draft newer than the build must not be opened. It used to be:
// migrateDraft passed anything at or above its own version through, only
// the keys the build knew were restored, and the next autosave wrote the
// older shape over the rest. Reproduced on the live build ba9f84f on 17
// September 2026 with a version 10 plan: one edit later the studies were
// gone. It bites when a release is rolled back after people have saved on
// the newer one.
//
// Now the stored draft is looked at before anything opens it. If it is
// newer it is left byte for byte as it was, a page stands in for the form,
// nothing saves, and the person can download exactly what is stored or
// choose, after being asked, to remove it and start again. Backups were
// already safe: a newer file is refused (RPA-40).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp, waitFor, DRAFT_KEY } = require('./app-harness');

const APP = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const CURRENT = Number(/const DRAFT_VERSION = (\d+);/.exec(APP)[1]);
const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();
const settle = () => new Promise((r) => setTimeout(r, 900));   // longer than the autosave delay

// A plan as a newer build would save it: a key this build has never heard
// of, and spacing of its own, so "byte for byte" means something.
const newer = (version = CURRENT + 1) => JSON.stringify({
  version, savedAt: '2026-10-01T09:00:00.000Z', createdAt: '2026-10-01',
  fields: { researchTitle: 'Saved on a newer build', emailAddress: 'priya@example.com' },
  selects: { studyCount: { v: 'One', o: '' } },
  lists: { researchQuestions: ['Where does it break down?'], outcomes: ['A list.'] },
  studies: [{ questions: [1], methods: ['Moderated usability testing'], characteristics: ['Abandoned a basket'], userGroups: ['New customers'], sampleSize: { v: 'Small (1–5)', o: '' } }],
  somethingThisBuildHasNeverHeardOf: { kept: true, because: ['nobody', 'touched', 'it'] },
  tables: {}, custom: {}, lastUpdatedManual: false, signOff: null, ui: { timelineVisible: false },
}, null, 3);
const stored = (app) => app.window.localStorage.getItem(DRAFT_KEY);
const page = (d) => d.querySelector('.newer-draft');

test('a draft one version ahead is not opened: a page stands in for the form and says what happened', async (t) => {
  const raw = newer();
  const app = await bootApp({ storage: { [DRAFT_KEY]: raw } });
  t.after(() => app.close());
  const d = app.document;
  assert.ok(page(d), 'the page is there');
  assert.equal(text(page(d).querySelector('h2')), 'This plan was saved by a newer version of this form');
  assert.match(text(page(d)), /kept in this browser exactly as it was saved/);
  assert.match(text(page(d)), /has not been opened and nothing has been changed/);
  assert.equal(d.activeElement, page(d).querySelector('h2'), 'focus goes to the heading, as on any page');
  assert.equal(d.querySelectorAll('.step').length, 0, 'no form this build would fill in wrongly is left to type into');
  assert.equal(d.querySelector('.title-inp'), null);
  assert.equal(d.getElementById('doc').children.length, 1, 'the page is all there is');
  assert.equal(stored(app), raw, 'and the stored draft is untouched');
  assert.deepEqual(app.jsdomErrors, []);
});

test('nothing writes over it: not time, not clicks, not a hash into a section, not the menu, not a reload', async (t) => {
  const raw = newer();
  const app = await bootApp({ storage: { [DRAFT_KEY]: raw } });
  t.after(() => app.close());
  const { document: d, window } = app;
  await settle();
  assert.equal(stored(app), raw, 'the autosave that used to overwrite it never runs');

  window.location.hash = '#research';
  await settle();
  assert.equal(d.querySelectorAll('.step').length, 0, 'a hash cannot bring the form back');
  page(d).dispatchEvent(new window.Event('click', { bubbles: true }));
  d.dispatchEvent(new window.Event('input', { bubbles: true }));
  await settle();
  assert.equal(stored(app), raw);

  for (const id of ['download-backup-btn', 'restore-backup-btn', 'clear-btn', 'print-btn']) {
    const control = d.getElementById(id);
    if (control) assert.equal(control.disabled, true, id + ' is off: each would write, or print, an empty plan');
  }
  assert.equal(d.getElementById('backup-file').disabled, true);

  const again = await bootApp({ storage: { [DRAFT_KEY]: stored(app) } });
  t.after(() => again.close());
  assert.ok(page(again.document), 'a reload says the same');
  assert.equal(stored(again), raw, 'and still nothing has changed, byte for byte');
  assert.deepEqual(app.jsdomErrors, []);
  assert.deepEqual(again.jsdomErrors, []);
});

test('the person can download exactly what is stored, so nothing depends on the newer build coming back', async (t) => {
  const raw = newer();
  const app = await bootApp({ storage: { [DRAFT_KEY]: raw } });
  t.after(() => app.close());
  const { document: d, window } = app;
  let blob = null;
  let name = null;
  window.URL.createObjectURL = (value) => { blob = value; return 'blob:synthetic'; };
  window.URL.revokeObjectURL = () => {};
  window.HTMLAnchorElement.prototype.click = function () { name = this.download; };
  page(d).querySelector('.newer-draft-download').click();
  assert.ok(blob, 'a file is offered');
  const downloaded = await new Promise((resolve) => { const reader = new window.FileReader(); reader.onload = () => resolve(reader.result); reader.readAsText(blob); });
  assert.equal(downloaded, raw, 'the stored bytes, not a backup this build would write');
  assert.match(name, /^Research plan - saved by a newer version - \d{4}-\d{2}-\d{2}\.json$/);
  assert.match(text(page(d).querySelector('[role=status]')), /^Download started\./);
  assert.equal(stored(app), raw, 'downloading changes nothing');
  assert.deepEqual(app.jsdomErrors, []);
});

test('starting a new plan asks first; a refusal keeps everything, and agreeing removes the saved plan and offers the form', async (t) => {
  const raw = newer();
  const asked = [];
  let answer = false;
  const app = await bootApp({ storage: { [DRAFT_KEY]: raw }, confirm: (m) => { asked.push(m); return answer; } });
  t.after(() => app.close());
  const d = app.document;
  const startNew = page(d).querySelector('.newer-draft-new');
  startNew.click();
  assert.deepEqual(asked, ['Start a new plan? The saved plan will be removed from this browser. Download it first if you want to keep it.']);
  assert.equal(stored(app), raw, 'refused: nothing is removed');
  assert.equal(startNew.disabled, false);

  answer = true;
  startNew.click();
  assert.equal(stored(app), null, 'agreed: the saved plan is removed');
  assert.equal(startNew.disabled, true);
  assert.equal(page(d).querySelector('.newer-draft-download').disabled, true, 'there is nothing left to download');
  const open = page(d).querySelector('[role=status] a');
  assert.equal(text(open), 'Open the form');
  assert.equal(open.getAttribute('href'), app.window.location.pathname);
  await settle();
  assert.equal(stored(app), null, 'and nothing writes a draft from this page afterwards');

  const fresh = await bootApp({});
  t.after(() => fresh.close());
  assert.equal(page(fresh.document), null, 'the form opens as for anyone new');
  assert.ok(fresh.document.querySelector('.title-inp'));
  assert.deepEqual(app.jsdomErrors, []);
});

test('a plan this build cannot read comes before a link: there is no plan in hand to judge the link against', async (t) => {
  const raw = newer();
  const app = await bootApp({ storage: { [DRAFT_KEY]: raw }, url: 'https://research-plan.test/?as=some-token#review' });
  t.after(() => app.close());
  const d = app.document;
  assert.ok(page(d));
  assert.equal(text(page(d).querySelector('h2')), 'This plan was saved by a newer version of this form', 'not "This link no longer works"');
  assert.equal(stored(app), raw);
  assert.deepEqual(app.jsdomErrors, []);
});

test('drafts at or below this build\'s version behave exactly as before', async (t) => {
  const current = JSON.parse(newer(CURRENT));
  delete current.somethingThisBuildHasNeverHeardOf;
  const app = await bootApp({ draft: current });
  t.after(() => app.close());
  const d = app.document;
  assert.equal(page(d), null, 'the current version opens');
  assert.equal(d.querySelector('[data-field="researchTitle"]').value, 'Saved on a newer build');
  assert.deepEqual(Array.from(d.querySelectorAll('.methods-group .list-rows[data-list-key="methods"] .list-input')).map((i) => i.value), ['Moderated usability testing']);

  const older = await bootApp({ draft: { version: CURRENT - 1, fields: { researchTitle: 'An older plan' }, selects: {}, lists: { researchQuestions: ['Why?'], outcomes: ['A reason.'] },
    methods: [{ question: 'Why?', methods: ['Interviews'] }], tables: {}, custom: {}, signOff: null } });
  t.after(() => older.close());
  assert.equal(page(older.document), null, 'an older one opens through the migrations');
  assert.equal(older.document.querySelector('[data-field="researchTitle"]').value, 'An older plan');
  const far = await bootApp({ storage: { [DRAFT_KEY]: newer(CURRENT + 7) } });
  t.after(() => far.close());
  assert.ok(page(far.document), 'and any version ahead, not only the next, is kept rather than opened');
  assert.deepEqual(app.jsdomErrors, []);
});

test('the rule is one predicate: every guard a dead link uses asks it', () => {
  assert.match(APP, /function planBlocked\(\) \{ return linkIsDead\(\) \|\| Boolean\(newerDraft\); \}/);
  const direct = APP.split('\n').filter((l) => /linkIsDead\(\)/.test(l) && !/function linkIsDead|function planBlocked|openDeadLink\(\)/.test(l));
  assert.deepEqual(direct, [], 'no guard asks about dead links alone any more, except the two that open the dead-link page itself');
  assert.match(APP, /if \(!store \|\| draftRestoring \|\| planBlocked\(\)\) return false;/, 'saving');
  assert.match(APP, /if \(draftRestoring \|\| planBlocked\(\)\) return;/, 'scheduling a save');
});
