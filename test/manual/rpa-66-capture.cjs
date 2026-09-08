'use strict';
// Supplementary HEADLESS evidence only. This does not drive native print preview
// or the Microsoft Print to PDF driver. Run after rpa-66-preview.cjs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.argv[3] || 'playwright');
const origin = process.argv[2] || 'http://127.0.0.1:8940';
const variant = process.argv[4] || 'baseline';
assert.ok(['baseline', 'local'].includes(variant));
const output = path.join(__dirname, 'rpa-66-evidence');
fs.mkdirSync(output, { recursive: true });
async function run() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1 });
  const external = [];
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    external.push(route.request().url());
    return route.abort();
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  const results = { browser: await browser.version(), platform: process.platform,
    workflow: 'headless Chrome via Playwright; not native preview or Microsoft Print to PDF',
    viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1, browserZoom: '100% (fresh context)',
    baseline: 'c3e5a49ecea9ddff5b7951f009d4a77077794604', cases: [], pdfs: [] };
  const snapshot = () => page.evaluate(() => {
    const chart = document.querySelector('.timeline-chart');
    const rect = element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
    return {
      hidden: chart.hidden, scale: chart.dataset.scale,
      dates: Array.from(document.querySelectorAll('#stageTimeline-table input[type=date]'), e => e.value),
      lastUpdated: document.querySelector('[data-field=lastUpdated]').value,
      stored: JSON.parse(localStorage.getItem('research-plan-app:draft')),
      chart: rect(chart),
      weekMarkers: Array.from(chart.querySelectorAll('.timeline-week-mark'), e => ({ text: e.textContent, ...rect(e) })),
      styles: {
        gap: chart.querySelector('.timeline-row-grid') && getComputedStyle(chart.querySelector('.timeline-row-grid')).columnGap,
        border: chart.querySelector('.timeline-bar-cell') && getComputedStyle(chart.querySelector('.timeline-bar-cell')).borderRightWidth,
      },
      rows: Array.from(chart.querySelectorAll('.timeline-row'), row => ({
        name: row.querySelector('.timeline-label').textContent,
        dates: row.querySelector('.timeline-dates').textContent,
        cells: Array.from(row.querySelectorAll('.timeline-bar-cell'), cell => ({
          on: cell.classList.contains('timeline-bar-cell-on'), color: getComputedStyle(cell).backgroundColor, ...rect(cell),
        })),
        bars: Array.from(row.querySelectorAll('.timeline-stage-bar'), bar => ({ label: bar.getAttribute('aria-label'), ...rect(bar) })),
      })),
    };
  });
  async function load(example, hidden = false) {
    await page.goto(origin + (variant === 'baseline' ? '/baseline/' : '/') + '?example=' + example + (hidden ? '&hidden=1' : ''));
    await page.locator('.timeline-viz-btn').waitFor({ state: 'attached' });
    const section = page.locator('.acc').filter({ has: page.locator('#stageTimeline-table') });
    if (await section.locator('.acc-body').evaluate(e => e.hidden)) await section.locator('.acc-head').click();
    await page.waitForTimeout(700); // settle real debounced autosave
  }
  try {
    for (const example of ['original', 'one-day', 'overlap', '56-days', '57-days', 'six-months', 'monthly']) {
      await page.setViewportSize({ width: 1366, height: 900 });
      await load(example);
      const desktop = await snapshot();
      await page.emulateMedia({ media: 'print' });
      const print = await snapshot();
      await page.emulateMedia({ media: 'screen' });
      if (variant === 'local' && print.scale === 'days') {
        assert.equal(print.styles.gap, '0px');
        assert.equal(print.styles.border, '2px');
        for (const row of print.rows) {
          assert.ok(row.cells.every(cell => cell.width > 2), 'printed cells retain a positive colored area');
          print.weekMarkers.forEach((mark, index) => assert.ok(Math.abs(mark.x - row.cells[index * 7].x) < 0.02, 'week marker aligns with its day'));
        }
      }
      if (['original', 'one-day', 'monthly'].includes(example)) await page.locator('.timeline-chart').screenshot({ path: path.join(output, variant + '-' + example + '-desktop.png') });
      await page.setViewportSize({ width: 390, height: 844 });
      const narrow = await snapshot();
      assert.deepEqual(narrow.dates, desktop.dates);
      assert.equal(narrow.scale, desktop.scale);
      assert.ok(narrow.chart.width <= 390, 'chart remains within narrow viewport');
      if (['original', '57-days', 'monthly'].includes(example)) await page.locator('.timeline-chart').screenshot({ path: path.join(output, variant + '-' + example + '-narrow.png') });
      if (example === 'original') {
        assert.equal(desktop.rows[0].cells.length, 21);
        assert.equal(desktop.rows[0].cells.filter(c => c.on).length, 8);
        assert.equal(desktop.rows[1].cells.filter(c => c.on).length, 15);
      }
      results.cases.push({ example, desktop, narrow, print });
    }
    await page.setViewportSize({ width: 1366, height: 900 });
    // Release the explicit screen emulation so Page.pdf uses print CSS.
    await page.emulateMedia({ media: null });
    for (const hidden of [false, true]) {
      await load('original', hidden);
      const before = await snapshot();
      await page.pdf({ path: path.join(output, variant + '-letter-' + (hidden ? 'hidden' : 'visible') + '.pdf'), format: 'Letter', printBackground: true, scale: 1, displayHeaderFooter: false });
      const after = await snapshot();
      assert.equal(after.hidden, before.hidden);
      assert.deepEqual(after.dates, before.dates);
      assert.deepEqual(after.stored, before.stored);
      assert.equal(after.lastUpdated, before.lastUpdated);
      await page.reload();
      await page.locator('.timeline-viz-btn').waitFor({ state: 'attached' });
      assert.equal((await snapshot()).hidden, hidden);
      results.pdfs.push({ filename: variant + '-letter-' + (hidden ? 'hidden' : 'visible') + '.pdf', paper: 'Letter', orientation: 'portrait', scale: 1, printBackground: true, cssPageMargins: '0.75in', displayHeaderFooter: false, startsHidden: hidden, restored: true, storedUnchanged: true });
    }
    await load('original');
    for (const [filename, options] of [
      [variant + '-a4-visible.pdf', { format: 'A4', printBackground: true, scale: 1 }],
      [variant + '-letter-backgrounds-off.pdf', { format: 'Letter', printBackground: false, scale: 1 }],
    ]) {
      await page.pdf({ path: path.join(output, filename), ...options, displayHeaderFooter: false });
      results.pdfs.push({ filename, ...options, orientation: 'portrait', cssPageMargins: '0.75in', displayHeaderFooter: false });
    }
    await load('56-days');
    for (const format of ['Letter', 'A4']) {
      const filename = variant + '-56-days-' + format.toLowerCase() + '.pdf';
      await page.pdf({ path: path.join(output, filename), format, printBackground: true, displayHeaderFooter: false });
      results.pdfs.push({ filename, format, printBackground: true, scale: 1, orientation: 'portrait', cssPageMargins: '0.75in', displayHeaderFooter: false });
    }
    assert.deepEqual(external, []);
    assert.deepEqual(errors, []);
    results.externalRequests = external;
    results.pageErrors = errors;
    fs.writeFileSync(path.join(output, variant + '-browser-results.json'), JSON.stringify(results, null, 2) + '\n');
    console.log(JSON.stringify({ cases: results.cases.length, pdfs: results.pdfs.length, browser: results.browser, externalRequests: external.length, pageErrors: errors.length, output }));
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
