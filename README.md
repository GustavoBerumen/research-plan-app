# Research Plan App

An interactive, coached version of a research plan template — built to help product team members, researchers, and non-researchers write higher-quality research plans, with tailored feedback instead of a blank page.

The app takes a standard research plan document and turns it into a guided form: structured sections, examples, and an AI-assisted "Evaluate" step that reviews a draft against a rubric and gives Socratic-style feedback (pointing out gaps and asking questions) rather than rewriting it for you.

## Features

- Digital version of the team's Research Plan Template, organised into collapsible sections (Alignment, Project Context, Research, Methodology, Execution, Resources)
- AI-assisted evaluation — the "Evaluate" button scores a field against a rubric using the Claude API and returns specific, actionable feedback
- Research Questions and Outcomes as paired dynamic lists — add a question, get a matching outcome slot
- Methods field with a searchable dropdown of 125 standard research methods, plus free text for anything not on the list
- Stage Timeline and Action Points as editable tables with add/remove rows, including a Gantt-style timeline visualisation
- File upload for Previous Knowledge, including "Add from Drive" via the Google Drive picker
- Sign-off fields that auto-stamp today's date
- Drafts autosave to the browser (localStorage), and the whole plan can be printed or saved as a PDF

## Tech stack

- **Frontend:** plain HTML, CSS, and JavaScript — no framework, no build step
- **Backend:** a small Node.js server (`server.js`, no framework) that talks to the Claude API for evaluation/calibration and handles file uploads
- **Content as data:** the form's fields, rubric, and methods list live in plain Markdown files rather than being hardcoded, so the document structure can change without touching app code:
  - `research-plan-template.md` — fields, sections, and placeholder/example text
  - `research-plan-rubric.md` — scoring criteria used by the Evaluate step
  - `research-methods.md` — the methods dropdown list

## Getting started

1. Clone the repo and install dependencies:
   ```
   npm install
   ```
2. Copy `.env.example` to `.env` and add your own Anthropic API key (from [console.anthropic.com](https://console.anthropic.com)):
   ```
   cp .env.example .env
   ```
3. Start the app:
   ```
   npm start
   ```
4. Open [http://localhost:8934](http://localhost:8934)

Optional: the `.env.example` file also documents how to enable the Google Drive picker (`GOOGLE_CLIENT_ID` / `GOOGLE_API_KEY`) and how to override the model used for evaluation (`ANTHROPIC_MODEL`, defaults to Claude Haiku 4.5).

## Project structure

```
index.html                  Page shell
app.js                       All client-side behaviour (schema-driven rendering, evaluate flow, tables, etc.)
style.css                    Styling
server.js                    Node backend — Claude API calls, file uploads, config endpoint
research-plan-template.md    Form fields and sections
research-plan-rubric.md      Evaluation rubric
research-methods.md          Methods dropdown list
```

## Status

Actively evolving — this is a working prototype, not a finished product.
