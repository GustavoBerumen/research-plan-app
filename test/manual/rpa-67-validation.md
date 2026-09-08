# RPA-67 local validation — 8 September 2026

Implementation is ready for review. Max reported all three requested manual checks
passed and supplied screenshots; the live smoke limitation remains documented below.
Max approved committing, pushing and opening a PR after reviewing these results.
Merge and Jira changes remain outside that approval.

Branch: `codex/rpa-67-bounded-evaluation-retries` in the task's new managed worktree
`C:\Users\Max\.codex\worktrees\9223\research-plan-app`.
Base: `5fe14f8b886a34e824f244b3b023bedd74675a06`, verified using Git HTTPS and freshly
fetched from `origin/main` before branching. Other worktrees/servers were preserved.
The existing `.env` was loaded in place only for the authorised live smoke run;
no environment file or credentials were copied, edited, or printed.

## Behaviour and choices

- A field gets at most three total provider requests for each explicit click.
  Provider output extraction and all strict scalar/Question/Outcome formatting
  happen inside this budget. A valid result returns immediately; a new click has
  a fresh budget, including after exhaustion. Each section field remains independent.
- The installed SDK is `@anthropic-ai/sdk` 0.115.0. Its defaults are two retries
  and 600,000 ms; its fetch timeout ends at response headers. Evaluation requests
  override `maxRetries: 0` and `timeout: 30000`. An outer 30-second abort deadline
  includes response-body reading and formatting. Retries wait 500 and 1,000 ms,
  giving roughly 91.5 seconds maximum per field once it leaves the existing queue.
  Short waits avoid immediately repeating a transient failure without extending
  the interactive request by the SDK's potentially much longer retry waits.
- Retryable: malformed or missing tool output, invalid provider JSON, SDK
  connection errors, known socket/body-read failures, timeouts, and HTTP
  408/409/429/5xx. Other errors stop immediately. Invalid input is rejected before
  provider work; missing API configuration retains the existing startup guard.
  HTTP 401/403 makes one request, even if a provider header asks the SDK to retry.
- Browser disconnect/Clear Form aborts provider fetches and backoff; timers and
  listeners are cleaned up. Existing client duplicate guards, two-field concurrency,
  cancellation epochs, result preservation, feedback controls, staleness and drafts
  are retained. No client automatic HTTP retry was added.
- Logs contain a request-local correlation ID, attempt, category, validation rule
  and HTTP status where relevant, without prompts, payload bodies or raw SDK errors.
- The test seam consists of an injectable SDK client, logger and short durations
  on `evaluateWithRetries`/`handleEvaluate`; these are not HTTP input options.
  Models, tool schemas, prompts, rubric, scoring and suggestion endpoints are unchanged.

Final exhaustion text is:

> Evaluation request failed: No valid evaluation was received after 3 attempts. Retry Goal below.

## Automated validation

- Focused retry coverage plus existing section/optional-recommendation/staleness
  coverage was run during development. The final full `npm test` run passed
  **247 tests, zero failures**, including **55 RPA-67 tests/subtests**.
- Tests use the installed SDK with intercepted fetches, so provider-request counts
  verify that SDK retries do not multiply the budget. HTTP and jsdom integration
  cover fresh manual three-attempt budgets, sibling/prior results, feedback,
  drafts, duplicate clicks, disconnection and Clear Form. Existing tests cover
  obsolete responses, positional targeting, scoring and staleness.
- Timeouts cover both a stalled fetch and a stalled response body, verify actual
  abort signals, and confirm successful requests clean their timers/listeners.
- `node --check` passed for changed/new JavaScript; `git diff --check` passed.
- Full output: [rpa-67-offline-results.txt](rpa-67-offline-results.txt).

## Live smoke — observations, not a guarantee

The requested Problem Statement text and its four current rubric criteria were
run 20 times against the existing configured `claude-haiku-4-5-20251001` environment.
No prompts, model settings or validators were changed to obtain this result.

