# RPA-41 review and RPA-6 handoff

Implementation is ready for review on
`codex/rpa-41-upload-controls-laptop-width`, based on
`0ef86d62f829ad7851df02f2f8ab533a3e0e9cba`. The implementation revision is the
commit containing this handoff; the pull request records its exact SHA. Do not
identify the base commit alone as the tested release candidate.
The local `rpa-41-evidence/source-manifest.json` records hashes of the tested files;
`rpa-41-evidence/review.patch` contains the complete proposed source/test diff.

On 9 September 2026, a fresh fetch confirmed this base. Jira still showed RPA-41
Ready/unassigned and RPA-89 Done; PR #52 was merged at the base; no open repository
PRs or pre-existing local/remote RPA-41 branches were found. The clean task-managed
worktree was reused. After local review and Max's reported manual passes, Max
explicitly authorised commit, push, opening a PR and verifying CI, with a stop
before merge or Jira changes. No deployment or collaborator message is authorised.
Existing previews were preserved; credentials, physical uploads and records were
not changed or inspected.

## Decisions and overlap audited

Read [RPA-41 and comment 10069](https://turingtestable.atlassian.net/browse/RPA-41?focusedCommentId=10069),
the [accepted RPA-80 decision, comment 10068](https://turingtestable.atlassian.net/browse/RPA-80?focusedCommentId=10068),
[RPA-89 closeout, comment 10071](https://turingtestable.atlassian.net/browse/RPA-89?focusedCommentId=10071),
[merged PR #52](https://github.com/GustavoBerumen/research-plan-app/pull/52),
[RPA-4](https://turingtestable.atlassian.net/browse/RPA-4),
[RPA-88](https://turingtestable.atlassian.net/browse/RPA-88),
[RPA-6](https://turingtestable.atlassian.net/browse/RPA-6),
[RPA-7](https://turingtestable.atlassian.net/browse/RPA-7) and
[RPA-1](https://turingtestable.atlassian.net/browse/RPA-1).
RPA-6/7/1 had no comments and contained the selected 9 September pilot wording.
That wording supersedes their older Finish/Send/document-delivery acceptance text.

RPA-89 already supplies exact static assets in every mode, denial of pilot writes
before parsing, disabled integrations, and capability guards which keep upload
actions hidden/disabled when config is pending, missing, invalid or failed.
Its backup help already distinguishes local autosave, JSON download, private
handover, replacement restore and Print/PDF. Those protections remain unchanged;
there is no server or schema change in RPA-41.

RPA-41 finishes the file-cell presentation and fixes a reproduced preservation
bug: an explicitly empty filename was replaced with `No file chosen`, causing
RPA-40's faithful-restore check to reject otherwise valid backups. Filename
metadata now lives separately from display text, retaining the existing
`{ t: 'file', v, n }` contract, stable keys, columns and row positions. All file
cells use this path, including synthetic restored custom/previously dormant
tables. In pilot/unavailable states filenames are plain text, an unnamed saved
reference displays its reference value as text, and empty cells say
`No saved file reference`. The original stored empty strings, whitespace and
legacy placeholder values remain exact in JSON. Markup-like names remain text.

Previous Knowledge stays editable by name. Its pilot hint no longer invites an
attachment, and each file cell says `Reference only. Attachment contents are
unavailable through this app.` Restricted upload wrappers occupy no space and
long filenames wrap within their existing cell. The initial 1280px observation
showed ellipsis clipping; the final build shows the whole synthetic filename.
Confirmed nonpilot controls and wording remain available. Filename metadata is
also maintained on nonpilot upload completion; transient `Uploading…` copy is
never collected as a filename, and failed replacement redisplays the retained
reference. No retrieval endpoint or file migration is added.

One existing timeline test now expects the local calendar date, matching the app.
Its UTC expectation failed in Mexico City after 18:00 when UTC had crossed midnight.
No production date or timeline behaviour changed.

## Reproducible preview and fixtures

Worktree: `C:\Users\Max\.codex\worktrees\5be2\research-plan-app`.
Preview: **http://127.0.0.1:49341/**, left running for this review.
This uses the real app and server routing in RPA-89's synthetic filesystem
harness, with mocked scalar AI evaluation/framework matching. It reads no `.env`,
credentials, real attachments or private records, and makes no provider calls.
Use this preview rather than `npm start`, a generic static server or an older port.

If it needs restarting, run in that worktree:

```powershell
node test/manual/rpa-41-fixtures.cjs
$env:RPA_PREVIEW_PORT='49341'
node test/manual/rpa-41-preview.cjs
```

If the port is already in use, use the existing RPA-41 preview; do not kill an
unidentified process. Restart only this preview after further source edits,
because the harness reads its asset snapshot at startup.

Prepared synthetic files (not actual downloaded backups):

```text
C:\Users\Max\.codex\worktrees\5be2\research-plan-app\test\manual\rpa-41-evidence\reference-input.json
C:\Users\Max\.codex\worktrees\5be2\research-plan-app\test\manual\rpa-41-evidence\reviewer-current.json
C:\Users\Max\.codex\worktrees\5be2\research-plan-app\test\manual\rpa-41-evidence\invalid.json
```

`reference-input.json` contains six Previous Knowledge rows: a long Unicode
filename, an empty reference, a saved URL with empty filename, a filename without
a URL, the legacy `No file chosen` placeholder, and a markup-like filename.
It also includes dormant/custom table references, custom sections, a blank second
Question/Outcome with its own Methods, entered dates and an explicit creation date.
The source generator is `test/rpa-41-fixtures.cjs`, built on RPA-40's fixture.
The reviewer fixture is deliberately smaller to exercise replacement.

## Completed evidence

- **Automated, synthetic and mocked:** final focused regressions **169/169**.
  Command: `node --test test/rpa-41-reference-files.test.js test/rpa-40-plan-backups.test.js test/rpa-89-pilot-restrictions.test.js test/rpa-65-timeline-scales.test.js test/rpa-53-timeline-visibility.test.js test/rpa-48-prose-wrapping.test.js test/rpa-67-bounded-evaluation-retries.test.js test/line-endings.test.js`.
  Includes exact restore/edit/backup/reload, dormant/custom cells, empty/long names,
  nonpilot uploads, Clear Form cancellation/confirmation, immediate table-row
  removal without a new confirmation, print-event preservation, rollback,
  evaluations/retries, Windows line endings and synthetic private-file/write spies.
- **Full suite: 370/370 passed** in the normal Windows America/Mexico_City timezone;
  see `rpa-41-evidence/full-tests-final.txt` for the final result.
  An earlier run passed 364/368; its four failures were the UTC/local-date test
  expectation described above. A UTC rerun and the corrected local-time rerun
  both passed 368/368 before the last two focused reference tests were added.
- JavaScript syntax and `git diff --check` results are retained in
  `rpa-41-evidence/syntax-checks.txt` and `whitespace-check.txt`.
- **Actual in-app browser, mocked provider:** restored the fixture through the
  file chooser; edited an adjacent name; added row 7; reopened the same site and
  recovered both edits and reference display; confirmed evaluations do not recover
  as saved results. Restore cancellation and invalid-file rejection kept the seven
  rows, edits and expanded evaluation details. No reference links or active upload
  controls were exposed. Deliberate Context evaluation showed criteria and
  recommendations. `RPA41_FAIL` in Background exhausted three attempts while
  preserving writing; changing the text and choosing `Retry Background` succeeded.
- **In-app visual/DOM checks:** all four sections expanded at 1280px and ordinary
  1600px desktop. Document client/scroll widths were 1265/1265 and 1585/1585.
  At 390px they were 375/376: the pre-existing minor 1px overflow reproduces after
  Methodology expansion. Schedule uses its existing contained 690px horizontal
  table. Action Points and Previous Knowledge fit the 335px content width.
  Long filename client/scroll widths match after wrapping: 326/326 at laptop and
  128/128 at narrow width. Inspected references, tables, sparse pairs/methods,
  toolbar, dates and evaluation panels. Tab from Download reaches Restore with
  visible focus; Tab from new row Name reaches Remove row 7 with visible focus;
  Enter expands Research/Methodology. No broader layout change was made.
- **Agent-only limitations:** the in-app download status appeared but its download
  event timed out and no matching JSON was found in Downloads. This is not proof
  of a saved file or an actual downloaded-file round trip. Print activation exposed
  no verifiable print preview/PDF. One Clear Form browser check stalled the tool;
  a fresh tab recovered the saved synthetic draft. These tool limitations remain
  part of the evidence history; no agent-run saved-PDF or complete keyboard-only
  journey is claimed.
- **Native Windows Chrome:** attempted with Computer Use, which stopped because
  it could not establish the current Chrome URL sufficiently to enforce its policy.
  No agent-run native RPA-41 pass is claimed.
  RPA-89's prior manual acceptance is historical and does not validate this build.
- **User-reported RPA-41 acceptance:** in the follow-up, Max reported the manual
  tests passed except item 4 in the final review summary: the RPA-1/RPA-6 private
  handover and deployed acceptance work. This records the native download/restore,
  browser/keyboard/cancellation and Print/PDF groups as user-reported passes at
  the supplied local preview. Those groups correspond to detailed checks 1–4
  below; the unresolved operational work corresponds to detailed checks 5–6.
  No independent inspection of newly saved JSON/PDF artifacts is claimed.
  This acceptance does not resolve the legacy-file disposition decision or approve
  deployment. Subsequent explicit approval covers commit, push, opening a PR and
  verifying CI only; merge and Jira changes remain outside the approval.

## Proposed legacy-file policy — pending Max's review

Keep existing physical uploads untouched and inaccessible through every app route
during this engineering change. Browser drafts and downloaded backups keep exact
reference values and filenames, including hidden/dormant data; the UI exposes
reference text, never a promise that attachment contents can be retrieved.
Backups contain no attachment bytes. Deliberate row removal/Clear Form retain
their existing plan-editing meanings and do not delete physical uploads.

This temporary preservation is **not approval of indefinite retention**. Gustavo,
as RPA-1's operational owner, must identify/confirm the responsible data owner and
obtain their explicit approval before any eventual retention, migration or deletion
of physical files. Max reviews this proposal; engineering completion does not
approve disposition on either person's behalf.

**Decision still needed:** record the confirmed data owner, the authorised action
for the legacy uploads, a retention/deletion date, deletion-request contact, and
any necessary private recovery procedure outside this app. Recommendation: keep
access closed, avoid indefinite retention, and agree a bounded owner-approved
retention or deletion action before real-data sessions. Do not add an app recovery
endpoint. Neither Friday nor the end of engineering is an agreed deletion date.

## Local manual script — Max reports checks 1–4 passed

Retained for reproduction and RPA-6 reuse. Only operational checks 5–6 remain
unperformed; their numbering differs from the four-item final review summary.

Use Windows Chrome and **http://127.0.0.1:49341/** for checks 1–4. Use only the
synthetic files above. First back up any browser plan you need to preserve.
The target output paths below are suggested save locations, not pre-existing
download evidence.

1. **Actual download, replacement, revision and same-browser recovery.** Restore
   `reference-input.json`; accept replacement only after backing up the current
   plan. Expect `Backup restored and saved in this browser`. Select Download
   backup and verify an actual JSON file in Chrome Downloads and on disk; save a
   copy as `C:\Users\Max\.codex\worktrees\5be2\research-plan-app\test\manual\rpa-41-evidence\native-original.json`.
   Restore `reviewer-current.json`, back it up before replacement, then restore
   the **actual downloaded** original. Edit the title to `RPA-41 native revision`
   and Name row 1 to `Native edited reference name`; download and verify
   `C:\Users\Max\.codex\worktrees\5be2\research-plan-app\test\manual\rpa-41-evidence\native-revised.json`.
   Reload and then restore that actual revised file. Expect the title/name edits,
   six reference rows, exact filenames/empty strings, 29 August Last updated,
   30 October readout, sparse paired entries and custom/dormant data to survive.
   Evaluation results should not return from a backup. Download alone sends nothing.
2. **Cancellation, invalid file and row controls.** At the same URL with the
   revised synthetic plan, evaluate Context and expand Background details. Select
   `reference-input.json` for restore, then Cancel replacement. Select `invalid.json`.
   Open Clear Form and Cancel. Expect all writing, rows, references, visible
   evaluation details and current draft to survive. Add a Previous Knowledge row,
   type a synthetic name, then remove that row: only it disappears, immediately
   (table deletion has no confirmation). Cancel a populated Research Question's
   linked-content removal warning and expect its Outcome/Methods to remain. After
   saving the revised backup, accept Clear Form: expect a fresh form/defaults and
   no old references returning on later edits. Restore the saved revised backup
   to leave the review plan populated. No physical uploads are deleted.
3. **Native laptop, desktop, narrow and keyboard/evaluation.** At the same URL,
   use Chrome DevTools Responsive view at 1280px, an ordinary 1600px viewport,
   and 390px. Expand every section and inspect tables, long names, new rows,
   toolbar, dates, custom sections and evaluation panels. Tab/Shift+Tab through
   controls; use Enter for accordions and actions. Expect visible focus, usable
   controls, intact positions, wrapping filenames and no picker/menu/Add from
   Drive in any file cell. The schedule may scroll within its table at 390px;
   record the known 1px page overflow separately. Put `RPA41_FAIL` in Background,
   choose Evaluate context, and wait for the three-attempt failure. Expect intact
   writing and a technical-error retry action, rather than a poor research score.
   Replace the marker with normal synthetic context and select Retry Background:
   expect results/recommendations and preserved neighbouring results.
4. **Native Print / Save as PDF.** At the same URL with the populated synthetic
   plan, show the timeline and choose Print / Save as PDF. Inspect every page at
   A4 and Letter as needed; cancel once and confirm unchanged writing. Save an
   actual PDF as `C:\Users\Max\.codex\worktrees\5be2\research-plan-app\test\manual\rpa-41-evidence\native-reference-plan.pdf`
   and reopen it. Expect readable long reference names, dates, paired rows,
   custom sections and timeline cells, with toolbar/editing controls omitted.
   Report preview and reopened-PDF results separately. No PDF attachment bytes or
   working app download links should be implied by the reference text.

## RPA-6 reusable journey and operational handoff

The local steps above demonstrate app behaviour only. Gustavo leads the roughly
30-minute session script; Max supports technical checks and facilitation.
RPA-6 must record the actual release candidate, evidence, limitations and go/no-go
before RPA-7 starts. Friday 11 September 2026 is a deployment-ready target, not an
agreed deadline for completing sessions or deleting their data.

Participant wording:

> Your draft autosaves in this browser/profile and site. Download backup saves
> a JSON file on your device; it does not send your plan. Hand that file over
> separately using the agreed private method, and confirm receipt. Before restoring
> another backup, download your current plan if you want to keep it: restoration
> replaces the current plan. Saved filenames and references remain in backups,
> but attachment bytes and AI evaluation results are not included. Attachment
> contents cannot be retrieved through the pilot app. Removing upload controls
> does not delete existing physical files. Print / Save as PDF makes a readable
> copy; edit a restored JSON plan in the app and download a revised backup to return.

The remaining operational checks are independent of RPA-41 engineering:

5. **Private handover and return (RPA-1/RPA-6).** The exact private destination,
   handover method and deployed app URL have **not been supplied or selected**.
   Gustavo must record them, the owner, verified permissions, deletion contact
   and retention/deletion date before this check. Using synthetic plans, perform
   the download from check 1, deliberately transfer that actual file privately,
   and have the recipient explicitly confirm receipt. In the recipient's browser,
   back up their current plan before restoring the received JSON, edit it, download
   and verify a revised file, then return it through the confirmed private method.
   The author confirms receipt and restores it after backing up their current plan.
   Expect faithful revision/recovery and no participant-to-participant exposure.
   Download and restore tests alone do not demonstrate either handover or receipt.
6. **Deployed release candidate (RPA-1/RPA-6).** Exact exposed HTTPS origin(s)/API
   URLs and release commit must first be recorded by Gustavo; localhost is not
   deployment acceptance. Verify HTTPS and invited access on every exposed
   origin/API, bounded AI use, and `/api/config` reporting `pilotMode: true` with
   all five restricted capabilities false and no Google keys. Verify disabled
   upload/calibration/framework-write/Jira endpoints reject synthetic requests,
   private paths remain inaccessible, and each enabled server-side record has
   private persistence plus restart/redeploy/deletion evidence. Repeat checks
   1–5 against that exact release candidate and record limitations and go/no-go.
   No live handover, deployed security check or release approval was performed here.

This handoff contributes evidence to RPA-6; it does not complete RPA-6/RPA-7,
close RPA-88, choose a service/folder or approve deployment/pilot sessions.
