'use strict';

// The Theory field has a "Suggest a framework" button because recall is the
// unreliable part: researchers rarely have an academic framework to hand at
// the moment the form asks for one. The suggester reads the plan and either
// matches something in research-theoretical-frameworks.md or drafts a new
// entry for the library.
//
// The matched branch used to end at "here is one" — a name, a rationale and a
// reference, with only a dismiss button — so the answer still had to be
// retyped into the field by hand. These tests cover the accept action that
// closes that gap, and the rule that matters most about it: it must never
// overwrite something the researcher already wrote.

const test = require('node:test');
const assert = require('node:assert/strict');
const { bootApp, setValue, waitFor } = require('./app-harness');

// Shaped like a real entry in the library: extractFirstReference reads the
// first bullet under "Key References".
const TAM_ENTRY = [
  '### Technology Acceptance Model (TAM) & UTAUT',
  '* **Core Focus:** Models behavioural intent to adopt new technology.',
  '* **UXR Application:** Enterprise rollout and feature adoption studies.',
  '* **Key References:**',
  '  * Davis, F. D. (1989). Perceived usefulness, perceived ease of use, and user'
    + ' acceptance of information technology. *MIS Quarterly*, 13(3), 319–340.'
    + ' https://doi.org/10.2307/249008',
].join('\n');

const MATCH = {
  matched: true,
  name: 'Technology Acceptance Model (TAM) & UTAUT',
  rationale: 'It maps switching cost onto perceived ease of use.',
  entry: TAM_ENTRY,
};

const DRAFT = {
  matched: false,
  rationale: 'Nothing in the library covers ritual formation.',
  draft: {
    category: '## 3. Social and Organisational',
    name: 'Habit Loop Theory',
    coreFocus: 'How repeated cues form durable routines.',
    uxrApplication: 'Retention and re-engagement studies.',
    references: ['Duhigg, C. (2012). *The Power of Habit*. Random House.'],
  },
};

async function openTheory(app, respondWith) {
  const { document } = app;
  const accordion = Array.from(document.querySelectorAll('.acc'))
    .find((a) => a.querySelector('.acc-title').textContent.trim() === 'Methodology');
  if (accordion.querySelector('.acc-body').hidden) accordion.querySelector('.acc-head').click();

  const field = document.querySelector('[data-field="theory"]').closest('.field');
  const suggest = Array.from(field.querySelectorAll('button'))
    .find((b) => /suggest a framework/i.test(b.textContent));
  suggest.click();
  await waitFor(() => !field.querySelector('.fw-panel').hidden, {
    message: 'the suggestion panel never appeared',
  });
  return {
    field,
    input: document.querySelector('[data-field="theory"]'),
    panel: field.querySelector('.fw-panel'),
    button: (label) => Array.from(field.querySelectorAll('.fw-panel button'))
      .find((b) => b.textContent.trim() === label),
  };
}

test('a matched framework can be taken straight into the Theory field', async (t) => {
  const app = await bootApp({ suggestFramework: () => MATCH });
  t.after(() => app.close());

  const ui = await openTheory(app);
  assert.ok(ui.panel.classList.contains('fw-match'));
  assert.equal(ui.input.value, '', 'nothing is written before the button is pressed');

  const use = ui.button('Use this framework');
  assert.ok(use, 'the matched panel offers an accept action');
  use.click();

  // The name, and the reference on its own line, condensed the way the panel
  // shows it rather than as the library's full citation.
  const lines = ui.input.value.split('\n');
  assert.equal(lines[0], 'Technology Acceptance Model (TAM) & UTAUT');
  assert.match(lines[1], /^Davis \(1989\)\./);
  assert.match(lines[1], /doi\.org\/10\.2307\/249008/);

  assert.equal(use.disabled, true);
  assert.equal(use.textContent, 'Added ✓');
  assert.equal(app.document.activeElement, ui.input, 'focus moves to the field to edit');
});

test('accepting appends to an existing note instead of replacing it', async (t) => {
  const app = await bootApp({ suggestFramework: () => MATCH });
  t.after(() => app.close());
  const { window } = app;

  const ui = await openTheory(app);
  // Someone jotted their own thinking down before asking for a suggestion.
  setValue(window, ui.input, 'Maybe something about habit formation?');
  ui.button('Use this framework').click();

  assert.match(ui.input.value, /^Maybe something about habit formation\?\n\n/,
    'the existing note survives, first');
  assert.match(ui.input.value, /Technology Acceptance Model/);
});

test('accepting notifies the field so it resizes and the draft saves', async (t) => {
  const app = await bootApp({ suggestFramework: () => MATCH });
  t.after(() => app.close());

  const ui = await openTheory(app);
  const events = [];
  ui.input.addEventListener('input', () => events.push('input'));
  ui.input.addEventListener('change', () => events.push('change'));

  ui.button('Use this framework').click();

  // Setting .value alone would leave the textarea clipping its own content and
  // the change unsaved until some unrelated keystroke triggered a save.
  assert.deepEqual(events, ['input', 'change']);
});

test('a drafted framework still offers the library action, not the field one', async (t) => {
  const app = await bootApp({ suggestFramework: () => DRAFT });
  t.after(() => app.close());

  const ui = await openTheory(app);
  assert.ok(ui.panel.classList.contains('fw-draft'));
  assert.ok(ui.button('Add this to my framework library'),
    'the draft branch keeps its own action');
  assert.equal(ui.button('Use this framework'), undefined,
    'and does not offer to write an unverified draft into the plan');
  assert.equal(ui.input.value, '');
});
