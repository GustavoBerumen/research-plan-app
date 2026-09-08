# RPA-40 — local implementation and validation

## State

- Worktree: `C:\Users\Max\.codex\worktrees\18eb\research-plan-app`
- Branch: `codex/rpa-40-plan-backups`
- Base: freshly fetched `origin/main`, `6fadfe54a50da081c1c713670600a1d4b78fe3ce` (PR #45 / RPA-78).
- Rechecked 8 September 2026: RPA-40 Ready / Medium / unassigned; RPA-78 Done. GitHub returned no open PRs, and the only remote branch was main. No existing RPA-40 local branch was present before this branch was created.
- Max confirmed the remaining manual tests passed and authorised ticket closeout and merge into main on 8 September 2026. The PR and Jira record carry the final CI and merge evidence.
- `.env`, credentials, dependencies/lockfile, unrelated worktrees, and previews on 8953/8954 were preserved. The preview and tests do not load `.env` or call live providers.

## Delivered behaviour

- Toolbar actions download a genuine JSON draft v7 and select a local backup file. Help explains browser-draft deletion, backup versus document exports/calibration/submission, and recovery limitations. Status/error text uses a persistent live region; controls and help are excluded from print.
- Download collects current controls before the autosave debounce. It reads complete buffered date segments without editing the form. An incomplete date produces an explicit error asking the user to complete or clear it. Filenames include the research title and date, with an untitled fallback.
- The existing draft model and migrations remain authoritative. Dormant map entries, sparse Question/Outcome positions, Methods, tables, custom sections, Other values, prefill markers, timeline visibility, creation date and manual Last updated state are retained. Recovered dormant data remains available in memory if storage access subsequently fails.
- Restore validates nested types, supported versions 1–7 (including unversioned v1), metadata and safe keys. Existing renamed-field migrations are reused; conflicting aliases, unknown shape, unsupported options, mismatched table layouts and orphaned Methods are rejected. Import/export report files over 15 MB or arrays beyond the existing 500-entry restoration guard explicitly.
- After confirmation for authored content, restore builds a fresh form, verifies that supplied values can be represented, and saves the complete replacement in one storage write. It retains the original DOM and runtime references until that write succeeds. Failures restore those same original controls and feedback; old autosave work stays valid on failure and is cancelled on success. Successful replacement resets evaluation work and aborts old requests; late results cannot attach to the imported plan. The fresh form prevents surplus old rows or dormant data from leaking into the replacement.
- Existing migration/default behaviour still supplies missing timeline date anchors. Methods question labels are recomputed from the positional Questions, as in browser-draft restoration.
- File cells serialise `{t: 'file', v: reference, n: filename}` only. Original attachment bytes and evaluation results are not in a backup; attachment references still depend on the referenced files being available separately.

## Automated validation

- `npm test`: **306/306 passed** on Windows, comprising the 262 baseline tests and 44 focused RPA-40 tests. Full output: `rpa-40-tests.txt`; focused output: `rpa-40-focused.txt`.
- Coverage includes immediate export; a realistic multiline/Unicode round trip; sparse paired rows, multiple Methods, dates, Other values and custom sections; metadata and dormant data; smaller-plan replacement; versions 1–6 migration; repeated import and reload; picker/confirmation/read cancellation; corrupt JSON, nested types, versions, incompatible shapes, read/storage/render failures; pending autosave, editing during file reading, and old evaluation responses. Failed storage also preserves the original in-flight evaluation.
- The full suite includes characterisation, dormant data, paired deletion, timeline/defaults, Last updated, radios, stable field keys, LF/CRLF parsing and evaluation cancellation/retry regressions.
- Syntax checks passed for `app.js`, `server.js`, both new RPA-40 fixture/test files and both new preview/browser scripts. `git diff --check` passed.
- Installed Windows Chrome **152.0.7977.82**, run headlessly through Playwright, passed at **1366×900 and 390×900 CSS pixels**. It used real browser downloads and file inputs via keyboard-triggered actions, parsed the downloaded files, restored over another plan, repeated the same import, and verified reload equality. It also checked confirmation cancellation, corrupt JSON, focus after success, live-region markup, no page overflow, print exclusions, and zero backup POST requests. There were no page errors or external requests.
- Browser runner: `rpa-40-browser.cjs`. Evidence, actual downloaded JSON, screenshots and result data: `rpa-40-evidence/`. This browser automation uses file-chooser interception; it does not operate the Windows Open dialog.

## Agent-observed and user-reported evidence

- Inspected the desktop and 390px screenshots. The narrow toolbar was tightened to two button rows; labels and help remained readable and within the viewport.
- Attempted a visible Windows Chrome check through Computer Use. Chrome opened, but the tool stopped because it could not determine the current browser URL confidently enough to enforce policy. No native file-picker interaction was completed, so that is not a pass.
- Max reported that the RPA-40 manual tests passed on 8 September 2026, after clarification of the narrow-window keyboard check. This is user-reported acceptance, separate from the agent's browser automation and the incomplete Computer Use attempt.

## Working preview

The deterministic preview is running at **http://127.0.0.1:8955/**. Its top banner offers realistic and smaller sample JSON files. Reload preserves the preview's draft. Evaluation responses are simulated; attachment references in the fixtures are examples, not actual uploaded files.

If the preview stops, restart it from PowerShell:

```powershell
Set-Location 'C:\Users\Max\.codex\worktrees\18eb\research-plan-app'
$env:PORT = '8955'
node .\test\manual\rpa-40-preview.cjs
```

Keep that terminal running. Open **http://127.0.0.1:8955/**. Do not start a second server while this one is still listening on 8955.

To repeat the browser automation using the installed bundled runtime:

```powershell
node .\test\manual\rpa-40-browser.cjs 'C:\Users\Max\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\playwright' http://127.0.0.1:8955
```

## Completed manual tests (reported by Max)

1. In visible Windows Chrome, use the native Open dialog to restore the realistic sample. Edit the title and download immediately. Restore the smaller sample, then restore the file you just downloaded and reload. Confirm the edit, sparse rows, Methods, dates and additional sections return. Confirm the browser's downloaded file has a sensible `.json` filename.
2. With unsaved writing present, trigger Restore using the keyboard and cancel both the file picker and, on another attempt, the replacement confirmation. Confirm the writing stays intact. Repeat the keyboard flow in a narrow window of about 390 CSS pixels and check visible focus and readable controls/status text.

The automated equivalents above pass, and Max confirmed the listed manual checks passed. No manual tests remain for RPA-40.
