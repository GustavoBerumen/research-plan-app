'use strict';

// RPA-92. The page used to open with a sticky white toolbar — a dot, the words
// "Research Plan", four buttons — and end with nothing at all. For a form
// people are sent a link to and asked to complete alone, that leaves the basic
// questions unanswered on arrival: what is this, is it finished, where does
// what I type go, who do I tell if it breaks.
//
// The structure follows GOV.UK's generic header, service navigation, phase
// banner and footer. The crown, the wordmark and GOV.UK blue are deliberately
// absent: a non-GOV.UK service must not use them, and the Design System says
// so itself. Take the structure and the typography, not the badge.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp } = require('./app-harness');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');

// A config the client accepts, with the marker the footer reads. Returned
// fetch-shaped — { ok, json } — because that is what getConfig reads off the
// mocked response, the same way the harness's own response() helper does.
const config = (extra) => () => ({
  ok: true,
  json: async () => Object.assign({
    pilotMode: false,
    capabilities: { calibration: true, uploads: true, addFramework: true, jira: false, googleDrive: false },
    jiraEnabled: false,
  }, extra),
});

async function ready(app) {
  // The footer fills once /api/config resolves; wait for it rather than sleep.
  const { document } = app;
  for (let i = 0; i < 40 && !document.getElementById('app-version').textContent; i += 1) {
    await new Promise((r) => setTimeout(r, 25));
  }
  return document;
}

test('the form has a beginning and an end: one banner, one main, one contentinfo', async (t) => {
  const app = await bootApp({ configResponse: config() });
  t.after(() => app.close());
  const { document } = app;

  const banners = document.querySelectorAll('header[role="banner"], [role="banner"]');
  const mains = document.querySelectorAll('main');
  const infos = document.querySelectorAll('footer[role="contentinfo"], [role="contentinfo"]');
  assert.equal(banners.length, 1, 'exactly one banner landmark');
  assert.equal(mains.length, 1, 'exactly one main');
  assert.equal(infos.length, 1, 'exactly one contentinfo');

  // Order is the point: header, then the form, then the footer.
  const [header, main, footer] = [banners[0], mains[0], infos[0]];
  assert.ok(header.compareDocumentPosition(main) & 4, 'header precedes main');
  assert.ok(main.compareDocumentPosition(footer) & 4, 'main precedes footer');
  assert.ok(main.contains(document.getElementById('doc')), 'the form itself is inside main');
});

test('the header names the service, as a link to the start, not a badge', async (t) => {
  const app = await bootApp({ configResponse: config() });
  t.after(() => app.close());
  const link = app.document.querySelector('header .service-name');
  assert.ok(link, 'a service-name link exists');
  assert.equal(link.tagName, 'A');
  assert.equal(link.textContent.trim(), 'Research Plan');
  assert.equal(app.document.querySelector('.tb-dot'), null, 'the old dot badge is gone');
});

test('nothing rendered carries GOV.UK branding', async (t) => {
  // Checked on rendered text, not source: index.html has a comment explaining
  // why the crown is absent, and a comment is not branding.
  const app = await bootApp({ configResponse: config() });
  t.after(() => app.close());
  const text = app.document.body.textContent;
  assert.doesNotMatch(text, /GOV\.UK/i);
  assert.doesNotMatch(text, /crown copyright|open government licence/i);
  // Scoped to the chrome: the form draws its own accordion chevrons and
  // evaluation icons, and those are not branding.
  assert.equal(app.document.querySelectorAll('header svg, header img, footer svg, footer img').length, 0,
    'no logo, crest or wordmark image in the header or footer');
});

test('the phase banner is present during the pilot, and is one element to delete', async (t) => {
  const app = await bootApp({ configResponse: config() });
  t.after(() => app.close());
  const { document } = app;

  const banner = document.querySelector('header .phase-banner');
  assert.ok(banner, 'inside the header, after the bar — where GOV.UK places it');
  assert.equal(banner.dataset.phase, 'beta');
  assert.equal(banner.querySelector('.phase-tag').textContent.trim(), 'Beta');
  // Gus's wording: it is not a service, so the banner does not call it one.
  assert.match(banner.querySelector('.phase-text').textContent, /work in progress/i, 'it says plainly that it is unfinished');
  assert.match(banner.querySelector('.phase-text').textContent, /feedback/i, 'and that feedback is wanted');
  assert.doesNotMatch(banner.querySelector('.phase-text').textContent, /\bservice\b/i, 'and never calls it a service');

  // Removable without redesigning the header: take it out, and the bar and
  // its actions are untouched.
  banner.remove();
  assert.equal(document.querySelectorAll('header .phase-banner').length, 0);
  assert.equal(document.querySelectorAll('header .tb-btns button').length, 4);
});

