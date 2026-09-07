'use strict';
const assert = require('node:assert/strict');
const { bootApp, setValue } = require('./app-harness');
const { draftFor } = require('./rpa-65-fixtures.cjs');

(async () => {
  for (const [start, end, next, short] of [
    ['2026-02-20', '2026-04-16', '2026-04-17', '2026-03-09'],
    ['2026-10-01', '2026-11-25', '2026-11-26', '2026-11-02'],
  ]) {
    const app = await bootApp({ draft: draftFor([['Research', start, end], ['One day', short, short]]) });
    try {
      const chart = app.document.querySelector('.timeline-chart');
      assert.equal(chart.dataset.scale, 'days', process.env.TZ);
      const rows = chart.querySelectorAll('.timeline-row');
      assert.equal(rows[0].querySelectorAll('.timeline-bar-cell-on').length, 56);
      assert.equal(rows[1].querySelectorAll('.timeline-bar-cell-on').length, 1);
      const dates = app.document.querySelectorAll('#stageTimeline-table input[type="date"]');
      setValue(app.window, dates[1], next);
      assert.equal(chart.dataset.scale, 'weeks');
      assert.equal(chart.querySelectorAll('.timeline-period-mark').length, 9);
      assert.ok(Math.abs(parseFloat(chart.querySelectorAll('.timeline-stage-bar')[1].style.width) - 100 / 63) < 0.000001);
      assert.deepEqual(app.jsdomErrors, []);
    } finally { app.close(); }
  }
  const app = await bootApp({ draft: draftFor([['Research', '2027-10-15', '2028-04-30'], ['Leap days', '2028-02-28', '2028-03-01']]) });
  try {
    const chart = app.document.querySelector('.timeline-chart');
    assert.equal(chart.dataset.scale, 'months');
    assert.equal(chart.querySelector('.timeline-period-grid').style.gridTemplateColumns, '31fr 30fr 31fr 31fr 29fr 31fr');
    assert.match(chart.querySelectorAll('.timeline-stage-bar')[1].getAttribute('aria-label'), /3 calendar days/);
  } finally { app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
