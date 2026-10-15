# 002 — The page and section model for the October redesign

**Date:** 14 October 2026
**Status:** Accepted
**Tracked in:** [RPA-170](https://turingtestable.atlassian.net/browse/RPA-170)
**Supersedes parts of:** [001 — Layout and navigation](001-layout-and-navigation.md)

## Context

001 settled how the plan is navigated: one section at a time, free movement,
nothing gated. It deliberately did not settle what the sections are. It assumed
the fields themselves were essential — *"the current fields are considered
essential, so the field audit is scoped to sequencing and optionality rather
than deletion"* — and scoped deletion out.

The October audit tested that assumption and it did not hold. Of the 32 fields
the form declares, 16 are kept. The audit also moved questions between sections,
split one page in two, added a page that did not exist, and retired a section.

That is more change than a field audit can carry on its own. Every ticket that
renames a section, moves a question, or decides what a page asks needs one
agreed structure to cite, or each one re-decides it. This record is that
structure.

The field-by-field reasoning lives in
[research/field-audit.md](../field-audit.md) and the implementation order in
[research/redesign-october/](../redesign-october/). This record covers only what
the sections are, what each page asks, and the consequences that bite code.

## Decision

**Six sections, in this order: Entry, Research Details, Research, Studies,
Execution, Review.**

Email address keeps its own page in front of everything, as RPA-99 built it. It
is not a section; it is the question the app asks before it will show a plan.

### What each of today's headings becomes

The template declares six `#` headings plus a title field that behaves as a
seventh step. Mapped onto the new set:

| Today | Becomes | Change |
| --- | --- | --- |
| `# Research title` and the nine fields under it, shown as the step "Plan details" | **Entry** | Renamed. The step is hardcoded in `app.js` as the title *Plan details* and the slug `plan-details` in three places — lines 6053, 7566 and a date-error link whose `href` is `#plan-details` at line 8861 — so this rename is code, not a template edit, and the third one is a navigation target that breaks silently if it is missed |
| `# Context {open}` | **Research Details** | Renamed, and gains Project decision from Entry |
| `# Research` | **Research** | Name unchanged. Objective merges into Research Questions; Deliverables splits onto its own page |
| `# Studies` | **Studies** | Name unchanged, contents almost entirely replaced. Number of studies and Study questions retire. It gains the new approach question and, with it, Methods, Participant criteria and Sample Size |
| `# Methodology` | **removed** | Its three live fields move to Studies behind the approach question. Its dormant Theory line stays commented out where it is |
| `# Execution` | **Execution** | Unchanged by this record. It keeps Planned Schedule, Previous Knowledge and its Additional information hatch |
| `# Review` | **Review** | Unchanged by this record |

Execution is worth a note because the field audit proposed otherwise. Its
verdicts moved Participant criteria from Methodology into Execution. **Gus
decided on 13 October 2026 that Participant criteria goes on the approach page
instead**, so it never arrives in Execution and Execution is untouched. See "Why
not the verdicts' placement" below.

### The page rule

**One question per page.** Pairing is the declared exception, and it is declared
in exactly one place: `PAGE_PAIRS` in `app.js` (line 7954), today
`[['researchQuestions', 'outcomes']]`, consumed at line 7983. Anything
that wants two questions on one page adds a pair there; nothing else in the form
decides page composition.

Two changes in this redesign go through that constant:

- **Deliverables splits onto its own page**, which empties `PAGE_PAIRS`. The
  pairing it holds today was built deliberately under RPA-108 and RPA-122; this
  record undoes it knowingly rather than by accident.
- **Objective merges into Research Questions.** That is a field merge, not a
  pairing — two questions become one question, so nothing is added to
  `PAGE_PAIRS`.

### New pages, and what leaves

**New:** one page asking how the research questions will be answered — the
approach. It offers four approaches and keeps a free-text Other, and it is
asked **once per plan**, not per research question.

Methods, Participant criteria and Sample Size are asked **against that one
answer**, each once. There is no loop and no per-approach grouping: one approach
per plan means one set of ordinary plan-level fields, with the `perQuestion` flag
removed from Participant criteria and Sample Size and nothing put in its place.

**Split:** Deliverables, off the Research Questions page and onto its own.

**Retired:** Number of studies, and the Study questions page that looped per
study. With studies gone there is nothing for participants or methods to be
mapped to, so the drag-and-drop mapping the audit floated falls away rather than
being decided against.

**A deliverable is no longer asked for every research question.** Outcomes is
positionally paired 1:1 with Research Questions today, and the rubric's Alignment
criterion compares Outcome N with Question N. Both lose their basis when the
pairing goes. Whether a plan may then have *no* deliverable at all is still open
— see Open questions.

### Assessment is per answer, not per section

**No section keeps an "Evaluate this section" action.** RPA-162's **Assess this
answer**, beside the answer it is about, is the only way to ask for feedback.

This supersedes 001's RPA-34 entry, which replaced seven per-field buttons with
two section-level ones. The per-field model has come back for a different reason
than it left: RPA-34 consolidated because seven buttons was noise, and RPA-162
returned to the field because feedback about one answer belongs beside that
answer. The unit of scoring never changed; only where the request starts.

This also removes a problem the rename would otherwise create. A section action
labels itself from its slug, so Research Details would have rendered a button
reading *Evaluate research-details*. With no section action there is no label to
fix.

## Why not the verdicts' placement

The field audit put Methods under Studies and Participant criteria under
Execution, which separates two fields the form currently keeps together as
properties of one study.

They are kept together instead, behind the approach question, because they
answer the same thing. How you will find out, who you will ask, and how many of
them is one decision described three ways; a researcher who changes the approach
changes all three. Splitting them across two sections means two pages a reader
has to hold in their head at once, and a submission error about participants
filed under a section that never asked about them.

The audit's placement was not wrong on its own terms — participants are an
execution concern once the plan is agreed. But the plan is being written, not
executed, and at writing time they belong with the approach that produced them.

## Consequences

**Renaming a question can move a field's storage key.** `toCamelKey`
(`app.js` line 106) derives a key from the label, which is why every field now
declares `key=` in the template. `test/rpa-55-field-key-contract.test.js` scans
`app.js` for keys looked up by name and asserts each renders, and `migrateDraft`
(`app.js` line 8466) carries drafts saved under an old key. Table columns still
derive their keys from their headings (RPA-74), so renaming a column is not the
same safe operation as renaming a field. A redesign whose main activity is
rewording and removing questions is the most likely thing to trigger this, and
`research/field-audit.md` says so under the open question that audit created.

**A cut field is commented out, not deleted.** The RPA-117 pattern is the agreed
reversible removal: the field's lines are commented out of the template with a
dated note saying why and how to restore it, `carryUnrendered` (`app.js` line
8371) carries an older draft's values through untouched, and
`test/rpa-117-dormant-theory-actions.test.js` and `test/dormant-data.test.js`
hold the behaviour. Sixteen fields leaving the form is sixteen dormancy notes,
not sixteen deletions.

**Renaming a section changes its slug, and four branches read it.** `slugify`
(`app.js` line 102) generates a section's slug from its heading, so `context`
becomes `research-details`. `evaluationSections` is keyed by that slug and is
read in eight places, four of which hardcode the string `context` itself (lines
1794, 5293, 5296 and 5431) rather than reading the section's own slug;
`submission-contract.js` `SECTION` maps every field key to a slug and uses it to route a submission error to a section, so a stale slug
files an error under a section the form does not have. Retiring Methodology
retires its slug too.

**Nothing in the form changes when this record lands.** This is a document. The
template, `app.js` and the test suite are untouched by it, and the suite passes
unchanged.

## What this supersedes in 001, and what 001 still governs

Superseded:

- **Seven sections become six**, and the names change. 001 names Alignment and
  Feedback among its seven; the template has neither — Alignment became the
  review step and Feedback moved into it.
- **The persistent always-visible outline** 001 decided was never built. What
  shipped is a separate task-list screen (`test/rpa-100-task-list.test.js`,
  `test/rpa-101-one-section-at-a-time.test.js`). This record describes the model
  that exists.
- **The two section-level evaluation actions** from the RPA-34 entry, replaced by
  per-answer assessment as described above.
- **Methodology as a section with no evaluable fields**, which 001 lists. There
  is no Methodology section.

Still governing, and not reopened here:

- **No hard forward-locks.** 001's reasoning stands exactly as written:
  *"The gate does not produce thinking; it produces filler that satisfies the
  gate."* Nothing in this redesign gates forward movement.
- **Assessment never blocks movement between sections.** It is advisory. RPA-162's
  "Continue and return later" is its current expression.
- **A stale evaluation still counts** towards a completed section; currency is
  tracked separately rather than folded into completion.
- **The section order is a default path, not a locked one**, and returning to an
  existing draft must not replay the sequence.
- **A completed section is one with information added, and evaluated where
  evaluation exists** — now read per answer rather than per section.

## Open questions

- May a plan have no deliverable at all, or is at least one still required? The
  audit says a deliverable is not needed for every research question, which does
  not answer whether it is needed for any.
- Does the rubric's Alignment criterion survive the Question/Outcome pairing
  going, and if it is reworded, what replaces the positional comparison?
- Does the approach question sit on a page of its own with Methods, Participant
  criteria and Sample Size each following on their own pages, or is it one page
  holding the group? The page rule above says one question per page, which
  implies four pages; if the group should be one page, it needs a `PAGE_PAIRS`
  entry that holds more than two.
