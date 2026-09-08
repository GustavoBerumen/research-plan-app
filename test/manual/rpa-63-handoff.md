# RPA-63 review

Implemented evaluation presentation and the print corrections requested during manual review on `codex/rpa-63-evaluation-panel-polish` in the managed worktree `C:\Users\Max\.codex\worktrees\e32a\research-plan-app`.

Base freshly fetched and verified: `d2ea2037fd9343e3745249eb964d605270aaf989` (RPA-67 / PR #43); rechecked against current `origin/main` before closeout. Before branching, Jira was Ready / Medium / Max with no issue links; no matching remote RPA-63 branch or open repository PR was found. No applicable non-empty AGENTS.md was found; CONTRIBUTING.md was read. On 8 September 2026, Max confirmed the previews/output and all other manual tests pass and explicitly authorised the commit, PR, merge and ticket closeout. At Max's explicit request, the existing Actionalble typo was recorded in [RPA-78 comment 10055](https://turingtestable.atlassian.net/browse/RPA-78?focusedCommentId=10055); rubric wording is unchanged here. `.env`, credentials, other worktrees and the existing port 8947 server were left untouched.

## Changes

- Neutral panel headers, compact textual status badges, existing app colours/type/borders and separated metric rows. Desktop places the criterion/score beside its justification; narrow screens and print stack them in reading order.
- Like, Dislike and Save use monochrome SVGs plus visible labels and the shared secondary-button treatment. Decorative icons are hidden from accessibility APIs. Evaluation regions and headings are named; Like/Dislike expose `aria-pressed`; saving and saved states have visible text and a live status. The in-panel reevaluation button now exposes busy state.
- Preserved score text/classification, critical-entry explanation, positional labels, recommendation omission, calibration payloads, stale results, retries and all provider behaviour. Suggestion panels keep their existing treatment through scoped CSS.
- Print retains evaluation content and excludes actions/status controls. Stacked print metrics avoid a Chrome grid-fragmentation problem observed during PDF inspection.
- Following Max's saved-PDF and native-preview reports, print-only rules now use block flow for field columns, permit section breaks, keep headings/hints with following content, and retain short lists/radio groups together. Content-sized textareas use the paper width instead of a screen-derived inline height; non-supporting browsers retain the existing autosizer fallback. Evaluation borders close on each page fragment. Screen layout and application logic are unchanged by this follow-up.

## Preview

Already running at [http://127.0.0.1:8953/?scenario=guardrail](http://127.0.0.1:8953/?scenario=guardrail).

To start it again when this task's preview is stopped:

```powershell
Set-Location 'C:\Users\Max\.codex\worktrees\e32a\research-plan-app'
$env:PORT='8953'
node test/manual/rpa-63-preview.cjs
```

The allowlisted preview never loads the backend or `.env`, calls a provider, or persists calibration. It seeds Background and Question/Outcome positions 1 and 3, leaving position 2 empty. Reloading intentionally replaces the sample draft **on this preview origin only**.

Use the top links for guardrail/long content, Ready/no recommendations, Developing, or the original app at `/baseline/?scenario=guardrail`. The Next request selector controls slow evaluation/saving, evaluation failure and save failure. Choose Normal after a failure and use the affected field's Retry button. Edit text for staleness. The baseline always serves app.js/style.css from the verified base SHA.

## Validation

Automated:

- Full `npm test`: **256 passed, 0 failed**, including nine new RPA-63 tests registered in package.json. [Log](rpa-63-evidence/full-tests.txt).
- Requested section-evaluation, optional-recommendation, staleness, guardrail and bounded-retry tests: **87 passed**. [Log](rpa-63-evidence/focused-tests.txt).
- `node --check` passed for changed/new JavaScript; `git diff --check` passed.
- Installed **Windows Chrome 152.0.7977.82**, headless Playwright, fresh contexts at 100% zoom: 18 cases per version across three fields, three scenarios and 1366/390 CSS px. No evaluation-panel overflow, external requests or page errors. [Before geometry](rpa-63-evidence/before-browser.json), [after geometry](rpa-63-evidence/after-browser.json).
- Keyboard Space/Enter activation, Tab order, collapse focus return, yellow visible focus, hover, Like/Dislike/Save saving/saved/disabled semantics, stale/pending/error and manual recovery, sibling results and print/draft preservation. [Interaction results](rpa-63-evidence/interactions.json).
- Five updated Chrome PDFs cover Guardrail and Ready on A4/Letter, plus Letter from a 390px screen. All populated input values, all expected evaluation/recommendation text, and written feedback are retained; interactive evaluation controls are excluded. No heading-only Context page remains. Guardrail is 11 pages versus baseline A4's 14; Ready is 10 A4 / 11 Letter. Values, collapsed sections, timeline visibility, focused control and saved draft survive printing. [PDF checks](rpa-63-evidence/pdf-inspection.json), [browser checks](rpa-63-evidence/print.json).

Agent-observed:

- Inspected comparable Windows Chrome screenshots for scalar and structured panels, including long/narrow content, and focus/selected feedback captures. These are headless Windows Chrome captures, **not in-app-browser captures**. Sticky toolbars are hidden only during field screenshots to prevent capture occlusion.
- Opened native Windows Chrome print preview with Microsoft Print to PDF, portrait, colour. The initial implementation had 16 pages with that window/settings; after the pagination correction it showed 11 pages with all three question texts in the preview accessibility document. Further native UI checking was stopped by Computer Use because it could not determine the current browser URL confidently enough to enforce policy. No Microsoft-driver PDF was saved by the agent.
- Rendered and inspected every page of the final Guardrail Letter PDF, plus the Ready A4 section/input and evaluation page boundaries. Question 3 and Background are complete; borders close at page boundaries, metric explanations remain with their scores, and short radio choices do not overlap.

User-reported validation: Max initially reported the rubric typo, blank space/stranded headings, cross-page borders and clipped Question 3 in both preview and a Microsoft Print to PDF export. The initial PDF was inspected at `C:\Users\Max\Downloads\research_plan_app_rpa_63.pdf` (14 Letter pages). These reports prompted the print follow-up above. On 8 September 2026 Max supplied the updated PDF and confirmed: "previews and output are good now" and "all other manual tests passed", then approved merging the branch and closing the ticket. RPA-67's earlier manual results are not counted as RPA-63 validation.

## Evidence

| Case | Before | After |
| --- | --- | --- |
| Background, desktop | [Before](rpa-63-evidence/before-guardrail-background-1366.png) | [After](rpa-63-evidence/after-guardrail-background-1366.png) |
| Research Questions, desktop | [Before](rpa-63-evidence/before-guardrail-researchQuestions-1366.png) | [After](rpa-63-evidence/after-guardrail-researchQuestions-1366.png) |
| Outcomes, 390px | [Before](rpa-63-evidence/before-guardrail-outcomes-390.png) | [After](rpa-63-evidence/after-guardrail-outcomes-390.png) |
| Ready, no recommendations, 390px | [Before](rpa-63-evidence/before-ready-researchQuestions-390.png) | [After](rpa-63-evidence/after-ready-researchQuestions-390.png) |
| Saved PDF | [Before](rpa-63-evidence/before-chrome-print.pdf) | [After](rpa-63-evidence/after-chrome-print.pdf) |
| Complete Question 3 on paper | [Before](rpa-63-evidence/before-pdf-questions.png) | [After](rpa-63-evidence/fixed-letter-03.png) |
| Evaluation page boundary | User-supplied screenshots | [Page end](rpa-63-evidence/fixed-letter-04.png), [continuation](rpa-63-evidence/fixed-letter-05.png) |

## Validation limits

- The reported baseline print defects have now been corrected locally at Max's request. This is a print CSS adjustment, not a replacement export pipeline or broader print redesign.
- Agent-generated final PDFs were exported by installed Windows Chrome through Playwright. Max subsequently confirmed the native preview and output are good. The agent's native UI checking ended at the Computer Use URL-verification stop; native preview was closed before that stop and the task's Chrome window was left maximised.
- Paper-width textarea sizing was verified in Chrome 152. Browsers without `field-sizing: content` retain the old autosizing fallback and have not been validated here.
- No live model evaluation, physical mobile device, or screen-reader session was used. Offline responses deliberately stress long content and state transitions; RPA-67's provider retry budget is covered by the unchanged regression suite.
- To reproduce the completed print checks: reload `http://127.0.0.1:8953/?scenario=guardrail` or `?scenario=ready`, and reopen Print / Save as PDF. Check the complete third question, Context heading with Background, and closed borders at evaluation page breaks.
