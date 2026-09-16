# Candidate verification — 15 September 2026

**Accepted by Max, 15 September 2026:** browser-local sequential review with
submissions OFF; the server/UI feedback gate, OFF for the pilot; and the scoped
recovery and honest-wording fixes. These decisions do not establish deployment or
participant acceptance. The accepted code fixes are in [PR #104](https://github.com/GustavoBerumen/research-plan-app/pull/104). Manual testing uses the intended device and browser;
a desktop is fine and no laptop is required.

Source: `f3273269d58893e9e4f6004267175c54b4d6d4ff`, pinned after a fresh main fetch.
The separate clean archive contains no .env or live credentials. Dependencies were
installed from its unchanged lockfile with lifecycle scripts disabled; no upgrades.
Application sources were not changed. Tests ran with a sanitised process environment.

## Approved repair candidate

[PR #104](https://github.com/GustavoBerumen/research-plan-app/pull/104) implements
the accepted fixes at `429c7297837bb312974b5de2d98e7573cd613f93`, based on f327326.
The complete 72-file package.json suite passed **672/672**, concurrency 2,
Node v24.19.0, 280.5 seconds, with no failures/skips/cancellations. The eight
link/mode/timing cases now preserve the complete saved draft and normal recovery;
failed/malformed config, no draft, queued/direct saves and the feedback gate pass.
The queued-save case uses test-only instrumentation of the real app functions.

Synthetic loopback in-app browser checks confirmed disabled dead-link Menu
actions, retained Interviews after returning to the own plan, honest local review
progress and the visible feedback-unavailable notice. Zero feedback/submission/AI
requests occurred. This is local evidence; browser-created file saving and hosted
acceptance remain separate. Check PR/CI and final main ancestry before deployment.

The original audit below deliberately retains the failures of unchanged f327326
and earlier evidence. Do not attribute those failures to the repaired candidate
or the repaired candidate passes to the old deployed build.

## Evidence matrix

| Evidence | Result | Boundary |
| --- | --- | --- |
| Complete package.json suite | 654/654 pass, 71 files, concurrency 2, Node v24.19.0, 262.7 seconds | Run once, 19:11:35–19:15:57 UTC; synthetic/offline, no new hosted acceptance |
| Normal capability timing | Early ON/OFF, delayed ON with typed controls retained, failed/malformed config with Send unavailable | jsdom; no cloud records or paid calls |
| Local review and submissions | OFF retains sequential panel/link block; ON replaces them with four declaration/initial controls and Send | Source, jsdom and rendered in-app browser observation; ON does not implement shared review |
| Invalid links | Unknown/revoked links remove the plan DOM, with no submission panel appearing later | Both ON/OFF and early/late config; refusal is intentional, recovery defects below are not |
| Dead-link autosave | FAIL in 8/8 combinations: click message, wait for autosave, methods change from one populated group to `[]` | Focused reproducer; in-app browser return shows the former method blank |
| Dead-link download | FAIL in 8/8 combinations: generated backup has `methods: []` even before the click | Actual app-generated Blob inspected; fields alone remain intact and would miss this defect |
| Restore at dead link with ON | FAIL: “Cannot read properties of null (reading 'cloneNode')”; original storage retained in this isolated restore case | jsdom using an actual saved synthetic backup; restoring at normal URL succeeds |
| Partial draft and ordinary backup | PASS: unfinished fields, dormant comment, methods, lists, tables, custom data and review record retained; cancel/invalid file keeps current writing; reload succeeds | Saved app-generated JSON, filesystem readback/SHA-256 and restore UI; no file bytes/AI results claimed |
| Visible browser restore | PASS: actual saved `partial-original.json` selected; success status and “Retain partial synthetic context” visibly present | Codex in-app browser on Windows; no Chrome-native claim |
| Browser download | UNVERIFIED: started message, 5-second download-event timeout, no matching new file found in Downloads | Do not equate toast/Blob interception with a verified browser-created download |
| Browser scope | Sequential first/second signature and Approved state; ON controls; OFF email playback; unknown-link failure; single visible methodology question | Default in-app viewport, screenshot/AX evidence. Intended desktop/1280px keyboard walk remains a short final user check |
| Feedback | Enabled true; real server handler appends JSONL via the existing offline route/write-spy tests | Source/automated evidence; preview made zero feedback/submission/AI requests. No live feedback file inspected |

The initial exploratory script recorded field-only equality on dead links. That
does not establish plan preservation: the dedicated methods/download assertions
reproduced the failures above. Do not report its aggregate as a recovery pass.

## Reproducible defect and minimal change specification

1. Seed a synthetic v9 draft with a question and populated methods group. Open
   `/?as=unknown#review`, or a revoked token from that draft. The dead-link page
   appears correctly and contains no plan fields.
2. Download from Menu: inspect the generated JSON; methods are already missing.
3. Click the dead-link text and wait over the 400 ms autosave debounce. Return via
   **Open your own plan**: the method is blank. Repeat ON/OFF and early/late config.
4. In a separate ON case, restore a valid backup directly from the dead page:
   restoration fails with a null `cloneNode` message. Storage remains in that case.

Cause: `openDeadLink()` removes the document's form children; `initDraftPersistence()`
still binds input/change/click saving; `collectDraft()` sees no method-group DOM;
`carryUnrendered()` carries keyed sections but not the methods array. Backup uses
the same form collection. The restore confirmation check, planHasBackupContent(),
tries to clone a missing .doc-header before replacement can begin (app.js:8396).

Proposed bounded fix: prevent all saves (including queued/direct saves) while the
dead-link state has no editable plan. Make download/restore/clear and other
form-dependent Menu actions unavailable there, with plain guidance to open the
normal own-plan address first. Preserve the saved plan byte-for-byte until that
navigation; leave the dead-link refusal and role checks intact. Verify normal
restore and ON/OFF late mounting still work. This avoids a broad review-ownership
redesign and does not pretend links retrieve a remote plan.

## Wording and feedback specifications

- Render honest author-email hint and playback independent of submissions config;
  replace the other-party email promise too. Explain “local draft/backup” and
  “this demonstration does not send email”. Local review's Sign and send/Sent to
  messages should describe local review progress. Preserve genuine RPA-64 Send
  and receipt wording. Tests must check visible text before/after config and both
  modes, not just the hidden flag.
- Proposed feedback gate: one explicit validated server setting/capability, OFF
  unless collection is deliberately approved; gate direct requests before reading
  the body or appending. Match visible UI and fail-closed config. Decide whether
  local feedback download remains offered under the notice; do not silently retain
  a prompt to send it manually. Preserve existing feedback files and their handling.
  There is no such deployment setting in this candidate yet.

## Exact-source references

- [Mode switch and capability validation, app.js](https://github.com/GustavoBerumen/research-plan-app/blob/f3273269d58893e9e4f6004267175c54b4d6d4ff/app.js#L487)
- [Local token resolution](https://github.com/GustavoBerumen/research-plan-app/blob/f3273269d58893e9e4f6004267175c54b4d6d4ff/app.js#L5626)
- [Dead-link document replacement](https://github.com/GustavoBerumen/research-plan-app/blob/f3273269d58893e9e4f6004267175c54b4d6d4ff/app.js#L6441)
- [Draft saving and carry](https://github.com/GustavoBerumen/research-plan-app/blob/f3273269d58893e9e4f6004267175c54b4d6d4ff/app.js#L7485)
- [Dead-link persistence binding](https://github.com/GustavoBerumen/research-plan-app/blob/f3273269d58893e9e4f6004267175c54b4d6d4ff/app.js#L8025)
- [Submission panel and mode-only wording](https://github.com/GustavoBerumen/research-plan-app/blob/f3273269d58893e9e4f6004267175c54b4d6d4ff/app.js#L8057)
- [Author-email template hint](https://github.com/GustavoBerumen/research-plan-app/blob/f3273269d58893e9e4f6004267175c54b4d6d4ff/research-plan-template.md#L112)
- [Other-party email hint](https://github.com/GustavoBerumen/research-plan-app/blob/f3273269d58893e9e4f6004267175c54b4d6d4ff/app.js#L5780)
- [Feedback file/handler](https://github.com/GustavoBerumen/research-plan-app/blob/f3273269d58893e9e4f6004267175c54b4d6d4ff/server.js#L1432)

Local logs/scripts and exact source archive are in this continuation's
`release-readiness` task artifacts. See the checkpoint for absolute paths and
hashes. This is not hosted acceptance, real-provider verification or a fixed build.
