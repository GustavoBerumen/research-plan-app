# Field audit — RPA-55

Every field in `research-plan-template.md` put through Caroline Jarrett's
question protocol (Jarrett & Gaffney, *Forms that Work*), to decide what stays,
what goes, and what is being asked at the wrong moment.

**Status: scaffold — no verdicts reached yet.** The field list, types and current
hint text below are generated from the template and are accurate as of this commit.
The three protocol columns and the verdicts are for us to fill in.

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
| **Title**<br><sub>asks: Title for your research plan</sub> | `text` |  |  |  |  |
| **Researcher**<br><sub>asks: Name</sub> | `text` |  |  |  |  |
| **Project Owner**<br><sub>asks: Name</sub> | `text` |  |  |  |  |
| **Last Updated** | `date` |  |  |  |  |

## Alignment

| Field | Type | Why do we need it? | Who has the answer? | Able and willing? | Verdict |
|---|---|---|---|---|---|
| **Project**<br><sub>asks: Initiative</sub> | `text` |  |  |  |  |
| **Jira Project**<br><sub>asks: Ticket reference</sub> | `text` |  |  |  |  |
| **Project Decision** | `date` |  |  |  |  |
| **Report Research** | `date` |  |  |  |  |
| **Sign off: Project Owner**<br><sub>asks: Type initials</sub> | `text` |  |  |  |  |
| **Sign off: Researcher**<br><sub>asks: Type initials</sub> | `text` |  |  |  |  |

## Project Context

| Field | Type | Why do we need it? | Who has the answer? | Able and willing? | Verdict |
|---|---|---|---|---|---|
| **Background**<br><sub>asks: Relevant information to understand the project</sub> | `textarea`<br><sub>eval</sub> |  |  |  |  |
| **Goal**<br><sub>asks: Aim of the project and the outcomes you are trying to achieve</sub> | `textarea`<br><sub>eval</sub> |  |  |  |  |
| **Problem Statement**<br><sub>asks: Issues requiring attention that could prevent the project achieving…</sub> | `textarea`<br><sub>eval</sub> |  |  |  |  |

## Research

| Field | Type | Why do we need it? | Who has the answer? | Able and willing? | Verdict |
|---|---|---|---|---|---|
| **Objective**<br><sub>asks: Purpose and high-level goals of the research</sub> | `textarea`<br><sub>eval</sub> |  |  |  |  |
| **Hypothesis**<br><sub>asks: Baseline assumptions to be tested during the study</sub> | `textarea`<br><sub>optional, eval</sub> |  |  |  |  |
| **Research Questions**<br><sub>asks: What do you want to understand?</sub> | `list`<br><sub>eval</sub> |  |  |  |  |
| **Outcomes**<br><sub>asks: Deliverable for this question</sub> | `list`<br><sub>eval</sub> |  |  |  |  |

## Methodology

| Field | Type | Why do we need it? | Who has the answer? | Able and willing? | Verdict |
|---|---|---|---|---|---|
| **Theory**<br><sub>asks: Any useful framework that can guide our research</sub> | `textarea`<br><sub>optional</sub> |  |  |  |  |
| **Methods**<br><sub>asks: Search or type a method</sub> | `list` |  |  |  |  |
| **Characteristics**<br><sub>in *Participants*</sub><br><sub>asks: e.g. Frequent mobile shoppers</sub> | `list` |  |  |  |  |
| **User Groups**<br><sub>in *Participants*</sub><br><sub>asks: e.g. New customers</sub> | `list` |  |  |  |  |
| **Sample Size**<br><sub>in *Participants*</sub><br><sub>asks: Small (1–5),Medium (6–12),Large (13–29),Very Large (30+)</sub> | `select` |  |  |  |  |

## Execution

| Field | Type | Why do we need it? | Who has the answer? | Able and willing? | Verdict |
|---|---|---|---|---|---|
| **Requirements**<br><sub>asks: Physical \| Digital \| Approvals</sub> | `table`<br><sub>editable-headers</sub> |  |  |  |  |
| **Stage Timeline**<br><sub>asks: Stage:select=Planning,Recruitment,Data Collection,Analysis,Reportin…</sub> | `table` |  |  |  |  |
| **Action Points**<br><sub>asks: Action:text=Task description \| Responsible:person \| Status:status</sub> | `table` |  |  |  |  |

## Resources

| Field | Type | Why do we need it? | Who has the answer? | Able and willing? | Verdict |
|---|---|---|---|---|---|
| **Previous Knowledge**<br><sub>asks: Name:text=e.g. Q3 Checkout Usability Study \| File:file</sub> | `table` |  |  |  |  |
| **Additional Resources**<br><sub>asks: Add details...</sub> | `custom-fields` |  |  |  |  |

## Additional Comments

| Field | Type | Why do we need it? | Who has the answer? | Able and willing? | Verdict |
|---|---|---|---|---|---|
| **Comments**<br><sub>asks: Anything you'd like to say, any question you'd like to add, or some…</sub> | `textarea`<br><sub>optional</sub> |  |  |  |  |

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
