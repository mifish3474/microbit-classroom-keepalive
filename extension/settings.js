// Shared, fixed-text validation. Invalid settings must never mutate a running session.
export function startSettingsError(msg) {
  if (!Number.isInteger(msg?.interval) || msg.interval < 3 || msg.interval > 60) {
    return "Activity interval must be a whole number from 3 to 60 minutes. The current prototype needs separate move, restore, and verification checks.";
  }
  if (msg.confirm !== true) return "Confirm that this is your dedicated Classroom Monitor student tab.";
  if (!Number.isInteger(msg.tabId)) return "Open the Classroom Monitor student tab before clicking Start.";
  if (typeof msg.activity !== "boolean") return "Choose whether to enable experimental block movement, then try Start again.";
  return "";
}
