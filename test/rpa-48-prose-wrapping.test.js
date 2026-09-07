'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  bootApp,
  listInputs,
  setValue,
  withFieldUncommented,
} = require('./app-harness');

const LONG_PROSE =
  'A deliberately long research-planning value that describes affected participants, ' +
  'workflow constraints, dependencies, evidence needs, and the decision this work must ' +
  'support without hiding any part of the explanation in a single-line control.';
const SHORT_PROSE = 'Short value';

function textareaScrollHeight(textarea) {
  if (textarea.value.length > 120) return 144;
  if (textarea.value.length > 20) return 84;
  return 44;
}

function heightOf(textarea) {
  return Number.parseInt(textarea.style.height, 10);
}

function pasteValue(window, textarea, value) {
  textarea.value = value;
  textarea.dispatchEvent(new window.InputEvent('input', {
    bubbles: true,
    data: value,
    inputType: 'insertFromPaste',
  }));
}

function deleteValue(window, textarea) {
  textarea.value = '';
  textarea.dispatchEvent(new window.InputEvent('input', {
    bubbles: true,
    inputType: 'deleteContentBackward',
  }));
}

function textSnapshot(value) {
  return { t: 'text', v: value };
}

test('classifies prose controls without changing genuinely compact controls', async (t) => {
  const app = await bootApp({ textareaScrollHeight });
  t.after(() => app.close());
  const { document } = app;

  const project = document.querySelector('[data-field="project"]');
  assert.equal(project.tagName, 'TEXTAREA');
  assert.ok(project.classList.contains('prose-input'));
  assert.equal(document.querySelector('[data-field="jiraProject"]').tagName, 'INPUT');
  assert.equal(document.querySelector('[data-field="signOffProjectOwner"]').tagName, 'INPUT');
  assert.equal(document.querySelector('[data-field="signOffResearcher"]').tagName, 'INPUT');
  assert.equal(document.querySelector('[data-field="projectDecision"]').type, 'date');
  assert.equal(document.querySelector('[data-field="researchReadout"]').type, 'date');

  const characteristicsInput = listInputs(document, 'characteristics')[0];
  assert.equal(characteristicsInput.tagName, 'TEXTAREA');
  assert.ok(characteristicsInput.classList.contains('prose-input'));
  assert.equal(listInputs(document, 'methods')[0].tagName, 'INPUT');
  assert.equal(document.querySelector('[data-field="sampleSize"]').tagName, 'SELECT');

  // Requirements is dormant in the template, so no editable-headers table
  // renders here. The feature keeps its coverage in the last test below,
  // which supplies a template that still declares one.
  assert.equal(document.querySelectorAll('.th-input').length, 0);
  assert.equal(document.querySelectorAll('#previousKnowledge-table tbody textarea.prose-input').length, 1);
  assert.equal(document.querySelectorAll('#stageTimeline-table textarea').length, 0);
  assert.equal(document.querySelector('#stageTimeline-table tbody select').tagName, 'SELECT');
  assert.equal(document.querySelectorAll('#stageTimeline-table input[type="date"]').length, 2);

  const actionCells = document.querySelectorAll('#actionPoints-table tbody td');
  assert.equal(actionCells[0].querySelector('.cinput').tagName, 'TEXTAREA');
  assert.equal(actionCells[1].querySelector('.cinput').tagName, 'TEXTAREA');
  assert.equal(actionCells[2].querySelector('.ssel').tagName, 'SELECT');

  const previousCells = document.querySelectorAll('#previousKnowledge-table tbody td');
  assert.equal(previousCells[0].querySelector('.cinput').tagName, 'TEXTAREA');
  assert.equal(previousCells[1].querySelector('.file-native').type, 'file');

  const css = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  assert.match(css, /textarea\.prose-input\{[^}]*overflow:hidden[^}]*overflow-wrap:anywhere/);
  assert.match(css, /\.dtbl\{table-layout:fixed\}/);
  assert.match(css, /@media screen and \(max-width:600px\)/);
  assert.match(css, /textarea\.finput,textarea\.prose-input\{overflow:visible!important\}/);
  assert.match(css, /\.timeline-row-grid\{[^}]*min-width:0/);
  assert.match(css, /\.timeline-dates\{[^}]*flex-direction:column[^}]*white-space:nowrap/);
});

