'use strict';

// RPA-99. Identify, don't authenticate. In front of the plan stands one
// question, an email address, on a page of its own in the GOV.UK shape:
// the question as the heading, a hint that says why, one box, Continue.
// Why is the link back: a link to the plan will be sent to that address so
// the person can return to it later. The sending is the next piece of
// work and is not built yet (Gus, 15 September 2026); today the address
// is kept in the draft, names the backup file and shows in the Menu with
// Change. Nothing is shown past that page without a well-formed address:
// it stands in front of every step, remembers where the person was going,
// and Continue takes them there. No server, no account, no sign-in: that
// is RPA-84, a later milestone.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp, setValue, waitFor, completeStep, saveAndContinue, toCheckPage, DRAFT_KEY, pagePosition } = require('./app-harness');
const { smallBackup } = require('./rpa-40-fixtures.cjs');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
const TEMPLATE = fs.readFileSync(path.join(__dirname, '..', 'research-plan-template.md'), 'utf8');
const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();
const steps = (d) => Array.from(d.querySelectorAll('.step'));
const visible = (d) => steps(d).filter((s) => !s.hidden).map((s) => s.dataset.stepSlug);
const stepOf = (d, slug) => steps(d).find((s) => s.dataset.stepSlug === slug);
const gateOf = (d) => d.querySelector('.email-step');
const emailOf = (d) => d.querySelector('[data-field="emailAddress"]');
const linksOf = (el) => Array.from(el.querySelectorAll('.error-summary-link')).map(text);
const errorsOf = (el) => Array.from(el.querySelectorAll('.field-error')).map((e) => text(e).replace(/^Error: /, ''));
const press = (el) => el.querySelector('.step-continue').click();
const onScreen = (step) => Array.from(step.querySelectorAll('.title-field, .mf, .field')).filter((u) => !u.hidden && !u.classList.contains('page-hidden') && !u.closest('.page-hidden') && !u.classList.contains('field-methods') && !u.querySelector('[data-field="lastUpdated"]')).map((u) => text(u.querySelector('.flabel, .mlabel, label')));
const panelOf = (step) => Array.from(step.children).find((c) => c.classList.contains('check-answers'));
const rowsOf = (step) => Array.from(panelOf(step).querySelectorAll('.summary-row')).map((r) => text(r.querySelector('.summary-key')));
const draftOf = (window) => JSON.parse(window.localStorage.getItem(DRAFT_KEY) || 'null');
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

test('the template declares the address above the title, and the form opens on a page of its own that asks for it the GOV.UK way', async (t) => {
  const lines = TEMPLATE.replace(/<!--[\s\S]*?-->/g, '').split('\n').map((l) => l.trim()).filter(Boolean);
  assert.ok(lines.indexOf('Email address (email, width=30, question=What is your email address?, key=emailAddress):') < lines.findIndex((l) => l.startsWith('# Research title')), 'declared before the title line: above the plan in the file, in front of it on screen');
  const app = await bootApp({ email: false });
  t.after(() => app.close());
  const { document: d } = app;
  const gate = gateOf(d);
  assert.equal(gate.hidden, false, 'the first thing shown');
  assert.deepEqual(visible(d), [], 'and nothing of the plan with it');
  assert.equal(gate.classList.contains('step'), false, 'not a step: no number, no place in the task list');
  assert.equal(gate.querySelector('.step-top, .step-back, .step-caption, .step-all, .check-answers'), null, 'no Back, no caption, no All sections, no check page');
  const heading = gate.querySelector('.step-heading');
  assert.equal(text(heading), 'What is your email address?');
  const label = heading.querySelector('label');
  assert.equal(label.getAttribute('for'), emailOf(d).id, 'the heading is the label of the box');
  assert.equal(gate.getAttribute('aria-labelledby'), heading.id);
  const hint = gate.querySelector('.field-hint-text');
  assert.equal(text(hint), 'This address identifies your local draft and backup. This app does not send email.');
  const input = emailOf(d);
  assert.equal(input.type, 'email');
  assert.equal(input.getAttribute('autocomplete'), 'email', 'the browser may offer the address it knows');
  assert.equal(input.getAttribute('spellcheck'), 'false', 'an address is not a word');
  assert.equal(input.hasAttribute('placeholder'), false, 'the hint does the explaining, not a placeholder');
  assert.ok(input.classList.contains('input-w-30'), 'sized to an address');
  assert.ok((input.getAttribute('aria-describedby') || '').split(/\s+/).includes(hint.id), 'the hint is read with the box');
  assert.equal(gate.querySelector('.field-help'), null, 'no Help with this section: it is not a question about the research');
  assert.equal(text(gate.querySelector('.step-continue')), 'Continue');
  assert.equal(input.value, '', 'nothing filled in');
  assert.deepEqual(app.jsdomErrors, []);
});

