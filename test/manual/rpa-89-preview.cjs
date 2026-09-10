'use strict';

// Loopback-only review preview. No .env, private disk reads, writes or provider
// traffic: the real routes/assets run inside the synthetic server harness.
const { loadServer } = require('../rpa-89-server-harness.cjs');
const app = loadServer({ provider: async request => {
  const tool = request.tools[0];
  if (tool.name === 'submit_framework_match') return { content: [{ type: 'tool_use', input: {
    matched: true, name: 'Synthetic framework', rationale: 'Mock suggestion for this review preview.' } }] };
  if (tool.name !== 'submit_evaluation') throw new Error('This preview mocks scalar evaluation and framework matching only.');
  const names = tool.input_schema.properties.recommendations.items.properties.criterionName.enum;
  return { content: [{ type: 'tool_use', name: tool.name, input: {
    metrics: names.map(name => ({ name, score: 2, desc: 'Synthetic review response.' })),
    recommendations: [{ criterionName: names[0], text: 'Clarify the participants in this synthetic example.' }],
  } }] };
} });
app.server.listen(Number(process.env.RPA_PREVIEW_PORT || 0), '127.0.0.1', () => {
  console.log('RPA-89 synthetic preview: http://127.0.0.1:' + app.server.address().port + '/');
  console.log('Real app/routes; synthetic files and mocked provider. No deployment or live AI evidence.');
});
