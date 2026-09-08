"""Check actual exported text, including all repeated fixture justifications."""
from pathlib import Path
import json
import re
from pypdf import PdfReader

output = Path(__file__).with_name('rpa-63-evidence')
records = json.loads((output / 'print.json').read_text())
phrase = 'Explain which observed checkout behaviour'
normalise = lambda text: ' '.join(text.split())
reports = []
for record in records:
    pdf = PdfReader(output / record['filename'])
    pages = [page.extract_text() for page in pdf.pages]
    text = normalise(' '.join(pages))
    expected = sum(normalise(t).count(phrase) for t in record['texts'] + record['recs'])
    report = {
        'variant': record['variant'], 'filename': record['filename'], 'pages': len(pages),
        'expectedJustificationAndRecommendationPhrases': expected,
        'actualJustificationAndRecommendationPhrases': text.count(phrase),
        'feedbackPreserved': 'RPA-63 printable feedback:' in text,
        'actionTextExcluded': all(word not in text for word in ['Evaluate again', 'Like feedback', 'Dislike feedback', 'Saving evaluation']),
        'longReferenceSegments': re.sub('[^a-zA-Z]', '', text).count('checkoutresearchevidence'),
        'sparsePages': [{'page': i+1, 'text': p.strip()} for i, p in enumerate(pages) if len(p.strip()) < 40],
        'evaluationPages': [i+1 for i,p in enumerate(pages) if 'Evaluation' in p or phrase in normalise(p)],
        'missingInputs': [value for value in record['inputs'] if normalise(value) not in text],
        'sectionHeadingsWithContent': all('Background' in p for p in pages if re.search(r'^Context\s+3 fields$', p, re.M)),
    }
    if record['variant'] == 'after':
        assert report['actualJustificationAndRecommendationPhrases'] == expected, report
        assert report['feedbackPreserved'] and report['actionTextExcluded'], report
        assert report['longReferenceSegments'] == (24 if record['scenario'] == 'guardrail' else 0), report
        assert not report['missingInputs'] and not report['sparsePages'], report
        assert report['sectionHeadingsWithContent'], report
    reports.append(report)
(output / 'pdf-inspection.json').write_text(json.dumps(reports, indent=2) + '\n')
print(json.dumps(reports, indent=2))
