# RPA-86: Make evaluation feedback toggleable and Save independent

Created as [RPA-86](https://turingtestable.atlassian.net/browse/RPA-86) on 8 September 2026 with Max's approval. Separate follow-up to RPA-63, related to RPA-3; not implemented as part of RPA-78.

## Problem

Selecting Like, Dislike or Save currently disables all three controls after the request succeeds. For example, someone who likes an evaluation can neither remove that rating nor use Save afterwards. Max requested toggleable actions and a Save state independent of the rating during the RPA-78 manual review on 8 September 2026.

RPA-63 refined presentation and explicitly preserved this existing behaviour. RPA-3 covers evaluation/review records but does not specify these interactions. A targeted new ticket keeps the behavioural change separately reviewable from RPA-78's spelling corrections.

## Proposed behaviour and acceptance criteria

1. Like and Dislike are individually toggleable: select the current rating again to clear it, or select the opposite rating to switch directly. They remain mutually exclusive with each other.
2. Save is an independent toggle. An evaluation can be saved with no rating, with Like or with Dislike. Changing or clearing a rating preserves the Save state; changing the Save state preserves the rating.
3. Apply the same interaction to scalar, Research Questions and Outcomes evaluations. Maintain keyboard operation, meaningful accessible names and accurate selected/pressed states.
4. Keep the confirmed state when a request fails and allow retry. Prevent duplicate submissions during pending requests. Preserve stale-result restrictions and ensure a fresh evaluation has its own feedback state.
5. Persist the current rating and Save state for the correct evaluation. Repeated clicks or network retries must not create duplicate independent records or leave superseded ratings counted as current. Test all combinations and orders, including rating then Save and Save then rating.
6. Preserve scores, result text, recommendation rules, plan values and the exclusion of these controls from print/PDF.

## Storage decision to resolve during refinement

The current Save action submits the evaluation as a calibration/review record; it is not a bookmark or the form's draft-saving action. Like and Dislike use the same endpoint. The server appends records without a stable evaluation record ID or an update operation. Simply re-enabling the buttons would create additional records on every click.

Agree with the RPA-3 owner how toggling Save off affects the retained review record and how cleared/changed ratings are represented. The interface's latest state and stored record must agree. Keep access, retention/deletion policy and wider storage work with RPA-3/RPA-80; do not silently treat an off toggle as physical deletion or redesign storage inside the spelling ticket.

## Implementation and validation references

- `app.js`: `renderEvalControls` feedback handlers and `saveForCalibration`.
- `server.js`: `handleSaveCalibration` and the append-only calibration record path.
- `test/rpa-63-evaluation-panel-polish.test.js`: existing successful-submit locking assertions will need deliberate revision in the follow-up.
- Cover toggle sequences, independent Save/rating state, failures and retries, stale/new evaluations, duplicate prevention, keyboard/accessible states and print exclusion using deterministic offline tests.
- Manual checks for the implemented follow-up: toggle each control on/off; switch Like to Dislike; combine either rating with Save in both orders; retry a simulated failure; verify a fresh evaluation and narrow-screen keyboard operation.
