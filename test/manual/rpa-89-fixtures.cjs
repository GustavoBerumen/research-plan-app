'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { realisticBackup } = require('../rpa-40-fixtures.cjs');
const output = path.join(__dirname, 'rpa-89-evidence');
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'pilot-input.json'), JSON.stringify(realisticBackup(), null, 2) + '\n');
fs.writeFileSync(path.join(output, 'invalid.json'), '{"version":7,"fields":{"researchTitle":42}}\n');
console.log('Synthetic fixtures: ' + output);