test('judged by shape: the two GOV.UK messages, and the plan opens once the address looks right', async (t) => {
  const app = await bootApp({ email: false });
  t.after(() => app.close());
  const { document: d, window } = app;
  const gate = gateOf(d);
  press(gate);
  assert.equal(gate.hidden, false, 'stays');
  assert.deepEqual(linksOf(gate), ['Enter your email address']);
  assert.deepEqual(errorsOf(gate), ['Enter your email address'], 'the same message at the box');
  assert.equal(d.activeElement, gate.querySelector('.error-summary'), 'focus moves to the summary');
  assert.ok(emailOf(d).closest('.field').classList.contains('field-invalid'));
  assert.ok(gate.querySelector('.field-error').previousElementSibling.classList.contains('field-hint-text'), 'below the hint, above the box');
  setValue(window, emailOf(d), 'gus');
  assert.deepEqual(linksOf(gate), ['Enter an email address in the correct format, like name@example.com'], 'the message follows what is typed');
  for (const wrong of ['gus@', '@example.com', 'gus@example', 'gus example@x.com', 'gus@exam ple.com']) {
    setValue(window, emailOf(d), wrong);
    press(gate);
    assert.deepEqual(linksOf(gate), ['Enter an email address in the correct format, like name@example.com'], JSON.stringify(wrong));
    assert.equal(gate.hidden, false, JSON.stringify(wrong) + ' does not get in');
    assert.deepEqual(visible(d), []);
  }
  setValue(window, emailOf(d), ' gus.berumen@example.co.uk ');
  assert.deepEqual(linksOf(gate), [], 'a well-formed address, spaces around it forgiven');
  assert.equal(emailOf(d).closest('.field').classList.contains('field-invalid'), false);
  press(gate);
  assert.equal(gate.hidden, true);
  assert.deepEqual(visible(d), ['sections'], 'the plan opens on its task list');
  assert.equal(d.activeElement, d.getElementById('task-list-heading'), 'focus lands where the plan begins');
  assert.equal(window.location.hash, '#sections');
  assert.deepEqual(app.jsdomErrors, []);
});

