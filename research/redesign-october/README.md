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
| Gus and Max, first | [Roadmap and tickets § Open decisions](roadmap-and-tickets.md#open-decisions--49-tickets-carry-one) | The 49 tickets that cannot start yet, and what each is waiting on |
| An AI session picking up this work | This README, then the roadmap's "How to read this" | What is decided, what is not, and what the code already constrains |

## Status

- **57 tickets drafted. 49 carry an open question** that only Gus or Max can
  answer. No ticket with an open question should be started before it is
  answered — the question is usually the design decision, not a detail.
- **Eight tickets carry no open question, and three of those could start today** —
  E2.3 (derive the tests' section and field inventory from the template), E3.2
  (take the participant bands out of the Sample Size help note) and E4.8 (keep the
  methods suggestion on the methods page only). The other five wait on a ticket
  that does carry a question.
- **Phase 0 is still where the work should start.** All six of its tickets are
  documentation, none touches the app, and nothing in a later phase has to land
  first — but four of the six need an answer before they can be written.
- **Phase 6, the UI and visual redesign, is deliberately not drafted.** Changing
  the flow and the look in the same stretch of work means never knowing which one
  caused a problem.

## In Jira

Phase 0 only. Raised 13 October 2026 under epic **RPA-167** — Foundations and
documentation for the October redesign. Every other phase is still a draft.

| Ref | Jira | Type | Blocked by |
| --- | --- | --- | --- |
| E1.1 | RPA-168 | Story | — (needs the mirror question answered) |
| E1.2 | RPA-169 | Task | RPA-168 |
| E1.3 | RPA-170 | Story | — (needs the section names settled) |
| E1.4 | RPA-171 | Task | RPA-172 |
| E1.5 | RPA-172 | Story | — (needs the protocol question answered) |
| E1.6 | RPA-173 | Task | RPA-172 |

`Ready` is this project's only not-started status, so it does not mean startable.
Four of the six carry a question in a warning panel at the foot of the
description; those four should not be picked up before it is answered.

## Two questions block whole epics

1. **The page and section model** — October's group names and the template's
   section headings do not line up. Until this is settled as decision record 002,
   every ticket that renames, moves or evaluates a section is guessing. The
   evaluation button takes its label from the section slug, so the names are not
   cosmetic.
2. **What Methods, Participant criteria and Sample Size are asked *per*,** once
   the Studies section is retired — the plan as a whole, each research question,
   or the new approach page. E2, E4 and E6 all wait on this one answer.

## What the code already decided

`main` has moved since the tickets were written: `origin/main` is `b906cd6`,
where RPA-166 takes the service header out of sticky positioning. The roadmap's
front matter records what that changed.

Four findings from grounding the tickets in the repo at `cc5c1fc`. The roadmap
carries them in full; in short:

1. `submission-contract.js` hard-requires seven of the fields on the cut list.
   It must be loosened **before** any of them goes dormant, or every new plan
   fails validation in `pretest`. This sets the order of Phase 1.
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
