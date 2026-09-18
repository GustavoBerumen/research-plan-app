'use strict';

// RPA-153. The sign-off asks for initials and adds the date itself, and
// took a string of any length as the initials. Max's decision of 17
// September 2026: up to ten characters before the date, in any alphabet,
// with the ordinary separators. The hint says so before anyone types; a
// longer value is not dated, not cut short and not a signature, whether
// typed, pasted, restored from an older backup or sent to the server; the
// refusal says what to do and its line goes to the box.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const contract = require('../submission-contract');
const { plan, legacyPlan } = require('./rpa-64-fixtures.cjs');
const { bootApp, setValue, waitFor, completeStep, DRAFT_KEY } = require('./app-harness');

const TEMPLATE = fs.readFileSync(path.join(__dirname, '..', 'research-plan-template.md'), 'utf8');
const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();
const steps = (d) => Array.from(d.querySelectorAll('.step'));
const tagOf = (d) => text(d.querySelector('.sign-off-head .tag'));
const summaryOf = (d) => d.querySelector('.sign-off .error-summary');
const summaryLines = (d) => Array.from(summaryOf(d).querySelectorAll('li')).map(text);
const draftOf = (window) => JSON.parse(window.localStorage.getItem(DRAFT_KEY) || 'null');
const settle = () => new Promise((r) => setTimeout(r, 220));
const KEYS = {
  leadResearcher: { declaration: 'declarationResearcher', name: 'signOffResearcher' },
  projectRequester: { declaration: 'declarationRequester', name: 'signOffProjectOwner' },
};
const TOO_LONG = 'Initials must be 10 characters or fewer';
const SHAPE = 'Initials must only include letters, spaces, full stops, apostrophes and hyphens';
const today = () => { const n = new Date(); return String(n.getDate()).padStart(2, '0') + '/' + String(n.getMonth() + 1).padStart(2, '0') + '/' + n.getFullYear(); };

function press(d, label) {
  const button = Array.from(d.querySelectorAll('.sign-off-actions button')).find((b) => text(b) === label);
  assert.ok(button, 'no "' + label + '" button');
  button.click();
}
async function onReview(app, options = {}) {
  const { document: d, window } = app;
  for (const i of [1, 2, 3, 4, 5, 6]) {
    window.location.hash = '#' + steps(d)[i].dataset.stepSlug;
    await waitFor(() => steps(d)[i].hidden === false);
    if (!options.complete) completeStep(app, steps(d)[i]);
  }
  window.location.hash = '#review';
  await waitFor(() => steps(d)[7].hidden === false);
  await settle();
}
// Which of the two you are, the declaration ticked, and the initials box
// in front of you.
function toInitials(app, role) {
  const { document: d, window } = app;
  d.querySelector('.sign-off-setup input[value="' + role + '"]').click();
  press(d, 'Continue');
  const box = d.querySelector('[data-field="' + KEYS[role].declaration + '"]');
  box.checked = true;
  box.dispatchEvent(new window.Event('change', { bubbles: true }));
  return d.querySelector('[data-field="' + KEYS[role].name + '"]');
}
// Types, leaves the box (which is when the date is added), and presses on.
function offer(app, input, value) {
  setValue(app.window, input, value);
  input.dispatchEvent(new app.window.Event('blur'));
  press(app.document, 'Continue');
}
const fieldOf = (input) => input.closest('.field');
const errorAt = (input) => fieldOf(input).querySelector(':scope > .field-error');
const stillOnInitials = (d, role) => d.querySelector('[data-field="' + KEYS[role].name + '"]').closest('.sign-off-pair').hidden === false;

test('the hint states the maximum before anyone types', () => {
  const stated = TEMPLATE.match(/^  Hint: .*type your initials, up to 10 characters.*$/gm) || [];
  assert.equal(stated.length, 2, 'both sign-off hints say "up to 10 characters"');
});

