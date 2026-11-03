# Prototype validation record

## Version 0.1.1 validation fix

The reported failure occurred with a 1-minute interval; 3 minutes worked. Version 0.1.0 rejected values below 3 but incorrectly treated that input error as a probe failure, pausing edits and displaying “Action failed.” Version 0.1.1 validates settings before sending Start, preserves a clear range message through popup refreshes, and separates worker input errors from monitoring failures. The 3–60 minute supported range is unchanged.

- `npm test`: 9 passed, 0 failed.
- `npm run test:browser`: passed popup validation, error-message persistence, and rejection of interval 1 without modifying active run state, logs, or pending restoration; existing edit/restore and isolation checks also passed.
- The browser fixture now includes a nested simulator on an unpermitted origin. This was investigated as a possible cause but did not reproduce the error; the user's interval clarification identified the input-validation path instead.
- No new live-classroom or overnight claim. The actual-alarm result below belongs to the 0.1.0 baseline; scheduling and the movement adapter were not changed in this patch.

## Version 0.1.0 baseline

Date: November 3, 2026 (user's America/New_York schedule).

| Check | Result |
| --- | --- |
| JavaScript syntax checks | Passed for all extension scripts. |
| `npm test` on Node 24.14.1 | 7 tests passed, 0 failed. |
| `npm run test:browser` | Passed on headless Edge 156.0.4314.58 with a separate temporary profile and synthetic classroom/editor pages. |
| `npm run test:browser -- --alarms` | Passed, exit 0: actual minute alarm woke the stopped MV3 worker with popup closed; target state persisted, restoration ran, both events were confirmed. |
| Extension source/network boundary | Three permissions and two specific HTTPS host grants; no extension network calls or remote code. Handoff package allowlists extension, README, and docs. |
| Real Chrome installation and live MakeCode runtime | Pending teacher test. |
| Classroom stays joinable for hours / overnight | Pending controlled A/B/C trials. |
| Official classroom recovery and new joining details | Pending live rehearsal. |

Browser tests verify extension integration, not current MakeCode API availability or Micro:bit's expiration policy. They provide a synthetic Blockly workspace and generated test-only move events. Unit tests also model the API; neither substitutes for observing the real editor and a fresh-device join.

The automated suite required running the isolated headless browser outside the restricted process sandbox. It used no existing browser profile or real student accounts. An early harness run failed to intercept its initial navigation and reached the public, unjoined Classroom application shell; no classroom was created/joined and no credentials were supplied. The harness was corrected to install interception before navigating. The final tests use intercepted pages. An initial alarm harness timeout during worker disposal was also corrected; the final alarm run exited successfully.

To reproduce from the source checkout, use Node 24+, `npm test`, then `npm run test:browser -- --alarms`. Edge is the default test executable; `BROWSER_EXE` can select a compatible Chromium build. Browser fixtures require no live accounts. Manual acceptance and overnight instructions are in [TESTING.md](TESTING.md).
