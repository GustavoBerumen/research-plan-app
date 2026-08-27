'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { styleForScore } = require('../score-classification');

const JUST_BELOW = 0.000001;
const JUST_ABOVE = 0.000001;

test('classifies the RPA-37 six-metric aggregate as orange Developing', () => {
  const metricScores = [1, 2, 3, 2, 1, 3];
  const average = metricScores.reduce((sum, score) => sum + score, 0) / metricScores.length;
  const style = styleForScore(average);

  assert.equal(average, 2);
  assert.deepEqual(
    { label: style.label, tone: style.tone, color: style.color },
    { label: 'Developing', tone: 'warning', color: '#ea580c' }
  );
});

test('classifies exact score-band boundaries using upper-inclusive limits', () => {
  const developingBoundary = styleForScore(2);

  assert.equal(styleForScore(1.5).label, 'Needs Work');
  assert.deepEqual(
    { label: developingBoundary.label, tone: developingBoundary.tone, color: developingBoundary.color },
    { label: 'Developing', tone: 'warning', color: '#ea580c' }
  );
  assert.equal(styleForScore(2.75).label, 'Good');
});

test('classifies values immediately below and above every boundary', () => {
  const cases = [
    [1.5 - JUST_BELOW, 'Needs Work'],
    [1.5 + JUST_ABOVE, 'Developing'],
    [2 - JUST_BELOW, 'Developing'],
    [2 + JUST_ABOVE, 'Good'],
    [2.75 - JUST_BELOW, 'Good'],
    [2.75 + JUST_ABOVE, 'Ready'],
  ];

  cases.forEach(([score, expectedLabel]) => {
    assert.equal(styleForScore(score).label, expectedLabel, `score ${score}`);
  });
});
