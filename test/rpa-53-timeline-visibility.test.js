'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { DRAFT_KEY, bootApp, setValue, waitFor } = require('./app-harness');

function timeline(app) {
  const button = app.document.querySelector('.timeline-viz-btn');
  const field = button.closest('.field');
  return { button, chart: field.querySelector('.timeline-chart'), table: field.querySelector('table'), field };
}

function assertChoice(app, visible) {
  const { button, chart } = timeline(app);
  assert.equal(chart.hidden, !visible);
  assert.equal(button.textContent, visible ? 'Hide Timeline' : 'Visualize Timeline');
}

async function savedChoice(app, visible) {
  return waitFor(() => {
    const saved = JSON.parse(app.window.localStorage.getItem(DRAFT_KEY));
    return saved?.ui?.timelineVisible === visible && saved;
  });
}

async function fixture(t, options = {}) {
  const app = await bootApp(options);
  t.after(() => app.close());
  return app;
}

async function populatedDraft(t) {
  const app = await fixture(t);
  const { table, field } = timeline(app);
  field.querySelector('.add-btn').click();
  const rows = table.querySelectorAll('tbody tr');
  rows.forEach((row, i) => {
    const dates = row.querySelectorAll('input[type="date"]');
    setValue(app.window, dates[0], i ? '2026-09-15' : '2026-09-01');
    setValue(app.window, dates[1], i ? '2026-09-28' : '2026-09-14');
  });
  const draft = await savedChoice(app, false);
  draft.fields.lastUpdated = '2020-01-01';
  draft.lastUpdatedManual = false;
  return draft;
}

for (const visible of [true, false]) {
  test(`toggle-only save and reload restores ${visible ? 'visible' : 'hidden'} without changing rows, dates or Last updated`, async (t) => {
    const draft = await populatedDraft(t);
    draft.ui.timelineVisible = !visible;
    const app = await fixture(t, { draft });
    assertChoice(app, !visible);
    timeline(app).button.click();
    const saved = await savedChoice(app, visible);
    assert.equal(saved.version, 7);
    assert.deepEqual(saved.tables, draft.tables);
    assert.equal(saved.fields.lastUpdated, '2020-01-01');
    assert.equal(saved.lastUpdatedManual, false);
    const restored = await fixture(t, { draft: saved });
    assertChoice(restored, visible);
    assert.equal(timeline(restored).table.querySelectorAll('tbody tr').length, 2);
    assert.deepEqual(Array.from(timeline(restored).table.querySelectorAll('input[type="date"]'), input => input.value),
      ['2026-09-01', '2026-09-14', '2026-09-15', '2026-09-28']);
    if (visible) assert.equal(timeline(restored).chart.querySelectorAll('.timeline-row').length, 2);
    assert.equal(restored.document.querySelector('[data-field="lastUpdated"]').value, '2020-01-01');
    assert.deepEqual(restored.jsdomErrors, []);
  });
}

test('older and current drafts without a preference default to hidden and save in the current version', async (t) => {
  for (const version of [1, 6, 7]) {
    const app = await fixture(t, { draft: { version, fields: {}, lists: {} } });
    assertChoice(app, false);
    timeline(app).button.click();
    const saved = await savedChoice(app, true);
    assert.equal(saved.version, 7);
  }
});

test('toggling an older plan with dormant content preserves that content and Last updated', async (t) => {
  const draft = await populatedDraft(t);
  draft.fields.parkedAnswer = 'An older answer no longer rendered';
  const app = await fixture(t, { draft });
  timeline(app).button.click();
  const saved = await savedChoice(app, true);
  assert.equal(saved.fields.parkedAnswer, draft.fields.parkedAnswer);
  assert.equal(saved.fields.lastUpdated, '2020-01-01');
});

for (const visible of [true, false]) {
  test(`printing from ${visible ? 'visible' : 'hidden'} refreshes the chart without saving temporary visibility or changing Last updated`, async (t) => {
    const draft = await populatedDraft(t);
    draft.ui.timelineVisible = visible;
    const app = await fixture(t, { draft });
    const { chart, button } = timeline(app);
    // Schedule the real debounced autosave, then let it run while printing.
    app.document.querySelector('[data-field="background"]').click();
    chart.replaceChildren();
    app.window.dispatchEvent(new app.window.Event('beforeprint'));
    app.window.dispatchEvent(new app.window.Event('beforeprint'));
    assert.equal(chart.hidden, false);
    assert.equal(chart.querySelectorAll('.timeline-row').length, 2);
    assert.equal(button.textContent, visible ? 'Hide Timeline' : 'Visualize Timeline');
    const saved = await waitFor(() => {
      const value = JSON.parse(app.window.localStorage.getItem(DRAFT_KEY));
      return value.savedAt !== draft.savedAt && value;
    });
    assert.equal(saved.ui.timelineVisible, visible);
    assert.equal(saved.fields.lastUpdated, '2020-01-01');
    assert.deepEqual(saved.tables, draft.tables);
    app.window.dispatchEvent(new app.window.Event('afterprint'));
    app.window.dispatchEvent(new app.window.Event('afterprint'));
    assertChoice(app, visible);
    const restored = await fixture(t, { draft: saved });
    assertChoice(restored, visible);
  });
}

