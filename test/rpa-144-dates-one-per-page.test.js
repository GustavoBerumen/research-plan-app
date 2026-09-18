'use strict';

// RPA-144. The two plan dates are asked one per page: Project decision, then
// Research readout. They shared a page since RPA-108, as two answers that
// depend on each other, and RPA-122 stacked them. But two identical date
// controls on one page invited typing the decision into the readout, and the
// rule between them only showed once both were filled, so it read as the
// form correcting the person. One question per page is the pattern
// everywhere else; this was the last place in Plan details it was broken.
//
// The rule between the dates is unchanged (RPA-55): the readout cannot be
// after the decision, and less than a week before it draws a warning. What
// changed is that the two are no longer in view together, so a decision
// brought forward says, on its own page, that it has moved the readout.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp, setValue, waitFor, completeStep, DRAFT_KEY, pageOfTotal } = require('./app-harness');

const APP = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const CSS = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();
const settle = (ms = 300) => new Promise((r) => setTimeout(r, ms));
const planOf = (d) => d.querySelector('.doc-header');
// No caption says "Question 2 of 7" since RPA-149; the form still keeps the page and the count, and a test may read them.
const caption = (d) => pageOfTotal(planOf(d));
const onScreen = (d) => Array.from(planOf(d).querySelectorAll('.title-field, .mf')).filter((u) => !u.hidden && !u.classList.contains('page-hidden') && !u.querySelector('[data-field="lastUpdated"]')).map((u) => text(u.querySelector('.mlabel, .title-label, legend')));
const press = (d) => planOf(d).querySelector('.step-continue').click();
const links = (d) => Array.from(planOf(d).querySelectorAll('.error-summary-link')).map(text);
const field = (d, key) => d.querySelector('[data-field="' + key + '"]');
const unitOf = (d, key) => field(d, key).closest('.mf');
async function go(app, hash) { app.window.location.hash = hash; await settle(); }

test('the pairing is gone from the code, and the research questions keep theirs', () => {
  assert.match(APP, /const PAGE_PAIRS = \[\['researchQuestions', 'outcomes'\]\];/);
});

test('each date has a page of its own, decision then readout, each with its hint and its help, and Back keeps what was entered', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  await go(app, '#plan-details/6');
  assert.deepEqual(onScreen(d), ['When will the findings be used to make a decision?']);
  assert.equal(caption(d), '6 of 7', 'seven pages, where there were six: the ticket counted five and six before RPA-141 added one');
  const decision = unitOf(d, 'projectDecision');
  assert.match(text(decision.querySelector('.field-hint-text, .mf-hint')), /plans to use the insights/);
  assert.equal(text(decision.querySelector('.field-help summary')), 'Why we ask for a decision date');
  assert.ok(planOf(d).querySelector('.step-continue'), 'with Save and continue');

  setValue(window, field(d, 'projectDecision'), '2026-11-20');
  press(d);
  await settle();
  assert.deepEqual(onScreen(d), ['When will the findings be shared with the team?']);
  assert.equal(caption(d), '7 of 7');
  assert.equal(window.location.hash, '#plan-details/7');
  const readout = unitOf(d, 'researchReadout');
  assert.match(text(readout.querySelector('.field-hint-text, .mf-hint')), /a few days before the project decision date/);
  assert.equal(text(readout.querySelector('.field-help summary')), 'Why this date needs to be before the decision date');

  planOf(d).querySelector('.step-back').click();
  await settle();
  assert.deepEqual(onScreen(d), ['When will the findings be used to make a decision?'], 'Back from the readout is the decision');
  assert.equal(field(d, 'projectDecision').value, '2026-11-20', 'with its date intact');
  assert.deepEqual(app.jsdomErrors, []);
});

test('each date is judged on its own page, in its own words, and blocks Save and continue until it is a real date', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  await go(app, '#plan-details/6');
  press(d);
  assert.deepEqual(links(d), ['Enter the date the findings will be used to make a decision'], 'the decision\'s page asks for the decision only');
  assert.deepEqual(onScreen(d), ['When will the findings be used to make a decision?'], 'and stays');
  const parts = (key) => ['day', 'month', 'year'].map((p) => field(d, key).closest('.date-control').querySelector('.date-' + p));
  const type = (key, values) => { field(d, key).value = ''; parts(key).forEach((el, i) => { el.value = values[i]; }); parts(key)[2].dispatchEvent(new window.Event('input', { bubbles: true })); };
  type('projectDecision', ['31', '2', '2027']);
  press(d);
  assert.deepEqual(links(d), ['Project decision date must be a real date']);
  type('projectDecision', ['20', '11', '2026']);
  press(d);
  await settle();
  assert.deepEqual(onScreen(d), ['When will the findings be shared with the team?']);
  press(d);
  assert.ok(links(d).includes('Enter the date the findings will be shared with the team'), 'the readout\'s page asks for the readout: ' + links(d).join(' | '));
  assert.equal(links(d).some((m) => /decision/.test(m) && /Enter the date/.test(m)), false, 'the decision is answered and is not asked for again');
  assert.deepEqual(app.jsdomErrors, []);
});