test('prose rows grow independently after typing or pasting and shrink after deletion', async (t) => {
  const app = await bootApp({ textareaScrollHeight });
  t.after(() => app.close());
  const { document, window } = app;

  const project = document.querySelector('[data-field="project"]');
  const initialProjectHeight = heightOf(project);
  pasteValue(window, project, LONG_PROSE);
  const longProjectHeight = heightOf(project);
  assert.ok(longProjectHeight > initialProjectHeight);
  setValue(window, project, SHORT_PROSE);
  assert.ok(heightOf(project) < longProjectHeight);

  const characteristicsList = document.querySelector('.list-rows[data-list-key="characteristics"]');
  characteristicsList.closest('.field').querySelector('.add-btn').click();
  const characteristics = listInputs(document, 'characteristics');
  pasteValue(window, characteristics[0], LONG_PROSE);
  setValue(window, characteristics[1], SHORT_PROSE);
  assert.ok(heightOf(characteristics[0]) > heightOf(characteristics[1]));
  assert.deepEqual(
    Array.from(characteristicsList.querySelectorAll('.list-num')).map((node) => node.textContent),
    ['1.', '2.']
  );
  const listRemoveButtons = characteristicsList.querySelectorAll('.list-remove');
  assert.equal(listRemoveButtons[0].disabled, true);
  assert.ok(listRemoveButtons[0].classList.contains('list-remove-spacer'));
  assert.equal(listRemoveButtons[1].disabled, false);

  deleteValue(window, characteristics[0]);
  assert.equal(heightOf(characteristics[0]), heightOf(characteristics[1]));
  listRemoveButtons[1].click();
  assert.equal(listInputs(document, 'characteristics').length, 1);

  const knowledge = document.getElementById('previousKnowledge-table');
  knowledge.closest('.field').querySelector('.add-btn').click();
  const knowledgeRows = knowledge.querySelectorAll('tbody tr');
  const firstKnowledge = knowledgeRows[0].querySelector('textarea');
  const secondKnowledge = knowledgeRows[1].querySelector('textarea');
  pasteValue(window, firstKnowledge, LONG_PROSE);
  setValue(window, secondKnowledge, SHORT_PROSE);
  assert.ok(heightOf(firstKnowledge) > heightOf(secondKnowledge));

  const headerCellCount = knowledge.querySelectorAll('thead th').length;
  knowledgeRows.forEach((row) => {
    assert.equal(row.querySelectorAll('td').length, headerCellCount);
  });
  assert.equal(knowledgeRows[0].querySelector('.row-remove').disabled, false);
  assert.equal(knowledgeRows[1].querySelector('.row-remove').disabled, false);
  knowledgeRows[1].querySelector('.row-remove').click();
  assert.equal(knowledge.querySelectorAll('tbody tr').length, 1);
  assert.equal(knowledge.querySelector('.row-remove').disabled, true);

  const actionTextareas = document.querySelectorAll('#actionPoints-table tbody textarea');
  assert.equal(actionTextareas.length, 2);
  pasteValue(window, actionTextareas[0], LONG_PROSE);
  pasteValue(window, actionTextareas[1], LONG_PROSE + ' The responsible owner coordinates all follow-up work.');
  const responsibleLongHeight = heightOf(actionTextareas[1]);
  assert.ok(responsibleLongHeight > 44);
  deleteValue(window, actionTextareas[1]);
  assert.ok(heightOf(actionTextareas[1]) < responsibleLongHeight);
  assert.equal(document.querySelector('#actionPoints-table tbody select').tagName, 'SELECT');
});

test('timeline date ranges stay contained without changing compact date editors', async (t) => {
  const app = await bootApp({ textareaScrollHeight });
  t.after(() => app.close());
  const { document, window } = app;

  const dateInputs = document.querySelectorAll('#stageTimeline-table input[type="date"]');
  assert.equal(dateInputs.length, 2);
  setValue(window, dateInputs[0], '2026-09-02');
  setValue(window, dateInputs[1], '2026-09-16');

  const visualize = document.querySelector('.timeline-viz-btn');
  visualize.click();
  const chart = document.querySelector('.timeline-chart');
  assert.equal(chart.hidden, false);
  const timelineDates = chart.querySelector('.timeline-row .timeline-dates');
  assert.equal(timelineDates.getAttribute('aria-label'), '02-Sep-2026 to 16-Sep-2026');
  assert.deepEqual(
    Array.from(timelineDates.querySelectorAll('.timeline-date-value')).map((node) => node.textContent),
    ['02-Sep-2026', '16-Sep-2026']
  );
  assert.equal(dateInputs[0].tagName, 'INPUT');
  assert.equal(dateInputs[1].tagName, 'INPUT');
});

