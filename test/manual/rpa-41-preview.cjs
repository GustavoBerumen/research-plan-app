'use strict';
// Real application and pilot routes; only synthetic private files and providers.
// No .env, credentials, existing records or uploads are opened.
const { loadServer } = require('../rpa-89-server-harness.cjs');
const app = loadServer({ provider: async request => {
  const tool = request.tools[0];
  if (JSON.stringify(request.messages).includes('RPA41_FAIL')) {
    const error = new Error('Synthetic provider unavailable');
    error.status = 503;
    throw error;
  }
  if (tool.name === 'submit_framework_match') return { content: [{ type: 'tool_use', name: tool.name, input: {
    matched: true, name: 'Synthetic framework', rationale: 'Mock suggestion for RPA-41.' } }] };
  if (tool.name !== 'submit_evaluation') throw new Error('Preview supports scalar evaluation and framework matching only.');
  const names = tool.input_schema.properties.recommendations.items.properties.criterionName.enum;
  return { content: [{ type: 'tool_use', name: tool.name, input: {
    metrics: names.map(name => ({ name, score: 2, desc: 'Synthetic RPA-41 review response.' })),
    recommendations: [{ criterionName: names[0], text: 'Clarify the participants in this synthetic example.' }],
  } }] };
} });
app.server.listen(Number(process.env.RPA_PREVIEW_PORT || 0), '127.0.0.1', () => {
  console.log('RPA-41 synthetic preview: http://127.0.0.1:' + app.server.address().port + '/');
  console.log('Pilot routes, synthetic files, mocked scalar evaluation. Use RPA41_FAIL in context for failure/retry.');
});
