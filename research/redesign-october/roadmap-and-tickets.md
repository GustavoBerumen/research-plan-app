# Research Plan App — October redesign: roadmap, tickets and plan of action

Synthesised 13 October 2026 from the Re-design-October tab (Alignment, Unprioritised Suggested Changes, Fields Verdicts), the Miro board, and the code at `cc5c1fc`.

**57 tickets, six epics, seven phases.** Every technical scope line below was checked against the repo.

**Checked again 13 October 2026:** `main` has moved on. Max merged PR #137 for RPA-166, so `origin/main` is `b906cd6` and the service header is no longer sticky — `.site-header` is `position:static`, `--site-header-h` publishes `0px`, and decision record 001 carries a fourth "Resolved since" block recording it. Where that changes a ticket, the ticket says so. A local checkout at `cc5c1fc` does not have it.

---

## How to read this

- **Fields Verdicts is authoritative** for what each field becomes, **except where a 13 October decision overrides it** — see "Decisions taken". Two overrides exist so far: the per-approach scope changes where Methods, Participant criteria and Sample Size are asked, and dropping section-level evaluation overrides anything that implies a section keeps an Evaluate button. The one conflict between them is settled: the verdicts put Participant criteria under Execution, and Gus decided on 13 October that it goes on the approach page with Methods and Sample Size instead. Where an Unprioritised item restated a field decision, it has been folded in rather than listed twice.
- **Unprioritised items that are cross-cutting** (banners, help, titles, guardrails, identity) survive as their own tickets.
- Tickets are **User Story / Acceptance Criteria / Technical Scope**, as asked. Acceptance criteria are outcomes a test could check.
- `dependsOn` names the ticket that must land first. `openQuestion` is for Gus or Max and nobody else.
- **Phase 0 is in Jira** under epic RPA-167 (RPA-168 to RPA-173, keys stamped on each ticket below). The other 51 tickets are drafts and are not raised.
- **Seven questions were answered on 13 October 2026.** See "Decisions taken" before the open-decisions list at the end. Each decision is also recorded on the ticket it affects, as a **Decided by Gus** note where the open question used to be.

## What the repo told us that the documents did not

Four findings from grounding the tickets in the code. All four change the plan:

1. **`submission-contract.js` blocks the cut in two places, and the second one throws.** The required-key lists hard-require seven of the cut keys, so they must be loosened before any field goes dormant or every new plan fails validation in `pretest`. Beneath them sits a structural pass (lines 224-245) that runs first and does not report at all: `array(plan.studies, …)` and `choice(plan.selects.studyCount)` call `bad()`, which throws `Invalid submission structure`, and `plan.version !== 11` rejects a bumped version outright. A plan without the cut keys therefore raises an exception rather than returning errors, so `validate()` never returns a list to inspect. Both passes have to move in the same commit. This sets the order of Phase 1.
2. **The existing field audit has already drifted.** `python3 research/field-audit-gen.py` exits 1 on main today: eight fields the template asks have no audit row, and nine audit rows describe fields the template no longer has. The eight unaudited fields are precisely the ones October rules on. The drift checker exists, says in its own docstring it is for CI, and is wired into nothing.
3. **Decision record 001 is stale in ways beyond the one we knew.** It describes seven sections including Alignment and Feedback, which the template no longer has; it lists Hypothesis as evaluable, dormant since RPA-117; and it decided a persistent always-visible outline that was never built.
4. **A `Good:` / `Bad:` example panel already exists** in the template machinery, wired into four renderers and used by zero fields. The "clear examples" item needs no engineering.

## De-duplication map

Every Unprioritised Suggested Change, and where it went.

| Source item | Where it landed |
| --- | --- |
| Banner position / bottom banner content | E3 — "Cut the footer back to what a person needs on arrival". The overlap itself is already fixed: Max took the service bar and BETA banner out of sticky positioning in RPA-166, merged 7 October, so they scroll away with the page. What is left here is the footer's content, not its position. RPA-165 holds the one navigation gap still open. |
| [PDWR] Define what needs to be asked and when | Fully absorbed by Fields Verdicts → E2. The verdicts ARE this item, decided. |
| [PDWR] Dates configuration | E4 — three date tickets plus one bug. |
| Redefine evaluation | E6. Half already built by RPA-162 for Context; what remains is Research plus the refinement slice. |
| Align guidance with scoring metrics | E6 — one ticket, almost entirely template and rubric content. |
| UI and Visual Redesign | Phase 6, not drafted. See the note there. |
| Cleaner version to add additional information | E3 — "Make Additional information read as one quiet hatch". |
| Help information | E3 — the help-note pattern ticket gates four rewrites behind it. |
| Consistency in participant-facing information | E3 — "Call each section the same thing in the form and in the downloaded document". |
| Update field titles / Define section title placement | E3 — two tickets, both held until after the cut. |
| Split Questions and Deliverables | E4 — two tickets. Undoes PAGE_PAIRS, built deliberately under RPA-108/122; the ticket says so. |
| Investigating the best approach (new page) | E4 — "Ask how the research questions will be answered". Same item as Fields Verdicts "Ways to find info / new page". |
| Remove — Number of studies | E4 — "Retire the Studies section". Same as Fields Verdicts implied cut of Study questions and Number of studies. |
| Guardrails for incomplete user input | E6 — drafted as a DECISION, not a build. It contradicts decision 001 in terms. |
| [SWR] Suggest methods / proactive | E4 — two tickets. |
| [SWR] Reorganise participants and studies | E4 — "Ask for participants once, on the approach page". Same as Fields Verdicts Participant criteria / change, except for the placement: Gus decided on 13 October that it goes on the approach page rather than under Execution. The drag-and-drop mapping falls away with studies. |
| [SWR] Remove Suggest Method button from Participants | E4 — filed as a bug. |
| [SWR] Remove numbering from participant points | E3 — "Take the participant bands out of the Sample Size help note". |
| [SWR] Review research method descriptions | E3 — "Rewrite the Methods help note to name families of methods". |
| [SWR] Planned Schedule + timeline bug | E4 — three tickets. |
| [SOWR] all five items | E5 — seven tickets. |
| Find a better location for feedback | E5 — "Move Give feedback into the options menu". |
| Easily Accessible Mission Statement | E1 — MISSION.md plus CLAUDE.md so AI sessions load it. |

## Prioritised roadmap

### Phase 0 — Write it down before building — 6 tickets

Nothing in the repo says what this app is for. 57 tickets of change on top of that is how a redesign loses its reasons. Everything here is Markdown; none of it touches the app.

### Phase 1 — Unblock the cut — 10 tickets

**Changed 13 October:** E4.5, the approach page, joins this phase from Phase 3. Methods, Participant criteria and Sample Size are now asked against the approach answer, so the page that asks for it has to exist before E2.8 retires Studies. It is a template edit plus the contract's Other validation, so moving it early costs little.

Three things in code are keyed to the old structure and will NOT follow a template edit: submission-contract.js hard-requires seven of the cut keys, the tests list sections and fields explicitly, and evaluationSections is keyed by section slug. The contract must be loosened BEFORE any field goes dormant, or every new plan fails validation in pretest.

### Phase 2 — The cheap wins, in parallel with Phase 1 — 12 tickets

Almost all template. The form says better things without the app doing anything differently. Hold the label rename until the cut has landed — seven of those fields are on the cut list and renaming them is wasted work.

### Phase 3 — The workflow redesigns — 14 tickets

**Changed 13 October:** E4.5 has moved to Phase 1, and E4.6 — which suggests methods from the chosen approach — can follow it there, since answering E4.5's question was its only blocker.

The design-and-build half. Dates first because they are the ceiling everything downstream hangs from, then the new approach page and the suggestions it feeds, then the structural cuts, then the schedule.

### Phase 4 — Sign-off and the ending — 7 tickets

Everything buildable now is browser-local. The half of the link feature needing a hosted plan or hosted Word document is recorded as a decision, not drafted as work.

### Phase 5 — The evaluation model — 8 tickets

**Changed 13 October:** two of these move earlier. Dropping section-level evaluation everywhere means E6.2 (per-answer actions for Research) then E6.3 (delete the section action) must both land before E2.6 renames Context in Phase 2 — otherwise the rename ships a button reading "Evaluate research-details". The rest of the phase stays here.

RPA-162 already did this for Context. What is left is Research, deleting the last section-level action, and the refinement slice behind a reviewed contract.

### Phase 6 — Identity, deliberately last

The UI and visual redesign (handwritten components, custom icons, mascot) means leaving the GOV.UK design system and with it the accessible components, tested error patterns, date inputs, task list and check-answers that the app currently inherits rather than maintains. Not drafted here on purpose: change the flow and the look together and you will never know which one caused a problem.

---

# The tickets


## E1-foundations

Epic 1 — Foundations and documentation

### E1.1 Write the app's mission and principles into the repo as MISSION.md

`Story` · `M` · **RPA-168**

**User story.** As a team member or AI session picking up work on this app, I want its purpose, mission and principles in one versioned file in the repo, so that I can judge whether a proposed change serves the app's reason for existing without asking Gus.

**Acceptance criteria**

- MISSION.md exists at the repo root and states the purpose, the mission, the principle that users know their project but may lack experience writing a plan, and the four ways the app supports users (structured collection, evaluation of input, refining input, suggesting information).
- MISSION.md states the boundary the mission sets: the app is the first step, and the plan is revised and iterated afterwards, in the app or an editable document. A reader can use this to reject scope that belongs after the plan exists.
- README.md links to MISSION.md from its opening description rather than restating the purpose a second time.
- CONTRIBUTING.md names MISSION.md in its "Where decisions live" section and in the Planning session row of the Lanes table, so the one-writer rule covers it.
- research/README.md still reads correctly after the change: its repo-versus-Drive rule accounts for where the mission statement lives.
- There is one current statement of purpose in the repo, not two: "Research Plan App Ideas.md" either points forward to MISSION.md or is marked superseded.
- No file outside documentation changes, and the test suite passes unchanged.

**Technical scope**

- New MISSION.md at the repo root. There is no mission or principles document in the repo today; root level is where this repo already keeps team-facing docs (README.md, CONTRIBUTING.md, DEPLOYMENT.md, FEEDBACK.md, NOTICE.md).
- README.md: the opening two paragraphs already describe the app as built to help product team members, researchers and non-researchers write higher-quality plans with tailored feedback instead of a blank page. Link, do not duplicate.
- CONTRIBUTING.md: the Lanes table at line 23 lists the files the planning session owns (Jira, research/decisions/, research/field-audit.md, README.md, this file); "Where decisions live" near line 118 lists research/decisions/ and research/field-audit.md. Both need MISSION.md adding.
- research/README.md: its "What goes where" table is the rule that licenses this file — things we wrote live in the repo, things we collected live in Drive. Its Layout block lists the research/ tree.
- "Research Plan App Ideas.md" (27 July 2026) carries an earlier Purpose / Problem / Task statement. It is the ancestor of this document and reads as a personal concept note, so supersede it rather than editing it into shape.
- Documentation only: no change to app.js, server.js, style.css, index.html, research-plan-template.md or test/.

*Source: USC: "Easily Accessible App Mission Statement and Principles [Major Ticket]"; Alignment section (purpose, mission, guiding principle, how the app supports users)*

> **Decided by Gus, 13 October 2026:** MISSION.md is the **canonical** statement of purpose and principles. The external Doc becomes a drafting surface, and where the two disagree, MISSION.md wins. research/README.md's no-mirror rule therefore needs an explicit, written exception for this one file saying why it lives here — without it, the next reader applies the rule and deletes the thing it is meant to protect. Add that to this ticket's acceptance criteria when the branch opens.

### E1.2 Add CLAUDE.md so agent sessions load the mission and the decision records

`Task` · `S` · depends on **Write the app's mission and principles into the repo as MISSION.md** · **RPA-169**

**User story.** As an AI session starting work in this repo, I want the mission, the decision records and the schema-driven rule loaded at session start, so that I act on the reasons behind past decisions instead of rediscovering or contradicting them.

**Acceptance criteria**

- CLAUDE.md exists at the repo root and points to MISSION.md, research/decisions/, research/field-audit.md and CONTRIBUTING.md.
- CLAUDE.md states the schema-driven rule: research-plan-template.md defines every section, field, question, hint, error and help note, and the app parses it at page load, so cutting a field, rewording a question, changing a hint or reordering fields is a template edit and not a code change.
- CLAUDE.md states how the suite is run and that a new test file must be added to the test script in package.json, which lists every test file explicitly.
- CLAUDE.md points rather than paraphrases: it duplicates no reasoning that CONTRIBUTING.md or ADR 001 already carries, and stays short enough to be read in full at session start.
- A fresh session asked "why does this app exist, and what are we allowed to cut?" can answer from loaded context without opening the Google Doc.

**Technical scope**

- New CLAUDE.md at the repo root. There is none today: .claude/ holds only launch.json and settings.local.json, so no project context loads automatically and CONTRIBUTING.md is the de facto agent brief without ever being loaded as one.
- Point to CONTRIBUTING.md for the two-session rules it already documents (one writer per file, worktrees, getting the Jira key before opening the PR, merge rather than squash) instead of restating them.
- Name research-plan-template.md and its schema doc-comment — the block at the top of the file ending at the first line that is exactly "-->" — as the form's source of truth for field types and flags.
- Tests: CONTRIBUTING.md's Tests section and the "test" script in package.json are the authority on how the suite runs; CI runs it from .github/workflows/test.yml on pull_request.
- Documentation only.

*Source: USC: "Easily Accessible App Mission Statement and Principles [Major Ticket]" — the "accessible to all team members and collaborators INCLUDING AI" half of the item*

### E1.3 Record the new page and section model as decision record 002

`Story` · `M` · **RPA-170**

**User story.** As someone implementing the redesign, I want the new section and page model written down as a numbered decision record, so that every field ticket that follows cites one agreed structure instead of re-deciding where a question lives.

**Acceptance criteria**

- research/decisions/002-*.md exists, follows 001's shape (context, decision, the rejected alternative and why, consequences), and is marked Accepted with a date.
- The record maps the new section set onto the section headings research-plan-template.md has today, so a reader can tell for each heading whether it is renamed, merged, split or removed.
- The record states the page rule — one question per page, with pairing as the declared exception — and names where that pairing is declared in code.
- The record states which pages are new and which existing page splits, and records that a deliverable is no longer asked for every research question.
- The record carries the two consequences that bite implementation: that rewording a question can move a field's storage key, and that a cut field is commented out reversibly rather than deleted.
- The record says what it supersedes in 001 and what 001 still governs, in particular that assessment stays advisory and nothing gates forward movement.
- Nothing in the form changes: research-plan-template.md, app.js and test/ are untouched, and the test suite passes unchanged.

**Technical scope**

- New research/decisions/002-page-and-section-model.md. research/decisions/ holds only 001-layout-and-navigation.md, which sets the house style: Context, Decision, a "Why not ..." section recording the rejected alternative, "What counts as" definitions, Consequences, then dated "Resolved since: ..." sections and Open questions at the end.
- Ground the mapping in the template's real headings. research-plan-template.md has six sections — Context (line 254), Research (290), Studies (333), Methodology (356), Execution (414), Review (473) — plus "# Research title" (line 170), which the schema treats as the document title field rather than a section, and "Email address" above it, which is asked on a page of its own standing in front of every step (RPA-99). October's six groups do not map one-to-one onto these, and this record is where that mapping is fixed.
- The page-pairing exception is PAGE_PAIRS in app.js (line 7954), today [['researchQuestions', 'outcomes']], consumed at app.js:7983. Merging Objective into Research Questions and splitting Deliverables off both land here, so the record should name it as the single place pairing is declared.
- Consequence to record, keys: toCamelKey (app.js:106) derives a field's storage key from its label, which is why every field now declares key= in the template. test/rpa-55-field-key-contract.test.js scans app.js for keys looked up by name and asserts each renders; migrateDraft (app.js:8465) carries drafts saved under an old key. Table columns still derive their keys from their headings (RPA-74). research/field-audit.md records this under "Open question this audit created", with the note that an audit about rewording and removing questions is the most likely thing to trigger it.
- Consequence to record, cuts: the RPA-117 pattern is the agreed reversible removal. research-plan-template.md comments the field lines out with a dated note saying why and how to restore (Hypothesis, lines 302-306; Theory and Action Points, 358-362 and 428-432), carryUnrendered (app.js:8370) carries older drafts' values through untouched, and test/rpa-117-dormant-theory-actions.test.js and test/dormant-data.test.js hold it.
- research/README.md: add 002 to the Layout block so it is discoverable alongside 001.

*Source: Fields Verdicts: the streamlined page list and the section-by-section redesign (Objective MERGE, Ways to find info NEW PAGE, Deliverables SPLIT PAGE, the two Declaration rows merged onto the previous page); Epic 1 scope note that the new section and page model is the decision everything else depends on*

> **Decided by Gus, 13 October 2026:** the six sections, in this order, are **Entry, Research Details, Research, Studies, Execution, Review**. Context becomes Research Details and takes the Project decision field with it; Methodology dissolves, its Methods going to Studies and its Participant criteria and Sample Size to Execution per the verdicts; no Methodology heading survives. This is the list every later ticket cites, and 002 is now clear to be written.
>
> 002 must also record the other decisions of the same day, because they are structural rather than cosmetic: that Methods, Participant criteria and Sample Size are asked once against a single per-plan approach answer (E4.5, E2.8), and that section-level evaluation is dropped everywhere in favour of RPA-162's per-answer action (E2.6, E6.3). A record that fixes the section names but leaves those two unstated would be re-opened within a week.

### E1.4 Amend decision record 001 where the field audit overturned it

`Task` · `S` · depends on **Transcribe the October field verdicts into research/field-audit.md as a second pass** · **RPA-171**

**User story.** As someone reading 001 to understand why the app is shaped the way it is, I want its out-of-date claims corrected in place, so that I do not plan work from an assumption the field audit has already disproved.

**Acceptance criteria**

- 001 carries a new dated section appended in the style of its existing "Resolved since: ..." blocks, rather than being rewritten in place or replaced by a new record.
- The amendment quotes the sentence that scoped deletion out of the audit, states that it no longer holds, and says what overturned it.
- The amendment corrects 001's section count and section names against the template as it stands.
- The amendment records that the persistent always-visible outline 001 decided was never built, and names what shipped instead, without re-deciding it.
- The amendment corrects the claim that Hypothesis is an evaluable Research field.
- The amendment states which of 001's decisions survive untouched — the rejection of hard forward-locks, and evaluation never blocking movement between sections — so later tickets do not reopen them.
- 001's "Open questions" section still reads correctly after the amendment, and the file remains the one record for layout and navigation.

**Technical scope**

- research/decisions/001-layout-and-navigation.md, appending a dated section. The file already carries four such blocks — "Resolved since: evaluation staleness (RPA-39)", "Resolved since: section evaluation actions (RPA-34)", "Resolved since: Context assessment beside each answer (5 October 2026)" and "Resolved since: the header scrolls with the page (7 October 2026)", which RPA-166 added — so amendment by appending is the established pattern and nothing needs renumbering.
- The sentence to overturn, in 001's Context: "A separate question was whether to cut fields. The current fields are considered essential, so the field audit is scoped to sequencing and optionality rather than deletion." research/field-audit.md bet the same way under "Open question this audit inherits" (line 537), saying the win would come from sequencing and optionality rather than deletion and that a sheet full of keep was a legitimate outcome. The October pass settles it the other way.
- Section count: 001 decides an outline of "all seven sections" and names Alignment, Methodology, Execution and Feedback among them. research-plan-template.md now has six section headings and neither Alignment nor Feedback is one of them — the comment at template line 468 records that Alignment became the review step, and research/field-audit.md records Feedback as moved into it.
- The outline: 001 decided a persistent outline of all sections, always visible, each showing its status. What exists is a separate task-list screen (test/rpa-100-task-list.test.js, test/rpa-101-one-section-at-a-time.test.js). Record what shipped; the model itself belongs to 002.
- Hypothesis: 001 lists it among Research's evaluable fields. It is commented out of research-plan-template.md at line 305, dormant since RPA-117.
- Leave 001's forward-lock reasoning standing and cite it — "The gate does not produce thinking; it produces filler that satisfies the gate" — as the reason the redesign keeps assessment advisory. RPA-162's "Continue and return later" is the current expression of it.
- Documentation only.

*Source: Epic 1 scope note: 001 must be amended because it assumed the current fields were essential and scoped deletion out, and the audit tested that assumption and it did not hold; Fields Verdicts (32 fields cut to 16)*

