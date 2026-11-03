# Testing checklist and operations record

## Development evidence — November 3, 2026

- `npm test`: 34 adapter/settings/worker tests cover event requirements, exact restoration, visible icon placement, minimum holds, ownership checks, delayed/missing events, hidden-editor waiting/resumption, safe recovery, independent pauses, counter accuracy, and explicit Start cleanup of old run records.
- Browser fixture smoke covers real MV3 loading/messaging, cross-origin isolated/MAIN injection, a complete event-confirmed cycle, passive save observation, expiry pause, wrong-student refusal, and iframe invalidation. Its Blockly API is synthetic, so it does not prove live MakeCode compatibility.
- The optional `--alarms` test closes the popup, stops the worker, waits for an actual one-minute alarm, and verifies restoration after worker restart.
- No live Windows Chrome classroom, overnight survival, teacher receipt, or recovery rehearsal has been claimed successful. These remain acceptance work. See `VALIDATION.md` for final command results.

## Live Chrome acceptance test

Install and set up an empty test classroom using [README](../README.md). Do not use real pupil accounts.

- [ ] Teacher dashboard remains open. Manually join as **Classroom Monitor**; use separate Chrome profiles if needed.
- [ ] Start refuses the teacher tab and another test student's tab; neither program changes.
- [ ] Start on the monitor with movement off. Page, student UI, transport, editor, and reachability are separate; reachability says unverified.
- [ ] Close/reopen the popup. Running state persists. Switching tabs does not change the target.
- [ ] With icon activity enabled, switch to another tab for at least four minutes. Monitoring stays running; Activity becomes **Waiting for visible editor**. No additional icon transitions occur. Return to Classroom Monitor; confirmation and edits resume without Stop/Start. Repeat by minimizing its window. Do not confuse waiting with stopped monitoring.
- [ ] Keep Classroom Monitor selected in a separate visible window while working elsewhere. Verify that the popup reports Visible and that the actual icon cycle continues. Fully obscured windows may still be throttled; test the school workstation's arrangement.
- [ ] After a successful separate-device join, check the confirmation box and click **Record my join check**. In 0.1.2, **?** clears, monitoring continues, and the popup keeps the check time without claiming current reachability. A later warning must still show **!**; a new Start resets **?**.
- [ ] Stop, select **Add/delete show icon block**, enable activity, choose interval **1**, and Start. The whole disabled icon block appears near the bottom center of the visible workspace. Existing code stays unchanged.
- [ ] Confirm the icon remains for at least 60 seconds, disappears for at least 60 seconds, then reappears. **Check now** and activity requests must not shorten those holds. Watch **Next editor change** and count only verified complete cycles.
- [ ] Pan/zoom before Start. The new block must appear inside the new visible viewport. Hide or greatly narrow the editor: activity should refuse rather than leave an offscreen block.
- [ ] Confirm the icon appears/disappears in Classroom Monitor's program on the teacher dashboard. This is a separate live receipt test, not something local Blockly events prove.
- [ ] Stop during the present period: only the extension-owned disabled icon is removed. Connecting/changing that block must cause refusal, never deletion of connected code.
- [ ] For the legacy mode, select **Move/restore existing block** with interval 3. A starter block shifts sideways without changed fields/connections/code. Interval 1 is still invalid for this mode and must not reset monitoring.
- [ ] Observe Last attempt, restoration at the next check, then Editor-confirmed/count at the following check. Missing events must not count. Wait several seconds between manual Check now clicks.
- [ ] See whether Editor save observed advances. Check only the disposable monitor's work from the teacher dashboard to determine whether its layout was received.
- [ ] Background both windows and close DevTools. Confirm three cycles over approximately 9–12 minutes. DevTools can change background behavior.
- [ ] Temporarily disconnect the network using approved controls. Expect a warning and paused new edits within a check interval. Restore normal connectivity, inspect the classroom, then Stop/Start explicitly. The extension must not rejoin.
- [ ] Reload/navigate/close the monitor or replace/reload its iframe. Monitoring stops and requires a fresh Start.
- [ ] Switch to JavaScript/hide Blocks. Activity is refused or paused and not counted. In legacy mode, removing the eligible starter block also refuses movement. Fix it, then Stop/Start.
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
| Widen or show Blocks editor | The icon could not be fully contained in the visible workspace. Widen/show the editor, close any overlays, then Stop/Start. |
| Marker changed / delete refused | The owned icon has changed or become connected. Stop and inspect Classroom Monitor only. Never delete a whole connected program to remove the test icon. |
| Waiting for visible editor | Keep the monitor's Blocks tab selected in a visible, non-minimized window. The periodic check resumes activity when visible unless an independent warning paused it. No Stop/Start needed just for visibility. |
| Waiting for creation event | The icon stays in place while the editor catches up; deletion waits for genuine creation confirmation. Bring its window into view. If it remains waiting while visible, export the extension's diagnostics and use passive monitoring pending investigation. |
| Waiting for delete event | In 0.2.1, monitoring continues and verification retries for up to two extra minutes after the normal absent interval. Give it time; Check now cannot bypass the grace period. |
| Delete confirmed in workspace, event missing | The extension verified its own block was removed and continued. The separate counter increases, not the event-confirmed count. Check Classroom Monitor's copy on the teacher dashboard to assess propagation. |
| Delete not confirmed / check monitor | Local removal could not be safely proven. Edits pause; monitoring continues. In 0.2.2, late proof can recover this specific pause if no independent warning has occurred. Otherwise inspect the monitor, resolve the issue, then Stop/Start. Do not ignore a block that changed or became connected. |
| Delete event unconfirmed edits paused (0.2.0) | Upgrade to 0.2.1: Stop, Reload in chrome://extensions, then explicitly enable activity and Start on Classroom Monitor again. |
| Previous edit pending | Upgrade to 0.2.3 and Reload the extension. Explicit Start with icon activity enabled can recover a completed old deletion record or safely clean its own unchanged disconnected icon. It does not require reloading the classroom page. If still refused, Stop, inspect the monitor and export diagnostics; do not repeatedly force edits. |
| Workspace changed | Stop and inspect the disposable monitor. Do not transfer old activity to a different workspace. Manually rejoin if needed, then Start explicitly. |
| Move/restore event unconfirmed | No verified success is counted. Check page responsiveness and Blocks mode, inspect layout, then Stop/Start after fixing the cause. |
| Check monitor layout | Original document/position could not safely be restored. Only monitor layout may be shifted; never bulk-undo teacher/pupil programs. |
| Layout restored, event unconfirmed after Stop | Coordinates were restored but the later event was not verified. It deliberately does not count as a successful cycle. |
| Gap / stale observation / probe failure | Check Windows sleep, Chrome discard/freeze, network, extension site access, and extension errors. New edits pause. Resolve and explicitly Start. |
| Expired / ended / teacher offline | Check the dashboard and a fresh join. No extension credential replay, automatic rejoin, or new link is attempted. |
| UI normal but fresh join fails | Treat reachability as failed and use official recovery. UI/socket evidence is insufficient. |

Use the popup log first. Raw DevTools/network dumps may contain private classroom data; never share them without school-approved redaction. The extension export deliberately omits raw errors and page URLs.
