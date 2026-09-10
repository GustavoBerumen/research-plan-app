# RPA-89 review and validation

Implemented in the existing clean managed worktree on
`codex/rpa-89-pilot-file-write-restrictions`, based on freshly fetched
`796e2e671037b5dd67b295486b6ae5e4a926b23f`.

## Scope and verified ownership

On 9 September 2026, live Jira confirmed RPA-89 Ready, assigned to Max, blocking
Gustavo's RPA-1. RPA-41 remained Ready/unassigned. No open repository PR or local/
remote RPA-89 branch existed before this branch was created. RPA-89 and RPA-1
had no comments; their current descriptions, RPA-41 comment 10069 and RPA-80
decision comment 10068 were read. No newer decision retained the integrations.

- [RPA-89](https://turingtestable.atlassian.net/browse/RPA-89)
- [RPA-41 overlap](https://turingtestable.atlassian.net/browse/RPA-41?focusedCommentId=10069)
- [Accepted pilot decision](https://turingtestable.atlassian.net/browse/RPA-80?focusedCommentId=10068)
- [Gustavo's RPA-1](https://turingtestable.atlassian.net/browse/RPA-1)

The current bootstrap matches the ten listed public routes (nine files, with
two routes for index.html). Static requests use an exact map in every mode.
The server rejects pilot calibration/upload/framework writes and Jira requests
before handlers/body listeners. Upload-directory creation is deferred until a
permitted upload. Google integration configuration and startup scripts are
suppressed. File-operation errors do not disclose filesystem paths.

The UI requires a valid capability response; missing, malformed, failed,
contradictory or pending configuration leaves restricted actions unavailable.
Guarded event handlers also reject DOM attempts to re-enable the controls.
Evaluation, retry, suggestion and draft/backup logic remain intact. Backup help
explains browser autosave, deliberate private JSON handover, replacement restore,
backup-before-replacement and readable Print/PDF copies. Capability notices are
excluded from print. RPA-41 retains broader control removal and legacy-file
disposition; references and filenames are preserved.

No .env, credentials, real records, existing uploads, unrelated worktrees or
previews were opened or modified. No deployment or message to Gustavo was sent.

## Closeout acceptance

On 9 September 2026, Max reported that the manual tests "seem to pass" and asked
to wrap up the ticket and merge. This is user-reported manual acceptance of the
checks below, separate from agent-observed and automated evidence. The supplied
screenshots show the invalid-backup preservation message and a rendered PDF page
with timeline cells and plan sections. They do not independently document every
download, viewport or PDF page; no additional agent-run native pass is claimed.

Publication is authorised, subject to green CI and verifying the merge in
`origin/main` before marking RPA-89 Done. The manual script below is retained for
reproduction. RPA-88 requires each milestone's own acceptance evidence: closing
this supporting task does not close that Epic, RPA-1, RPA-6 or deferred features.

## Completed automated checks

- Locked dependencies: `npm ci --ignore-scripts` succeeded; 0 vulnerabilities
  reported. The first attempt hit the Windows npm-cache permission restriction;
  the authorised retry succeeded without dependency changes.
- Focused suite: **136 passed, 0 failed**. RPA-89, RPA-40, RPA-63, RPA-67,
  application characterisation and Jira field tests.
- Full `npm test`: **360 passed, 0 failed**.
- JavaScript syntax checks: all changed/new JavaScript and preview harnesses
  passed. `git diff --check` passed.
- Final LF/CRLF and RPA-40 preservation run: **48 passed, 0 failed**, after
  restoring Windows line endings and excluding capability notices from print.

RPA-89's 18 tests cover every allowed asset, synthetic private files, encoded and
double-encoded paths, traversal, Windows separators, malformed URLs, unsupported
methods, exact API matching, and denial before body listeners. The isolated
server has a synthetic environment, virtual private files and read/write spies.
Positive nonpilot upload/calibration/framework tests prove the spies exercise
mkdir/write/append paths; pilot requests cause none of them. Configuration flags
in requests cannot enable writes. Provider and Jira traffic are mocked.

A real HTTP instance of the actual route handler serves all bootstrap scripts,
template/rubric/method assets into jsdom and boots the complete form. This is an
automated DOM check, not native-browser evidence. RPA-40 regressions cover the
download payload, restore, replacement, rollback, cancellation, invalid files,
focus, sparse pairs, dormant/custom data, dates and attachment references.

Logs are retained locally under `test/manual/rpa-89-evidence/` and ignored by Git:
`focused-tests.txt`, `full-tests.txt`, `final-preservation-tests.txt`.

The initial full run found two expectations intentionally changed by RPA-89:
always-loaded Google scripts and a combobox role for disabled Jira. Those tests
now verify conditional behaviour. Initial new-test/preview failures from
incomplete test mocks were fixed; the final results above supersede those runs.

## Completed actual in-app browser checks

The actual app and routes ran at `http://127.0.0.1:62923/` using the isolated
preview. This uses synthetic files and mocked scalar AI/framework-match replies;
it makes no real provider calls or private disk writes. It is not a deployment.

- Restored the complex synthetic JSON through the real file chooser. Success
  message appeared; Unicode/multiline text, dates, custom sections, sparse RQ1/
  blank RQ2/RQ3 methods and `Previous study.pdf` were retained.
- Edited the research title to `RPA-89 browser round trip`; reloaded and confirmed
  the edit persisted. The restore button regained focus after restoration.
- Ran Evaluate context; all three mocked results completed. Expanded Background:
  metrics and recommendation remained visible, with calibration actions absent
  and accurate unavailability wording.
- Submitted an invalid typed field in JSON; validation reported failure and kept
  the current title, plan and evaluation details.
- Opened the replacement confirmation for a valid backup and selected Cancel.
  The warning advised backing up the current plan; the cancellation message and
  unchanged plan were verified.
- Inspected desktop (1600px), laptop (1280px) and narrow (390px) views. At 1280px,
  client/document widths were both 1265px; at 1600px both were 1585px. At 390px,
  widths were 375px, then 376px document width after expanding Methodology (1px
  overflow). The native check script is retained below; no broad layout change
  was made for that minor observation.
- Tab moved from Download backup to Restore backup with visible keyboard focus;
  Enter expanded Methodology. No enabled/visible restricted actions were found.

Download backup reached the app's success status, but the in-app tool timed out
waiting for a download event. No corresponding named file was found in Downloads.
This is **not proof of an actual saved JSON download or downloaded-file round
trip**. Clicking Print / Save as PDF did not expose a verifiable print dialog or
PDF. Those checks were handed to Max for Windows Chrome verification below.

Windows Computer Use launched Chrome, then stopped because it could not establish
the current browser URL reliably enough to enforce its policy. No further native
input was sent. **No agent-run Windows Chrome or saved-PDF pass is claimed.**
Max's subsequent manual-test report and screenshots are recorded above.

## Manual check script (Max reports passing at closeout)

Use **Windows Chrome** at **http://127.0.0.1:62923/** for each check. The local
preview is left running. If it is unavailable, open PowerShell in this worktree:

```powershell
node test/manual/rpa-89-fixtures.cjs
$env:RPA_PREVIEW_PORT='62923'
node test/manual/rpa-89-preview.cjs
```

The fixture files already exist at:

```text
C:\Users\Max\.codex\worktrees\0cec\research-plan-app\test\manual\rpa-89-evidence\pilot-input.json
C:\Users\Max\.codex\worktrees\0cec\research-plan-app\test\manual\rpa-89-evidence\invalid.json
```

The preview supports mocked scalar evaluation and framework matching only; use
Evaluate context for the UI check. Keep these checks synthetic. Do not use
`npm start` or another running preview for this ticket's checks.

1. **Actual download → restore → edit → backup, then reload.** At the preview,
   restore `pilot-input.json` (first back up any current plan you need). Select
   Download backup and verify a JSON file actually appears in Chrome Downloads.
   Change the title to `Temporary replacement`, restore the downloaded file and
   accept replacement. Expect the previous title and all values to return,
   including 29 August 2026 Last updated, 30 October 2026 readout, the blank
   second question and its methods, custom sections and Previous study.pdf.
   Change the title to `Returned revision`, download a second backup, reload,
   and restore that second downloaded file. Expect `Returned revision` and the
   same preserved plan data. Evaluate only when deliberately requested; results
   are not in backups. There should be no automatic send or upload.

2. **Cancellation, invalid file, desktop/laptop/narrow and keyboard.** At the same
   preview with the populated plan, run Evaluate context and expand Background.
   Open Restore backup with `pilot-input.json`, then Cancel the replacement
   warning; next try `invalid.json`. Expect both to retain the current writing
   and existing evaluation details. Inspect at ordinary desktop width, then use
   Chrome DevTools Responsive mode at 1280px and 390px. Expand every section;
   inspect reference cells and tables, and use Tab/Shift+Tab/Enter for toolbar,
   help and accordion controls. Expect usable controls, visible focus, readable
   wording and preserved table/paired-row positions; calibration Save/Like/
   Dislike, uploads, Add-framework and integration actions must be unavailable.
   Jira remains an editable manual value. Flag any meaningful clipping or
   horizontal overflow, particularly the minor narrow-width observation above.

3. **Native Print / Save as PDF.** At the same preview after check 1, open
   Execution, select Visualise Timeline, then Print / Save as PDF. Inspect every
   print-preview page; save the PDF locally and reopen it. Expect readable plan
   text, dates, paired rows, reference filename, custom sections and timeline
   cells without clipped content. Toolbar, backup help and capability notices
   must not appear. Confirm the app still contains the same writing after
   cancelling/closing print. Report preview and saved-PDF results separately.

## Review and Gustavo handoff (not sent)

The review covers the exact public asset map, `RPA_PILOT_MODE=true` contract,
capability UI and backup help. With Max's manual acceptance, the recommendation
is to merge these scoped restrictions after green CI. The absent/false flag
intentionally retains nonpilot features; Gustavo must verify the running
configuration.

Set `RPA_PILOT_MODE=true` in the host environment, run `node server.js`, and
restart/redeploy. Verify `/api/config` on every exposed origin reports pilot true
and all five capabilities false, with no Google keys. Direct write/proxy requests
must be denied and synthetic private files inaccessible, including after restart,
redeploy and rollback. See README for the full deployment checks. RPA-1 still
requires invited access, bounded AI use, appropriate logs and persistence/deletion
proof for every enabled record. RPA-89 is not deployment approval.