### E1.5 Transcribe the October field verdicts into research/field-audit.md as a second pass

`Story` · `M` · **RPA-172**

**User story.** As someone implementing or reviewing a field cut, I want October's verdict for every field recorded in the repo beside the RPA-55 verdict it replaces, so that the evidence for cutting 16 questions is reviewable in a pull request instead of living in Miro.

**Acceptance criteria**

- research/field-audit.md records an October verdict for every field the Fields Verdicts sheet rules on, including the implied cuts, so no field is cut later with no written reason.
- The RPA-55 verdicts remain readable beside the October ones. The second pass is additive, so the change of mind is visible rather than overwritten.
- python3 research/field-audit-gen.py exits 0 and reports no drift. It exits 1 today, with 8 fields missing from the audit and 9 stale rows.
- The eight fields the template asks but the audit never covered each have a row: Project name, Other researchers, Researcher names, Study questions, Number of studies, Participant criteria, Declaration: Lead researcher and Declaration: Project requester. Each carries October's one-line reasoning from the details-change column in place of answers to the three protocol questions, and is **marked as inherited**, so no reader mistakes it for a row that went through the protocol. The tables have five columns per field, so a row that simply exists leaves three of them for someone to invent or leave blank.
- The nine stale rows are reconciled rather than deleted: fields that are dormant appear in the "Already dormant" table, and fields removed from the template say which ticket removed them.
- The scoreboard and the status line reflect the October pass, and the file no longer claims the audit is complete at 31 verdicts.
- The file records that the October pass used the same Jarrett and Gaffney question protocol and reached the opposite conclusion to the first pass about deletion.

**Technical scope**

- research/field-audit.md (580 lines). Per-section tables use the columns Field | Type | Why do we need it? | Who has the answer? | Able and willing? | Verdict. The Scoreboard is at line 65, "Already dormant" at line 491, and "Open question this audit inherits" at line 537 is the claim this pass reverses.
- The verdicts must go in this file, not a new one. research/field-audit-gen.py hardcodes AUDIT = "research/field-audit.md" and recognises an audit row by the AUDIT_ROW regex — a bold label followed by a backticked type cell. Verdicts recorded anywhere else leave the drift check failing.
- Verify with python3 research/field-audit-gen.py in its default check mode. Do not run --write: it regenerates a blank scaffold and refuses to overwrite without --force precisely because the verdicts in the file are hand-written and cannot be regenerated.
- Row granularity is enforced by audited_labels() in research/field-audit-gen.py: a fixed-column table is audited one row per column, while a table declared editable-headers stays a single row. Planned Schedule therefore needs a row per column, which matters because October's verdict on it is CHANGE rather than a cut.
- Why the nine rows are stale: Hypothesis, Theory and the three Action Points columns are commented out of research-plan-template.md (RPA-117, lines 302-306, 358-362, 428-432), so parse_template() reads them as dormant rather than live; Characteristics, User Groups, Feedback and Jira Project are no longer in the template at all. Worth a note that October's "Ways to find info" page reintroduces the participants-and-characteristics split the first two rows once covered.
- research/README.md's "What goes where" table is the rule that puts this in the repo: things we wrote are diffable, reviewable in a PR and versioned next to the code they justify, while collected material stays in Drive.
- Documentation only. research-plan-template.md is not edited here — changing the template to match the verdicts is the implementation epics' work, and doing it in this ticket would move the drift rather than close it.

*Source: Epic 1 scope note: the field audit itself transcribed from Miro into the repo as versioned evidence; Fields Verdicts (every row, plus the implied cuts: Project name, Lead researcher, Other researchers, Researcher names, Project requester, Study questions, Number of studies, and the two Sign-off initial fields)*

> **Decided by Gus, 13 October 2026:** the eight fields **inherit October's one-line reasoning** from the details-change column. The three protocol questions are deliberately not re-run for them. The audit should say so in as many words, so that a later reader can tell a deliberate shortcut from an oversight — and so the two Declaration fields, which October marks CHANGE rather than cut, are not read as having been through the full protocol.

### E1.6 Run the field-audit drift check in CI

`Task` · `S` · depends on **Transcribe the October field verdicts into research/field-audit.md as a second pass** · **RPA-173**

**User story.** As a reviewer, I want a pull request that changes the form's fields to fail if the field audit no longer matches the template, so that the audit stays usable evidence instead of going stale silently as it already has once.

**Acceptance criteria**

- A pull request that adds, removes or renames a field in research-plan-template.md fails CI while research/field-audit.md still describes the old field set.
- The failure output names the offending fields and distinguishes a field missing from the audit from a stale audit row, as the existing check already does.
- The check runs on every pull request through the existing workflow, and passes on main at the point this lands.
- If a test file is added, it is listed in the test script in package.json, so it actually runs.
- The check only reports: it cannot regenerate, rewrite or repair the audit.

**Technical scope**

- research/field-audit-gen.py already implements this check and exits non-zero on drift — its docstring says it is so CI can fail on it — but nothing calls it. It appears only in prose, in research/README.md and in CONTRIBUTING.md near line 118; it is in no npm script, no test file and no workflow.
- Verified on main at 13 October 2026: the check exits 1 with 8 missing and 9 stale. So this ticket must land after the audit is back in step, or CI goes red on every pull request.
- .github/workflows/test.yml runs on pull_request with actions/setup-node at node 24, then npm ci and npm test. There is no Python step in the job today.
- Two routes. Either add a step to .github/workflows/test.yml running python3 research/field-audit-gen.py, or add a test under test/ that shells out to it — in which case add the file to the "test" script in package.json, which lists every test file explicitly. CONTRIBUTING.md warns that package.json is a frequent cross-session conflict, so claim it for the duration.
- No app behaviour change: the only files touched are .github/workflows/test.yml and, on the second route, package.json plus one new test file.

*Source: Epic 1 scope note: the field audit in the repo as versioned evidence; observed drift on main (8 missing, 9 stale) and the fact that the existing checker is wired into nothing*

> **Needs Gus or Max:** A Python step in a Node CI job makes the suite depend on the runner's python3, and the repo has no other Python in its test path. Does Max want the check ported to Node so the suite stays single-language, or is a python3 step acceptable?


## E2-the-cut

Epic 2 — The cut: fields and sections. 32 declared fields down to 16, and seven sections (Plan details, Context, Research, Studies, Methodology, Execution, Review) down to six (Entry, Research Details, Research, Studies, Execution, Review). Most of the cutting is an edit to research-plan-template.md, which app.js parses at load via parseSchema (app.js:281) — but three things in code are keyed to the old structure and will not follow a template edit on their own: evaluationSections in app.js (line 1671, keyed by section slug), the SECTION/FIELDS/LABEL maps and required-key lists in submission-contract.js (lines 20-26, 172, 273), and the explicit section and field lists in the test suite. Order matters: the submission contract hard-requires seven of the cut keys, so it has to be loosened before any field goes dormant or every new plan fails validation in pretest.

### E2.1 Record the field cut as decision 003 and settle the fields the verdicts do not name

`Task` · `S`

**User story.** As Gus, I want the 32-to-16 field cut written down as a decision record with its open questions resolved, so that Max and an AI session both read the same inventory instead of re-deriving it from a Google Doc.

**Acceptance criteria**

- research/decisions/002-*.md exists and follows 001's shape: a dated Status, a Context section, a Decision section
- The record lists every one of the 32 field lines currently declared in research-plan-template.md and marks each KEEP, CHANGE, MERGE, INFER, NEW or CUT
- The record states explicitly what happens to Goal, Sample Size, Research readout, Last updated and the four 'Additional information' hatches, which the Fields Verdicts table does not name
- The record says where the lead researcher's and project requester's names come from once their header fields are cut, since plan-workflow.js needs both to address a sign-off
- The record states that decision 001's scope line — the field audit being 'scoped to sequencing and optionality rather than deletion' — is superseded, and why
- No template, app.js or test file changes in this ticket

**Technical scope**

