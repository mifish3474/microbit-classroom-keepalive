# Prototype validation record

## Version 0.2.4 teacher-confirmed target and compact headers

- The teacher confirmed maximizing the window fixed Start. Captured Classroom code hides the desktop Leave button below its large-screen breakpoint; the old extension mistakenly used that button's visibility as evidence of a joined student. The revised probe uses its unique presence in a visible header plus the exact student route and editor structure.
- At the teacher's explicit request, the confirmation checkbox now designates the monitor. Student names are no longer read or compared, and name changes do not invalidate authorization. Teacher pages, unconfirmed Starts, missing/ambiguous editors, navigation, and iframe changes remain guarded. Stop before changing the selected tab to another student/session.
- `npm test`: 37 passed, 0 failed, including compact/full header recognition, no name inspection, ambiguous-control and incorrect-route/origin refusal, and retained expiry detection.
- `npm run test:browser`: verified Start with a hidden desktop Leave button, active monitoring through 640/1200/640 pixel viewport changes, required explicit confirmation, and acceptance of a different displayed test name. Existing activity/recovery/isolation regressions also ran. Tests use synthetic pages, not live students.
- No guarantee of uninterrupted operation: hidden-editor waits, insufficient workspace area, sleep/discard, network interruptions, and server expiration still apply. Live compact-window and overnight acceptance remain necessary.

## Version 0.2.3 previous-run recovery

- The teacher confirmed the immediate generic adapter warning had underlying status `previous-edit-pending`. The MAIN-world editor record can survive an extension reload while the worker loses its old authorization token; the old guard consequently refused even harmless cleanup under the new token.
- Explicit Start with icon activity enabled now prepares the pinned editor after checking the dedicated student identity, connection UI, lock state, and iframe document. Recovery clears only a provably completed owned deletion or removes the still-referenced, unchanged, disabled, disconnected owned leaf using ordinary guarded cleanup. Ordinary probes/Stop cannot claim another token; changed/connected/unverified records still refuse. No page reload, automatic rejoin, or additional network access is used.
- `npm test`: 34 passed, 0 failed. New cases cover completed and present old markers, rejection of changed/connected/unproven state, specific error mapping, and no recovery on passive, wrong-student, locked, or disconnected Start.
- Browser fixture regression models lost authorization by changing the owned test record's token. Explicit Stop/Start recovers both a present owned icon and an absent disposed icon, keeps the original program untouched, and does not count old activity. This models the reload consequence rather than performing a real extension reload.
- Live acceptance and overnight accessibility remain unverified. Source and desktop version: 0.2.3.

## Version 0.2.2 background editor handling

- The teacher reported recurrence while the monitor was backgrounded/minimized. Captured MakeCode `main.js.download` confirms Blockly event dispatch goes through `requestAnimationFrame`, then a timer. Chrome documents suspension of animation-frame callbacks in background pages: https://developer.chrome.com/blog/background_tabs . This is a concrete explanation for delayed events; the exact missing fallback condition in the user's run was not captured.
- Icon operations now wait when the iframe reports hidden visibility. Monitoring continues through alarms; no tab activation, animation-frame monkey patch, private event-queue flushing, or synthetic event is used. Missing creation confirmation retains the icon and retries, preventing an add/delete pair before creation has been observed. A late verified deletion can recover only a deletion-specific pause; independent safety/connection pauses remain latched.
- `npm test`: 29 passed, 0 failed. New regressions cover hidden-page mutation guards, visibility resumption, delayed creation, late deletion after the grace timeout, and revoking automatic recovery after a connection failure or observation gap.
- `npm run test:browser`: exit 0, Edge 156.0.4314.58. The synthetic editor now queues events through animation frames, matching the captured scheduling mechanism. Switching to another real browser tab held the owned icon without mutations; returning resumed removal and verification. Missing-delete recovery and existing integration checks also passed. Time thresholds in this smoke test are accelerated, not an overnight trial.
- Previous advice that continuous icon editing could reliably run in a hidden tab was too optimistic. Use a separate visible window for continuous edits; live school workstation/overnight testing remains required. No new permissions or network destinations.

## Version 0.2.1 delete-event recovery

- The teacher observed the disabled icon appear and disappear in live MakeCode, followed intermittently by `delete-event-unconfirmed-edits-paused`. That warning stopped new edits but left monitoring running. Why the live delete event was missing has not been established.
- The adapter now tracks creation and deletion independently, accepts matching root/workspace identity with optional IDs metadata, and preserves late events. The worker retries missing deletion confirmation for two extra minutes after the normal absent hold. A fallback requires previously observed creation, successful owned disposal, absence from the same workspace, a disposed block object, and a detached SVG. It never clears an independent pause or counts this fallback as an event-confirmed cycle.
- `npm test`: 23 passed, 0 failed. Includes delayed delivery, missing delivery, strict fallback evidence, separate counters, unchanged last event-confirmed activity time, and preservation of connection pauses.
- `npm run test:browser`: passed on isolated headless Edge 156.0.4314.58. A synthetic editor suppressed the delete event; real extension messaging/injection retried, safely re-added, and kept event-confirmed count/time unchanged. This regression uses accelerated adapter timestamps, not a real three-minute delay. Existing identity, warning, visible-placement, and minimum-hold checks also passed.
- No new permissions, external requests, live accounts, or server delivery claims. The actual-alarm baseline below belongs to 0.2.0; the new retry decisions are covered by deterministic worker tests. Background and overnight live acceptance still remain necessary.

## Version 0.2.0 visible icon activity

- `npm test`: 15 passed, 0 failed, including one-minute mode validation, scrolled-viewport placement, full rendered bounds, minimum hold enforcement, missing create/delete events, refusal to delete connected/changed blocks, and owned-only cleanup.
- `npm run test:browser`: passed legacy integration checks and visible disabled-icon creation in a synthetic editor. Check/activity requests did not bypass its one-minute hold; Stop removed only the owned icon.
- `npm run test:browser -- --marker-alarms`: passed with exit 0. After closing the popup and stopping the MV3 worker, a real alarm deleted the icon after its full minute. It remained absent for another full minute, then a real alarm re-added it. The complete create/delete cycle counted once.
- Runtime tests used synthetic Blockly objects and pages, not a live classroom. The captured target identifies `basic_show_icon`; live MakeCode adapter compatibility, teacher receipt, and server longevity still require the teacher's test. The visible mode intentionally leaves executable behavior unchanged.
- Source, package, and desktop handoff are version 0.2.0. No additional host permissions or network calls were introduced.

## Version 0.1.2 badge acknowledgment

Recording a manual separate-device join now clears the **?** reminder for the current monitoring run. The timestamp remains historical evidence in the popup. Warnings retain **!**, and a new Start resets the reminder. No scheduling, movement, permissions, or automatic connection claims changed.

- `npm test`: 9 passed, 0 failed.
- `npm run test:browser`: passed the actual popup confirmation/button flow, blank badge persistence after another check, continued running status, retained timestamp/current-reachability disclaimer, warning precedence even after another confirmation, and reminder reset on a new Start. Existing integration checks also passed.
- No new live or overnight reliability claim.

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
