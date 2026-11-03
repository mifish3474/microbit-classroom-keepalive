// Shared, fixed-text validation. Invalid settings must never mutate a running session.
export function startSettingsError(msg) {
  const mode = msg?.mode ?? "layout";
  if (!["layout", "marker"].includes(mode)) return "Choose an available activity type.";
  if (mode === "marker" && (!Number.isInteger(msg?.interval) || msg.interval < 1 || msg.interval > 60)) {
    return "Add/delete interval must be a whole number from 1 to 60 minutes. Each block-present and block-absent period lasts at least this long.";
  }
  if (mode === "layout" && (!Number.isInteger(msg?.interval) || msg.interval < 3 || msg.interval > 60)) {
    return "Activity interval must be a whole number from 3 to 60 minutes. The current prototype needs separate move, restore, and verification checks.";
  }
  if (msg.confirm !== true) return "Confirm that this is your dedicated Classroom Monitor student tab.";
  if (!Number.isInteger(msg.tabId)) return "Open the Classroom Monitor student tab before clicking Start.";
  if (typeof msg.activity !== "boolean") return "Choose whether to enable experimental editor activity, then try Start again.";
  return "";
}
