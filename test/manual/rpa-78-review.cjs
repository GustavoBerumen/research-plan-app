'use strict';
// Installed Windows Chrome, deterministic local content; no provider requests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.argv[2] || 'playwright');
const origin = process.argv[3] || 'http://127.0.0.1:8954';
const output = path.join(__dirname, 'rpa-78-evidence');
const shot = { style: '.toolbar { visibility:hidden !important }' };
const longBackground = 'Checkout research will examine where returning customers hesitate before payment.\n' +
  'Support interviews describe uncertainty about delivery dates; analytics show repeated visits to the delivery information page. '.repeat(4) +
  '\nFinal background line: preserve the complete research context in print.';
const longQuestion = 'Which delivery details do customers need before they can confidently place their order?\n' +
  'Consider the promised delivery window, the address confirmation, the available collection options and the information needed to compare alternatives. '.repeat(3) +
  '\nFinal question line: preserve this complete third question in print.';
const field = (page, key) => page.locator('[data-field="' + key + '"], [data-list-key="' + key + '"]').first()
  .locator('xpath=ancestor::*[contains(concat(" ",normalize-space(@class)," ")," field ")][1]');
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1 });
  const errors = [], external = [], cases = [], prints = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.route('**/*', route => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    external.push(route.request().url()); return route.abort();
  });
  const load = async scenario => {
    await page.goto(origin + '/?scenario=' + scenario);
    await page.locator('html[data-fixture-ready=true]').waitFor();
  };
  const expand = async name => {
    const section = page.locator('.acc').filter({ has: page.locator('.acc-title', { hasText: name }) });
    if (!await section.locator('.acc-body').isVisible()) await section.locator('.acc-head').click();
  };
  try {
    let releaseSchema;
    await page.route('**/research-plan-template.md', async route => {
      await new Promise(resolve => { releaseSchema = resolve; }); await route.continue();
    });
    await page.goto(origin + '/?scenario=guardrail');
    await page.locator('.doc-loading').waitFor();
    assert.equal(await page.locator('.doc-loading').textContent(), 'Loading form fields…');
    await page.screenshot({ path: path.join(output, 'loading.png') });
    while (!releaseSchema) await new Promise(resolve => setTimeout(resolve, 10));
    releaseSchema();
    await page.locator('html[data-fixture-ready=true]').waitFor();
    await page.unroute('**/research-plan-template.md');

    for (const scenario of ['guardrail', 'ready']) {
      await load(scenario);
      for (const width of [1366, 390]) {
        await page.setViewportSize({ width, height: 900 });
        assert.equal(await page.locator('html').getAttribute('lang'), 'en-GB');
        await expand('Methodology'); await expand('Execution');
        assert.match(await field(page, 'methods').locator('.field-hint-text').textContent(), /user behaviours/);
        const toggle = page.getByRole('button', { name: 'Visualise Timeline', exact: true });
        await toggle.click();
        await page.getByRole('button', { name: 'Hide Timeline', exact: true }).click();
        assert.equal(await toggle.isVisible(), true);
        for (const key of ['background', 'outcomes', 'methods', 'stageTimeline']) {
          const target = key === 'stageTimeline' ? page.locator('.timeline-viz-btn').locator('xpath=ancestor::div[contains(@class,"field")][1]') : field(page, key);
          const panels = target.locator('.eval-panel');
          if (await panels.count()) assert.equal(await panels.evaluate(e => e.scrollWidth <= e.clientWidth + 1), true);
          if (key === 'outcomes') {
            assert.match(await target.locator('.eval-metrics').textContent(), /Outcome 1 — Actionable/);
            assert.doesNotMatch(await target.locator('.eval-metrics').textContent(), /Actionalble/);
            assert.equal(await target.getByRole('button', { name: 'Like', exact: true }).count(), 1);
          }
          await target.screenshot({ ...shot, path: path.join(output, `${scenario}-${key}-${width}.png`) });
        }
        cases.push({ scenario, width, language: 'en-GB', accessibleTimelineToggle: true, outcomeCriterion: 'Actionable', evaluationOverflow: false });
      }
    }

    const controls = field(page, 'background').locator('.eval-controls');
    await page.locator('[data-field=background]').fill('Revised context to verify stale feedback and error wording.');
    assert.equal(await controls.locator('.eval-stale-status').isVisible(), true);
    let releaseEvaluation;
    await page.route('**/api/evaluate?*', async route => {
      await new Promise(resolve => { releaseEvaluation = resolve; });
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Deterministic preview failure.' }) });
    });
    await controls.locator('.eval-actions .eval-reevaluate-btn').click();
    assert.equal(await controls.locator('.eval-actions .eval-reevaluate-btn').getAttribute('aria-busy'), 'true');
    await controls.screenshot({ ...shot, path: path.join(output, 'pending-390.png') });
    while (!releaseEvaluation) await new Promise(resolve => setTimeout(resolve, 10));
    releaseEvaluation();
    await controls.locator('.eval-error').waitFor();
    assert.equal(await controls.locator('.eval-error').textContent(), 'Evaluation request failed: Deterministic preview failure. Retry Background below.');
    await controls.screenshot({ ...shot, path: path.join(output, 'error-390.png') });
    await page.unroute('**/api/evaluate?*');
    await controls.getByRole('button', { name: 'Retry Background', exact: true }).click();
    await controls.locator('.eval-stale-status').waitFor({ state: 'hidden' });

    for (const [scenario, width, format] of [['guardrail', 1366, 'A4'], ['ready', 390, 'Letter']]) {
      await page.setViewportSize({ width, height: 900 });
      await load(scenario);
      await page.locator('[data-field=background]').fill(longBackground);
      await page.locator('[data-list-key=researchQuestions] > .list-row > .list-input').nth(2).fill(longQuestion);
      await field(page, 'background').locator('.eval-actions .eval-reevaluate-btn').click();
      await field(page, 'researchQuestions').locator('.eval-actions .eval-reevaluate-btn').click();
      await field(page, 'outcomes').locator('.eval-actions .eval-reevaluate-btn').click();
      await page.waitForFunction(() => [...document.querySelectorAll('.eval-stale-status')].every(e => e.hidden));
      for (const key of ['background', 'researchQuestions', 'outcomes']) {
        const controls = field(page, key).locator('.eval-controls');
        if (!await controls.locator('.eval-panel').isVisible()) await controls.locator('.eval-result-btn').click();
      }
      assert.equal(await page.locator('.eval-controls .eval-panel:visible').count(), 3);
      await page.locator('.comments-block > .add-btn').click();
      await page.locator('.comments-block textarea').fill('RPA-78 print check: retain this user-authored color and behavior wording.');
      await page.waitForTimeout(650);
      const state = () => page.evaluate(() => ({
        values: [...document.querySelectorAll('textarea,input[data-field]')].map(e => e.value),
        sections: [...document.querySelectorAll('.acc')].map(e => [e.dataset.open, e.querySelector('.acc-body').hidden]),
        timeline: [...document.querySelectorAll('.timeline-chart')].map(e => e.hidden),
        focus: document.activeElement.getAttribute('aria-label'),
        draft: localStorage.getItem('research-plan-app:draft'),
      }));
      const before = await state();
      const texts = await page.locator('.eval-mdesc,.eval-rec').allTextContents();
      const filename = `${scenario}-${format.toLowerCase()}.pdf`;
      await page.pdf({ path: path.join(output, filename), format, printBackground: true, displayHeaderFooter: false });
      assert.deepEqual(await state(), before);
      await page.emulateMedia({ media: 'print' });
      assert.equal(await page.locator('.eval-actions,.eval-x,.eval-result-summary,.eval-feedback-status').evaluateAll(es => es.every(e => getComputedStyle(e).display === 'none')), true);
      await page.emulateMedia({ media: null });
      const inputs = await page.locator('textarea,input[data-field]:not([type=date])').evaluateAll(es => es.map(e => e.value).filter(Boolean));
      prints.push({ scenario, width, format, filename, inputs, texts, screenAndDraftPreserved: true, interactiveControlsExcluded: true });
    }
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    fs.writeFileSync(path.join(output, 'browser.json'), JSON.stringify({ platform: process.platform, browser: await browser.version(), mode: 'Headless Windows Chrome', cases, loadingPendingErrorAndRetry: true, errors, external }, null, 2) + '\n');
    fs.writeFileSync(path.join(output, 'print.json'), JSON.stringify(prints, null, 2) + '\n');
    console.log(JSON.stringify({ cases, pdfs: prints.map(p => p.filename), errors, external }));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
