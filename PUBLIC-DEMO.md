# Temporary public blog demo

This is a deployment plan, not evidence that a public demo is live. Use a **new Render web service and address**. Leave `research.gustavoberumen.com` and its existing pilot service, environment, and deployment untouched.

## Before publication

1. Review the demo PR and its checks. Record the exact commit SHA to deploy. Do not connect this service to an environment group shared with the private pilot.
2. In the Anthropic Console, confirm the intended prepaid workspace, current credit balance, auto-reload **off**, and which API key belongs to that workspace. Enter that key only as a secret in the new Render service. Do not copy it into a file, PR, log, command, or browser configuration. Stop if the account or auto-reload state cannot be verified.
3. Obtain approval for the new service and any hosting cost. Create it from this repository and the reviewed demo commit/branch, with one instance, manual deploys only, `npm ci --omit=dev`, `node server.js`, and `/healthz`. Use Render HTTPS; choose the generated service URL as the initial candidate link. A custom demo domain is optional and requires separate DNS setup.
4. Set these environment variables on the **new** service:

   | Variable | Value |
   | --- | --- |
   | `RPA_PILOT_MODE` | `true` |
   | `RPA_PUBLIC_DEMO` | `true` |
   | `RPA_AI_ENABLED` | `true` |
   | `RPA_FEEDBACK_ENABLED` | `false` |
   | `RPA_SUBMISSIONS_ENABLED` | `false` |
   | `RPA_SIGN_OFF_ENABLED` | `false` |
   | `ANTHROPIC_API_KEY` | Secret from verified prepaid workspace |
   | `ANTHROPIC_MODEL` | `claude-haiku-4-5-20251001` |

   Do not set `RPA_PILOT_PASSWORD`, Jira, Google Drive, R2, or upload storage credentials on the demo service. `RPA_PUBLIC_DEMO=true` refuses startup unless pilot restrictions and AI are enabled and all three collection flags are off. Existing request, concurrency, body, output, and timeout limits remain active.

## Acceptance after approved deployment

1. Record the service URL, service/deploy ID, timestamp, and deployed SHA. Confirm `GET /healthz` is 200, `GET /` is 200 without credentials, and `GET /api/config` reports `publicDemo: true`, `pilotMode: true`, and every restricted capability false. Check the visible notice names Evaluate **and** AI suggestions.
2. Directly request `/api/calibration`, `/api/feedback`, `/api/submissions`, `/api/sign-off`, `/api/sign-off/read`, `/api/upload`, `/api/add-framework`, and `/api/jira/search` without credentials; each must return 403 before consuming a body. Confirm `.env`, repository source, upload paths, and private records return 404. Cross-site AI POSTs must return 403.
3. In a browser, enter fictional text, reload to confirm autosave, download and restore a JSON backup, create a Word export, and print/save as PDF. Make **one minimal paid evaluation** to confirm actual Anthropic feedback. Test an AI failure without spending credits by using a local mocked provider; the draft and exports must remain usable.
4. Inspect the new service's logs for the test request: evaluation metadata and HTTP status may appear, but submitted plan text and the API key must not. Confirm `https://research.gustavoberumen.com` still challenges for pilot credentials and the pilot's capabilities remain unchanged when checked with authorised access.
5. Only after those checks, use the new service URL in the blog. If acceptance fails, keep the URL unpublished, turn off the demo service's AI or suspend that new service, and leave the pilot alone.
