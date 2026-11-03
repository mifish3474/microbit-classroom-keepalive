import {startSettingsError} from "./settings.js";

const $ = id => document.getElementById(id);
let current;
let activeTab;
let inputError = "";
const when = t => t ? new Date(t).toLocaleString() : "Never";
const labels = {
  "ui-present": "Student UI appears connected (unverified)", "not-joined": "Student is not joined",
  "offline": "Browser reports offline", "teacher-offline": "Teacher appears offline",
  "connection-warning": "Classroom reports a connection problem", "expired": "Expiry/inactivity warning",
  "ended": "Classroom ended", "unknown": "Unknown", "unavailable": "Transport unavailable",
  "unobserved": "Not observable", "connected": "Transport connected (join unverified)"
};
const warnings = {
  "previous-monitor-run-needs-cleanup": "An earlier run remains and safe cleanup could not be verified. Stop and inspect Classroom Monitor. Export diagnostics if it persists.",
  "blocks-api-unavailable-show-blocks-editor": "MakeCode's Blocks API is unavailable. Open Blocks mode, allow it to finish loading, then Stop and Start.",
  "monitor-workspace-changed-check-editor": "The monitor workspace changed. Inspect Classroom Monitor before restarting.",
  "monitor-icon-changed-check-editor": "The temporary icon changed or became connected. Inspect Classroom Monitor; automatic edits are paused.",
  "monitor-editor-api-error": "The editor API operation failed. Export extension diagnostics for investigation.",
  "monitor-editor-command-delayed": "The editor did not respond in time. Check that its window is responsive before restarting."
};
async function request(type, args = {}) {
  const result = await chrome.runtime.sendMessage({type, ...args});
  if (!result?.ok) {
    if (result?.kind === "input") inputError = result.error;
    throw new Error(result?.error || "Extension worker unavailable.");
  }
  return result.state;
}
function render(s) {
  current = s;
  const stale = s.running && s.lastObservation && Date.now() - s.lastObservation > 150000;
  const rows = {
    "Extension version": chrome.runtime.getManifest().version,
    Monitoring: s.running ? (stale ? "Observation overdue" : "Running") : "Stopped",
    "Target tab": s.tabId ?? "None",
    "Page": s.page,
    "Student status": stale ? "Unknown — stale observation" : (labels[s.connection] || s.connection),
    "Transport": stale ? "Unknown — stale observation" : (labels[s.transport] || s.transport),
    "Editor": s.editor,
    "Activity": s.activityEnabled && s.running ? (s.editorVisible === false ? "Waiting for visible editor" :
      ["waiting-for-create-event", "waiting-for-delete-event"].includes(s.verificationNote) ? "Waiting for editor confirmation" : "Enabled") : "Off / paused",
    "Editor visibility": s.editorVisible === null || s.editorVisible === undefined ? "Not observed" : s.editorVisible ? "Visible" : "Hidden; keep monitor in a visible window",
    "Activity type": s.activityMode === "marker" ? "Add/delete show icon block" : "Move/restore existing block",
    "Cycle": s.phase,
    "Next editor change": s.running && s.nextTransitionAt ? when(s.nextTransitionAt) : "Not scheduled",
    "Last observation": when(s.lastObservation),
    "Last attempt": when(s.lastAttempt),
    "Editor-confirmed": when(s.lastActivity),
    "Activity count": s.activityCount,
    "Cycles without delete event": s.workspaceOnlyCount || 0,
    "Verification": s.verificationNote === "editor-hidden" ? "Monitoring continues. Edits wait for a visible editor, then resume automatically unless another warning has paused them." :
      s.verificationNote === "waiting-for-create-event" ? "Waiting for creation event; keeping the icon until MakeCode confirms it. Automatic retry." :
      s.verificationNote === "waiting-for-delete-event" ? "Waiting for delayed delete event; automatic retry" :
      s.verificationNote === "delete-confirmed-in-workspace-event-missing" ? "Block removal verified in workspace; event missing. Server receipt unverified; see Activity for current state." : "No pending verification notice",
    "Editor save observed": when(s.lastEditorSave),
    "Reachability": s.joinVerifiedAt ? `Teacher-reported join at ${when(s.joinVerifiedAt)}; current reachability unverified` : "Unverified",
  };
  $("status").replaceChildren();
  for (const [key, value] of Object.entries(rows)) {
    const dt = document.createElement("dt"), dd = document.createElement("dd");
    dt.textContent = key; dd.textContent = String(value); $("status").append(dt, dd);
  }
  $("notice").textContent = inputError || (stale ? "Monitoring is overdue. Check Chrome, power, and the network." : warnings[s.warning] || s.warning.replaceAll("-", " "));
  $("stop").disabled = !s.running;
  $("check").disabled = !s.running;
  $("test").disabled = !s.running || !s.activityEnabled || s.phase !== "idle";
  $("verify").disabled = !s.running || !$("joined").checked;
  $("start").disabled = s.running || !$("confirm").checked;
  $("logs").textContent = s.logs.map(x => `${when(x.at)}  ${x.code}`).join("\n");
}
async function act(type, args) {
  try { render(await request(type, args)); }
  catch (error) { $("notice").textContent = error.message; }
}
$("start").onclick = () => {
  const settings = {tabId: activeTab?.id, confirm: $("confirm").checked,
    activity: $("activity").checked, mode: $("mode").value, interval: Number($("interval").value)};
  inputError = startSettingsError(settings);
  if (inputError) {
    if (current) render(current);
    $("interval").reportValidity();
    return;
  }
  return act("START", settings);
};
$("interval").oninput = () => { inputError = ""; if (current) render(current); };
function modeHelp() {
  const marker = $("mode").value === "marker";
  $("interval").min = marker ? "1" : "3";
  $("interval-help").textContent = marker ?
    "Each interval alternates between a disabled show icon block being present and absent. Minimum 1 minute; Check now cannot shorten it." :
    "Minimum 3 minutes for separate move, restore, and verification checks.";
}
$("mode").onchange = () => {
  $("interval").value = $("mode").value === "marker" ? "1" : "3";
  inputError = ""; modeHelp(); if (current) render(current);
};
$("stop").onclick = () => act("STOP");
$("check").onclick = () => act("CHECK");
$("test").onclick = () => act("ACTIVITY");
$("verify").onclick = async () => { await act("JOIN_VERIFIED"); $("joined").checked = false; render(current); };
$("clear").onclick = () => act("CLEAR_LOG");
$("confirm").onchange = $("joined").onchange = () => current && render(current);
$("export").onclick = () => {
  if (!current) return;
  // Explicit allowlist: no tab identity, page text, URLs, or raw errors in export.
  const data = {version: 1, exportedAt: Date.now(), intervalMinutes: current.interval,
    extensionVersion: chrome.runtime.getManifest().version,
    activityType: current.activityMode || "layout",
    activityCount: current.activityCount, lastActivity: current.lastActivity,
    workspaceOnlyCount: current.workspaceOnlyCount || 0,
    manualJoinVerifiedAt: current.joinVerifiedAt, logs: current.logs};
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type: "application/json"}));
  const a = document.createElement("a"); a.href = url; a.download = "classroom-guardian-diagnostics.json"; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};
try {
  [activeTab] = await chrome.tabs.query({active: true, currentWindow: true});
  const s = await request("STATUS");
  $("interval").value = s.interval; $("activity").checked = s.activityEnabled;
  $("mode").value = s.activityMode || "layout"; modeHelp();
  render(s);
  // UI refresh only. Scheduling lives in chrome.alarms, not this timer.
  setInterval(() => act("STATUS"), 2000);
} catch { $("notice").textContent = "Cannot contact the extension worker. Reload the extension and reopen this popup."; }
