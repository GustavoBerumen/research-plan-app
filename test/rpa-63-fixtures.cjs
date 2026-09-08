'use strict';
// Shared offline response shapes for rendering tests and the browser preview.
function evaluationFixture(body, scenario = 'guardrail') {
  const long = 'Explain which observed checkout behaviour supports this judgement and how it relates to the study population, decision and delivery context. ';
  const metrics = body.entries
    ? body.entries.flatMap(entry => (body.rubric || []).map((criterion, i) => ({
      name: (body.fieldKey === 'outcomes' ? 'Outcome ' : 'Research Question ') + entry.number + ' — ' + criterion.name,
      score: scenario === 'guardrail' && entry.number === 1 && i === 1 ? 1 : scenario === 'developing' ? 2 : 3,
      desc: long.repeat(i === 0 ? 3 : 1), scope: 'entry-quality', entryNumber: entry.number,
    })))
    : (body.rubric || []).map((criterion, i) => ({
      name: criterion.name + (i === 0 ? ' — evidence and relevance to the proposed research decision' : ''),
      score: scenario === 'ready' ? 3 : 2, desc: long.repeat(i === 0 ? 3 : 1),
    }));
  if (body.entries) metrics.push({
    name: body.fieldKey === 'outcomes' ? 'Alignment — Outcome 3 ↔ Research Question 3' : 'Set quality — distinct coverage across the research questions',
    score: 3, desc: long, scope: body.fieldKey === 'outcomes' ? 'alignment' : 'set-quality',
  });
  return { metrics, recommendations: scenario === 'ready' ? [] : [
    'Clarify the lower-scoring criterion with a concrete observation and explain how it will guide the research decision. ' + long.trim(),
    'Include the relevant evidence reference: ' + 'checkout-research-evidence-'.repeat(8),
  ] };
}
module.exports = { evaluationFixture };
