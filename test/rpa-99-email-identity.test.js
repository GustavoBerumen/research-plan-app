'use strict';

// RPA-99. Identify, don't authenticate. The form opens by asking for an
// email address, the GOV.UK way: it is the first page of Plan details,
// judged by shape only, kept in the draft like any other header field, and
// it names the backup file and prints in the document's top row beside the
// dateline, so a plan found later is recognisably whose it is. Nothing is
// sent to the address and there is no server, no account and no sign-in:
// that is RPA-84, a later milestone. Gus, 15 September 2026.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp, setValue, waitFor, completeStep, saveAndContinue, toCheckPage, DRAFT_KEY } = require('./app-harness');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
const TEMPLATE = fs.readFileSync(path.join(__dirname, '..', 'research-plan-template.md'), 'utf8');
const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();
const steps = (d) => Array.from(d.querySelectorAll('.step'));
const visible = (d) => steps(d).filter((s) => !s.hidden).map((s) => s.dataset.stepSlug);
const stepOf = (d, slug) => steps(d).find((s) => s.dataset.stepSlug === slug);
const onScreen = (step) => Array.from(step.querySelectorAll('.title-field, .mf, .field')).filter((u) => !u.classList.contains('page-hidden') && !u.closest('.page-hidden') && !u.classList.contains('field-methods') && !u.querySelector('[data-field="lastUpdated"]')).map((u) => text(u.querySelector('.flabel, .mlabel, label')));
const caption = (step) => text(step.querySelector('.step-page-caption'));
const linksOf = (step) => Array.from(step.querySelectorAll('.error-summary-link')).map(text);
const errorsOf = (step) => Array.from(step.querySelectorAll('.field-error')).map((e) => text(e).replace(/^Error: /, ''));
const press = (step) => step.querySelector('.step-continue').click();
const panelOf = (step) => Array.from(step.children).find((c) => c.classList.contains('check-answers'));
const rowsOf = (step) => Array.from(panelOf(step).querySelectorAll('.summary-row')).map((r) => [text(r.querySelector('.summary-key')), text(r.querySelector('.summary-value'))]);
const draftOf = (window) => JSON.parse(window.localStorage.getItem(DRAFT_KEY) || 'null');
const emailOf = (d) => d.querySelector('[data-field="emailAddress"]');
async function onStep(app, slug) {
  app.window.location.hash = '#' + slug;
  await waitFor(() => visible(app.document)[0] === slug);
  return stepOf(app.document, slug);
}
function interceptDownload(app) {
  let download;
  app.window.URL.createObjectURL = () => { download = {}; return 'blob:local-backup'; };
  app.window.URL.revokeObjectURL = () => {};
  app.window.HTMLAnchorElement.prototype.click = function () { download.name = this.download; };
  return () => { app.document.getElementById('download-backup-btn').click(); assert.ok(download, 'a download started'); return download.name; };
}

test('the template asks for the email address above the title, and the form opens Plan details with it, asked the GOV.UK way', async (t) => {
  const lines = TEMPLATE.replace(/<!--[\s\S]*?-->/g, '').split('\n').map((l) => l.trim()).filter(Boolean);
  assert.ok(lines.indexOf('Email address (email, key=emailAddress):') < lines.findIndex((l) => l.startsWith('# Research title')), 'declared before the title line: file order is screen order');
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d } = app;
  const plan = await onStep(app, 'plan-details');
  assert.deepEqual(onScreen(plan), ['Email address'], 'the first page, on its own');
  assert.equal(caption(plan), 'Question 1 of 6');
  const input = emailOf(d);
  assert.equal(input.type, 'email');
  assert.equal(input.getAttribute('autocomplete'), 'email', 'the browser may offer the address it knows');
  assert.equal(input.getAttribute('spellcheck'), 'false', 'an address is not a word');
  assert.equal(input.hasAttribute('placeholder'), false, 'the hint does the explaining, not a placeholder');
  const group = input.closest('.mf');
  assert.ok(group.classList.contains('mf-first'));
  assert.equal(text(group.querySelector('.mlabel')), 'Email address');
  assert.match(text(group.querySelector('.field-hint-text')), /^So the plan can be recognised as yours: .* Nothing is sent to it\.$/);
  assert.ok((input.getAttribute('aria-describedby') || '').split(/\s+/).includes(group.querySelector('.field-hint-text').id), 'the hint is read with the box');
  const top = group.closest('.doc-header-top');
  assert.ok(top, 'in the document\'s top row');
  assert.ok(top.querySelector('[data-field="lastUpdated"]'), 'beside the dateline');
  assert.ok(group.compareDocumentPosition(top.querySelector('[data-field="lastUpdated"]')) & 4, 'the address first, the date after it');
  assert.ok(group.querySelector('.field-help'), 'it has Help with this field like every other field (RPA-107)');
  assert.deepEqual(app.jsdomErrors, []);
});

test('judged by shape: the two GOV.UK messages, and the page moves on once the address looks right', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  const plan = await onStep(app, 'plan-details');
  press(plan);
  assert.deepEqual(visible(d), ['plan-details'], 'stays');
  assert.deepEqual(linksOf(plan), ['Enter your email address']);
  assert.deepEqual(errorsOf(plan), ['Enter your email address'], 'the same message at the field');
  assert.ok(emailOf(d).closest('.mf').classList.contains('field-invalid'));
  setValue(window, emailOf(d), 'gus');
  assert.deepEqual(linksOf(plan), ['Enter an email address in the correct format, like name@example.com'], 'the message follows what is typed');
  for (const wrong of ['gus@', '@example.com', 'gus@example', 'gus example@x.com', 'gus@exam ple.com']) {
    setValue(window, emailOf(d), wrong);
    press(plan);
    assert.deepEqual(linksOf(plan), ['Enter an email address in the correct format, like name@example.com'], JSON.stringify(wrong));
    assert.deepEqual(visible(d), ['plan-details'], JSON.stringify(wrong) + ' does not move on');
  }
  setValue(window, emailOf(d), ' gus.berumen@example.co.uk ');
  assert.deepEqual(linksOf(plan), [], 'a well-formed address, spaces around it forgiven');
  assert.equal(emailOf(d).closest('.mf').classList.contains('field-invalid'), false);
  press(plan);
  assert.deepEqual(onScreen(plan), ['Research title'], 'on to the title');
  assert.equal(caption(plan), 'Question 2 of 6');
  assert.deepEqual(app.jsdomErrors, []);
});

