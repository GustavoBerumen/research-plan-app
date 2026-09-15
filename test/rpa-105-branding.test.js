'use strict';

// RPA-105. A mark for the form: the tip of a pencil pointing down and to
// the left, in lines only, the way the design system's own header keeps its
// mark simple (Gus's brief and picture, 15 September 2026: the government's
// mark as the model; a pencil for the writing). Drawn once as a symbol and
// used from the header, the footer
// and the printed footer line; the same drawing is the favicon, served by
// the server in every mode. Decoration to a screen reader: the name is the
// words.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp } = require('./app-harness');
const { loadServer } = require('./rpa-89-server-harness.cjs');

const ROOT = path.join(__dirname, '..');
const CSS = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const FAVICON = fs.readFileSync(path.join(ROOT, 'favicon.svg'), 'utf8');
const text = (n) => (n && n.textContent || '').replace(/\s+/g, ' ').trim();
const strokes = (svg) => (svg.match(/<(circle|path)[^>]*>/g) || []).map((s) => s.replace(/\s+stroke-width="[^"]*"/, '')).join('|');

test('one mark, drawn once, beside the name in the header and the footer and on the printed line; a decoration, not a name', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  const d = app.document;
  const symbol = d.getElementById('rpa-mark');
  assert.equal(symbol && symbol.tagName.toLowerCase(), 'symbol', 'the drawing lives in one symbol');
  assert.equal(symbol.getAttribute('viewBox'), '0 0 32 32');
  assert.equal(symbol.querySelector('circle'), null, 'lines only');
  const paths = Array.from(symbol.querySelectorAll('path')).map((p) => p.getAttribute('d'));
  assert.equal(paths.length, 4, 'the silhouette, the shoulder, the body lines, the lead');
  assert.match(paths[0], /^M18\.6 3\.6L5\.1 17L3 29L15 26\.9L28\.5 13\.5$/, 'the silhouette: body edge, cone, the point at the bottom left, cone, body edge');
  assert.match(paths[3], /Q/, 'the lead is the one curve');
  assert.equal(symbol.querySelector('g').getAttribute('stroke'), 'currentColor', 'one colour, the text\'s own');
  assert.equal(symbol.closest('svg').hasAttribute('hidden'), true, 'the symbol itself draws nothing');
  const uses = Array.from(d.querySelectorAll('svg.logo'));
  assert.equal(uses.length, 3, 'header, footer, printed line');
  for (const svg of uses) {
    assert.equal(svg.querySelector('use').getAttribute('href'), '#rpa-mark', 'every use is the one drawing');
    assert.equal(svg.getAttribute('aria-hidden'), 'true', 'not read out');
    assert.equal(svg.getAttribute('focusable'), 'false');
  }
  const link = d.querySelector('header .service-name');
  assert.ok(link.querySelector('svg.logo'), 'in the header, first in the link');
  assert.equal(link.firstElementChild, link.querySelector('svg.logo'));
  assert.equal(text(link), 'Research Plan', 'the link\'s name is still the words');
  assert.equal(link.getAttribute('href'), './');
  assert.ok(d.querySelector('.footer-meta svg.logo.logo-footer'), 'in the footer, by the name and version');
  assert.ok(d.querySelector('.footer-print-only svg.logo.logo-print'), 'and on the printed line, so a PDF carries it');
  assert.match(text(d.querySelector('.footer-meta')), /^Research Plan/);
  assert.deepEqual(app.jsdomErrors, []);
});

test('the favicon is the same drawing, and the server serves it as SVG in both modes', async () => {
  assert.match(HTML, /<link rel="icon" type="image\/svg\+xml" href="favicon\.svg">/);
  const symbol = HTML.match(/<symbol id="rpa-mark"[\s\S]*?<\/symbol>/)[0];
  assert.equal(strokes(FAVICON), strokes(symbol).replace(/currentColor/g, '#0b0c0c'), 'the same strokes; the favicon cannot borrow the page\'s symbol, so it carries the ink colour itself');
  assert.match(FAVICON, /stroke="#0b0c0c"/, 'ink, the header\'s own');
  for (const pilot of ['true', 'false']) {
    const app = loadServer({ pilot });
    const res = await app.request('/favicon.svg');
    assert.equal(res.status, 200, 'pilot=' + pilot);
    assert.equal(res.headers['Content-Type'], 'image/svg+xml');
    assert.equal(res.body, FAVICON);
  }
});

test('sized to sit with the words: 28px in the header, smaller in the footer and on paper; the rule stays under the name', () => {
  assert.match(CSS, /\.logo\{width:28px;height:28px;[^}]*color:inherit/);
  assert.match(CSS, /\.logo-footer\{width:22px;height:22px/);
  assert.match(CSS, /\.logo-print\{width:16px;height:16px/);
  assert.match(CSS, /\.service-name\{display:inline-flex;align-items:center;gap:9px/);
  assert.match(CSS, /\.service-name-text\{border-bottom:3px solid var\(--ink\)/, 'the underline belongs to the words, not the mark');
  assert.doesNotMatch(CSS.match(/\.service-name\{[^}]*\}/)[0], /border-bottom/);
  const print = CSS.slice(CSS.lastIndexOf('@media print'));
  assert.doesNotMatch(print, /\.logo/, 'print hides nothing of it: the header is hidden as a whole, the printed line shows');
});
