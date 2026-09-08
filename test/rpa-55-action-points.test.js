'use strict';

// RPA-55 settled the three Action Points columns together, and split them.
//
// Status is cut. It failed all three of Jarrett's questions at once: nothing
// in the app consumed it, nobody owned it at authoring time, and every answer
// available was untrue — nothing has happened yet when the plan is written,
// and whatever it claims is wrong the day after sign-off. A document that gets
// signed and printed cannot also be a live tracker.
//
// Action and Responsible stay. Both failed question 1 the same way Status did
// — no in-app consumer — and the answer there is to give them one rather than
// to delete them. The planned Jira integration reads these two columns and
// creates the subtasks from them, which is also why Responsible will need to
// become a person picker rather than prose: assigning needs an account, not a
// name. Until that lands they are kept on the strength of a planned consumer,
// which this file records so the reasoning is not lost between tickets.
//
// The `status` column type survives the cut as part of the template language.
// Nothing in the live form uses it now, so it keeps its coverage here from a
// fixture, the same treatment editable-headers and grid prose already get in
// rpa-48-prose-wrapping.test.js.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp, setValue, DRAFT_KEY } = require('./app-harness');

const TEMPLATE = path.join(__dirname, '..', 'research-plan-template.md');

function headers(document) {
  return Array.from(document.querySelectorAll('#actionPoints-table thead th'))
    .map((th) => th.textContent.trim())
    .filter(Boolean);
}

test('the table asks for the work and its owner, and nothing else', async (t) => {
  const app = await bootApp();
  t.after(() => app.close());
  const { document } = app;

  assert.deepEqual(headers(document), ['Action', 'Responsible']);

  // The cut, stated where it is visible: no control anywhere in the table
  // offers a status. Asserting the header list alone would still pass if a
  // stray select were rendered under a blank heading.
  assert.equal(document.querySelectorAll('#actionPoints-table select').length, 0);
  assert.equal(document.querySelectorAll('#actionPoints-table .ssel').length, 0);

  const cells = document.querySelectorAll('#actionPoints-table tbody tr:first-child td');
  const inputs = Array.from(cells).map((td) => {
    const control = td.querySelector('.cinput');
    return control ? control.tagName : null;
  });
  // Two prose cells, then the row-remove cell, which holds no input.
  assert.deepEqual(inputs, ['TEXTAREA', 'TEXTAREA', null]);
});

test('the template itself no longer declares a status column', () => {
  // The form is generated from the template, so the cut has to be in the
  // content file rather than worked around in code. Reading it here means a
  // reinstated column fails as a cut that came back, not as a puzzling
  // rendering difference three tests away.
  const line = fs.readFileSync(TEMPLATE, 'utf8')
    .split('\n')
    .find((l) => l.startsWith('Action Points ('));
  assert.ok(line, 'the template still declares Action Points');
  assert.doesNotMatch(line, /Status/i);
  assert.match(line, /Action:prose/);
  assert.match(line, /Responsible:prose/);
});

test('both surviving columns still save and come back', async (t) => {
  // The keep half. A verdict of keep is only real if the data round-trips.
  const app = await bootApp();
  const { document, window } = app;

  const cells = document.querySelectorAll('#actionPoints-table tbody tr:first-child textarea');
  assert.equal(cells.length, 2);
  setValue(window, cells[0], 'Recruit eight participants who abandoned checkout');
  setValue(window, cells[1], 'Ana');
  await new Promise((resolve) => setTimeout(resolve, 700));

  const saved = JSON.parse(window.localStorage.getItem(DRAFT_KEY));
  assert.deepEqual(
    saved.tables['actionPoints-table'][0].map((cell) => cell.v),
    ['Recruit eight participants who abandoned checkout', 'Ana', '']
  );
  app.close();

  const reopened = await bootApp({ draft: saved });
  t.after(() => reopened.close());
  const restored = reopened.document
    .querySelectorAll('#actionPoints-table tbody tr:first-child textarea');
  assert.deepEqual(
    Array.from(restored).map((c) => c.value),
    ['Recruit eight participants who abandoned checkout', 'Ana']
  );
});

test('a draft saved before the cut still opens, minus the status', async (t) => {
  // Restoration is positional, so a row saved before the cut is one cell wider
  // than the table it now lands in. The surplus has to be dropped rather than
  // shifted onto Responsible or thrown.
  //
  // Four cells, not three: a saved row covers every <td>, and the last one is
  // the cell holding the row-remove button. Three cells would still pass this
  // test while proving nothing — the status snapshot would land on the remove
  // cell, find no select in it and be ignored, so the out-of-range path that
  // actually does the dropping would never run.
  const draft = {
    version: 6,
    fields: {},
    selects: {},
    lists: {},
    methods: [],
    tables: {
      'actionPoints-table': [[
        { t: 'text', v: 'Book the lab' },
        { t: 'text', v: 'Sam' },
        { t: 'sel', v: 'in-progress' },
        { t: 'text', v: '' },
      ]],
      // Restored after the wide row above, and the reason this table is here:
      // dropping a surplus cell has to mean skipping it, not throwing. A throw
      // would land after Action and Responsible were already written, so the
      // assertions on those two would pass while the rest of the draft — this
      // table, the custom sections, the timeline — silently never restored.
      'previousKnowledge-table': [
        [{ t: 'text', v: 'Checkout diary study, 2025' }, { t: 'file', v: '', n: 'No file chosen' }, { t: 'text', v: '' }],
      ],
    },
    custom: {},
  };

  const app = await bootApp({ draft });
  t.after(() => app.close());
  const { document } = app;

  const cells = document.querySelectorAll('#actionPoints-table tbody tr:first-child textarea');
  assert.deepEqual(Array.from(cells).map((c) => c.value), ['Book the lab', 'Sam']);
  assert.equal(document.querySelectorAll('#actionPoints-table select').length, 0);

  assert.equal(
    document.querySelector('#previousKnowledge-table tbody textarea').value,
    'Checkout diary study, 2025',
    'restoration continued past the wide row'
  );
});

test('the status column type still works, for any template that asks for one', async (t) => {
  // Coverage for a template-language feature with no live user. If the type is
  // ever removed for real, this is the test to delete alongside it.
  const real = fs.readFileSync(TEMPLATE, 'utf8');
  const restored = real.replace(
    'Action Points (table, key=actionPoints): Action:prose=Task description | Responsible:prose',
    'Action Points (table, key=actionPoints): Action:prose=Task description | Responsible:prose | Status:status'
  );
  assert.notEqual(restored, real, 'the Action Points line was not found to extend');

  const app = await bootApp({ textAssets: { 'research-plan-template.md': restored } });
  t.after(() => app.close());
  const { document } = app;

  const select = document.querySelector('#actionPoints-table tbody select');
  assert.ok(select, 'a status column renders a select');
  assert.deepEqual(
    Array.from(select.options).map((o) => o.value),
    ['not-started', 'assigned', 'in-progress', 'complete', 'blocked']
  );
  assert.equal(
    document.querySelector('#actionPoints-table thead th[data-col-type="status"]').textContent.trim(),
    'Status'
  );
});