test('it stands in front of every step and remembers where the person was going: a link, and a saved draft from before it', async (t) => {
  const linked = await bootApp({ email: false, url: 'https://research-plan.test/#plan-details' });
  t.after(() => linked.close());
  assert.equal(gateOf(linked.document).hidden, false, 'a link to a step meets the page first');
  assert.deepEqual(visible(linked.document), []);
  setValue(linked.window, emailOf(linked.document), 'gus@example.com');
  press(gateOf(linked.document));
  assert.deepEqual(visible(linked.document), ['plan-details'], 'then lands where the link pointed');
  const plan = stepOf(linked.document, 'plan-details');
  assert.deepEqual(onScreen(plan), ['What is the name of your research plan?'], 'Plan details is as it was: the address is not one of its questions');
  assert.equal(pagePosition(plan), 1);

  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  const details = await onStep(app, 'plan-details');
  completeStep(app, details);
  saveAndContinue(details);
  assert.deepEqual(visible(d), ['context']);
  const saved = await waitFor(() => { const dr = draftOf(window); return dr && dr.ui && dr.ui.section === 'context' && dr; });
  const older = structuredClone(saved);
  delete older.fields.emailAddress;
  older.fields.lastUpdated = '2020-01-01';
  older.lastUpdatedManual = false;
  const before = await bootApp({ draft: older, email: false });
  t.after(() => before.close());
  assert.equal(gateOf(before.document).hidden, false, 'a draft from before RPA-99 meets the page too');
  assert.equal(emailOf(before.document).value, '');
  setValue(before.window, emailOf(before.document), 'gus@example.com');
  press(gateOf(before.document));
  assert.deepEqual(visible(before.document), ['context'], 'and carries on where it was left');
  const signedIn = await waitFor(() => { const dr = draftOf(before.window); return dr && dr.fields.emailAddress === 'gus@example.com' && dr; });
  assert.equal(signedIn.fields.lastUpdated, '2020-01-01', 'giving the address is not editing the plan: Last updated stands');
  assert.equal(before.document.querySelector('[data-field="lastUpdated"]').value, '2020-01-01');
  assert.deepEqual(before.jsdomErrors, []);
});

test('kept in the draft and restored with it, so a return does not ask again; the Menu names the address, and Change goes back to the page', async (t) => {
  const app = await bootApp({ email: 'gus@example.com' });
  t.after(() => app.close());
  const { document: d, window } = app;
  const saved = await waitFor(() => { const dr = draftOf(window); return dr && dr.fields.emailAddress === 'gus@example.com' && dr; });
  const person = d.getElementById('options-plan-person');
  assert.equal(person.hidden, false);
  assert.equal(text(d.getElementById('options-plan-person-email')), 'gus@example.com', 'under the plan\'s name');
  assert.equal(text(d.getElementById('options-plan-change')), 'Change email address');
  const plan = await onStep(app, 'plan-details');
  d.getElementById('menu-btn').click();
  d.getElementById('options-plan-change').click();
  assert.equal(d.getElementById('options-menu').hidden, true, 'the menu closes');
  assert.equal(gateOf(d).hidden, false, 'the page comes back over the plan');
  assert.deepEqual(visible(d), []);
  assert.equal(d.activeElement, gateOf(d).querySelector('.step-heading'));
  setValue(window, emailOf(d), 'gus.berumen@example.com');
  press(gateOf(d));
  assert.deepEqual(visible(d), ['plan-details'], 'and Continue returns to the step it covered');
  assert.equal(text(d.getElementById('options-plan-person-email')), 'gus.berumen@example.com');
  assert.equal(plan.hidden, false);

  const reopened = await bootApp({ draft: saved, email: false });
  t.after(() => reopened.close());
  assert.equal(gateOf(reopened.document).hidden, true, 'not asked again');
  assert.deepEqual(visible(reopened.document), ['sections']);
  assert.equal(emailOf(reopened.document).value, 'gus@example.com', 'restored');
  assert.equal(text(reopened.document.getElementById('options-plan-person-email')), 'gus@example.com');
  assert.deepEqual(app.jsdomErrors, []);
});

test('the backup file carries the address in its name, after the plan\'s name and before the date', async (t) => {
  const app = await bootApp({ email: 'gus@example.com' });
  t.after(() => app.close());
  const { document: d, window } = app;
  await waitFor(() => !d.getElementById('download-backup-btn').disabled);
  const download = interceptDownload(app);
  setValue(window, d.querySelector('[data-field="researchTitle"]'), 'Checkout study');
  assert.match(download(), /^Checkout study - gus@example\.com - backup \d{4}-\d{2}-\d{2}\.json$/);
  setValue(window, d.querySelector('[data-field="researchTitle"]'), '');
  assert.match(download(), /^Untitled plan - gus@example\.com - backup /, 'the untitled fallback keeps the address');
  setValue(window, emailOf(d), 'a<b>"c/d\\e:f|g?h*i@example.com');
  assert.match(download(), /^Untitled plan - a b c d e f g h i@example\.com - backup /, 'the characters a file name cannot hold become spaces, as for the title');
  setValue(window, emailOf(d), '');
  assert.match(download(), /^Untitled plan - backup \d{4}-\d{2}-\d{2}\.json$/, 'no address, no change to the name');
});

