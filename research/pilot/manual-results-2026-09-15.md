# Manual local pilot results — 15 September 2026

Max completed the local walkthrough on `429c729-local-mock`, using the
application content merged in main `d1309c0`. This was a synthetic loopback
preview, with submissions and feedback OFF; it was not hosted acceptance.

## Passed

- Both local signatures reached Approved; screenshot supplied.
- Feedback collection was unavailable; screenshot supplied.
- Reopen, edit Background, Tab/Shift+Tab and reload: Max reported steps 1–3
  passed, with a screenshot of the retained edit.
- An actual browser-created JSON backup was inspected on disk: 5,499 bytes,
  version 9, containing the dummy answers and both signature records.
- Restore with replacement confirmation: Max reported steps 4–5 passed.
  His screenshot shows the successful restore message and the original
  Background value. Restored Approved status is user-reported.

No repeat of this original walkthrough is needed. These results do not claim
that the follow-up changes below were tested by Max, that an email was sent,
or that a deployed service/private file exchange was verified.

## Findings addressed by this follow-up

- Date messages were squeezed beside date segments. On screen they now occupy
  full rows below the date, while date segments stay together.
- Document creation is advisory: research may precede writing the document.
  The note explicitly says so, and the picker and submission contract agree.
  Stage completion must still be on/after its start, and dates cannot exceed
  the readout. User-entered dates are preserved.
- With submissions OFF, Other sample size was checked only for presence and
  incomplete schedule rows could count as complete. Numeric sample-size and
  complete/ordered schedule checks now apply on Save and continue and before
  new local signatures. No AI evaluation or score is required.
- Newly entered initials are capitalised when the date is added, and that
  change is saved. Existing dated signatures keep their original text/date.

Incomplete drafts remain editable, downloadable and restorable. Existing
signature history remains historical evidence, including records created by
older versions that permitted incomplete plans. Reopen and correct such a plan
before obtaining new signatures.

## Short recovery check for future use

Use a dummy plan in the intended browser. Backup does not require Review or
completed answers. For an approved plan, first Reopen it to allow an edit.

1. Download backup from Menu and locate the actual JSON file.
2. Change one known field; use Tab/Shift+Tab, wait a second and reload.
3. Confirm the changed value remains.
4. Restore the downloaded JSON and confirm replacement.
5. Confirm the success message and the original value/history return.

For sign-off tests starting at Not started, choose a role, confirm its
declaration and enter initials, then identify the other dummy role with a
different `example.com` address. After the first local signature, confirm the
other declaration, enter its initials and Sign. Distinct address strings are
not verified identities; this remains a local demonstration.

Deployment and hosted technical acceptance remain separate release gates.
