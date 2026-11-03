import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
import {startSettingsError} from "../extension/settings.js";

// Exercise the actual worker's public message path with a deterministic clock and Chrome APIs.
const source = readFileSync(new URL("../extension/worker.js", import.meta.url), "utf8").replace(/^import .*;\r?\n/gm, "");
function setup({running=true}={}) {
  let now = 1000000, onMessage;
  const alarms = new Map(), commands = [];
  const controls = {eventSeen: false, removalVerified: true, createEventSeen: true, pageVisible: true, connection: "ui-present", eligible:true, locked:false};
  let phase = "marker-absent", due = now - 1;
  const initial = {running, tabId: 7, interval: 1, activityMode: "marker", activityEnabled: true,
    nextTransitionAt: due, phase, token: "test", topDocument: "top", editorDocument: "editor", lastObservation: now,
    lastActivity: now - 180000, activityCount: 4, workspaceOnlyCount: 0, verificationNote: "", warning: "", logs: []};
  const noopEvent = {addListener() {}};
  const storage = {guardian: structuredClone(initial)};
  const chrome = {
    storage: {local: {setAccessLevel: async()=>{}, get:async()=>({}), set:async()=>{}},
      session: {get:async()=>storage, set:async value=>Object.assign(storage,structuredClone(value))}},
    action: {setBadgeText:async()=>{}, setBadgeBackgroundColor:async()=>{}, setTitle:async()=>{}},
    alarms: {get:async key=>alarms.get(key), create:async(key,value)=>alarms.set(key,{scheduledTime:value.when,...value}),
      clear:async key=>alarms.delete(key), onAlarm:noopEvent},
    tabs: {get:async()=>({url:"https://classroom.microbit.org/join", discarded:false,active:true}),
      onUpdated:noopEvent,onRemoved:noopEvent,onReplaced:noopEvent},
    runtime: {id:"test-extension",getURL:path=>"chrome-extension://test-extension/"+path,
      onMessage:{addListener(fn){onMessage=fn;}}},
    scripting: {executeScript: async options => {
      if(options.func.name==="studentProbe") return [{frameId:0,documentId:"top",result:{eligible:controls.eligible,bound:controls.eligible,
        connection:controls.connection,locked:controls.locked,lastEditorSave:null}}];
      if(options.func.name==="editorFrameProbe") return [{frameId:2,documentId:"editor",result:{candidate:true}}];
      if(options.func.name==="transportProbe") return [{frameId:0,documentId:"top",result:"connected"}];
      assert.equal(options.func.name,"markerOperation");
      const command=options.args[0]; commands.push(command);
      let result;
      if(command==="probe") result={status:phase,nextActionAt:due,...controls};
      if(command==="prepare") {phase="ready";result={status:"ready"};}
      if(command==="finish"||command==="finish-unconfirmed") {phase="ready";result={status:command==="finish"?"cycle-confirmed":"workspace-confirmed"};}
      if(command==="add") {phase="marker-present";due=now+60000;result={status:phase,eventSeen:false,nextActionAt:due};}
      assert.ok(result,command);
      return [{frameId:2,documentId:"editor",result:{pageVisible:controls.pageVisible,...result}}];
    }}
  };
  const context=vm.createContext({chrome,URL,Date:{now:()=>now},setTimeout,clearTimeout,crypto:globalThis.crypto,
    startSettingsError,studentProbe:function studentProbe(){},transportProbe:function transportProbe(){},
    editorFrameProbe:function editorFrameProbe(){},editorOperation:function editorOperation(){},markerOperation:function markerOperation(){}});
  vm.runInContext(source,context);
  return {controls,commands,initial,setPhase(value){phase=value;},advance(ms){now+=ms;},
    async start(activity=true){return new Promise(resolve=>onMessage({type:"START",tabId:7,interval:1,mode:"marker",activity,confirm:true},{id:chrome.runtime.id,url:chrome.runtime.getURL("popup.html")},resolve));},
    async check(){return new Promise(resolve=>onMessage({type:"CHECK"},{id:chrome.runtime.id,url:chrome.runtime.getURL("popup.html")},resolve));}};
}
test("delayed deletion retries without disabling activity and late confirmation resumes normally",async()=>{
  const f=setup(); let r=await f.check();
  assert.equal(r.state.activityEnabled,true); assert.equal(r.state.verificationNote,"waiting-for-delete-event");
  assert.ok(r.state.nextTransitionAt); assert.equal(r.state.activityCount,4); assert.equal(r.state.warning,"");
  f.advance(30000); f.controls.eventSeen=true; r=await f.check();
  assert.equal(r.state.activityEnabled,true); assert.equal(r.state.editor,"marker-present");
  assert.equal(r.state.activityCount,5); assert.equal(r.state.workspaceOnlyCount,0);
  assert.equal(r.state.verificationNote,"");
});
test("permanently missing delete event safely continues after grace without an event-confirmed count",async()=>{
  const f=setup(); await f.check(); f.advance(120000); const r=await f.check();
  assert.equal(r.state.activityEnabled,true); assert.equal(r.state.editor,"marker-present");
  assert.equal(r.state.activityCount,4); assert.equal(r.state.lastActivity,f.initial.lastActivity);
  assert.equal(r.state.workspaceOnlyCount,1); assert.equal(r.state.verificationNote,"delete-confirmed-in-workspace-event-missing");
  assert.ok(f.commands.includes("finish-unconfirmed")); assert.ok(f.commands.includes("add"));
});
test("fallback never resumes an independent connection pause",async()=>{
  const f=setup(); await f.check(); f.advance(120000); f.controls.connection="connection-warning";
  const r=await f.check(); assert.equal(r.state.activityEnabled,false);
  assert.equal(r.state.warning,"connection-warning-edits-paused"); assert.equal(r.state.workspaceOnlyCount,1);
  assert.equal(f.commands.includes("add"),false);
});
test("unproven removal stays paused instead of adding a duplicate",async()=>{
  const f=setup(); await f.check(); f.advance(120000); f.controls.removalVerified=false;
  const r=await f.check(); assert.equal(r.state.activityEnabled,false);
  assert.equal(r.state.warning,"delete-not-confirmed-check-monitor"); assert.equal(r.state.workspaceOnlyCount,0);
  assert.equal(f.commands.includes("finish-unconfirmed"),false); assert.equal(f.commands.includes("add"),false);
});

