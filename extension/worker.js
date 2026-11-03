import {studentProbe, editorFrameProbe, transportProbe} from "./probes.js";
import {editorOperation} from "./editor.js";
import {markerOperation} from "./marker.js";
import {startSettingsError} from "./settings.js";

class InputError extends Error {}

const ALARM = "guardian-observe";
const TRANSITION = "guardian-transition";
const DELETE_EVENT_GRACE_MS = 120000;
const empty = () => ({running: false, tabId: null, interval: 1, activityMode: "marker", activityEnabled: false,
  nextTransitionAt: null,
  connection: "unknown", transport: "unobserved", editor: "unknown", page: "unknown",
  lastObservation: null, lastAttempt: null, lastActivity: null, activityCount: 0,
  workspaceOnlyCount: 0, verificationNote: "", editorVisible: null, deleteVerificationResume: false,
  lastEditorSave: null, joinVerifiedAt: null, warning: "", phase: "idle", logs: []});
let state;
let queue = Promise.resolve();
const ready = (async () => {
  await chrome.storage.local.setAccessLevel({accessLevel: "TRUSTED_CONTEXTS"});
  const [{guardian}, {settings}] = await Promise.all([
    chrome.storage.session.get("guardian"), chrome.storage.local.get("settings")]);
  state = guardian ? {...guardian, activityMode: guardian.activityMode || "layout"} : {...empty(), ...settings};
  if (state.running) { await ensureAlarm(); await scheduleTransition(); }
  else { await chrome.alarms.clear(ALARM); await chrome.alarms.clear(TRANSITION); }
})();
function serialized(task) {
  const next = queue.then(() => ready).then(task);
  queue = next.catch(() => {});
  return next;
}
function log(code) {
  state.logs.push({at: Date.now(), code});
  state.logs = state.logs.slice(-120);
}
async function save() {
  await chrome.storage.session.set({guardian: state});
  // A recorded manual join dismisses the reminder for this run, not future warnings.
  await chrome.action.setBadgeText({text: state.warning ? "!" : state.running && !state.joinVerifiedAt ? "?" : ""});
  await chrome.action.setBadgeBackgroundColor({color: state.warning ? "#b42318" : "#996300"});
  await chrome.action.setTitle({title: state.warning ? "Classroom Keep-Alive — warning; open popup for details" :
    !state.running ? "Classroom Keep-Alive — stopped" :
    state.joinVerifiedAt ? "Classroom Keep-Alive — monitoring; manual join check recorded, see popup for time" :
    "Classroom Keep-Alive — monitoring; a manual join check is needed"});
}
async function ensureAlarm() {
  if (!await chrome.alarms.get(ALARM)) await chrome.alarms.create(ALARM, {periodInMinutes: 1});
}
async function scheduleTransition() {
  if (!state.running || state.activityMode !== "marker" || !state.nextTransitionAt) {
    await chrome.alarms.clear(TRANSITION); return;
  }
  const when = Math.max(Date.now() + 1000, state.nextTransitionAt);
  const existing = await chrome.alarms.get(TRANSITION);
  if (!existing || Math.abs(existing.scheduledTime - when) > 1000) await chrome.alarms.create(TRANSITION, {when});
}
function studentURL(raw) {
  try { const u = new URL(raw); return u.origin === "https://classroom.microbit.org" && /^\/join\/?$/.test(u.pathname); }
  catch { return false; }
}
async function inject(options) {
  // Watchdog only; alarms remain the scheduler. MAIN mutations also expire in-page.
  let timeout;
  try {
    return await Promise.race([chrome.scripting.executeScript(options), new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error("probe-timeout")), 8000);
    })]);
  } finally { clearTimeout(timeout); }
}
async function top(command = "read") {
  const target = state.topDocument ? {tabId: state.tabId, documentIds: [state.topDocument]} :
    {tabId: state.tabId, frameIds: [0]};
  const [r] = await inject({target, world: "ISOLATED", func: studentProbe, args: [command, state.token]});
  if (!r || r.frameId !== 0 || !r.documentId) throw new Error("top-unavailable");
  return r;
}
async function editor(command) {
  if (!state.editorDocument) return {status: "api-unavailable"};
  const [r] = await inject({target: {tabId: state.tabId, documentIds: [state.editorDocument]},
    world: "MAIN", func: state.activityMode === "marker" ? markerOperation : editorOperation,
    args: [command, state.token, Date.now() + 5000, state.interval * 60000]});
  if (!r || r.documentId !== state.editorDocument) throw new Error("editor-unavailable");
  // Fixed vocabulary only: MAIN-world results are untrusted and never logged verbatim.
  const allowed = ["ready", "shifted", "restored", "cycle-confirmed", "restored-confirmed", "restored-unconfirmed",
    "idle", "wrong-frame", "previous-edit-pending", "restore-unavailable", "api-unavailable", "workspace-changed",
    "event-unconfirmed", "restore-failed", "busy", "editor-busy", "no-movable-block", "unsafe-position",
    "move-failed", "editor-error", "expired-command", "marker-present", "marker-absent", "marker-changed",
    "marker-removed-unconfirmed", "marker-create-failed", "marker-delete-failed", "editor-not-visible", "workspace-confirmed"];
  return {status: allowed.includes(r.result?.status) ? r.result.status : "editor-error", eventSeen: r.result?.eventSeen === true,
    createEventSeen: r.result?.createEventSeen === true, removalVerified: r.result?.removalVerified === true,
    pageVisible: r.result?.pageVisible === true,
    nextActionAt: Number.isFinite(r.result?.nextActionAt) && r.result.nextActionAt > 0 &&
      r.result.nextActionAt < Date.now() + 3605000 ? r.result.nextActionAt : null};
}
async function stop(reason = "stopped", restore = true) {
  let recovery = "";
  if (state.running && restore && state.editorDocument) {
    try {
      const observation = (await top()).result;
      if (observation.eligible && observation.bound) {
        const r = await editor("stop");
        if (["idle", "restored-confirmed", "restored-unconfirmed", "marker-removed-unconfirmed", "cycle-confirmed"].includes(r.status)) state.phase = "idle";
        if (r.status === "restored-unconfirmed") recovery = "layout-restored-event-unconfirmed";
        else if (r.status === "marker-removed-unconfirmed") recovery = "marker-removed-event-unconfirmed";
        else if (!["idle", "restored-confirmed", "api-unavailable", "cycle-confirmed"].includes(r.status)) recovery = "check-monitor-layout";
      } else if (state.phase !== "idle") recovery = "check-monitor-layout";
    } catch { if (state.phase !== "idle") recovery = "check-monitor-layout"; }
  } else if (state.phase !== "idle") recovery = "check-monitor-layout";
  try { if (state.topDocument) await top("release"); } catch { /* Old document may be gone. */ }
  state.running = false;
  state.nextTransitionAt = null;
  state.warning = recovery || (reason === "stopped" ? "" : reason);
  state.page = reason === "navigation-stopped" ? "changed" : state.page;
  log(reason);
  if (recovery) log(recovery);
  await chrome.alarms.clear(ALARM);
  await chrome.alarms.clear(TRANSITION);
  await save();
}
async function observeMarker(e, unhealthy, locked) {
  const now = Date.now();
  const pause = code => {
    if (code !== "delete-not-confirmed-check-monitor") state.deleteVerificationResume = false;
    state.activityEnabled = false;
    state.warning = code;
    state.nextTransitionAt = null;
    log(code);
  };
  if (locked) {
    // Honor teacher screen locks; do not repeatedly schedule an already overdue change.
    state.nextTransitionAt = null;
    return;
  }
  if (!e.pageVisible) {
    if (state.verificationNote !== "editor-hidden") log("editor-hidden-waiting-for-visibility");
    state.verificationNote = "editor-hidden";
    state.nextTransitionAt = null;
    return; // The periodic monitoring alarm keeps checking; never focus the user's tab.
  }
  if (state.verificationNote === "editor-hidden") {
    state.verificationNote = "";
    log("editor-visible-verification-resumed");
  }
  if (["marker-present", "marker-absent"].includes(e.status)) {
    state.phase = e.status;
    state.nextTransitionAt = e.nextActionAt;
    if (!e.nextActionAt) { pause("visible-block-timing-unavailable"); return; }
    if (now < e.nextActionAt) return;
    if (e.status === "marker-present") {
      if (!e.eventSeen) {
        if (state.verificationNote !== "waiting-for-create-event") log("create-event-delayed-retrying");
        state.verificationNote = "waiting-for-create-event";
        state.nextTransitionAt = now + 60000;
        return; // Do not delete before MakeCode has observed creation.
      }
      if (state.verificationNote === "waiting-for-create-event") state.verificationNote = "";
      state.lastAttempt = now;
      log("marker-delete-attempted");
      await save();
      e = await editor("remove");
      state.editor = e.status;
      state.phase = e.status;
      state.nextTransitionAt = e.nextActionAt;
      if (!["marker-absent", "marker-present"].includes(e.status)) pause("marker-delete-refused-check-monitor");
      return;
    }
    let finishCommand = "finish";
    if (!e.eventSeen) {
      if (now < e.nextActionAt + DELETE_EVENT_GRACE_MS) {
        if (state.verificationNote !== "waiting-for-delete-event") log("delete-event-delayed-retrying");
        state.verificationNote = "waiting-for-delete-event";
        state.nextTransitionAt = Math.min(now + 30000, e.nextActionAt + DELETE_EVENT_GRACE_MS);
        return; // Preserve the user's activity setting; an event may still arrive.
      }
      if (!e.createEventSeen || !e.removalVerified || state.cycleFailed) {
        state.verificationNote = "";
        if (state.warning !== "delete-not-confirmed-check-monitor") {
          if (!e.createEventSeen) log("delete-proof-missing-creation-event");
          if (!e.removalVerified) log("delete-proof-removal-unverified");
          if (state.cycleFailed) log("delete-proof-earlier-cycle-failure");
        }
        // Only this narrow wait may recover automatically when late proof arrives.
        if (state.activityEnabled && !unhealthy && !state.cycleFailed) state.deleteVerificationResume = true;
        pause("delete-not-confirmed-check-monitor"); return;
      }
      finishCommand = "finish-unconfirmed";
    }
    const done = await editor(finishCommand);
    if (!done.pageVisible) {
      state.editorVisible = false;
      state.verificationNote = "editor-hidden";
      state.nextTransitionAt = null;
      return;
    }
    if (!["cycle-confirmed", "workspace-confirmed"].includes(done.status)) { pause("visible-block-verification-failed"); return; }
    if (state.deleteVerificationResume && state.warning === "delete-not-confirmed-check-monitor" && !unhealthy && !state.cycleFailed) {
      state.activityEnabled = true;
      state.warning = "";
      log("late-delete-verified-activity-resumed");
    }
    state.deleteVerificationResume = false;
    if (done.status === "workspace-confirmed") {
      state.workspaceOnlyCount = (state.workspaceOnlyCount || 0) + 1;
      state.verificationNote = "delete-confirmed-in-workspace-event-missing";
      log("marker-cycle-workspace-only");
    } else if (!state.cycleFailed) {
      state.activityCount++;
      state.lastActivity = now;
      state.verificationNote = "";
      log("marker-cycle-editor-confirmed");
    }
    state.phase = "idle";
    state.editor = "ready";
    state.nextTransitionAt = null;
    e = {status: "ready"};
  }
  if (e.status !== "ready") {
    const reasons = {
      "previous-edit-pending": "previous-monitor-run-needs-cleanup",
      "api-unavailable": "blocks-api-unavailable-show-blocks-editor",
      "workspace-changed": "monitor-workspace-changed-check-editor",
      "marker-changed": "monitor-icon-changed-check-editor",
      "editor-not-visible": "widen-or-show-blocks-editor",
      "editor-error": "monitor-editor-api-error",
      "expired-command": "monitor-editor-command-delayed"
    };
    pause(reasons[e.status] || "visible-block-adapter-unavailable");
    return;
  }
  if (state.phase !== "idle") { pause("activity-state-lost-edits-paused"); return; }
  if (!state.activityEnabled || unhealthy) return;
  state.lastAttempt = now;
  state.phase = "uncertain";
  state.cycleFailed = false;
  log("marker-add-attempted");
  await save();
  e = await editor("add");
  state.editor = e.status;
  state.nextTransitionAt = e.nextActionAt;
  if (!e.pageVisible && e.status === "ready") {
    state.phase = "idle";
    state.editorVisible = false;
    state.verificationNote = "editor-hidden";
    return;
  }
  if (e.status === "marker-present") state.phase = e.status;
  else pause(e.status === "editor-not-visible" ? "widen-or-show-blocks-editor" : "marker-add-refused-check-monitor");
}
function recordObservation() {
  const summary = `${state.connection}/${state.transport}/${state.editor}/${state.warning}`;
  if (summary !== state.lastSummary) { log(`observation:${summary}`); state.lastSummary = summary; }
}
async function observe(forceActivity = false) {
  if (!state.running) return;
  const now = Date.now();
  if (state.lastObservation && now - state.lastObservation > 150000) {
    state.deleteVerificationResume = false;
    state.activityEnabled = false;
    state.warning = "observation-gap-edits-paused";
    log("observation-gap");
  }
  const tab = await chrome.tabs.get(state.tabId);
  if (!studentURL(tab.url) || tab.discarded) return stop(tab.discarded ? "tab-discarded" : "navigation-stopped", false);
  const outer = (await top()).result;
  if (!outer?.eligible || !outer.bound) return stop("identity-or-frame-changed", false);
  state.page = "present";
  state.connection = outer.connection;
  state.lastObservation = now;
  state.lastEditorSave = Number.isFinite(outer.lastEditorSave) ? outer.lastEditorSave : null;
  const [tr] = await inject({target: {tabId: state.tabId, documentIds: [state.topDocument]},
    world: "MAIN", func: transportProbe});
  const transportStates = ["initialized", "connecting", "connected", "unavailable", "failed", "disconnected", "unobserved"];
  state.transport = transportStates.includes(tr?.result) ? tr.result : "unobserved";
  const unhealthy = outer.connection !== "ui-present" || outer.locked || ["connecting", "unavailable", "failed", "disconnected", "initialized"].includes(state.transport);
  if (unhealthy) {
    state.deleteVerificationResume = false;
    state.activityEnabled = false;
    state.warning = outer.locked ? "screen-locked-edits-paused" : "connection-warning-edits-paused";
  }
  // Discover new frames only at Start. A changed frame requires teacher re-approval.
  let e = await editor("probe");
  state.editor = e.status;
  state.editorVisible = state.activityMode === "marker" ? e.pageVisible : null;
  if (state.activityMode === "marker") {
    await observeMarker(e, unhealthy, outer.locked);
    recordObservation();
    await save();
    await scheduleTransition();
    return;
  }
  if (e.status === "shifted") {
    state.phase = "shifted";
    if (!e.eventSeen) {
      state.activityEnabled = false;
      state.warning = "move-event-unconfirmed-edits-paused";
      state.cycleFailed = true;
    }
    // Restore only our own pinned block; never retry a new shift after an uncertain result.
    e = await editor("restore");
    state.editor = e.status;
    state.phase = e.status === "restored" ? "restored" : "uncertain";
    if (e.status !== "restored") {
      state.activityEnabled = false;
      state.warning = "restore-failed-check-monitor-layout";
    }
    log(e.status === "restored" ? "restore-attempted" : "restore-failed");
  } else if (e.status === "restored") {
    state.phase = "restored";
    if (e.eventSeen) {
      const done = await editor("finish");
      if (done.status === "cycle-confirmed") {
        if (!state.cycleFailed) {
          state.activityCount++;
          state.lastActivity = now;
          log("editor-confirmed");
        }
        state.phase = "idle";
        state.editor = "ready";
      }
    } else {
      state.activityEnabled = false;
      state.warning = "restore-event-unconfirmed-edits-paused";
    }
  } else if (e.status !== "ready") {
    state.activityEnabled = false;
    state.warning = "editor-unavailable-edits-paused";
  } else if (state.phase !== "idle") {
    state.activityEnabled = false;
    state.warning = "activity-state-lost-edits-paused";
  } else if (state.activityEnabled && !unhealthy &&
      (forceActivity || !state.lastAttempt || now - state.lastAttempt >= state.interval * 60000)) {
    state.lastAttempt = now;
    state.phase = "uncertain";
    state.cycleFailed = false;
    log("activity-attempted");
    await save(); // Persist intent before invoking any mutation.
    e = await editor("shift");
    state.editor = e.status;
    if (e.status === "shifted") state.phase = "shifted";
    else {
      if (!["move-failed", "editor-error"].includes(e.status)) state.phase = "idle";
      state.activityEnabled = false;
      state.warning = "activity-refused-edits-paused";
      log("activity-refused");
    }
  }
  recordObservation();
  await save();
}
async function start(msg) {
  const inputError = startSettingsError(msg);
  if (inputError) throw new InputError(inputError);
  const tab = await chrome.tabs.get(msg.tabId);
  if (!studentURL(tab.url) || !tab.active || tab.discarded) {
    throw new InputError("Open the joined Classroom Monitor student tab and keep it active before clicking Start.");
  }
  if (state.running) await stop();
  const oldLogs = state.logs;
  state = {...empty(), logs: oldLogs, tabId: msg.tabId, token: crypto.randomUUID(),
    interval: msg.interval, activityMode: msg.mode || "layout", activityEnabled: msg.activity};
  const r = await top("bind");
  state.topDocument = r.documentId;
  if (!r.result?.eligible || !r.result.bound) {
    state.warning = "start-refused-check-monitor-name-and-student-page";
    await save();
    return;
  }
  state.running = true;
  await save();
  await ensureAlarm();
  const frames = await inject({target: {tabId: state.tabId, allFrames: true},
    world: "ISOLATED", func: editorFrameProbe});
  const candidates = frames.filter(f => f.frameId !== 0 && f.result?.candidate === true);
  if (candidates.length === 1) state.editorDocument = candidates[0].documentId;
  else { state.activityEnabled = false; state.warning = "editor-frame-unavailable"; }
  if (state.editorDocument && state.activityMode === "marker" && state.activityEnabled) {
    // Fresh explicit authorization only, never from a timer or a passive monitoring Start.
    const guard = (await top()).result;
    if (!guard?.eligible || !guard.bound) return stop("identity-or-frame-changed", false);
    if (guard.connection === "ui-present" && !guard.locked) {
      const prepared = await editor("prepare");
      log(`start-editor-preparation:${prepared.status}`);
    }
  }
  await chrome.storage.local.set({settings: {interval: state.interval, activityMode: state.activityMode, activityEnabled: msg.activity}});
  log("started");
  await save();
  await ensureAlarm();
  await observe();
}
async function failure() {
  // Error messages from Chrome/pages can include URLs. Use only a fixed diagnostic.
  state.activityEnabled = false;
  state.deleteVerificationResume = false;
  state.connection = "unknown";
  state.transport = "unobserved";
  state.editor = "unknown";
  state.warning = "probe-failed-edits-paused";
  log("probe-failed");
  await save();
}

chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  const popup = sender.id === chrome.runtime.id && sender.url === chrome.runtime.getURL("popup.html");
  const boundPage = !popup && sender.id === chrome.runtime.id && sender.tab && sender.frameId === 0;
  if (!popup && !boundPage) return false;
  serialized(async () => {
    if (boundPage) {
      if (!state.running || sender.tab.id !== state.tabId || sender.documentId !== state.topDocument || msg?.token !== state.token) return;
      if (msg.type === "INVALIDATED") await stop("identity-or-frame-changed", false);
      if (msg.type === "OBSERVE") await observe();
      return;
    }
    switch (msg?.type) {
      case "START": await start(msg); break;
      case "STOP": await stop(); break;
      case "CHECK": await observe(); break;
      case "ACTIVITY": await observe(true); break;
      case "JOIN_VERIFIED":
        if (state.running) { state.joinVerifiedAt = Date.now(); log("manual-join-verified"); await save(); }
        break;
      case "CLEAR_LOG": state.logs = []; await save(); break;
      case "STATUS": break;
      default: throw new Error("invalid-command");
    }
    // Never expose tokens, document identifiers, or raw tab URLs in popup/log exports.
    const {token, topDocument, editorDocument, lastSummary, ...publicState} = state;
    return publicState;
  }).then(value => respond({ok: true, state: value})).catch(async error => {
    if (error instanceof InputError) {
      // Our own fixed messages only. No raw Chrome/page errors or state changes.
      respond({ok: false, kind: "input", error: error.message});
      return;
    }
    await failure();
    respond({ok: false, error: "Action failed. Check the selected student tab and extension status."});
  });
  return true;
});
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === ALARM || alarm.name === TRANSITION) serialized(() => observe()).catch(() => serialized(failure));
});
chrome.tabs.onUpdated.addListener((id, change) => {
  if (change.status === "loading" || change.url || change.discarded) serialized(async () => {
    if (state.running && id === state.tabId) await stop("navigation-stopped", false);
  }).catch(() => serialized(failure));
});
chrome.tabs.onRemoved.addListener(id => serialized(async () => {
  if (state.running && id === state.tabId) await stop("target-tab-closed", false);
}).catch(() => serialized(failure)));
chrome.tabs.onReplaced.addListener((_added, removed) => serialized(async () => {
  if (state.running && removed === state.tabId) await stop("target-tab-replaced", false);
}).catch(() => serialized(failure)));
