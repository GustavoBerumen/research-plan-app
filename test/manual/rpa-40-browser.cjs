'use strict';
// Installed Chrome via Playwright; native browser file input/download flows.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.argv[2] || 'playwright');
const { realisticBackup, smallBackup } = require('../rpa-40-fixtures.cjs');
const origin = process.argv[3] || 'http://127.0.0.1:8955';
const output = path.join(__dirname, 'rpa-40-evidence');
const draftKey = 'research-plan-app:draft';
const stable = data => { const copy = structuredClone(data); delete copy.savedAt; return copy; };

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const realisticPath = path.join(output, 'realistic-plan.json');
  const smallPath = path.join(output, 'small-plan.json');
  const invalidPath = path.join(output, 'invalid-plan.json');
  fs.writeFileSync(realisticPath, JSON.stringify(realisticBackup(), null, 2));
  fs.writeFileSync(smallPath, JSON.stringify(smallBackup(), null, 2));
  fs.writeFileSync(invalidPath, '{corrupt');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const evidence = { browser: await browser.version(), mode: 'Installed Windows Chrome, headless Playwright', cases: [], errors: [], externalRequests: [] };
  try {
    for (const width of [1366, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, acceptDownloads: true });
      const page = await context.newPage();
      page.on('pageerror', error => evidence.errors.push(String(error)));
      const requests = [];
      page.on('request', request => { if (request.method() === 'POST') requests.push(request.url()); });
      await page.route('**/*', route => {
        if (new URL(route.request().url()).origin === origin) return route.continue();
        evidence.externalRequests.push(route.request().url()); return route.abort();
      });
      await page.goto(origin);
      await page.locator('#download-backup-btn:enabled').waitFor();
      let confirmation = 'accept';
      let confirmationCount = 0;
      page.on('dialog', dialog => { confirmationCount++; return confirmation === 'accept' ? dialog.accept() : dialog.dismiss(); });
      const importFile = async file => {
        const chooserPromise = page.waitForEvent('filechooser');
        await page.locator('#restore-backup-btn').focus();
        await page.keyboard.press('Enter');
        await (await chooserPromise).setFiles(file);
        await page.waitForFunction(() => !document.getElementById('restore-backup-btn').disabled);
        return page.locator('#backup-status').textContent();
      };
      const readStored = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), draftKey);
      const downloadFile = async name => {
        const event = page.waitForEvent('download');
        await page.locator('#download-backup-btn').focus();
        await page.keyboard.press('Enter');
        const download = await event;
        const saved = path.join(output, name);
        await download.saveAs(saved);
        assert.equal(await download.failure(), null);
        return { data: JSON.parse(fs.readFileSync(saved, 'utf8')), path: saved, name: download.suggestedFilename() };
      };
      assert.match(await importFile(realisticPath), /^Backup restored and saved/);
      assert.equal(confirmationCount, 0, 'defaults do not ask for replacement');
      assert.equal(await page.locator('#restore-backup-btn').evaluate(e => e === document.activeElement), true);
      const freshTitle = 'Immediate edit — café 🧭 ' + width;
      await page.locator('[data-field=researchTitle]').fill(freshTitle);
      const downloaded = await downloadFile('download-' + width + '.json');
      assert.equal(downloaded.data.fields.researchTitle, freshTitle);
      assert.notEqual((await readStored()).fields.researchTitle, freshTitle, 'download ran before autosave');
      assert.match(downloaded.name, /backup \d{4}-\d{2}-\d{2}\.json$/);
      await page.waitForFunction(({ key, value }) => JSON.parse(localStorage.getItem(key)).fields.researchTitle === value, { key: draftKey, value: freshTitle });
      const before = await readStored();
      confirmation = 'dismiss';
      assert.match(await importFile(smallPath), /^Restore cancelled/);
      assert.deepEqual(await readStored(), before);
      assert.match(await importFile(invalidPath), /^Could not restore/);
      assert.deepEqual(await readStored(), before);
      confirmation = 'accept';
      assert.match(await importFile(smallPath), /^Backup restored and saved/);
      assert.equal(await page.locator('.custom-field-block').count(), 0);
      assert.equal((await readStored()).fields.project, undefined);
      assert.match(await importFile(downloaded.path), /^Backup restored and saved/);
      assert.deepEqual(stable(await readStored()), stable(downloaded.data));
      assert.match(await importFile(downloaded.path), /^Backup restored and saved/);
      assert.equal(await page.locator('.custom-field-block').count(), 2);
      await page.reload();
      await page.locator('#download-backup-btn:enabled').waitFor();
      const reloaded = await downloadFile('reloaded-' + width + '.json');
      assert.deepEqual(stable(reloaded.data), stable(downloaded.data));
      assert.equal(await page.locator('html').evaluate(e => e.scrollWidth <= innerWidth), true, 'no page overflow');
      assert.equal(await page.locator('#backup-status').getAttribute('role'), 'status');
      await page.locator('.backup-help details summary').click();
      await page.screenshot({ path: path.join(output, 'backup-controls-' + width + '.png') });
      for (const event of ['beforeprint', 'afterprint']) await page.evaluate(name => window.dispatchEvent(new Event(name)), event);
      await page.emulateMedia({ media: 'print' });
      assert.equal(await page.locator('.toolbar').isVisible(), false);
      assert.equal(await page.locator('.backup-help').last().isVisible(), false);
      await page.emulateMedia({ media: 'screen' });
      assert.equal(requests.length, 0, 'backup operations send no POST requests');
      evidence.cases.push({ width, keyboardDownload: true, keyboardFileChooser: true, actualDownloadedJson: true,
        importOverLargerPlan: true, repeatImport: true, reloadRoundTrip: true, cancellation: true, corruptJson: true,
        immediateBeforeAutosave: true, noOverflow: true, accessibleStatus: true, printControlsHidden: true, noPosts: true });
      await context.close();
    }
    assert.deepEqual(evidence.errors, []);
    assert.deepEqual(evidence.externalRequests, []);
    fs.writeFileSync(path.join(output, 'browser.json'), JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
