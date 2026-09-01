'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('loads the autosize helper before the application', () => {
  const helperIndex = htmlSource.indexOf(
    '<script src="textarea-autosize.js"></script>'
  );
  const appIndex = htmlSource.indexOf('<script src="app.js"></script>');

  assert.ok(helperIndex >= 0);
  assert.ok(appIndex > helperIndex);
});

test('creates and binds multi-line Research Question and Outcome rows', () => {
  assert.match(
    appSource,
    /function addOutcomeRow[\s\S]*?el\('textarea', 'finput list-input'[\s\S]*?bindTextarea\(inp\)/
  );
  assert.match(
    appSource,
    /const isGrowable = field\.key === 'researchQuestions'[\s\S]*?el\('textarea', 'finput list-input'[\s\S]*?if \(isGrowable\) bindTextarea\(inp\)/
  );
});

test('recalculates textarea heights after a closed accordion opens', () => {
  assert.match(
    appSource,
    /function setAccOpen[\s\S]*?body\.hidden = !open;[\s\S]*?if \(open\) resizeTextareas\(body\)/
  );
});

test('profile switching and draft restoration emit the autosize input event for list rows', () => {
  assert.match(
    appSource,
    /function applyTestProfileList[\s\S]*?input\.value = values\[index\];[\s\S]*?dispatchFieldUpdate\(input\)/
  );
  assert.match(
    appSource,
    /function applyDraft[\s\S]*?inputs\[i\]\.value = v;[\s\S]*?inputs\[i\]\.dispatchEvent\(new Event\('input', \{ bubbles: true \}\)\)/
  );
});