- New file research/decisions/**003**-the-field-cut.md, following the Context / Decision / Status headings of research/decisions/001-layout-and-navigation.md. **002 is taken** by E1.3's page-and-section model; two records cannot share a number, and four tickets in this document were claiming 002 before this was caught
- Reconcile against the 32 field lines declared in research-plan-template.md: emailAddress, researchTitle, jiraProject, leadResearcher, otherResearchers, researcherNames, projectRequester, projectDecision, researchReadout, lastUpdated, additionalPlanDetails, background, goal, problemStatement, additionalContext, objective, researchQuestions, outcomes, additionalResearch, studyCount, studyQuestions, methods, characteristics, sampleSize, additionalMethodology, stageTimeline, previousKnowledge, additionalResources, declarationResearcher, signOffResearcher, declarationRequester, signOffProjectOwner
- Note the three code-side consumers the record's readers will need: evaluationSections (app.js:1671), submission-contract.js SECTION/FIELDS/LABEL (lines 20-26), plan-workflow.js ROLES (line 31)
- Cite the Alignment statement's purpose and principle rather than restating them

*Source: Alignment (purpose: eliminate non-essential questions; principle: users know their project but may lack experience writing a plan); Fields Verdicts, all 16 rows plus the implied-cut list*

> **Needs Gus or Max:** The verdicts name 16 fields and the implied-cut list covers 9, but the template declares 32 — so Goal, Sample Size, Research readout, Last updated and the four 'Additional information' hatches are unaccounted for. Separately, the Review row says 'we already asked for the name — ask once' while Lead researcher and Project requester are both implied cuts: if the header no longer asks, which page does, and what feeds plan-workflow.js ROLES?

### E2.2 Let the submission contract accept a plan without the cut fields

`Task` · `M` · depends on **Record the field cut as decision 003 and settle the fields the verdicts do not name**

**User story.** As Max, I want the submission contract to validate a plan that no longer carries the cut fields, so that the first field to go dormant does not make every new submission fail validation.

**Acceptance criteria**

- A v2 plan with jiraProject, leadResearcher, projectRequester, goal and objective all blank produces no 'required' errors
- A v2 plan with no studies array, no studyCount select and no otherResearchers select **validates without throwing** and produces no 'choice' or 'pairing' errors. Today it does not merely report: the structural pass throws `Invalid submission structure` before any field is looked at
- A plan sent before this change, carrying all of those keys populated, still validates clean
- A plan that is genuinely incomplete — no research question, no schedule stage — still reports its errors, so the relaxation is scoped to the cut keys only
- Every error still carries a section that exists in the new six-section structure
- node --run test passes, including the pretest pair

**Technical scope**

- **The structural pass is a second gate, and it throws rather than reporting.** Verified at submission-contract.js 224-245: `array(plan.studies, ...)` (line 240) calls `bad()` — `throw new Error('Invalid submission structure')` — when `studies` is absent, because `array` begins `if (!Array.isArray(v) ...) bad()`. `choice(plan.selects.studyCount)` (line 238) throws the same way through `record(v, ['v','o'])` when the select is gone. And `plan.version !== 11` (line 235) rejects any bumped version outright. So loosening only the required-key lists leaves a plan without the cut keys failing with an exception, not an error list, and `validate()` never returns. This pass must be loosened in the same commit
- submission-contract.js: the required-key list in validateV2 (line 273) and the identical list in validateLegacy (line 172) — both currently force researchTitle, jiraProject, leadResearcher, projectRequester, background, goal, problemStatement, objective, signOffResearcher, signOffProjectOwner to be non-blank
- submission-contract.js validateV2: the otherResearchers 'choice' check and researcherNames 'policy' check, and the studyCount / plan.studies expectedCount pairing check
- submission-contract.js: FIELDS (line 20), SECTION (line 25) and LABEL (line 26) — SECTION routes each error to a section slug, so its values are structural, not cosmetic
- Decide between relaxing SCHEMA 'rpa-active-2026-09-17-v2' in place and adding a v3 beside the existing LEGACY_SCHEMA path, which structure() already branches on (line 265)
- test/rpa-151-v2-submission.test.js — listed in package.json's pretest script, so it fails the run before the main test list starts
- test/rpa-64-contract.test.js

*Source: Fields Verdicts implied cuts (Project name, Lead researcher, Other researchers, Researcher names, Project requester, Study questions, Number of studies, the two Sign-off initial fields); Fields Verdicts Research: Objective MERGE*

> **Needs Gus or Max:** Bump SCHEMA to a v3 and keep v2 as a second legacy validator, or relax v2 in place? A bump means three validators to maintain; relaxing in place means the live pilot build and this build disagree about whether the same plan is valid.

### E2.3 Derive the tests' section and field inventory from the template

`Task` · `M`

**User story.** As a developer cutting fields, I want the suite to state the section and field inventory in one place, so that each cut touches one fixture instead of twenty test files.

**Acceptance criteria**

- test/app-harness.js exports the section list and each section's field keys, read from research-plan-template.md rather than written out by hand
- The four test files that currently hardcode the seven section names read them from that export instead
- Renaming a section in the template alone makes the suite pass without editing any test file
- Assertions about a specific section's own wording, counts or page order are left where they are, so this ticket changes no test's meaning
- node --run test passes before and after with the same number of tests

**Technical scope**

- test/app-harness.js: add the inventory beside the existing withFieldUncommented (line 36), withFieldFlag (line 26) and completeStep (line 283) exports; parse the template the way app.js parseSchema (app.js:281) and parseHeading (app.js:274) do, including the leading comment strip and the first-'#'-is-the-title rule
- test/app-characterization.test.js:96 — ['Context', 'Research', 'Studies', 'Methodology', 'Execution']
- test/rpa-101-one-section-at-a-time.test.js:78 — the seven stepTitle values
- test/rpa-100-task-list.test.js:85 — the seven task-list row names
- test/rpa-140-unclaimed-question.test.js:65 and :70 — the seven-key status objects
- Leave completeStep alone: it walks whatever the step renders, so tests that fill a section through it already survive a cut

*Source: Fields Verdicts, the section-by-section redesign column (Plan details/Context/Research/Studies/Methodology/Execution/Review becoming Entry/Research Details/Research/Studies/Execution/Review)*

### E2.4 Make the five header identity fields dormant

`Story` · `M` · depends on **Let the submission contract accept a plan without the cut fields**

**User story.** As a researcher, I want to stop being asked for the project name, who is leading, who else is involved and who requested the work, so that the plan starts with the research rather than with a roll call.

**Acceptance criteria**

- None of jiraProject, leadResearcher, otherResearchers, researcherNames or projectRequester renders anywhere in the form
- A draft saved while those fields were live still holds their values after an edit triggers an autosave
- Uncommenting a field's lines in the template brings it back with its hint, error and help note intact
- The start page no longer tells the person they will need a Jira ticket or the name of whoever asked for the research
- The Entry step's field count and its check page list only the questions that are still asked
- node --run test passes

**Technical scope**

- research-plan-template.md: comment out the Project name, Lead researcher, Other researchers, Researcher names and Project requester field lines together with their indented Hint/Error/Help/Guidance lines, in the HTML-comment style the dormant Theory, Action Points and Hypothesis lines already use
- Each commented line must keep its key= intact: test/app-harness.js withFieldUncommented (line 36) throws 'No dormant field declares key=...' when it cannot find one, so a restorable cut and a testable cut are the same thing
- Add a dated note above the block saying why and how to restore, as the RPA-117 notes at research-plan-template.md do
- app.js renderStartPage: the 'need' list (around app.js:7106) names the Jira ticket and who asked for the research
- No change needed to carryUnrendered (app.js:8370) — it already merges any stored key the form cannot produce, and test/dormant-data.test.js guards that
- Template-only apart from the start page list: parseSchema (app.js:281) strips comments before parsing, so the fields simply stop existing

*Source: Fields Verdicts implied cuts: Project name, Lead researcher, Other researchers, Researcher names, Project requester; Fields Verdicts Entry: Plan details KEEP (decrease amount of text)*

> **Needs Gus or Max:** plan-workflow.js ROLES (line 31) is ['leadResearcher', 'projectRequester'] and the two-party sign-off addresses both by name and email. With both name fields dormant, what names the two parties — the Entry email address, the declaration pages, or something new?

### E2.5 Merge Objective into Research Questions

`Story` · `M` · depends on **Let the submission contract accept a plan without the cut fields**

**User story.** As a researcher, I want one question about what the team needs to learn instead of an objective and then a near-identical set of questions, so that I do not write the same thought twice in different words.

**Acceptance criteria**

- The objective field renders nowhere, and the Research step asks one fewer question
- The Research Questions question and guidance ask for what the team wants to learn, so nothing the Objective field collected is simply lost
- A draft saved with objective text still holds it after an edit triggers an autosave
- Method suggestions still return results with the objective field gone
- No evaluation control offers to assess an objective, and nothing else in Research loses its assessment. Worded to hold in either order, because this ticket sits in Phase 1 and may land before E6.3: while the Research section-level action still exists it continues to cover the questions and deliverables, and once E6.3 removes it, Research Questions and Outcomes carry their own 'Assess this answer' actions instead (Gus, 13 October 2026 — section-level evaluation is dropped everywhere)
- node --run test passes

**Technical scope**

- research-plan-template.md: comment out the Objective field line and its Hint/Error/Help/Guidance, keeping key=objective so test/app-harness.js withFieldUncommented can restore it; rewrite the Research Questions question= and Guidance lines to absorb what the team wants to learn
- app.js evaluationSections (line 1671): drop 'objective' from the research array — that array drives renderSectionEvaluation (line 1715), the staleness branch (line 1996) and the review summary's evalKeys (line 5990)
- research-plan-rubric.md: the '# Objective' block (line 32) loses its field; parseRubric (app.js:398) reads this file and test/rpa-150-rubric-binding.test.js binds rubric to field
- app.js suggestMethods (line 3018) and its caller (line 3187) pass an objective; server.js handleSuggestMethods returns 400 unless payload.objective is a non-empty string, so the client needs another source or the handler needs to accept questions alone
- test/rpa-159-no-matching-method.test.js and test/rpa-150-rubric-binding.test.js are the closest guards on both of those paths

*Source: Fields Verdicts Research: Objective MERGE (simplify flow — Objective and Questions; identify what the team wants to learn); Fields Verdicts Research: Research Questions KEEP (simplify how we ask)*

> **Needs Gus or Max:** Method suggestion is currently driven by objective plus the research questions. Do we send the questions alone, or substitute Background and Problem Statement? The second keeps two inputs but changes what the suggestions are reasoning from.

### E2.6 Restructure the form into Entry, Research Details, Research, Studies, Execution and Review

`Story` · `L` · depends on **Merge Objective into Research Questions**

**User story.** As a researcher, I want the plan to move through six sections that match how the work is thought about, so that I am not crossing between Context, Research, Studies and Methodology to answer one idea.

**Acceptance criteria**

- The task list names exactly six sections, in the order Entry, Research Details, Research, Studies, Execution, Review
- Project decision is asked inside Research Details, and no Methodology section exists
- Background, Goal and Problem Statement still each carry their own 'Assess this answer' action rather than one section-level evaluate button
- No evaluate button, page title or check-page subtitle shows a slug such as 'research-details' where a person expects a section name
- A submission error on any field routes to a section that exists, so no error is silently filed under Review
- The start page's numbered how-it-works list names the six sections
- node --run test passes

**Technical scope**

- research-plan-template.md: rename '# Context {open}' to Research Details and move the Project decision field into it; move Methods, Participant criteria and Sample Size out of '# Methodology' onto the pages that follow the approach question, keeping the three together (Gus, 13 October 2026, overriding the verdicts' split between Studies and Execution), and remove the Methodology heading; section slugs are generated by slugify (app.js:102) from the heading, so a rename changes the slug
- app.js evaluationSections (line 1671) is keyed by section slug: 'context' becomes 'research-details'. Four branches read that key and will quietly change behaviour if missed — renderSection's `section.slug !== 'context'` (line 5431), renderField's `.context-answer` / `.context-field-position` block (lines 5293-5296), renderEvalControls' contextField label choice (lines 1794-1796 and 2244), and the review summary (line 5990). Missing any of them reverts RPA-162's per-answer assessment to a single section button with no test failing on the words
- app.js renderSectionEvaluation (line 1715) sets button.textContent = 'Evaluate ' + key, so the slug is user-visible text
- style.css: the .context-answer and .context-field-position rules (lines 1001, 1005-1006, 1013) are named for the old slug
- submission-contract.js SECTION (line 25) maps every field key to a section slug used to route errors — 'context' and 'methodology' are both retired slugs
- app.js: the header step's hardcoded 'Plan details' title and 'plan-details' slug in renderReviewStep (line 6053) and in the step-title pass (line 7566)
- app.js renderStartPage: the section list at line 7101

*Source: Fields Verdicts section structure (Entry, Research Details, Research, Studies, Execution, Review); Fields Verdicts Research Details: Project decision KEEP (set constraints on duration of plan)*

> **Decided by Gus, 13 October 2026:** section-level evaluation is dropped **everywhere**, not given wording of its own. RPA-162's per-answer "Assess this answer" is the only way to ask for feedback, so the slug-named button problem disappears with the button. E6.3 already drafts the whole deletion and is the ticket that does it.
>
> **Sequencing this creates:** the rename must not land while a slug-named button still exists, so E6.3 has to come first — and E6.3 cannot land until every field the template marks `eval` has a per-answer action, which today is true only of Context (RPA-162). That makes E6.2 → E6.3 → this ticket the real order, which is not the phase order as drafted. See the Phase note in the roadmap.

### E2.7 Infer the research title from the plan's answers

`Story` · `M` · depends on **Restructure the form into Entry, Research Details, Research, Studies, Execution and Review**

**User story.** As a researcher, I want the plan to name itself from what I have already written and let me correct it, so that I am not asked to title a study before I have described it.

**Acceptance criteria**

- The form never blocks on an unanswered research title
- Once Background and Problem Statement are answered, the title field holds a suggested name the person did not type
- An edited title survives further edits to Background and Problem Statement — inference never overwrites a person's own words
- If inference returns nothing or fails, the title stays empty and editable and the plan can still be completed and sent
- No title inference request is made while the plan is printing
- A new test file covers the above and is listed in package.json's test script

**Technical scope**

- server.js: add a route to the table at lines 1644-1656 and a handler modelled on handleSuggestMethods — read the body with readJsonBody, validate the inputs, and return a short string
- app.js: a client caller beside suggestMethods (line 3018), which is the existing fetch-a-suggestion shape, and a trigger on Research Details settling rather than on every keystroke
- app.js renderHeader (line 5442): the title still renders as the .title-field textarea with data-field="researchTitle" and keeps its own control id via fieldControlId, so the person can edit it; what changes is that it arrives filled
- research-plan-template.md: the first '#' line stays — parseSchema (app.js:281) treats it as the document title field rather than a section — but its question=, Hint and Error change from asking to offering
- app.js: the title is read by planName (line 5836), the title getter (line 8086) and the backup name (line 9279); all three read the control, so an inferred value needs no new reader
- package.json: add the new test file to the test script's explicit list
- Guard against print: the RPA-162 work already has a precedent for not firing requests during print, covered by test/rpa-162-context-assessment.test.js

*Source: Fields Verdicts Entry: Research title INFER (infer from information provided, let the user edit; can be obtained in context)*

> **Needs Gus or Max:** Inference needs Background and Problem Statement, which sit in Research Details — the section after Entry. So does the title field appear in Entry at all, or does it move to the Research Details check page where there is something to infer from?

### E2.8 Retire the Studies questions and settle what Methods is asked per

`Story` · `L` · depends on **Let the submission contract accept a plan without the cut fields** and on **Ask how the research questions will be answered**

**User story.** As a researcher, I want to stop declaring how many studies I will run and mapping each one to research questions, so that I describe how I will find answers instead of doing bookkeeping the plan does not need.

**Acceptance criteria**

- Neither studyCount nor studyQuestions renders, and no page asks which research questions a study answers
- Methods, Participant criteria and Sample Size are each asked once, at the scope the decision record settled, and no step loops per study
- A draft saved with studies, studyCount and studyQuestions values still holds them after an edit triggers an autosave
- Opening a plan saved under the per-study structure does not lose its methods, participant criteria or sample size answers
- The task list no longer shows a section that cannot start until the number of studies is chosen
- node --run test passes

**Technical scope**

- research-plan-template.md: comment out the Number of studies and Study questions field lines with their Hint/Error/Help/Guidance, keeping key=studyCount and key=studyQuestions; remove the perQuestion flag from Participant criteria and Sample Size, which the template's own note defines as 'asked once per study'
- app.js renderStudyQuestionsField (line 4329), the 'study-questions' type branch in renderField (line 5177), and studyQuestionsFieldDef (line 4106)
- app.js: the `.field-study-questions` branches in pageUnitsOf (line 7970) and the two sibling collectors (lines 6769 and 7786), which currently push one page per study
- plan-model.js: the studies block (studyLabel and studyCount, from line 57) holds the rule that methods, characteristics and sample size belong to a study rather than a question
- app.js migrateDraft (line 8465) and DRAFT_VERSION (line 8113, currently 11): v10 built the per-study groups this ticket unwinds, so decide whether a new version is needed or whether the old shape is simply carried
- Dead code this creates: app.js 4419 special-cases the Other *label* for one field — `value === '__other__' ? (field.key === 'studyCount' ? 'More than three' : 'Other')`. Retiring Number of studies makes that branch unreachable, so remove the studyCount arm and leave the plain 'Other'
- Because one approach is asked per plan (E4.5), the three fields become ordinary plan-level fields: drop `perQuestion` and add no replacement grouping. plan-model.js's studies block is retired rather than re-keyed
- test/rpa-142-studies.test.js, test/rpa-140-unclaimed-question.test.js and test/rpa-116-methodology-by-question.test.js encode the per-study structure directly

*Source: Fields Verdicts implied cuts: Study questions, Number of studies; Fields Verdicts Studies: Ways to find info NEW PAGE, Methods KEEP, Deliverables SPLIT PAGE; Fields Verdicts Execution: Participant criteria CHANGE*

> **Decided by Gus, 13 October 2026:** Methods, Participant criteria and Sample Size are asked **per approach page** — they hang off the new 'Ways to find info' answer — and that answer is **one approach per plan**. So all three are asked once, framed by the chosen approach, with no loop and no per-approach grouping to build. This makes E4.5 a prerequisite: the answer they hang off has to exist first.

### E2.9 Triage the tests that assert the cut fields

`Task` · `L` · depends on **Retire the Studies questions and settle what Methods is asked per**

**User story.** As a developer, I want each test that asserts a cut field to be either retired or rewritten as a dormancy guarantee, so that the suite states what the app does now rather than what it used to.

**Acceptance criteria**

- No test asserts that a cut field renders, is required, or appears on a check page
- Every cut field has at least one test proving a saved draft keeps its value through an autosave, as test/dormant-data.test.js does for Requirements
- Every cut field has at least one test proving uncommenting its template lines brings it back, as test/rpa-117-dormant-theory-actions.test.js does for Theory
- package.json's test script lists exactly the test files that exist, with no entry pointing at a removed file
- node --run test passes, and the pretest pair passes
- A test retired rather than rewritten says in a comment which ticket cut its field and why

**Technical scope**

- The field keys and the number of test files naming each, measured today: sampleSize 28, goal 26, leadResearcher 23, studyCount 22, projectRequester 19, signOffResearcher 18, jiraProject 14, signOffProjectOwner 14, objective 13, researcherNames 8, otherResearchers 7, studyQuestions 3
- Reuse the two existing dormancy patterns rather than inventing a third: test/dormant-data.test.js for the carry-forward guarantee and test/rpa-117-dormant-theory-actions.test.js for the restore guarantee, via withFieldUncommented in test/app-harness.js (line 36)
- test/rpa-117-dormant-theory-actions.test.js asserts exact acc-count strings ('3 fields' for Research, '3 fields' for Methodology, '2 fields' for Execution) — those counts come from renderSection (app.js:5334-5336) and change with every cut
- package.json: the test script names every file explicitly, and pretest names two more; both lists need editing whenever a file is added or removed
- Structural section lists should already be reading from the shared inventory, so this ticket is about field-level assertions only

*Source: Fields Verdicts, all implied cuts and the Objective MERGE row; Alignment (eliminate non-essential questions)*


## E3-content

Epic 3 — Content, labels and guidance. The cheapest work in the redesign: almost all of it is `research-plan-template.md`, which the app parses at load, so the form's words change without touching `app.js`. The epic serves the Alignment statement's first purpose — "a more intuitive and effortless form" — by fixing what the form says rather than what it does. Three facts set the shape of every ticket below. (1) The words of the form are already a tested contract: `test/rpa-119-field-words.test.js` holds a WORDS table asserting each field's name, its question and the title of its help note, so no rename is free. (2) The help-note machinery is richer than the template uses — `Help:`, `Guidance:` with `- ` items, `**bold**`, `*italics*`, `[text](url)`, and a `Good:`/`Bad:` example panel that is wired into four renderers and used by zero fields. (3) A rubric binds to a field by its key, not its label (`parseRubric` at app.js:409 derives `toCamelKey(heading)`, `attachRubrics` at app.js:426 matches `rubrics[f.key]`), so relabelling is safe for assessment — though `research-plan-rubric.md`'s own header comment wrongly says it binds by label, and that line should be corrected while the labels are in hand. Sequencing: the help-note pattern (ticket 1) gates four note rewrites, so it goes first even though smaller template wins are waiting behind it. The label sweep (ticket 10) is held late on purpose: seven of the fields whose titles repeat their section are on the Fields Verdicts implied-cut list, and renaming a field that Epic 1 deletes is wasted work.

### E3.1 Agree one shape for help notes and rewrite the six assessed fields to it

`Story` · `M`

**User story.** As someone who knows my project but has never written a research plan, I want each help note to tell me what to put in the box, so that I can act on it instead of reading a description of what a good answer feels like.

**Acceptance criteria**

- The six assessed fields — Background, Goal, Problem Statement, Objective, Research Questions, Outcomes — each follow one recorded shape for their help note.
- The shape is written down where the next person editing the template will meet it, not only in the ticket.
- Each of the six notes is shorter than the note it replaces, measured in words.
- Each note names what to include and shows it, rather than naming a quality the answer should have.
- Every one of the six still titles its link with what is behind it, so the RPA-119 words table passes with its new titles.
- No template markup reaches the screen: no asterisk, no "Guidance:", no empty paragraph, list item or bold run.
- `node --run test` passes.

**Technical scope**

- `research-plan-template.md`: the `Help:` and `Guidance:` lines of the six assessed fields — background (line 256), goal (267), problemStatement (277), objective (292), researchQuestions (308), outcomes (319). Template only; no code changes.
- No change needed in `app.js`: `parseSchema` already collects `Help:` and `Guidance:` lines (app.js:281, the `helpMatch` and `guideMatch` branches), and `renderFieldHelp` (app.js:4576) renders the title into the `<summary>` and the lines into paragraphs, with a run of `- ` lines becoming one `<ul class="field-help-list">`.
- `appendGuidanceText` already supports `**bold**`, `*italics*` and `[text](url)` inside a note, so the pattern can use them without new parsing.
- Update the help-title column of the WORDS table in `test/rpa-119-field-words.test.js` (rows at lines 52-57) for any title that changes.
- The notes currently share one shape — "A strong X covers 3 key areas" plus three bold bullets — which is a starting point to improve rather than a vacuum; keep what works about it.
- New copy is British English: `test/rpa-78-british-english.test.js` boots the real template and asserts `document.documentElement.lang === 'en-GB'` alongside its copy checks.
- Record the pattern either in the template's own header comment (which already documents the `Help:`/`Guidance:` syntax at lines 129-138) or as a new numbered record in `research/decisions/`, taking the next free number after 002 (the page and section model, E1.3) and 003 (the field cut, E2.1), following `research/decisions/001-layout-and-navigation.md`.

*Source: USC "Help information" (concise, practical, clear examples, a framework for structuring)*

> **Needs Gus or Max:** Where should the pattern live — the template's header comment, which is where a template editor already looks, or a decision record in research/decisions/, which is where a reviewer looks? Gus to pick one so there is a single place to check against.

### E3.2 Take the participant bands out of the Sample Size help note

`Task` · `S`

**User story.** As someone choosing how many participants I need, I want the help note to explain the trade-off rather than restate the options I can already see, so that reading it adds something.

**Acceptance criteria**

- The help note's three items no longer repeat the participant bands that the radio options already show on the same page.
- The radio options and their per-option hints are unchanged, so the saved value and the check-page answer are unaffected.
- No participant number appears twice on the page.
- `node --run test` passes, with the RPA-119 remaining-words assertions updated to the new wording.

**Technical scope**

- `research-plan-template.md` lines 405-409: the Sample Size `Guidance:` lines, whose bullets are "**Just a few users (1–5):**", "**A focused group (6–12):**" and "**Larger groups (30+):**".
- The duplication is on the same page: the field's own options already read "1 to 5 | to spot major issues and early feedback", "6 to 12 | …", "13 to 29 | …", "30 or more | …" (template line 402), and the text after " | " renders as each option's hint.
- `test/rpa-119-remaining-field-words.test.js` asserts the bullet text verbatim at line 47 and the three bold run labels at line 50; both must be updated to the new wording.
- Template only. `renderRadiosField` (app.js:4367) and the option-hint rendering need no change.
- Out of scope: Sample Size has no `Help:` line, so its link still reads "Help with this section" — that is ticket "Give every field a help note that says what is behind it".

*Source: USC "[SWR] Remove numbering from Number of Participants points" (the field is labelled Sample Size, asked as "How many participants do you need?")*

### E3.3 Ask research questions as questions, and show one

`Task` · `S`

**User story.** As someone adding research questions, I want the form to show me that a research question is written as a question, so that I write "Why do new users drop off?" rather than "new user drop-off".

**Acceptance criteria**

- The field's hint says a research question is written as a question and ends in a question mark.
- An example in the field's own words shows one, so a person can copy its shape.
- No guidance is added to any placeholder attribute, so the placeholder audit still finds only the date format mask and the "Other…" escape inputs.
- The field keeps its key `researchQuestions`, its `eval` flag and its `question=` heading, so assessment and the paired Outcomes rows are untouched.
- `node --run test` passes.

**Technical scope**

- `research-plan-template.md` lines 308-318: the Research Questions `Hint:` (currently "Frame the specific gaps in your understanding of user experience, needs and issues.") and its `Guidance:` lines, whose last item already carries a question-marked example — *"Why do new users drop off on the bank-linking screen?"* — at line 317.
- Template only. Rows render through `renderListField` (app.js:3896); the field is a `list` with `eval`.
- Hard constraint: the wording must not go into a row placeholder. `test/no-placeholder-guidance.test.js` allows exactly two survivors — the DD/MM/YYYY date segments and the "Other…" escape-hatch inputs — and fails any other placeholder used as guidance.
- `test/rpa-119-field-words.test.js` WORDS row 56 pins this field's name, question and help title; leave all three unless this ticket changes them deliberately.
- Out of scope: appending "?" automatically, or refusing a row without one. `research/decisions/001-layout-and-navigation.md` explicitly rejected hard forward-locks — "The gate does not produce thinking; it produces filler that satisfies the gate" — and the same reasoning argues against validating punctuation.

*Source: Fields Verdicts, Research → Research Questions KEEP ("simplify how we ask; add a question mark")*

> **Needs Gus or Max:** Is a hint and an example enough, or does Gus want a soft nudge in the row itself? A hard validation would contradict decision 001's rejection of gates, so that option should be ruled in or out explicitly.

### E3.4 Cut the footer back to what a person needs on arrival

`Task` · `S`

**User story.** As someone sent a link to this form by a colleague, I want the panel at the bottom of the page to answer my few questions quickly, so that I am not reading four dense paragraphs to find out where my writing goes.

**Acceptance criteria**

- Each of the footer's three columns is materially shorter than it is today, measured in words.
- The four things a person arrives needing are still findable: what this form is, that drafts save in this browser, that evaluation sends writing to the AI service, and who to tell when something breaks.
- The Design System credit and both licence links are untouched.
- The printed provenance line still prints and the on-screen columns still do not.
- At 600px wide the footer is a single column with no horizontal scrolling.
- `node --run test` passes.

**Technical scope**

- `index.html` lines 96-116: the three `<section class="footer-col">` blocks under `About this form`, `Where your writing goes` and `Problems or feedback`. The middle one is the longest — four sentences covering drafts, evaluation, backups, Word and PDF.
- `style.css` on `b906cd6`: lines 131-134 (`.site-footer`, `.site-footer-inner`, `.footer-cols`, `.footer-h`), line 166 (one column under 760px), line 167 (padding under 600px) and lines 972-974 (print: `.footer-cols,.footer-meta{display:none!important}`). RPA-166 shifted these down by one; a checkout at `cc5c1fc` is one line earlier throughout.
- Held by `test/rpa-92-header-footer.test.js`: the footer must keep matching /research plan for product teams/i, /save in this browser/i, /evaluation and AI suggestions send relevant writing and context/i and /tell the person who sent you this link/i, must have exactly three `h2` elements (line 149), and must still contain /backups stay on your device until you share them/i (line 180). Keep `.footer-credit`, `.footer-print-only`, `#app-version` and the build marker.
- `test/rpa-121-govuk-credit.test.js` holds the attribution and `NOTICE.md`; neither should move.
- RPA-166 added a test to `test/rpa-92-header-footer.test.js` asserting the header computes to `position: static` and that `--site-header-h` publishes `0px`. The footer is unaffected, but do not revert either while editing that file.
- Note the hidden `<p id="backup-help" hidden>` at index.html line 85 still supplies the Download and Restore buttons' accessible description via aria-describedby (RPA-93) — it is not footer text and must not be swept up.

*Source: USC "Too much content in bottom banner"*

> **Needs Gus or Max:** Does "bottom banner" mean this footer, or the `.phase-banner` at index.html lines 68-71 ("Beta — This is a work in progress solution…"), which is in the header but reads like a banner? The screenshot on the USC item settles it; Gus to confirm before the branch starts.

### E3.5 Call each section the same thing in the form and in the downloaded document

`Task` · `S`

**User story.** As someone who fills in the form and then opens the Word document, I want the sections to have the same names in both, so that I can match what I wrote to where it ended up.

**Acceptance criteria**

- A section a person completes under one name appears in the downloaded document under that same name, or the difference is recorded in the code with the reason it exists.
- No section heading in the document is produced by lower-casing another section's title at run time.
- The level-1 headings the document test asserts are the same words the form shows.
- `node --run test` passes.

**Technical scope**

- `plan-document.js` line 201: the sign-off section's heading is the hard-coded string `'Sign-off'`, while the template calls that section `# Review` (research-plan-template.md line 473).
- `plan-document.js` line 205: `text: methodology && hasStudies ? 'Studies and ' + section.title.toLowerCase() : section.title` — the document merges the form's `# Studies` and `# Methodology` into one heading built by lower-casing a title, so the form's two sections become the document's one.
- `test/rpa-77-word-download.test.js` line 133 asserts the document's level-1 headings are exactly ['Context', 'Research', 'Studies and methodology', 'Execution', 'Sign-off']; this list must change with the code.
- Section titles themselves live in `research-plan-template.md` as `# Name` lines (Context 254, Research 290, Studies 333, Methodology 356, Execution 414, Review 473) and are parsed by `parseHeading` inside `parseSchema`.
- `app.js` derives each step's name from the same titles — `dataset.stepTitle` at app.js:7566 reads `.acc-title`, and `document.title` is built from it at app.js:7540 — so renaming a section in the template carries through the form on its own.

*Source: USC "Ensure consistency in participant-facing information"*

> **Needs Gus or Max:** Which name wins for the last section — "Review", which the template's comment defends as a moment rather than a section, or "Sign-off", which is what the document a stakeholder reads already says? Gus and Max to settle, since the stakeholder-facing name is the one that matters here.

### E3.6 Rewrite the Methods help note to name families of methods, not niche techniques

`Task` · `S` · depends on **Agree one shape for help notes and rewrite the six assessed fields to it**

**User story.** As someone who is not a researcher, I want the Methods note to help me recognise which kind of method fits my question, so that I am not anchored on three named techniques one of which I have never heard of.

**Acceptance criteria**

- The note's examples name kinds of method rather than single techniques, and "Tree testing" no longer stands as a general example.
- The examples match the framing the note's own opening paragraph already uses — whether you need to observe what people do, listen to what they say, or measure at scale.
- `research-methods.md` is unchanged, so every method stays available in the field's searchable combobox.
- The Methods hint still says what the British-English test checks of it, or that assertion moves with the new wording.
- `node --run test` passes.

**Technical scope**

- `research-plan-template.md` lines 366-375: the Methods field's `Hint:` and `Guidance:` lines. The three bullets are "**Usability testing:**", "**User interviews:**" and "**Tree testing:**", while the paragraph above them already frames the choice as observe / listen / measure — the fix is to make the bullets match the note's own framing.
- `test/rpa-78-british-english.test.js` line 46 asserts the Methods hint matches /user behaviours, needs, and experiences/; if the hint is reworded, update that assertion in the same branch.
- Template only. The suggestion list is `research-methods.md` (120+ entries, one per bullet, parsed by `parseMethodsList` in both app.js:430 and server.js:1220) and the field's combobox is special-cased in `renderGroupedMethodsField` (app.js:4472) with `renderMethodsSuggest` (app.js:3031).
- `test/rpa-119-field-words.test.js` WORDS row 58 pins the field's name "Methods", its question and its help title "What is a research method?".

*Source: USC "[SWR] Review research method descriptions" (too specific, references niche methods like tree testing)*

> **Needs Gus or Max:** The item says "descriptions" plural. Two other surfaces could be meant: the 120-entry suggestion pool in research-methods.md, from which the model picks, and the one-sentence reason it writes for each suggestion (constrained by METHODS_COVERAGE_TOOL at server.js:1229 and buildCoveragePrompt at server.js:1285, shown in `.ms-method-reason` at app.js:3119). Both are outside this epic's template work — Gus to confirm whether either is in the complaint.

### E3.7 Give every field a help note that says what is behind it

`Task` · `M` · depends on **Agree one shape for help notes and rewrite the six assessed fields to it**

**User story.** As someone looking for help on a question I am stuck on, I want every help link to tell me what it contains, so that I never open one to be told there is no help for this field.

**Acceptance criteria**

- No field's help link opens on "No further help for this field yet."
- No field's help link reads the generic "Help with this section"; each says what is behind it.
- Fields carrying the `nohelp` flag still have no link of their own and are still covered by the note on the field below them.
- The words test covers the fields it did not cover before, asserting for each the same three things it asserts today: the question it asks, the name it keeps and the title of its note.
- Adding any new test file also adds it to the `test` script in `package.json`.
- `node --run test` passes.

**Technical scope**

- `renderFieldHelp` (app.js:4576) gives every field a link; without a `Help:` line the summary falls back to 'Help with this section' (app.js:4579), and without `Guidance:` lines the body renders `NO_HELP_YET` — 'No further help for this field yet.' (app.js:4568, used at 4581).
- Fields with no `Guidance:` line in `research-plan-template.md` today, excluding those on the Fields Verdicts implied-cut list: Email address (line 167), Last updated (244), the five Additional information hatches (251, 287, 330, 411, 465) and Planned Schedule (425).
- Sample Size (line 402) is the one field with `Guidance:` lines but no `Help:` title, so its link reads the generic wording.
- The two Declaration fields (508, 517) carry `nohelp` on purpose — one note per sign-off pair, under the initials box — and must keep it.
- `test/rpa-119-field-words.test.js` holds the WORDS table (lines 44-60) covering 15 fields and asserts of each that its note is written and not the fallback; extend the table rather than writing a parallel check.
- Template only, unless a field genuinely needs no note — in which case `nohelp` is the existing mechanism and the note moves to the field below, as the declarations do.

*Source: USC "Help information"; USC "Cleaner version to add additional information" (the hatch is one of the fields with no note)*

> **Needs Gus or Max:** Do the five Additional information hatches each need a note, or does the hatch rework remove the question entirely? Settle this with the hatch ticket so the same words are not written twice.

### E3.8 Show a strong and a weak example on the fields that can hold one

`Story` · `M` · depends on **Agree one shape for help notes and rewrite the six assessed fields to it**

**User story.** As someone who can describe my project out loud but freezes at an empty box, I want to see an example of a strong answer and a weak one, so that I can judge my own draft before asking for an assessment.

**Acceptance criteria**

- Each assessed field offers one strong and one weak example behind a closed "Show example" toggle.
- The examples are written as answers a person could type into the box, not as descriptions of what a good answer contains.
- The panel starts closed and opens only when pressed.
- No field whose renderer has no example panel is given example lines, so nothing is written into the template that never reaches a screen.
- A test asserts the examples render for the fields that declare them.
- Any new test file is added to the `test` script in `package.json`.
- `node --run test` passes.

**Technical scope**

- The mechanism is already built and used by no field: `parseSchema` reads indented `Good:` and `Bad:` lines into `field.examples` (app.js:372-375) and `renderExamplePanel` (app.js:1626) draws the "Show example" / "Hide example" toggle with `.ex-block.ex-good` and `.ex-block.ex-bad`. A grep of `research-plan-template.md` for `Good:`/`Bad:` finds only the header comment's own syntax documentation at lines 113-117.
- Example panels are wired into four renderers only: `renderListField` (app.js:4029), `renderLinkedOutcomesField` (4067), `renderGroupedMethodsField` (4497) and the generic text/textarea path in `renderFieldOfType` (5290). They are therefore available for `text`, `textarea`, `list`, the Outcomes list and the Methods list.
- They are NOT available for `radios` (`renderRadiosField`, app.js:4367), `table` (`renderTableField`, 3610), `checkbox` (4452), `custom-fields` (3540), `study-questions` (4329), or the `select` and `date` branches of `renderFieldOfType`, which return before line 5290. Sample Size, Planned Schedule and Previous Knowledge cannot show examples without wiring the panel into their renderers first.
- Target fields, all of which are on a supported renderer: background, goal, problemStatement, objective (textarea) and researchQuestions, outcomes (list).
- Template work for the copy; a small code change only if a field on an unsupported renderer is judged to need examples too.

*Source: USC "Help information" (clear examples)*

> **Needs Gus or Max:** Does a weak example help or does it plant the wrong shape? The panel labels the two "Good" and "Bad", so a field can be given only a `Good:` line if Gus would rather not show a bad answer at all.

### E3.9 Say what Background and Problem Statement need before they are assessed

`Story` · `M` · depends on **Agree one shape for help notes and rewrite the six assessed fields to it**

**User story.** As someone about to press "Assess this answer", I want to know beforehand what the assessment is looking for, so that I get useful feedback on a real attempt instead of being told what I left out.

**Acceptance criteria**

- Background's visible guidance names what its assessment scores, in the same terms the rubric uses.
- Problem Statement's visible guidance does the same for its criteria.
- The sentence frame for Background — "As part of the project ___, we are trying to ___ in order to ___ because ___" — reaches the person as guidance or as an example, never as a placeholder inside the box.
- `research-plan-rubric.md` is unchanged, so every assessed field still receives exactly the criteria written under its heading.
- The per-answer "Assess this answer" action and the "Continue and return later" reminder delivered by RPA-162 are untouched.
- `node --run test` passes.

**Technical scope**

- `research-plan-template.md`: Background's `Hint:` and `Guidance:` (lines 256-266) and Problem Statement's (277-286). Template only.
- What the assessment actually scores is in `research-plan-rubric.md`: Background has Contextual Relevance, Essential Knowledge and Focus (lines 13-17); Problem Statement has Clarity, Specificity, Feasibility and Significance (lines 25-30). The guidance should name these, which is also the cheapest way to keep the two files honest with each other.
- The rubric binds by key, not label: `parseRubric` derives `toCamelKey(heading)` (app.js:409) and `attachRubrics` matches `rubrics[f.key]` (app.js:426). Do not rename a rubric heading in this branch — `test/rpa-150-rubric-binding.test.js` holds the join end to end.
- Hard constraint on the sentence frame: `test/no-placeholder-guidance.test.js` permits only the DD/MM/YYYY date mask and the "Other…" escape inputs as placeholders, so the frame cannot go in one. The template supports *italics* inside a `Hint:` for exactly this shape — the dormant Hypothesis line at template line 306 reads "structured as *If we do this, then this will happen.*".
- Already built, do not rebuild: RPA-162 put "Assess this answer" under each of Background, Goal and Problem Statement. See `evaluationSections.context = ['background','goal','problemStatement']` (app.js:1671), the `contextField` branch in `renderEvalControls` (app.js:1796) and the `context-answer` / `context-field-position` wrapper in `renderFieldOfType` (app.js:5293-5297).
- `test/rpa-162-context-assessment.test.js` covers that behaviour and should keep passing untouched.

*Source: Fields Verdicts, Research Details → Background KEEP ("specify what info the user must provide"; the "As part of the project___" template) and Problem Statement KEEP ("specify what info to provide before evaluation")*

> **Needs Gus or Max:** The verdict says "explore a template" for Background. Is the frame a hint, a `Good:` example, or text prefilled into the box? Prefilling puts words in the plan that the person did not write, which is the same objection the form already makes to placeholders — Gus to choose.

### E3.10 Rename the fields whose titles repeat their section instead of naming their answer

`Story` · `M`

**User story.** As someone moving through the form one question at a time, I want each field's name to say what I am being asked for, so that the page does not tell me twice which section I am in and once what I should type.

**Acceptance criteria**

- Every renamed field's name says what the person types into it and does not repeat the name of the section it sits in.
- Each renamed field keeps its `key=`, so no saved draft, backup or submission loses an answer.
- The check page, the error summary and the downloaded Word document all show the new name.
- No rubric heading is renamed, and every assessed field still receives its criteria.
- The note in `research-plan-rubric.md` about how a heading finds its field says key, not label.
- `node --run test` passes, with the words tables updated to the new names.
- `python3 research/field-audit-gen.py` reports no drift between the template and the field audit.

**Technical scope**

- `research-plan-template.md`: the label before the parentheses on each field being renamed. Candidates whose title repeats their section are Research Questions (in `# Research`, line 308), Objective (`# Research`, 292) and Methods (`# Methodology`, 366); also in scope are Sample Size (402), Planned Schedule (425) and Previous Knowledge (449), whose titles name a thing rather than the answer asked for.
- Scope guard: Project name, Lead researcher, Other researchers, Researcher names, Project requester, Study questions and Number of studies are on the Fields Verdicts implied-cut list. Do not rename what Epic 1 deletes — confirm the cut list first.
- The label is the form's internal name and reaches the person in six places. `renderField` copies it to `wrap.dataset.fieldName` (app.js:5162, and `renderRadiosField` at 4373), which the check page's `.summary-key` rows and the error summary read. `renderEvalControls` builds 'Evaluate ' + label and 'Retry ' + label (app.js:1796, repeated at 2083 and 2244) and the panel heading label + ' Evaluation' (app.js:1830). `renderFieldOfType` writes label + ' · 1 of 3' into `.context-field-position` (app.js:5295). `plan-document.js` uses `f.label` for the document's level-2 headings and details keys (lines 150, 186, 190, 209).
- Two off-screen consumers: `app.js:1517` sends `fieldLabel: field.label`, which `server.js:456` interpolates into the evaluator prompt ("You are evaluating a \"${fieldLabel}\" statement"); and `saveForCalibration` posts `field: field.label` into calibration records (app.js:1661).
- Safe by design: the rubric joins by key. `parseRubric` derives `toCamelKey(heading)` (app.js:409) and `attachRubrics` matches `rubrics[f.key]` (app.js:426), so a relabelled field keeps its criteria. But `research-plan-rubric.md`'s header comment claims a heading "matches a field by its label" — wrong, and worth correcting here while the reasoning is fresh; `test/rpa-150-rubric-binding.test.js` states the real rule in its preamble.
- Tests to update: the WORDS table in `test/rpa-119-field-words.test.js` (lines 44-60) and its check-page assertion (line 140); `test/rpa-103-check-answers.test.js` lines 64-68 and 80; `test/rpa-110-edit-and-return.test.js` lines 144-145; `test/rpa-118-sample-size.test.js` line 77; `test/rpa-116-methodology-by-question.test.js`. For any assessed field, `test/rpa-78-british-english.test.js` compares `body.fieldLabel` against `baseline.mappings` in `test/fixtures/rpa-78-pre-change.json`.
- `research/field-audit.md` generates its field rows from the template and drifts when a label moves. The check is `python3 research/field-audit-gen.py`; it is not in CI — `.github/workflows/test.yml` runs `npm test` only — so run it by hand.

*Source: USC "Update field titles to reflect specific content"; USC "Ensure consistency in participant-facing information" (the Goal field is titled Goal, asked as "What is the goal of this project?" and called the project goal in its note)*

> **Needs Gus or Max:** Seven of the fields whose titles repeat their section are on the Fields Verdicts implied-cut list. Gus and Max to confirm the cut list before this branch starts, so no effort goes into renaming a field that is about to be deleted.

### E3.11 Make Additional information read as one quiet hatch rather than three repeats

`Story` · `M` · depends on **Rename the fields whose titles repeat their section instead of naming their answer**

**User story.** As someone finishing a section, I want the place to add anything the questions missed to be easy to notice but quick to pass, so that I am not reading the same two sentences at the end of all five sections.

**Acceptance criteria**

- The hatch states its purpose once per section, not three times on the same screen.
- The words of the heading are not repeated in the button that opens a block.
- The cap of one block per section still holds, and a restored draft that has more blocks than the cap keeps every one of them.
- The hatch still appears after the section's questions and before Save and continue.
- The check page still lists it, and Change still opens it on its own.
- `node --run test` passes.

**Technical scope**

- Five hatches in `research-plan-template.md`: additionalPlanDetails (line 251), additionalContext (287), additionalResearch (330), additionalMethodology (411), additionalResources (465). The first four share one hint verbatim — "Anything this section needs that its fields have no place for. It becomes its own titled part of the document." — and the fifth is a near-copy.
- The repetition is on screen three times per section: `renderCustomFieldsField` (app.js:3540) draws the label "Additional information" into `.flabel` from `headingText(field)` (3545), then the hint, then a button reading '+ Add additional information' (app.js:3596).
- `renderSection` appends the hatch after the section's fields and after the section Evaluate control (app.js:5434), and excludes it from the field count (app.js:5335). Keep that order — it is RPA-101's decision that extra material is not evaluated.
- The cap comes from `max=1` on the field line, applied by `applyCap` (app.js:3603-3605), which hides the button at the limit rather than refusing a block, so a restore can exceed it. Do not turn the cap into a refusal.
- `test/rpa-145-plan-details-additional-information.test.js` asserts the visible label is 'Additional information' (line 59), the exact template line shape (line 65), the check-page row (line 104), and that Change opens the hatch alone under that name (lines 109 and 132). Any rename updates all of these.
- `plan-document.js` lines 119-121 turn each block into a level-3 heading from the label the person typed, so the hatch's own name never reaches the document — only theirs does.
- `submission-contract.js` validates each block's user-typed `label` and `body` (lines 216-217, 326-327); the field's own label is not in the contract, so a rename does not touch stored submissions.

*Source: USC "Cleaner version to add additional information" (it appears in every section, feels repetitive, easy to overlook)*

> **Needs Gus or Max:** Does every section still need a hatch, or does it belong only where pilot authors actually used one? The pilot drafts would answer that, and dropping three hatches is a bigger win than rewording five.

### E3.12 Place the section name the same way on every page of the form

`Story` · `M`

**User story.** As someone working through the form, I want the page to name where I am in one consistent place, so that the heading reads the same way from the first question to the last.

**Acceptance criteria**

- Every step page names itself with the same kind of element, and that element is a heading.
- No page's name sits inside a control that does nothing when pressed.
- The name the page shows, the name in the browser tab title and the name the form holds for that step are the same words.
- Moving between pages still puts focus on the page's name.
- The section's field count still prints and still does not appear on screen.
- The placement decided here is recorded in `research/decisions/`, alongside the existing layout decision.
- `node --run test` passes.

**Technical scope**

- Three different elements carry a page's name today. For the four content sections, `renderSection` builds the head as `el('button', 'acc-head', …)` holding `.acc-title` and `.acc-count` (app.js:5324-5338) — not a heading element. Plan details gets a real `h2.step-heading` (app.js:7600, only when `stepEl === header`). The review step gets a real `h2.review-h` (app.js:6012).
- On a step page that accordion button is inert: `style.css` line 233 hides its chevron, line 234 sets `cursor:default`, line 235 kills the hover colour, and line 279 hides `.acc-count` on screen only, so the count still prints.
- `dataset.stepTitle` is read off `.acc-title` at app.js:7566 and drives the tab title at app.js:7540. Focus management queries all three selectors — `.step-heading, .acc-head, .review-h` at app.js:7715 and 7776, `.step-heading, .acc-title` at 8019 — so any change must keep every path finding a name.
- Held by `test/rpa-149-section-name-not-counters.test.js`: `.step-top` must contain exactly `['step-back', 'step-all']` with no digit in it, the page's name must equal `dataset.stepTitle`, no code may word a count, and `.acc.step .acc-count` must stay hidden on screen only. That test is the contract for this page furniture.
- Record the outcome as a new numbered record in `research/decisions/`, taking the next free number after 002 (the page and section model, E1.3) and 003 (the field cut, E2.1), following `research/decisions/001-layout-and-navigation.md`. Note while there that 001's persistent outline was never built — the task list is a separate screen — so the new record does not inherit a claim that is not true.

*Source: USC "Define section title placement"*

> **Needs Gus or Max:** Where should the section name go: above the question as a caption, folded into the question itself, or dropped on pages where the question already says which section it belongs to? This is Gus and Max's call, and it should be settled before the branch opens — the code change is small once the placement is chosen.


## E4-workflow

Epic 4 — Workflow redesigns: plan dates, the question-to-methods flow, participants, deliverables and the planned schedule. The design-and-build half of the October redesign, as against the field cuts and copy edits that are template-only. Fifteen tickets, ordered: the two plan dates first (they are the ceiling everything downstream hangs from), then the new "how will you answer this" page and the method suggestions it feeds, then the structural cuts (Studies, the question-to-deliverable pairing, per-study participants), then the Planned Schedule. Alignment (Re-design-October, "Alignment"): eliminate non-essential questions, resolve inefficient workflows, deliver a more intuitive and effortless form; the app collects, evaluates, refines and suggests, and the plan is iterated afterwards. Three of these tickets undo decisions taken deliberately — PAGE_PAIRS (RPA-108/122), per-study methodology (RPA-142) and per-question participants (RPA-116) — and each says so. Decision 001 still stands: nothing here adds a forward lock.

### E4.1 Refuse plan dates that are already in the past

`Story` · `S`

**User story.** As a researcher setting the plan's dates, I want the form to refuse a decision or readout date that has already passed, so that the schedule built from them is one I can still work to.

**Acceptance criteria**

- A Project decision or Research readout date earlier than today is refused on Save and continue, with a message at the field and a link in the error summary.
- The native calendar on both plan dates offers no day before today.
- A past date typed or pasted into the segmented day/month/year editor is caught by the same rule, not only one chosen from the calendar.
- A past date arriving from an older draft or a JSON backup is kept and flagged, never silently rewritten.
- Today is read at the moment of the check, so a plan left open overnight does not accept yesterday.
- The Planned Schedule's advisory 'before this document was created' note is unchanged.

**Technical scope**

- app.js initDeadlineConstraints() (~line 5085) already owns this pair — it holds the readout-after-decision clamp and the one-week buffer warning — so the floor belongs beside them, not in a new module.
- Set min on the native date input that buildDateControl() (app.js ~line 1180) creates, and back it with a value check: applyTimelineCeiling() (app.js ~8889) documents why min/max alone is not enough — typed, pasted and restored values never pass through it.
- Report through showDateError() / clearDateError() (app.js 998 / 987), the same path the stage timeline ceiling uses; todayIso() (app.js 60) is the existing source of today.
- Flag rather than rewrite, which is the rule applyTimelineCeiling() states in full and timelineFloor() (app.js ~8931) follows.
- New test file under test/, added to the explicit list in package.json's "test" script.

*Source: Unprioritised: [PDWR] Dates configuration (no date earlier than today). Fields Verdicts: Research Details / Project decision KEEP (set constraints on duration of plan).*

> **Needs Gus or Max:** Does the floor apply to the Planned Schedule's stage dates too? timelineFloor() only warns there on purpose — a plan written up weeks after the work began has real stages that predate the document.

### E4.2 Say when the readout and decision dates are more than a month apart

`Story` · `S` · depends on **Refuse plan dates that are already in the past**

**User story.** As a researcher, I want the form to tell me when my delivery date sits more than a month from the decision it feeds, so that the plan covers a span I can actually schedule.

**Acceptance criteria**

- With both dates set and more than one calendar month between them, a note appears beside the readout saying so.
- With a month or less between them, no note appears.
- The note does not block Save and continue.
- The existing one-week buffer warning still appears on its own terms, and the two notes never state the same thing at the same time.
- Clearing either date clears the note.
- A month is counted by calendar month, so 31 January to 28 February is inside the rule and 31 January to 2 March is not.

**Technical scope**

- app.js initDeadlineConstraints(): checkWarning() and its .field-warning element (~lines 5137-5158) are the pattern — a note under the readout's .date-control, recomputed on change of both inputs.
- Month arithmetic must survive short months: localDateFrom() (app.js ~3228) is the existing local-midnight builder that rejects rolled-over dates, and renderTimelineChart()'s six-month anniversary clamp (app.js ~3412) is the precedent for doing this without a 30-day approximation.
- Extend the date test file from the floor ticket, or add a file of its own to package.json's "test" list.

*Source: Unprioritised: [PDWR] Dates configuration (relationship between delivery and decision dates with a maximum gap of one month). Fields Verdicts: Project decision KEEP (set constraints on duration of plan).*

> **Needs Gus or Max:** Warn or refuse? The ceiling between these two dates is already hard (the readout is clamped), but decision 001 rejects gates that produce filler. Gus to settle which this is before the ACs are final.

### E4.3 Fix the readout date being moved with nothing shown

`Bug` · `M`

**User story.** As a researcher reopening a plan, I want my saved readout date either left alone or moved with an explanation, so that the form does not quietly replace a date I chose and then save over it.

**Acceptance criteria**

- Restoring a draft or JSON backup whose readout is after the decision either leaves the readout as saved or moves it and says so; it is never changed with nothing shown.
- The 'has been moved to…' note appears whenever the form moves the readout, whichever input the change arrived from.
- After any such move the Stage Timeline ceiling uses the readout's new value, as test/rpa-144-clamp-reaches-the-timeline.test.js already requires.
- No autosave writes a date the person did not set before the move has been shown to them.
- The two dates still have a page each (test/rpa-144-dates-one-per-page.test.js) and the readout remedy link still works (test/rpa-154-readout-remedy.test.js).

**Technical scope**

- The path, found by reading: applyDraft() (app.js ~9470ff) restores a date with setDateInputValue() and then dispatches a bubbling 'change'. Project decision sits before Research readout in the header, so it is restored first; when the readout's own change fires, clampResearch() (app.js ~5111) sees readout > decision, clamps, and leaves the `moved` note hidden because byDecision is false — the restored answer is overwritten in silence and the re-dispatched input/change marks the draft dirty.
- Same on the JSON restore path: initDeadlineConstraints() is called at app.js 9529, before applyDraft() at 9534.
- Fix options: show the note on any clamp regardless of which input fired, or suppress the clamp while restoring — draftRestoring is the existing flag for 'this is a restore, not a person' and saveDraft() already reads it (app.js ~8382).
- Keep the `clamping` re-entry guard and the deliberate input/change re-dispatch: applyTimelineCeiling() and applyTimelineAnchors() listen on the readout, and that re-dispatch is what RPA-144 added so the stage calendars stop offering forbidden months.

*Source: Unprioritised: [SWR] Planned Schedule Redesign and Timeline Bug Fixes (BUG: fix date interactions between delivery and decision dates).*

> **Needs Gus or Max:** The source line names a bug without describing it. The silent clamp above is the one the code shows; Max to confirm it is what he saw, or describe the other symptom.

### E4.4 Decide whether the plan still asks for a delivery date

`Task` · `S`

**User story.** As Gus, I want a written decision on whether the readout date is asked for, estimated or dropped, so that the schedule redesign knows what its ceiling is before anyone builds it.

**Acceptance criteria**

- A decision record exists at research/decisions/002-*.md in the form of 001 (Context, Decision, Why not …), stating whether Research readout stays a question, becomes an estimate, or goes.
- The record lists what reads the readout today and says what supplies each of those if it goes.
- The record says what happens to plans already saved with a readout date.
- The Planned Schedule tickets reference it, and no schedule work starts before it is Accepted.

**Technical scope**

- What reads the readout today: timelineCeiling() and applyTimelineCeiling() (app.js ~8847, ~8889); applyTimelineAnchors() (app.js 1463) mirrors it into the last stage's completion date while that cell is still a default; initDeadlineConstraints() clamps it against the decision; ceilingRemedy() and changeReadoutFrom() (app.js ~8860-8885) link an out-of-range stage date to it.
- Beyond the form: SECTION and LABEL in submission-contract.js (lines 25-26) place researchReadout in plan-details, plan-document.js renders it in the document header, and the key is a v4 rename of reportResearch (app.js 9399), so it is present in old drafts.
- research/decisions/001-layout-and-navigation.md is the form and the length to follow.

*Source: Unprioritised: [PDWR] Dates configuration (consider removing the delivery date entirely and estimating it). Fields Verdicts: Execution / Planned Schedule CHANGE (evaluate its value).*

> **Needs Gus or Max:** If the readout becomes an estimate, is it editable? An uneditable ceiling removes the second way out of the ceiling error that RPA-154 built on purpose ('or change the readout date').

### E4.5 Ask how the research questions will be answered

`Story` · `M`

**User story.** As a researcher who knows my questions but not my methods, I want to be asked how I see them being answered, so that what the app suggests starts from my own thinking.

**Acceptance criteria**

- A page asks how the research questions will be answered, offering observation, interviews, experimentation and data analytics.
- The answer is required to leave the page, appears on the check page and in Review, prints, and survives a save and reload.
- The answer appears in the plan document and the Word download under its section.
- The answer saves and restores in the existing draft shape, with no new draft version.
- The field's hint, error wording and help note come from the template, not from code.
- The field keeps an Other option with a free-text box, so a plan whose approach is not one of the four offered can still name it in the author's own words.
- A plan with Other selected and nothing typed is refused, with the error naming the approach field.

**Technical scope**

- Template-first: a field line in research-plan-template.md with a pinned key=, read by parseFieldLine() (app.js 155). A pinned key is what stops a later copy edit renaming it and silently breaking every lookup (the RPA-55 lesson written into that function).
- **Decided 13 October 2026: one approach per plan, asked once for the plan rather than per research question.** That fits the existing radios type and needs no new field type, so the only engineering this ticket ever carried is gone. For contrast, several ticked answers would have needed one — renderFieldOfType() (app.js 5167) offers table, list, custom-fields, checkbox, radios, study-questions and select only; checkbox is a single agreement statement (RPA-115) and the only multi-box control is renderStudyQuestionsField()'s, which is specific to studies.
- **Do not mark the field `closed`.** app.js 4413 builds a radio set as `(field.options || []).concat(field.closed ? [] : ['__other__'])`, so the Other option and its text box appear on every radio field unless the field declares `closed`. Keeping the free-text escape is therefore an omission, not an addition. Other researchers carries `closed` because Yes/No has no third answer; this field is the opposite case.
- submission-contract.js must learn the key in three places: SECTION (line 25), LABEL (line 26) and the types map (lines 108/113). plan-document.js renders by type and needs nothing new.
- Because the field carries an Other option, the contract needs the two-line choice pattern it already uses for Sample Size and the schedule's stage column (submission-contract.js 193-195): first refuse a value that is neither a known approach nor `__other__`, then separately require the `o` text to be non-blank when `__other__` is chosen. Validating the list alone lets a plan through with Other selected and nothing typed.
- New test file, added to package.json's "test" list.

*Source: Unprioritised: Investigating the best approach (new page). Fields Verdicts: Studies / Ways to find info NEW PAGE (ask how people see answering the research questions).*

> **Decided by Gus, 13 October 2026:** one approach per plan, asked per plan rather than per research question, and the free-text Other escape stays. This removes the ticket's only engineering — it is now a template edit plus the contract's Other validation. It also makes this ticket a prerequisite for E2.8, because Methods, Participant criteria and Sample Size are now asked against this answer; see the Phase 1 note in the roadmap.

### E4.6 Suggest methods from the approach the researcher chose

`Story` · `M` · depends on **Ask how the research questions will be answered**

**User story.** As a researcher who has said how I would answer my questions, I want the suggested methods to follow from that answer, so that the suggestions read as a reply rather than a guess.

**Acceptance criteria**

- The method suggestion request carries the chosen approach alongside the objective and the research questions.
- The methods suggested for a question fit the chosen approach, and every one is still a name from research-methods.md.
- A request with no approach is still answered, so plans saved before the page existed keep working.
- The response shape is unchanged: one entry per question, in order, at most three methods each.
- The no-matching-method fallback still behaves as test/rpa-159-no-matching-method.test.js requires.
- An approach the app has never seen — one typed into the Other box — is still answered. The suggestion either returns methods or says plainly that it could not work from that approach, and never fails silently or returns an empty list with no explanation.

**Technical scope**

- Client: suggestMethods() (app.js 3018) posts { objective, researchQuestions } to /api/suggest-methods; renderMethodsSuggest() (app.js 3031) gathers the inputs and checks the response length.
- Server: handleSuggestMethods() (server.js 1358) validates the payload, reads METHODS_FILE through parseMethodsList() (server.js 1221), prompts buildCoveragePrompt() (server.js 1285) with METHODS_COVERAGE_TOOL (server.js 1229), and falls back to GAP_METHOD_TOOL (server.js 1269) with web search for a question left uncovered.
- Add the approach as an optional field in the handler and in buildCoveragePrompt(); keep the 400 for a missing objective or questions and the PILOT_MODE cap of 20 questions (server.js ~1378).
- Server-side name validation stays: the handler only keeps methods whose names match the library, and caps at three.
- **The approach arrives as free text, not as one of four known values**, because the field keeps its Other escape (E4.5, decided 13 October 2026). buildCoveragePrompt() must treat it as the author's own words rather than an enum, and must not branch on a fixed set — an unrecognised approach is the normal case, not an error. The handler's existing name validation remains the guard that keeps a suggested method inside research-methods.md.
- RPA-159 is the precedent for what the page says when nothing comes back: "No matching research methods. You can still enter a method of your own." An approach the model cannot work from needs the equivalent sentence rather than silence. test/rpa-159-no-matching-method.test.js holds that wording for the combobox and is the shape to follow, not the string to reuse.

*Source: Unprioritised: [SWR] Suggest methods based on research question and user input. Fields Verdicts: Studies / Methods KEEP (suggest methods from what the user said about how to answer).*

### E4.7 Suggest methods without waiting for a click

`Story` · `M` · depends on **Suggest methods from the approach the researcher chose**

**User story.** As a researcher arriving at the methods question, I want the suggestions already there, so that I am choosing between options instead of facing an empty list and a button.

**Acceptance criteria**

- Opening a methods page with the objective, at least one question and the approach answered shows suggestions without anyone clicking.
- The suggestion is requested once per unchanged set of inputs; leaving the page and coming back does not ask again.
- Editing a question or the approach either re-asks or marks the shown suggestions as out of date; stale suggestions are never left looking current.
- A failed or unavailable suggestion leaves the page usable, says so in place, and leaves a way to ask again.
- No suggestion is written into the plan: methods are still added by the person, and the existing undo for a mis-clicked suggestion still clears the row.

**Technical scope**

- renderMethodsSuggest() (app.js 3031) already holds the panel, the readiness gate (isReady / updateEnabled) and syncSelection(); the proactive run replaces the click, not the panel.
- Bounds already exist to reuse: evaluationQueue, activeEvaluations and evaluationEpoch (app.js ~1700s) bound concurrent model calls, and RPA-67 covers retries. Staleness has bindEvaluationStaleness() and the assessmentState dataset (app.js ~1900) as its pattern.
- The page-open hook is showPage() (app.js ~7995), which already does per-page work when a page is revealed.
- RPA-162's per-answer assessment is the shape to match: an optional action beside the answer it is about, which never blocks Save and continue. Methods must not become the one place the app acts on its own without saying so.
- Undo path to keep intact: removeMethodFromGroup() (app.js ~2913) and refreshMethodsSuggestSelection() (app.js 2741).

*Source: Unprioritised: [SWR] Suggest methods based on research question and user input (proactive, before the user clicks).*

> **Needs Gus or Max:** A proactive call spends model budget without being asked. Does Max need to approve that for the live pilot? pilot-guard.js and the PILOT_MODE caps were written for the button-driven version.

### E4.8 Keep the methods suggestion on the methods page only

`Bug` · `S`

**User story.** As a researcher answering who should take part, I want the methods suggestion gone from that page, so that the page asks me one thing.

**Acceptance criteria**

- On the Participant criteria page and the Sample Size page, neither the Suggest methods button nor its panel is present in the page.
- On the methods page both are present.
- An open suggestion panel still ticks the rows matching the methods written in that group.
- Save and continue walks the same pages in the same order as before (test/rpa-108-question-pages.test.js and test/rpa-116-methodology-by-question.test.js stay green).

**Technical scope**

- Verified by booting the app through test/app-harness.js: the button's parent chain is `add-btn-row` inside `field field-methods`, and the suggestion panel's parent is `field field-methods` — both outside `.methods-group`.
- Cause: renderMethodsSuggest()'s two nodes are appended to the field wrap in renderGroupedMethodsField() (app.js ~4503). pageUnitsOf() (app.js ~7962) collects only `.methods-group > .field-per-question` for that field, and showPage() (app.js ~7995) toggles `page-hidden` on units and on `.methods-group` elements — so nothing ever hides these two.
- Fix: move them inside the per-group methods field that buildMethodsGroup() builds (app.js ~2805, `.field-question-methods`), or hide them with the page. Moving them per group also makes refreshMethodsSuggestSelection() (app.js 2741) group-local instead of global.
- Add the DOM-readback assertions to the existing methodology test file rather than a new one.

*Source: Unprioritised: [SWR] Remove Suggest Method button from Participants section.*

### E4.9 Retire the Studies section

`Story` · `M`

**User story.** As a researcher with three questions and one study, I want to stop being asked how many studies I will run and which questions each answers, so that I describe the research once.

**Acceptance criteria**

- The form has no Number of studies page and no Study questions page; the task list shows one fewer section and still locks and unlocks in order.
- A draft saved with studies keeps every saved study through autosave and through a JSON backup round trip.
- Uncommenting the template lines brings the section back with its pages, the way test/rpa-117-dormant-theory-actions.test.js proves for Theory.
- A plan can still be submitted: no submission is refused with 'Add at least one study.'
- The unclaimed-question notice from RPA-140 cannot be reached.
- The check page and error messages name the Methodology fields without ' for Study 1'.

**Technical scope**

- Template edit first, which is the cheap part: comment out `# Studies`, Number of studies (key=studyCount) and Study questions (key=studyQuestions) in research-plan-template.md (~lines 333-354), with a note in the RPA-117 form saying why and how to restore. parseSchema() strips comments before parsing (app.js ~270), so the heading disappears with them.
- carryUnrendered() (app.js 8370) is what keeps the saved studies alive once nothing renders them; test/dormant-data.test.js is the regression it was written for (making a field dormant used to delete saved answers).
- Verified consequence, not a guess: with no studyCount cell, syncStudies() (app.js 4301) returns early into syncMethodsGroups() (app.js 2925), whose target is Math.max(PLAN.groupCount([]), 1) — one unlabelled group. Methodology collapses to a single set of Methods, Participant criteria and Sample Size unless this ticket decides otherwise. This undoes RPA-142 deliberately.
- submission-contract.js would otherwise refuse every submission: line 290 adds 'Add at least one study.' when plan.studies is empty, and line 294 checks the count against the saved groups. Keep the wire slots (selects.studyCount at lines 64-68, record() at 238/291) and drop the rules — the permanently empty userGroups slot in PLAN.perQuestionView() (plan-model.js ~195) is the precedent for a slot kept after its field went.
- plan-document.js builds per-study headings (lines 143-153) and must read whatever replaces them.
- Tests to update: rpa-142-studies, rpa-140-unclaimed-question, rpa-120-error-messages, rpa-51-first-question-deletion, rpa-64-contract, rpa-64-ui, rpa-77-word-download.

*Source: Unprioritised: Remove — Number of studies; [SWR] Remove — Studies and Question association. Fields Verdicts: implied cuts (Number of studies, Study questions).*

> **Needs Gus or Max:** Is Methodology then asked once per plan, or once per research question? Once per plan is what the code does on its own today; once per question restores RPA-116's grouping and is real work. This answer also decides ticket 12's shape.

### E4.10 Give deliverables their own page, after the methods

`Story` · `M` · depends on **Retire the Studies section**

**User story.** As a researcher writing my research questions, I want to be asked for deliverables later, once I have chosen methods, so that I am not inventing an output for a question I have not planned yet.

**Acceptance criteria**

- Research Questions and Outcomes are on separate pages, and Save and continue walks them one at a time.
- Outcomes is asked after Methods, and the check page's Change and the task list reach it in that order.
- Review, print and the Word download list deliverables under the section they are now asked in.
- A saved draft keeps its outcomes and restores them in the new place, with no new draft version.
- One question per page still holds for everything else in the flow.

**Technical scope**

- PAGE_PAIRS (app.js 7954) is the pairing, and this is the only pair left — the two plan dates were the other until RPA-144. Emptying it undoes RPA-108 and RPA-122 on purpose; the comment above it should say so and why, in the form of the comment RPA-144 left there.
- Moving the field is a template edit: the Outcomes line (research-plan-template.md ~319) moves out of `# Research`. renderFieldOfType() dispatches on field.key === 'outcomes' to renderLinkedOutcomesField() (app.js 4045), which does not care which section it is in.
- Things that name the key or the section: initOutcomesSync() (app.js 4512) runs at boot and must still find both lists; evaluationSections.research (app.js 1671) lists outcomes as a Research field for assessment; submission-contract.js SECTION (line 25) places it in 'research'.
- Tests to update: rpa-108-question-pages, rpa-122-stacked-pairs, rpa-103-check-answers, rpa-110-edit-and-return, rpa-38-paired-outcome-deletion.

*Source: Unprioritised: Split Questions and Deliverables (move deliverables to the end, after the methods). Fields Verdicts: Studies / Deliverables SPLIT PAGE (format of findings).*

> **Needs Gus or Max:** After Methods inside Methodology, or a section of its own? That decides which section the evaluation control and the contract's SECTION entry name, and whether Review gains a heading.

### E4.11 Stop requiring one deliverable per research question

`Story` · `M` · depends on **Give deliverables their own page, after the methods**

**User story.** As a researcher whose three questions share one report, I want to write the deliverables I will actually produce, so that I am not padding a list to match a count.

**Acceptance criteria**

- A plan with more questions than deliverables is complete and can be submitted; no deliverable row is marked required because a question exists.
- The deliverables page starts with one row, not one per question, and adding or deleting a question neither adds nor deletes a deliverable.
- Deleting a research question no longer deletes a deliverable and no longer asks to.
- Review and the plan document list deliverables as their own list, not paired to question numbers.
- A draft saved while deliverables were row-for-row reads back with every deliverable it held.

**Technical scope**

- PLAN.outcomeCount() (plan-model.js 48) is the row-for-row rule ('outcomes track questions row for row, not answer for answer').
- PLAN.link() (plan-model.js ~208-230) pairs outcomes[n-1] to question n and feeds plan-document.js and the Word download; plan-document.js numbers both lists as ordered lists (line 106) on that assumption.
- The requirement is in submission-contract.js twice — lines 185 and 284: `for (let row = outcomes.length; row < questions.length; row++) add('outcomes', 'required', { row })`. Both go, and the v1 and v2 paths must agree.
- initOutcomesSync() (app.js 4512) pre-grows the list to the question count; addOutcomeRow() (app.js 3837) and the paired deletion behind RPA-38 both go.
- Tests to update: rpa-38-paired-outcome-deletion, rpa-51-first-question-deletion, rpa-64-contract, rpa-120-error-messages, rpa-46-plan-model.

*Source: Fields Verdicts: Studies / Deliverables SPLIT PAGE (not necessary to ask for a deliverable for every question). Unprioritised: Split Questions and Deliverables.*

> **Needs Gus or Max:** Is a deliverable still required at all, or optional? 'Not necessary for every question' does not say whether a plan may have none.

### E4.12 Ask for participants once, on the approach page

`Story` · `M` · depends on **Retire the Studies section**

**User story.** As a researcher recruiting one group of people, I want to describe them once, so that I am not repeating the same criteria under every method.

**Acceptance criteria**

- Participant criteria is asked once, on its own page following the approach question, and is not repeated per study or per question.
- A draft saved with per-study participant criteria restores with every criterion it held, in the single list.
- The check page, the error summary and Review name the field without ' for Study 1'.
- The plan document and the Word download show participants in the section that holds the approach question, beside the Methods and Sample Size answers that share its scope.
- A JSON backup written before the change restores without raising the backup verification warning.

**Technical scope**

- Template: move the Participant criteria line (research-plan-template.md ~389, key=characteristics) to follow the approach question and drop its perQuestion flag. **Decided by Gus, 13 October 2026: it goes on the approach page, not Execution** — this overrides the Fields Verdicts' placement, and it keeps Methods, Participant criteria and Sample Size together as the three fields that share the approach's scope. Note the field is in `# Methodology` today, not Execution: the verdicts would have moved it into Execution, and this decision sends it to the approach pages instead, so it never arrives there and Execution is untouched by the move. parseFieldLine() (app.js 155) reads the flag and renderSection() (app.js 5412) is what pulls flagged fields out of the section and into the groups — so dropping it is what returns the field to the page.
- Storage moves with the flag, so this is not template-only: studiesSnapshot() (app.js ~4126) writes characteristics inside studies[], while an ordinary list is saved by collectDraft() (app.js ~8290) under lists.characteristics. DRAFT_VERSION (app.js 8113) goes 11 to 12 and migrateDraft() (app.js 8468) must lift the criteria out of studies[]. The reverse migration is already there to copy: the v9 block deletes lists.characteristics when the field became per-question (app.js ~8550).
- submission-contract.js: SECTION maps characteristics to 'methodology' (line 25) and the types map calls it a list (line 113). The new slug is the one that holds the approach question, not 'execution' — SECTION routes a submission error to a section that has to exist, so getting this wrong files the error under a section the form does not have. PLAN.perQuestionView() (plan-model.js 183) unions characteristics across the studies covering a question and loses its input.
- Values are read and written per group today by perQuestionValue() (app.js 2862) and renderPerQuestionField() (app.js 2834); both stop applying to this field.
- Tests to update: rpa-116-methodology-by-question, rpa-118-sample-size, rpa-142-studies, rpa-46-plan-model, rpa-64-contract, dormant-data.

*Source: Unprioritised: [SWR] Reorganise participants and studies (decouple participants from studies, define them upfront, consider drag-and-drop mapping). Fields Verdicts: Execution / Participant criteria CHANGE (specify relevant characteristics); Studies / Ways to find info (split participants from their characteristics).*

> **Decided by Gus, 13 October 2026:** Participant criteria goes on the approach page. Sample Size moves with it — all three of Methods, Participant criteria and Sample Size hang off the one per-plan approach answer, so they travel together and none stays behind in Execution or Methodology. The drag-and-drop mapping falls away rather than being decided: with one approach per plan and no studies, there is nothing left to map participants to. Mapping them to research questions would be a new feature and is not in this ticket.

### E4.13 Build the planned schedule from stage durations

`Story` · `L` · depends on **Decide whether the plan still asks for a delivery date**

**User story.** As a researcher filling in a schedule, I want to say how long each stage takes rather than pick two dates for it, so that the timeline follows from estimates I can actually make.

**Acceptance criteria**

- Each stage is answered with a start and a duration; its completion date is computed and shown, not typed.
- The timeline draws from the computed dates and keeps its day, week and month scales.
- A stage computed to finish after the readout is flagged with the existing ceiling message and its remedy link.
- A draft and a JSON backup written with start and completion dates restore as start plus duration without losing a stage or a date.
- An untouched schedule is still reported as not provided, and the five prefilled stages still arrive with the plan's own two anchors already in place.
- The schedule still prints, and the Word download still contains it.

**Technical scope**

- The field is one template line: `Planned Schedule (table, prefill, row=stage, key=stageTimeline): Stage:select:stage=… | Start Date:date:startDate | Completion Date:date:completionDate` (research-plan-template.md 425). A duration cell is a new column type — parseColumns() (app.js ~1228) and buildRow() (app.js 1263) handle status, select, file, date, prose and text only — so this one is genuinely code.
- Code that reads those three column keys by name: renderTimelineChart() (app.js 3376), applyTimelineAnchors() (app.js 1463), attachDateRangeConstraint() (app.js 1250), rowMinimumFor() and applyTimelineFloor() (app.js ~8940-8960), applyTimelineCeiling() (app.js 8889), scheduleNotStarted() (app.js 6830) and localCompletionErrors() (app.js 9089).
- Saved shape: table cells are snapshotted by collectDraft() (app.js ~8309) and restored by position, and submission-contract.js types stageTimeline as a table (line 113).
- Defaults: applyTableDefaults() (app.js 1428), bindPrefillClearing() (app.js 1404) and the prefill flag's row-per-stage behaviour (RPA-76) all have to keep working against the new column.
- Tests to update: rpa-76-stage-timeline-defaults, rpa-59-timeline-ceiling, rpa-59-timeline-floor, rpa-65-timeline-scales, rpa-144-clamp-reaches-the-timeline, rpa-53-timeline-visibility, rpa-160-untouched-table-not-provided, rpa-77-word-download.

*Source: Unprioritised: [SWR] Planned Schedule Redesign and Timeline Bug Fixes (replace fixed completion dates with estimated durations; per-study durations). Fields Verdicts: Execution / Planned Schedule CHANGE (automate and simplify visualisation).*

> **Needs Gus or Max:** 'Per-study durations' assumes studies exist. With the Studies section retired, is a duration per stage, or per research question? If this ticket cannot be split small enough once answered, the duration column and the timeline rewrite should become two branches.

### E4.14 Offer a schedule before being asked

`Story` · `M` · depends on **Build the planned schedule from stage durations**

**User story.** As a researcher who has chosen methods and a readout date, I want a schedule already proposed, so that I am adjusting an estimate instead of building one from nothing.

**Acceptance criteria**

- Arriving at the Planned Schedule with the readout set and methods chosen shows proposed stage durations with nothing typed by the person.
- A proposed value is marked as a default: the first edit to that cell replaces it, and an edited cell is never overwritten by a later proposal.
- The proposal fits inside the readout ceiling, so it raises no ceiling error of its own.
- Clearing the form or deleting a stage does not bring the proposal back over an edit.
- The timeline drawn from the proposal is the same one the plan prints.

**Technical scope**

- The marking already exists and is the whole safety of this feature: isPrefilled() and wasTouched() (app.js 1389 / 1393), applyTableDefaults() (app.js 1428), bindPrefillClearing() (app.js 1404), and the `open()` test inside applyTimelineAnchors() (app.js ~1478) written for exactly this — 'a suggestion may fill a cell that is still marked as a default, and also one that is simply empty'.
- The two anchors the plan already knows are in applyTimelineAnchors() (app.js 1463): the plan's creation date into the first stage's start, the readout into the last stage's completion. The proposal extends that, it does not replace it.
- test/rpa-76-stage-timeline-defaults.test.js and test/rpa-160-untouched-table-not-provided.test.js hold the default-versus-edited contract this must not break.

*Source: Unprioritised: [SWR] Planned Schedule Redesign and Timeline Bug Fixes (proactive timeline suggestion). Fields Verdicts: Execution / Planned Schedule CHANGE (automate and simplify visualisation).*

> **Needs Gus or Max:** Computed locally from the methods and the two dates, or asked of the model like the methods suggestion? Local needs no server route and no pilot budget.

### E4.15 Show less on the Planned Schedule page

`Story` · `S` · depends on **Build the planned schedule from stage durations**

**User story.** As a researcher looking at my schedule, I want fewer things on the page at once, so that I can see the shape of the plan without reading a grid of controls.

**Acceptance criteria**

- The page shows the stages, their durations and the timeline; anything that only repeats what the timeline already says is gone.
- The field's hint is one instruction rather than a list of rules.
- The timeline's show and hide choice still persists, and the chart still renders for print whatever the on-screen choice is.
- Nothing that was required to complete the section becomes unreachable from the page.

**Technical scope**

- The page's parts are built in renderTableField()'s stageTimeline branch (app.js ~3679): the Visualise Timeline button, the chart element, updateTimelineVisibility and the beforeprint/afterprint hooks that render it for printing and restore the person's choice afterwards.
- The hint and error wording are template lines on the Planned Schedule field (research-plan-template.md 425-429) — that part is a template edit.
- test/rpa-53-timeline-visibility.test.js holds the show/hide and print behaviour; test/rpa-119-field-words.test.js and test/rpa-119-remaining-field-words.test.js hold the field-wording contract.

*Source: Unprioritised: [SWR] Planned Schedule Redesign and Timeline Bug Fixes (decrease information). Fields Verdicts: Execution / Planned Schedule CHANGE (simplify).*

> **Needs Gus or Max:** Which of the stage columns can go? That is a design call on the redesigned table, not something the current page answers.


## E5-signoff

Epic 5 — Sign-off, completion and sharing. Fewer screens between finishing a plan and approving it; the requester identified by the absolute minimum; initials and dates the form already knows filled in rather than asked for; a clear ending for people who never use sign-off; the plan's links in one place; and feedback moved off the page people finish on. Scope is set by the Alignment statement's purpose (eliminate non-essential questions, resolve inefficient workflows, deliver a more intuitive and effortless form) and bounded by two facts verified in the repo: the sequential sign-off over HTTP exists (sign-off-server.js, routes /api/sign-off and /api/sign-off/read registered in server.js lines 1648-1649) but is gated off and app.js never calls it, and plan-store.js writes to a local directory whose own comment says "Render's disk forgets on redeploy". So everything buildable now is browser-local, and the half of the link feature that needs a hosted plan or a hosted Word document is recorded as a decision rather than drafted as work.

### E5.1 Ask for the project requester once, as an email address

`Story` · `M`

**User story.** As someone preparing a plan for approval, I want to give the project requester's email address and nothing else, so that I am not naming the same person twice to answer one question.

**Acceptance criteria**

- Plan details no longer asks for the project requester's name, and the Plan details step reads as complete without it.
- The sign-off names the requester in its state lines, its link block and its declaration either by email address or by role, never as an empty name or a stray "the ".
- A draft saved by an earlier build with a requester name keeps that value through a save, a reload and a backup download-and-restore round trip.
- An active plan validates and sends with the field absent, and a receipt stored before the change still reads back without being reported as an unsupported structure.
- The Word document and the print view show the Sign-off table with both roles, and the Plan details table without a requester row.

**Technical scope**

- research-plan-template.md line 213: comment out `Project requester (text, name, width=20, question=Who requested this research?, key=projectRequester)` and its Hint, Error, Help and four Guidance lines, with a dated note saying why and how to restore — the RPA-117 pattern already used at template lines 302-307 (Hypothesis), 358-365 (Theory) and 428-431 (Action Points).
- Values already saved under the key are carried by `carryUnrendered` in app.js (line 8370), which is why the field is commented out rather than deleted.
- submission-contract.js: follow the `comments` precedent rather than bumping the schema. Keep `projectRequester` in `FIELDS` (line 20) so the wire shape and old receipts are untouched; add a `delete types.projectRequester` guard in `matchesSchema` beside the existing `comments` and `userGroups` guards (lines 118-121), because `matchesSchema` compares `fields.length` against `Object.keys(types).length` exactly; and drop the key from the required list in `validateV2` (line 273). `validateLegacy` (line 172) stays as it is. No new `SCHEMA` value, so `structureForSchema` and `validateForSchema` (lines 339, 335) are untouched.
- app.js `signOffPersonNamed(role)` (line 6274) reads `[data-field="projectRequester"]`, and `signOffPersonName` already falls back to "the project requester". Check the fallback reads well in `draw()`'s state lines, in `linkHead`/`linkHint` and in `otherLabel` (renderSignOff, lines 6530-6625) rather than adding code.
- No new draft slot is needed: the requester's email already persists inside `signOffRecord.parties`, which `collectDraft` writes as `signOff` (app.js line 8331).
- plan-document.js `signOffBlocks` (line 159) pairs each checkbox with the next non-checkbox field, so the Sign-off table is unaffected; only the Plan details `pairs` rows change.
- New test file, added to the explicit list in package.json's `test` script. Existing files that touch this: test/rpa-146-first-name-and-surname.test.js, test/rpa-139-sign-off-pages.test.js, test/rpa-64-contract.test.js, test/rpa-151-v2-submission.test.js, test/dormant-data.test.js.

*Source: USC "[SOWR] Define required requester information"; Fields Verdicts IMPLIED CUTS (Project requester); Fields Verdicts Review row "Declaration Project requester CHANGE — send the link by email"*

> **Needs Gus or Max:** Is RPA_SUBMISSIONS_ENABLED true on the live pilot deployment? `matchesSchema` counts template fields exactly, so if submissions are on, the contract guard must ship in the same commit as the template change or Send breaks for pilot users. Max to confirm.

### E5.2 Fill the sign-off initials and date when the declaration is ticked

`Story` · `M`

**User story.** As a lead researcher signing my own plan, I want my initials and today's date filled in from the name I already gave, so that signing is a tick rather than retyping what the form already knows.

**Acceptance criteria**

- Ticking a declaration fills that role's sign-off box with initials derived from the matching Plan details name, when the box is empty.
- The filled value carries the date in the existing " — DD/MM/YYYY" form, so the contract's `datedSignOff` check passes without the person leaving the field.
- A person can overwrite the filled initials; an overwritten value is still dated, and is still refused when it breaks the ten-character limit or the allowed characters of RPA-153.
- Clearing a declaration does not erase initials that were typed by hand.
- A role whose Plan details name is blank leaves its box empty, and the existing "Enter your initials to sign this plan" error still applies.
- Filling a box does not mark the plan as edited or knock a signed plan back to draft.
- Restoring a draft and retrying a frozen submission snapshot do not re-date anything, as `prepareSubmissionSignOffs` already guarantees.

**Technical scope**

- app.js `attachSignOffStamp(input, key)` (line 5031) and `stampSignOff(input)` (line 5057) today only append the date on blur; they gain the fill step and a trigger on the declaration checkbox rather than on blur alone.
- The names come from the `name`-type fields at template lines 188 (`key=leadResearcher`) and 213 (`key=projectRequester`); `signOffPersonNamed(role)` (app.js line 6274) already reads them by `[data-field="<role>"]`, and `buildNameField` keeps the joined value on `.name-whole` (app.js around line 5476).
- `SIGN_OFF_FIELDS` (app.js line 6169) already pairs each declaration key with its initials key, so the fill needs no new mapping. The checkboxes are rendered by `renderSignOff` via `renderField(byKey[...declaration])` (line 6324).
- `INITIALS_MAX`, `INITIALS_SHAPE` and `initialsProblem` (app.js lines 5044-5051) stay the only judge of an acceptable value; `signOffInitialsInput` (line 5053) is how the required-group checks reach it.
- `planContent` (app.js line 8347) already deletes both declaration and both initials keys from the content hash, which is why filling a box cannot trigger a new revision — assert this rather than change it.
- `prepareSubmissionSignOffs` (app.js line 5065) stamps on a deliberate Send only; keep that restriction.
- The two sign-off fields stay in the template rather than going dormant: submission-contract.js requires a dated value under `signOffResearcher` and `signOffProjectOwner` (validateV2 lines 273-275) and plan-document.js `signOffBlocks` (line 159) reads them for the Word document's "Signed" column. The verdict's "ask once" is met by filling them, not by cutting them.
- research-plan-template.md Hint lines 512 and 521 say "type your initials" and must say what now happens.
- New test file, added to package.json's `test` script. test/rpa-153-initials-limit.test.js and test/rpa-115-declaration.test.js must still pass unchanged.

*Source: USC "[SOWR] Auto-fill initials and date"; Fields Verdicts Review row "Declaration Lead researcher CHANGE — we already asked for the name, ask once"; Fields Verdicts IMPLIED CUTS (the two separate Sign-off initial fields)*

> **Needs Gus or Max:** What initials come out of a name — "Jane Smith" to "JS" is obvious, but a one-word name, a double-barrelled surname and a name in a non-Latin alphabet are not, and `stampSignOff` currently uppercases whatever is there. Gus to settle the rule. Also: once the requester has no name (previous ticket), does their box stay typed, derive from the email local-part, or stay empty?

### E5.3 Merge the sign-off's role and declaration screens into one

`Story` · `M` · depends on **Fill the sign-off initials and date when the declaration is ticked**

**User story.** As someone finishing a plan, I want to say which of the two people I am and sign in the same place, so that starting a sign-off is two screens rather than three.

**Acceptance criteria**

- Starting a sign-off presents the role question and that role's declaration and sign-off box on one screen, then the other person's email address on a second; there is no third screen.
- Choosing a different role on the merged screen shows that role's declaration and sign-off box, and does not carry a tick or a value across from the other role.
- Continue from the merged screen is refused with the existing error summary, linked and marked at the field, when the declaration is unticked or the sign-off box is empty.
- Back from the email screen returns to the merged screen with the chosen role and its tick and value intact.
- Nothing is committed until the final action: abandoning the flow part-way leaves no sign-off record, as today.
- Focus moves to the sign-off heading on every move between the two screens.

**Technical scope**

- app.js `renderSignOff` (line 6284): the `setupStep` state ('role' | 'sign' | 'send'), `chooseRole`, `toSend`, `back(step)` and `create` (lines 6424-6487), and the `if (!record)` branch of `draw()` (lines 6550-6578) which sets `roleField.hidden`, `otherField.hidden` and `pairs[setupRole].hidden`.
- The role radios, their legend and their help note are built in `renderSignOff` itself (lines 6329-6360), not read from the template, so their wording changes here.
- `pairs` is built once per role from `SIGN_OFF_FIELDS` (line 6322); the merged screen needs the pair to follow the radio's `change` event, which nothing currently listens for.
- `judge(role)` and `groupsOf(role)` (app.js lines 6414-6420) already scope validation to one role's `.sign-off-pair`; `say`/`clearSaid` (lines 6388-6412) are the error summary.
- style.css `.review-signoffs` (line 535) is a two-column grid holding both pairs with one unhidden; `.sign-off-pair[hidden]` is line 574.
- test/rpa-139-sign-off-pages.test.js asserts the current three-step order and reads `.sign-off-actions` button labels and `.sign-off-state`; it is rewritten, not extended.

*Source: USC "[SOWR] Sign-off Workflow Redesign" (simplify, decrease number of screens); Fields Verdicts Review rows — both declarations CHANGE, "bring tick mark to previous page, merge pages"*

> **Needs Gus or Max:** "Bring the tick mark to the previous page" has two readings: move the declaration onto the role screen (what this ticket assumes), or lift it out of the sign-off panel onto the review summary above it. The review summary and the sign-off are the same step (`renderReviewStep`), so the second reading means something different again. Gus to confirm which he meant.

### E5.4 Show the author their own plan link beside the requester's

`Story` · `S`

**User story.** As the person who wrote the plan, I want a link to my own copy as well as the one I send, so that both of us hold a link to the same plan instead of only the other person.

**Acceptance criteria**

- The author sees a link of their own alongside the link addressed to the other person, each labelled with whose it is.
- Each link can be copied independently, and the copy status says which one was copied.
- Withdrawing one link leaves the other working, and issuing a new one replaces only that role's link.
- A link opened in the same browser still resolves to the role the record holds for it, and an unrecognised or withdrawn link still opens nothing of the plan.
- The block still says plainly that a link cannot be emailed yet and only opens in this browser.

**Technical scope**

- app.js `renderSignOff`'s `linkBlock` (built at lines 6305-6316, populated in `draw()` at lines 6620-6657) reads only `record.parties[other]` and hides itself unless `viewerIsAuthor`; it gains the author's own party.
- No state-machine change is needed: `create()` already mints a token for both roles (`tokens` at app.js line 6471), plan-workflow.js `party()` (line 123) stores one per role, `roleForToken` (line 130) resolves either, and the `issueLink`/`revokeLink` transitions (line 236) already take a `forRole`.
- `linkUrlFor(token)` (app.js line 6194), `newLinkToken()` (line 6190), `resolveLink()` (line 6200) and `copyLink(url)` (line 6517) are reused unchanged; `sayLinkStatus` writes into the single `.sign-off-link-status` region, which now has two sources.
- style.css `.sign-off-link` and its parts (lines 548-556).
- test/rpa-137-links.test.js asserts the hint wording at its lines 150-151; both sentences must survive.

*Source: USC "[SOWR] Create link function (new feature)" — the part that is a link shared with both the creator and the requester, to the web version of the plan*

> **Needs Gus or Max:** Should the author be able to withdraw their own link, or only the one they sent? Gus to decide.

### E5.5 Move Give feedback into the options menu

`Story` · `M`

**User story.** As someone part-way through a plan, I want to report a problem with the tool from wherever I am, so that feedback is one press away instead of waiting at the end of the last page.

**Acceptance criteria**

- The tool feedback form can be opened from every step without leaving the current page or losing unsaved writing.
- The review step no longer ends with a feedback button.
- The form's answers still carry no `data-field`, so they appear in neither the saved draft, nor a downloaded backup, nor the print view.
- The submission panel and its error summary still render in their documented order on the review step.
- With feedback collection unavailable, the entry says so and offers no file exchange, exactly as today.

**Technical scope**

- app.js `renderToolFeedback` (line 5724) builds the `.tool-feedback` section with its `Give feedback` toggle (line 5726); `renderReviewStep` appends it at line 6139.
- `mountSubmissionPanel` (app.js line 9023) finds `.tool-feedback` and inserts the submission summary and panel *before* it (lines 9046-9047), so moving the section breaks that insertion point and it must be re-anchored.
- `initOptionsMenu` (app.js line 8060) and the `.menu-group` blocks in index.html (lines 50-62, beside Download backup / Restore backup / Clear Form) are where a menu entry goes; the menu closes on any button press except Restore (app.js lines 8078-8081).
- `capabilities.feedback` gating is at app.js lines 5791, 5813, 5840 and 5861; the POST is to `/api/feedback` (line 5869), registered in server.js line 1646 behind the `feedback` capability.
- style.css `.tool-feedback` and its parts (lines 581-592) assume a block at the end of a page, and the print rule at line 1002 hides `.tool-feedback`; both need revisiting for a menu-opened panel.
- test/rpa-98-tool-feedback.test.js, test/rpa-106-options-menu.test.js and test/rpa-92-header-footer.test.js all read this area; new test file added to package.json's `test` script.

*Source: USC "Find a better location for feedback" (the Give feedback button is on every page and adds clutter)*

> **Needs Gus or Max:** The source item says the Give feedback button is on every page. In the code it is rendered once, at the end of the review step (app.js line 6139). What actually repeats on every page is the global footer's "Problems or feedback" column (index.html line 108) and the beta banner's "please share any feedback" line (index.html line 70). Gus to confirm which clutter he meant before anything moves — the answer may make this a footer ticket instead.

### E5.6 Record what a shared link to the plan and its Word document requires

`Task` · `S`

**User story.** As Max or Gus deciding what to fund next, I want one page saying which half of the link feature can be built now and which cannot, so that the epic stops carrying an item nobody can start.

**Acceptance criteria**

- The record states which part of the link feature is buildable without new infrastructure and which is not, and names the ticket each unbuildable part waits on.
- It names the code that already exists and is unreachable: the HTTP sign-off routes and the plan store, and the fact that nothing in app.js calls them.
- It states whether a shared Word document would be hosted or regenerated per view, and what each choice costs.
- It states what a link must survive — a redeploy, a withdrawn link, a plan edited after the link was sent — so a later ticket can be written against it.
- The epic's remaining link tickets reference it.

**Technical scope**

- New file under research/decisions/, following the shape and headings of research/decisions/001-layout-and-navigation.md (Context, Decision, Why not, Consequences, Open questions).
- Cite sign-off-server.js: it implements the transitions over HTTP (its own header says "Off unless RPA_SIGN_OFF_ENABLED is exactly \"true\""), server.js registers `/api/sign-off` and `/api/sign-off/read` at lines 1648-1649 behind `CAPABILITIES.signOff` (server.js line 67), and a grep of app.js finds no call to either route — the whole workflow runs in the browser against plan-workflow.js.
- Cite plan-store.js, whose header says the local directory is "the first destination, not the last: Render's disk forgets on redeploy", and whose conditional-write contract any durable store must reproduce.
- Cite the Word path: `downloadWord` (app.js line 9620) and plan-document.js build the .docx in the browser from the live draft, so there is no document to link to; `renderKeepCopy` (app.js line 9679) is where the review step offers it today.
- Cite research/pilot/release-proposal-2026-09-15.md, which already recorded that live shared review needs an agreed mutable, versioned durable record, and research/pilot/operating-decisions-2026-09-15.md line 126.

*Source: USC "[SOWR] Create link function (new feature)" — the Word-document half, and the link to a plan another person can open; Fields Verdicts Review row "Declaration Project requester CHANGE — send the link by email"*

> **Needs Gus or Max:** The brief names RPA-136 and RPA-147 as the open infrastructure tickets. The code cites RPA-136 for the server-held plan and RPA-84 for emailing a link (app.js lines 6198, 6305; test/rpa-137-links.test.js lines 150-151), and nothing in the repo mentions RPA-147. Gus to confirm which key is which before the record names them.

### E5.7 Add a completion action to the review step

`Story` · `L` · depends on **Record what a shared link to the plan and its Word document requires**

**User story.** As someone who has filled in a plan and is not sending it for approval, I want a clear way to say I have finished, so that the last page has an ending instead of only a sign-off I will not use.

**Acceptance criteria**

- The review step offers one primary completion action, above the Keep a copy block.
- Pressing it records that the author considers the plan finished, and the state survives a reload and a backup round trip.
- The task list shows that state on the review row and in its progress line, distinctly from "Approved" and from "Not signed".
- Editing the plan afterwards is still allowed and no step becomes locked by it, consistent with decision record 001 rejecting hard forward-locks.
- Clearing the form clears the state, as it already clears the sign-off record.
- With submissions enabled, the action does not duplicate or pre-empt Send plan.

**Technical scope**

- app.js `renderReviewStep` (line 6007) composes the step in order: the summary list, `renderKeepCopy` (line 6020), extras, `renderSignOff`, `renderCommentsReveal`, `mountSubmissionPanel`, `renderToolFeedback`. The new action goes above `renderKeepCopy`.
- `reviewSummaryOf(reviewEl)` (app.js line 6778) derives the review step's completeness from `workflow().isApproved(signOffRecord)` outside submissions mode and from the required groups inside it; a completion state must feed it without claiming approval.
- `refreshTaskList` (app.js line 7495) prints "You have completed N of M sections" and replaces the review row's status with `signOffTag(signOffRecord)` (line 6260) when submissions are off; the new state needs its own tag there.
- Persistence: `collectDraft`'s return (app.js line 8329) is where the `signOff` record already rides; a completion flag needs a sibling slot, a `migrateDraft` step, and clearing in `clearForm` (line 9748) beside `signOffRecord = null`. `planContent` (line 8347) must exclude it so marking a plan finished is not an edit.
- `stepLocked(i)` (app.js line 6791) must not gain a lock from it.
- test/rpa-100-task-list.test.js, test/rpa-148-last-updated-on-task-list.test.js and test/rpa-139-sign-off-pages.test.js all read the review row's status; new test file added to package.json's `test` script.

*Source: USC "[SOWR] Add completion button to screen" (no way today for a user to say they have finished; add a clear primary action)*

> **Needs Gus or Max:** What does finishing mean when sign-off is the plan's real ending? Is this action for people who will never use sign-off, is it reversible, and does it change anything the two other parties see? Gus and Max to settle this before the state is designed — the draft slot, the task-list tag and whether it survives an edit all follow from the answer, which is why this is sized L.


## E6-evaluation

Epic 6 — The evaluation and feedback model: move feedback from the section to the answer, make the guidance describe what the assessment actually scores, build the refinement slice behind a reviewed contract, and settle the filler-input guardrail against decision record 001 instead of around it. RPA-162 already delivered the per-answer model for Context (Background, Goal, Problem Statement) and removed Context's section-level action; the remaining build is Research (Objective, Research Questions, Outcomes), the deletion of the last section-level action, and the refinement slice ADR 001 explicitly deferred. The guidance-alignment work is almost entirely research-plan-template.md and research-plan-rubric.md content, which is the cheapest work in the epic and should not be dressed up as engineering. The guardrails item contradicts ADR 001 in terms, so it is drafted here as a decision to be taken, with an advisory implementation behind it.

### E6.1 Assess the Objective answer beside the answer

`Story` · `M`

**User story.** As a researcher writing my Objective, I want the assessment to sit under the answer I just wrote, so that I get feedback on that answer without running a whole-section evaluation.

**Acceptance criteria**

- Objective shows an "Assess this answer" action under its editor, instead of appearing only as "Retry Objective" behind the section action.
- An Objective assessment request carries fieldKey `objective`, the text currently in the box, and exactly the criteria written under `# Objective` in research-plan-rubric.md, in their order.
- A returned Objective result opens beside the answer and can be collapsed and reopened without issuing a second request.
- Editing Objective after a result marks that result out of date and relabels the action to "Update evaluation", as Context does.
- "Continue and return later" appears for Objective when its feedback is weak, unavailable or out of date, records a reminder for the session, and runs the same Save and continue validation as the button it stands beside.
- Neither moving between fields nor Save and continue issues an Objective assessment request.
- While "Evaluate research" still exists, running it refreshes Objective's existing panel rather than producing a second result.
- test/rpa-162-context-assessment.test.js passes unchanged.

**Technical scope**

- app.js: `renderEvalControls` (line 1789) decides the entire per-answer flow from `const contextField = evaluationSections.context.includes(field.key)` (line 1794). Replace that membership test with a per-field flag so Objective takes the same path, and rename the `contextField` local and the `updateContextState` helper to section-neutral names — what they guard is per-answer behaviour, not Context.
- app.js: `btn.hidden = sectionField` and the `txt.textContent` ternaries appear twice, in `renderEvalControls` (lines 1796-1797) and again in `controls._resetEvaluation` (lines 2239, 2244). Both decide whether a field offers its own button and both must agree for Objective.
- app.js: the `.context-answer` wrapper and the `.context-field-position` "N of 3" label in the scalar field renderer (lines 5291-5298) count from `evaluationSections.context`; derive the position from the field's own section list instead.
- style.css: rename the `context-*` rules to section-neutral names — `.context-field-position` (1005), `.context-answer .context-assessment` (1006, 1013), `.context-assessment-heading` (1007), `.context-assessment-note` (1008), `.context-review-reminder` (1009), `.context-return-later` (1010, 1013), `.context-clear-reminder` (1011), the `[hidden]` rule (1012), `.context-assessment .eval-result-btn` (1015), `.context-result-label` (1016) — and the print rule that hides them (line 1001).
- No template or rubric change: Objective already carries the `eval` flag in research-plan-template.md (line 292) and has three criteria under `# Objective` in research-plan-rubric.md.
- Note for the two tickets after this one: `renderEvalControls` has four call sites — the scalar renderer (5292), `renderListField` (4031), `renderLinkedOutcomesField` (4069) and the Methods renderer (4499, dormant because Methods carries no `eval` flag today). Only the scalar one adds the per-answer wrapper.
- New test file modelled on test/rpa-162-context-assessment.test.js, using `bootApp({ evaluate })` and `app.evaluationRequests` from test/app-harness.js; add it to the `test` script in package.json, which lists every test file explicitly.

*Source: Unprioritised Suggested Changes: "Redefine evaluation (major ticket)" — field-level feedback instead of section-level. Fields Verdicts: Research / Objective (MERGE, "simplify flow — Objective and Questions").*

> **Needs Gus or Max:** Fields Verdicts marks Objective MERGE with Research Questions. If the merge puts them on one page, does Objective keep its own assessment action or share one with the questions? Drafted here as its own action.

### E6.2 Assess Research Questions and Outcomes beside their answers

`Story` · `L` · depends on **Assess the Objective answer beside the answer**

**User story.** As a researcher, I want to assess my questions and my deliverables each where I wrote them, so that per-entry feedback appears next to the entries it is about instead of behind one section button.

**Acceptance criteria**

- Research Questions and Outcomes each show their own "Assess this answer" action, both on the page that holds the pair.
- A Research Questions request still carries numbered entries plus the Objective as context; an Outcomes request still carries numbered entries, the Objective and the numbered Research Questions.
- Per-entry scoring and 1:1 question-to-outcome pairing are unchanged: each entry keeps its number and its own metrics, and a single entry scoring 1 still caps the panel's overall label.
- Editing an entry, adding or removing a row, or editing the Objective marks the affected panel out of date without clearing its result.
- "Continue and return later" on either field records a session reminder and continues through the same Save and continue validation.
- The fourth-question recommendation still appears on the list and is not displaced or replaced by the assessment controls.
- Neither field issues a request while it is empty, and no request is issued by navigation or by Save and continue.
- test/rpa-56-structured-score-guardrail.test.js and test/rpa-39-evaluation-staleness.test.js pass unchanged.

**Technical scope**

- app.js: `renderListField` appends eval controls at line 4031 and `renderLinkedOutcomesField` at line 4069, neither with the per-answer wrapper or position label the scalar renderer adds at 5292. Apply the same treatment in both.
- app.js: `evaluationRequest` (line 1514) already sends `entries`, `context.objective` and, for outcomes, `researchQuestions` via `collectNumberedListValues`. The payload needs no change — only the control that triggers it moves.
- app.js: the extra staleness listener registered beside `evaluationFields.set` for researchQuestions and outcomes (from line 2112) re-marks these panels when the Objective or the questions change. Confirm it still fires once the controls are per-answer.
- app.js: `makeListWarning` (line 3759) appends its `.rq-warning` node as the list's last child and re-appends it when a row arrives; confirm the per-answer controls are not placed inside `.list-rows`, which would displace it.
- app.js: `PAGE_PAIRS = [['researchQuestions', 'outcomes']]` (line 7954) puts both fields on one page, so two per-answer actions and two panels share that page — check the heading and focus order there.
- server.js: unchanged. `researchQuestionsEvalTool`, `outcomesEvalTool`, `buildResearchQuestionsPrompt`, `buildOutcomesPrompt`, `formatResearchQuestionResult`, `formatOutcomesResult` and `QUESTION_SET_CRITERIA` already score per entry.
- score-classification.js: unchanged. `classifyEvaluation` already caps the aggregate label when a metric with `scope: 'entry-quality'` scores 1.
- Extend the test file added by the Objective ticket, or add one beside it, and list it in package.json.

*Source: Unprioritised Suggested Changes: "Redefine evaluation (major ticket)". Fields Verdicts: Research / Research Questions (KEEP, "simplify how we ask... split question and deliverable") and Studies / Deliverables (SPLIT PAGE).*

> **Needs Gus or Max:** Fields Verdicts splits Deliverables onto its own page and says a deliverable is not needed for every question. Outcomes is special-cased in app.js to track Research Questions 1:1 by position, and the rubric's Alignment criterion compares Outcome N with Question N. If the split breaks the pairing, that criterion and the paired rows lose their basis — does the split land before or after this ticket?

### E6.3 Retire the section-level evaluation action

`Task` · `M` · depends on **Assess Research Questions and Outcomes beside their answers**

**Decided by Gus, 13 October 2026:** this deletion is agreed, and it is the whole answer to E2.6's question about the renamed section's button. It also moves earlier than its phase suggests: E2.6 cannot rename Context while a slug-named button exists, and this ticket cannot land until Research has per-answer actions (E6.2). The chain is E6.2 → this → E2.6.

**User story.** As a researcher, I want one way to ask for feedback, so that I am not offered a section button and a per-answer action that do the same thing.

**Acceptance criteria**

- No section renders a section-level evaluation action: no element carrying `data-evaluate-section` appears anywhere in the form.
- Every field the template marks `eval` offers its own per-answer action.
- The shared limit of two concurrent assessment requests still holds, and Clear Form, a profile change and a successful backup import still abort work in flight.
- The review step still reports evaluation currency per section, and a stale evaluation still counts towards a completed section.
- Print output is unchanged apart from the removed action.
- All eleven test files that reach for a section-level control are reconciled, and package.json's `test` list matches the files on disk. Counted on main: test/rpa-34-section-evaluation.test.js (asserts the button's text is 'Evaluate research'), test/rpa-38-paired-outcome-deletion.test.js:188 (asserts exactly one `.section-eval-btn`), test/rpa-56-structured-score-guardrail.test.js, test/rpa-63-evaluation-panel-polish.test.js and test/rpa-78-british-english.test.js (each calls `.querySelector('.section-eval-btn').click()` unguarded, so they throw on null rather than failing with a message), test/app-characterization.test.js, test/rpa-36-optional-recommendations.test.js and test/rpa-39-evaluation-staleness.test.js (fall back to the section button only when the per-field control is hidden), test/rpa-150-rubric-binding.test.js and test/rpa-162-context-assessment.test.js (multi-selector, degrade quietly), and test/rpa-114-character-count.test.js (see the style.css bullet). Naming only rpa-34 understates this by ten files.

**Technical scope**

- app.js: delete `renderSectionEvaluation` (line 1715) and its only call site, `if (evaluationSections[section.slug] && section.slug !== 'context') fieldsWrap.appendChild(renderSectionEvaluation(section.slug))` (line 5431).
- app.js: remove the `evaluationBatches` map (line 1683) and its plumbing — the `evaluationBatches.set` inside `renderSectionEvaluation`, the `evaluationBatches.get(sectionKey)?.refresh()` in `runEvaluation`'s `refreshSection` (around line 1997), and the `evaluationBatches.forEach(batch => batch.reset())` in `resetEvaluationWork` (line 1708). Keep `evaluationEpoch`, `drainEvaluations` (1689), `queueEvaluation` (1701) and `evaluationControllers`: the per-answer flow uses all four.
- app.js: keep `evaluationSections` itself. `sectionSummary` (line 5977) reads it for the review step's currency counts, and the per-answer position label reads it for "N of N".
- style.css: remove `.section-evaluation` (line 749) and drop `.section-evaluation` from the print rule at line 953. No `.section-eval-btn` or `.section-eval-status` rules exist to remove.
- **Do not edit that print rule without reading test/rpa-114-character-count.test.js:85 first.** It finds the rule by slicing the stylesheet at the literal string `.section-evaluation,.field-eval-progress` and then asserts `.word-count,` appears in what follows. Remove the first selector and `indexOf` returns -1, `slice(-1)` yields one character, and the assertion fails for a reason that has nothing to do with word counts. Either keep the selector order so the anchor survives, or change the test to anchor on `.field-eval-progress`.
- package.json: drop test/rpa-34-section-evaluation.test.js from the `test` list if it is retired.
- research/decisions/001-layout-and-navigation.md: add a "Resolved since" note. Its existing "Resolved since: section evaluation actions (RPA-34)" entry, approved by Max on 7 September 2026, is what this supersedes, and the record should not be left claiming two section actions exist.

*Source: Unprioritised Suggested Changes: "Redefine evaluation (major ticket)" — field-level feedback instead of section-level.*

### E6.4 Align each field's guidance with the criteria its answer is scored against

`Task` · `M`

**User story.** As a researcher reading the help on a field, I want it to describe exactly what the assessment will score, so that following the guidance raises the score instead of surprising me.

**Acceptance criteria**

- For every field the template marks `eval`, each criterion under that field's heading in research-plan-rubric.md is addressed by that field's Hint or Guidance lines.
- No guidance point promises something that no criterion for that field scores.
- The scored-but-unwritten set criteria for Research Questions — Duplication, Coherence, Alignment and Overall Scope — are either declared in the rubric file and covered by guidance, or removed from scoring.
- A new test fails when a criterion is added to the rubric with nothing in that field's guidance covering it, and when a field's guidance names a criterion that does not exist for it.
- The mapping from guidance point to criterion is written down in the repo, so a reword can be checked rather than remembered.
- No scoring criterion is copied into app.js: guidance stays in the template, criteria stay in the rubric file.
- test/rpa-119-field-words.test.js, test/rpa-119-remaining-field-words.test.js, test/rpa-78-british-english.test.js and test/no-placeholder-guidance.test.js still pass.

**Technical scope**

- Purely content: research-plan-template.md and research-plan-rubric.md, plus one new test. No app.js or server.js behaviour changes. This is the cheapest work in the epic.
- research-plan-template.md: the Hint and Guidance lines for background (line 256), goal (267), problemStatement (277), objective (292), researchQuestions (308) and outcomes (319).
- The divergences as they stand: Background's guidance names "Relevant context / Essential terms / Tight focus" while its rubric names "Contextual Relevance / Essential Knowledge / Focus"; Goal's names "The change / The future product state / Outcome over research" against "Product Outcomes / Result-Oriented / Defines the Future Product State"; Objective's names "User behaviour and needs / A decision to make / A manageable scope" against "User Understanding / Actionable / Feasible"; Research Questions' names "Target audience / User experience / Specific task" against "Clear / Focused / Specific". Problem Statement has four criteria (Clarity, Specificity, Feasibility, Significance) against three bulleted guidance points, with Feasibility only in the closing sentence. Outcomes is already close: "Direct alignment / Specific format / Action-oriented" against "Actionable / Format / Alignment".
- server.js: `QUESTION_SET_CRITERIA` (line 425) scores a set of research questions on Duplication, Coherence, Alignment and Overall Scope. These four are hardcoded in server.js, appear in no editable file, and no guidance anywhere mentions them — a researcher cannot know they are being scored on them.
- server.js: `CRITERION_EXAMPLES` (line 435) calibrates the model's bar for three criterion names — 'User Understanding', 'Actionable' and 'Feasible'. The map is keyed by criterion name, so renaming any of those in the rubric silently drops its calibration.
- app.js: no change needed. `parseRubric` (line 398) and `attachRubrics` (line 422) bind criteria to fields by `toCamelKey` of the rubric heading, and `renderFieldHelp` (line 4576) renders `field.guidance` as written.
- New test in the shape of test/no-placeholder-guidance.test.js (a static read of the template and rubric). test/rpa-150-rubric-binding.test.js already guards the heading-to-field join and its header explicitly defers this audit to a ticket. Add the new file to package.json's `test` list.

*Source: Unprioritised Suggested Changes: "Align guidance with scoring metrics (major ticket)". Fields Verdicts: Research Details / Background (KEEP, "specify what info the user must provide") and Problem Statement (KEEP, "specify what info to provide before evaluation") — both de-duplicated into this ticket.*

> **Needs Gus or Max:** Which side moves: does the guidance adopt the rubric's criterion names, or do the criteria adopt the guidance's plainer words? Renaming a criterion also drops its CRITERION_EXAMPLES calibration in server.js, so Gus and Max should pick a direction before the rewrite starts. And: are the four question-set criteria kept and declared, or dropped?

### E6.5 Agree the contract for optional refinement before any provider work

`Task` · `S`

**User story.** As Max, I want refinement's payload, limits and cost agreed and written down before it calls a model, so that we are not discovering the bill or the behaviour in a live pilot.

**Acceptance criteria**

- A decision record in research/decisions/ states which fields offer refinement, the request and response shape, the maximum output size, the concurrency and rate limits it shares or holds, and the expected cost per request.
- The record defines "preserves the author's wording and intent" as a checkable rule, so the implementation has something a test can assert.
- The record states what happens to an existing assessment result when a refinement is accepted: whether the panel goes out of date or is cleared.
- The record states whether refinement is available in the live pilot, and by which switch it is turned off.
- The record is approved by Max before implementation starts, as the Context per-answer workflow was on 5 October 2026.
- No provider call, route or UI is added by this ticket.

**Technical scope**

- research/decisions/: a new record numbered after 001-layout-and-navigation.md, in the same shape. ADR 001's closing section already requires this: "Optional refinement is a separate slice: its rewrite endpoint, payload, limits, cost and accept/reject/edit behaviour require a reviewed contract before real provider use." This ticket is that contract.
- Decide the route name and its place in server.js's `API_ROUTES` (line 1643), and whether it takes a capability key in `CAPABILITIES` (line 67). That key is the switch that makes the 403 in the server's route dispatch fire before any handler or body listener runs.
- Decide whether the route joins the pilot's AI list in pilot-guard.js `allowRequest` — `['/api/evaluate', '/api/suggest-framework', '/api/suggest-methods']` (line 88). That list is what applies the 30-requests-a-minute cap and the RPA_AI_ENABLED pause; a route left off it has neither.
- Decide the call's `max_tokens` against the budgets already in server.js: 1024 for a scalar evaluation, 2048 for the structured ones.
- No app.js, style.css or template change.

*Source: Unprioritised Suggested Changes: "Redefine evaluation (major ticket)" — the refinement half, "suggestions like a proofreader that preserve the user's wording and intent". ADR 001's closing note deferring this slice.*

> **Needs Gus or Max:** The cost ceiling, and whether refinement runs in the live pilot at all. Only Gus and Max can settle that — the pilot is deployed by hand from a chosen commit, so a feature that is cheap on main can be expensive the moment it is picked up.

### E6.6 Refine an answer without losing the author's words

`Story` · `L` · depends on **Agree the contract for optional refinement before any provider work**

**User story.** As a researcher whose answer scored poorly, I want an optional suggested rewrite I can accept, edit or reject, so that I can improve the answer without being told to start again or having my meaning replaced.

**Acceptance criteria**

- The refinement option appears only after an assessment has returned for that field, and never replaces the Assess action.
- Asking for a refinement never changes the answer on its own: the suggestion is shown beside the answer until the author accepts it.
- Accepting a suggestion puts it in the field through the same update path as typing, so the draft saves and the existing assessment result goes out of date.
- Rejecting a suggestion leaves the answer exactly as it was, to the character.
- An accepted suggestion can be edited in the field afterwards like any other text.
- A refinement that fails or is unavailable says so and leaves the answer untouched.
- Refinement is hidden and disabled when its capability is off, and in the pilot it is rate-limited and pausable exactly as evaluation is.
- The suggestion is marked as machine-written where it is shown, as the framework draft panel marks its own.

**Technical scope**

- server.js: add the handler and its entry in `API_ROUTES` (line 1643), with the capability key the contract agreed added to `CAPABILITIES` (line 67). Follow `handleEvaluate` (line 791) for body reading via `readJsonBody` (line 144), cancellation via `res.on('close', cancel)`, and `PilotAIError` handling through `aiError` (line 187).
- pilot-guard.js: add the route to the AI list in `allowRequest` (line 88) if the contract says so, or the 30-a-minute cap and the RPA_AI_ENABLED pause will not apply to it. test/rpa-89-pilot-restrictions.test.js iterates that same list and should be extended.
- app.js: render the control inside `renderEvalControls` (line 1789) beside the existing `.eval-actions`, so it inherits the per-answer panel, and gate it with `restrictAction(button, '<capability>')` (line 602) and `capabilityNote` (line 611), as the framework library button does.
- app.js: accept by writing to the input and calling `dispatchFieldUpdate` (line 9862) — the path the framework panel's "Use this framework" button already uses, and the one that makes `bindEvaluationStaleness` (line 2270) mark the result out of date.
- app.js: queue the request through `queueEvaluation` (line 1701) so it shares the limit of two concurrent provider calls, and register its AbortController in `evaluationControllers` so `resetEvaluationWork` (line 1708) aborts it on Clear Form, profile change and backup import.
- style.css: the suggestion block, following `.fw-draft` and `.fw-warn` for a machine-written proposal and `.field-warning` (line 342) for its caveat.
- New test files: the server side in the shape of test/rpa-67-bounded-evaluation-retries.test.js, the UI side in the shape of test/rpa-162-context-assessment.test.js. Add both to package.json's `test` list.

*Source: Unprioritised Suggested Changes: "Redefine evaluation (major ticket)" — refinement suggestions that read like a proofreader and preserve the user's wording and intent.*

> **Needs Gus or Max:** Which fields offer refinement first. Background and Problem Statement carry the most prose, but the Fields Verdicts ask for a sentence template on Background ("As part of the project___, we are trying to ____ in order to ____ because _____"), which may be better served by a template than by a rewrite.

### E6.7 Decide whether weak answers may block Save and continue

`Task` · `S`

**User story.** As Gus, I want the guardrail proposal settled against the recorded decision that rejected forward-locks, so that an architecture decision is not quietly reversed in a feature branch.

**Acceptance criteria**

- A decision record states whether an answer judged to be filler may block progression, and if so on what signal: a length rule, a scoring threshold, or a model judgement.
- The record quotes and answers ADR 001's rejection of hard forward-locks, including its reasoning that a gate produces filler rather than thinking.
- The record distinguishes the rules that already block on emptiness — the required-answer check and the task list's section lock — from a quality gate that would block on judgement, and says whether that distinction holds.
- The record says what happens to someone whose honest answer is wrongly judged filler.
- If the decision is not to block, the record says what the app does instead, and the advisory route is the one implemented.
- Approved by Max before any blocking behaviour is built.

**Technical scope**

- research/decisions/001-layout-and-navigation.md: the conflict is in "Why not lock the sequence" — "The gate does not produce thinking; it produces filler that satisfies the gate" — and in its statement that this is consistent with evaluation being always optional and never blocking movement between sections. A new record must either amend that or be refused by it.
- What exists today, for the record to reason about: `requiredGroupComplete` (app.js line 6908) and `fieldHasContent` (line 5957) judge presence, not quality, so any non-blank character already passes and "Test" is already a complete answer; `showStepErrors` (line 6982) draws the error summary; `stepLocked` (line 6791) locks a section until every earlier section is complete.
- Precedents the record should weigh: the word count under a textarea is advisory and never a limit (`renderWordGuide`, app.js line 4663); the fourth-question notice warns and adds the row anyway (`makeListWarning`, line 3759, and test/rpa-61-question-warning.test.js); RPA-162 made assessment advisory and offered "Continue and return later" rather than a block.
- No app.js, server.js, template or rubric change in this ticket.

*Source: Unprioritised Suggested Changes: "Guardrails for incomplete user input" — block progression on filler like "Test".*

> **Needs Gus or Max:** This ticket is the question. The source item asks to block progression on filler; ADR 001 rejected exactly that, in terms. Only Max and Gus can settle it, and nothing should be built either way until they have.

### E6.8 Warn about filler answers without blocking Save and continue

`Story` · `M` · depends on **Decide whether weak answers may block Save and continue**

**User story.** As a researcher who typed "Test" to get past a field, I want the form to tell me that answer will not survive into the plan, so that I fix it when I know the answer instead of being locked out while I do not.

**Acceptance criteria**

- An answer that looks like filler draws a visible, announced warning at the field, and Save and continue still works.
- The warning clears as soon as the answer stops looking like filler.
- What counts as filler is declared in one place and needs no provider call.
- A genuine short answer in a field with no word guidance is not warned about.
- The warning is separate from the required-answer error: an empty field still gets its template Error line, and the two never appear together for the same field.
- The warning does not appear in print output.
- The review step and the task list report a warned field as answered, since completion asks whether the work was done, per ADR 001.

**Technical scope**

- app.js: reuse `makeListWarning`'s pattern (line 3759) — a `role="status"`, `aria-live="polite"` node built once and left in the document, emptied rather than hidden, with `.field-warning` toggled by class and text together. RPA-61 established all three: a region inserted and filled in the same breath is announced unreliably, and assistive technology ignores a hidden region.
- app.js: hang the check off the same `input` and `change` listeners `bindEvaluationStaleness` uses (line 2270), or the field's existing input handling, rather than adding a new event path.
- app.js: leave `requiredGroupComplete` (line 6908), `fieldHasContent` (line 5957), `missingGroups` and `showStepErrors` (line 6982) untouched — the warning must not enter the error summary or change what counts as complete, which `sectionSummary` (line 5977) and `stepLocked` (line 6791) read.
- style.css: `.field-warning` already exists (line 342, with its `[hidden]` and `⚠` rules at 343-344); add the warning to the print-hiding rules beside the advisory furniture at lines 953 and 1001.
- New test file; add it to package.json's `test` list.

*Source: Unprioritised Suggested Changes: "Guardrails for incomplete user input" — drafted as the advisory route, which is the one ADR 001 permits.*

> **Needs Gus or Max:** The filler rule itself and its wording: a minimum length, a stop-list, or a check that the answer is more than one word. A length rule will be wrong about a short honest Goal, which has a 30-word guide rather than a floor, so Gus should settle both the rule and the sentence the warning says.

---

# Decisions taken — 13 October 2026

Gus answered these seven on 13 October 2026; they are no longer open. Each is recorded on the ticket it affects as well.

- **One approach per plan, with its free-text escape** (E4.5) — the form asks how the research questions will be answered, offering four approaches plus Other, once for the plan rather than per research question. This removes the ticket's only engineering: one answer fits the existing radios type, and the Other box comes free because app.js appends it to every radio set that is not marked `closed`.
- **Methods, Participant criteria and Sample Size are asked per approach** (E2.8) — they hang off that one answer, so all three are asked once with no loop and no per-approach grouping to build. E4.5 therefore has to land before the Studies retirement, which is earlier than its drafted phase.
- **Section-level evaluation is dropped everywhere** (E2.6, E6.3) — RPA-162's per-answer "Assess this answer" becomes the only way to ask for feedback, so the slug-named "Evaluate research-details" button problem disappears with the button. E6.3 is the ticket that does it, and it has to precede the section rename.
- **MISSION.md is canonical** (E1.1) — the external Doc becomes a drafting surface, and research/README.md's no-mirror rule gains an explicit written exception for this one file.
- **Participant criteria goes on the approach page, not Execution** (E4.12, E2.6) — this overrides the Fields Verdicts' placement, and keeps Methods, Participant criteria and Sample Size together as the three fields sharing the approach's scope. Execution keeps the Planned Schedule, Previous Knowledge and its Additional information hatch.
- **The six sections are Entry, Research Details, Research, Studies, Execution, Review** (E1.3) — Context becomes Research Details and takes Project decision with it, and Methodology dissolves: Methods to Studies, Participant criteria and Sample Size to Execution. Decision record 002 carries this list, and must carry the per-approach scope and the dropped section evaluation with it.
- **The eight never-audited fields inherit October's one-line reasoning** (E1.5) — the three protocol questions are deliberately not re-run for them, and the audit says so in as many words.

Two consequences for the order of work, both recorded on the tickets and in the roadmap:

- E4.5 (the approach page) moves ahead of E2.8 (retiring Studies).
- E6.2 → E6.3 → E2.6: Research needs per-answer actions before the section button can go, and the button has to go before Context is renamed.

# Open decisions — 42 tickets carry one

No ticket with an open question should be started before it is answered.

- **Run the field-audit drift check in CI** (E1) — A Python step in a Node CI job makes the suite depend on the runner's python3, and the repo has no other Python in its test path.
- **Record the field cut as decision 003 and settle the fields the verdicts do not name** (E2) — The verdicts name 16 fields and the implied-cut list covers 9, but the template declares 32 — so Goal, Sample Size, Research readout, Last updated and the four 'Additional information' hatches are unaccounted for.
- **Let the submission contract accept a plan without the cut fields** (E2) — Bump SCHEMA to a v3 and keep v2 as a second legacy validator, or relax v2 in place? A bump means three validators to maintain; relaxing in place means the live pilot build and this build disagree about whether the same plan is valid.
- **Make the five header identity fields dormant** (E2) — plan-workflow.
- **Merge Objective into Research Questions** (E2) — Method suggestion is currently driven by objective plus the research questions.
- **Infer the research title from the plan's answers** (E2) — Inference needs Background and Problem Statement, which sit in Research Details — the section after Entry.
- **Agree one shape for help notes and rewrite the six assessed fields to it** (E3) — Where should the pattern live — the template's header comment, which is where a template editor already looks, or a decision record in research/decisions/, which is where a reviewer looks? Gus to pick one so there is a single place to check against.
- **Ask research questions as questions, and show one** (E3) — Is a hint and an example enough, or does Gus want a soft nudge in the row itself? A hard validation would contradict decision 001's rejection of gates, so that option should be ruled in or out explicitly.
- **Cut the footer back to what a person needs on arrival** (E3) — Does "bottom banner" mean this footer, or the `.
- **Call each section the same thing in the form and in the downloaded document** (E3) — Which name wins for the last section — "Review", which the template's comment defends as a moment rather than a section, or "Sign-off", which is what the document a stakeholder reads already says? Gus and Max to settle, since the stakeholder-facing name is the one that matters here.
- **Rewrite the Methods help note to name families of methods, not niche techniques** (E3) — The item says "descriptions" plural.
- **Give every field a help note that says what is behind it** (E3) — Do the five Additional information hatches each need a note, or does the hatch rework remove the question entirely? Settle this with the hatch ticket so the same words are not written twice.
- **Show a strong and a weak example on the fields that can hold one** (E3) — Does a weak example help or does it plant the wrong shape? The panel labels the two "Good" and "Bad", so a field can be given only a `Good:` line if Gus would rather not show a bad answer at all.
- **Say what Background and Problem Statement need before they are assessed** (E3) — The verdict says "explore a template" for Background.
- **Rename the fields whose titles repeat their section instead of naming their answer** (E3) — Seven of the fields whose titles repeat their section are on the Fields Verdicts implied-cut list.
- **Make Additional information read as one quiet hatch rather than three repeats** (E3) — Does every section still need a hatch, or does it belong only where pilot authors actually used one? The pilot drafts would answer that, and dropping three hatches is a bigger win than rewording five.
- **Place the section name the same way on every page of the form** (E3) — Where should the section name go: above the question as a caption, folded into the question itself, or dropped on pages where the question already says which section it belongs to? This is Gus and Max's call, and it should be settled before the branch opens — the code change is small once the placement is chosen.
- **Refuse plan dates that are already in the past** (E4) — Does the floor apply to the Planned Schedule's stage dates too? timelineFloor() only warns there on purpose — a plan written up weeks after the work began has real stages that predate the document.
- **Say when the readout and decision dates are more than a month apart** (E4) — Warn or refuse? The ceiling between these two dates is already hard (the readout is clamped), but decision 001 rejects gates that produce filler.
- **Fix the readout date being moved with nothing shown** (E4) — The source line names a bug without describing it.
- **Decide whether the plan still asks for a delivery date** (E4) — If the readout becomes an estimate, is it editable? An uneditable ceiling removes the second way out of the ceiling error that RPA-154 built on purpose ('or change the readout date').
- **Suggest methods without waiting for a click** (E4) — A proactive call spends model budget without being asked.
- **Retire the Studies section** (E4) — Is Methodology then asked once per plan, or once per research question? Once per plan is what the code does on its own today; once per question restores RPA-116's grouping and is real work.
- **Give deliverables their own page, after the methods** (E4) — After Methods inside Methodology, or a section of its own? That decides which section the evaluation control and the contract's SECTION entry name, and whether Review gains a heading.
- **Stop requiring one deliverable per research question** (E4) — Is a deliverable still required at all, or optional? 'Not necessary for every question' does not say whether a plan may have none.
- **Build the planned schedule from stage durations** (E4) — 'Per-study durations' assumes studies exist.
- **Offer a schedule before being asked** (E4) — Computed locally from the methods and the two dates, or asked of the model like the methods suggestion? Local needs no server route and no pilot budget.
- **Show less on the Planned Schedule page** (E4) — Which of the stage columns can go? That is a design call on the redesigned table, not something the current page answers.
- **Ask for the project requester once, as an email address** (E5) — Is RPA_SUBMISSIONS_ENABLED true on the live pilot deployment? `matchesSchema` counts template fields exactly, so if submissions are on, the contract guard must ship in the same commit as the template change or Send breaks for pilot users.
- **Fill the sign-off initials and date when the declaration is ticked** (E5) — What initials come out of a name — "Jane Smith" to "JS" is obvious, but a one-word name, a double-barrelled surname and a name in a non-Latin alphabet are not, and `stampSignOff` currently uppercases whatever is there.
- **Merge the sign-off's role and declaration screens into one** (E5) — "Bring the tick mark to the previous page" has two readings: move the declaration onto the role screen (what this ticket assumes), or lift it out of the sign-off panel onto the review summary above it.
- **Show the author their own plan link beside the requester's** (E5) — Should the author be able to withdraw their own link, or only the one they sent? Gus to decide.
- **Move Give feedback into the options menu** (E5) — The source item says the Give feedback button is on every page.
- **Record what a shared link to the plan and its Word document requires** (E5) — The brief names RPA-136 and RPA-147 as the open infrastructure tickets.
- **Add a completion action to the review step** (E5) — What does finishing mean when sign-off is the plan's real ending? Is this action for people who will never use sign-off, is it reversible, and does it change anything the two other parties see? Gus and Max to settle this before the state is designed — the draft slot, the task-list tag and whether it survives an edit all follow from the answer, which is why this is sized L.
- **Assess the Objective answer beside the answer** (E6) — Fields Verdicts marks Objective MERGE with Research Questions.
- **Assess Research Questions and Outcomes beside their answers** (E6) — Fields Verdicts splits Deliverables onto its own page and says a deliverable is not needed for every question.
- **Align each field's guidance with the criteria its answer is scored against** (E6) — Which side moves: does the guidance adopt the rubric's criterion names, or do the criteria adopt the guidance's plainer words? Renaming a criterion also drops its CRITERION_EXAMPLES calibration in server.
- **Agree the contract for optional refinement before any provider work** (E6) — The cost ceiling, and whether refinement runs in the live pilot at all.
- **Refine an answer without losing the author's words** (E6) — Which fields offer refinement first.
- **Decide whether weak answers may block Save and continue** (E6) — This ticket is the question.
- **Warn about filler answers without blocking Save and continue** (E6) — The filler rule itself and its wording: a minimum length, a stop-list, or a check that the answer is more than one word.
