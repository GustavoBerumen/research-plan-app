# RPA-95 review handoff

Reviewed on 10 September 2026. Max authorised committing and pushing RPA-95, then explicitly authorised PR creation/review, merging after successful checks, Jira closeout and preparation of a separate RPA-96 implementation prompt. Raw PDF/screenshot evidence stays local. Deployment and separate collaborator messages remain outside this closeout.

- Ticket: https://turingtestable.atlassian.net/browse/RPA-95
- Branch: `codex/rpa-95-narrow-timeline-week-labels`
- Freshly fetched implementation base: `78f7910400751f641787c40083202183cc157dda`
- Worktree: `C:/Users/Max/.codex/worktrees/dca7/research-plan-app`
- Isolated mock preview: http://127.0.0.1:49395/?example=original

## Change and scope

`app.js` puts **Week** in the existing left ruler label and uses **1, 2, 3...** for all short-timeline markers. `style.css` matches that left label to the existing 12px text / 14px line height. Populating the otherwise empty label without this rule increased the ruler row height; the rule preserves the original positions and dimensions.

`test/rpa-65-fixtures.cjs` adds the reported 38-day schedule. `test/rpa-65-timeline-scales.test.js` updates marker expectations, checks all marker columns, adds exact sparse-day coverage, and extends the existing save/reload/print/reset checks to both short schedules and both visibility states. Five tests were added.

The schedule table, dates, stage order, colours, gaps, overlaps, single-day stages, scale boundaries, timeline visibility, backups, Last updated, print rules, footer, providers, storage and dependencies retain their existing behaviour. No other worktree, `.env`, credential, upload, record or existing preview was changed. Only the new loopback port 49395 was used.

## Reproduction and validation

Before changing production code, headless Chrome reproduced the collision at 390 CSS pixels, device scale factor 1 and fresh-context 100% zoom. Measurements use DOM Range text bounds. Both rulers are 154px wide at this viewport.

| Schedule | Baseline at 390px | Final candidate at 390px |
| --- | --- | --- |
| Planning 15-17 August; Recruitment 17-21 September 2026 (38 inclusive days) | First two labels overlap by 12.375px | Six markers visible; minimum text gap 18.969px; last-marker right clearance 14.984px |
| 1 September-26 October 2026 (56 days), plus one-day stage | First two labels overlap by 18.781px; final marker clipped | Eight markers visible; minimum text gap 12.563px; last-marker right clearance 8.563px |

- **97/97 focused tests passed**: timeline scales, six timezones, month ends/leap years, RPA-53 visibility/print restoration, RPA-40 backups, Last updated and the RPA-94 footer.
- **408/408 full tests passed**, zero failures/skips/cancellations, Node 24.19.0 on Windows, 122.23 seconds. One fresh full run after the final production change.
- **76 JavaScript/CJS files passed `node --check`**; whitespace checks passed.
- **15/15 headless browser cases passed** across 1600x1000, 1280x1000 and 390x1000, covering the 38-day, 56-day, 57-day, last-weekly-day and monthly fixtures. Daily labels remain visible without collisions. Row/cell/bar coordinates, colours, dates, ruler geometry and Last updated match the baseline exactly. Nine longer-weekly/monthly screenshots are byte-identical to baseline; their existing monthly sticky-header overlay is unchanged.
- Keyboard checks exercised Enter, Space, Tab and Shift+Tab, preserving toggle focus and normal movement to the next control. No JavaScript errors or external requests occurred.
- Four final headless A4 PDFs cover both short schedules, initially visible and hidden. The relevant pages were reopened, rendered and inspected: all six/eight markers and distinct daily cells remain visible. Automated beforeprint/afterprint checks preserve visibility, saved stages and Last updated.

The two targeted tests failed on the missing Week heading before implementation, as expected. Dependencies came from the unchanged lockfile using `npm ci --ignore-scripts --no-audit --no-fund`; an elevated retry resolved the initial sandbox npm-cache EPERM. These are deterministic and synthetic browser checks, not live AI, deployment or screen-reader evidence.

## Native PDF inspection and user-reported visibility check

An earlier agent-saved native 38-day PDF was generated before the final CSS adjustment and remains intermediate evidence only. Computer Use subsequently stopped because it could not determine the current Windows browser URL confidently enough to enforce policy; no further native UI input was issued.

Max supplied two six-page Letter PDFs produced by Microsoft Print to PDF and reported that they looked fine. The agent reopened both and visually inspected the rendered complete page 4. Both contain the 56-day schedule, show the final Week styling and all numbers 1-8 clearly, preserve dates, and retain distinct daily cells.

Max then supplied a fresh 38-day PDF and requested inspection before pushing. Its native-driver metadata records 10 September 2026 at 13:21:48. The agent reopened it and visually inspected the complete page 4 rendered with Poppler at 160 dpi. Planning runs 15-17 August and Recruitment runs 17-21 September 2026. The final Week label and all numbers 1-6 are clear, the dates and stage gap are correct, and daily cells remain distinct. The final 38-day native saved-PDF appearance check passes.

On 10 September 2026, Max confirmed from current manual tests that printing does not change the timeline's visibility in the browser. This closes the pending visibility check as a **user-reported manual pass**. The accompanying screenshot shows the 38-day schedule in Chrome's native print preview; the before/after visibility result comes from Max's report. Automated restoration checks also passed. No RPA-94 PDF evidence was reused.

## Local evidence and reproduction

Raw PDFs, rendered pages, screenshots, detailed measurements and test logs remain locally in the ignored `test/manual/rpa-95-evidence/` directory. Source PDFs were preserved and copies were verified by SHA-256. This directory is deliberately excluded from published commits. Automatic approval review rejected the initial push because it included user-supplied PDFs; the unpublished commits were rebuilt to keep all raw evidence local and publish only source, tests, reproducible helpers and these notes.

The `rpa-95-preview.cjs` helper serves the actual baseline and candidate using synthetic data and mocked current config capabilities. It does not start the production server or load `.env`. External requests are blocked. The two preview tabs share an origin and browser draft, so refreshing after opening another fixture can load the last saved example.

From this worktree, run `node test/manual/rpa-95-preview.cjs` if port 49395 is free. Leave an existing task-owned instance running. Use `/?example=original` for 38 days, `/?example=56-days` for eight weeks, and append `&hidden=1` for an initially hidden chart. `/baseline/?example=original` serves base `78f7910`.

Run `node test/manual/rpa-95-capture.cjs <path-to-playwright> baseline`, then the same command with `candidate`. It creates the local evidence directory, uses disposable browser contexts, checks spacing/geometry and writes screenshots/headless PDFs without interacting with the user's existing plan.

## Next selected task

[RPA-96](https://turingtestable.atlassian.net/browse/RPA-96), **Preserve the selected-framework button label after a request**. Rechecked on 10 September: Ready, assigned to Max Spiegel, no comments, predecessors RPA-91/RPA-62 Done, and no existing ticket branch/worktree or active implementation task found.

Derive the final button label from the current selected framework after success or failure, preserving edits made during the request, request handling and existing framework behaviour. Keep it scoped to button wording and regressions. It has not been started; use its own managed worktree and ticket branch when implementation is requested.
