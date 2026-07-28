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
  table     — repeatable rows. Placeholder text instead describes columns as
              "ColLabel:coltype=placeholder | ColLabel:coltype=placeholder"
              coltype is one of: text, date, person, status (dropdown)

Flags (comma-separated inside the parentheses):
  optional  — marks the field "(optional)" in its label
  eval      — attaches the mock AI-evaluation button/panel to this field

Section headings ("# Name") become collapsible sections.
  "# Name {open}" makes that section expanded by default.
  "# Name {grid}" lays that section's fields out two-per-row instead of stacked.

A field line may be followed by indented example lines, shown in a toggle
panel under that field:
  Good: an example of a strong answer
  Bad: an example of a weak answer

The very first "#" line in the file is special: it defines the document
title field, not a section. Plain field lines right after it (before the
next "#" heading) become the header's meta fields (owner, dates, etc).
-->

# Title (text): Untitled Research Plan

Project Owner (text): Person
Research Owner (text): Person
Research Team (text): Person, Person, …
Last Updated (date):

# Alignment {grid}

Project (text): Initiative name
Area (text): Department
Jira Project (text): Ticket reference
Jira Research (text): Ticket reference
Project Deadline (text): Date
Report Deadline (text): Date
Sign off — Project Owner (text): Name / initials
Sign off — Research Owner (text): Name / initials

# Project Context {open}

Background (textarea): Relevant information to understand the project
Goal (textarea): Aim of the project and the outcomes you are trying to achieve
Problem (textarea, eval): Issues requiring attention that could prevent the project achieving its goal
  Good: Mobile checkout abandonment rose from 24% to 36% (Q1→Q2 2026), 68% of drop-offs concentrated at the payment-info step, correlated with a rise in "payment error" support tickets. We suspect the new card-scanning feature added friction but haven't confirmed with users. Closing this gap would recover an estimated $180K/quarter.
  Bad: Users are complaining about the checkout flow and we need to fix it.

# Research

Objective (textarea): Purpose and high-level goals of the research
Hypothesis (textarea, optional): Baseline assumptions to be tested during the study
Research Questions (textarea): Questions that provide insights into the main issues and aspects we need to understand
Outcomes (textarea): Deliverables of the research (e.g., list of recommendations, design selection, decision on project)

# Methodology

Theory (textarea, optional): Any useful framework that can guide our research
Methods (textarea): Any specific research methods to collect and analyse the data
Participants (textarea): Characteristics of target user profile including an estimation of the sample

# Execution

Requirements (textarea): Any resources (physical, digital, and approvals) needed to execute the study
Timeframe (textarea): Scheduled duration for each research phase
Stage Timeline (table): Stage:text=e.g. Recruitment | Completion Date:date
Action Points (table): Action:text=Task description | Responsible:person | Status:status

# Resources

Previous Knowledge (textarea): Existing research and internal data relevant to the project
Documentation (textarea): Reference materials required to understand and execute the study
