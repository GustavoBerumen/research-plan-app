'use strict';

// RPA-119, the rows Gus wrote on 18 September 2026 for the fields the first
// pass left without their words: the sample size, previous knowledge, and
// the sign-off's role question and declarations. With them, two things the
// form can do that it could not: an option can carry a hint of its own, and
// a field can leave its help link to the field below it. And the sample
// size's bands were renamed, so a plan saved under the old names opens with
// its choice intact, and the contract accepts either name on the wire.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const contract = require('../submission-contract');
const { plan, legacyPlan } = require('./rpa-64-fixtures.cjs');
const { bootApp, waitFor, DRAFT_KEY } = require('./app-harness');

const TEMPLATE = fs.readFileSync(path.join(__dirname, '..', 'research-plan-template.md'), 'utf8');
const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();
const settle = () => new Promise((r) => setTimeout(r, 250));
const draftOf = (window) => JSON.parse(window.localStorage.getItem(DRAFT_KEY) || 'null');
const helpOf = (wrap) => wrap.querySelector(':scope > .field-help');
const bodyOf = (wrap) => Array.from(helpOf(wrap).querySelectorAll('.field-help-body > *')).map((k) => k.tagName + ':' + (k.tagName === 'UL' ? Array.from(k.children).map(text).join(' ') : text(k)));
const NEW = ['1 to 5', '6 to 12', '13 to 29', '30 or more'];
const OLD = ['Small (1–5)', 'Medium (6–12)', 'Large (13–29)', 'Very Large (30+)'];

test('the sample size: the bands under their new names, each with what it is for, and the note in Gus\'s words', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const d = app.document;
  const field = d.querySelector('.radio-group[data-field-key="sampleSize"]').closest('.field');
  assert.equal(text(field.querySelector('legend')), 'How many participants do you need?');
  assert.equal(text(field.querySelector('.field-hint-text')), 'Choose the sample size that best matches your research approach.');
  const items = Array.from(field.querySelectorAll('.radio-item'));
  assert.deepEqual(items.map((i) => i.querySelector('input').value), NEW.concat('__other__'));
  assert.deepEqual(items.map((i) => text(i.querySelector('.radio-hint'))), ['to spot major issues and early feedback', 'to explore needs and identify recurring themes', 'to compare groups or spot trends', 'to measure patterns across a larger audience', '']);
  items.slice(0, 4).forEach((i) => {
    const hint = i.querySelector('.radio-hint');
    assert.equal(i.querySelector('input').getAttribute('aria-describedby'), hint.id, 'the option is described by its hint');
    assert.equal(hint.previousElementSibling, i.querySelector('label'), 'the hint follows the label');
  });
  assert.equal(items[4].querySelector('.radio-hint'), null, 'Other has none');
  assert.equal(text(helpOf(field).querySelector('summary')), 'Help with this section');
  assert.deepEqual(bodyOf(field), [
    'P:Participant numbers should reflect what is practical and good enough to inform your team\'s decision.',
    'UL:Just a few users (1–5): Even a single participant can expose a broken workflow. A focused group (6–12): Responses generally reach saturation, where you stop hearing new themes, within this range. Larger groups (30+): Needed when you are measuring metrics, validating trends across diverse cohorts, or running surveys.',
    'P:Pick the band that matches your method and constraints. You can adjust this estimate later.',
  ]);
  assert.deepEqual(Array.from(helpOf(field).querySelectorAll('li strong')).map(text), ['Just a few users (1–5):', 'A focused group (6–12):', 'Larger groups (30+):']);
  assert.deepEqual(app.jsdomErrors, []);
});