async function importBackup(app, data) {
  const file = new app.window.File([JSON.stringify(data)], 'plan.json', { type: 'application/json' });
  const picker = app.document.getElementById('backup-file');
  Object.defineProperty(picker, 'files', { configurable: true, value: [file] });
  picker.dispatchEvent(new app.window.Event('change', { bubbles: true }));
  await waitFor(() => !app.document.getElementById('restore-backup-btn').disabled);
  return app.document.getElementById('backup-status').textContent;
}

test('a backup restore replaces the plan, not the person: the address stays, and an untouched plan with only an address restores without a confirmation', async (t) => {
  let confirms = 0;
  const app = await bootApp({ email: 'gus@example.com', confirm() { confirms++; return true; } });
  t.after(() => app.close());
  const { document: d, window } = app;
  await waitFor(() => !d.getElementById('restore-backup-btn').disabled);
  const theirs = smallBackup();
  theirs.fields.emailAddress = 'max@example.com';
  assert.match(await importBackup(app, theirs), /^Backup restored and saved/);
  assert.equal(confirms, 0, 'an address alone is not writing a backup would replace');
  assert.equal(emailOf(d).value, 'gus@example.com', 'a colleague\'s backup does not make the plan theirs at this keyboard');
  assert.equal(d.querySelector('[data-field="researchTitle"]').value, theirs.fields.researchTitle, 'the plan is theirs');
  assert.equal(gateOf(d).hidden, true, 'no page in the way');
  assert.equal(d.getElementById('options-plan-person-email').textContent, 'gus@example.com');
  const saved = await waitFor(() => { const dr = draftOf(window); return dr && dr.fields.researchTitle === theirs.fields.researchTitle && dr; });
  assert.equal(saved.fields.emailAddress, 'gus@example.com', 'saved that way too');

  const fresh = await bootApp({ email: false });
  t.after(() => fresh.close());
  const mine = smallBackup();
  mine.fields.emailAddress = 'gus@example.com';
  await waitFor(() => !fresh.document.getElementById('restore-backup-btn').disabled);
  assert.match(await importBackup(fresh, mine), /^Backup restored and saved/);
  assert.equal(emailOf(fresh.document).value, 'gus@example.com', 'where none was given yet, the backup\'s own address fills in');
  assert.equal(gateOf(fresh.document).hidden, true, 'and the plan opens without asking');
  assert.deepEqual(app.jsdomErrors, []);
});

// ---------- what the GOV.UK Pay team did: play it back, catch the slip ----------
const playbackOf = (d) => d.querySelector('.email-playback');
const suggestOf = (d) => d.querySelector('.email-suggest');
const offered = (d) => Array.from(suggestOf(d).querySelectorAll('.radio-input')).map((r) => r.value);

test('the address is played back under the box as it is typed, and again when the page is reopened with one saved', async (t) => {
  const app = await bootApp({ email: false });
  t.after(() => app.close());
  const { document: d, window } = app;
  const playback = playbackOf(d);
  assert.equal(playback.hidden, true, 'nothing to play back yet');
  assert.ok(playback.closest('.field-email') && playback.previousElementSibling === emailOf(d), 'inset under the box');
  setValue(window, emailOf(d), 'joeb');
  assert.equal(playback.hidden, false);
  assert.equal(text(playback.querySelector('.email-playback-lead')), 'Email address for this browser:');
  assert.equal(text(playback.querySelector('.email-playback-value')), 'joeb');
  setValue(window, emailOf(d), ' joebloggs@hotmail.com ');
  assert.equal(text(playback.querySelector('.email-playback-value')), 'joebloggs@hotmail.com', 'as typed, the spaces aside');
  setValue(window, emailOf(d), '');
  assert.equal(playback.hidden, true, 'and gone when the box is emptied');
  assert.equal(playback.getAttribute('aria-live'), null, 'not read out on every keystroke: the box already is');

  const back = await bootApp({ email: 'gus@example.com' });
  t.after(() => back.close());
  back.document.getElementById('menu-btn').click();
  back.document.getElementById('options-plan-change').click();
  assert.equal(playbackOf(back.document).hidden, false, 'a saved address is played back when the page comes back');
  assert.equal(text(playbackOf(back.document).querySelector('.email-playback-value')), 'gus@example.com');
  assert.deepEqual(app.jsdomErrors, []);
});

