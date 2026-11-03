// MAIN-world operation on the pinned virtual-student editor only.
export function markerOperation(command, token, deadline, holdMs = 60000) {
  const key = "__classroomGuardianMarkerV1";
  const label = "Classroom Monitor: temporary keep-alive block";
  const blockType = "basic_show_icon";
  const reason = "CLASSROOM_GUARDIAN_MARKER";
  const result = (status, extra = {}) => ({status, pageVisible: document.visibilityState === "visible", ...extra});
  try {
    if (!Number.isFinite(deadline) || Date.now() > deadline) return result("expired-command");
    if (!Number.isInteger(holdMs) || holdMs < 60000 || holdMs > 3600000) return result("invalid-command");
    if (location.origin !== "https://makecode.microbit.org" || window === window.top ||
        window.parent !== window.top || location.ancestorOrigins[0] !== "https://classroom.microbit.org" ||
        new URL(location.href).searchParams.get("controller") !== "1") return result("wrong-frame");
    const prior = globalThis[key];
    // Only explicit Start preparation may recover a prior run on the newly authorized tab.
    if ((prior && prior.token !== token && command !== "prepare") || globalThis.__classroomGuardianEditorV1) return result("previous-edit-pending");
    const B = window.pxt?.blocks?.requireBlockly?.() || window.Blockly;
    const ws = B?.getMainWorkspace?.() || B?.common?.getMainWorkspace?.();
    const svg = ws?.getParentSvg?.();
    if (!ws || ws.isFlyout || ws.isMutator || ws.options?.readOnly || !svg?.isConnected ||
        !svg.getBoundingClientRect().width || !svg.getBoundingClientRect().height || !B?.Events?.isEnabled?.() ||
        !B.Blocks?.[blockType] || typeof ws.newBlock !== "function" || typeof ws.getBlockById !== "function" ||
        typeof ws.addChangeListener !== "function" || typeof ws.removeChangeListener !== "function") return result("api-unavailable");
    const removalVerified = () => !!prior && prior.phase === "marker-absent" && prior.deleteReturned === true &&
      prior.workspace === ws && !ws.getBlockById(prior.id) && prior.block?.isDisposed?.() === true &&
      prior.svgRoot?.isConnected === false;
    const snapshot = () => prior ? result(prior.phase, {
      eventSeen: prior.phase === "marker-present" ? prior.createEventSeen === true : prior.deleteEventSeen === true,
      createEventSeen: prior.createEventSeen === true, removalVerified: removalVerified(),
      nextActionAt: prior.changedAt + holdMs}) : result("ready");
    if (prior?.workspace && prior.workspace !== ws) return result("workspace-changed");
    const cleanup = () => { ws.removeChangeListener(prior.listener); delete globalThis[key]; };
    // Only inspect our own generated block, never another program's fields or code.
    const owns = () => prior?.block && ws.getBlockById(prior.id) === prior.block &&
      prior.block.workspace === ws && prior.block.type === blockType && !prior.block.getParent() &&
      prior.block.getChildren(false).length === 0 && prior.block.data === reason &&
      prior.block.hasDisabledReason(reason) && !prior.block.isEnabled();
    if (prior?.phase === "marker-present" && !owns()) return result("marker-changed");
    if (prior?.phase === "marker-absent" && ws.getBlockById(prior.id)) return result("marker-changed");
    if (command === "prepare") {
      if (!prior) return result("ready");
      if (prior.phase === "marker-absent") {
        if (!removalVerified()) return result("previous-edit-pending");
        cleanup(); // Completed owned deletion: discard only the obsolete listener/record.
        return result("ready", {recovered: true});
      }
      if (prior.phase !== "marker-present" || !owns()) return result("previous-edit-pending");
      // Explicit Start has rechecked identity and pinned this exact editor document.
      // Transfer only the known owned leaf so the ordinary guarded Stop can clean it up.
      prior.token = token;
      command = "stop";
    }
    if (command === "probe") return snapshot();
    // Blockly queues change events through animation frames, suspended in hidden pages.
    // Keep the owned block and listener intact until visible; explicit Stop still cleans up.
    if (document.visibilityState !== "visible" && command !== "stop") return snapshot();
    if (command === "finish" || command === "finish-unconfirmed" || (command === "stop" && prior?.phase === "marker-absent")) {
      if (prior?.phase !== "marker-absent") return result("busy");
      if (command === "finish" && !prior.deleteEventSeen) return result("event-unconfirmed");
      if (command === "finish-unconfirmed" && (!prior.createEventSeen || !removalVerified())) return result("event-unconfirmed");
      const seen = prior.deleteEventSeen;
      cleanup();
      return result(seen ? "cycle-confirmed" : command === "finish-unconfirmed" ? "workspace-confirmed" : "marker-removed-unconfirmed");
    }
    if (command === "stop" && !prior) return result("idle");
    if ((command === "remove" || command === "stop") && prior?.phase === "marker-present") {
      if (command !== "stop" && Date.now() < prior.changedAt + holdMs) return snapshot();
      if (ws.isDragging?.() || B.Events.getGroup?.()) return result("editor-busy");
      prior.deleteEventSeen = false;
      prior.phase = "marker-absent";
      prior.changedAt = Date.now();
      prior.svgRoot = prior.block.getSvgRoot();
      prior.deleteReturned = false;
      prior.block.dispose(false); // owns() already ruled out any connected children/parent.
      if (ws.getBlockById(prior.id)) return result("marker-delete-failed");
      prior.deleteReturned = true;
      if (command === "stop") { cleanup(); return result("marker-removed-unconfirmed"); }
      return snapshot();
    }
    if (command !== "add" || prior) return result("busy");
    if (ws.isDragging?.() || B.Events.getGroup?.()) return result("editor-busy");
    const prototype = B.BlockSvg?.prototype;
    const required = ["setDisabledReason", "hasDisabledReason", "isEnabled", "getChildren", "getParent",
      "getHeightWidth", "getSvgRoot", "setTooltip", "initSvg", "render", "moveBy", "dispose", "setMovable", "setEditable"];
    if (!prototype || required.some(name => typeof prototype[name] !== "function")) return result("api-unavailable");
    const view = ws.getMetricsManager?.().getViewMetrics?.(true);
    if (!view || ![view.left, view.top, view.width, view.height].every(Number.isFinite) ||
        view.width < 100 || view.height < 80) return result("editor-not-visible");
    const state = {token, workspace: ws, phase: "marker-present", changedAt: Date.now(),
      createEventSeen: false, deleteEventSeen: false};
    state.listener = event => {
      // Deliberately ignore event XML/JSON; only match the owned identity and type.
      if (event.workspaceId !== ws.id || event.blockId !== state.id) return;
      if (event.ids !== undefined && (!Array.isArray(event.ids) || !event.ids.includes(state.id))) return;
      // Keep each observation independently: background delivery can cross phase boundaries.
      if (event.type === (B.Events.BLOCK_CREATE || "create")) state.createEventSeen = true;
      if (event.type === (B.Events.BLOCK_DELETE || "delete")) state.deleteEventSeen = true;
    };
    ws.addChangeListener(state.listener);
    globalThis[key] = state;
    let failureStatus = "marker-create-failed";
    try {
      const block = ws.newBlock(blockType);
      state.block = block;
      state.id = block.id;
      // Complete setup synchronously before Blockly dispatches queued events.
      block.setDisabledReason(true, reason);
      block.data = reason;
      block.setTooltip(label);
      block.setMovable(false);
      block.setEditable(false);
      block.initSvg();
      block.render();
      const size = block.getHeightWidth();
      if (!Number.isFinite(size.width) || !Number.isFinite(size.height) ||
          size.width + 48 > view.width || size.height + 48 > view.height) {
        failureStatus = "editor-not-visible"; throw new Error("marker-does-not-fit");
      }
      const xy = block.getRelativeToSurfaceXY();
      block.moveBy(view.left + (view.width - size.width) / 2 - xy.x,
        view.top + view.height - size.height - 24 - xy.y);
      // Check actual rendered bounds as well as Blockly's scroll/zoom-aware viewport.
      const rect = block.getSvgRoot().getBoundingClientRect(), bounds = svg.getBoundingClientRect();
      if (!(rect.width > 0 && rect.height > 0 && rect.left >= bounds.left && rect.top >= bounds.top &&
          rect.right <= bounds.right && rect.bottom <= bounds.bottom)) {
        failureStatus = "editor-not-visible"; throw new Error("marker-not-visible");
      }
      if (block.isEnabled() || !block.hasDisabledReason(reason) || block.getParent() || block.getChildren(false).length) throw new Error("unsafe-marker");
      state.changedAt = Date.now();
      return result("marker-present", {eventSeen: state.createEventSeen, createEventSeen: state.createEventSeen,
        nextActionAt: state.changedAt + holdMs});
    } catch {
      // Roll back only our newly created, unconnected leaf. Never delete a connected stack.
      if (state.block && !state.block.getParent() && state.block.getChildren(false).length === 0) {
        state.block.dispose(false);
        ws.removeChangeListener(state.listener);
        delete globalThis[key];
      }
      return result(failureStatus);
    }
  } catch { return result("editor-error"); }
}
