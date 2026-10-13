# October redesign

**Draft, 13 October 2026.** Phase 0 is raised in Jira under epic RPA-167; the
other 51 tickets are proposals awaiting Gus's and Max's review, and no branch is
open for any of them.

The app is being made shorter: fewer pages, fewer fields, and a flow that asks
each thing once. The decisions themselves were made outside this repo — in the
field audit, in a Miro board, and in Gus's October review notes. This folder is
where they become work the repo can act on.

| Reader | Document | Purpose |
| --- | --- | --- |
| Gus and Max | [Roadmap and tickets](roadmap-and-tickets.md) | The whole proposal: 57 tickets, six epics, seven phases |
| Anyone opening a branch | [Roadmap and tickets § The tickets](roadmap-and-tickets.md#the-tickets) | One ticket each: user story, acceptance criteria, technical scope |
| Gus and Max, first | [Roadmap and tickets § Open decisions](roadmap-and-tickets.md#open-decisions--42-tickets-carry-one) | The 42 tickets that cannot start yet, and what each is waiting on |
| Anyone wondering what was settled | [Roadmap and tickets § Decisions taken](roadmap-and-tickets.md#decisions-taken--13-october-2026) | The seven decisions of 13 October and the two orderings they changed |
| An AI session picking up this work | This README, then the roadmap's "How to read this" | What is decided, what is not, and what the code already constrains |

## Status

- **57 tickets drafted. 42 carry an open question** that only Gus or Max can
  answer. No ticket with an open question should be started before it is
  answered — the question is usually the design decision, not a detail.
- **Seven decisions were taken on 13 October 2026**, listed in the roadmap's
  "Decisions taken" section and recorded on each ticket they affect. They answered
  seven questions, reordered two chains of work, and settled one conflict between
  two of them.
- **Fifteen tickets carry no open question, and ten of those can start today** —
  E1.1, E1.2, E1.3, E1.4, E1.5, E2.3, E3.2, E4.5, E4.6 and E4.8. The other five
  (E2.6, E2.8, E2.9, E4.12, E6.3) are clear in themselves but wait on a ticket
  that still carries a question.
- **Phase 0 is where the work starts, and five of its six are startable** —
  everything except E1.6, which waits on Max's call about Python in a Node CI job.
- **Phase 6, the UI and visual redesign, is deliberately not drafted.** Changing
  the flow and the look in the same stretch of work means never knowing which one
  caused a problem.

## In Jira

Phase 0 only. Raised 13 October 2026 under epic **RPA-167** — Foundations and
documentation for the October redesign. Every other phase is still a draft.

| Ref | Jira | Type | Blocked by |
| --- | --- | --- | --- |
| E1.1 | RPA-168 | Story | — **startable** (MISSION.md is canonical) |
| E1.2 | RPA-169 | Task | RPA-168, itself now startable |
| E1.3 | RPA-170 | Story | — **startable** (the six sections are settled) |
| E1.4 | RPA-171 | Task | RPA-172, itself now startable |
| E1.5 | RPA-172 | Story | — **startable** (the eight inherit the one-liner) |
| E1.6 | RPA-173 | Task | RPA-172, plus Max on python3 vs Node |

`Ready` is this project's only not-started status, so it does not mean startable.
The 13 October decisions cleared the questions on RPA-168, RPA-170 and RPA-172,
so five of the six — all but RPA-173 — can now be picked up. RPA-173 still waits
on Max's call about Python in a Node CI job.

## The section model, settled

The six sections, in order, are **Entry, Research Details, Research, Studies,
Execution, Review**. Context becomes Research Details and takes the Project
decision field with it. Methodology dissolves — Methods to Studies, Participant
criteria and Sample Size to Execution — and no Methodology heading survives.
Methods, Participant criteria and Sample Size all sit with the approach question
rather than being split between Studies and Execution — that placement overrides
the Fields Verdicts, which had put Participant criteria under Execution. Execution
keeps the Planned Schedule, Previous Knowledge and its Additional information
hatch, so it is not emptied by the move.

Decision record 002 carries this list, and every ticket that renames, moves or
evaluates a section cites it rather than guessing.

Nothing now blocks a whole epic. One question still holds a single ticket:
**Python in a Node CI job, or port the drift check to Node** — Max's call, and
the only thing holding E1.6.

Two orderings changed as a result of the decisions, and both cross phases:

- **E4.5 before E2.8.** Methods, participant criteria and sample size now hang off
  the approach answer, so the page that asks for it has to exist before Studies is
  retired. The approach page is a template edit, so moving it early is cheap.
- **E6.2 → E6.3 → E2.6.** Dropping section-level evaluation means Research needs
  per-answer actions before the button can go, and the button has to go before
  Context is renamed — otherwise the rename ships a button reading
  "Evaluate research-details".

## What the code already decided

`main` has moved since the tickets were written: `origin/main` is `b906cd6`,
where RPA-166 takes the service header out of sticky positioning. The roadmap's
front matter records what that changed.

Four findings from grounding the tickets in the repo at `cc5c1fc`. The roadmap
carries them in full; in short:

1. `submission-contract.js` blocks the cut in two places, and the second one
   throws rather than reporting. The required-key lists hard-require seven of the
   fields on the cut list, so they must be loosened **before** any of them goes
   dormant or every new plan fails validation in `pretest`. Beneath them a
   structural pass runs first and calls `bad()` — `throw new Error('Invalid
   submission structure')` — when `studies` or the `studyCount` select is absent,
   and rejects a bumped `version` outright. So a plan without the cut keys raises
   an exception instead of returning errors. Both passes move in one commit, and
   this sets the order of Phase 1.
2. `python3 research/field-audit-gen.py` exits 1 on `main` today — the audit has
   drifted from the template, and the eight fields it never covered are the ones
   October rules on. The drift checker is wired into nothing.
3. [Decision record 001](../decisions/001-layout-and-navigation.md) is stale
   beyond the issue we knew about, and one ticket amends it.
4. A `Good:` / `Bad:` example panel already exists in the template machinery and
   is used by zero fields. The "clear examples" item needs no engineering.

## Conventions

- Field decisions come from the October field verdicts, which are **authoritative**
  for what each field becomes. Where a suggested change restated a field decision
  it was folded in, not listed twice; the roadmap's de-duplication map records
  where every suggestion landed.
- `dependsOn` names the ticket that must land first. `openQuestion` is for Gus or
  Max and nobody else — an AI session should surface it, not answer it.
- A field is cut by making it **dormant**, not deleted: commented out of
  `research-plan-template.md` with a note saying why and how to restore it. This
  is the pattern established by RPA-117.