test("late proof after the grace timeout resumes only the deletion verification pause",async()=>{
  const f=setup(); f.controls.removalVerified=false; await f.check(); f.advance(120000);
  let r=await f.check(); assert.equal(r.state.activityEnabled,false);
  assert.equal(r.state.deleteVerificationResume,true);
  f.advance(60000); f.controls.eventSeen=true;
  r=await f.check(); assert.equal(r.state.activityEnabled,true); assert.equal(r.state.warning,"");
  assert.equal(r.state.editor,"marker-present"); assert.equal(r.state.activityCount,5);
  assert.equal(r.state.deleteVerificationResume,false);
});

test("an intervening connection failure or observation gap revokes automatic recovery",async()=>{
  for (const reason of ["connection", "gap"]) {
    const f=setup(); f.controls.removalVerified=false; await f.check(); f.advance(120000); await f.check();
    if(reason==="connection") f.controls.connection="connection-warning";
    else f.advance(151000);
    let r=await f.check(); assert.equal(r.state.deleteVerificationResume,false);
    f.controls.connection="ui-present"; f.controls.eventSeen=true;
    r=await f.check(); assert.equal(r.state.activityEnabled,false);
    assert.equal(f.commands.includes("add"),false);
  }
});

test("hidden editor holds without edits or timeout; visibility resumes verification",async()=>{
  const f=setup(); f.controls.pageVisible=false;
  for(let i=0;i<6;i++) {
    const r=await f.check(); assert.equal(r.state.running,true); assert.equal(r.state.activityEnabled,true);
    assert.equal(r.state.verificationNote,"editor-hidden"); assert.equal(r.state.nextTransitionAt,null);
    assert.equal(r.state.warning,""); f.advance(60000);
  }
  assert.equal(f.commands.every(c=>c==="probe"),true);
  f.controls.pageVisible=true; f.controls.eventSeen=true;
  const r=await f.check(); assert.equal(r.state.editor,"marker-present"); assert.equal(r.state.activityCount,5);
});

test("visibility returning cannot resume a connection pause",async()=>{
  const f=setup(); f.controls.pageVisible=false; f.controls.connection="connection-warning";
  await f.check(); f.controls.pageVisible=true; f.controls.connection="ui-present"; f.controls.eventSeen=true;
  const r=await f.check(); assert.equal(r.state.activityEnabled,false);
  assert.equal(f.commands.includes("add"),false);
});

test("missing creation event keeps the icon rather than deleting before delivery",async()=>{
  const f=setup(); f.setPhase("marker-present"); f.controls.createEventSeen=false;
  const r=await f.check(); assert.equal(r.state.activityEnabled,true); assert.equal(r.state.warning,"");
  assert.equal(r.state.verificationNote,"waiting-for-create-event");
  assert.equal(f.commands.includes("remove"),false); assert.ok(r.state.nextTransitionAt);
});

test("explicit enabled Start prepares the pinned editor; passive or ineligible Start never does",async()=>{
  const f=setup({running:false}); const r=await f.start();
  assert.equal(r.ok,true); assert.equal(r.state.editor,"marker-present");
  assert.equal(f.commands[0],"prepare"); assert.equal(r.state.activityCount,0);
  for(const variant of ["passive","ineligible-page","locked","disconnected"]) {
    const f=setup({running:false});
    if(variant==="ineligible-page") f.controls.eligible=false;
    if(variant==="locked") f.controls.locked=true;
    if(variant==="disconnected") f.controls.connection="connection-warning";
    await f.start(variant!=="passive");
    assert.equal(f.commands.includes("prepare"),false,variant);
    assert.equal(f.commands.includes("add"),false,variant);
  }
});

test("adapter warnings distinguish old run state from missing APIs",async()=>{
  for(const [status,warning] of [["previous-edit-pending","previous-monitor-run-needs-cleanup"],["api-unavailable","blocks-api-unavailable-show-blocks-editor"]]) {
    const f=setup(); f.setPhase(status); const r=await f.check();
    assert.equal(r.state.editor,status); assert.equal(r.state.warning,warning);
  }
});
