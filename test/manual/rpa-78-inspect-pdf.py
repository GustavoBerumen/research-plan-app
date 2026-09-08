"""Inspect saved Chrome PDFs; render pages separately for visual review."""
from pathlib import Path
import json
import re
from pypdf import PdfReader

output = Path(__file__).with_name('rpa-78-evidence')
records = json.loads((output / 'print.json').read_text())
normalise = lambda text: ' '.join(text.split())
reports = []
for record in records:
    pdf = PdfReader(output / record['filename'])
    pages = [page.extract_text() for page in pdf.pages]
    text = normalise(' '.join(pages))
    phrase = 'Explain which observed checkout behaviour'
    expected = sum(normalise(t).count(phrase) for t in record['texts'])
    report = {
        'filename': record['filename'], 'pages': len(pages),
        'missingInputs': [v for v in record['inputs'] if normalise(v) not in text],
        'expectedFeedbackPhrases': expected, 'actualFeedbackPhrases': text.count(phrase),
        'correctedOutcomeCriterion': bool(re.search(r'Outcome 1\s*—\s*Actionable', text)),
        'typoAbsent': 'Actionalble' not in text,
        'feedbackPreserved': 'RPA-78 print check:' in text,
        'interactiveControlsExcluded': all(t not in text for t in ['Evaluate again', 'Saving evaluation', 'Dislike', 'Visualise Timeline']),
        'sparsePages': [i + 1 for i, p in enumerate(pages) if len(p.strip()) < 40],
        'sectionHeadingsWithContent': all('Background' in p for p in pages if re.search(r'^Context\s+3 fields$', p, re.M)),
    }
    assert not report['missingInputs'] and report['typoAbsent'] and report['correctedOutcomeCriterion'], report
    assert report['feedbackPreserved'] and report['interactiveControlsExcluded'], report
    assert expected == report['actualFeedbackPhrases'] and not report['sparsePages'] and report['sectionHeadingsWithContent'], report
    reports.append(report)
(output / 'pdf-inspection.json').write_text(json.dumps(reports, indent=2) + '\n')
print(json.dumps(reports, indent=2))
