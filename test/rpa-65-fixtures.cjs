'use strict';

function draftFor(rows, visible = true) {
  return {
    version: 7, savedAt: '2020-01-01T00:00:00.000Z', lastUpdatedManual: false,
    fields: { researchTitle: 'RPA-65 timeline review', lastUpdated: '2020-01-01' },
    ui: { timelineVisible: visible },
    tables: { 'stageTimeline-table': rows.map(([name, start, end]) => [
      { t: 'select', v: '__other__', o: name },
      { t: 'date', v: start }, { t: 'date', v: end },
    ]) },
  };
}

const examples = {
  '38-days': [['Planning', '2026-08-15', '2026-08-17'], ['Recruitment', '2026-09-17', '2026-09-21']],
  '56-days': [['Research', '2026-09-01', '2026-10-26'], ['One day', '2026-09-15', '2026-09-15']],
  '57-days': [['Research', '2026-09-01', '2026-10-27'], ['One day', '2026-09-15', '2026-09-15']],
  'six-months': [['Research', '2026-09-01', '2027-02-28'], ['Interviews', '2026-10-12', '2026-11-06'], ['Readout', '2027-02-28', '2027-02-28']],
  'monthly': [['Research', '2026-09-15', '2027-04-05'], ['Interviews', '2026-10-12', '2026-11-06'], ['Synthesis', '2026-10-28', '2026-11-20'], ['One day', '2026-12-01', '2026-12-01'], ['Readout', '2027-04-05', '2027-04-05']],
  'leap-year': [['Research', '2027-10-15', '2028-04-30'], ['Leap days', '2028-02-28', '2028-03-01']],
};
module.exports = { draftFor, examples };
