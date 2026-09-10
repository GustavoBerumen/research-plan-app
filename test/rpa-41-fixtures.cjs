'use strict';
const { realisticBackup } = require('./rpa-40-fixtures.cjs');

function referenceBackup() {
  const draft = realisticBackup();
  draft.fields.researchTitle = 'RPA-41 synthetic reference review';
  const file = (v, n) => [{ t: 'text', v: 'Synthetic reference name' }, { t: 'file', v, n }, { t: 'text', v: '' }];
  draft.tables['previousKnowledge-table'] = [
    file('/uploads/synthetic-long.pdf', 'Synthetic_' + 'long-filename_'.repeat(18) + 'café_東京.pdf'),
    file('', ''),
    file('/uploads/synthetic-unnamed.pdf', ''),
    file('', '  Synthetic filename only.pdf  '),
    file('', 'No file chosen'),
    file('/uploads/synthetic-markup.pdf', '<a href="/uploads/synthetic.pdf">Synthetic & reference</a>.pdf'),
  ];
  draft.tables['requirements-table'] = [file('/uploads/synthetic-dormant.pdf', '  Dormant reference.pdf  ')];
  draft.tables['customReferences-table'] = [file('https://example.invalid/synthetic-reference', 'Custom saved reference.pdf')];
  return draft;
}

module.exports = { referenceBackup };
