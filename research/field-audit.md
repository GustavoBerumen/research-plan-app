# Field audit — RPA-55

Every field in `research-plan-template.md` put through Caroline Jarrett's
question protocol (Jarrett & Gaffney, *Forms that Work*), to decide what stays,
what goes, and what is being asked at the wrong moment.

**Status: first pass done on question 2 only.** No verdicts reached yet. The field
list, types and hint text are generated from the template. Question 2 is filled in
below as a starting point to argue with — questions 1 and 3, and every verdict,
are still open.

## How to use this

For each field, answer three questions. A field that cannot answer all three is a
candidate to lose or move:

1. **Why do we need this?** What decision or output depends on the answer? "It
   would be nice to know" is not an answer.
2. **Who has the answer?** Is the person filling the form the person who knows?
3. **Are they able and willing to give it?** Do they have it to hand *at the point
   we ask*, or must they go and find it?

Verdicts: **keep** · **cut** · **merge** (into another field) · **optional** ·
**move** (right question, wrong place)

A verdict of *move* is as valuable as *cut*. Per RPA-55, sequencing is half the
problem — a field can be necessary and still be asked at the wrong moment.

## Scoreboard

Fill in as verdicts are reached.

| Verdict | Count |
|---|---|
| keep | 0 |
| cut | 0 |
| merge | 0 |
| optional | 0 |
| move | 0 |
| undecided | 28 |
| **total** | **28** |

## Header (document meta)

| Field | Type | Why do we need it? | Who has the answer? | Able and willing? | Verdict |
|---|---|---|---|---|---|
| **Title**<br><sub>asks: Title for your research plan</sub> | `text` |  | Researcher — naming their own plan. |  |  |
| **Researcher**<br><sub>asks: Name</sub> | `text` |  | Researcher (self). |  |  |
| **Project Owner**<br><sub>asks: Name</sub> | `text` |  | Researcher knows the name. |  |  |
| **Last Updated** | `date` |  | Nobody — computed. Already *move*. |  |  |

## Alignment

| Field | Type | Why do we need it? | Who has the answer? | Able and willing? | Verdict |
|---|---|---|---|---|---|
| **Project**<br><sub>asks: Initiative</sub> | `text` |  | Researcher, from the project side. Low risk. |  |  |
| **Jira Project**<br><sub>asks: Ticket reference</sub> | `text` |  | Project side owns the key, but the picker now fetches it, so the researcher no longer has to know it. |  |  |
| **Project Decision** | `date` |  | ⚠ **Project Owner.** A delivery date the researcher does not set. |  |  |
| **Report Research** | `date` |  | Researcher — their own commitment. |  |  |
| **Sign off: Project Owner**<br><sub>asks: Type initials</sub> | `text` |  | ⚠ **The Project Owner, by name.** The researcher cannot answer this one at all. |  |  |
| **Sign off: Researcher**<br><sub>asks: Type initials</sub> | `text` |  | Researcher (self) — but see timing. |  |  |

## Project Context

| Field | Type | Why do we need it? | Who has the answer? | Able and willing? | Verdict |
|---|---|---|---|---|---|
| **Background**<br><sub>asks: Relevant information to understand the project</sub> | `textarea`<br><sub>eval</sub> |  | ⚠ Project side. The researcher transcribes it rather than knows it. |  |  |
| **Goal**<br><sub>asks: Aim of the project and the outcomes you are trying to achieve</sub> | `textarea`<br><sub>eval</sub> |  | ⚠ **Project Owner.** This is the project's goal, not the research's. |  |  |
| **Problem Statement**<br><sub>asks: Issues requiring attention that could prevent the project achieving…</sub> | `textarea`<br><sub>eval</sub> |  | ⚠ Project side — usually the reason research was commissioned in the first place. |  |  |

## Research

| Field | Type | Why do we need it? | Who has the answer? | Able and willing? | Verdict |
|---|---|---|---|---|---|
| **Objective**<br><sub>asks: Purpose and high-level goals of the research</sub> | `textarea`<br><sub>eval</sub> |  | Researcher — core expertise. |  |  |
| **Hypothesis**<br><sub>asks: Baseline assumptions to be tested during the study</sub> | `textarea`<br><sub>optional, eval</sub> |  | Researcher. |  |  |
| **Research Questions**<br><sub>asks: What do you want to understand?</sub> | `list`<br><sub>eval</sub> |  | Researcher. |  |  |
| **Outcomes**<br><sub>asks: Deliverable for this question</sub> | `list`<br><sub>eval</sub> |  | Researcher — tracks Research Questions 1:1. |  |  |

## Methodology

| Field | Type | Why do we need it? | Who has the answer? | Able and willing? | Verdict |
|---|---|---|---|---|---|
| **Theory**<br><sub>asks: Any useful framework that can guide our research</sub> | `textarea`<br><sub>optional</sub> |  | Researcher. |  |  |
| **Methods**<br><sub>asks: Search or type a method</sub> | `list` |  | Researcher — core expertise. |  |  |
| **Characteristics**<br><sub>in *Participants*</sub><br><sub>asks: e.g. Frequent mobile shoppers</sub> | `list` |  | Researcher; recruitment/ops may hold the real numbers. |  |  |
| **User Groups**<br><sub>in *Participants*</sub><br><sub>asks: e.g. New customers</sub> | `list` |  | Researcher, though segment names may be owned by product. |  |  |
| **Sample Size**<br><sub>in *Participants*</sub><br><sub>asks: Small (1–5),Medium (6–12),Large (13–29),Very Large (30+)</sub> | `select` |  | Researcher. |  |  |

