<!--
FIELDS SCHEMA — this file defines the Research Plan form. The app reads it at
page load and builds the form from it, so you can add, remove, reorder, or
relabel fields here without touching any code.

Field line syntax (one per line):
  Label (type[, optional][, eval]): Placeholder / description text

Types:
  text      — single-line input
  textarea  — multi-line input
  date      — native date picker (calendar); placeholder text is ignored
  select    — fixed dropdown; placeholder text becomes a comma-separated
              option list, e.g. "Small (1–5),Medium (6–12)". Same dropdown
              styling as a table's "status"/"select" columns, just for a
              single top-level field instead of a table cell.
  list      — dynamic stack of inputs, one per item, with its own "+ Add …"
              button (like table rows, but one column). Add the `prose` flag
              when list items should wrap and auto-expand vertically.
              Exception: "Outcomes" is special-cased in code to be a linked
              list with no controls of its own — its rows track Research
              Questions 1:1 by position instead.
  table     — repeatable rows. Placeholder text instead describes columns as
              "ColLabel:coltype=placeholder | ColLabel:coltype=placeholder"
              coltype is one of: text, prose (wrapping auto-expanding text),
              date, person, status (fixed dropdown),
              select (dropdown with custom options — placeholder becomes a
              comma-separated option list, e.g. "Stage:select=A,B,C"),
              url, file (click to attach, 15MB max)
  custom-fields — "+ Add additional section" button that appends user-named blocks (an
              editable label plus a textarea each), for letting users add
              their own ad-hoc fields to a section instead of being limited
              to what's predefined here. Placeholder text becomes each new
              block's textarea placeholder.

Flags (comma-separated inside the parentheses):
  optional          — marks the field "(optional)" in its label
  eval              — attaches the mock AI-evaluation button/panel to this field
  editable-headers  — table fields only: column headers render as editable
                       text inputs instead of fixed labels, so users can
                       rename a column (e.g. "Physical" → something else)
                       directly in the UI. Off by default — other table
                       fields (Stage Timeline, Action Points) keep fixed
                       headers unless they also set this flag.
  prose             — list fields only: rows render as wrapping,
                       auto-expanding textareas instead of compact inputs.

Exception: "Methods" rows are special-cased in code to be searchable
comboboxes — suggestions come from research-methods.md (one method per
bullet, edit that file to change the list), but each row still accepts
free text.

Section headings ("# Name") become collapsible sections.
  "# Name {open}" makes that section expanded by default.
  "# Name {grid}" lays that section's fields out two-per-row instead of stacked.

"## Name" groups the fields that follow under a labeled sub-heading
inside the current section (a bordered cluster with "Name" above it),
without opening a new collapsible section of its own. The group ends
at the next "##" or "#" line.

A field line may be followed by indented lines. "Hint:" is the field's
guidance, shown as visible text between the label and the control — edit
the hint here, not in app.js. "Good:" and "Bad:" are examples, shown in a
toggle panel under the field:
  Hint: what this field is for, and how to answer it well
  Good: an example of a strong answer
  Bad: an example of a weak answer

Wrap words in *asterisks* inside a Hint to italicise them, e.g.
  Hint: structured as *If we do this, then this will happen.*

The very first "#" line in the file is special: it defines the document
title field, not a section. Plain field lines right after it (before the
next "#" heading) become the header's meta fields (owner, dates, etc).
-->

# Research title (text, key=researchTitle):
  Hint: A short name for the study, for example ‘Usability testing of checkout flow’.

Jira Project (text, key=jiraProject):
  Hint: Jira ticket for the initiative this research supports.
Lead researcher (text, key=leadResearcher):
  Hint: Name of the person leading this research.
Project requester (text, key=projectRequester):
  Hint: Name of the person requesting this work.
Project decision (date, key=projectDecision):
  Hint: Date of the decision informed by this research.
Research readout (date, key=researchReadout):
  Hint: Date findings are shared with the team.
Last updated (date, key=lastUpdated):
  Hint: The date this plan was last edited.

# Context {open}

Background (textarea, eval, rows=2, key=background):
  Hint: Relevant context and essential terms needed to understand the project.
Goal (textarea, eval, rows=2, key=goal): 
  Hint: The outcome you are trying to achieve, and the expected changes in the product.
Problem Statement (textarea, eval, rows=2, key=problemStatement): 
  Hint: A concise summary of the specific issue, challenge, or gap that needs to be addressed.
# Research

Objective (textarea, eval, rows=2, key=objective): 
  Hint: The purpose of the study: what must be learned to guide product decisions.
Hypothesis (textarea, optional, eval, rows=1, key=hypothesis): 
  Hint: An educated assumption about this project's results, structured as: *If we do this, then this will happen.*
Research Questions (list, eval, key=researchQuestions): 
  Hint: A question that outlines the topic you want to explore and points directly to what you aim to discover. Three is a good number for a balanced study.
Outcomes (list, eval, key=outcomes): 
  Hint: A deliverable built from the findings of a research question, such as a list of issues or a journey map.

# Methodology

Theory (textarea, optional, rows=2, key=theory): 
  Hint: A framework to help ground the study design and analysis.
Methods (list, key=methods):
  Hint: A technique to study user behaviors, needs, and experiences that helps answer a research question.

## Participants

