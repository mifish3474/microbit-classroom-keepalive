# Micro:bit Classroom Keep-Alive

A local Chrome Manifest V3 prototype for a teacher's dedicated **Classroom Monitor** virtual student. It monitors the student page and editor, warns about connection problems, and optionally performs reversible Blockly layout changes. **It does not establish that edits prevent session expiration.**

Prepared November 3, 2026 for a live trial before Thursday, November 5. No classroom was created or joined and no real student account was used during development. See [investigation](docs/INVESTIGATION.md), [testing and overnight checklist](docs/TESTING.md), and [substitute recovery sheet](docs/SUBSTITUTE.md).

**Version 0.1.1:** Fixes the misleading “Action failed” error for unsupported intervals. This prototype accepts **3–60 whole minutes**, not 1 minute: a cycle uses separate move, restore, and verification checks. Invalid input now explains the limit without changing a running monitor. For a faster manual check, leave the interval at 3 and use **Check now**, waiting several seconds between clicks.

## Install in Chrome on Windows

1. Keep the project on the teacher's computer. Extract the handoff ZIP if using it.
2. Open `chrome://extensions`, enable **Developer mode**, and choose **Load unpacked**.
3. Select **extension/**, the directory containing `manifest.json`, not the repository root.
4. Pin **Micro:bit Classroom Keep-Alive** from Chrome's Extensions menu. Chrome 120 or later is required; use the school's supported current release.
5. Allow access to the two listed sites if Chrome asks. School-managed Chrome may require IT approval for unpacked extensions; do not bypass that policy.

No build or npm install is needed. Only `extension/` is installed; the handoff ZIP also includes the instructions. The supplied `reference/` captures contain private classroom data: do not distribute them or publish this whole repository.

## Create a test classroom and start

1. Manually create a classroom with **no real pupils** using Micro:bit Classroom. Keep the teacher dashboard open.
2. Join in a second Chrome window as **Classroom Monitor**, exactly spelled. If shared browser storage interferes with the two sessions, use separate Chrome profiles and install the extension in the monitor profile. Incognito is unnecessary.
3. Leave the monitor in **Blocks** mode with a simple disposable program containing an **on start** block. Do not put real pupil work in this virtual student.
4. Make the monitor's student tab active. Open the popup and confirm that this is your dedicated virtual student.
5. Initially leave experimental movement **off** and click **Start on this tab**. This tests whether a joined monitor alone helps.
6. To test edits, **Stop**, enable **experimental reversible block movement**, choose an interval, and **Start** again. The default is **3 minutes**; whole-minute values **3–60** are accepted. Settings take effect on Start.
7. Close the popup. A `chrome.alarms` check runs every minute. Only the selected tab is authorized; switching tabs does not transfer authorization. Stop before switching targets.

Start refuses teacher pages, unjoined pages, other displayed student names, or a missing/ambiguous MakeCode iframe. The name check follows the supplied English UI structure; a site redesign or localization may need an adapter update. Never rename a real student to satisfy this guard.

## Read the status accurately

| Display | Meaning |
| --- | --- |
| Monitoring / target / page | Extension state and designated tab. A loaded page alone proves no connection. |
| Student status | Student UI and visible app connection warnings. “Appears connected” is not a server acknowledgement. |
| Transport | Optional read-only Pusher state. A connected socket does not prove classroom membership or new joins. “Not observable” means unknown. |
| Editor | Runtime Blockly availability or pending/refused activity. |
| Last attempt | A requested move, including unsuccessful attempts. |
| Editor-confirmed / count | A shift-and-restore cycle with both matching Blockly events and coordinates verified. This does not prove delivery to the teacher/server. |
| Editor save observed | A normal `pxthost/workspacesave` envelope arrived from the exact iframe. No payload is read. It is not attributed exclusively to automation. |
| Reachability | Always currently unverified. You can record a successful separate-device join; this stores your confirmation time, not an automatic network test. |

Badge **?** means monitoring; **!** means a warning. There is no green “session safe” status. An observation gap over 2½ minutes is stale and pauses new edits. Warnings latch deliberately: fix the cause, then Stop and explicitly Start again.

**Check now** observes and advances pending restoration. **Try activity now** requests a cycle only when enabled and idle. Neither joins or reconnects a classroom. **Stop** cancels monitoring and tries to restore a pending move when the original document and block remain safely identifiable.

## Confirm real local editor activity

On Start with movement enabled, a supported top-level **on start** (or forever) block moves **24 workspace units horizontally**. No fields, code text, connections, or blocks are added/deleted. The adapter checks that Blockly's ordered traversal remains unchanged, rolling back unsafe ordering changes immediately.

On the next minute's check, it verifies the move event and restores the original coordinates. On the following check, it verifies restoration and increments **Activity count**. The first full cycle normally takes about two minutes; subsequent cycles start on the chosen interval, subject to scheduling delays. For a faster manual check, wait several seconds between **Check now** clicks for queued Blockly events.

API failure, hidden/read-only editor, missing starter block, manual layout changes, or unobserved events pause activity. There is no fallback to fake mouse/keyboard input. Immediate move-and-undo is avoided because Blockly can merge it into no change. A crash/reload can leave the temporary shifted layout saved; it does not change executable behavior. Moves may enter the editor's undo history or trigger its normal simulator/save behavior. Do not edit the monitor program while automation runs.

## Workstation reliability

- Plug in the computer. In Windows **Settings → System → Power & battery → Screen, sleep, & hibernate timeouts**, set plugged-in sleep to **Never** during the trial if school policy permits. Labels vary on older Windows. Check laptop lid-close behavior. Turning off a display differs from sleeping. [Windows power settings](https://support.microsoft.com/en-au/windows/experience/power-battery/power-settings-in-windows-11)
- In Chrome **Settings → Performance → Always keep these sites active**, add `classroom.microbit.org` and `makecode.microbit.org`. Labels can vary by version. Keep both classroom windows open. [Chrome performance settings](https://support.google.com/chrome/answer/12929150?hl=en-GB)
- Keep the approved network connected. Do not disable school sign-in, filtering, firewall, or security controls. Arrange any restart timing with IT.
- Save/export the classroom using the app's official mechanism before leaving; rehearse recovery with a test export.

Chrome alarms may be delayed and do not wake a sleeping computer. They wake the extension worker, not Windows or a discarded renderer. Alarms are checked/recreated when the worker starts. Authorization is held in `storage.session`, so browser restart, extension reload/update, or disabling the extension requires a new Start. Page reload/navigation, tab replacement, and iframe replacement also stop authorization. The app may reconnect normally; the extension initiates no reconnect. [Chrome alarms documentation](https://developer.chrome.com/docs/extensions/reference/api/alarms)

## Privacy and implementation

Permissions are only `alarms`, `scripting`, `storage`, and host access to `https://classroom.microbit.org/*` and `https://makecode.microbit.org/*`. There is no broad tabs permission, cookies access, debugger, webRequest, notifications, analytics, remote script, or extension-origin network request.

Scripts are injected into the selected tab only. Read-only discovery uses `allFrames`; mutations target the exact MakeCode document ID in MAIN world after isolated-world identity checks. Page postMessage traffic cannot command edits. The passive save listener validates the pinned iframe's window and origin.

The dedicated name slot is compared locally with **Classroom Monitor**; only a boolean leaves the page. No name is retained. Blockly references and original coordinates stay transiently in the designated editor. No code, XML, credentials, classroom links, roster, or message payloads are collected. Chrome URLs are used transiently for allowlist checks, never logged or exported.

Only interval/activity preference persists in `storage.local`. Run state and up to 120 timestamp/status-code log entries use `storage.session`, cleared on browser restart. The optional manually exported JSON excludes tab/classroom identifiers and raw errors. Normal MakeCode/Classroom behavior may transmit the monitor layout through its existing services. The extension adds no destination and does not alter the website's own privacy/telemetry behavior.

## Tests

Use Node.js 24+; no third-party dependencies:

```powershell
npm test
npm run test:browser
npm run test:browser -- --alarms
```

The browser fixture uses a separate headless Edge profile because branded Chrome may restrict command-line unpacked-extension loading. Set `BROWSER_EXE` to a compatible Chromium executable if needed. Interception is installed before test navigation; classroom/editor pages are synthetic. No sign-in or classroom join occurs. `--alarms` adds a real one-minute alarm test after closing the popup and stopping the worker. The temporary profile is removed afterward.

This is Chromium integration evidence, not live Chrome/MakeCode longevity evidence. The remaining acceptance work is a real test classroom, fresh joins after several hours/overnight, and recovery rehearsal on the school workstation. Prefer passive monitoring if it proves sufficient.