test('an option\'s hint is not part of the value: the draft, the check page and the record carry the band\'s name alone', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  d.querySelector('.radio-group[data-field-key="sampleSize"] input[value="13 to 29"]').click();
  const saved = await waitFor(() => { const s = draftOf(window); return s && s.studies && s.studies[0] && s.studies[0].sampleSize.v === '13 to 29' && s; });
  assert.deepEqual(saved.studies[0].sampleSize, { v: '13 to 29', o: '' });
  assert.deepEqual(contract.SAMPLE_SIZES, NEW, 'the contract names the bands as the form does');
  assert.match(TEMPLATE, /^Sample Size \(radios, perQuestion, [^\n]*\): 1 to 5 \| to spot major issues and early feedback,6 to 12 \| /m, 'the hint after " | " in the template');
  assert.deepEqual(app.jsdomErrors, []);
});

test('a plan saved under the bands\' old names opens with its choice, saved again under the new; the contract accepts either on the wire', async (t) => {
  const draft = plan();
  draft.signOff = null;
  draft.fields.emailAddress = 'name@example.com';
  draft.studies[0].sampleSize = { v: 'Large (13–29)', o: '' };
  const app = await bootApp({ draft });
  t.after(() => app.close());
  const { document: d, window } = app;
  const checked = d.querySelector('.radio-group[data-field-key="sampleSize"] input:checked');
  assert.equal(checked && checked.value, '13 to 29', 'the old name chooses the new band');
  d.querySelector('[data-field="researchTitle"]').dispatchEvent(new window.Event('input', { bubbles: true }));
  const saved = await waitFor(() => { const s = draftOf(window); return s && s.studies[0].sampleSize.v === '13 to 29' && s; });
  assert.deepEqual(saved.studies[0].sampleSize, { v: '13 to 29', o: '' }, 'saved under the new name from then on');

  assert.deepEqual(contract.LEGACY_SAMPLE_SIZES, OLD);
  for (const name of NEW.concat(OLD)) {
    const p = plan(); p.studies[0].sampleSize = { v: name, o: '' };
    assert.deepEqual(contract.validate(p), [], 'v2 accepts ' + name);
    const legacy = legacyPlan(); legacy.methods[0].sampleSize = { v: name, o: '' };
    assert.deepEqual(contract.validate(legacy), [], 'v1 accepts ' + name);
  }
  const p = plan(); p.studies[0].sampleSize = { v: 'Huge', o: '' };
  assert.deepEqual(contract.validate(p).map((e) => e.code), ['choice'], 'a name that was never a band is refused');
  assert.deepEqual(app.jsdomErrors, []);
});

test('previous knowledge is asked as a question, optional once, with its hint and its note', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const d = app.document;
  const field = d.querySelector('#previousKnowledge-table').closest('.field');
  const label = field.querySelector('.flabel');
  assert.equal(text(label), 'Is there any existing research or documentation to review? (optional)');
  assert.equal(label.querySelectorAll('.fopt').length, 1, '"(optional)" once, from the flag, not written into the question');
  assert.equal(text(field.querySelector('.field-hint-text')), 'Attach or link prior findings, analytics reports, or past studies relevant to this work.');
  assert.equal(text(helpOf(field).querySelector('summary')), 'Why we ask for existing research');
  assert.deepEqual(bodyOf(field), [
    'P:Reviewing existing findings prevents repeating work the team has already done and helps you build on what is already known.',
    'P:Adding relevant past documentation helps you:',
    'UL:Avoid duplication: Ensure you do not spend time and budget investigating questions that have already been answered. Build on existing evidence: Connect past analytics, customer feedback, or usability reports to ground your current study. Focus on real knowledge gaps: Spend research sessions uncovering new insights rather than re-proving known problems.',
    'P:This step is optional. Add links or files if you have them, or skip ahead if this is an entirely new exploration.',
  ]);
  assert.deepEqual(app.jsdomErrors, []);
});

