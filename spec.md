# Codex implementation brief: micro:bit Classroom Session Guardian

## Objective and deadline
Build a minimal, local-only Chrome Manifest V3 extension for a Windows teacher workstation, with a testable prototype today (Tuesday, November 3, 2026) and reliable use targeted for Thursday, November 5. Its purpose is to help a teacher keep an otherwise empty micro:bit Classroom session accessible until students arrive. The teacher manually creates the classroom and manually joins a dedicated **Classroom Monitor** virtual student. Do not claim the extension can defeat server-side expiration until proven in a live test.

## Evidence from supplied captures
- Teacher's saved classroom HTML contains an activity, teacher code, student code, session metadata, and a `resume-reset` message to the micro:bit Classroom storage iframe. This is a **recovery/export** mechanism, not evidence of live keep-alive behavior.
- Student page URL is `https://classroom.microbit.org/join`. It displays a student name, Blocks/JavaScript switch, Raise hand, Leave, and an iframe titled `MakeCode`.
- Embedded editor capture originates from `https://makecode.microbit.org/?lang=en&controller=1&hideMenu=#editor` and contains Blockly SVG/workspace elements. The associated ZIP has editor JS assets. It is a static snapshot: it cannot prove runtime API accessibility, cross-origin messaging, session heartbeats, or whether synthetic edits affect classroom activity.
- The files contain identifiers and example code. Treat all session identifiers as private; never hardcode, log, transmit, or commit them.

## Required behavior (MVP)
1. Teacher opens a classroom dashboard and manually joins a **Classroom Monitor** student in a separate tab/window. Extension is explicitly enabled on that tab by clicking Start; no automatic joining, account spoofing, or bypassing school access policy.
2. Monitor both the outer `classroom.microbit.org` student page and embedded `makecode.microbit.org` editor. Report distinct states: **page present**, **student UI appears connected**, **editor available**, **last successful local editor activity**, **last independently verified classroom reachability**. Never conflate these states.
3. Attempt one **harmless, reversible, real Blockly workspace edit** every 3 minutes *only in the dedicated monitor student's editor*. Prefer supported editor/Blockly APIs, discovered and validated at runtime. Avoid brittle screen-coordinate drags, arbitrary global event dispatch, or changing real students' work. Preserve the initial program and ensure the edit does not affect its semantics; if that cannot be guaranteed, refuse the edit and report why. Do not assume a programmatic edit is equivalent to human input or server activity.
4. Use MV3 `chrome.alarms` for periodic scheduling, a background service worker, and content scripts on narrowly scoped origins. Explicitly handle cross-origin iframes (`all_frames`, origin-specific match patterns) and Chrome isolated-world vs page-world access; use a minimal, validated `postMessage` bridge if needed. Treat all messages as untrusted and validate origins, message types, and tab/frame identity. No arbitrary code execution.
5. Popup: Start, Stop, current target tab, status, last attempt, last verified editor change, last connection observation, error message. A small local-only timestamped diagnostic log with export/copy is useful. Keep alarms/monitoring working when popup closes. Never say “session safe” without an independent check.
6. If a disconnect, editor error, or expired-session screen is detected, show a clear warning (badge and optional Chrome notification). Do not auto-rejoin, silently create a new classroom, or change a classroom URL. A new classroom link may be required after recovery.
7. Restrict access to `https://classroom.microbit.org/*` and `https://makecode.microbit.org/*`; no remote telemetry, analytics, external APIs, credentials, student roster scraping, student names in logs, or broad browser permissions. No storage of classroom PIN, session ID, student code, or teacher code. No data leaves the computer.
8. Extension must not operate on a teacher tab or any other student tab. Require explicit selection/confirmation of the dedicated monitor tab and stop safely if the tab navigates to an unexpected URL.
9. Do not use artificial requests to undocumented server endpoints to impersonate presence or fabricate heartbeats. Inspect the normal app's behavior only for diagnostic purposes. Respect service limits and school policy.

## Investigation first
- Inspect the live page using Chrome DevTools and the supplied saved HTML/ZIP. Determine whether the embedded Blockly API is accessible, which workspace is active, and which supported operations trigger ordinary MakeCode change events. Do not assume `Blockly.getMainWorkspace()` exists in the content script's isolated world.
- Identify stable indicators of student connection and editor availability. Distinguish DOM observations from true server reachability. If there is no reliable server confirmation, explicitly mark reachability as **unverified** and provide a manual second-device join test.
- Check whether a single monitor participant prevents expiration without edits. If yes, prefer passive monitoring over unnecessary synthetic editing.
- If editor activity is necessary, test a minimal reversible action and verify (a) Blockly reports it, (b) the classroom outer UI remains connected, and (c) a second device can still join after the idle period. If no reliable supported editor API exists, ship a monitoring-only MVP rather than unsafe simulated dragging.

## Test plan
A. Control: teacher dashboard open, no virtual student.
B. Monitor student joined, no automated edits.
C. Monitor student joined, extension enabled and edits verified.
For each: record start time, browser foreground/background state, computer sleep state, and whether a separate device can join after 2–3 hours and overnight. Run only as many simultaneous test classrooms as practical. Keep Windows awake and exclude classroom/makecode origins from Chrome Memory Saver. The extension cannot prevent Windows shutdown, power loss, network outages, server-enforced hard expiry, or Chrome termination.

## Recovery / substitute plan
- Before leaving, save the classroom through the application's official export/save mechanism. Store the recovery HTML somewhere the substitute can access under school policy.
- Provide a one-page substitute instruction: try the existing link; if it fails, open the saved classroom HTML, click **Continue classroom session**, obtain the newly issued joining details, and share them with students through the school's approved channel. Verify exact behavior during a live recovery rehearsal; do not assume the old link survives.
- Avoid saving real student data in the extension or its diagnostic logs.

## Deliverables
1. Unpacked Chrome MV3 extension source with readable, commented files and minimal permissions.
2. `README.md` with Windows/Chrome installation, manual virtual-student setup, Start/Stop, power/Memory Saver configuration, limitations, and recovery procedure.
3. Test checklist and diagnostic instructions, with explicit evidence categories: *attempted*, *editor-confirmed*, *connection-observed*, *join-verified*.
4. Clear explanation of any uncertain or unsupported assumptions; no invented successful tests.
5. Optional zip of the unpacked extension directory for handoff.

## Acceptance criteria
- Start/Stop work and persist appropriately across popup closure; only the explicitly selected monitor tab is affected.
- Every attempted action produces an accurate success/failure status; verified Blockly changes do not alter program behavior or other students' code.
- Failure to access iframe or Blockly API is reported rather than hidden.
- No user data or credentials are transmitted or logged.
- Teacher can verify a second-device join after an idle period; extension UI does not misrepresent this manual validation as automatic proof.

## Suggested implementation order
1. Build popup + narrow permissions + tab selection + heartbeat/status logging.
2. Add robust detection for student page, iframe/editor, and disconnection screens.
3. Investigate Blockly runtime and implement safe reversible edit behind a user-visible toggle.
4. Test with an empty classroom, then background tab, then overnight.
5. Write the substitute fallback sheet.

**Important:** The provided HTML files are saved page snapshots, not a running browser session. Do not infer the micro:bit server's inactivity policy or assume synthetic Blockly changes keep sessions alive without controlled live verification.
