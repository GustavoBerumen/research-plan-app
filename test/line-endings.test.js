'use strict';

// The content files are Markdown that people edit by hand, so on Windows they
// arrive with CRLF. That broke the form in the worst available way: every
// field rendered, every section rendered, and not one hint did. Nothing was
// reported, and CI never saw it because CI runs on Ubuntu.
//
// The cause was that the Hint/Good/Bad matchers in parseSchema run against the
// untrimmed line — they need to see its indentation — and in a JavaScript
// regex "." excludes line terminators, \r among them. So "(.*)$" could not
// reach the end of a CRLF line and the match failed outright rather than
// capturing a stray character.
//
// Found by Max reviewing PR #22 on a Windows checkout.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootApp, listInputs } = require('./app-harness');

const ROOT = path.join(__dirname, '..');
const ASSETS = ['research-plan-template.md', 'research-plan-rubric.md', 'research-methods.md'];

function read(name) {
  return fs.readFileSync(path.join(ROOT, name), 'utf8');
}

function withLineEndings(ending) {
  const assets = {};
  ASSETS.forEach((name) => {
    assets[name] = read(name).replace(/\r\n?|\n/g, ending);
  });
  return assets;
}

async function snapshot(app) {
  const { document } = app;
  const text = (el) => (el ? el.textContent.trim() : null);
  return {
    sections: Array.from(document.querySelectorAll('.acc-title')).map(text),
    counts: Array.from(document.querySelectorAll('.acc-count')).map(text),
    hints: Array.from(document.querySelectorAll('.field-hint-text')).map(text),
    fields: Array.from(document.querySelectorAll('[data-field]'))
      .map((el) => el.getAttribute('data-field')),
    methodOptions: listInputs(document, 'methods').length,
  };
}

test('a template with Windows line endings renders exactly like a Unix one', async (t) => {
  const unix = await bootApp({ textAssets: withLineEndings('\n') });
  t.after(() => unix.close());
  const expected = await snapshot(unix);

  // The regression: this used to be 0.
  assert.ok(expected.hints.length > 20, `expected the form to render hints, got ${expected.hints.length}`);

  const windows = await bootApp({ textAssets: withLineEndings('\r\n') });
  t.after(() => windows.close());
  const actual = await snapshot(windows);

  assert.deepEqual(actual, expected, 'CRLF input must produce an identical form');
});

test('no hint carries a stray carriage return into the page', async (t) => {
  const app = await bootApp({ textAssets: withLineEndings('\r\n') });
  t.after(() => app.close());

  const hints = Array.from(app.document.querySelectorAll('.field-hint-text'));
  assert.ok(hints.length > 0);
  const dirty = hints.filter((h) => /[\r\n]/.test(h.textContent));
  assert.deepEqual(dirty.map((h) => h.textContent), [],
    'a hint should never contain a raw line terminator');
});

test('old Mac line endings parse too', async (t) => {
  // \r alone is the other thing "normalise line endings" has to mean, and it
  // costs one alternation in the same regex to cover.
  const app = await bootApp({ textAssets: withLineEndings('\r') });
  t.after(() => app.close());

  assert.ok(app.document.querySelectorAll('.field-hint-text').length > 20);
  assert.ok(app.document.querySelector('[data-field="background"]'));
});

test('the server parses a CRLF methods list the same as a LF one', () => {
  // The server reads research-methods.md itself, for the "Suggest methods"
  // endpoint, with its own copy of the parser — so it needs its own test.
  // server.js only listens when run directly, but it does check for an API
  // key at import and exits without one. Nothing here calls the API; the
  // placeholder just gets the module loaded.
  process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key-not-used';
  const { parseMethodsList } = require(path.join(ROOT, 'server.js'));
  const source = read('research-methods.md');

  const fromUnix = parseMethodsList(source.replace(/\r\n?|\n/g, '\n'));
  const fromWindows = parseMethodsList(source.replace(/\r\n?|\n/g, '\r\n'));

  assert.ok(fromUnix.length > 100, `expected the full methods list, got ${fromUnix.length}`);
  assert.deepEqual(fromWindows, fromUnix);
  assert.deepEqual(fromWindows.filter((m) => /[\r\n]/.test(m)), [],
    'no method name should carry a line terminator');
});
