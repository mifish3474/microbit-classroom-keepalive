import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {markerOperation} from "../extension/marker.js";

function fixture({events = true, deleteEvents = true, width = 500, offscreen = false} = {}) {
  let now = 1000000;
  const blocks = new Map(), listeners = new Set(), pending = [];
  const view = {left: 1200, top: 900, width, height: 300}; // Deliberately scrolled workspace.
  const existing = {id: "existing-program", untouched: true};
  const ws = {id: "ws", options: {},
    getParentSvg: () => ({isConnected: true, getBoundingClientRect: () => ({left: 0, top: 0, right: width, bottom: 300, width, height: 300})}),
    getMetricsManager: () => ({getViewMetrics: () => view}),
    getBlockById: id => blocks.get(id),
    addChangeListener: f => listeners.add(f), removeChangeListener: f => listeners.delete(f),
    newBlock(type) { const b = new Block(type); blocks.set(b.id, b); emit("create", b); return b; }};
  function emit(type, b) { if (events && (type !== "delete" || deleteEvents)) pending.push({type, workspaceId: ws.id, blockId: b.id, ids: [b.id]}); }
  class Block {
    constructor(type) {
      this.id = "owned-icon"; this.type = type; this.workspace = ws; this.xy = {x: 0, y: 0}; this.reasons = new Set(); this.children = [];
      this.svgRoot = {isConnected: true, getBoundingClientRect: () => {
        const x = this.xy.x - view.left + (offscreen ? 1000 : 0), y = this.xy.y - view.top;
        return {left: x, top: y, right: x + 120, bottom: y + 80, width: 120, height: 80};
      }};
    }
    setDisabledReason(value, r) { value ? this.reasons.add(r) : this.reasons.delete(r); }
    hasDisabledReason(r) { return this.reasons.has(r); }
    isEnabled() { return !this.reasons.size; }
    getParent() { return this.parent || null; }
    getChildren() { return this.children; }
    getHeightWidth() { return {width: 120, height: 80}; }
    getSvgRoot() { return this.svgRoot; }
    getRelativeToSurfaceXY() { return this.xy; }
    setTooltip() {} setMovable() {} setEditable() {} initSvg() {} render() {}
    moveBy(x, y) { this.xy.x += x; this.xy.y += y; }
    isDisposed() { return this.disposed === true; }
    dispose() { blocks.delete(this.id); this.disposed = true; this.svgRoot.isConnected = false; emit("delete", this); }
  }
  blocks.set(existing.id, existing);
  const top = {}, window = {top, parent: top, pxt: {blocks: {requireBlockly: () => ({
    BlockSvg: Block, Blocks: {basic_show_icon: {}}, getMainWorkspace: () => ws,
    Events: {isEnabled: () => true, getGroup: () => "", BLOCK_CREATE: "create", BLOCK_DELETE: "delete"}
  })}}};
  const document = {visibilityState: "visible"};
  const context = vm.createContext({window, document, URL, Date: {now: () => now}, location: {
    origin: "https://makecode.microbit.org", href: "https://makecode.microbit.org/?controller=1",
    ancestorOrigins: ["https://classroom.microbit.org"]}});
  const op = (command, token = "run") => vm.runInContext(`(${markerOperation.toString()})(${JSON.stringify(command)},${JSON.stringify(token)},${now + 5000},60000)`, context);
  return {op, blocks, existing, listeners, view, document,
    dispatch(event) { for (const f of listeners) f(event); },
    advance(ms) { now += ms; }, flush() { for (const e of pending.splice(0)) for (const f of listeners) f(e); }};
}
test("visible icon respects viewport, stays disabled, holds for a minute, then verifies deletion", () => {
  const f = fixture();
  assert.equal(f.op("add").status, "marker-present");
  const block = f.blocks.get("owned-icon");
  assert.equal(block.isEnabled(), false);
  assert.ok(block.xy.x >= f.view.left && block.xy.x + 120 <= f.view.left + f.view.width);
  assert.ok(block.xy.y >= f.view.top && block.xy.y + 80 <= f.view.top + f.view.height);
  assert.equal(f.op("probe").eventSeen, false);
  f.flush(); assert.equal(f.op("probe").eventSeen, true);
  f.advance(59999); assert.equal(f.op("remove").status, "marker-present");
  f.advance(1); assert.equal(f.op("remove").status, "marker-absent");
  assert.equal(f.op("finish").status, "event-unconfirmed");
  f.flush(); assert.equal(f.op("finish").status, "cycle-confirmed");
  assert.equal(f.blocks.size, 1); assert.equal(f.blocks.get(f.existing.id), f.existing);
});
test("missing events cannot count as confirmed", () => {
  const f = fixture({events: false}); f.op("add"); f.advance(60000); f.op("remove");
  assert.equal(f.op("finish").status, "event-unconfirmed");
});
test("connected or changed icons are never deleted with other code", () => {
  for (const change of [b => b.children.push({}), b => b.parent = {}, b => b.reasons.clear(), b => b.data = "changed"]) {
    const f = fixture(); f.op("add"); const b = f.blocks.get("owned-icon"); change(b); f.advance(60000);
    assert.equal(f.op("remove").status, "marker-changed"); assert.equal(f.blocks.get(b.id), b);
  }
});
test("offscreen or oversized markers roll back instead of claiming visible activity", () => {
  for (const options of [{width: 150}, {offscreen: true}]) {
    const f = fixture(options); assert.equal(f.op("add").status, "editor-not-visible");
    assert.equal(f.blocks.size, 1); assert.equal(f.listeners.size, 0);
  }
});
test("Stop removes only the owned icon, while a different run cannot claim it", () => {
  const f = fixture(); f.op("add");
  assert.equal(f.op("stop", "other-run").status, "previous-edit-pending");
  assert.equal(f.op("stop").status, "marker-removed-unconfirmed");
  assert.equal(f.blocks.size, 1); assert.equal(f.listeners.size, 0);
});
test("missing delete event can be verified separately without inventing an event", () => {
  const f = fixture({deleteEvents: false}); f.op("add"); f.flush(); f.advance(60000); f.op("remove");
  const probe = f.op("probe");
  assert.equal(probe.eventSeen, false); assert.equal(probe.createEventSeen, true); assert.equal(probe.removalVerified, true);
  assert.equal(f.op("finish").status, "event-unconfirmed");
  assert.equal(f.op("finish-unconfirmed").status, "workspace-confirmed");
  assert.equal(f.listeners.size, 0); assert.equal(f.blocks.size, 1);
});
test("late create and delete events remain associated with their phases", () => {
  const f = fixture(); f.op("add"); f.advance(60000); f.op("remove"); f.flush();
  const probe = f.op("probe");
  assert.equal(probe.createEventSeen, true); assert.equal(probe.eventSeen, true);
  assert.equal(f.op("finish").status, "cycle-confirmed");
});
test("absence alone cannot authorize fallback if disposal or DOM removal is unproven", () => {
  for (const alter of [b => b.disposed = false, b => b.svgRoot.isConnected = true]) {
    const f = fixture({deleteEvents: false}); f.op("add"); f.flush(); const b = f.blocks.get("owned-icon");
    f.advance(60000); f.op("remove"); alter(b);
    assert.equal(f.op("probe").removalVerified, false);
    assert.equal(f.op("finish-unconfirmed").status, "event-unconfirmed");
  }
  const f = fixture({events: false}); f.op("add"); f.advance(60000); f.op("remove");
  assert.equal(f.op("finish-unconfirmed").status, "event-unconfirmed");
});
test("event matching accepts root identity without requiring exactly one optional ID", () => {
  const f = fixture({events: false}); f.op("add");
  f.dispatch({type: "create", workspaceId: "wrong", blockId: "owned-icon"});
  f.dispatch({type: "create", workspaceId: "ws", blockId: "wrong"});
  assert.equal(f.op("probe").eventSeen, false);
  f.dispatch({type: "create", workspaceId: "ws", blockId: "owned-icon"});
  assert.equal(f.op("probe").eventSeen, true);
  f.advance(60000); f.op("remove");
  f.dispatch({type: "delete", workspaceId: "ws", blockId: "owned-icon", ids: ["other"]});
  assert.equal(f.op("probe").eventSeen, false);
  f.dispatch({type: "delete", workspaceId: "ws", blockId: "owned-icon", ids: ["other", "owned-icon"]});
  assert.equal(f.op("probe").eventSeen, true);
});