test('the rule between the dates holds across the two pages: no readout after the decision, and the buffer warning beside the readout', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  setValue(window, field(d, 'projectDecision'), '2026-11-20');
  assert.equal(field(d, 'researchReadout').max, '2026-11-20', 'the readout\'s picker stops at a decision set a page earlier');
  await go(app, '#plan-details/7');
  setValue(window, field(d, 'researchReadout'), '2026-11-25');
  assert.equal(field(d, 'researchReadout').value, '2026-11-20', 'a later readout is brought back to the decision');
  assert.equal(unitOf(d, 'projectDecision').querySelector('.date-moved-note').hidden, true, 'in plain view, on the page the person is on: the decision\'s page has nothing to report');
  const warning = unitOf(d, 'researchReadout').querySelector('.field-warning:not(.date-moved-note)');
  assert.equal(warning.hidden, false, 'and on the readout\'s page the buffer warning shows, beside the date it is about');
  assert.equal(text(warning), 'Allow a one-week buffer before the decision date.');
  assert.equal(unitOf(d, 'projectDecision').contains(warning), false);
  setValue(window, field(d, 'researchReadout'), '2026-11-10');
  assert.equal(warning.hidden, true, 'ten days is enough');
  assert.deepEqual(app.jsdomErrors, []);
});

test('a decision brought forward says, on its own page, that it moved a readout the person cannot see', async (t) => {
  const app = await bootApp({ confirm: () => true });
  t.after(() => app.close());
  const { document: d, window } = app;
  setValue(window, field(d, 'projectDecision'), '2026-11-20');
  setValue(window, field(d, 'researchReadout'), '2026-11-10');
  const note = unitOf(d, 'projectDecision').querySelector('.date-moved-note');
  assert.ok(note, 'there is a place to say it, on the decision\'s page');
  assert.equal(note.hidden, true, 'nothing was moved');
  assert.equal(note.getAttribute('role'), 'status');

  await go(app, '#plan-details/6');
  setValue(window, field(d, 'projectDecision'), '2026-11-05');
  assert.equal(field(d, 'researchReadout').value, '2026-11-05', 'the rule is as it was: the readout comes back to the decision');
  assert.equal(note.hidden, false);
  assert.equal(text(note), 'Research readout was after this date, so it has been moved to 5 November 2026. You can change it on the next page.');

  setValue(window, field(d, 'projectDecision'), '2026-11-06');
  assert.equal(note.hidden, true, 'a change that moves nothing says nothing');
  setValue(window, field(d, 'projectDecision'), '2026-11-01');
  assert.equal(note.hidden, false);
  setValue(window, field(d, 'researchReadout'), '2026-10-20');
  assert.equal(note.hidden, true, 'and once the readout is set again, it is no longer news');

  // Clear Form starts a new plan, and the note belongs to the old one.
  setValue(window, field(d, 'projectDecision'), '2026-10-01');
  assert.equal(note.hidden, false, 'shown again, so there is something to clear');
  const keep = JSON.parse(window.localStorage.getItem(DRAFT_KEY) || 'null');
  d.getElementById('clear-btn').click();
  await settle();
  assert.equal(note.isConnected ? note.hidden : true, true, 'gone with the plan it was about');
  assert.equal(Array.from(d.querySelectorAll('.doc-header .field-warning')).every((w) => w.hidden), true, 'and so is the buffer warning, which Clear Form used to leave showing');
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify(keep));

  const saved = { version: keep.version, fields: Object.assign({}, keep.fields, { projectDecision: '2026-11-01', researchReadout: '2026-10-20' }), selects: keep.selects, lists: keep.lists, studies: keep.studies, tables: keep.tables, custom: keep.custom };
  const again = await bootApp({ draft: saved });
  t.after(() => again.close());
  assert.equal(unitOf(again.document, 'projectDecision').querySelector('.date-moved-note').hidden, true);
  assert.equal(field(again.document, 'researchReadout').value, '2026-10-20', 'saving and restoring are unaffected');
  assert.equal(field(again.document, 'researchReadout').max, '2026-11-01');
  assert.deepEqual(app.jsdomErrors, []);
  assert.deepEqual(again.jsdomErrors, []);
});

