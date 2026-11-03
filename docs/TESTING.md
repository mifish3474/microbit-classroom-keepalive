# Testing checklist and operations record

## Development evidence — November 3, 2026

- `npm test`: seven adapter tests cover event requirements, exact restoration, missing API/events, manual movement, changed run token, unsafe ordering rollback, Stop, wrong origin, and expired commands.
- Browser fixture smoke covers real MV3 loading/messaging, cross-origin isolated/MAIN injection, a complete event-confirmed cycle, passive save observation, expiry pause, wrong-student refusal, and iframe invalidation. Its Blockly API is synthetic, so it does not prove live MakeCode compatibility.
- The optional `--alarms` test closes the popup, stops the worker, waits for an actual one-minute alarm, and verifies restoration after worker restart.
- No live Windows Chrome classroom, overnight survival, teacher receipt, or recovery rehearsal has been claimed successful. These remain acceptance work. See `VALIDATION.md` for final command results.

## Live Chrome acceptance test

Install and set up an empty test classroom using [README](../README.md). Do not use real pupil accounts.

- [ ] Teacher dashboard remains open. Manually join as **Classroom Monitor**; use separate Chrome profiles if needed.
- [ ] Start refuses the teacher tab and another test student's tab; neither program changes.
- [ ] Start on the monitor with movement off. Page, student UI, transport, editor, and reachability are separate; reachability says unverified.
- [ ] Close/reopen the popup. Running state persists. Switching tabs does not change the target.
- [ ] Stop, enable movement with interval 3, and Start. A starter block shifts sideways without changed fields/connections/code.
- [ ] Enter interval 1 before Start. Version 0.1.1 explains the supported 3–60 minute range; it must not log a probe failure or reset monitoring. Correct it to 3 to proceed.
- [ ] Observe Last attempt, restoration at the next check, then Editor-confirmed/count at the following check. Missing events must not count. Wait several seconds between manual Check now clicks.
- [ ] See whether Editor save observed advances. Check only the disposable monitor's work from the teacher dashboard to determine whether its layout was received.
- [ ] Background both windows and close DevTools. Confirm three cycles over approximately 9–12 minutes. DevTools can change background behavior.
- [ ] Temporarily disconnect the network using approved controls. Expect a warning and paused new edits within a check interval. Restore normal connectivity, inspect the classroom, then Stop/Start explicitly. The extension must not rejoin.
- [ ] Reload/navigate/close the monitor or replace/reload its iframe. Monitoring stops and requires a fresh Start.
- [ ] Switch to JavaScript/hide Blocks/remove the eligible starter block. Activity is refused or paused and not counted. Fix it, then Stop/Start.
- [ ] Change the monitor's block position while a move is pending. Restoration must refuse to overwrite the manual position. Stop and inspect the monitor only.
- [ ] Restart Chrome. Monitoring is stopped. Manually rejoin if necessary; expired credentials are not replayed by the extension.
- [ ] From an unrelated tab, Stop the original target. The unrelated tab remains untouched.
- [ ] Export diagnostics: only times, fixed codes, interval, counts, and manual join time; no names, programs, credentials, URLs, or raw errors.

## Controlled comparison

Use as many simultaneous classrooms/profiles as practical, avoiding shared-storage interference. Sequential tests are acceptable. Hold power/network conditions constant and document differences. Do not put joining credentials in a shared test record.

| Variant | Teacher dashboard | Virtual monitor | Automated edits | Fresh join: start / +2h / +3h / next morning |
| --- | --- | --- | --- | --- |
| A: control | Open | No | No | Pending |
| B: passive | Open | Yes | Off | Pending |
| C: activity | Open | Yes | On, locally verified | Pending |

Record time in America/New_York, browser version, foreground/background state, power/sleep state, network interruptions, activity count, warnings, and the first failed fresh join. Repeat a failure once from a fresh browser context to distinguish cached state from reachability.

| Evidence category | Proof | Does not prove |
| --- | --- | --- |
| Attempted | Extension requested a move | Editor processed it |
| Editor-confirmed | Both matching move/restore events and positions | Delivery or server longevity |
| Connection-observed | UI/warning/optional transport at a timestamp | New students can join |
| Join-verified | Actual separate-device join reported by teacher | Future access |

## Overnight procedure for November 5 readiness

1. **Tuesday, November 3:** Complete the short test and official recovery rehearsal with a disposable export. Start overnight B or C; add an A control if practical. Record a fresh-device join and export diagnostics before leaving.
2. Plug in the workstation, apply school-approved sleep/Memory Saver settings, keep both classroom windows open, close DevTools, and avoid planned restarts. Record the next check time.
3. **Wednesday morning, November 4:** Before interacting with the monitor, try a fresh join from another device. Record time/pass/fail, then inspect warnings/counts and export the log. An already joined student page does not suffice.
4. Prefer B if it works as well as C. If C alone seems effective, repeat C Wednesday night. One successful night is evidence, not a guarantee. Keep a saved recovery file ready.
5. **Thursday morning, November 5:** Verify another fresh join before class. If it fails, follow the substitute sheet and manually distribute current joining details through the approved channel.

An overnight trial cannot be completed during a development turn. Do not label Thursday access reliable until the actual workstation passes the live checks.

## Failure diagnosis

| Symptom | Action |
| --- | --- |
| Start refused | Confirm `/join`, joined status, exact Classroom Monitor name in the student header, and MakeCode iframe. Do not weaken identity checks. |
| API unavailable / no movable block | Use visible editable Blocks and a normal on-start block. Stop/Start. If still unavailable, use passive monitoring and report incompatibility. |
| Previous edit pending / workspace changed | Stop, inspect the disposable monitor, restore its layout manually if needed, then reload/rejoin and Start explicitly. Do not repeatedly force edits. |
| Move/restore event unconfirmed | No verified success is counted. Check page responsiveness and Blocks mode, inspect layout, then Stop/Start after fixing the cause. |
| Check monitor layout | Original document/position could not safely be restored. Only monitor layout may be shifted; never bulk-undo teacher/pupil programs. |
| Layout restored, event unconfirmed after Stop | Coordinates were restored but the later event was not verified. It deliberately does not count as a successful cycle. |
| Gap / stale observation / probe failure | Check Windows sleep, Chrome discard/freeze, network, extension site access, and extension errors. New edits pause. Resolve and explicitly Start. |
| Expired / ended / teacher offline | Check the dashboard and a fresh join. No extension credential replay, automatic rejoin, or new link is attempted. |
| UI normal but fresh join fails | Treat reachability as failed and use official recovery. UI/socket evidence is insufficient. |

Use the popup log first. Raw DevTools/network dumps may contain private classroom data; never share them without school-approved redaction. The extension export deliberately omits raw errors and page URLs.
