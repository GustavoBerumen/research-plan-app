'use strict';

// RPA-121. The form's components, layout and accessibility patterns come
// from the GOV.UK Design System, and until now nothing in the repo said so.
// Two licences cover different things: govuk-frontend is MIT, and its terms
// ask that the copyright and permission notice travel with any copy; the
// Design System's documentation and guidance are Crown copyright under the
// Open Government Licence v3.0, which asks for an attribution statement.
//
// The CSS here is a hand-written adaptation rather than a copy, so the MIT
// "substantial portions" clause arguably does not bite. The notice is here
// anyway: the values, class names and patterns are taken directly,
// attribution costs nothing, and its absence is what a reader would query.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp } = require('./app-harness');

const ROOT = path.join(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(ROOT, name), 'utf8');
const NOTICE = read('NOTICE.md');
const README = read('README.md');
const CSS = read('style.css');
const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();

test('the MIT licence travels with the software, its Crown copyright line unaltered', () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'NOTICE.md')), 'the notices have a file of their own');
  assert.match(NOTICE, /Copyright \(C\) 2017 Crown Copyright \(Government Digital Service\)/,
    'the copyright line is theirs and is not reworded');
  assert.match(NOTICE, /Permission is hereby granted, free of charge, to any person obtaining a copy of/);
  assert.match(NOTICE, /The above copyright notice and this permission notice shall be included in all\s+copies or substantial portions of the Software\./,
    'including the clause that asks for exactly this');
  assert.match(NOTICE, /THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND/);
  assert.match(NOTICE, /IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN\s+CONNECTION WITH THE SOFTWARE/, 'the whole text, not an excerpt');
});

test('the Open Government Licence has its attribution statement, and what it excludes is named', () => {
  assert.match(NOTICE, /Open Government Licence v3\.0/);
  assert.match(NOTICE, /contains public sector\s+information licensed under the Open Government Licence v3\.0/,
    'the statement the licence asks for, in its own words');
  assert.match(NOTICE, /nationalarchives\.gov\.uk\/doc\/open-government-licence\/version\/3\//);
  for (const excluded of [/GOV\.UK logotype/, /Royal\s+Arms and crown/, /GDS Transport typeface/]) {
    assert.match(NOTICE, excluded, 'what the licence excludes is named rather than left to be assumed: ' + excluded);
  }
  assert.match(NOTICE, /uses Arial, the fallback govuk-frontend\s+itself specifies off-platform/, 'and what is used instead');
});

test('the notice says plainly that this is not a government service', () => {
  assert.match(NOTICE, /This service is not a government service\. It is not endorsed by, affiliated\s+with, or produced by the Government Digital Service or GOV\.UK\./);
  assert.match(NOTICE, /adapted from the\s+GOV\.UK Design System/, 'adapted, which is what was done');
  assert.doesNotMatch(NOTICE, /\bcopied from\b|\bbuilt with GOV\.UK\b/i, 'and not a claim of more than that');
});

test('a reader of the page sees the credit, with the two licences named and a link to follow; the disclaimer stays in the files (Gus, 16 September 2026)', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const credit = app.document.querySelector('.site-footer .footer-credit');
  assert.ok(credit, 'the credit is in the footer, where a colophon belongs');
  assert.equal(text(credit),
    'Form patterns adapted from the GOV.UK Design System, © Crown copyright, used under the MIT Licence and the Open Government Licence v3.0.');
  const links = Array.from(credit.querySelectorAll('a')).map((a) => a.getAttribute('href'));
  assert.deepEqual(links, ['https://design-system.service.gov.uk/', 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/'],
    'each licence and the system itself can be read for yourself');
  assert.ok(credit.previousElementSibling.classList.contains('footer-meta'), 'under the version, which is what a reporter quotes');
  // RPA-92 and RPA-105 still hold: borrowed patterns, never borrowed
  // branding. Naming the licence is the opposite of wearing the badge.
  assert.equal(app.document.querySelector('header img, footer img'), null, 'no crest or wordmark anywhere in the chrome');
  assert.doesNotMatch(CSS, /font-family:[^;]*GDS Transport/i, 'the typeface reserved for government services is never asked for');
  assert.doesNotMatch(CSS, /@font-face/i, 'and none is fetched');
  assert.match(CSS, /--font:Arial,Helvetica,sans-serif/, 'Arial is used instead, the fallback govuk-frontend itself specifies off-platform');
  assert.deepEqual(app.jsdomErrors, []);
});

test('the credit is for the screen: a printed plan is the person’s document, not this app’s colophon', () => {
  const print = CSS.slice(CSS.indexOf('@media print{.footer-credit'));
  assert.match(print, /\.footer-credit\{display:none!important\}/);
  assert.match(CSS, /\.footer-credit\{margin:8px 0 0;font-size:var\(--text-sm\)/, 'and it is set quietly, under the version line');
});

test('the README credits it and the manifest says what this app itself is', () => {
  assert.match(README, /## Credits and licence/);
  assert.match(README, /\[GOV\.UK Design System\]\(https:\/\/design-system\.service\.gov\.uk\/\)/);
  assert.match(README, /\[NOTICE\.md\]\(NOTICE\.md\)/, 'and points at the full notices');
  assert.match(README, /Adapted rather than copied/);
  assert.match(README, /\*\*This is not a government\s+service\.\*\*/);
  const manifest = JSON.parse(read('package.json'));
  assert.equal(manifest.license, 'UNLICENSED', 'the app grants nobody rights to itself until that is decided');
  assert.equal(manifest.private, true);
  assert.match(README, /`UNLICENSED`, which grants nobody any rights to it/, 'and the README says so rather than leaving it to be found');
});
