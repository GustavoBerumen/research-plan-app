# RPA-34 validation and local preview

Branch: `codex/rpa-34-section-evaluation`

Base: freshly fetched `origin/main`, verified against the remote as
`5139c152cadfcd5042587270ad06066f72f28f5b` on 7 September 2026.
Implementation and validation used one dedicated managed worktree. Max completed
manual review and approved publication, merge and ticket closeout on 7 September
2026. No `.env` or credentials were inspected, copied or changed.

## Changes

- Two grey, left-aligned actions: Evaluate context after Problem Statement;
  Evaluate research after Outcomes. Empty fields are skipped, including optional
  Hypothesis. Entirely empty sections show an accessible message with no request.
- One shared queue permits two concurrent requests across both sections and
  individual updates/retries. Repeated and overlapping actions reuse pending
  field requests. Queued values are read when their request starts, so fields
  cleared while waiting are skipped.
- Detailed field results, scores, explanations, recommendations and feedback
  controls remain. Scalar evaluation payloads and structured numbering/pairing
  are preserved; backend evaluation and scoring rules are unchanged.
- Existing feedback remains during replacements. Failures have a separate
  message and individual Retry action. Section summaries update after retries.
- Edits mark results stale; structured results also track their Objective and
  paired Question context. Late responses are checked against their input
  snapshot. Reset/profile changes abort requests, cancel queued work and ignore
  obsolete responses. Completion never moves focus to another field.
- ADR 001 now records the approved two-button decision.

## Validation

- Focused RPA-34 suite: **13/13 passed**.
- Full `npm test`: **107/107 passed**.
- JavaScript syntax checks for changed scripts, new tests/preview, server and
  scoring helper passed. `git diff --check` passed.
- Windows in-app browser: desktop 1366 × 900 and narrow 390 × 844 inspected
  using mock responses. Enter/Space activated the section actions. Detailed
  scalar and structured feedback retained score squares, explanations,
  recommendations, critical-entry messaging and feedback controls. Result
  panels started collapsed and could be expanded/collapsed using the keyboard.
- Print still calls the existing `window.print()` handler. Deterministic
  before/after-print checks preserve expanded/collapsed feedback and make no
  evaluation requests. New buttons/progress are excluded by print CSS.

**Validation limitations:** native print preview could not be inspected.
Windows browser control stopped because it could not determine the current
browser URL reliably. No further UI interaction was attempted. The existing
`?test` profile toolbar also overflows at 390 px; its styles are unchanged by
this work. Evaluation panels themselves fit the narrow content column.
Failure/retry/reset races were checked deterministically, rather than through
live paid AI requests. The final summary-retry correction was verified by tests.

## Running preview

**Mock feedback only:** http://127.0.0.1:8935/?test

Start or restart from this repository:

```powershell
node test/manual/rpa-34-preview.cjs
```

The preview uses an asset allowlist and never loads `.env` or the production
backend. Feedback is synthetic; Save/Like/Dislike return mock acknowledgements
without storing anything. Methods/framework services are not available in this
preview. The normal configured application still starts with `npm start` at
http://localhost:8934/.

## Manual checklist

1. Click Load Profile, then Evaluate context. Only its three fields should gain
   results. Expand a result and confirm its score squares, criteria,
   explanations, recommendations and feedback controls.
2. Leave Hypothesis blank, then Evaluate research. Confirm Objective, numbered
   Research Questions and paired Outcomes retain separate detailed panels.
3. Edit a scored field: its feedback stays visible and becomes out of date.
   Use Update evaluation; type again while it runs and confirm the arriving
   result remains out of date. Move focus elsewhere and confirm it stays there.
4. Add `[fail]` to Goal and evaluate Context. Other results should survive.
   Remove `[fail]`, click Retry Goal, and confirm only Goal is retried.
5. Start both sections, repeat clicks, then Clear Form or load another profile
   during progress. Old results must not reappear. Evaluating an empty section
   should show a message without a request.
6. Use Tab, Enter and Space at desktop and narrow widths. Open one result and
   leave another collapsed, then try Print / Save as PDF. Verify the existing
   print behavior, with evaluation actions/progress omitted; cancel the dialog
   when done. Native print preview is the outstanding manual check.
