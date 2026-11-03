// Runs only in MAIN world of the explicitly pinned MakeCode document.
// No XML, generated code, names, credentials, or message payloads are read.
export function editorOperation(command, token, deadline = Date.now() + 5000) {
  const key = "__classroomGuardianEditorV1";
  const result = (status, extra = {}) => ({status, ...extra});
  try {
    if (globalThis.__classroomGuardianMarkerV1) return result("previous-edit-pending");
    if (!Number.isFinite(deadline) || Date.now() > deadline) return result("expired-command");
    if (location.origin !== "https://makecode.microbit.org" || window === window.top ||
        window.parent !== window.top || location.ancestorOrigins[0] !== "https://classroom.microbit.org" ||
        new URL(location.href).searchParams.get("controller") !== "1") return result("wrong-frame");
    const B = window.pxt?.blocks?.requireBlockly?.() || window.Blockly;
    const ws = B?.getMainWorkspace?.() || B?.common?.getMainWorkspace?.();
    const prior = globalThis[key];
    if (prior && prior.token !== token) return result("previous-edit-pending");
    const svg = ws?.getParentSvg?.();
    const available = !!ws && !ws.isFlyout && !ws.isMutator && !ws.options?.readOnly &&
      !!svg?.isConnected && svg.getBoundingClientRect().width > 0 && svg.getBoundingClientRect().height > 0 &&
      typeof ws.addChangeListener === "function" && typeof ws.removeChangeListener === "function" &&
      typeof ws.getTopBlocks === "function" && B?.Events?.isEnabled?.();
    if (!available) return result(prior ? "restore-unavailable" : "api-unavailable");
    const same = (a, b) => !!a && !!b && Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01;
    const cleanup = () => {
      if (prior?.listener) prior.workspace.removeChangeListener(prior.listener);
      delete globalThis[key];
    };
    const snapshot = () => prior ? result(prior.phase, {eventSeen: prior.eventSeen}) : result("ready");
    if (command === "probe") return snapshot();
    if (!["shift", "restore", "finish", "stop"].includes(command)) return result("invalid-command");
    if (prior && (prior.workspace !== ws || prior.block.workspace !== ws || prior.block.getParent() ||
        !same(prior.block.getRelativeToSurfaceXY(), prior.expected) ||
        ws.getTopBlocks(true).length !== prior.order.length ||
        ws.getTopBlocks(true).some((b, i) => b !== prior.order[i]))) return result("workspace-changed");
    if (command === "finish") {
      if (prior?.phase !== "restored" || !prior.eventSeen) return result("event-unconfirmed");
      cleanup();
      return result("cycle-confirmed");
    }
    if (command === "stop" && !prior) return result("idle");
    if (command === "stop" && prior?.phase === "restored") {
      const confirmed = prior.eventSeen;
      cleanup();
      return result(confirmed ? "restored-confirmed" : "restored-unconfirmed");
    }
    if ((command === "restore" || command === "stop") && prior?.phase === "shifted") {
      const old = {...prior.expected};
      prior.expected = {...prior.original};
      prior.eventSeen = false;
      prior.phase = "restored";
      prior.from = old;
      prior.block.moveBy(prior.original.x - old.x, prior.original.y - old.y);
      if (!same(prior.block.getRelativeToSurfaceXY(), prior.original)) return result("restore-failed");
      // Leave the listener for the next alarm (Blockly dispatches events asynchronously).
      if (command === "stop") {
        cleanup();
        return result("restored-unconfirmed");
      }
      return result("restored", {eventSeen: prior.eventSeen});
    }
    if (command !== "shift" || prior) return result("busy");
    if (ws.isDragging?.() || B.Events.getGroup?.()) return result("editor-busy");
    // Horizontal-only movement preserves top-to-bottom ordering of top-level stacks.
    // moveBy changes layout, not fields, connections, block count, or executable code.
    const block = ws.getTopBlocks(false).find(b => ["pxt-on-start", "device_forever"].includes(b.type) &&
      !b.getParent() && b.isMovable?.() &&
      !b.isShadow?.() && !b.isInsertionMarker?.() && typeof b.moveBy === "function");
    if (!block) return result("no-movable-block");
    const xy = block.getRelativeToSurfaceXY();
    if (!Number.isFinite(xy.x) || !Number.isFinite(xy.y)) return result("unsafe-position");
    const order = ws.getTopBlocks(true);
    const state = {token, workspace: ws, block, order, original: {x: xy.x, y: xy.y},
      from: {x: xy.x, y: xy.y}, expected: {x: xy.x + 24, y: xy.y}, phase: "shifted", eventSeen: false};
    state.listener = event => {
      if (event.type === (B.Events.BLOCK_MOVE || "move") && event.blockId === block.id &&
          event.workspaceId === ws.id && !event.oldParentId && !event.newParentId &&
          same(event.oldCoordinate, state.from) && same(event.newCoordinate, state.expected)) state.eventSeen = true;
    };
    ws.addChangeListener(state.listener);
    globalThis[key] = state; // Recovery intent exists before mutation.
    block.moveBy(24, 0);
    if (!same(block.getRelativeToSurfaceXY(), state.expected)) return result("move-failed");
    const after = ws.getTopBlocks(true);
    if (after.length !== order.length || after.some((b, i) => b !== order[i])) {
      // Synchronous rollback precedes Blockly's queued event dispatch.
      block.moveBy(-24, 0);
      ws.removeChangeListener(state.listener);
      delete globalThis[key];
      return result("unsafe-position");
    }
    return result("shifted", {eventSeen: state.eventSeen});
  } catch {
    // Never return exception text: page exceptions can contain project data.
    return result("editor-error");
  }
}
