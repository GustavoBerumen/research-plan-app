'use strict';

// RPA-62, part two. Core Focus says what a theory is and UXR Application says
// what it suits; neither says what to do. The match panel now carries three
// fixed instructions for this study — what to look for, what to ask, what to
// attend to in analysis — as an ordered list with the slot named on each.
//
// Three fixed slots rather than a prose field, and each bounded: the
// rationale is capped at two sentences and reliably uses both, so a free
// paragraph here would do the same and the two would merge back into the one
// long field the ticket set out to split. Match path only — the draft path
// already renders a whole proposed entry, and guidance on applying an
// unverified theory is advice built on sand.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { bootApp } = require('./app-harness');

const TAM_ENTRY = [
  '### Technology Acceptance Model (TAM) & UTAUT',
  '* **Core Focus:** Models behavioural intent to adopt new technology.',
  '* **UXR Application:** Enterprise rollout and feature adoption studies.',
  '* **Key References:**',
  '  * Davis, F. D. (1989). Perceived usefulness, perceived ease of use, and user'
    + ' acceptance of information technology. *MIS Quarterly*, 13(3), 319–340.'
    + ' https://doi.org/10.2307/249008',
].join('\n');

const GUIDANCE = [
  'Where perceived effort, not feature value, decides whether a team keeps using the tool.',
  'What would make this feel easier than the way you do it today?',
  'Separate ease-of-use complaints from usefulness complaints before scoring.',
];

function match(overrides) {
  return Object.assign({
    matched: true,
    name: 'Technology Acceptance Model (TAM) & UTAUT',
    rationale: 'It maps switching cost onto perceived ease of use.',
    guidance: GUIDANCE,
    entry: TAM_ENTRY,
  }, overrides);
}

async function openTheory(app) {
  const { document } = app;
  const accordion = Array.from(document.querySelectorAll('.acc'))
    .find((a) => a.querySelector('.acc-title').textContent.trim() === 'Methodology');
  if (accordion.querySelector('.acc-body').hidden) accordion.querySelector('.acc-head').click();
  const field = document.querySelector('[data-field="theory"]').closest('.field');
  Array.from(field.querySelectorAll('button')).find((b) => /suggest a framework/i.test(b.textContent)).click();
  await new Promise((resolve) => setTimeout(resolve, 50));
  return { field, panel: field.querySelector('.fw-panel'), input: document.querySelector('[data-field="theory"]') };
}

test('a match carries three instructions, in the order the ticket names', async (t) => {
  const app = await bootApp({ suggestFramework: () => match() });
  t.after(() => app.close());
  const { panel } = await openTheory(app);

  const items = Array.from(panel.querySelectorAll('.fw-guidance li'));
  assert.equal(items.length, 3);
  assert.deepEqual(items.map((li) => li.querySelector('b').textContent), ['Look for', 'Ask', 'In analysis'],
    'each slot is named, so the shape reads before the sentence does');
  assert.deepEqual(items.map((li) => li.textContent.replace(/^(Look for|Ask|In analysis)\s/, '')), GUIDANCE);
  assert.equal(panel.querySelector('.fw-guidance').tagName, 'OL', 'a sequence, not a set');
});

test('it sits between what the library says and the citation', async (t) => {
  // The panel's order is an argument: why it fits, what it is, what to do,
  // where to read more. Guidance is the third step, not a footnote.
  const app = await bootApp({ suggestFramework: () => match() });
  t.after(() => app.close());
  const { panel } = await openTheory(app);

  const order = Array.from(panel.querySelectorAll('.fw-rationale, .fw-detail, .fw-guidance, .fw-ref'))
    .map((n) => n.className);
  assert.deepEqual(order, ['fw-rationale', 'fw-detail', 'fw-guidance', 'fw-ref']);
});

test('an incomplete set renders nothing, not a hollow list', async (t) => {
  // The server only forwards a full three, but the client guards too: a
  // two-item list with a labelled empty third slot would look like the model
  // had run out of things to say.
  for (const guidance of [undefined, [], GUIDANCE.slice(0, 2), ['', '', '']]) {
    const app = await bootApp({ suggestFramework: () => match({ guidance }) });
    const { panel } = await openTheory(app);
    assert.equal(panel.querySelector('.fw-guidance'), null, 'no list for ' + JSON.stringify(guidance));
    assert.equal(panel.querySelector('.fw-guidance-head'), null);
    assert.ok(panel.querySelector('.fw-detail'), 'the rest of the panel is unaffected');
    app.close();
  }
});

test('an item that begins with its slot word is not labelled twice', async (t) => {
  // The prompt forbids it and the first live run did it anyway: item two came
  // back "Ask each role what they think…" under a slot labelled "Ask". A
  // request to a model is not a guarantee, so the strip is done here.
  const app = await bootApp({ suggestFramework: () => match({ guidance: [
    'Look for: where effort, not value, decides adoption.',
    'ask each role what they think the others are doing.',
    'In analysis — separate ease-of-use complaints from usefulness complaints.',
  ] }) });
  t.after(() => app.close());
  const { panel } = await openTheory(app);

  const items = Array.from(panel.querySelectorAll('.fw-guidance li')).map((li) => li.textContent);
  assert.deepEqual(items, [
    'Look for Where effort, not value, decides adoption.',
    'Ask Each role what they think the others are doing.',
    'In analysis Separate ease-of-use complaints from usefulness complaints.',
  ]);
  // And the slot label itself is untouched — it is the strip, not the label, that moved.
  assert.deepEqual(Array.from(panel.querySelectorAll('.fw-guidance li b')).map((b) => b.textContent),
    ['Look for', 'Ask', 'In analysis']);
});

test('the guidance is read, never written into the plan', async (t) => {
  // Decision 1: the field stays short. Writing three instructions into Theory
  // would make every plan longer, which is the opposite of RPA-55.
  const app = await bootApp({ suggestFramework: () => match() });
  t.after(() => app.close());
  const { panel, input } = await openTheory(app);

  Array.from(panel.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Use this framework').click();
  assert.equal(input.value.split('\n').length, 2, 'name and reference only');
  GUIDANCE.forEach((g) => assert.doesNotMatch(input.value, new RegExp(g.slice(0, 20))));
});

test('the tool asks the model for exactly three bounded items, and the prompt says which', () => {
  // Testable without an API call, which is why these two are exported.
  process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key-not-used';
  const { FRAMEWORK_MATCH_TOOL, buildFrameworkMatchPrompt } = require(path.join(__dirname, '..', 'server.js'));

  const g = FRAMEWORK_MATCH_TOOL.input_schema.properties.guidance;
  assert.equal(g.type, 'array');
  assert.equal(g.minItems, 3);
  assert.equal(g.maxItems, 3, 'a fourth point is the padding the fixed shape exists to prevent');
  assert.ok(g.items.maxLength <= 140, 'each item is bounded');
  assert.ok(!FRAMEWORK_MATCH_TOOL.input_schema.required.includes('guidance'),
    'not required, because it is meaningless when matched=false');

  const prompt = buildFrameworkMatchPrompt('plan text', 'library text');
  for (const slot of ['what to look for', 'what to ask', 'attend to in analysis']) {
    assert.match(prompt, new RegExp(slot), 'the prompt names the slot: ' + slot);
  }
  assert.match(prompt, /under 120 characters/, 'the length is stated, not left to the model');
  assert.match(prompt, /Do not describe the theory/, 'guidance is instructions, not a fourth description');
});