| Observation | Count |
| --- | ---: |
| Explicit evaluation invocations | 20 |
| Actual provider requests | 26 |
| Successful evaluations | 19 |
| Successes on attempt 1 | 15 |
| Successes recovered on attempt 2 | 4 |
| Exhausted evaluations | 1 |
| Rejected malformed provider responses | 7 |

Invocation 4 exhausted all three attempts on `metrics.array_length` and returned
the intended failure. The next independent invocation succeeded on attempt 1.
No invocation exceeded three requests; the longest took 11.831 seconds. This run
**did not meet the ticket's zero-visible-error smoke criterion**. It demonstrates
recovery and bounded exhaustion, not elimination of malformed model output.

Raw observations: [rpa-67-live-results.txt](rpa-67-live-results.txt).
The opt-in runner [rpa-67-live-smoke.js](rpa-67-live-smoke.js) is excluded from
`npm test`. To repeat it (paid requests, up to 60 provider attempts):

```powershell
Set-Location 'C:\Users\Max\.codex\worktrees\9223\research-plan-app'
node --env-file=C:\Users\Max\research-plan-app\.env test/manual/rpa-67-live-smoke.js
```

## User manual validation

Max reported "all three tests worked" after testing the supplied fixture URLs:

1. Exhaustion showed one readable failure banner and Retry Goal while preserving
   writing and the successful Background result.
2. Manual Retry recovered, with writing and the sibling result preserved. The
   requested check included Tab/Enter recovery and a narrow window; those actions
   are user-reported, while the screenshots show the narrow rendered states.
3. Clear Form during slow work cleared the form with no late result/error returning
   during the requested wait.

The fixture log independently confirms one Background success, exactly three
malformed Goal attempts, a fresh Goal invocation succeeding on attempt 3, and two
in-flight invocations cancelled on attempt 1. No queued third invocation appears.
See [rpa-67-browser-server.txt](rpa-67-browser-server.txt).

User-supplied screenshots:

- [Exhaustion and preserved Background](rpa-67-evidence/exhaustion.png)
- [Successful manual recovery](rpa-67-evidence/manual-recovery.png)
- [Cleared form](rpa-67-evidence/clear-form.png)

The screenshots show the Codex in-app browser. Standalone Windows Chrome coverage
is not independently confirmed; no Chrome-specific pass is claimed.

Chrome was launched, but Computer Use stopped while navigating because it could
not determine the browser URL confidently enough to enforce its policy.
No browser automation was retried after that block.

## Reproduction steps

A deterministic Context-section fixture is running on the separately bound port
8947. It needs no API credentials and serves the actual app and changed evaluation
handler: <http://127.0.0.1:8947/?scenario=exhaust>.
To start a new fixture process after the current one is stopped:

```powershell
Set-Location 'C:\Users\Max\.codex\worktrees\9223\research-plan-app'
$env:PORT = '8947'
node test/manual/rpa-67-browser-fixture.js
```

1. At desktop width, fill Background and Goal in Context and choose Evaluate
   context. Background succeeds; the first Goal invocation fails after three
   malformed responses. Check that there is one punctuated failure banner, the
   writing and sibling result remain, and Retry Goal is available.
2. Tab to Retry Goal and press Enter. It should recover on attempt 3 without a
   fourth provider request. Inspect the terminal's attempt records. Repeat with a
   narrow viewport (about 390 CSS pixels); confirm the banner wraps and controls
   remain visible/reachable. Confirm keyboard focus can move to the result controls.
3. Open <http://127.0.0.1:8947/?scenario=recover>. Evaluate a populated Context
   section: each field should silently recover on attempt 3. Repeated clicks must
   not duplicate in-flight evaluations. Reevaluate an existing result and check
   feedback controls and staleness after editing during the request.
4. Open <http://127.0.0.1:8947/?scenario=slow>. Populate three Context fields, start
   evaluation and use Clear Form while two are in flight and one is queued.
   Confirm all writing/results clear, queued work never starts, and no late result
   or error returns. Write new content and confirm evaluation is available again.

The fixture's first-Goal failure resets when its process restarts. It is only for
Context fields; the three structured evaluation paths are covered by offline tests.
