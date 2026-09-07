(function exposeScoreClassification(root, factory) {
  const classification = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = classification;
  } else {
    root.RPA_SCORE_CLASSIFICATION = classification;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  'use strict';

  // Score bands use upper-inclusive limits. In interval notation:
  // Needs Work (-Infinity, 1.5], Developing (1.5, 2],
  // Good (2, 2.75], and Ready (2.75, Infinity).
  const SCORE_STYLES = [
    { maxInclusive: 1.5, label: 'Needs Work', tone: 'problem', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
    { maxInclusive: 2, label: 'Developing', tone: 'warning', color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' },
    { maxInclusive: 2.75, label: 'Good', tone: 'success', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
    { maxInclusive: Infinity, label: 'Ready', tone: 'success', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  ];

  function styleForScore(average) {
    if (!Number.isFinite(average)) throw new TypeError('Score average must be a finite number');
    return SCORE_STYLES.find((style) => average <= style.maxInclusive);
  }

  function classifyEvaluation(fieldKey, metrics) {
    const average = metrics.reduce((sum, metric) => sum + metric.score, 0) / metrics.length;
    const structured = fieldKey === 'researchQuestions' || fieldKey === 'outcomes';
    const criticalEntry = structured && metrics.some((metric) =>
      metric.scope === 'entry-quality' && metric.score === 1
    );
    // Cap only the aggregate status, never the underlying scores or justifications.
    return {
      ...styleForScore(criticalEntry ? Math.min(average, 2) : average),
      explanation: criticalEntry
        ? 'An individual entry has a quality score of 1 of 3. Resolve critical entry weaknesses before this evaluation can be Good or Ready.'
        : '',
    };
  }

  return { SCORE_STYLES, styleForScore, classifyEvaluation };
});