<!-- These were merged into one field earlier in RPA-55, on the grounds that
     both wanted a short noun phrase naming a kind of person. That was true of
     the format and wrong about the function, and Gus reversed it: a screener
     criterion filters who is eligible, a segment sets who must be represented
     among those who are. One is a filter, the other is a quota, and a study
     can get the first right and the second wrong. The hints below hold that
     line, since it is the only thing keeping them from collapsing together
     again.

     Drafts saved while the fields were merged keep everything in
     Characteristics: which entries were segments was not recorded, so nothing
     can sort them back out. Splitting them is forward-looking only. -->
Characteristics (list, prose, key=characteristics):
  Hint: The criteria that decide whether someone is eligible for this study. For example: Abandoned a checkout in the last 30 days.
User Groups (list, prose, key=userGroups):
  Hint: The segments that must be represented among the people you recruit. For example: New customers.
Sample Size (radios, key=sampleSize): Small (1–5),Medium (6–12),Large (13–29),Very Large (30+)
  Hint: The number of participants needed for this study.

# Execution

<!-- Requirements (table, editable-headers, key=requirements): Physical:prose | Digital:prose | Approvals:prose -->
<!-- Hint: What you'll need to run this study — physical items, digital tools, and approvals. -->
<!-- Timeframe (textarea, key=timeframe): Scheduled duration for each research phase -->
Stage Timeline (table, key=stageTimeline): Stage:select=Planning,Recruitment,Data Collection,Analysis,Reporting | Start Date:date | Completion Date:date
  Hint: The planned schedule for each stage of this research, from planning through reporting.
Action Points (table, optional, key=actionPoints): Action:prose | Responsible:prose
  Hint: Tasks needed to move this research forward, and who owns each one.
<!-- The Status column was cut (RPA-55). A plan gets signed and printed; it
     cannot also be a live tracker, so any status it claims is wrong the day
     after sign-off. Nothing has happened yet at the point the question is
     asked, which makes every available answer untrue. Status belongs in Jira.
     Action and Responsible stay: the plan is where the work is decided, and
     RPA-69 gives them a consumer by creating the Jira subtasks from them. -->
<!-- Previous Knowledge and Additional Resources used to be a Resources
     section of their own. Two fields did not earn a section: what you already
     know and what you still need are part of executing the study, not a
     separate stage of it (RPA-55). -->
<!-- Optional, per RPA-55. "What research already exists?" is the question
     nobody in an organisation owns. It is asked of the researcher because they
     are the one filling the form, not because they are the one who knows, and
     answering it means searching past work with no repository to search. The
     field stays for the people who have something to hand and stops being a
     wall for everyone else. Marking it honestly is not the same as giving it
     a source, which is still open — see recommendation 4. -->
Previous Knowledge (table, optional, key=previousKnowledge): Name:prose | File:file
  Hint: Prior research or documentation relevant to this study, attached for reference. For example: Q3 Checkout Usability Study.
<!-- Documentation (textarea, key=documentation): Reference materials required to understand and execute the study -->
<!-- Declared here because a field has to live in some section, but it is not
     an Execution field and does not render as one: renderSchema lifts every
     custom-fields field out and renders it after the sections, always visible
     rather than shut inside a collapsed accordion. It only sat in Execution
     because the Resources section was folded there (RPA-55).

     Renamed from "Additional Resources", which described neither what it does
     nor what its button offered. GOV.UK has no pattern for a user-defined
     field — every "Ask users for" pattern is for a known thing — so there is
     exactly one of these and it is scoped to the whole plan. One escape hatch
     also keeps the signal in one place: what people add here is evidence of
     what the template is missing, and five per-section hatches would scatter
     it. -->
Additional information (custom-fields, key=additionalResources):
  Hint: Anything this plan needs that the sections above have no place for. Each one you add becomes its own titled part of the document. To comment on the plan rather than add to it, use Feedback at the end.

<!-- The review step, and the last thing in the document. Alignment became this
     once its identifiers moved to the header: what was left was the two
     approvals, and approving is a moment rather than a section (RPA-55).
     Rendered by renderReviewStep, not as an accordion, so it cannot be
     collapsed past. -->
# Review

<!-- Project (textarea, key=project): Initiative -->
<!-- Hint: The product or business initiative this research plan supports. -->
<!-- Area (text, key=area): Department -->
<!-- Jira Research (text, key=jiraResearch): Ticket reference -->
<!-- The two sign-offs name the same two people as the header, in the same
     order, so a reader is not left wondering whether "Project Owner" and
     "Project requester" are different roles (RPA-55; Max raised it reviewing
     PR #22). The keys keep their original spelling on purpose: a key is an
     identifier, not a description, and now that the template pins them a
     label can be reworded without touching stored drafts. -->
<!-- Feedback moved here from a section of its own (RPA-55). It was the only
     field with no defined reader, and a section at the end of the document was
     nobody's stop. The review step is where a plan is read rather than
     written, which is the one moment a comment on it has an audience — and it
     sits above the approvals, because feedback offered after sign-off has
     missed its moment. It keeps the key `comments`: a key is an identifier,
     not a description, so no saved draft moves. -->
Feedback (textarea, optional, key=comments):
  Hint: Comments on the plan itself — a question, a concern, or anything you want the approvers to read before signing.
Sign off: Lead researcher (text, key=signOffResearcher):
  Hint: Lead researcher approval — type initials and the date is added automatically.
Sign off: Project requester (text, key=signOffProjectOwner):
  Hint: Project requester approval — type initials and the date is added automatically.
