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

# Research title (text):
  Hint: Describe what this research covers, for example, ‘Usability testing of checkout flow’.

Lead researcher (text):
  Hint: Name of the person leading this research.
Project requester (text):
  Hint: Name of the person requesting this work.
Project decision (date):
  Hint: Date of the decision informed by this research.
Research readout (date):
  Hint: Date findings are shared with the team.
Last updated (date):
  Hint: The date this plan was last edited.

# Context {open}

Background (textarea, eval, rows=3):
  Hint: Provides relevant context and essential terms needed to understand the project.
Goal (textarea, eval, rows=2): 
  Hint: State what you are trying to achieve and define the expected changes in the product as a result.
Problem Statement (textarea, eval, rows=2): 
  Hint: A concise summary of the specific issue, challenge, or gap that needs to be addressed.
# Research

Objective (textarea, eval, rows=2): 
  Hint: Defines the purpose of the study, specifying what must be learned to guide product decisions.
Hypothesis (textarea, optional, eval, rows=1): 
  Hint: An educated assumption about this project's results, structured as: *If we do this, then this will happen.*
Research Questions (list, eval): 
  Hint: A question that outlines the topic you want to explore and points directly to what you aim to discover.
Outcomes (list, eval): 
  Hint: A deliverable built from the findings of a research question, such as a list of issues or a journey map. 

# Methodology

Theory (textarea, optional, rows=2): 
  Hint: A framework to help ground the study design and analysis.
Methods (list):
  Hint: A technique to study user behaviors, needs, and experiences that helps answer a research question.

## Participants

<!-- Characteristics and User Groups were two fields until RPA-55. They asked
     the same thing in practice: both wanted a short noun phrase naming a kind
     of person, and "Frequent mobile shoppers" answered either. Merged rather
     than reworded, because nothing in the app consumed either value. -->
Characteristics (list, prose): 
  Hint: The criteria that qualify someone for this study, and any distinct segments you want represented.
Sample Size (select): Small (1–5),Medium (6–12),Large (13–29),Very Large (30+)
  Hint: The number of participants needed for this study.

# Execution

<!-- Requirements (table, editable-headers): Physical:prose | Digital:prose | Approvals:prose -->
<!-- Hint: What you'll need to run this study — physical items, digital tools, and approvals. -->
<!-- Timeframe (textarea): Scheduled duration for each research phase -->
Stage Timeline (table): Stage:select=Planning,Recruitment,Data Collection,Analysis,Reporting | Start Date:date | Completion Date:date
  Hint: The planned schedule for each stage of this research, from planning through reporting.
Action Points (table): Action:prose=Task description | Responsible:prose | Status:status
  Hint: Tasks needed to move this research forward, and who owns each one.
<!-- Previous Knowledge and Additional Resources used to be a Resources
     section of their own. Two fields did not earn a section: what you already
     know and what you still need are part of executing the study, not a
     separate stage of it (RPA-55). -->
Previous Knowledge (table): Name:prose=e.g. Q3 Checkout Usability Study | File:file
  Hint: Prior research or documentation relevant to this study, attached for reference.
<!-- Documentation (textarea): Reference materials required to understand and execute the study -->
Additional Resources (custom-fields): Add details...

<!-- Alignment sits last. Project and Jira Project are identifiers, and the
     sign-offs are headed for a review step at the end of the flow (RPA-55).
     The form opens with Context and Research — the sections a
     researcher can actually write — instead of paperwork. -->
# Alignment {grid}

Project (textarea): Initiative
  Hint: The product or business initiative this research plan supports.
<!-- Area (text): Department -->
Jira Project (text): Ticket reference
  Hint: Links this plan to its tracking ticket in Jira.
<!-- Jira Research (text): Ticket reference -->
Sign off: Project Owner (text): Type initials
  Hint: Project Owner approval — type initials and the date is added automatically.
Sign off: Researcher (text): Type initials
  Hint: Researcher approval — type initials and the date is added automatically.

# Additional Comments

Comments (textarea, optional): Anything you'd like to say, any question you'd like to add, or something else not discussed here?
  Hint: Anything else worth noting that didn't fit elsewhere in this plan.
