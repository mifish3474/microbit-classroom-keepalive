import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {editorOperation} from "../extension/editor.js";

function setup({events = true, api = true, crossing = false} = {}) {
  const listeners = new Set(), pending = [];
  const ws = {id: "fixture-workspace", options: {},
    getParentSvg: () => ({isConnected: true, getBoundingClientRect: () => ({width: 500, height: 400})}),
    addChangeListener: f => listeners.add(f), removeChangeListener: f => listeners.delete(f),
    getTopBlocks: ordered => ordered && crossing && block.xy.x > 100 ? [other, block] : [block, other]};
  const block = {id: "fixture-block", type: "pxt-on-start", workspace: ws, xy: {x: 100, y: 80},
    getParent: () => null, isMovable: () => true, isShadow: () => false,
    getRelativeToSurfaceXY() { return this.xy; },
    moveBy(x, y) {
      const before = {...this.xy}; this.xy.x += x; this.xy.y += y;
      if (events) pending.push({type: "move", blockId: this.id, workspaceId: ws.id,
        oldCoordinate: before, newCoordinate: {...this.xy}});
    }};
  const other = {getRelativeToSurfaceXY: () => ({x: 101, y: 80})};
  const top = {}, window = {top, parent: top};
  if (api) window.pxt = {blocks: {requireBlockly: () => ({getMainWorkspace: () => ws,
    Events: {isEnabled: () => true, getGroup: () => "", BLOCK_MOVE: "move"}})}};
  const context = vm.createContext({window, URL, location: {origin: "https://makecode.microbit.org",
    href: "https://makecode.microbit.org/?controller=1", ancestorOrigins: ["https://classroom.microbit.org"]}});
  const op = (cmd, token = "test") => vm.runInContext(`(${editorOperation.toString()})(${JSON.stringify(cmd)}, ${JSON.stringify(token)})`, context);
  return {block, ws, op, context, flush() { for (const e of pending.splice(0)) for (const f of listeners) f(e); }, listeners};
}

test("counts only real observed events and restores exact original coordinates", () => {
  const f = setup();
  assert.equal(f.op("shift").status, "shifted");
  assert.equal(f.block.xy.x, 124);
  assert.equal(f.op("probe").eventSeen, false);
  f.flush();
  assert.equal(f.op("probe").eventSeen, true);
  assert.equal(f.op("restore").status, "restored");
  assert.deepEqual(f.block.xy, {x: 100, y: 80});
  assert.equal(f.op("finish").status, "event-unconfirmed");
  f.flush();
  assert.equal(f.op("finish").status, "cycle-confirmed");
  assert.equal(f.listeners.size, 0);
});
test("missing events never become success", () => {
  const f = setup({events: false});
  f.op("shift"); f.flush();
  assert.equal(f.op("probe").eventSeen, false);
  f.op("restore"); f.flush();
  assert.equal(f.op("finish").status, "event-unconfirmed");
});
test("never overwrites manual movement or workspace replacement", () => {
  const f = setup(); f.op("shift"); f.block.xy.x = 200;
  assert.equal(f.op("restore").status, "workspace-changed");
  assert.equal(f.block.xy.x, 200);
  assert.equal(f.op("shift", "other-run").status, "previous-edit-pending");
});
test("missing API fails closed", () => assert.equal(setup({api: false}).op("shift").status, "api-unavailable"));
test("ordering changes roll back synchronously", () => {
  const f = setup({crossing: true});
  assert.equal(f.op("shift").status, "unsafe-position");
  assert.equal(f.block.xy.x, 100);
  assert.equal(f.listeners.size, 0);
});
test("Stop restores layout without claiming an unobserved event", () => {
  const f = setup(); f.op("shift"); f.flush();
  assert.equal(f.op("stop").status, "restored-unconfirmed");
  assert.equal(f.block.xy.x, 100);
  assert.equal(f.listeners.size, 0);
});
test("wrong origin and expired commands cannot mutate", () => {
  const f = setup();
  assert.equal(vm.runInContext(`(${editorOperation.toString()})("shift", "test", 1)`, f.context).status, "expired-command");
  f.context.location.origin = "https://example.com";
  assert.equal(f.op("shift").status, "wrong-frame");
  assert.equal(f.block.xy.x, 100);
});
