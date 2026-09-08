# RPA-66: daily timeline print boundaries

## Outcome and approval

Max confirmed on 8 September 2026 that removing `/baseline/` and testing the
local version fixes the native preview in the Chrome/Opera review. Both new
screenshots show distinct colored and grey day cells. Max then explicitly
approved committing the changes and merging the branch to main.

Evidence: [local native preview 1](rpa-66-evidence/user-local-native-preview-1.png)
and [local native preview 2](rpa-66-evidence/user-local-native-preview-2.png).
The first uses the original dates at `127.0.0.1:8940`; the second uses the
alternate dates from the earlier review. No further application change was
needed after that correction. RPA-66 retains Low priority; the direct-download
experience is the separate High-priority [RPA-77](https://turingtestable.atlassian.net/browse/RPA-77).

The earlier screenshots were taken at `/baseline/` and therefore do not show
the fix: [baseline native preview 1](rpa-66-evidence/user-native-preview-1.png),
[baseline native preview 2](rpa-66-evidence/user-native-preview-2.png),
[baseline saved PDF in a viewer](rpa-66-evidence/user-saved-pdf-view.png).
The saved-PDF screenshot shows distinct cells. The earlier recommendation to
park an apparently ineffective fix is superseded by the corrected local review.

Validation limits: the local version's saved files were generated with headless
Chrome. A local-version PDF from Microsoft's driver and native hidden/visible
restoration checks were not separately supplied. Native screenshots show
Microsoft Print to PDF, portrait, color and page 6 of 8; paper size, zoom,
margins and Background graphics settings were not supplied. No claim is made
about arbitrary smaller scales or every printer/viewer.

## Starting point and scope

- Worktree: `C:\Users\Max\.codex\worktrees\cef3\research-plan-app`.
- Branch: `codex/rpa-66-timeline-print-cell-boundaries`.
- Freshly fetched main: `c3e5a49ecea9ddff5b7951f009d4a77077794604`.
- Applicable AGENTS.md was empty; CONTRIBUTING.md and ADR 001 were reviewed.
- No other worktree or server was changed. No `.env` or credentials were read,
  copied, modified or loaded. The preview binds to loopback, allowlists static
  assets, disables API actions and blocks external browser requests with CSP.
- The only application change is in `style.css`. Other files are the offline
  preview, browser/PDF capture and analysis tools, this handoff, and evidence.

## Finding and correction

With Planning **2026-09-07 through 2026-09-14** and Recruitment
**2026-09-09 through 2026-09-23**, the baseline source PDF retains 21 separate
day rectangles in each row, including 8 Planning days and 15 Recruitment days.
The empty gaps are 0.75 pt (one CSS pixel). The underlying data and rectangles
are not merged.

PDFium rasterization drops those empty gaps at some viewing sizes. In the
Letter sample at 48 dpi, each row becomes two contiguous nonwhite runs; at
72 dpi it has eleven, and at 96 dpi all 21 reappear. The A4 sample has one
contiguous run at 48/72/96 dpi, twelve at 144 dpi and all 21 at 300 dpi.
Poppler at 96 dpi shows the A4 boundaries. This demonstrates a dependence on
the PDF renderer and scale; it does not independently establish the exact
rendering path used by the native preview.

Inside `@media print`, daily row grids now use zero column gap and their cells
paint a 2px white right border. Separation is explicitly painted, and cells
share column positions with the gapless week ruler. These selectors do not
match weekly/monthly charts or screen media. No JavaScript, draft format,
threshold, date, stage, palette, validation or persistence code changes.

A wider empty gap, a 1px painted border and a 2px painted border were compared.
Only the 2px border consistently preserved all cells at the tested scales.
Wider empty gaps still lost some A4 boundaries at 48 dpi.

## Verification

Environment: Windows, installed Google Chrome **152.0.7977.82**, isolated
headless context, zoom 100%, device scale factor 1. Viewports: 1366 x 900 and
390 x 844. No page errors or requests outside the loopback preview were observed.

Saved headless PDF settings: portrait, Letter (612 x 792 pt) and A4 (Chrome
emitted 595.91998 x 842.88 pt), scale 100%, CSS page margins 0.75in, headers and
footers off. Background graphics on, plus a Letter/off sample; existing print
color adjustment preserves the chart colors. The original chart is on page 6;
Letter has eight pages and A4 seven.

Rendering used pypdfium2 5.13.0 / PDFium 153.0.7999.0 and, as a comparison,
Poppler 26.07.0. The raster sizes below are controlled pixels-per-inch values,
not observed native preview zoom or Windows display scaling.

| Check | Result |
| --- | --- |
| Full `npm test`, baseline and final pre-commit | 179 passed; 0 failed in each run |
| JavaScript syntax and `git diff --check` | Passed |
| Original, one-day, overlap, 56 days, 57 days, six months, monthly | Browser capture checks passed |
| Six desktop/narrow chart screenshots | Baseline and local PNGs byte-identical |
| Weekly/monthly print geometry, labels, dates and bars | Identical to baseline |
| Daily print week-marker positions | Match day-cell left edges within 0.02 CSS px |
| Daily cells at the 56-day limit | Positive colored interior retained |
| Print from hidden/visible; restoration and reload | Headless checks passed; saved draft, dates and Last updated unchanged |
| Autosave races and visibility persistence | Existing RPA-53/RPA-65 tests pass with simulated events |
| 6 local PDFs, 2 rows, 5 raster sizes | 60/60 row checks: 21/21 or 56/56 distinct cells at 48/72/96/144/300 dpi |
| Native Chrome/Opera preview | Max confirmed the local fix; screenshots linked above |
| Local-version Microsoft Print to PDF and native restoration | Not separately verified; see limits above |

No jsdom test was added to assert CSS source text: it would not detect this
renderer-dependent defect. The repeatable manual browser/PDF tools provide
focused visual verification outside the offline unit suite. They require
browser/PDF dependencies and are not part of CI.

Comparable original-example screen captures:
[baseline](rpa-66-evidence/baseline-original-desktop.png) /
[local](rpa-66-evidence/local-original-desktop.png), and
[narrow baseline](rpa-66-evidence/baseline-original-narrow.png) /
[narrow local](rpa-66-evidence/local-original-narrow.png).

Saved-PDF chart comparisons:
[A4 baseline at 96 dpi](rpa-66-evidence/baseline-a4-timeline-96dpi.png) /
[A4 local at 96 dpi](rpa-66-evidence/local-a4-timeline-96dpi.png), and
[Letter baseline at 48 dpi](rpa-66-evidence/baseline-letter-timeline-48dpi.png) /
[Letter local at 48 dpi](rpa-66-evidence/local-letter-timeline-48dpi.png).

Full PDFs: [baseline Letter](rpa-66-evidence/baseline-letter-visible.pdf),
[local Letter](rpa-66-evidence/local-letter-visible.pdf),
[baseline A4](rpa-66-evidence/baseline-a4-visible.pdf),
[local A4](rpa-66-evidence/local-a4-visible.pdf).
Hidden/backgrounds-off/56-day samples are also in the evidence folder.
Measurements: [baseline browser](rpa-66-evidence/baseline-browser-results.json),
[local browser](rpa-66-evidence/local-browser-results.json),
[PDF/raster analysis](rpa-66-evidence/pdf-analysis.json).
Test logs: [baseline](rpa-66-evidence/baseline-npm-test.log) /
[local](rpa-66-evidence/local-npm-test.log).

## Re-run the offline preview and capture

Start this task's preview in PowerShell, using a free port. Do not stop another
process if the port already has an owner. Do not use `npm start` for this review;
it loads `.env`.

```powershell
Set-Location 'C:\Users\Max\.codex\worktrees\cef3\research-plan-app'
node test/manual/rpa-66-preview.cjs 8940
```

Open **http://127.0.0.1:8940/?example=original** for the fix or
**http://127.0.0.1:8940/baseline/?example=original** for the frozen baseline.
The preview header is `X-RPA-Preview: RPA-66 cef3 mock`. Example links replace
only this port's disposable draft; use ordinary reload when checking persistence.
Use **http://127.0.0.1:8940/?example=original&hidden=1** for the hidden case.
The preview status reports print events, saved stages, visibility and Last updated.

For an additional native check, compare both versions with identical settings,
save each through Microsoft Print to PDF, inspect at normal and page-fit size,
and test hidden/visible restoration after cancel/save and reload. Record browser,
viewer, zoom, paper size, margins, print scale and Background graphics settings.
The original sample has 21 slots per row, with 8 and 15 colored cells.

With the preview running, repeat the supplementary capture:

```powershell
$playwrightPackage = 'C:/Users/Max/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
node test/manual/rpa-66-capture.cjs http://127.0.0.1:8940 $playwrightPackage baseline
node test/manual/rpa-66-capture.cjs http://127.0.0.1:8940 $playwrightPackage local
& 'C:\Users\Max\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' test/manual/rpa-66-analyze.py
```
