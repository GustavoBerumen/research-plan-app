'use strict';
// Supplementary headless Chrome evidence. Not native print preview or driver output.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.argv[2] || 'playwright');
const variant = process.argv[3] || 'baseline';
assert.ok(['baseline', 'candidate'].includes(variant));
const origin = 'http://127.0.0.1:49395';
const output = path.join(__dirname, 'rpa-95-evidence');
fs.mkdirSync(output, { recursive: true });

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  const external = [], errors = [];
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    external.push(route.request().url());
    return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(String(error)));
  const results = { variant, baseline: '78f7910400751f641787c40083202183cc157dda', browser: await browser.version(),
    workflow: 'Headless Chrome, synthetic data, local assets, blocked external requests; fresh context at 100% zoom', cases: [] };
  async function load(example, hidden = false) {
    await page.goto(origin + (variant === 'baseline' ? '/baseline/' : '/') + '?example=' + example + (hidden ? '&hidden=1' : ''));
    await page.locator('.timeline-viz-btn').waitFor({ state: 'attached' });
    const section = page.locator('.acc').filter({ has: page.locator('#stageTimeline-table') });
    if (await section.locator('.acc-body').evaluate(el => el.hidden)) await section.locator('.acc-head').click();
    await page.waitForTimeout(700); // Let the actual debounced autosave settle.
  }
  const snapshot = () => page.evaluate(() => {
    const chart = document.querySelector('.timeline-chart');
    const rect = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right }; };
    const ruler = chart.querySelector('.timeline-weeks-grid,.timeline-period-grid');
    const marks = [...chart.querySelectorAll('.timeline-week-mark,.timeline-period-name')].map(el => {
      const range = document.createRange(); range.selectNodeContents(el);
      const text = rect(range);
      return { text: el.textContent, visible: getComputedStyle(el).visibility !== 'hidden', box: rect(el), ink: text };
    });
    const collisions = marks.slice(1).flatMap((mark, i) => mark.visible && marks[i].visible && mark.ink.y === marks[i].ink.y && marks[i].ink.right > mark.ink.x ? [{ previous: marks[i].text, current: mark.text, overlap: marks[i].ink.right - mark.ink.x }] : []);
    const dailyClipped = chart.dataset.scale === 'days' ? marks.filter(m => m.ink.x < rect(ruler).x || m.ink.right > rect(ruler).right).map(m => m.text) : [];
    return { hidden: chart.hidden, scale: chart.dataset.scale, heading: chart.querySelector('.timeline-weeks > .timeline-label,.timeline-periods > .timeline-label')?.textContent,
      viewport: { width: innerWidth, height: innerHeight, devicePixelRatio }, chart: rect(chart), ruler: ruler && rect(ruler), marks, collisions, dailyClipped,
      dates: [...document.querySelectorAll('#stageTimeline-table input[type=date]')].map(el => el.value),
      lastUpdated: document.querySelector('[data-field=lastUpdated]').value,
      stored: JSON.parse(localStorage.getItem('research-plan-app:draft')),
      rows: [...chart.querySelectorAll('.timeline-row')].map(row => ({ name: row.querySelector('.timeline-label').textContent, label: rect(row.querySelector('.timeline-label')),
        dates: row.querySelector('.timeline-dates').textContent, dateBox: rect(row.querySelector('.timeline-dates')),
        grid: rect(row.querySelector('.timeline-row-grid,.timeline-continuous-track')),
        cells: [...row.querySelectorAll('.timeline-bar-cell')].map(cell => ({ on: cell.classList.contains('timeline-bar-cell-on'), color: getComputedStyle(cell).backgroundColor, border: getComputedStyle(cell).borderRightWidth, ...rect(cell) })),
        bars: [...row.querySelectorAll('.timeline-stage-bar')].map(bar => ({ description: bar.getAttribute('aria-label'), ...rect(bar) })) })) };
  });
  try {
    for (const example of ['original', '56-days', '57-days', 'six-months', 'monthly']) {
      for (const width of [1600, 1280, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await load(example);
        await page.locator('.timeline-chart').scrollIntoViewIfNeeded();
        const screen = await snapshot();
        await page.locator('.timeline-chart').screenshot({ path: path.join(output, `${variant}-${example}-${width}.png`) });
        results.cases.push({ example, width, screen });
        if (variant === 'candidate') {
          assert.deepEqual(screen.collisions, [], `${example}/${width}: text overlap`);
          assert.deepEqual(screen.dailyClipped, [], `${example}/${width}: clipped marker`);
          if (screen.scale === 'days') assert.deepEqual(screen.marks.map(m => m.text), Array.from({ length: example === 'original' ? 6 : 8 }, (_, i) => String(i + 1)));
        }
      }
    }
    if (variant === 'candidate') {
      // Same screenshots and cell coordinates before/after prove the wording did not move dates or stages.
      const baseline = JSON.parse(fs.readFileSync(path.join(output, 'baseline.json'), 'utf8'));
      for (let i = 0; i < results.cases.length; i++) {
        const before = baseline.cases[i].screen, after = results.cases[i].screen;
        for (const key of ['dates', 'rows', 'ruler', 'lastUpdated']) assert.deepEqual(after[key], before[key], `${results.cases[i].example}/${results.cases[i].width}: ${key} changed`);
      }
      results.geometryMatchesBaseline = true;
      results.print = [];
      for (const example of ['original', '56-days']) for (const hidden of [false, true]) {
        await page.setViewportSize({ width: 1280, height: 1000 });
        await load(example, hidden);
        const before = await snapshot();
        await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
        await page.emulateMedia({ media: 'print' });
        const print = await snapshot();
        assert.deepEqual(print.collisions, []);
        assert.deepEqual(print.dailyClipped, []);
        assert.equal(print.hidden, false);
        assert.ok(print.rows.every(row => row.cells.every(cell => cell.border === '2px')));
        const pdf = `${variant}-${example}-${hidden ? 'hidden' : 'visible'}-headless.pdf`;
        await page.pdf({ path: path.join(output, pdf), format: 'A4', printBackground: true, preferCSSPageSize: true });
        await page.emulateMedia({ media: 'screen' });
        await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
        const after = await snapshot();
        assert.equal(after.hidden, hidden);
        assert.deepEqual(after.stored, before.stored);
        assert.deepEqual(after.dates, before.dates);
        assert.equal(after.lastUpdated, before.lastUpdated);
        results.print.push({ example, initiallyHidden: hidden, print, restoredHidden: after.hidden, savedStateUnchanged: true, pdf });
      }
      await load('original');
      const toggle = page.locator('.timeline-viz-btn');
      await toggle.focus(); await page.keyboard.press('Enter');
      assert.equal(await page.locator('.timeline-chart').evaluate(el => el.hidden), true);
      await page.keyboard.press('Space');
      assert.equal(await page.locator('.timeline-chart').evaluate(el => el.hidden), false);
      assert.equal(await toggle.evaluate(el => el === document.activeElement), true);
      await page.keyboard.press('Tab');
      const next = await page.evaluate(() => ({ tag: document.activeElement.tagName, class: document.activeElement.className, text: document.activeElement.textContent }));
      await page.keyboard.press('Shift+Tab');
      assert.equal(await toggle.evaluate(el => el === document.activeElement), true);
      results.keyboard = { enterHides: true, spaceShows: true, focusRetained: true, next, reverseReturns: true };
    }
    results.external = external; results.errors = errors;
    assert.deepEqual(external, []); assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, `${variant}.json`), JSON.stringify(results, null, 2));
    console.log(JSON.stringify({ variant, cases: results.cases.map(c => ({ example: c.example, width: c.width, collisions: c.screen.collisions, clipped: c.screen.dailyClipped })), geometryMatchesBaseline: results.geometryMatchesBaseline, keyboard: results.keyboard, print: results.print?.length }));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
