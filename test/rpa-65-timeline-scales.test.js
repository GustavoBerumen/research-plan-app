'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { bootApp, setValue, waitFor, DRAFT_KEY } = require('./app-harness');
const { draftFor, examples } = require('./rpa-65-fixtures.cjs');

async function fixture(t, rows, options = {}) {
  const app = await bootApp({ draft: draftFor(rows), ...options });
  t.after(() => app.close());
  app.chart = app.document.querySelector('.timeline-chart');
  app.table = app.document.getElementById('stageTimeline-table');
  app.toggle = app.document.querySelector('.timeline-viz-btn');
  return app;
}
const values = app => Array.from(app.table.querySelectorAll('input[type="date"]'), input => input.value);
const approx = (actual, expected) => assert.ok(Math.abs(parseFloat(actual) - expected) < 0.000001, `${actual} != ${expected}`);

for (const [end, days, scale] of [['2026-10-25', 55, 'days'], ['2026-10-26', 56, 'days'], ['2026-10-27', 57, 'weeks']]) {
  test(`${days} inclusive days selects ${scale} without changing dates`, async t => {
    const app = await fixture(t, [['Research', '2026-09-01', end]]);
    assert.equal(app.chart.dataset.scale, scale);
    assert.deepEqual(values(app), ['2026-09-01', end]);
    if (scale === 'days') {
      assert.equal(app.chart.querySelectorAll('.timeline-bar-cell').length, 56);
      assert.equal(app.chart.querySelectorAll('.timeline-bar-cell-on').length, days);
      assert.deepEqual(Array.from(app.chart.querySelectorAll('.timeline-week-mark'), el => el.textContent), ['week 1', 'w 2', 'w 3', 'w 4', 'w 5', 'w 6', 'w 7', 'w 8']);
    } else {
      assert.equal(app.chart.querySelectorAll('.timeline-period-mark').length, 9);
      assert.equal(app.chart.querySelectorAll('.timeline-bar-cell').length, 0);
      approx(app.chart.querySelector('.timeline-stage-bar').style.width, 57 / 63 * 100);
    }
  });
}

for (const [end, weeks, duration] of [['2026-10-31', 9, 61], ['2026-11-30', 13, 91], ['2027-02-28', 26, 181]]) {
  test(`two/three/six calendar months ending ${end} use weekly periods`, async t => {
    const app = await fixture(t, [['Research', '2026-09-01', end]]);
    assert.equal(app.chart.dataset.scale, 'weeks');
    assert.equal(app.chart.querySelectorAll('.timeline-period-mark').length, weeks);
    const bar = app.chart.querySelector('.timeline-stage-bar');
    approx(bar.style.width, duration / (weeks * 7) * 100);
    assert.match(bar.getAttribute('aria-label'), new RegExp(duration + ' calendar days'));
  });
}

for (const [start, lastWeekly, firstMonthly] of [
  ['2026-09-01', '2027-02-28', '2027-03-01'],
  ['2026-09-15', '2027-03-14', '2027-03-15'],
  ['2026-08-31', '2027-02-27', '2027-02-28'],
  ['2027-08-31', '2028-02-28', '2028-02-29'],
]) {
  test(`six-month calendar anniversary from ${start}, including clamped month ends`, async t => {
    const app = await fixture(t, [['Research', start, lastWeekly]]);
    assert.equal(app.chart.dataset.scale, 'weeks');
    const end = app.table.querySelectorAll('input[type="date"]')[1];
    setValue(app.window, end, firstMonthly);
    assert.equal(app.chart.dataset.scale, 'months');
    assert.equal(end.value, firstMonthly);
    setValue(app.window, end, lastWeekly);
    assert.equal(app.chart.dataset.scale, 'weeks');
  });
}