test('a likely slip in the last part is offered as a choice on Continue, the likely address first and already selected, and taking it opens the plan', async (t) => {
  const app = await bootApp({ email: false });
  t.after(() => app.close());
  const { document: d, window } = app;
  const gate = gateOf(d);
  setValue(window, emailOf(d), 'joebloggs@hotnail.com');
  press(gate);
  assert.equal(gate.hidden, false, 'Continue waits');
  assert.deepEqual(visible(d), []);
  assert.equal(gate.querySelector('.error-summary').hidden, true, 'not an error: no summary, no red box');
  assert.equal(emailOf(d).closest('.field').classList.contains('field-invalid'), false);
  const suggest = suggestOf(d);
  assert.equal(suggest.hidden, false);
  assert.ok(suggest.previousElementSibling === playbackOf(d), 'under the playback, inside the question');
  assert.equal(text(suggest.querySelector('legend')), 'There might be a mistake in the last part of your email address. Select your email address.');
  assert.equal(d.activeElement, suggest.querySelector('legend'), 'focus goes to the offer');
  assert.deepEqual(offered(d), ['joebloggs@hotmail.com', 'joebloggs@hotnail.com'], 'the likely address first, the typed one second');
  const radios = suggest.querySelectorAll('.radio-input');
  assert.equal(radios[0].checked, true, 'the likely one already selected');
  assert.equal(suggest.querySelector('label[for="' + radios[0].id + '"]').innerHTML, 'joebloggs@<b>hotmail.com</b>', 'the part that changed in bold');
  assert.equal(text(suggest.querySelector('label[for="' + radios[1].id + '"]')), 'joebloggs@hotnail.com');
  assert.equal(emailOf(d).value, 'joebloggs@hotnail.com', 'the box is as typed until a choice is made');
  press(gate);
  assert.equal(gate.hidden, true, 'Continue takes the selected address');
  assert.deepEqual(visible(d), ['sections']);
  assert.equal(emailOf(d).value, 'joebloggs@hotmail.com');
  const saved = await waitFor(() => { const dr = draftOf(window); return dr && dr.fields.emailAddress === 'joebloggs@hotmail.com' && dr; });
  assert.equal(saved.fields.emailAddress, 'joebloggs@hotmail.com', 'and that is what is kept');
  assert.deepEqual(app.jsdomErrors, []);
});

