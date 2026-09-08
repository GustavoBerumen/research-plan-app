# RPA-78 copy audit and review

Implemented locally on `codex/rpa-78-british-english` in the existing clean Codex-managed worktree `C:\Users\Max\.codex\worktrees\2516\research-plan-app`. At the start, freshly fetched `origin/main` was `2d0f62d218861664fafd7620357f94eb6ebc6df7` (RPA-63 / PR #44); Jira was Ready / Medium / Max. No RPA-78 local or remote branch or open repository PR existed. CONTRIBUTING.md was read; the applicable parent AGENTS.md was empty and no nested AGENTS.md was found.

## Copy audit

The pass reviewed app-owned labels, hints, examples, buttons, accessible names, errors, loading/status text, evaluation prompts, methods and framework content, including a quick general spell-check requested during implementation. Corrections are spelling-only; there is no guidance or scoring rewrite.

| Surface | Changes |
| --- | --- |
| Document | `lang="en-GB"`. |
| Timeline control | “Visualize Timeline” becomes “Visualise Timeline”, initially and after hiding the chart. Its visible text remains its accessible name. |
| Methods hint | “behaviors” becomes “behaviours”. The methods catalogue already uses British spellings. |
| Rubric | “organizational”, “prioritizing” and “behavior” become “organisational”, “prioritising” and “behaviour”. Outcomes “Actionalble” becomes “Actionable”. Criterion descriptions retain their meaning and scores. |
| Scalar prompt examples | “visualization” and “categorize” become “visualisation” and “categorise”. |
| Framework descriptions/category | British forms of organisational, analyses, labour, artefacts, centres, signalling, categorising, optimisation, behavioural, centred, visualisation and behaviour. Framework names are unchanged. |
| Active regression fixtures | Updated the RPA-53 timeline label assertions and RPA-56 Outcomes criterion name. The new pre-change fixture deliberately retains original text as compatibility evidence. |

All seven prompt paths already request British English: scalar evaluation, Research Questions, Outcomes, framework matching, framework drafting, methods coverage and methods web-search fallback. Those instructions were retained without duplication. The drafting prompt's citation exception remains intact. There are no blanket replacements of user or model text.

Intentional exceptions:

- Original reference titles, including “User Centered System Design”, “Sensemaking in Organizations” and Reckwitz's “culturalist theorizing”; all complete reference lines, author names, publication names and framework names were compared with the base and are unchanged. “American Psychological Association” is a proper name.
- Jira, Google Drive and other proper names; externally supplied Jira summaries, provider errors, source citations, filenames and user-authored values retain their original wording. Reference accuracy was not re-researched in this spelling pass.
- Technical identifiers such as `color`, `normalize`, `Authorization`, DOM/CSS names and API fields; existing developer comments, historical notes and old PDFs are unchanged.
- Valid variants and substantive wording were retained. The only clear general typo corrected was “Actionalble”.

No table-column rename was needed or deferred. Every active column label/key is unchanged; RPA-74's independent-column-key work remains outside this change. Field/list keys, rubric heading mappings, draft version 7, localStorage key, schemas, model, retry budget, scoring/classification, recommendation rules, calibration payload structure, panel layout and print CSS are unchanged.

## Validation

Automated:

- Full `npm test`: **262 passed, 0 failed**, including six new registered RPA-78 tests and the requested RPA-63, RPA-67, section-evaluation, guardrail, optional-recommendation, staleness, field-key and line-ending regressions. [Full log](rpa-78-evidence/full-tests.txt).
- The new tests restore a draft actually saved by the app before editing. They cover scalar/multiline values, sparse Question/Outcome positions 1 and 3, Methods groups, timeline rows/dates/visibility, numbering, paired deletion and focus. Deliberately American-spelled user content survives. Toggle/resave changes only the preference and save timestamp.
- LF and CRLF tests verify all seven rubric-to-field mappings and field/list/column keys against the captured base. “Actionable” passes exact-name validation, recommendation-schema enumeration, rendering and calibration; misspelled metric/recommendation names are rejected. Critical-entry scores and alignment remain unchanged.
- Syntax checks and `git diff --check` pass. Modified existing files retain Windows CRLF endings; the rubric retains its original lack of a final newline. Focused compatibility checks were repeated after line-ending normalisation. [Compatibility log](rpa-78-evidence/compatibility-tests.txt).
- Headless **Windows Chrome 152.0.7977.82**, 1366 and 390 CSS px: Guardrail and Ready states, accessible timeline toggle, Methods hint, corrected Outcomes label, no evaluation-panel overflow, loading, stale/pending/failure and successful Retry. No external browser requests or page errors. [Browser results](rpa-78-evidence/browser.json).
- Actual saved A4 Guardrail PDF (12 pages) and Letter Ready PDF exported from a 390px viewport (11 pages): all populated prose values and all 30/27 expected feedback phrases retained; “Actionable” present; interactive evaluation controls excluded; screen values, collapsed sections, focus, timeline visibility and saved draft preserved. [Export checks](rpa-78-evidence/print.json), [PDF text checks](rpa-78-evidence/pdf-inspection.json).

Agent-observed:

- Inspected desktop Methods copy, narrow Outcomes/Timeline/error screenshots, and all 23 PDF pages rendered with Poppler. Full long Background and Question 3 text is retained, evaluation borders close at page breaks, and no clipped or overlapping text was observed. The timeline table keeps its existing horizontal scrolling at narrow widths.
- Native print preview could not be checked. Computer Use stopped while inspecting the existing Chrome window, reporting: “Computer Use has been stopped for this turn because it is not allowed on the current browser URL.” No native UI input was sent after that stop. The PDFs above were exported through the separate headless Chrome run, not the Microsoft Print to PDF driver.

User-reported validation: **all requested manual tests passed**, reported by Max on 8 September 2026. Max supplied `C:\Users\Max\Downloads\research_plan_app_rpa_74.pdf`; despite its filename, its printed URL identifies the RPA-78 preview on port 8954. It has 11 pages and identifies Microsoft Print to PDF as its producer. The agent rendered and inspected pages 8–11, including the reported grey Recruitment control on page 9. This supplements the agent's separate 23-page export review above; it is not a claim that the agent inspected all 11 pages of Max's file.

The live Recruitment control and all its options are enabled. All five Stage controls have the same `ssel ss-ns` classes and white computed backgrounds; Recruitment opens normally. Print CSS also requests white backgrounds. The grey fill in Max's PDF is a confirmed visual observation, but its cause remains unconfirmed. Native select focus/selection painting or the print path are possible causes. A repeat native print after moving focus away is the only remaining diagnostic check for this new observation. No behaviour or print-style change was folded into RPA-78.

No live/paid provider call, physical mobile device or screen-reader session was used by the agent. Prompt and mock checks cannot guarantee that a model will always use British English. External font scripts/styles are removed from the offline preview, so it uses fallback fonts.

## Preview and completed manual checks

The RPA-78 preview is running at [http://127.0.0.1:8954/?scenario=guardrail](http://127.0.0.1:8954/?scenario=guardrail). The existing RPA-63 preview on port 8953 was left running and both ports returned HTTP 200. `.env`, credentials and other worktrees/servers were not changed.

To restart this preview after its process is stopped:

```powershell
Set-Location 'C:\Users\Max\.codex\worktrees\2516\research-plan-app'
$env:PORT='8954'
node test/manual/rpa-78-preview.cjs
```

This preview serves an explicit asset allowlist, uses the existing RPA-63 mock response/client fixtures, never loads `.env` or the backend, and does not save calibration data. Reload resets sample content only on this preview origin. Evaluation, slow response and failure modes are simulated; suggestion and external integration endpoints are not provided.

The following RPA-78 checks were reported passed by Max; no repeat of this checklist is required:

1. Open Guardrail and Ready using the top links. Check “Outcome 1 — Actionable”, the Methods hint and “Visualise Timeline” at desktop and narrow width. The Ready case should have no recommendations.
2. Choose **Evaluation failure** under **Next request**, then **Evaluate again**. Choose **Normal** and use **Retry**. For loading, choose **Slow (15 seconds)**.
3. Open **Restore pre-change draft**. Check the original spelling and blank second Question/Outcome row, matching Methods groups and two dated timeline rows. Hide/show the timeline and try deleting a populated Question to check its confirmation and matching rows. This sample resets when reloaded; automated tests separately verify save-and-restore persistence.
4. Open **Print / Save as PDF**, inspect the preview, and save using your normal Windows PDF destination. Paste multiline text into Background and Question 3, re-evaluate and reopen the result panels before printing. Check complete inputs, corrected criterion names and evaluation page boundaries. The agent's [A4 PDF](rpa-78-evidence/guardrail-a4.pdf) and [Letter PDF](rpa-78-evidence/ready-letter.pdf) provide comparison exports with deliberately long inputs.

Separate diagnostic for the new Recruitment observation:

1. Open Execution, open Recruitment and press Escape, then click another field or button to move focus away. Print again using the same Windows PDF destination and inspect Recruitment on the Execution page. Record whether the grey fill remains. No form value needs to change.

Max also requested toggleable evaluation feedback with Save independent of Like/Dislike. The existing handlers deliberately lock all three buttons after any successful save/rating, and RPA-63 tests preserve that behaviour. With Max's approval, this was filed separately as [RPA-86](https://turingtestable.atlassian.net/browse/RPA-86); the [local follow-up record](rpa-78-feedback-follow-up.md) retains the agreed scope. RPA-3 covers review records and RPA-63 covered presentation, but neither specifies these toggle interactions. No feedback behaviour was changed in RPA-78.

Reproduce automated visual/PDF checks from this worktree with the preview running:

```powershell
node test/manual/rpa-78-review.cjs 'C:\Users\Max\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\playwright'
& 'C:\Users\Max\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' test/manual/rpa-78-inspect-pdf.py
```

On 8 September 2026, after confirming the manual tests passed, Max explicitly authorised creating the follow-up ticket and committing, pushing, opening and merging the RPA-78 PR, then closing RPA-78. Final delivery status and the merged PR link are recorded in [RPA-78](https://turingtestable.atlassian.net/browse/RPA-78).
