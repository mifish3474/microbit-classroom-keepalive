const $ = id => document.getElementById(id);
let current;
let activeTab;
const when = t => t ? new Date(t).toLocaleString() : "Never";
const labels = {
  "ui-present": "Student UI appears connected (unverified)", "not-joined": "Student is not joined",
  "offline": "Browser reports offline", "teacher-offline": "Teacher appears offline",
  "connection-warning": "Classroom reports a connection problem", "expired": "Expiry/inactivity warning",
  "ended": "Classroom ended", "unknown": "Unknown", "unavailable": "Transport unavailable",
  "unobserved": "Not observable", "connected": "Transport connected (join unverified)"
};
async function request(type, args = {}) {
  const result = await chrome.runtime.sendMessage({type, ...args});
  if (!result?.ok) throw new Error(result?.error || "Extension worker unavailable.");
  return result.state;
}
function render(s) {
  current = s;
  const stale = s.running && s.lastObservation && Date.now() - s.lastObservation > 150000;
  const rows = {
    Monitoring: s.running ? (stale ? "Observation overdue" : "Running") : "Stopped",
    "Target tab": s.tabId ?? "None",
    "Page": s.page,
    "Student status": stale ? "Unknown — stale observation" : (labels[s.connection] || s.connection),
    "Transport": stale ? "Unknown — stale observation" : (labels[s.transport] || s.transport),
    "Editor": s.editor,
    "Activity": s.activityEnabled && s.running ? "Enabled" : "Off / paused",
    "Cycle": s.phase,
    "Last observation": when(s.lastObservation),
    "Last attempt": when(s.lastAttempt),
    "Editor-confirmed": when(s.lastActivity),
    "Activity count": s.activityCount,
    "Editor save observed": when(s.lastEditorSave),
    "Reachability": s.joinVerifiedAt ? `Teacher-reported join at ${when(s.joinVerifiedAt)}; current reachability unverified` : "Unverified",
  };
  $("status").replaceChildren();
  for (const [key, value] of Object.entries(rows)) {
    const dt = document.createElement("dt"), dd = document.createElement("dd");
    dt.textContent = key; dd.textContent = String(value); $("status").append(dt, dd);
  }
  $("notice").textContent = stale ? "Monitoring is overdue. Check Chrome, power, and the network." : s.warning.replaceAll("-", " ");
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
$("start").onclick = () => act("START", {tabId: activeTab?.id, confirm: $("confirm").checked,
  activity: $("activity").checked, interval: Number($("interval").value)});
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
    activityCount: current.activityCount, lastActivity: current.lastActivity,
    manualJoinVerifiedAt: current.joinVerifiedAt, logs: current.logs};
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type: "application/json"}));
  const a = document.createElement("a"); a.href = url; a.download = "classroom-guardian-diagnostics.json"; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};
try {
  [activeTab] = await chrome.tabs.query({active: true, currentWindow: true});
  const s = await request("STATUS");
  $("interval").value = s.interval; $("activity").checked = s.activityEnabled;
  render(s);
  // UI refresh only. Scheduling lives in chrome.alarms, not this timer.
  setInterval(() => act("STATUS"), 2000);
} catch { $("notice").textContent = "Cannot contact the extension worker. Reload the extension and reopen this popup."; }
