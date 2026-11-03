# Investigation — November 3, 2026

Reviewed `spec.md`, both supplied outer HTML files, extracted editor HTML/JavaScript, and the ZIP inventory. Saved captures are private snapshots, not proof of live behavior. No captured session identifier or program was copied into this extension or documentation.

## Confirmed from supplied files

| Evidence | Finding and consequence |
| --- | --- |
| Student HTML | Saved from `https://classroom.microbit.org/join`; contains `data-testid="student-leave"`, a distinct displayed-name slot, and `section[aria-label="Code editor"] iframe[title="MakeCode"]`. The captured student is **not** Classroom Monitor, so the capture must fail the activity guard. |
| Editor HTML | Saved from `https://makecode.microbit.org/?lang=en&controller=1&hideMenu=#editor`, with Blockly SVG. Browser save rewrites iframe URLs to local paths. Live access is cross-origin; local saved pages are not authorized targets. |
| `main.js.download` | Exposes `pxt.blocks.requireBlockly=()=>...`. Blockly has workspace access, `BlockSvg.moveBy`, and queued `BlockMove` events. MakeCode's workspace listener includes moves in `changeCallback()`. Runtime API availability still needs testing. |
| Classroom bundle | Handles `pxthost/workspacesave` and `editorcontentloaded`; the normal save handler forwards projects. The extension observes envelope metadata only, never project payloads or controller commands. |
| Classroom bundle | Uses Pusher/presence and optionally WebRTC. The app's connected predicate requires Pusher connected, classroom subscribed, and teacher not offline. A socket state alone is therefore insufficient. |
| Classroom bundle | `data-testid="connection-error-indicator"` covers expired/ended sessions, subscription failure, transport trouble, teacher offline, and last-code-send failure. `screen-locked` is also exposed. Unknown warning wording is reported generically. |
| Classroom bundle | A teacher-side flow checks every 15 minutes for a dead classroom and can call `disconnect("expiry")`. This is an expiry detection path, **not** evidence of a 15-minute session lifetime. The extension never calls these endpoints. |
| Recovery HTML | Contains **Continue classroom session**, a storage iframe, and `resume-reset` recovery data. This is export/recovery, not keep-alive behavior. Recovery may issue different joining details. |
| ZIP inventory | Corresponds to the extracted Classroom/MakeCode asset set, including main/pxt/target assets and iframe documents. No supported keep-alive endpoint was established. Do not ship the archive. |

## Chosen activity

The adapter selects a movable top-level `pxt-on-start` or `device_forever` only. The former is confirmed in the captured main bundle; the latter is an optional supported type. It moves horizontally 24 workspace units, verifies unchanged ordered top-level traversal, and later restores exact original coordinates. It reads no fields or generated code. Changed block/workspace identity, coordinates, or top-level order cause refusal rather than overwriting later edits.

Immediate move-and-inverse can be filtered into a no-op by Blockly. Holding the harmless layout shift until the next alarm allows the normal editor to process it. Both exact-coordinate move events must be observed before a cycle counts. This proves local editor handling only: unchanged generated code may still be deduplicated downstream. No synthetic event is treated as trusted user input.

Activity is opt-in and initially off. An unavailable API yields monitoring only. The observed module adapter is an implementation detail, not a promised Micro:bit API. Whole-project import/save, coordinate dragging, fake heartbeats, networking monkeypatches, and undocumented server requests are excluded. A supported future editor API would be preferable if it safely supports minimal edits.

## Hypotheses and live work still required

- Whether current MakeCode exposes this adapter and active workspace on the school computer.
- Whether layout edits produce normal save messages and reach the teacher; whether they add any benefit beyond a joined monitor.
- Whether timeout is caused by idle membership, teacher connectivity, a hard server lifetime, Chrome throttling, school proxies, or Windows power management.
- Whether the app's sole exposed Pusher instance remains representative in future builds. Multiple instances yield unknown; no presence members or subscription names are read.
- Exact localized warning wording and the joining details issued by live official recovery.

There is no established automatic positive test for fresh classroom joins. The popup therefore reports current reachability as unverified and records only teacher-reported separate-device join times.

## Primary documentation checked

- [Chrome scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting): isolated/MAIN worlds, exact frame/document targeting, and host permissions.
- [Chrome alarms](https://developer.chrome.com/docs/extensions/reference/api/alarms): scheduling delays, sleep, and alarm recreation.
- [Blockly BlockSvg](https://docs.blockly.com/reference/classes/BlockSvg/): relative `moveBy` behavior.
- [Blockly events](https://docs.blockly.com/reference/namespaces/Events/): `BlockMove` observations; appearance alone is insufficient verification.
