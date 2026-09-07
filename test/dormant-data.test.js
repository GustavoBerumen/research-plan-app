'use strict';

// Two bugs Max found reviewing PR #22, both caused by changes made the same
// day, and both silent.
//
// 1. Making a field dormant deleted what people had already saved under it.
//    collectDraft can only report what the form renders, so the next autosave
//    wrote a draft with that key missing. Open an older plan, edit its title,
//    and the Requirements table filled in months ago was gone.
//
// 2. Clear Form left the Sample Size radio selected. The reset loops over text
//    inputs and textareas, and radios are neither, so the choice survived and
//    was saved into the next plan.

const test = require('node:test');
const assert = require('node:assert/strict');
const { DRAFT_KEY, bootApp, setValue, waitFor } = require('./app-harness');

// A plan saved while Requirements and Project were still live fields.
function olderDraft() {
  return {
    version: 6,
    savedAt: '2026-09-01T09:00:00.000Z',
    fields: { researchTitle: 'Checkout study', project: 'Mobile checkout' },
    selects: {},
    lists: {},
    methods: [],
    tables: {
      'requirements-table': [[
        { t: 'text', v: 'Two test phones' },
        { t: 'text', v: 'Figma licence' },
        { t: 'text', v: 'Legal sign-off' },
        { t: 'text', v: '' },
      ]],
    },
    custom: {},
  };
}

function storedDraft(window) {
  return JSON.parse(window.localStorage.getItem(DRAFT_KEY));
}

test('a dormant table keeps its saved rows through an autosave', async (t) => {
  const app = await bootApp({ draft: olderDraft() });
  t.after(() => app.close());
  const { document, window } = app;

  assert.equal(document.getElementById('requirements-table'), null,
    'Requirements is dormant, so nothing renders it');

  setValue(window, document.querySelector('[data-field="researchTitle"]'), 'Checkout study, edited');
  await waitFor(() => storedDraft(window).fields.researchTitle === 'Checkout study, edited', {
    timeout: 1500,
    message: 'the edit was never saved',
  });

  const rows = storedDraft(window).tables['requirements-table'];
  assert.ok(rows, 'the dormant table is still in the draft');
  assert.equal(rows.length, 1);
  assert.equal(rows[0][0].v, 'Two test phones');
});

test('a dormant field keeps its saved value too', async (t) => {
  const app = await bootApp({ draft: olderDraft() });
  t.after(() => app.close());
  const { document, window } = app;

  assert.equal(document.querySelector('[data-field="project"]'), null, 'Project is dormant');

  setValue(window, document.querySelector('[data-field="researchTitle"]'), 'Edited');
  await waitFor(() => storedDraft(window).fields.researchTitle === 'Edited', { timeout: 1500 });

  assert.equal(storedDraft(window).fields.project, 'Mobile checkout');
});

test('a rendered field that is emptied still saves as empty', async (t) => {
  // The carry-forward must not resurrect a value somebody deliberately
  // cleared: an empty answer is an answer, and only keys the form cannot
  // produce at all are preserved.
  const app = await bootApp({
    draft: Object.assign(olderDraft(), {
      fields: { researchTitle: 'Checkout study', background: 'Some background' },
    }),
  });
  t.after(() => app.close());
  const { document, window } = app;

  const background = document.querySelector('[data-field="background"]');
  assert.equal(background.value, 'Some background');
  setValue(window, background, '');
  await waitFor(() => storedDraft(window).fields.background === '', {
    timeout: 1500,
    message: 'clearing a field should be saved, not undone',
  });
});

test('Clear Form clears the Sample Size radios', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const { document, window } = app;

  const radios = Array.from(document.querySelectorAll('.radio-input'));
  const other = document.querySelector('.radio-group .select-other-row');
  radios[2].checked = true;
  radios[2].dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.equal(radios.filter((r) => r.checked).length, 1);

  document.getElementById('clear-btn').click();

  assert.deepEqual(radios.filter((r) => r.checked).map((r) => r.value), [],
    'no option survives the reset');
  assert.equal(other.hidden, true, 'and the Other reveal is closed with them');
});

test('Clear Form does not resurrect the plan it just cleared', async (t) => {
  // Clear removes the stored draft before resetting, so the carry-forward has
  // nothing to carry. Without that ordering it would put everything straight
  // back on the next keystroke.
  const app = await bootApp({ draft: olderDraft() });
  t.after(() => app.close());
  const { document, window } = app;

  document.getElementById('clear-btn').click();
  setValue(window, document.querySelector('[data-field="researchTitle"]'), 'A new plan');
  await waitFor(() => window.localStorage.getItem(DRAFT_KEY), { timeout: 1500 });

  const saved = storedDraft(window);
  assert.equal(saved.fields.researchTitle, 'A new plan');
  assert.equal(saved.fields.project, undefined, 'the cleared plan does not come back');
  assert.equal((saved.tables || {})['requirements-table'], undefined);
});