test('an authored date edit queued before printing saves the edit but keeps the hidden preference', async (t) => {
  const draft = await populatedDraft(t);
  const app = await fixture(t, { draft });
  const { table, chart } = timeline(app);
  setValue(app.window, table.querySelector('input[type="date"]'), '2026-09-02');
  app.window.dispatchEvent(new app.window.Event('beforeprint'));
  assert.equal(chart.hidden, false);
  assert.match(chart.textContent, /02-Sep-2026/);
  const saved = await waitFor(() => {
    const value = JSON.parse(app.window.localStorage.getItem(DRAFT_KEY));
    return value.savedAt !== draft.savedAt && value;
  });
  assert.equal(saved.ui.timelineVisible, false);
  assert.notEqual(saved.fields.lastUpdated, '2020-01-01', 'authored edits still update the stamp');
  assert.notDeepEqual(saved.tables, draft.tables);
  app.window.dispatchEvent(new app.window.Event('afterprint'));
  assertChoice(app, false);
});

test('a restored visible chart keeps refreshing and preserves completion-date validation', async (t) => {
  const draft = await populatedDraft(t);
  draft.ui.timelineVisible = true;
  const app = await fixture(t, { draft });
  const { table, chart } = timeline(app);
  const [start, end] = table.querySelectorAll('input[type="date"]');
  setValue(app.window, end, '2026-09-21');
  assert.match(chart.textContent, /21-Sep-2026/);
  setValue(app.window, start, '2026-09-23');
  assert.equal(end.value, '2026-09-23');
  assert.equal(end.min, start.value);
  assert.match(chart.textContent, /23-Sep-2026/);
  assertChoice(app, true);
});

test('confirmed Clear Form clears pending visibility, saved draft, chart and button; cancellation preserves them', async (t) => {
  const draft = await populatedDraft(t);
  draft.ui.timelineVisible = true;
  let confirm = false;
  const app = await fixture(t, { draft, confirm: () => confirm });
  const original = app.window.localStorage.getItem(DRAFT_KEY);
  app.document.getElementById('clear-btn').click();
  assertChoice(app, true);
  assert.equal(app.window.localStorage.getItem(DRAFT_KEY), original);
  assert.equal(timeline(app).chart.querySelectorAll('.timeline-row').length, 2);
  timeline(app).button.click();
  timeline(app).button.click(); // pending toggle autosave must not resurrect the choice
  confirm = true;
  app.document.getElementById('clear-btn').click();
  assertChoice(app, false);
  assert.equal(timeline(app).chart.childElementCount, 0);
  assert.equal(app.window.localStorage.getItem(DRAFT_KEY), null);
  await new Promise(resolve => setTimeout(resolve, 650));
  assert.equal(app.window.localStorage.getItem(DRAFT_KEY), null);
  const empty = await fixture(t);
  assertChoice(empty, false);
  setValue(app.window, app.document.querySelector('[data-field="background"]'), 'New plan');
  const saved = await savedChoice(app, false);
  const restored = await fixture(t, { draft: saved });
  assertChoice(restored, false);
});

test('unavailable or throwing localStorage leaves toggle, print and reset usable', async (t) => {
  for (const storage of [null, { getItem() { throw Error('blocked'); }, setItem() { throw Error('quota'); }, removeItem() { throw Error('blocked'); } }]) {
    const app = await fixture(t);
    Object.defineProperty(app.window, 'localStorage', { configurable: true, get: () => storage });
    timeline(app).button.click();
    assertChoice(app, true);
    await new Promise(resolve => setTimeout(resolve, 650));
    app.window.dispatchEvent(new app.window.Event('beforeprint'));
    app.window.dispatchEvent(new app.window.Event('afterprint'));
    assertChoice(app, true);
    app.document.getElementById('clear-btn').click();
    assertChoice(app, false);
    assert.deepEqual(app.jsdomErrors, []);
  }
});
