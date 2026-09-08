"""Supplementary PDFium raster checks; not native Windows print verification.

Run after rpa-66-capture.cjs for baseline and local. Requires pdfplumber,
pypdfium2 and Pillow (available in the Codex bundled Python runtime).
"""
import json
from pathlib import Path

import pdfplumber
import pypdfium2 as pdfium

ROOT = Path(__file__).resolve().parent / 'rpa-66-evidence'
PALETTE = [(99 / 255, 102 / 255, 241 / 255),
           (22 / 255, 163 / 255, 74 / 255),
           (177 / 255, 180 / 255, 182 / 255)]
report = []

for file in sorted(ROOT.glob('*.pdf')):
    pdf = pdfium.PdfDocument(file)
    with pdfplumber.open(file) as document:
        for index, page in enumerate(document.pages):
            if 'week 1' not in (page.extract_text() or ''):
                continue
            rows = {}
            for rect in page.rects:
                color = rect.get('non_stroking_color')
                if not color or len(color) != 3 or abs(rect['height'] - 15) > .1:
                    continue
                if any(all(abs(a - b) < .006 for a, b in zip(color, target)) for target in PALETTE):
                    rows.setdefault(round(rect['top'], 3), []).append(rect)
            result = {'file': file.name, 'pages': len(document.pages),
                      'chartPage': index + 1, 'paperPoints': [page.width, page.height], 'rows': []}
            for top, rectangles in sorted(rows.items()):
                rectangles.sort(key=lambda r: r['x0'])
                gaps = [round(b['x0'] - a['x1'], 4) for a, b in zip(rectangles, rectangles[1:])]
                result['rows'].append({'top': top, 'rectangles': len(rectangles),
                                       'unpaintedGapsPoints': gaps, 'rasters': []})
            for dpi in [48, 72, 96, 144, 300]:
                raster = pdf[index].render(scale=dpi / 72).to_pil().convert('RGB')
                for row_result, (top, rectangles) in zip(result['rows'], sorted(rows.items())):
                    left = round(min(r['x0'] for r in rectangles) * dpi / 72)
                    right = round(max(r['x1'] for r in rectangles) * dpi / 72)
                    y = round((top + 7.5) * dpi / 72)
                    pixels = [min(raster.getpixel((x, y))) < 240 for x in range(left, right)]
                    painted_runs = sum(painted and (i == 0 or not pixels[i - 1]) for i, painted in enumerate(pixels))
                    row_result['rasters'].append({'dpi': dpi, 'paintedRuns': painted_runs})
                    if file.name.startswith('local-'):
                        assert painted_runs == len(rectangles), (file.name, dpi, top, painted_runs, len(rectangles))
                if file.name in ['baseline-letter-visible.pdf', 'baseline-a4-visible.pdf',
                                 'local-letter-visible.pdf', 'local-a4-visible.pdf']:
                    stem = file.stem.replace('-visible', '')
                    if dpi == 96:
                        raster.save(ROOT / f'{stem}-page6-{dpi}dpi.png')
                    if dpi in [48, 96]:
                        box = tuple(round(v * dpi / 72) for v in [75, 310, 540, 438])
                        raster.crop(box).save(ROOT / f'{stem}-timeline-{dpi}dpi.png')
            report.append(result)
    pdf.close()

# The print selectors must leave every captured desktop/narrow chart identical.
screen_images = ['original-desktop', 'original-narrow', 'one-day-desktop',
                 '57-days-narrow', 'monthly-desktop', 'monthly-narrow']
for name in screen_images:
    assert (ROOT / f'baseline-{name}.png').read_bytes() == (ROOT / f'local-{name}.png').read_bytes(), name
before = json.loads((ROOT / 'baseline-browser-results.json').read_text())
after = json.loads((ROOT / 'local-browser-results.json').read_text())
for baseline_case, local_case in zip(before['cases'], after['cases']):
    assert baseline_case['example'] == local_case['example']
    if baseline_case['print']['scale'] != 'days':
        for key in ['chart', 'weekMarkers', 'styles', 'rows', 'dates']:
            assert baseline_case['print'][key] == local_case['print'][key], (local_case['example'], key)

(ROOT / 'pdf-analysis.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'pdfs': len(report), 'localRasterChecks': sum(len(row['rasters']) for item in report if item['file'].startswith('local-') for row in item['rows']),
                  'identicalScreenCaptures': len(screen_images), 'longTimelinePrintGeometry': 'unchanged'}))
