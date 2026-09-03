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

A field line may be followed by indented example lines, shown in a toggle
panel under that field:
  Good: an example of a strong answer
  Bad: an example of a weak answer

The very first "#" line in the file is special: it defines the document
title field, not a section. Plain field lines right after it (before the
next "#" heading) become the header's meta fields (owner, dates, etc).
-->

# Title (text): Title for your research plan

Researcher (text): Name
Project Owner (text): Name
<!-- Research Team (text): Team members -->
Last Updated (date):

# Alignment {grid}

Project (textarea): Initiative
<!-- Area (text): Department -->
Jira Project (text): Ticket reference
<!-- Jira Research (text): Ticket reference -->
Project Decision (date):
Report Research (date):
Sign off: Project Owner (text): Type initials
Sign off: Researcher (text): Type initials

# Project Context {open}

Background (textarea, eval): Relevant information to understand the project
Goal (textarea, eval): Aim of the project and the outcomes you are trying to achieve
Problem Statement (textarea, eval): Issues requiring attention that could prevent the project achieving its goal
# Research

Objective (textarea, eval): Purpose and high-level goals of the research
Hypothesis (textarea, optional, eval): Baseline assumptions to be tested during the study
Research Questions (list, eval): What do you want to understand?
Outcomes (list, eval): Deliverable for this question

# Methodology

Theory (textarea, optional): Any useful framework that can guide our research
Methods (list): Search or type a method

## Participants

Characteristics (list, prose): e.g. Frequent mobile shoppers
User Groups (list, prose): e.g. New customers
Sample Size (select): Small (1–5),Medium (6–12),Large (13–29),Very Large (30+)

# Execution

Requirements (table, editable-headers): Physical:prose | Digital:prose | Approvals:prose
<!-- Timeframe (textarea): Scheduled duration for each research phase -->
Stage Timeline (table): Stage:select=Planning,Recruitment,Data Collection,Analysis,Reporting | Start Date:date | Completion Date:date
Action Points (table): Action:prose=Task description | Responsible:prose | Status:status

# Resources

Previous Knowledge (table): Name:prose=e.g. Q3 Checkout Usability Study | File:file
<!-- Documentation (textarea): Reference materials required to understand and execute the study -->
Additional Resources (custom-fields): Add details...

# Additional Comments

Comments (textarea, optional): Anything you'd like to say, any question you'd like to add, or something else not discussed here?
