# RPA-53 local review

Branch: `codex/rpa-53-timeline-visibility-persistence`

Dedicated managed worktree: `C:\Users\Max\.codex\worktrees\05ea\research-plan-app`

Freshly fetched base on 7 September 2026:
`99eff1736bd824d6d4a6abe8917b778be620946e` (`origin/main`, RPA-34 / PR #30 merge).
Before implementation, the live ticket was Ready and assigned to Max Spiegel;
GitHub PR search and remote/local branch checks found no RPA-53 match.
The applicable ancestor AGENTS.md was empty; ADR 001 was read, including its
approved RPA-34 two-section evaluation decision.

## Change

- Draft version 7 stores `ui.timelineVisible`. Earlier versions migrate to
  hidden; missing or non-boolean preferences also restore hidden.
- The toggle schedules autosave explicitly. Restoration renders the chart only
  after saved rows and dates have loaded. Confirmed reset clears the choice,
  chart and button; cancellation retains them.
- Draft collection reads the user's choice independently of the chart's
  temporary print visibility. The existing print handlers still refresh the
  chart and restore its previous screen state.
- UI state is excluded from the authored-content signature. The restored
  baseline includes dormant answers using the same existing carry-forward path
  as autosave, preventing an older draft's first toggle from re-dating the plan.
- Timeline rendering, date constraints, layout, autosizing and evaluation logic
  are unchanged. No .env or credentials were read, copied or modified.

## Validation

- Full `npm test`: **117/117 passed**, including **10 RPA-53 tests**.
- Focused tests cover visible/hidden reloads, toggle-only saves, current-version
  serialization, old-draft fallback, exact row/date retention, dormant content,
  Last updated, confirmed/cancelled reset, date refresh and existing completion
  constraints, unavailable storage, repeated print events, both screen states,
  and pending autosaves during temporary print visibility.
- Relevant JavaScript syntax checks and `git diff --check` passed.
- Windows in-app browser tested at **1366 x 900** and **390 x 844**: Enter/Space
  toggles, visible/hidden reloads, date editing and chart refresh, cancelled
  reset, confirmed reset and reload. Native reset dialogs required Windows
  control because browser automation timed out while the modal was open.
- Max's manual review on 7 September 2026: "the print preview tends to lump
  boxes together but all other tests pass." His Windows print-preview
  screenshot shows the Planning and Recruitment chart rows, dates and week
  markers, with Microsoft Print to PDF selected. Native preview inclusion is
  therefore confirmed by user-supplied evidence; the agent's in-app browser
  had not opened a native preview. Actual saved PDF output was not supplied.
- Print-layout observation: chart day-cell boundaries appear uneven, with
  adjacent cells visually merging. Cause and baseline comparison have not been
  investigated. This is recorded separately from visibility persistence;
  print-layout changes remain outside this ticket's scope.
  Follow-up: [RPA-66](https://turingtestable.atlassian.net/browse/RPA-66),
  Keep Stage Timeline day cells distinct in print preview and PDF.
- Existing narrow date controls wrap vertically at 390 px. No CSS/layout changes
  were made for this ticket.

## Offline preview

Running at **http://127.0.0.1:8936/**. Port 8936 was free when this process bound;
the fetched `/app.js` was compared exactly with this worktree's file.
The banner identifies RPA-53 and the 05ea worktree. Feedback is mocked, external
scripts are removed, and no backend, credentials or paid APIs are used.

Open the running URL directly. Run the command below only if the preview has
stopped; starting a second instance while it is running causes EADDRINUSE.

Start/restart from this worktree:

```powershell
Set-Location 'C:\Users\Max\.codex\worktrees\05ea\research-plan-app'
node test/manual/rpa-53-preview.cjs
```

## Review checklist

1. Open Execution, enter timeline dates, show the chart, wait at least half a
   second for autosave, then reload. Expect Hide Timeline and the same dates.
2. Hide it with Space, wait for autosave, then reload. Expect Visualize Timeline.
3. Cancel Clear Form and verify preservation; confirm it and verify a hidden,
   empty chart after reload.
4. In a normal Windows browser, print/save a PDF from both visible and hidden
   states. Check the latest chart in the PDF and the original screen choice
   after closing printing and reloading.

Max approved publication, merge and ticket closeout on 7 September 2026 after
manual review. The print-cell issue is tracked separately in RPA-66. Refer to
the linked GitHub PR and Jira ticket for the final merge and workflow status.
