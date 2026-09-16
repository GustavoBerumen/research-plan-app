# RPA-1: invited Render pilot

**Accepted by Max, 15 September 2026:** browser-local sequential review with
submissions OFF; the server/UI feedback gate, OFF for the pilot; and the scoped
recovery and honest-wording fixes. These decisions do not establish deployment or
participant acceptance. The accepted code fixes are in [PR #104](https://github.com/GustavoBerumen/research-plan-app/pull/104). Manual testing uses the intended device and browser;
a desktop is fine and no laptop is required.

This runbook covers one Render web service operated by Max, using Gustavo's
GitHub repository, browser drafts/JSON backups and optional private completed-plan
submission. Gustavo covers the agreed
costs and retains authority to stop AI spending. These are preparation steps;
the existence of this file or passing local tests does not establish a live deploy.

## Release reconciliation — 15 September 2026

The existing service remains the rollout target. Start with the
[release proposal](research/pilot/release-proposal-2026-09-15.md) and
[candidate evidence](research/pilot/candidate-verification-2026-09-15.md).
Pinned main f3273269d58893e9e4f6004267175c54b4d6d4ff passed 654/654 tests, but
dead-link autosave/download loses method groups and email wording is misleading.
Do not deploy that unchanged source for participants.

The accepted mode is a labelled browser-local sequential-review demonstration
with submissions OFF, corrected recovery/wording and the feedback gate OFF.
The live service has not yet been changed to this configuration. Submissions ON replaces the review
panel with declarations and Send/receipt; it does not enable shared review.
R2 holds completed snapshots; live mutable review needs a separate durable design.
Use [SUBMISSIONS.md](SUBMISSIONS.md) only for separately approved collection.

Feedback is independently enabled in the original f327326 candidate and appends score/answers,
plan title, section/build/time to feedback-data.jsonl. It is outside R2 backup and
deletion. The accepted PR #104 gate adds strict `RPA_FEEDBACK_ENABLED`: absent
or `false` disables feedback in pilot mode; `true` enables it. Non-pilot retains
its enabled default when absent. Use OFF for this release and verify the gate
before deploying to existing password holders. A synthetic-only intention does
not restrict those existing users. The last observed Render service had no disk;
this was not rechecked in this continuation. Render documents local filesystem
loss on restart/redeploy without a persistent disk: [disk documentation](https://render.com/docs/disks),
checked 15 September. Merely adding a disk is not a complete handling policy.

Historical hosted evidence remains 6818628 / dep-dak32sbl550s73brjv1g; earlier
644/644 and 44 local production checks remain d1802db evidence. Preserve current
service/AI settings; initial setup defaults below are not reset instructions.

## Initial installation reference — existing service already configured

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
   `pilotMode: true`, submissions off unless separately approved, and calibration,
   uploads, addFramework, jira and googleDrive false. The current candidate's
   feedback capability in the original f327326 is true. The accepted repaired pilot
   must instead advertise feedback false. Record Render's SHA
   even if the footer's build marker is `dev`.

## AI spending and request controls

The last observed dedicated `research-plan-app` Anthropic workspace limit was
**US$3 per month**, replacing the earlier £10 allowance for this pilot. The Console
was rechecked on 15 September: US$3 cap, US$3.54 displayed credits, auto-reload Off.
These are timestamped observations; check them again before paid release probes.
Preserve Haiku 4.5 and the existing key. Gustavo retains stop authority; Max owns
the technical stop. Record the agreed monitoring/response arrangement under RPA-80.
A dedicated key alone is not a spending limit. No app-side counter implements a
monetary cap. Do not change billing controls as part of a code deployment.

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

Use the [bounded release checklist](research/pilot/release-checklist.md) for the
selected mode. Browser-local demonstration needs no new plan store. Preserve
partial drafts, same-origin recovery and v9 JSON backups. Local links resolve
against that browser's saved plan; they do not retrieve a plan on another device.
Correct dead-link recovery before release. Do not clear browser data to fix it.

Manual JSON exchange is historical/operator contingency, not the intended reviewer
experience. Retain [private exchange procedures](research/pilot/private-file-exchange.md)
when explicitly needed. Previously collected plans/revisions/notes retain their
agreed four-week-after-final-session or earlier-on-request deletion obligations.
Gustavo owns session handling; verify access and real transfer only when that
contingency is selected. No previous records are discarded by changing modes.

On the approved hosted SHA, verify both origins' authentication/health, safe
capabilities, private-file denial, actual visible mode/wording and safe recovery.
Feedback needs its own gate or handling acceptance. Paid probes and restarts are
separately approved bounded work. Max's final device/browser walkthrough includes real
JSON download/restore; no new PDF round or discussion-guide lookup is required.

Before a planned restart/deploy, preserve any existing local feedback under its
approved handling; code deployment can otherwise lose it. If completed-plan
collection exists, follow SUBMISSIONS.md maintenance/drain/journal procedures.
Never transfer rpa64-storage-test or its keys into participant work.

## Update and rollback

Keep automatic deploys off for the pilot. Before each update, record the current
good deploy/SHA, verify tests for the intended commit, and deploy that specific
commit through Render's manual deploy flow. Confirm health, login, capabilities,
and approved bounded AI checks after release. In a failure, roll back to the
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
