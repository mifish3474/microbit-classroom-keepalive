import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {studentProbe} from "../extension/probes.js";

function probe({compact=false, headerHidden=false, leaves=1, frames=1, path="/join", frameOrigin="https://makecode.microbit.org", warning=null}={}) {
  const element = hidden => ({isConnected:true, getClientRects:()=>hidden?[]:[{}],
    style:{visibility:"visible",display:hidden?"none":"block"}});
  const header=element(headerHidden);
  header.querySelectorAll=()=>{throw new Error("Student names must not be inspected");};
  const leave={...element(compact),closest:()=>header};
  const frame={src:frameOrigin+"/?controller=1"};
  const document={querySelectorAll:selector=>selector.includes("student-leave")?Array(leaves).fill(leave):Array(frames).fill(frame),
    querySelector:selector=>selector.includes("connection-error")&&warning?{...element(false),textContent:warning}:null};
  const window={}; window.top=window;
  const context=vm.createContext({window,document,URL,navigator:{onLine:true},getComputedStyle:el=>el.style,
    location:{origin:"https://classroom.microbit.org",pathname:path}});
  return vm.runInContext(`(${studentProbe.toString()})()`,context);
}

test("compact and full headers use teacher selection without inspecting any name",()=>{
  for(const compact of [false,true]) {
    const r=probe({compact}); assert.equal(r.eligible,true); assert.equal(r.connection,"ui-present");
  }
});
test("student page, unique controls, visible header, and exact editor origin remain required",()=>{
  for(const options of [{headerHidden:true},{leaves:0},{leaves:2},{frames:0},{frames:2},{path:"/sessions/live"},{frameOrigin:"https://example.org"}]) {
    assert.equal(probe(options).eligible,false,JSON.stringify(options));
  }
});
test("compact header does not mask expiry warnings",()=>{
  assert.equal(probe({compact:true,warning:"Session expired"}).connection,"expired");
});