test('partial months and year rollover use actual month lengths and at most six months per band', async t => {
  const app = await fixture(t, examples.monthly);
  assert.equal(app.chart.dataset.scale, 'months');
  assert.equal(app.chart.querySelectorAll('.timeline-band').length, 2);
  assert.deepEqual(Array.from(app.chart.querySelectorAll('.timeline-period-name'), el => el.textContent), ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr']);
  assert.deepEqual(Array.from(app.chart.querySelectorAll('.timeline-period-year'), el => el.textContent), ['2026', '2026', '2026', '2026', '2027', '2027', '2027', '2027']);
  const rulers = app.chart.querySelectorAll('.timeline-period-grid');
  assert.equal(rulers[0].style.gridTemplateColumns, '30fr 31fr 30fr 31fr 31fr 28fr');
  assert.equal(rulers[1].style.gridTemplateColumns, '31fr 30fr');
  const bands = app.chart.querySelectorAll('.timeline-band');
  approx(bands[0].style.getPropertyValue('--timeline-band-width'), 100);
  approx(bands[1].style.getPropertyValue('--timeline-band-width'), 61 / 181 * 100);
  approx(bands[0].querySelector('.timeline-stage-bar').style.left, 14 / 181 * 100);
  approx(bands[0].querySelector('.timeline-stage-bar').style.width, 167 / 181 * 100);
  approx(bands[1].querySelector('.timeline-stage-bar').style.width, 36 / 61 * 100);
  assert.equal(app.chart.querySelectorAll('.timeline-bar-cell,.timeline-week-mark').length, 0);
  assert.deepEqual(values(app), examples.monthly.flatMap(row => row.slice(1)));
});

for (const [rows, denominator, offset, width] of [
  [[['Research', '2026-09-01', '2026-11-30'], ['One day', '2026-09-15', '2026-09-15'], ['One day', '2026-09-15', '2026-09-17']], 91, 14, 1],
  [examples['leap-year'], 183, 150, 3],
]) {
  test(`exact bars preserve short overlapping stages on ${denominator}-day grid`, async t => {
    const app = await fixture(t, rows);
    const firstBand = app.chart.querySelector('.timeline-band');
    const bars = firstBand.querySelectorAll('.timeline-stage-bar');
    approx(bars[1].style.left, offset / denominator * 100);
    approx(bars[1].style.width, width / denominator * 100);
    assert.match(bars[1].getAttribute('aria-label'), new RegExp(width + ' calendar day'));
    assert.deepEqual(Array.from(firstBand.querySelectorAll('.timeline-row > .timeline-label'), el => el.textContent), rows.map(row => row[0]));
    assert.equal(bars[0].style.background, 'rgb(99, 102, 241)');
    assert.equal(bars[1].style.background, 'rgb(22, 163, 74)');
    if (bars.length === 3) {
      assert.equal(bars[1].style.background, bars[2].style.background);
      assert.equal(bars[1].style.left, bars[2].style.left);
      approx(bars[2].style.width, 3 / denominator * 100);
    }
  });
}

test('invalid/incomplete rows stay excluded; no valid rows retains the empty message', async t => {
  const app = await fixture(t, [
    ['Valid', '2026-09-01', '2027-04-01'],
    ['Incomplete', '2026-01-01', ''], ['Invalid', '2026-02-30', '2026-03-01'],
  ]);
  assert.equal(app.chart.dataset.scale, 'months');
  assert.ok(Array.from(app.chart.querySelectorAll('.timeline-row > .timeline-label'), el => el.textContent).every(name => name === 'Valid'));
  // Bypass the existing input clamp only to exercise renderer exclusion of
  // a reversed row; the separate validation test exercises the real clamp.
  const dates = app.table.querySelectorAll('input[type="date"]');
  dates[1].value = '2026-08-31';
  app.table.dispatchEvent(new app.window.Event('input', { bubbles: true }));
  assert.equal(app.chart.dataset.scale, undefined);
  assert.equal(app.chart.textContent, 'Add stages with start and completion dates to see a timeline.');
});

test('edits switch all three scales in both directions and keep completion validation', async t => {
  const app = await fixture(t, examples['56-days']);
  const [start, end] = app.table.querySelectorAll('input[type="date"]');
  for (const [value, scale] of [['2026-10-27', 'weeks'], ['2027-03-01', 'months'], ['2027-02-28', 'weeks'], ['2026-10-26', 'days']]) {
    setValue(app.window, end, value);
    assert.equal(app.chart.dataset.scale, scale);
    assert.equal(end.value, value);
  }
  setValue(app.window, start, '2026-11-01');
  assert.equal(end.value, start.value);
  assert.equal(end.min, start.value);
  assert.deepEqual(app.jsdomErrors, []);
});

test('adding, naming and deleting a dynamic stage refreshes the range and scale', async t => {
  const app = await fixture(t, [['Research', '2026-09-01', '2026-10-26']]);
  app.table.closest('.field').querySelector('.add-btn').click();
  const row = app.table.querySelectorAll('tbody tr')[1];
  const select = row.querySelector('select');
  setValue(app.window, select, '__other__');
  setValue(app.window, row.querySelector('.select-other-input'), 'Follow-up');
  const [start, end] = row.querySelectorAll('input[type="date"]');
  setValue(app.window, start, '2027-04-01');
  setValue(app.window, end, '2027-04-01');
  assert.equal(app.chart.dataset.scale, 'months');
  assert.match(app.chart.textContent, /Follow-up/);
  row.querySelector('.row-remove').click();
  assert.equal(app.chart.dataset.scale, 'days');
  assert.doesNotMatch(app.chart.textContent, /Follow-up/);
  assert.deepEqual(values(app), ['2026-09-01', '2026-10-26']);
});

for (const [name, scale] of [['six-months', 'weeks'], ['monthly', 'months']]) {
  for (const visible of [true, false]) {
    test(`${scale}: toggle/save/reload/print/reset preserves dates, Other values and Last updated (${visible})`, async t => {
      let accepted = false;
      const draft = draftFor(examples[name], visible);
      const app = await fixture(t, [], { draft, confirm: () => accepted });
      const originalValues = values(app);
      app.toggle.click();
      const saved = await waitFor(() => {
        const data = JSON.parse(app.window.localStorage.getItem(DRAFT_KEY));
        return data?.ui.timelineVisible === !visible && data;
      });
      assert.equal(saved.version, 7);
      assert.equal(saved.fields.lastUpdated, '2020-01-01');
      assert.deepEqual(saved.tables['stageTimeline-table'].map(row => row.slice(0, 3)), draft.tables['stageTimeline-table']);
      const restored = await fixture(t, [], { draft: saved });
      assert.equal(restored.chart.hidden, visible);
      assert.deepEqual(values(restored), originalValues);
      const originalSaved = app.window.localStorage.getItem(DRAFT_KEY);
      for (let i = 0; i < 2; i++) app.window.dispatchEvent(new app.window.Event('beforeprint'));
      assert.equal(app.chart.hidden, false);
      assert.equal(app.chart.dataset.scale, scale);
      assert.equal(app.window.localStorage.getItem(DRAFT_KEY), originalSaved);
      for (let i = 0; i < 2; i++) app.window.dispatchEvent(new app.window.Event('afterprint'));
      assert.equal(app.chart.hidden, visible);
      app.document.getElementById('clear-btn').click();
      assert.equal(app.window.localStorage.getItem(DRAFT_KEY), originalSaved);
      assert.deepEqual(values(app), originalValues);
      assert.equal(app.document.querySelector('[data-field="lastUpdated"]').value, '2020-01-01');
      app.toggle.click(); // queued autosave must not resurrect a reset draft
      accepted = true;
      app.document.getElementById('clear-btn').click();
      assert.equal(app.chart.hidden, true);
      assert.equal(app.chart.childElementCount, 0);
      // A reset plan is a new plan, so it gets the stage defaults back rather
      // than an empty table — including today as the Planning start date,
      // since that is when this plan was started (RPA-76). Everything else is
      // blank, and the readout that fed the last row went with the reset.
      const afterReset = values(app);
      assert.equal(afterReset.length, 10);
      // The app uses the local calendar date, which can differ from UTC on
      // Windows evening runs (for example, America/Mexico_City).
      const today = new Date();
      const localToday = [today.getFullYear(), today.getMonth() + 1, today.getDate()]
        .map((part, index) => index === 0 ? String(part) : String(part).padStart(2, '0')).join('-');
      assert.equal(afterReset[0], localToday);
      assert.ok(afterReset.slice(1).every(value => value === ''));
      await new Promise(resolve => setTimeout(resolve, 650));
      assert.equal(app.window.localStorage.getItem(DRAFT_KEY), null);
      assert.deepEqual(app.jsdomErrors, []);
    });
  }
}

test('very long plans render bounded month bands rather than daily cells', async t => {
  const app = await fixture(t, [['Research', '2026-01-01', '2035-12-31']]);
  assert.equal(app.chart.querySelectorAll('.timeline-period-mark').length, 120);
  assert.equal(app.chart.querySelectorAll('.timeline-band').length, 20);
  assert.equal(app.chart.querySelectorAll('.timeline-stage-bar').length, 20);
  assert.ok(app.chart.querySelectorAll('*').length < 1000);
});

test('calendar-day arithmetic survives timezone and spring/fall DST boundaries', () => {
  for (const zone of ['UTC', 'America/Mexico_City', 'America/New_York', 'Europe/Berlin', 'Australia/Lord_Howe', 'Pacific/Auckland']) {
    execFileSync(process.execPath, [path.join(__dirname, 'rpa-65-timezones.cjs')], {
      env: { ...process.env, TZ: zone }, encoding: 'utf8', timeout: 30000,
    });
  }
});