## Execution

| Field | Type | Why do we need it? | Who has the answer? | Able and willing? | Verdict |
|---|---|---|---|---|---|
| **Requirements**<br><sub>asks: Physical \| Digital \| Approvals</sub> | `table`<br><sub>editable-headers</sub> |  | ⚠ **Split three ways.** Physical: researcher. Digital: IT. Approvals: legal/privacy. One field, three answerers. |  |  |
| **Stage Timeline**<br><sub>asks: Stage:select=Planning,Recruitment,Data Collection,Analysis,Reportin…</sub> | `table` |  | Researcher plans it; recruitment controls whether the dates hold. |  |  |
| **Action Points**<br><sub>asks: Action:text=Task description \| Responsible:person \| Status:status</sub> | `table` |  | ⚠ *Responsible* names other people; *Status* is nobody's answer at authoring time — it changes afterwards. |  |  |

## Resources

| Field | Type | Why do we need it? | Who has the answer? | Able and willing? | Verdict |
|---|---|---|---|---|---|
| **Previous Knowledge**<br><sub>asks: Name:text=e.g. Q3 Checkout Usability Study \| File:file</sub> | `table` |  | ⚠ Often nobody's job. "What research already exists" is the classic unowned question. |  |  |
| **Additional Resources**<br><sub>asks: Add details...</sub> | `custom-fields` |  | Researcher — open-ended by definition. |  |  |

## Additional Comments

| Field | Type | Why do we need it? | Who has the answer? | Able and willing? | Verdict |
|---|---|---|---|---|---|
| **Comments**<br><sub>asks: Anything you'd like to say, any question you'd like to add, or some…</sub> | `textarea`<br><sub>optional</sub> |  | Whoever is filling it — but no defined reader. |  |  |

## First pass: who has the answer?

Question 2 filled in for all 28 fields. The pattern that falls out is sharper than
any individual row.

**The form has one filler and at least four answerers.** The researcher completes
it end to end, but 8 of the 28 fields are owned by somebody else: the Project
Owner, legal/privacy, IT, and whoever a task gets assigned to. Every one of those
is a point where the form asks a person to speak for someone not in the room.

Three clusters, in descending order of how much they matter:

1. **Project Context is the project's knowledge, not the researcher's.** All three
   fields — Background, Goal, Problem Statement — are owned by the project side.
   That is not an argument to cut them: a plan without them is unreadable. It is an
   argument that they are being *retyped* rather than *sourced*. If they already
   exist in the project ticket, asking a researcher to paraphrase them is a
   transcription task wearing the costume of a question. Worth asking whether these
   should be pulled in from the Jira project rather than typed.

2. **Two fields hold values that change after sign-off.** Requirements/Approvals
   and Action Points/Status are operational state, not plan content. A document
   that gets signed and printed cannot also be a live tracker — whatever it says
   about status is wrong the day after it is signed. This is a *move*
   (to wherever tracking actually happens), not a cut.

3. **Sign off: Project Owner names an answerer who is not the filler**, in section
   two of seven. The template states the problem in its own label. This is the
   strongest evidence for the relocation RPA-55 already decided, and it did not
   need the audit to find it — the field was self-evidently misplaced.

**Previous Knowledge deserves its own line.** "What research already exists?" is
the question nobody in an organisation owns. The researcher is asked it because
they are the one filling the form, not because they are the one who knows. If the
answer is meant to be reliable it needs a source, and if it is not meant to be
reliable it is worth asking what it is for.

**The comfortable finding:** the entire Research and Methodology block — Objective,
Hypothesis, Research Questions, Outcomes, Theory, Methods, Sample Size — is
squarely the researcher's own expertise. Eleven fields where the filler is
unambiguously the knower. Whatever this audit cuts, it is unlikely to be here.

## Already dormant

Commented out in the template — the form has been trimmed before. Worth reading
before cutting more: if one of these was removed for a reason, that reason
probably applies to its neighbours too.

| Field | Type | Was in |
|---|---|---|
| Research Team | `text` | Header (document meta) |
| Area | `text` | Alignment |
| Jira Research | `text` | Alignment |
| Timeframe | `textarea` | Execution |
| Documentation | `textarea` | Resources |

## Known before we start

Two items RPA-55 records as already decided, carried here so the audit does not
relitigate them:

- **Sign off: Project Owner / Sign off: Researcher — _move_.** They sit in
  Alignment, section two, so people approve a plan that does not yet exist. They
  belong in a review step at the end. Project Decision and Report Research stay
  in Alignment: those are planning inputs, not approvals.
- **Last Updated — _move_, done.** Rendered as a dateline under the document
  heading rather than an editable control, in the RPA-54 prototype. It is a
  computed value and should not invite editing.

## Open question this audit inherits

ADR 001 concluded this app is an application rather than a form, and that "too
long" was probably an orientation problem rather than a scope problem. If that
holds, the win here comes from **sequencing and optionality** rather than deletion,
and a verdict sheet full of *keep* is a legitimate outcome — provided the order
changed. Worth holding open rather than treating a low cut-count as failure.
