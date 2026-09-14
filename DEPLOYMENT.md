# RPA-1: invited Render pilot

This runbook covers one Render web service operated by Max, using Gustavo's
GitHub repository and the agreed JSON/PDF workflow. Gustavo covers the agreed
costs and retains authority to stop AI spending. These are preparation steps;
the existence of this file or passing local tests does not establish a live deploy.

## Connect and configure

1. Gustavo installs Render's GitHub app for **only**
   `GustavoBerumen/research-plan-app`. Max connects his own GitHub deployment
   credentials in his Render account and verifies that the repository appears.
   GitHub collaborator access and Render workspace membership are separate.
2. Use Max's Hobby workspace and create **one Web Service**, not a static site.
   The selected compute plan is `0.5c-512mb` (formerly Starter, $7/month as checked
   11 September 2026). Do not create a second service if one already exists.
3. Use the configuration in `render.yaml`, either through New > Blueprint or
   by entering it in the Web Service form. Oregon is the proposed initial region;
   check it before service creation because changing region needs a new service.
   Set one instance, Node `24.19.0`, build `npm ci --omit=dev`, start
   `node server.js`, health path `/healthz`, and turn automatic deploys off.
   Render supplies `PORT`; no `.env` file is uploaded.
4. Set `RPA_PILOT_MODE=true`. Render startup rejects absent/false pilot mode.
   The exact values `true` and `false` are required for boolean settings.
5. Store `ANTHROPIC_API_KEY` and `RPA_PILOT_PASSWORD` as secrets. The Blueprint
   generates a random password; manual setup needs a password-manager-generated
   20-200 character ASCII password without spaces. Never use the synthetic test
   password. Keep Google/Jira credentials out of this service.
6. Initially keep `RPA_AI_ENABLED=false`. The app can be checked with AI paused;
   requests return a readable error without deleting writing. Set it to `true`
   and restart only after checking the dedicated pilot key's provider budget.
   A later Blueprint sync reapplies the safe `false` default; explicitly recheck
   this flag after syncing configuration.
7. Deploy only a reviewed, tested commit containing RPA-1. Record its full SHA,
   service URL, deploy ID and timestamp. Verify `/api/config` after sign-in shows
   `pilotMode: true` and all write/proxy capabilities false. Record Render's SHA
   even if the footer's build marker is `dev`.

## AI spending and request controls

Gustavo's approved allowance is **£10 per month**, separate from hosting. Use a
dedicated non-default Anthropic workspace and a key from that workspace. In the
provider Console, set a monthly workspace spend limit conservatively within
that allowance in its billing currency; record the actual configured currency
and amount, accounting for conversion/tax. Verify prepaid credits and disable
automatic reload. A dedicated key alone is not a spending limit. No app-side
counter claims to implement the monetary cap.

The single server enforces these pilot safety ceilings:

- 30 incoming AI operations per rolling minute across all three paid routes.
- 60 actual provider attempts per rolling minute, including evaluation retries,
  framework drafting and method-search fallbacks; at most four in flight.
- No hidden SDK retries. Existing evaluation logic retains its maximum of three
  explicit attempts; local limits and recognised provider billing denials stop
  immediately. Method-search fallbacks run one at a time within a request.
- 30 seconds per provider call (including response reads), with cancellation;
  a whole request is cancelled after 95 seconds or browser disconnection.
- 64 KiB request bodies measured in UTF-8 bytes, 15-second body deadlines, and
  at most 20 questions in one method-suggestion request. These are request safety
  limits, not per-participant evaluation quotas.

The in-memory limits reset on restart and apply to one instance. They are not
durable usage measurement or a substitute for the provider's budget. Do not add
instances without revisiting the controls. Use RPA-79's manual session notes and
provider usage reports; do not equate evaluation clicks with billed calls. No
plan text or credentials are written to pilot error logs by these changes.

To stop AI, set `RPA_AI_ENABLED=false` and redeploy/restart. Revoke the dedicated
provider key immediately if an urgent stop is needed; an environment change only
affects the new process, and an in-flight provider call may still be billed.

## Access and DNS

