'use strict';

// RPA-104. The whole page is white, edge to edge, as the model application
// is, and the form keeps its maximum width. Gus's decision on 14 September
// 2026, overriding the grey canvas RPA-60 had recorded as settled. The grey
// survives only as a panel colour inside the form (the evaluation head, the
// timeline track), so those still read as panels on a white page.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp } = require('./app-harness');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
const rule = (selector) => { const m = CSS.match(new RegExp('(?:^|\\n)' + selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{([^}]*)\\}')); return m ? m[1] : null; };

test('the canvas is white, and the page and the document both sit on it', () => {
  assert.match(rule(':root') || CSS.slice(0, 2000), /--canvas:#fff;/, 'the canvas token is white');
  assert.match(rule('body'), /background:var\(--canvas\)/, 'the page paints the canvas');
  assert.match(rule('.doc'), /background:#fff/, 'the document is white on white: no card edge');
  assert.doesNotMatch(rule('.doc'), /border|box-shadow/, 'and no border or shadow is added to fake one');
});

test('the form keeps its maximum width, centred', () => {
  assert.match(rule('.doc'), /max-width:860px/);
  assert.match(rule('.doc'), /margin:0 auto/);
});

test('the grey survives only as a panel colour inside the form', () => {
  assert.match(CSS, /--panel:#f3f2f1;/);
  assert.match(rule('.eval-controls .eval-head'), /background:var\(--panel\)/, 'the evaluation head is still a grey panel');
  assert.match(rule('.timeline-continuous-track'), /background:var\(--panel\)/, 'the timeline track is still a grey track');
  const uses = CSS.match(/var\(--canvas\)/g) || [];
  assert.equal(uses.length, 1, 'nothing but the page itself paints the canvas: ' + uses.length);
});

test('the page still boots on the white canvas, and nothing else moved', async (t) => {
  const app = await bootApp({});
  t.after(() => app.close());
  assert.ok(app.document.querySelector('.doc'));
  assert.deepEqual(app.jsdomErrors, []);
});
