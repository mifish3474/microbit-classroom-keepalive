// Functions are serialized by chrome.scripting. Keep each self-contained.
export function studentProbe(command = "read", token = "") {
  const key = "__classroomGuardianTopV1";
  const visible = el => !!el && el.getClientRects().length > 0 &&
    getComputedStyle(el).visibility !== "hidden" && getComputedStyle(el).display !== "none";
  const isStudentURL = location.origin === "https://classroom.microbit.org" &&
    /^\/join\/?$/.test(location.pathname) && window === window.top;
  const leave = document.querySelector('[data-testid="student-leave"]');
  // Compare only the dedicated name slot; never return or store any name.
  const names = [...(leave?.closest("section")?.querySelectorAll("p") || [])].filter(p =>
    p.parentElement?.classList.contains("ov_hidden") &&
    p.parentElement.previousElementSibling?.tagName.toLowerCase() === "svg");
  const monitor = names.length === 1 && names[0].textContent.trim() === "Classroom Monitor";
  const frames = [...document.querySelectorAll('section[aria-label="Code editor"] iframe[title="MakeCode"]')];
  const frame = frames.length === 1 ? frames[0] : null;
  let editorFrame = false;
  try {
    const u = new URL(frame.src);
    editorFrame = u.origin === "https://makecode.microbit.org" && u.searchParams.get("controller") === "1";
  } catch { /* Missing/unsupported editor. */ }
  const eligible = isStudentURL && visible(leave) && monitor && editorFrame;
  if (command === "release") {
    const old = globalThis[key];
    if (old?.token === token) {
      old.observer.disconnect();
      window.removeEventListener("message", old.onMessage);
      window.removeEventListener("offline", old.onOffline);
      window.removeEventListener("online", old.onOnline);
      frame?.removeEventListener("load", old.onLoad);
      delete globalThis[key];
    }
    return {released: true};
  }
  if (command === "bind" && eligible && !globalThis[key]) {
    const state = {token, frame, invalidated: false, lastEditorSave: null};
    const invalidate = () => {
      if (state.invalidated) return;
      state.invalidated = true;
      chrome.runtime.sendMessage({type: "INVALIDATED", token}).catch(() => {});
    };
    state.onLoad = invalidate;
    state.onMessage = event => {
      // Observe ONLY envelope metadata. Never inspect, copy, or retain project payloads.
      if (event.source === frame.contentWindow && event.origin === "https://makecode.microbit.org" &&
          event.data?.type === "pxthost" && event.data.action === "workspacesave") {
        state.lastEditorSave = Date.now();
      }
    };
    state.onOffline = () => chrome.runtime.sendMessage({type: "OBSERVE", token}).catch(() => {});
    state.onOnline = state.onOffline;
    state.observer = new MutationObserver(() => {
      // Latch invalidation: even a brief switch to a different session needs a new Start.
      if (!frame.isConnected || !leave.isConnected || !names[0].isConnected ||
          names[0].textContent.trim() !== "Classroom Monitor" ||
          !/^\/join\/?$/.test(location.pathname)) invalidate();
    });
    state.observer.observe(document.documentElement, {subtree: true, childList: true, characterData: true});
    frame.addEventListener("load", state.onLoad);
    window.addEventListener("message", state.onMessage);
    window.addEventListener("offline", state.onOffline);
    window.addEventListener("online", state.onOnline);
    globalThis[key] = state;
  }
  const bound = globalThis[key];
  const warning = document.querySelector('[data-testid="connection-error-indicator"]');
  let connection = "ui-present";
  if (!navigator.onLine) connection = "offline";
  else if (visible(warning)) {
    const text = warning.textContent.toLowerCase();
    connection = /inactiv|expir/.test(text) ? "expired" : /ended|closed/.test(text) ? "ended" :
      /teacher.*offline|teacher.*disconnect/.test(text) ? "teacher-offline" : "connection-warning";
  } else if (!visible(leave)) connection = "not-joined";
  const locked = visible(document.querySelector('[data-testid="screen-locked"]'));
  return {eligible, bound: !!bound && bound.token === token && bound.frame === frame && !bound.invalidated,
    connection, locked, editorFrame, lastEditorSave: bound?.lastEditorSave || null};
}

export function transportProbe() {
  // Optional, read-only observation of a library exposed by the captured app.
  // A connected transport is NOT proof that the classroom can accept new joins.
  const allowed = ["initialized", "connecting", "connected", "unavailable", "failed", "disconnected"];
  try {
    const instances = window.Pusher?.instances;
    if (!Array.isArray(instances) || instances.length !== 1) return "unobserved";
    const state = instances[0]?.connection?.state;
    return allowed.includes(state) ? state : "unobserved";
  } catch { return "unobserved"; }
}

export function editorFrameProbe() {
  try {
    return {candidate: window !== window.top && window.parent === window.top &&
      location.origin === "https://makecode.microbit.org" &&
      new URL(location.href).searchParams.get("controller") === "1" &&
      location.ancestorOrigins[0] === "https://classroom.microbit.org"};
  } catch { return {candidate: false}; }
}
