'use strict';

// RPA-157. Gus pressed "Download as Word (.docx)" on Review and got a red
// line and no file. Every cause produced that one sentence, and the failure
// path threw the error away, so neither he nor anyone reading the report
// learned anything. The cause, reproduced here: plan-document.js had not
// loaded, so window.RPA_PLAN_DOCUMENT was undefined and the first line that
// touched it failed with "Cannot read properties of undefined (reading
// 'view')" — which is exactly the sentence he photographed, and exactly what
// a server started before that file had a route serves up.
//
// Now: the real error is logged with its stack, a failure to load says so and
// says what to do about it, and every script the page asks for is checked
// against what the server will actually serve.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp, waitFor, DRAFT_KEY } = require('./app-harness');

const ROOT = path.join(__dirname, '..');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SERVER = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();
const settle = (ms = 300) => new Promise((r) => setTimeout(r, ms));
const statusOf = (d) => d.getElementById('word-status');
const buttonOf = (d) => d.getElementById('download-word-btn');
const LOAD_FAILED = 'The Word document could not be made because part of this app has not loaded. Reload the page and try again. Your plan has not changed.';
const GENERAL = 'The Word document could not be made. Your plan has not changed. Try again, or use Print or save as PDF.';

// Records what the app logs, and what it hands to the download.
function watch(app) {
  const logged = [];
  app.window.console.error = (...args) => logged.push(args);
  let blob = null;
  app.window.URL.createObjectURL = (b) => { blob = b; return 'blob:test'; };
  app.window.URL.revokeObjectURL = () => {};
  app.window.HTMLAnchorElement.prototype.click = function () {};
  return { logged, blobOf: () => blob };
}

test('the document maker missing: the message says which part failed and what to do, and the error is logged with its stack', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  const seen = watch(app);
  const before = window.localStorage.getItem(DRAFT_KEY);

  // Exactly what a browser has when plan-document.js did not load.
  delete window.RPA_PLAN_DOCUMENT;
  buttonOf(d).click();
  await waitFor(() => text(statusOf(d)) !== 'Preparing your Word document.');

  assert.equal(text(statusOf(d)), LOAD_FAILED, 'named, and actionable');
  assert.notEqual(text(statusOf(d)), GENERAL, 'not the one sentence that fits everything');
  assert.equal(statusOf(d).dataset.error, 'true');
  assert.equal(seen.blobOf(), null, 'no file was offered');

  assert.equal(seen.logged.length, 1, 'logged once');
  const [said, err] = seen.logged[0];
  assert.match(String(said), /Word document could not be made/);
  assert.ok(err instanceof window.Error, 'an Error, not a string');
  assert.match(err.message, /plan-document\.js has not loaded/, 'the message names the missing part');
  assert.ok(err.stack && err.stack.length > 20, 'with a stack to diagnose from');

  // The guarantees that were already right stay right.
  assert.equal(window.localStorage.getItem(DRAFT_KEY), before, 'the plan is untouched');
  assert.equal(buttonOf(d).disabled, false, 'the button comes back');
  assert.equal(text(buttonOf(d)), 'Download as Word (.docx)', 'with its own label');
  assert.equal(buttonOf(d).hasAttribute('aria-busy'), false);
  assert.deepEqual(app.jsdomErrors, []);
});

test('a maker that is there but broken is caught the same way, and keeps the general words', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  const seen = watch(app);

  // A defect in the making itself is ours to fix, so it does not pretend to
  // diagnose itself to the person.
  window.RPA_PLAN_DOCUMENT.docx = () => { throw new window.Error('zip offsets went wrong'); };
  buttonOf(d).click();
  await waitFor(() => text(statusOf(d)) !== 'Preparing your Word document.');

  assert.equal(text(statusOf(d)), GENERAL);
  assert.equal(seen.logged.length, 1, 'but it is still logged');
  assert.match(String(seen.logged[0][1].message), /zip offsets went wrong/, 'with the real cause');
  assert.equal(buttonOf(d).disabled, false);
  assert.deepEqual(app.jsdomErrors, []);
});

test('a maker missing only part of itself counts as not loaded', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  watch(app);
  window.RPA_PLAN_DOCUMENT = { view: window.RPA_PLAN_DOCUMENT.view };   // no docx
  buttonOf(d).click();
  await waitFor(() => text(statusOf(d)) !== 'Preparing your Word document.');
  assert.equal(text(statusOf(d)), LOAD_FAILED);
  assert.deepEqual(app.jsdomErrors, []);
});

test('a second press after a failure still works, and the plan still downloads', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const { document: d, window } = app;
  const seen = watch(app);
  const maker = window.RPA_PLAN_DOCUMENT;

  delete window.RPA_PLAN_DOCUMENT;
  buttonOf(d).click();
  await waitFor(() => text(statusOf(d)) === LOAD_FAILED);

  // The script arrives, or the person reloads: pressing again just works.
  window.RPA_PLAN_DOCUMENT = maker;
  buttonOf(d).click();
  await waitFor(() => /^Download started/.test(text(statusOf(d))));
  assert.match(text(statusOf(d)), /\.docx$/);
  assert.equal(statusOf(d).dataset.error, 'false');
  assert.ok(seen.blobOf() && seen.blobOf().size > 1000, 'a real file the second time');
  assert.deepEqual(app.jsdomErrors, []);
});

test('every script the page asks for is one the server will serve', async () => {
  // The cause of RPA-157 was this file not reaching the browser. A script the
  // page loads and the server does not serve is the same failure waiting to
  // happen again, and nothing checked it.
  const asked = [...INDEX.matchAll(/<script\s+src="([^"]+)"/g)].map((m) => m[1]).filter((s) => !/^https?:/.test(s));
  assert.ok(asked.includes('plan-document.js'), 'the document maker is one of them');
  assert.ok(asked.length >= 8, 'found the page\'s scripts: ' + asked.join(', '));

  const served = new Set([...SERVER.matchAll(/\['(\/[^']+)',\s*'([^']+)'\]/g)].map((m) => m[1]));
  const missing = asked.filter((s) => !served.has('/' + s.replace(/^\.\//, '')));
  assert.deepEqual(missing, [], 'these are loaded by index.html but have no route in server.js');

  for (const s of asked) {
    assert.ok(fs.existsSync(path.join(ROOT, s.replace(/^\.\//, ''))), s + ' exists on disk');
  }
});