for (const role of ['leadResearcher', 'projectRequester']) {
  const other = role === 'leadResearcher' ? 'projectRequester' : 'leadResearcher';

  test(role + ': more than 10 characters is not dated, not cut short and not a signature; the refusal goes to the box', async (t) => {
    const app = await bootApp({});
    t.after(() => app.close());
    const { document: d, window } = app;
    await onReview(app);
    const input = toInitials(app, role);
    assert.match(text(fieldOf(input).querySelector('.field-hint-text')), /up to 10 characters/, 'the hint on the page says the maximum');

    offer(app, input, 'ABCDEFGHIJK');   // eleven
    assert.equal(input.value, 'ABCDEFGHIJK', 'left as typed: no date, nothing cut off');
    assert.deepEqual(summaryLines(d), [TOO_LONG]);
    assert.equal(text(errorAt(input)), 'Error: ' + TOO_LONG, 'said at the field');
    assert.ok(stillOnInitials(d, role), 'the sign-off stays on the initials');
    assert.equal(tagOf(d), 'Not started');
    const link = summaryOf(d).querySelector('li a.error-summary-link');
    link.click();
    assert.equal(d.activeElement, input, 'the summary line puts focus in the initials box');

    // Pasted with a date already on it: the initials are what is counted, and it is not dated again.
    offer(app, input, 'ABCDEFGHIJKL — 01/01/2026');
    assert.equal(input.value, 'ABCDEFGHIJKL — 01/01/2026');
    assert.deepEqual(summaryLines(d), [TOO_LONG]);
    assert.equal(fieldOf(input).querySelectorAll('.field-error').length, 1, 'said once');

    // Ten, with the separators people use, in more than one alphabet.
    offer(app, input, 'j. r. r-ø');   // nine characters, dated on leaving the box
    assert.equal(input.value, 'J. R. R-Ø — ' + today(), 'dated once, in capitals, with the date not counted');
    assert.equal(summaryOf(d).hidden, true);
    assert.equal(errorAt(input), null);
    // On to the address, and the record is made with this signature.
    setValue(window, d.getElementById('sign-off-other-email'), 'other@example.com');
    press(d, 'Sign for local review');
    await settle();
    assert.equal(tagOf(d), 'Awaiting sign-off from the ' + (other === 'projectRequester' ? 'project requester' : 'lead researcher'));
    const saved = await waitFor(() => (draftOf(window) || {}).signOff);
    assert.equal(saved.authorRole, role);
    assert.equal(draftOf(window).fields[KEYS[role].name], 'J. R. R-Ø — ' + today());
    assert.deepEqual(app.jsdomErrors, []);
  });

  test(role + ': exactly 10 characters are accepted, and the date is added exactly once', async (t) => {
    const app = await bootApp({});
    t.after(() => app.close());
    const { document: d, window } = app;
    await onReview(app);
    const input = toInitials(app, role);
    setValue(window, input, 'Zoë O\'B-Ñ.');   // ten
    input.dispatchEvent(new window.Event('blur'));
    input.dispatchEvent(new window.Event('blur'));
    assert.equal(input.value, 'ZOË O\'B-Ñ. — ' + today());
    press(d, 'Continue');
    assert.equal(summaryOf(d).hidden, true, 'ten is within the limit');
    assert.deepEqual(app.jsdomErrors, []);
  });

  test(role + ': characters that are not letters or the ordinary separators are refused in their own words', async (t) => {
    const app = await bootApp({});
    t.after(() => app.close());
    const { document: d } = app;
    await onReview(app);
    const input = toInitials(app, role);
    for (const value of ['AB1', 'A&B', 'AB!', 'A/B']) {
      offer(app, input, value);
      assert.equal(input.value, value, value + ': not dated');
      assert.deepEqual(summaryLines(d), [SHAPE], value);
      assert.equal(text(errorAt(input)), 'Error: ' + SHAPE, value);
    }
    offer(app, input, '');
    assert.deepEqual(summaryLines(d), [role === 'leadResearcher' ? 'Enter your initials to sign this plan' : 'Enter your initials to approve this plan'], 'empty is still asked for in the template\'s words');
    assert.deepEqual(app.jsdomErrors, []);
  });

  test(role + ': a longer value restored from an older backup is shown whole and must be corrected before signing', async (t) => {
    const draft = plan();
    draft.signOff = null;
    draft.fields.emailAddress = 'name@example.com';
    draft.fields[KEYS[role].name] = 'ABCDEFGHIJKLMNOP — 14/09/2026';
    const app = await bootApp({ draft });
    t.after(() => app.close());
    const { document: d, window } = app;
    await onReview(app, { complete: true });
    const input = d.querySelector('[data-field="' + KEYS[role].name + '"]');
    assert.equal(input.value, 'ABCDEFGHIJKLMNOP — 14/09/2026', 'restored as it was, not cut short');
    assert.equal(draftOf(window).fields[KEYS[role].name], 'ABCDEFGHIJKLMNOP — 14/09/2026', 'and saved as it was');
    d.querySelector('.sign-off-setup input[value="' + role + '"]').click();
    press(d, 'Continue');
    input.dispatchEvent(new window.Event('blur'));
    assert.equal(input.value, 'ABCDEFGHIJKLMNOP — 14/09/2026', 'leaving the box does not date it again');
    press(d, 'Continue');
    assert.deepEqual(summaryLines(d), [TOO_LONG]);
    assert.ok(stillOnInitials(d, role));
    assert.equal(tagOf(d), 'Not started', 'no signature from it');
    // Corrected, it is dated today and signs.
    offer(app, input, 'AB');
    assert.equal(input.value, 'AB — ' + today());
    assert.equal(summaryOf(d).hidden, true);
    assert.deepEqual(app.jsdomErrors, []);
  });
}

