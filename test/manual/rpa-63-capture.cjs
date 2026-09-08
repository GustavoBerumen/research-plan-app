'use strict';
// Windows Chrome via Playwright. Native print preview is checked separately.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.argv[2] || 'playwright');
const variant = process.argv[3] || 'after';
const origin = process.argv[4] || 'http://127.0.0.1:8953';
const output = path.join(__dirname, 'rpa-63-evidence');
fs.mkdirSync(output, { recursive: true });
const field = (page, key) => page.locator('[data-field="' + key + '"], [data-list-key="' + key + '"]').locator('xpath=ancestor::*[contains(concat(" ",normalize-space(@class)," ")," field ")][1]');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1 });
  const errors = [], external = [], cases = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.route('**/*', route => { if (new URL(route.request().url()).origin === origin) return route.continue(); external.push(route.request().url()); return route.abort(); });
  try {
    for (const scenario of ['guardrail', 'ready', 'developing']) {
      await page.goto(origin + (variant === 'before' ? '/baseline/' : '/') + '?scenario=' + scenario);
      await page.locator('html[data-fixture-ready=true]').waitFor();
      for (const width of [1366, 390]) {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
        for (const key of ['background', 'researchQuestions', 'outcomes']) {
          const target = field(page, key);
          const geometry = await target.locator('.eval-panel').evaluate(panel => {
            const bounds = panel.getBoundingClientRect();
            return { panelWidth: bounds.width, scrollWidth: panel.scrollWidth, clientWidth: panel.clientWidth,
              overflowing: [...panel.querySelectorAll('*')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > bounds.right + 1 || r.left < bounds.left - 1); }).map(e => e.className),
              scores: [...panel.querySelectorAll('.eval-score')].map(e => e.textContent),
              names: [...panel.querySelectorAll('.eval-mname')].map(e => e.textContent), status: panel.querySelector('.eval-badge').textContent };
          });
          if (variant === 'after') { assert.deepEqual(geometry.overflowing, [], key + ' wraps at ' + width); assert.ok(geometry.scrollWidth <= geometry.clientWidth + 1); }
          cases.push({ scenario, width, key, ...geometry });
          if (scenario !== 'developing') await target.screenshot({ path: path.join(output, `${variant}-${scenario}-${key}-${width}.png`), style: '.toolbar { visibility: hidden !important; }' });
        }
      }
    }
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    fs.writeFileSync(path.join(output, variant + '-browser.json'), JSON.stringify({ platform: process.platform, browser: await browser.version(), mode: 'Headless Windows Chrome, 100% zoom', errors, external, cases }, null, 2) + '\n');
    console.log(JSON.stringify({ variant, cases: cases.length, screenshots: 12, errors, external, output }));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
