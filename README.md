# Micro:bit Classroom Keep-Alive

A local Chrome Manifest V3 prototype for a teacher's dedicated **Classroom Monitor** virtual student. It monitors the student page and editor, warns about connection problems, and optionally adds/deletes a visible disabled icon block or performs reversible layout changes. **It does not establish that edits prevent session expiration.**

Prepared November 3, 2026 for a live trial before Thursday, November 5. No classroom was created or joined and no real student account was used during development. See [investigation](docs/INVESTIGATION.md), [testing and overnight checklist](docs/TESTING.md), and [substitute recovery sheet](docs/SUBSTITUTE.md).

**Version 0.2.4:** Your confirmation checkbox designates the monitor tab; the extension no longer reads or checks the student name. Compact windows work even when Classroom hides its desktop Leave button. Start still requires a student page with the expected editor, and automation stays pinned to your selected tab and editor document. Stop before changing that tab to another student or classroom. This fixes the known compact-header failure, not every possible browser or server failure.

Previous-run recovery remains available: explicit Start with icon activity enabled clears a provably completed old deletion record or safely removes its own unchanged, disconnected icon before starting a new cycle. It does not count the old cleanup as activity. Changed, connected, unknown, or unverified blocks remain protected.

Background monitoring continues, but icon edits wait while the editor is hidden. Blockly's event delivery depends on animation frames, which Chrome can suspend in background/minimized pages. The popup shows **Waiting for visible editor** and resumes when visible, unless another warning has paused activity. Keep Classroom Monitor as the selected tab in a separate, visible, non-minimized Chrome window while working in another window. An unobscured second monitor is useful. Browser visibility is an imperfect signal; check the popup and actual block cycle on your workstation.

Missing delete events still get an extra two minutes for verification. If the event never arrives, continuing requires confirmed creation and proof that the owned block was disposed and removed from both the workspace and rendered page. These cycles have a separate counter and do not count as event-confirmed activity or server delivery. Late deletion confirmation can now recover a deletion-only pause; it never clears an independent connection, lock, or observation-gap pause. Missing creation confirmation keeps the icon in place and retries instead of deleting it prematurely.

Choose **Add/delete show icon block**, enable activity, and set **1 minute**. The extension adds MakeCode's built-in show icon block in the visible workspace, leaves it for a full minute, deletes it, leaves it absent for a full minute, and repeats. The block is disabled and disconnected so it does not run. Missing-event verification can extend the absent period. The previous move/restore mode is still available.

**Upgrade:** Click **Stop** in the old extension, open `chrome://extensions`, and click **Reload** for Classroom Keep-Alive. On the Classroom Monitor student tab, confirm the identity, enable activity, select the icon mode and interval, and click **Start** again. Files alone do not reload an already running extension. Inspect the monitor for any leftover test icon before restarting.

## Install in Chrome on Windows