Participants sign in using browser HTTP Basic authentication: username **pilot**,
plus the shared pilot password provided privately. It protects the page, assets,
configuration and every API route, on both Render's default address and custom
domains. `/healthz` GET/HEAD returns only `ok` without sign-in. Cross-site POSTs
are rejected. This is a small shared-password pilot, not individual user accounts.
Share the normal HTTPS address and provide credentials separately for the browser
sign-in prompt. Do not embed credentials in the URL: browsers reject the app's
relative fetch requests when its address contains a username/password.

Use HTTPS for all hosted access. Render terminates TLS and redirects HTTP to
HTTPS; Basic credentials must not be used on an unencrypted public endpoint.
Browsers can cache credentials; there is no app logout button. To revoke access,
rotate the password, redeploy/restart and privately give it to remaining testers.
Old credentials must fail on both hostnames. Shared-password access cannot revoke
one person while leaving everybody else's credentials unchanged.

Add only the chosen pilot subdomain at Porkbun using the values Render supplies.
Preserve existing website and email records. Verify its certificate and access
protection. You may disable the default Render hostname after the custom domain
works; otherwise both remain protected. Browser drafts are tied to their origin:
download JSON before switching from localhost/onrender.com to the final domain,
then restore it there. Use one canonical participant address.

## Plan handling and verification

No app database or persistent disk is required for the selected pilot. Plan
writing autosaves in the participant's browser. Calibration, uploads, framework
file writes and Jira proxying remain disabled at the API and UI. Existing file
references remain references; no attachment bytes are in a JSON backup.

Gustavo's agreed private Drive folder has one subfolder per session ID. Verify
that participant upload/return access exposes only that participant's files,
with no access to another session. Gustavo confirms actual receipt. Plans,
revisions and session notes are deleted four weeks after the final session, or
earlier on request to Gustavo. Creating an app service does not configure those
Drive permissions or send a downloaded file anywhere.

Before inviting testers, use synthetic data on the actual deployed origin:

- No credentials / wrong credentials: page and API reject, no provider call.
  `/healthz` alone is public. Test both reachable hostnames.
- Valid login: full form and allowed read-only framework lookup work;
  `/api/config` confirms pilot capabilities. Private files are inaccessible.
- Direct calls to upload, calibration, add-framework and Jira routes reject
  even with malformed bodies. No app server data writes are expected.
- Confirm the provider budget settings before enabling AI. Perform one small
  real evaluation and both suggestion paths; inspect provider usage. Exercise
  the off switch and an API failure; writing must remain intact.
- In Windows Chrome desktop and 1280px laptop view, check keyboard operation,
  same-browser refresh/recovery, actual JSON download and restore, replacement
  warning/cancel/invalid-file recovery, edit/re-download, actual private handover
  and receipt, returned-backup restore, and a saved readable PDF.
- Restart/redeploy the same version and check browser recovery. Test the saved
  backup in a separate browser profile. Do not treat a download toast as proof
  that a file was saved, or a local/mock run as deployed acceptance.
- Record go/no-go and remaining limits in RPA-6; Gustavo's local session-1
  exception does not substitute for these deployment checks.

## Update and rollback

Keep automatic deploys off for the pilot. Before each update, record the current
good deploy/SHA, verify tests for the intended commit, and deploy that specific
commit through Render's manual deploy flow. Confirm health, login, capabilities,
and one representative AI request after release. In a failure, roll back to the
last verified **protected pilot** deploy; never choose a pre-RPA-1 build that
lacks authentication. Recheck environment settings separately from code rollback.
For the first deployment, if no protected good version exists, suspend the service
and revoke the pilot key instead of rolling back to an unprotected version.

## Sources checked 11 September 2026

- [Render web services](https://render.com/docs/web-services)
- [Render Blueprint specification](https://render.com/docs/blueprint-spec)
- [Node version](https://render.com/docs/node-version)
- [Render pricing](https://render.com/pricing)
- [Git provider credentials](https://render.com/docs/git-provider)
- [Custom domains](https://render.com/docs/custom-domains)
- [Anthropic credits](https://support.claude.com/en/articles/8977456-how-do-i-pay-for-my-claude-api-usage)
- [Anthropic workspace spend limits](https://platform.claude.com/docs/en/api/rate-limits)