test("hidden editors retain the owned block until visible; Stop can still clean up", () => {
  const f = fixture(); f.document.visibilityState = "hidden";
  assert.equal(f.op("add").status, "ready"); assert.equal(f.blocks.size, 1);
  f.document.visibilityState = "visible"; f.op("add"); f.flush(); f.advance(60000);
  f.document.visibilityState = "hidden";
  assert.equal(f.op("remove").status, "marker-present"); assert.equal(f.blocks.size, 2);
  assert.equal(f.op("probe").pageVisible, false);
  f.document.visibilityState = "visible";
  assert.equal(f.op("remove").status, "marker-absent"); f.flush();
  f.document.visibilityState = "hidden";
  assert.equal(f.op("finish").status, "marker-absent"); assert.equal(f.listeners.size, 1);
  assert.equal(f.op("stop").status, "cycle-confirmed"); assert.equal(f.listeners.size, 0);
});

test("explicit Start preparation clears a completed old run without inventing activity", () => {
  const f=fixture({deleteEvents:false}); f.op("add"); f.flush(); f.advance(60000); f.op("remove");
  assert.equal(f.op("probe","new-run").status,"previous-edit-pending");
  assert.equal(f.op("stop","new-run").status,"previous-edit-pending");
  assert.equal(f.op("prepare","new-run").status,"ready");
  assert.equal(f.listeners.size,0); assert.equal(f.blocks.size,1);
  assert.equal(f.op("add","new-run").status,"marker-present");
  assert.equal(f.blocks.get(f.existing.id),f.existing);
});

test("explicit Start preparation safely cleans only the old owned disconnected icon", () => {
  const f=fixture(); f.op("add"); f.flush();
  assert.equal(f.op("prepare","new-run").status,"marker-removed-unconfirmed");
  assert.equal(f.listeners.size,0); assert.equal(f.blocks.size,1);
  assert.equal(f.op("add","new-run").status,"marker-present");
  assert.equal(f.blocks.get(f.existing.id),f.existing);
});

test("Start recovery never takes over a changed, connected, or unproven old marker", () => {
  for(const change of [b=>b.children.push({}),b=>b.parent={},b=>b.data="changed",b=>b.workspace={}]) {
    const f=fixture(); f.op("add"); change(f.blocks.get("owned-icon"));
    assert.equal(f.op("prepare","new-run").status,"marker-changed");
    assert.equal(f.blocks.size,2); assert.equal(f.listeners.size,1);
  }
  const f=fixture(); f.op("add"); const b=f.blocks.get("owned-icon");
  f.advance(60000); f.op("remove"); b.disposed=false;
  assert.equal(f.op("prepare","new-run").status,"previous-edit-pending");
  assert.equal(f.listeners.size,1);
});