test('initial binding and draft restoration autosize all RPA-48 prose paths', async (t) => {
  const initial = await bootApp({ textareaScrollHeight });
  for (const textarea of initial.document.querySelectorAll('textarea.prose-input')) {
    assert.ok(heightOf(textarea) >= 44);
  }
  initial.close();

  const draft = {
    version: 3,
    fields: { project: LONG_PROSE },
    selects: {},
    lists: {
      characteristics: [LONG_PROSE, SHORT_PROSE],
    },
    methods: [],
    tables: {
      'actionPoints-table': [[
        textSnapshot(LONG_PROSE),
        textSnapshot(LONG_PROSE + ' The responsible owner coordinates all follow-up work.'),
        { t: 'sel', v: 'in-progress' },
        textSnapshot(''),
      ]],
      'previousKnowledge-table': [
        [textSnapshot(LONG_PROSE), { t: 'file', v: '', n: 'No file chosen' }, textSnapshot('')],
        [textSnapshot(SHORT_PROSE), { t: 'file', v: '', n: 'No file chosen' }, textSnapshot('')],
      ],
    },
    custom: {},
  };

  const restored = await bootApp({ draft, textareaScrollHeight });
  t.after(() => restored.close());
  const { document } = restored;

  const project = document.querySelector('[data-field="project"]');
  assert.equal(project.value, LONG_PROSE);
  assert.ok(heightOf(project) > 44);

  const characteristics = listInputs(document, 'characteristics');
  assert.deepEqual(characteristics.map((input) => input.value), [LONG_PROSE, SHORT_PROSE]);
  assert.ok(heightOf(characteristics[0]) > heightOf(characteristics[1]));

  const knowledgeRows = document.querySelectorAll('#previousKnowledge-table tbody tr');
  assert.equal(knowledgeRows.length, 2);
  assert.equal(knowledgeRows[0].querySelector('textarea').value, LONG_PROSE);
  assert.ok(
    heightOf(knowledgeRows[0].querySelector('textarea')) >
      heightOf(knowledgeRows[1].querySelector('textarea'))
  );

  const actionTextareas = document.querySelectorAll('#actionPoints-table tbody textarea');
  assert.equal(actionTextareas.length, 2);
  assert.equal(actionTextareas[0].value, LONG_PROSE);
  assert.ok(heightOf(actionTextareas[0]) > 44);
  assert.match(actionTextareas[1].value, /^A deliberately long research-planning value/);
  assert.ok(heightOf(actionTextareas[1]) > 44);
  assert.equal(document.querySelector('#actionPoints-table tbody select').value, 'in-progress');

  const previousKnowledge = document.querySelector('#previousKnowledge-table tbody textarea');
  assert.equal(previousKnowledge.value, LONG_PROSE);
  assert.ok(heightOf(previousKnowledge) > 44);
  assert.equal(document.querySelector('#previousKnowledge-table .file-name').textContent, 'No file chosen');
});

// Requirements is the only field that ever declared editable-headers, and it
// is dormant in the template. Rather than let that feature lose its coverage
// the moment nothing happens to use it, this renders the template with
// Requirements uncommented — the form exactly as it was before RPA-55 hid it.
// If it is brought back, this test already covers it; if the feature is ever
// removed for real, this is the test that should be deleted with it.
function templateWithRequirements() {
  const real = fs.readFileSync(
    path.join(__dirname, '..', 'research-plan-template.md'), 'utf8'
  );
  // Keyed on the field, not on its exact text, so a reworded hint or a new
  // flag does not quietly turn this test into a no-op.
  const restored = withFieldUncommented(real, 'requirements');
  assert.notEqual(restored, real, 'the dormant Requirements lines were not found to restore');
  return restored;
}

test('an editable-headers table renders prose cells under renameable headings', async (t) => {
  const app = await bootApp({
    textareaScrollHeight,
    textAssets: { 'research-plan-template.md': templateWithRequirements() },
  });
  t.after(() => app.close());
  const { document, window } = app;

  const table = document.getElementById('requirements-table');
  assert.ok(table, 'the restored template renders the Requirements table');

  // Three renameable headings, and prose cells beneath them.
  const headers = table.querySelectorAll('thead input.th-input');
  assert.equal(headers.length, 3);
  assert.deepEqual(Array.from(headers).map((h) => h.value), ['Physical', 'Digital', 'Approvals']);
  assert.equal(table.querySelectorAll('tbody textarea.prose-input').length, 3);

  // Renaming a heading leaves the cells alone.
  setValue(window, headers[2], 'Sign-offs');
  assert.equal(headers[2].value, 'Sign-offs');
  assert.equal(table.querySelectorAll('tbody textarea.prose-input').length, 3);

  // And the prose cells still size themselves independently.
  const cells = table.querySelectorAll('tbody textarea');
  pasteValue(window, cells[0], LONG_PROSE);
  setValue(window, cells[1], SHORT_PROSE);
  assert.ok(heightOf(cells[0]) > heightOf(cells[1]));
});