test('with uploads off, the hint asks for links and says why, without the attaching this build cannot do', async (t) => {
  const app = await bootApp({ configResponse: async () => ({ ok: true, status: 200, json: async () => ({ pilotMode: true,
    capabilities: { submissions: false, feedback: true, calibration: false, uploads: false, addFramework: false, jira: false, googleDrive: false } }) }) });
  t.after(() => app.close());
  const field = app.document.querySelector('#previousKnowledge-table').closest('.field');
  await settle();
  assert.equal(text(field.querySelector('.field-hint-text')), 'Link prior findings, analytics reports, or past studies relevant to this work. Saved file references are kept; attachment contents are unavailable through this app.');
  assert.deepEqual(app.jsdomErrors, []);
});

test('the sign-off: a note on the role question, and one "What signing off means" per sign-off covering its declaration too', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const d = app.document;
  const role = d.querySelector('.sign-off-setup fieldset.field-radios');
  assert.equal(text(role.querySelector('legend')), 'Which of these are you?');
  assert.equal(text(helpOf(role).querySelector('summary')), 'Why both roles need to sign off');
  assert.deepEqual(bodyOf(role), [
    'P:Signing off confirms that the researcher and the project lead are aligned before research begins.',
    'P:Each role signs for a different reason:',
    'UL:Lead researcher: Signs to confirm the research method, timeline, and participant criteria are practical and ready to run. Project requester: Signs to confirm the plan covers their business questions and that the team is ready to act on the findings.',
    'P:Both people review and sign on this device. Once both have completed their review, the plan is locked and ready for testing.',
  ]);
  assert.equal(helpOf(role).open, false, 'closed, like every note');

  for (const [declaration, initials, words] of [
    ['declarationResearcher', 'signOffResearcher', ['P:Entering your initials and confirming the declaration locks your approval as the lead researcher.', 'P:It confirms that the scope, methods, and schedule are realistic and ready to run. Once submitted, you will hand this device to the project requester to complete their review.']],
    ['declarationRequester', 'signOffProjectOwner', ['P:Entering your initials and confirming the declaration locks your approval as the project requester.', 'P:It confirms that the research directly supports your project goals and the delivery timeline meets your needs. If the scope, dates, or focus are not quite right, select Request changes instead to send feedback to the researcher.']],
  ]) {
    const box = d.querySelector('[data-field="' + declaration + '"]').closest('.field');
    const sign = d.querySelector('[data-field="' + initials + '"]').closest('.field');
    assert.equal(helpOf(box), null, declaration + ': no help link of its own');
    assert.equal(text(helpOf(sign).querySelector('summary')), 'What signing off means', initials);
    assert.deepEqual(bodyOf(sign), words, initials);
    assert.equal(box.closest('.sign-off-pair').querySelectorAll('.field-help').length, 1, 'one link for the pair');
  }
  assert.match(TEMPLATE, /^Declaration: Lead researcher \(checkbox, nohelp, key=declarationResearcher\)/m, 'the declaration carries nohelp');
  assert.deepEqual(app.jsdomErrors, []);
});

test('nohelp is a flag any field can carry, and an option hint on a dropdown is dropped rather than shown', async (t) => {
  const tpl = TEMPLATE
    .replace('# Research title (text, question=', '# Research title (text, nohelp, question=')
    .replace(/^Sample Size \(radios, perQuestion,/m, 'Sample Size (select, perQuestion,');
  assert.notEqual(tpl, TEMPLATE);
  const app = await bootApp({ textAssets: { 'research-plan-template.md': tpl } });
  t.after(() => app.close());
  const d = app.document;
  assert.equal(!!(d.getElementById('field-researchTitle').nextElementSibling && d.getElementById('field-researchTitle').nextElementSibling.classList.contains('field-help')), false, 'the title, marked nohelp, has no link');
  const options = Array.from(d.querySelectorAll('select[data-field="sampleSize"] option')).map((o) => o.value);
  assert.deepEqual(options.slice(0, 4), NEW, 'a dropdown shows the names alone');
  assert.deepEqual(app.jsdomErrors, []);
});