test('the typed address stands if the person says so; choosing puts the address in the box and the playback; typing again withdraws the offer', async (t) => {
  const app = await bootApp({ email: false });
  t.after(() => app.close());
  const { document: d, window } = app;
  const gate = gateOf(d);
  setValue(window, emailOf(d), 'gus@ocado.con');
  press(gate);
  assert.deepEqual(offered(d), ['gus@ocado.com', 'gus@ocado.con'], 'a company domain is judged at its ending');
  const [likely, typed] = suggestOf(d).querySelectorAll('.radio-input');
  typed.click();
  assert.equal(emailOf(d).value, 'gus@ocado.con');
  likely.click();
  assert.equal(emailOf(d).value, 'gus@ocado.com', 'the choice goes into the box at once');
  assert.equal(text(playbackOf(d).querySelector('.email-playback-value')), 'gus@ocado.com', 'and is played back');
  typed.click();
  assert.equal(emailOf(d).value, 'gus@ocado.con', 'back to the typed one');
  assert.equal(suggestOf(d).hidden, false, 'the offer stays while choosing');
  press(gate);
  assert.equal(gate.hidden, true, 'the typed address stands');
  assert.equal(emailOf(d).value, 'gus@ocado.con');
  const saved = await waitFor(() => { const dr = draftOf(window); return dr && dr.fields.emailAddress === 'gus@ocado.con' && dr; });
  assert.equal(saved.fields.emailAddress, 'gus@ocado.con');

  d.getElementById('menu-btn').click();
  d.getElementById('options-plan-change').click();
  assert.equal(suggestOf(d).hidden, true, 'the page comes back without the old offer');
  setValue(window, emailOf(d), 'gus@ocado.cmo');
  press(gate);
  assert.deepEqual(offered(d), ['gus@ocado.com', 'gus@ocado.cmo']);
  setValue(window, emailOf(d), 'gus@ocado.cm');
  assert.equal(suggestOf(d).hidden, true, 'typing again withdraws the offer');
  press(gate);
  assert.deepEqual(offered(d), ['gus@ocado.com', 'gus@ocado.cm'], 'and Continue judges the new address afresh');
  setValue(window, emailOf(d), 'gus@ocado.com');
  press(gate);
  assert.equal(gate.hidden, true, 'a known ending needs no offer');
  assert.deepEqual(app.jsdomErrors, []);
});

test('what is offered and what is left alone: common providers, endings, a subdomain, and short names judged strictly', async (t) => {
  const app = await bootApp({ email: false });
  t.after(() => app.close());
  const { document: d, window } = app;
  const gate = gateOf(d);
  const offer = (typed) => {
    if (gate.hidden) { d.getElementById('menu-btn').click(); d.getElementById('options-plan-change').click(); }
    setValue(window, emailOf(d), typed);
    press(gate);
    return suggestOf(d).hidden ? null : offered(d)[0];
  };
  const cases = [
    ['a@gmial.com', 'a@gmail.com'],
    ['a@gamil.com', 'a@gmail.com'],
    ['a@hotmail.con', 'a@hotmail.com'],
    ['a@Hotnail.com', 'a@hotmail.com'],
    ['a@yaho.co.uk', 'a@yahoo.co.uk'],
    ['a@outlok.com', 'a@outlook.com'],
    ['a@ocado.co', 'a@ocado.com'],
    ['a@ocado.couk', 'a@ocado.co.uk'],
    ['a@ocado.co.ukk', 'a@ocado.co.uk'],
    ['a@mail.ocado.con', 'a@mail.ocado.com'],
    ['a@ocado.com', null],
    ['a@yahoo.co.uk', null],
    ['a@Gmail.com', null],
    ['a@mail.com', null],
    ['a@bbc.com', null],
    ['a@ocado.org.uk', null],
    ['a@ocado.ai', null],
    ['a@mail.ocado.com', null],
  ];
  for (const [typed, expected] of cases) assert.equal(offer(typed), expected, typed);
  assert.deepEqual(app.jsdomErrors, []);
});

test('not a question of the plan: absent from the check page and the print, kept through Clear Form', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d } = app;
  const plan = await onStep(app, 'plan-details');
  completeStep(app, plan);
  toCheckPage(plan);
  assert.deepEqual(rowsOf(plan), ['Research title', 'Project name', 'Lead researcher', 'Other researchers', 'Researcher names', 'Project requester', 'Project decision', 'Research readout'], 'the section\'s own questions, and the address is not among them');
  assert.equal(d.querySelector('.doc-header [data-field="emailAddress"]'), null, 'not in the document\'s header');
  d.getElementById('clear-btn').click();
  assert.equal(emailOf(d).value, 'name@example.com', 'Clear Form resets the plan, not the person');
  assert.equal(d.querySelector('[data-field="researchTitle"]').value, '');
  const print = CSS.slice(CSS.lastIndexOf('@media print'));
  assert.match(print, /\.email-step/, 'in the print hide-list: the page does not print');
  assert.deepEqual(app.jsdomErrors, []);
});