1. Keep the project on the teacher's computer. Extract the handoff ZIP if using it.
2. Open `chrome://extensions`, enable **Developer mode**, and choose **Load unpacked**.
3. Select **extension/**, the directory containing `manifest.json`, not the repository root.
4. Pin **Micro:bit Classroom Keep-Alive** from Chrome's Extensions menu. Chrome 120 or later is required; use the school's supported current release.
5. Allow access to the two listed sites if Chrome asks. School-managed Chrome may require IT approval for unpacked extensions; do not bypass that policy.

No build or npm install is needed. Only `extension/` is installed; the handoff ZIP also includes the instructions. The supplied `reference/` captures contain private classroom data: do not distribute them or publish this whole repository.

## Create a test classroom and start

1. Manually create a classroom with **no real pupils** using Micro:bit Classroom. Keep the teacher dashboard open.
2. Join in a second Chrome window as your dedicated virtual student; **Classroom Monitor** is the suggested name, but spelling is no longer checked. If shared browser storage interferes with the two sessions, use separate Chrome profiles and install the extension in the monitor profile. Incognito is unnecessary.
3. Leave the monitor in **Blocks** mode with a simple disposable program containing an **on start** block. Do not put real pupil work in this virtual student.
4. Make the monitor's student tab active. Open the popup and confirm that this is your dedicated virtual student.
5. Initially leave experimental activity **off** and click **Start on this tab**. This tests whether a joined monitor alone helps.
6. To see edits, **Stop**, enable **experimental editor activity**, select **Add/delete show icon block**, set **1 minute**, and **Start**. This mode accepts whole-minute intervals **1–60**; each present/absent state lasts at least that long. New installations default to this mode at 1 minute. Existing settings may be remembered, so select the mode and interval explicitly after upgrading. **Move/restore existing block** retains the **3–60** minute range. Settings take effect on Start.
7. Close the popup. Monitoring and scheduled checks use `chrome.alarms`. Only the selected tab is authorized; switching tabs does not transfer authorization. Hidden icon editors wait and resume when visible; use a separate visible monitor window for ongoing edits. Stop before switching targets.

Start refuses teacher pages, pages without the joined-student controls, and a missing/ambiguous MakeCode iframe. It trusts your confirmation that the selected tab is your disposable monitor; it cannot distinguish that tab from a real student's tab by name. The student controls may be hidden by the compact layout, but the header and editor structure must still exist. A site redesign or localization may need an adapter update.

## Read the status accurately

| Display | Meaning |
| --- | --- |
| Monitoring / target / page | Extension state and designated tab. A loaded page alone proves no connection. |
| Student status | Student UI and visible app connection warnings. “Appears connected” is not a server acknowledgement. |
| Transport | Optional read-only Pusher state. A connected socket does not prove classroom membership or new joins. “Not observable” means unknown. |
| Editor | Runtime Blockly availability or pending/refused activity. |
| Editor visibility / Activity | Hidden pages wait without further edits; visible pages resume verification and due edits unless independently paused. Monitoring remains active. |
| Last attempt | A requested editor operation, including unsuccessful attempts. |
| Activity type / cycle / next editor change | Which activity is selected, whether the icon is present or absent, and when the next change is due. Chrome can delay alarms; these are not real-time deadlines. |
| Editor-confirmed / count | A complete add/delete or move/restore cycle with matching Blockly events verified. This does not prove delivery to the teacher/server. |
| Cycles without delete event / Verification | Separate count of cycles with confirmed creation and verified local removal but no observed delete event. A waiting notice means verification is retrying; a workspace-only notice means activity continued without claiming event confirmation or server receipt. |
| Editor save observed | A normal `pxthost/workspacesave` envelope arrived from the exact iframe. No payload is read. It is not attributed exclusively to automation. |
| Reachability | Always currently unverified. You can record a successful separate-device join; this stores your confirmation time, not an automatic network test. |

Badge **?** reminds you to check a fresh join. After a successful separate-device join, check the confirmation box and click **Record my join check** to clear it for this monitoring run. Monitoring continues; the popup retains your check time and still labels current reachability unverified. A new Start resets the reminder. Badge **!** means a warning and cannot be dismissed by recording a join. A blank badge is not a “session safe” status. An observation gap over 2½ minutes is stale and pauses new edits. Connection/safety warnings latch: fix the cause, then Stop and explicitly Start again. A deletion-only verification warning may clear automatically once late proof arrives and no independent pause has occurred.

**Check now** observes and advances due operations. **Try activity now** requests a cycle only when enabled and idle. Neither button shortens the icon's present/absent interval or reconnects a classroom. **Stop** cancels monitoring and removes the extension-owned icon (or restores a pending move) when the original document and block remain safely identifiable. An explicit Stop can remove the icon immediately.

## Confirm real local editor activity

For **Add/delete show icon block**, keep the Blocks workspace visible and watch near its bottom center. The extension uses Blockly's current scroll/zoom-aware viewport, measures the block, and checks its rendered bounds. If the editor is hidden or too small for the whole icon block, it refuses the edit and reports the issue. Widen the editor and restart monitoring. Existing blocks are not moved to make room.

With a 1-minute interval, the expected sequence is: **Start: icon appears → about +1 minute: icon disappears → about +2 minutes: icon reappears → about +3 minutes: icon disappears**. Each state lasts at least a full minute; Chrome delays may make it longer. At the re-add check, the previous add/delete cycle is counted only after both corresponding Blockly events have been observed. The block is greyed because it is intentionally disabled. It remains disconnected and cannot be moved or edited through the normal UI. If it is connected to other code or otherwise changed, automatic deletion refuses rather than risking another block.

To verify propagation separately, watch **only Classroom Monitor's program** on the teacher dashboard during the minute it contains the icon. Check whether the icon appears there and whether **Editor save observed** advances. The extension observes save-envelope metadata but no acknowledgement from the server. Disabled blocks change the workspace representation while leaving executable behavior unchanged; the app/server could still deduplicate them. A successful join after hours/overnight remains the required longevity test.

The legacy **Move/restore existing block** mode moves a supported starter block 24 workspace units horizontally, leaves it until a later check, restores it, then verifies the restore event. It never adds/deletes blocks. That is the earlier subtle edit, not an instantaneous undo.

API failure, read-only editor, ownership changes, or unverified deletion pause new activity. Background visibility and delayed creation events instead put icon activity into an automatic waiting state. A missing icon delete event triggers retries for up to two additional minutes after the normal absent interval; verified local removal permits continuing with a separate counter. This never clears a connection, lock, or observation-gap pause. Connection monitoring continues while edits wait or are paused. No fake mouse/keyboard fallback is used. A crash/reload can leave a disabled icon or shifted layout saved; inspect the monitor before restarting and manually remove any leftover disabled test icon. The extension will not claim or delete an unknown leftover block. Operations may enter undo history or trigger MakeCode's normal simulator/save behavior. Do not edit or undo the monitor program while automation runs.

## Workstation reliability

- Plug in the computer. In Windows **Settings → System → Power & battery → Screen, sleep, & hibernate timeouts**, set plugged-in sleep to **Never** during the trial if school policy permits. Labels vary on older Windows. Check laptop lid-close behavior. Turning off a display differs from sleeping. [Windows power settings](https://support.microsoft.com/en-au/windows/experience/power-battery/power-settings-in-windows-11)
- In Chrome **Settings → Performance → Always keep these sites active**, add `classroom.microbit.org` and `makecode.microbit.org`. Labels can vary by version. Keep both classroom windows open. [Chrome performance settings](https://support.google.com/chrome/answer/12929150?hl=en-GB)
- Keep the approved network connected. Do not disable school sign-in, filtering, firewall, or security controls. Arrange any restart timing with IT.
- Save/export the classroom using the app's official mechanism before leaving; rehearse recovery with a test export.

Chrome alarms may be delayed and do not wake a sleeping computer. They wake the extension worker, not Windows or a discarded renderer. Alarms are checked/recreated when the worker starts. Authorization is held in `storage.session`, so browser restart, extension reload/update, or disabling the extension requires a new Start. Page reload/navigation, tab replacement, and iframe replacement also stop authorization. The app may reconnect normally; the extension initiates no reconnect. [Chrome alarms documentation](https://developer.chrome.com/docs/extensions/reference/api/alarms)

## Privacy and implementation

Permissions are only `alarms`, `scripting`, `storage`, and host access to `https://classroom.microbit.org/*` and `https://makecode.microbit.org/*`. There is no broad tabs permission, cookies access, debugger, webRequest, notifications, analytics, remote script, or extension-origin network request.

Scripts are injected into the selected tab only. Read-only discovery uses `allFrames`; mutations target the exact MakeCode document ID in MAIN world after teacher confirmation and isolated-world student-page checks. Page postMessage traffic cannot command edits. The passive save listener validates the pinned iframe's window and origin.

Student names are neither read nor retained. Blockly references and original coordinates stay transiently in the designated editor. No code, XML, credentials, classroom links, roster, or message payloads are collected. Chrome URLs are used transiently for allowlist checks, never logged or exported.

Only interval/activity-type/activity-enabled preferences persist in `storage.local`. Run state and up to 120 timestamp/status-code log entries use `storage.session`, cleared on browser restart. The optional manually exported JSON excludes tab/classroom identifiers and raw errors. Normal MakeCode/Classroom behavior may transmit the monitor workspace through its existing services. The extension adds no destination and does not alter the website's own privacy/telemetry behavior.

## Tests

Use Node.js 24+; no third-party dependencies:

```powershell
npm test
npm run test:browser
npm run test:browser -- --alarms
npm run test:browser -- --marker-alarms
```

The browser fixture uses a separate headless Edge profile because branded Chrome may restrict command-line unpacked-extension loading. Set `BROWSER_EXE` to a compatible Chromium executable if needed. Interception is installed before test navigation; classroom/editor pages are synthetic. No sign-in or classroom join occurs. `--alarms` tests the legacy move/restore alarm after closing the popup and stopping the worker. `--marker-alarms` tests actual icon deletion and re-addition over two full minutes. Run these flags separately. The temporary profile is removed afterward.

This is Chromium integration evidence, not live Chrome/MakeCode longevity evidence. The remaining acceptance work is a real test classroom, fresh joins after several hours/overnight, and recovery rehearsal on the school workstation. Prefer passive monitoring if it proves sufficient.