const SUBMISSIONS_ON = { configResponse: async () => ({ ok: true, status: 200, json: async () => ({ pilotMode: true,
  capabilities: { submissions: true, feedback: true, calibration: false, uploads: false, addFramework: false, jira: false, googleDrive: false }, submissions: require('./rpa-64-fixtures.cjs').config }) }) };

test('submissions on: Send refuses longer initials in the form\'s words, at the field, with a link to it', async (t) => {
  const draft = plan();
  draft.signOff = null;
  draft.fields.emailAddress = 'name@example.com';
  draft.fields.signOffResearcher = 'ABCDEFGHIJK — 14/09/2026';
  draft.fields.signOffProjectOwner = 'ABCDEFGHIJ — 14/09/2026';
  draft.ui = { section: 'review' };
  const app = await bootApp({ ...SUBMISSIONS_ON, draft });
  t.after(() => app.close());
  const d = app.document;
  d.querySelector('.submission-send').click();
  await settle();
  const said = Array.from(d.querySelectorAll('.submission-errors .error-summary-link')).map(text);
  assert.deepEqual(said, [TOO_LONG], 'eleven refused, ten not, in the form\'s words');
  const input = d.querySelector('[data-field="signOffResearcher"]');
  assert.equal(input.value, 'ABCDEFGHIJK — 14/09/2026', 'not cut short');
  assert.equal(text(fieldOf(input).querySelector('.field-error')), TOO_LONG, 'said at the field');
  d.querySelector('.submission-errors .error-summary-link').click();
  assert.equal(d.activeElement, input, 'and its link goes to the box');
  assert.deepEqual(app.jsdomErrors, []);
});

test('the contract refuses more than 10 characters of initials on the submission path, in both schemas, and does not count the date', () => {
  for (const key of ['signOffResearcher', 'signOffProjectOwner']) {
    for (const [value, codes] of [
      ['ABCDEFGHIJK — 14/09/2026', ['signoff_length']],
      ['ABCDEFGHIJ — 14/09/2026', []],
      ['J. R. R-Ø — 14/09/2026', []],
      ['ABCDEFGHIJK', ['signoff_date', 'signoff_length']],
    ]) {
      const p = plan(); p.fields[key] = value;
      assert.deepEqual(contract.validate(p).map((e) => e.code), codes, 'v2 ' + key + ' ' + value);
      assert.equal(p.fields[key], value, 'validation changes nothing');
      const legacy = legacyPlan(); legacy.fields[key] = value;
      assert.deepEqual(contract.validate(legacy).map((e) => e.code), codes, 'legacy ' + key + ' ' + value);
    }
    const p = plan(); p.fields[key] = 'ABCDEFGHIJK — 14/09/2026';
    const error = contract.validate(p)[0];
    assert.equal(error.key, key);
    assert.equal(error.section, 'review');
    assert.match(error.message, /^Enter 10 characters or fewer for the /);
  }
});