test('the last page judges the address too: a malformed one holds Plan details at incomplete, and the summary link opens its page', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  const plan = await onStep(app, 'plan-details');
  completeStep(app, plan);
  for (let k = 0; k < 5; k++) press(plan);
  assert.equal(caption(plan), 'Question 6 of 6');
  setValue(window, emailOf(d), 'not-an-address');   // spoiled from another page, as a Change from the review could
  press(plan);
  assert.deepEqual(visible(d), ['plan-details'], 'stays');
  assert.deepEqual(linksOf(plan), ['Enter an email address in the correct format, like name@example.com']);
  plan.querySelector('.error-summary-link').click();
  assert.deepEqual(onScreen(plan), ['Email address'], 'the link opened the first page');
  assert.equal(d.activeElement, emailOf(d));
  setValue(window, emailOf(d), 'gus@example.com');
  assert.equal(plan.querySelector('.error-summary').hidden, true);
  saveAndContinue(plan);
  assert.deepEqual(visible(d), ['context'], 'complete now');
  assert.deepEqual(app.jsdomErrors, []);
});

test('kept in the draft and restored with it; the menu names whose plan it is; an older draft without it opens with the box empty', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  const plan = await onStep(app, 'plan-details');
  const person = d.getElementById('options-plan-person');
  assert.equal(person.hidden, true, 'nothing to say until an address is given');
  setValue(window, emailOf(d), 'gus@example.com');
  press(plan);
  setValue(window, d.querySelector('[data-field="researchTitle"]'), 'Checkout study');
  const saved = await waitFor(() => { const dr = draftOf(window); return dr && dr.fields.emailAddress === 'gus@example.com' && dr.fields.researchTitle === 'Checkout study' && dr; });
  assert.equal(text(d.getElementById('options-plan-name')), 'Checkout study');
  assert.equal(person.hidden, false);
  assert.equal(text(person), 'gus@example.com', 'under the plan\'s name');
  setValue(window, emailOf(d), '');
  assert.equal(person.hidden, true, 'and gone again when the box is emptied');

  const reopened = await bootApp({ draft: saved });
  t.after(() => reopened.close());
  assert.equal(emailOf(reopened.document).value, 'gus@example.com', 'restored');
  assert.equal(text(reopened.document.getElementById('options-plan-person')), 'gus@example.com');
  assert.equal(reopened.document.getElementById('options-plan-person').hidden, false);

  const older = structuredClone(saved);
  delete older.fields.emailAddress;
  const before = await bootApp({ draft: older });
  t.after(() => before.close());
  assert.equal(emailOf(before.document).value, '', 'a draft from before RPA-99 opens with the question unanswered');
  assert.equal(before.document.getElementById('options-plan-person').hidden, true);
  assert.deepEqual(before.jsdomErrors, []);
  assert.deepEqual(app.jsdomErrors, []);
});

test('the backup file carries the address in its name, after the plan\'s name and before the date', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  await onStep(app, 'plan-details');
  await waitFor(() => !d.getElementById('download-backup-btn').disabled);
  const download = interceptDownload(app);
  setValue(window, d.querySelector('[data-field="researchTitle"]'), 'Checkout study');
  assert.match(download(), /^Checkout study - backup \d{4}-\d{2}-\d{2}\.json$/, 'no address, no change to the name');
  setValue(window, emailOf(d), 'gus@example.com');
  assert.match(download(), /^Checkout study - gus@example\.com - backup \d{4}-\d{2}-\d{2}\.json$/);
  setValue(window, d.querySelector('[data-field="researchTitle"]'), '');
  assert.match(download(), /^Untitled plan - gus@example\.com - backup /, 'the untitled fallback keeps the address');
  setValue(window, emailOf(d), 'a<b>"c/d\\e:f|g?h*i@example.com');
  assert.match(download(), /^Untitled plan - a b c d e f g h i@example\.com - backup /, 'the characters a file name cannot hold become spaces, as for the title');
});

test('the check page and the review list name it first, Clear Form empties it, and it prints in the top row', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d } = app;
  const plan = await onStep(app, 'plan-details');
  completeStep(app, plan);
  toCheckPage(plan);
  assert.deepEqual(rowsOf(plan)[0], ['Email address', 'name@example.com']);
  assert.equal(rowsOf(plan).length, 7, 'the six questions of the section, the dates as two rows; the dateline is not a question');
  d.getElementById('clear-btn').click();
  assert.equal(emailOf(d).value, '', 'Clear Form clears an email box as it does a text box');
  const print = CSS.slice(CSS.lastIndexOf('@media print'));
  assert.doesNotMatch(print, /mf-first|doc-header-top/, 'print keeps the top row, address and dateline both');
  assert.match(CSS, /\.mf-first\{[^}]*margin-right:auto/, 'the address holds the left of the row and the dateline the right');
  assert.deepEqual(app.jsdomErrors, []);
});