test('the toolbar actions live in the header, and there is only one bar', async (t) => {
  const app = await bootApp({ configResponse: config() });
  t.after(() => app.close());
  const { document } = app;

  const inHeader = Array.from(document.querySelectorAll('header .tb-btns button')).map((b) => b.id);
  assert.deepEqual(inHeader, ['download-backup-btn', 'restore-backup-btn', 'clear-btn', 'print-btn'],
    'all four actions, in order, inside the banner');
  assert.equal(document.querySelectorAll('.toolbar').length, 0, 'the separate sticky toolbar is gone');
  assert.equal(document.querySelectorAll('.site-bar').length, 1, 'one bar, not two');

  // Keyboard reachable: real buttons, none removed from the tab order.
  document.querySelectorAll('header .tb-btns button').forEach((b) => {
    assert.equal(b.tagName, 'BUTTON');
    assert.ok(b.tabIndex >= 0, b.id + ' is focusable');
  });
});

test('the footer says what this is, where the writing goes, and who to tell', async (t) => {
  const app = await bootApp({ configResponse: config() });
  t.after(() => app.close());
  const footer = app.document.querySelector('footer[role="contentinfo"]');
  const text = footer.textContent;

  assert.match(text, /research plan for product teams/i, 'what it is and who for');
  assert.match(text, /stay in this browser/i, 'where the writing goes');
  assert.match(text, /never sent unless/i);
  assert.match(text, /tell the person who sent you this link/i, 'how to report a problem');
  assert.equal(footer.querySelectorAll('h2').length, 3, 'three headed sections');
});

test('the footer carries a version and build marker from the server', async (t) => {
  const app = await bootApp({ configResponse: config({ version: '1.0.0', build: 'abc1234' }) });
  t.after(() => app.close());
  const document = await ready(app);
  assert.equal(document.getElementById('app-version').textContent, 'v1.0.0 · abc1234');
});

test('when the server cannot say its version, the footer says so rather than going blank', async (t) => {
  // "I don't know the version" is itself useful in a bug report.
  const app = await bootApp({ configResponse: () => { throw new Error('down'); } });
  t.after(() => app.close());
  const document = await ready(app);
  assert.equal(document.getElementById('app-version').textContent, 'version unavailable');
});

test('the aside above the form keeps only what is needed before starting', async (t) => {
  // The long explanation of what a backup contains moved to the footer; the
  // one sentence about autosave stays, and so do the status regions, because
  // they announce the results of the actions beside them.
  const app = await bootApp({ configResponse: config() });
  t.after(() => app.close());
  const { document } = app;
  const aside = document.querySelector('.backup-help');
  assert.ok(aside);
  assert.equal(aside.querySelector('details'), null, 'the details block has gone to the footer');
  assert.ok(document.getElementById('backup-help'), 'the sentence the buttons are described by');
  assert.ok(document.getElementById('backup-status'));
  assert.ok(document.getElementById('capability-status'));
  assert.match(document.querySelector('footer').textContent, /A backup is a file/i, 'and what a backup is, is in the footer');
});

test('print is decided: the header and phase banner do not print, the footer prints one line', () => {
  // Decided rather than inherited. RPA-47 owns the printed document and is
  // told on the ticket.
  const print = CSS.slice(CSS.indexOf('@media print{'));
  assert.match(print, /\.site-header,\.skip-link,/, 'the header is in the print hide-list');
  assert.match(print, /\.footer-cols,\.footer-meta\{display:none!important\}/, 'the screen footer content does not print');
  assert.match(print, /\.footer-print-only\{display:block/, 'the one-line provenance does');
  assert.match(CSS, /\.footer-print-only\{display:none\}/, 'and that line is hidden on screen');
});

test('the layout holds at laptop and narrow widths', () => {
  // jsdom does not lay out, so this pins the responsive rules the widths rely
  // on: the bar wraps under 600px, the footer collapses to one column under
  // 760px, and nothing about the header is fixed-height.
  assert.match(CSS, /@media screen and \(max-width:600px\)\{\.site-bar\{[^}]*flex-wrap:wrap/);
  const at760 = CSS.slice(CSS.indexOf('@media(max-width:760px){'));
  assert.match(at760.slice(0, at760.indexOf('\n')), /\.footer-cols\{grid-template-columns:1fr/,
    'the footer collapses to one column inside the 760px block');
  assert.doesNotMatch(CSS.match(/\.site-header\{[^}]*\}/)[0], /height:/, 'the header sizes to its content');
});
