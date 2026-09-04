# 001 — Layout and navigation for the redesign

**Date:** 28 August 2026
**Status:** Accepted

## Context

The MVP put all seven sections on one page as collapsible accordions. Once
complete, the plan felt long and unfriendly to fill in — the trigger for this
redesign.

Two framings were considered for what the app fundamentally is:

- **A form** — a transaction completed once, front to back, by someone who
  never returns. This is the GOV.UK model, and most form-design research
  assumes it.
- **An application** — an object people return to, revise, and work in over
  time.

A research plan is drafted, discussed with stakeholders, and revised. Plans are
reopened. The app already supports comments between colleagues. It is an
application.

That reframes the original complaint. Applications are allowed to be large —
what makes them fail is not length but disorientation: not knowing where you
are, what remains, or whether you are making progress. "The form is too long"
was most likely a misdiagnosis of an orientation problem.

A separate question was whether to cut fields. The current fields are
considered essential, so the field audit is scoped to sequencing and
optionality rather than deletion.

## Decision

**One section at a time in the editing area, with a persistent outline of all
seven sections always visible, each showing its status.**

Orientation comes from the outline; focus comes from editing a single section.

**The section order is the default path, not a locked one.** Sections are
presented in sequence, "next" is the obvious action, and most people will
follow that path without thinking about it. But jumping ahead is allowed.
Where someone moves to a section that usually depends on earlier work, a soft
note says so — for example, *"this usually works better once your Objective is
defined"* — without blocking them.

## Why not lock the sequence

A hard forward-lock would produce the failure the app exists to prevent. Someone
who cannot proceed until a section is "complete", but who does not yet know
their problem, will type something plausible to unlock the next section. The
gate does not produce thinking; it produces filler that satisfies the gate.

Real work also arrives out of order — a Jira ticket and a deadline often exist
before a goal does.

This is consistent with the existing decision that evaluation is always optional
and never blocks movement between sections. Soft guidance matches what the
Evaluate button already does: it says what is weak, it does not refuse to
continue.

## What counts as a completed section

**Information added, and evaluated where evaluation exists.**

Evaluation currently only exists in two sections — Project Context (Background,
Goal, Problem Statement) and Research (Objective, Hypothesis, Research
Questions, Outcomes). Alignment, Methodology, Execution, Resources and
Additional Comments have no evaluable fields, and mostly should not: dates,
tables and links are not coachable prose. So the rule degrades gracefully
rather than requiring evaluation to be bolted onto sections that do not warrant
it.

"Evaluated" means evaluated at all, not evaluated above a score. A quality
threshold on the status would be gamed immediately, and would make the app
judge people rather than coach them.

This makes evaluation effectively required for anyone who wants a plan marked
complete, which is intended: someone who never evaluates has used the app as a
text editor.

### Stale evaluations still count (settled under RPA-55)

RPA-39 made evaluation three-state — unevaluated, evaluated, evaluated-but-stale
— which the rule above did not anticipate. Settled as follows:

**A stale evaluation still counts towards a completed section. Currency is
tracked separately, not folded into completion.**

The original rule conflated two different things. *Completion* asks whether the
work was done and the feedback engaged with. *Currency* asks whether the
feedback still describes the text. They are orthogonal, and treating staleness
as an incompletion was the error.

Reverting a section to incomplete because someone fixed a typo would punish
revision — and revision is the whole premise of calling this an application
rather than a form. It would also teach people not to edit after evaluating,
which is precisely backwards. This is the same reasoning that rejected a hard
forward-lock: a rule that penalises honest work produces avoidance, not quality.

But "complete" must not claim more than it can. So the outline carries the
staleness marker alongside the completion state rather than instead of it — a
section reads as done, with its evaluation flagged as out of date. That follows
the precedent RPA-39 set in the panel itself: keep the result, label it, do not
erase it.

**Where currency does bite is sign-off.** RPA-55 moves sign-off into the review
step, and that is the point at which stale evaluations should be surfaced —
approving a plan whose feedback describes text that has since changed is exactly
the case worth catching. Surfaced, not blocked: consistent with evaluation never
gating progress.

## Consequences

- The RPA-44 prototype was built around back/next progression, which this
  decision replaces with free navigation and a persistent outline. The branch
  has been closed rather than reworked — it was exploration, and its job was to
  inform this record. Preserved at tag `spike/rpa-44-section-at-a-time-final`
  if the code is ever wanted again.
- Most GOV.UK form patterns become less applicable, since they assume one-time
  transactional completion. Their task list and "check your answers" patterns
  remain relevant; their one-thing-per-page material does not.
- Returning to an existing draft must not replay the sequence.
## Resolved since: evaluation staleness (RPA-39)

This record originally left open what happens when a section is evaluated and
then edited. **RPA-39 answered it in code**, and took the third option this
record anticipated: an evaluated-then-edited state, rather than leaving the
result standing or reverting it to unevaluated.

Editing a field marks its evaluation stale instead of clearing it. The result
is kept and labelled: a "Results out of date" status in a `role="status"`
region, a `.eval-result-stale` class on the result pill, and the action
relabelled from "Evaluate again" to "Update evaluation". The like / dislike /
save controls are disabled while stale — you cannot endorse feedback about text
that no longer exists.

The un-stale path re-compares rather than simply clearing the flag, so a result
that arrives while the user is still typing is correctly marked stale on
arrival.

## Open questions

- Does the section become the unit of AI evaluation, replacing field-by-field
  scoring? This would also address the multi-question feedback problem noted on
  11 August.
- How are the soft dependency nudges worded so they coach rather than nag?