test('Change on the check page opens the right page for each date, and Save and continue comes back', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d } = app;
  completeStep(app, planOf(d));
  await go(app, '#plan-details/1');
  for (let i = 0; i < 10 && !planOf(d).classList.contains('step-checking'); i++) { press(d); await settle(120); }
  assert.ok(planOf(d).classList.contains('step-checking'));
  const change = (name) => Array.from(planOf(d).querySelectorAll('.summary-row')).find((r) => text(r.querySelector('.summary-key')) === name).querySelector('.summary-change');
  change('Research readout').click();
  await settle();
  assert.deepEqual(onScreen(d), ['When will the findings be shared with the team?'], 'the readout\'s own page, not a page of two dates');
  press(d);
  await settle();
  assert.ok(planOf(d).classList.contains('step-checking'), 'and back to the check page');
  change('Project decision').click();
  await settle();
  assert.deepEqual(onScreen(d), ['When will the findings be used to make a decision?']);
  assert.deepEqual(app.jsdomErrors, []);
});

test('the schedule\'s ceiling still follows the readout, and the printed header still sets the two dates side by side', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  setValue(window, field(d, 'projectDecision'), '2026-11-20');
  setValue(window, field(d, 'researchReadout'), '2026-11-10');
  await settle();
  const dates = Array.from(d.querySelectorAll('#stageTimeline-table input[type="date"]'));
  assert.ok(dates.length && dates.every((i) => i.max === '2026-11-10'), 'every stage date stops at the readout (RPA-59): ' + dates.map((i) => i.max).join(','));
  assert.equal(unitOf(d, 'projectDecision').nextElementSibling, unitOf(d, 'researchReadout'), 'neighbours in the header\'s grid, as they print');
  assert.match(CSS.match(/\n\.meta-grid\{([^}]*)\}/)[1], /grid-template-columns:1fr 1fr/, 'two columns in the document');
  assert.doesNotMatch(CSS.slice(CSS.lastIndexOf('@media print')), /page-hidden[^}]*\{[^}]*display:\s*block|meta-grid/, 'print is untouched by this change');
  assert.deepEqual(app.jsdomErrors, []);
});

test('restoring a backup over a plan with later dates brings the backup\'s dates and says nothing was moved', async (t) => {
  // Restoring sets the decision while the old readout is still there, which
  // is exactly the case the note is for; but nobody brought a date forward.
  const source = await bootApp({});
  t.after(() => source.close());
  setValue(source.window, field(source.document, 'researchTitle'), 'From the backup');
  setValue(source.window, field(source.document, 'projectDecision'), '2026-11-05');
  let blob = null;
  source.window.URL.createObjectURL = (b) => { blob = b; return 'blob:backup'; };
  source.window.URL.revokeObjectURL = () => {};
  source.window.HTMLAnchorElement.prototype.click = () => {};
  source.document.getElementById('download-backup-btn').click();
  const backup = await new Promise((resolve) => { const r = new source.window.FileReader(); r.onload = () => resolve(r.result); r.readAsText(blob); });

  const app = await bootApp({ confirm: () => true });
  t.after(() => app.close());
  const { document: d, window } = app;
  setValue(window, field(d, 'projectDecision'), '2026-11-20');
  setValue(window, field(d, 'researchReadout'), '2026-11-18');
  const picker = d.getElementById('backup-file');
  Object.defineProperty(picker, 'files', { configurable: true, value: [new window.File([backup], 'plan.json', { type: 'application/json' })] });
  picker.dispatchEvent(new window.Event('change', { bubbles: true }));
  await waitFor(() => field(d, 'researchTitle').value === 'From the backup');
  await settle();
  assert.equal(field(d, 'projectDecision').value, '2026-11-05');
  assert.equal(field(d, 'researchReadout').value, '', 'the backup had no readout, and the plan has none now: not one the rule made up on the way');
  assert.equal(unitOf(d, 'projectDecision').querySelector('.date-moved-note').hidden, true, 'and the person did not bring a date forward, so nothing is said');
  assert.deepEqual(app.jsdomErrors, []);
});
