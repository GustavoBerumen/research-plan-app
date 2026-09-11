# Research Plan App

An interactive, coached version of a research plan template — built to help product team members, researchers, and non-researchers write higher-quality research plans, with tailored feedback instead of a blank page.

The app takes a standard research plan document and turns it into a guided form: structured sections, examples, and an AI-assisted "Evaluate" step that reviews a draft against a rubric and gives Socratic-style feedback (pointing out gaps and asking questions) rather than rewriting it for you.

## Features

- Digital version of the team's Research Plan Template, organised into collapsible sections (Context, Research, Methodology, Execution, Alignment)
- AI-assisted evaluation — the "Evaluate" button scores a field against a rubric using the Claude API and returns specific, actionable feedback
- Research Questions and Outcomes as paired dynamic lists — add a question, get a matching outcome slot
- Methods field with a searchable dropdown of 125 standard research methods, plus free text for anything not on the list
- Stage Timeline and Action Points as editable tables with add/remove rows, including a Gantt-style timeline visualisation
- Optional file upload for Previous Knowledge, including "Add from Drive" via the Google Drive picker (disabled for the JSON pilot)
- Sign-off fields that auto-stamp today's date
- Drafts autosave to the browser (localStorage), and the whole plan can be printed or saved as a PDF

## Tech stack

- **Frontend:** plain HTML, CSS, and JavaScript — no framework, no build step
- **Backend:** a small Node.js server (`server.js`, no framework) that talks to the Claude API for evaluation/calibration and handles file uploads
- **Content as data:** the form's fields, rubric, and methods list live in plain Markdown files rather than being hardcoded, so the document structure can change without touching app code:
  - `research-plan-template.md` — fields, sections, hint text, and placeholder/example text
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

## JSON pilot configuration (RPA-89)

Gustavo must set **`RPA_PILOT_MODE=true`** in the host's environment and start the
reviewed build with **`node server.js`**. Restart/redeploy after changing the
environment. Keep provider credentials in the host's secret settings. Local
`npm start` loads `.env`; hosted startup should use injected variables directly.
Only the exact strings `true` and `false` are accepted; other values stop startup.
An absent flag or `false` retains nonpilot features, so verify the running
configuration before allowing pilot access. This flag is server-side; browser
storage, request bodies and query parameters cannot override it.

Pilot mode rejects calibration Save/Like/Dislike collection, uploads,
framework-library writes and Jira proxy calls **before body parsing**. Google
Drive is unavailable and its configuration/scripts are not sent/loaded. The UI
also keeps these actions unavailable if capability configuration is missing,
malformed, pending or failed. AI evaluation, recommendations and suggestions
remain available with their existing behaviour. No uploads directory is created
at startup; pilot requests never create it.

In **every mode**, static serving accepts only `/`, `/index.html`, `/style.css`,
`/app.js`, `/score-classification.js`, `/textarea-autosize.js`, `/test-profiles.js`,
`/research-plan-template.md`, `/research-plan-rubric.md` and `/research-methods.md`.
Only GET is supported for static files. Paths must be literal; encoded aliases,
traversal, Windows separators and malformed URLs are rejected. Query strings do
not select files. There is no general Markdown, repository or uploads route.
The theoretical-framework library remains available to server-side suggestions.
Use the Node server for previews; a generic repository-root file server bypasses
these restrictions.

Existing files are neither removed nor rewritten. Drafts/backups retain
attachment filenames and references, including dormant fields, but attachment
bytes are unavailable through the app. RPA-41 owns broader upload-control
removal and legacy-file disposition. Nonpilot uploads may still record files,
but the public static map does not provide downloads for them.

### Required deployment checks for Gustavo (RPA-1)

1. On **each exposed origin**, GET `/api/config` must return `pilotMode: true`
   and `capabilities` containing `calibration`, `uploads`, `addFramework`, `jira`
   and `googleDrive`, **all false**. `jiraEnabled` is false, Google keys are
   absent, and responses use `Cache-Control: no-store`. Check again after restart,
   redeploy and rollback. Verify any proxy/CDN does not serve an old build or
   bypass the Node allowlist with a separate file server.
2. Using synthetic data, directly POST to `/api/calibration`, `/api/upload` and
   `/api/add-framework`, and GET `/api/jira/search?q=synthetic`: expect 403.
   GET `/api/framework?name=synthetic`, the read-only framework lookup added by
   RPA-91, stays available in pilot mode: expect 404 for that name and 200 for
   a library name. The library file itself must still not be served.
   Repeat with malformed bodies and query flags; verify no append, write or
   directory creation. Check synthetic private files/records/upload URLs return
   404; encoded or traversal paths return 400 or are rejected by the front proxy.
   Do not retrieve real credentials or records as test fixtures.
3. Verify the complete form loads, restricted actions stay unavailable, and the
   backup round-trip and Print / Save as PDF work at the deployed address.
4. RPA-1 still requires invited access on every origin/API, bounded AI use,
   appropriate operational logs, and private durable storage with
   restart/redeploy/deletion proof for **every enabled server-side record**.
   Confirm the private handover method, folder permissions, operators and
   retention/deletion details from RPA-80 before real-data sessions. Passing
   RPA-89 alone is not deployment approval.

### Pilot plan handover

Browser autosave keeps a draft in the same browser/profile and site; clearing
browser data can remove it. **Download backup** saves versioned JSON locally; it
does not send a plan. Deliberately hand the file over using the agreed private
method and confirm receipt manually. **Restore backup** replaces the current
plan, including unsaved and hidden fields: back up the current plan first, then
select the received JSON, confirm replacement and wait for the success message.
Edit in the app, download an updated backup and return it privately. Invalid
files, cancellation and failed restores preserve the current plan.

Backups retain plan data and attachment references, but no attachment bytes,
calibration records or evaluation results. **Print / Save as PDF** provides the
readable copy, which cannot be imported as a backup. Word export, Finish/Send,
email delivery and automatic synchronisation are deferred.

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
