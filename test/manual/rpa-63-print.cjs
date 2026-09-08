'use strict';
// Compare actual saved PDFs from the same deterministic form and Chrome build.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.argv[2] || 'playwright');
const origin = process.argv[3] || 'http://127.0.0.1:8953';
const output = path.join(__dirname, 'rpa-63-evidence');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const results = [];
  try {
    const cases = [
      { variant: 'before', scenario: 'guardrail', format: 'A4', width: 1366, filename: 'before-chrome-print.pdf' },
      ...['guardrail', 'ready'].flatMap(scenario => ['A4', 'Letter'].map(format => ({
        variant: 'after', scenario, format, width: 1366,
        filename: scenario === 'guardrail' && format === 'A4' ? 'after-chrome-print.pdf' : `after-${scenario}-${format.toLowerCase()}-print.pdf`,
      }))),
      { variant: 'after', scenario: 'guardrail', format: 'Letter', width: 390, filename: 'after-narrow-letter-print.pdf' },
    ];
    for (const { variant, scenario, format, width, filename } of cases) {
      // Clear any forced media; forcing "screen" would also disable print
      // styles inside page.pdf(), unlike Chrome's normal Print action.
      await page.emulateMedia({ media: null });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(origin + (variant === 'before' ? '/baseline/' : '/') + '?scenario=' + scenario);
      await page.locator('html[data-fixture-ready=true]').waitFor();
      await page.locator('.comments-block > .add-btn').click();
      await page.locator('.comments-block textarea').fill('RPA-63 printable feedback: keep this review comment in the saved plan.');
      await page.waitForTimeout(600);
      const draft = await page.evaluate(() => localStorage.getItem('research-plan-app:draft'));
      const screenState = () => page.evaluate(() => ({
        values: [...document.querySelectorAll('textarea')].map(e => e.value),
        sections: [...document.querySelectorAll('.acc')].map(e => [e.dataset.open, e.querySelector('.acc-body').hidden]),
        timeline: [...document.querySelectorAll('.timeline-chart')].map(e => e.hidden),
        activeLabel: document.activeElement.getAttribute('aria-label'),
      }));
      const screenBefore = await screenState();
      const texts = await page.locator('.eval-mdesc').allTextContents();
      const recs = await page.locator('.eval-rec').allTextContents();
      // Export from screen media, like the user's Print action. beforeprint
      // may run at viewport width; paper width must determine input height.
      await page.pdf({ path: path.join(output, filename), format, printBackground: true, displayHeaderFooter: false });
      assert.deepEqual(await screenState(), screenBefore);
      assert.equal(await page.evaluate(() => localStorage.getItem('research-plan-app:draft')), draft);
      await page.emulateMedia({ media: 'print' });
      const controlsExcluded = await page.locator('.eval-actions,.eval-x,.eval-result-summary,.eval-feedback-status').evaluateAll(es => es.every(e => getComputedStyle(e).display === 'none'));
      assert.equal(controlsExcluded, true);
      await page.emulateMedia({ media: null });
      results.push({ variant, scenario, format, width, filename, controlsExcluded, texts, recs,
        inputs: screenBefore.values.filter(Boolean), draftPreserved: true, screenStatePreserved: true });
    }
    fs.writeFileSync(path.join(output, 'print.json'), JSON.stringify(results, null, 2) + '\n');
    console.log('Saved baseline and five A4/Letter PDFs from desktop/narrow screen media; controls, values, sections, focus and drafts verified.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
