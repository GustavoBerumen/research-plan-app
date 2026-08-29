'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  bindTextarea,
  bindTextareas,
  resizeTextarea,
  resizeTextareas,
} = require('../textarea-autosize');

function fakeTextarea(scrollHeight) {
  const listeners = new Map();

  return {
    value: '',
    scrollHeight,
    style: {},
    addEventListener(type, listener) {
      const handlers = listeners.get(type) || [];
      handlers.push(listener);
      listeners.set(type, handlers);
    },
    dispatchInput() {
      (listeners.get('input') || []).forEach((listener) => listener());
    },
    listenerCount(type) {
      return (listeners.get(type) || []).length;
    },
  };
}

function fakeRoot(textareas) {
  return {
    querySelectorAll(selector) {
      assert.equal(selector, 'textarea');
      return textareas;
    },
  };
}

test('sizes a textarea from its content on initial binding', () => {
  const textarea = fakeTextarea(72);

  bindTextarea(textarea);

  assert.equal(textarea.style.height, '72px');
  assert.equal(textarea.listenerCount('input'), 1);
});

test('includes textarea borders in the assigned border-box height', () => {
  const textarea = fakeTextarea(72);
  textarea.ownerDocument = {
    defaultView: {
      getComputedStyle() {
        return { borderTopWidth: '1px', borderBottomWidth: '1px' };
      },
    },
  };

  resizeTextarea(textarea);

  assert.equal(textarea.style.height, '74px');
});

test('grows for typing or pasting and shrinks after deletion', () => {
  const textarea = fakeTextarea(44);
  bindTextarea(textarea);

  textarea.scrollHeight = 180;
  textarea.dispatchInput();
  assert.equal(textarea.style.height, '180px');

  textarea.scrollHeight = 44;
  textarea.dispatchInput();
  assert.equal(textarea.style.height, '44px');
});

test('profile switching replaces a stale long height with the new short height', () => {
  const textarea = fakeTextarea(220);
  bindTextarea(textarea);
  assert.equal(textarea.style.height, '220px');

  textarea.value = 'Short profile value';
  textarea.scrollHeight = 44;
  textarea.dispatchInput();

  assert.equal(textarea.style.height, '44px');
});

test('draft restoration sizes every Research Question and Outcome row', () => {
  const rows = [
    fakeTextarea(66),
    fakeTextarea(110),
    fakeTextarea(88),
    fakeTextarea(132),
  ];

  const bound = bindTextareas(fakeRoot(rows));

  assert.equal(bound.length, 4);
  assert.deepEqual(
    rows.map((row) => row.style.height),
    ['66px', '110px', '88px', '132px']
  );
  assert.ok(rows.every((row) => row.listenerCount('input') === 1));
});

test('recalculates multiple visible rows after layout or programmatic changes', () => {
  const rows = [
    fakeTextarea(70),
    fakeTextarea(90),
    fakeTextarea(120),
    fakeTextarea(150),
  ];
  const root = fakeRoot(rows);

  rows.forEach((row) => {
    row.style.height = '300px';
  });

  const resized = resizeTextareas(root);

  assert.equal(resized.length, 4);
  assert.deepEqual(
    rows.map((row) => row.style.height),
    ['70px', '90px', '120px', '150px']
  );
});

test('defers a hidden textarea until its accordion is visible', () => {
  const textarea = fakeTextarea(0);
  textarea.style.height = '96px';

  resizeTextarea(textarea);
  assert.equal(textarea.style.height, 'auto');

  textarea.scrollHeight = 104;
  resizeTextareas(fakeRoot([textarea]));
  assert.equal(textarea.style.height, '104px');
});

test('binding twice does not attach duplicate input handlers', () => {
  const textarea = fakeTextarea(72);

  bindTextarea(textarea);
  bindTextarea(textarea);

  assert.equal(textarea.listenerCount('input'), 1);
});
