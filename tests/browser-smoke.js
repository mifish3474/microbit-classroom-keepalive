// Isolated browser profile + synthetic HTTPS pages. No live classrooms or accounts.
// Requires Windows Edge (supports command-line unpacked extensions) or BROWSER_EXE.
import {spawn} from "node:child_process";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import assert from "node:assert/strict";
import {studentProbe} from "../extension/probes.js";

const delay = ms => new Promise(r => setTimeout(r, ms));
const profile = await mkdtemp(join(tmpdir(), "guardian-browser-test-"));
const executable = process.env.BROWSER_EXE || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const browser = spawn(executable, ["--headless=new", "--remote-debugging-port=9224", `--user-data-dir=${profile}`,
  `--load-extension=${resolve("extension")}`, "--no-first-run", "--disable-background-networking",
  "--disable-component-update", "--disable-sync", "about:blank"], {windowsHide: true, stdio: "ignore"});
let launchError;
browser.on("error", error => { launchError = error; });
let socket;
const pending = new Map();
let serial = 0;
const handlers = new Map();
const call = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const id = ++serial;
  const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
  pending.set(id, {resolve, reject, timer});
  socket.send(JSON.stringify({id, method, params, ...(sessionId ? {sessionId} : {})}));
});
const on = (method, fn) => handlers.set(method, fn);
const evaluate = async (session, expression) => {
  const r = await call("Runtime.evaluate", {expression, awaitPromise: true, returnByValue: true}, session);
  if (r.exceptionDetails) throw new Error(`Browser evaluation failed: ${r.exceptionDetails.text}`);
  return r.result.value;
};
const fixtureEditor = `<!doctype html><html><body><svg id="workspace" width="500" height="300"></svg>
<iframe title="Simulator" src="https://trg-microbit.userpxt.io/---simulator"></iframe><script>
const listeners = new Set();
const markers = new Map();
let markerSerial = 0;
const workspace = {id:'fake-workspace',options:{},getParentSvg:()=>document.querySelector('svg'),
  addChangeListener:f=>listeners.add(f), removeChangeListener:f=>listeners.delete(f),getTopBlocks:()=>[block,...markers.values()],
  getMetricsManager:()=>({getViewMetrics:()=>({left:0,top:0,width:500,height:300})}),
  getBlockById:id=>id===block.id?block:markers.get(id),
  newBlock(type){const b=new Marker(type);markers.set(b.id,b);emit('create',b);return b;}};
function emit(type,b){if(type==='delete'&&window.testDropDelete)return;requestAnimationFrame(()=>setTimeout(()=>{const e={type,blockId:b.id,workspaceId:workspace.id,ids:[b.id]};
  for(const f of listeners)f(e);parent.postMessage({type:'pxthost',action:'workspacesave'},'https://classroom.microbit.org');},0));}
class Marker {
  constructor(type){this.id='test-icon-'+(++markerSerial);this.type=type;this.workspace=workspace;this.xy={x:0,y:0};this.reasons=new Set();}
  setDisabledReason(v,r){v?this.reasons.add(r):this.reasons.delete(r)}
  hasDisabledReason(r){return this.reasons.has(r)} isEnabled(){return !this.reasons.size}
  getParent(){return null} getChildren(){return []} setTooltip(){} setMovable(){} setEditable(){}
  initSvg(){this.root=document.createElementNS('http://www.w3.org/2000/svg','g');
    this.root.innerHTML='<rect width="120" height="80" rx="8" fill="#b4cbd8"></rect><text x="8" y="40">show icon</text>';
    document.querySelector('svg').append(this.root);}
  render(){} getHeightWidth(){return {width:120,height:80}} getSvgRoot(){return this.root}
  getRelativeToSurfaceXY(){return this.xy}
  moveBy(x,y){this.xy.x+=x;this.xy.y+=y;this.root.setAttribute('transform','translate('+this.xy.x+','+this.xy.y+')')}
  isDisposed(){return this.disposed===true}
  dispose(){this.disposed=true;this.root?.remove();markers.delete(this.id);emit('delete',this);}
}
const block = {id:'fake-block',type:'pxt-on-start',workspace,xy:{x:100,y:80},getParent:()=>null,
  isMovable:()=>true,isShadow:()=>false,getRelativeToSurfaceXY(){return this.xy},moveBy(x,y){
  const old={...this.xy}; this.xy.x+=x;this.xy.y+=y;
  const event={type:'move',blockId:this.id,workspaceId:workspace.id,oldCoordinate:old,newCoordinate:{...this.xy}};
  queueMicrotask(()=>{for(const f of listeners) f(event);parent.postMessage({type:'pxthost',action:'workspacesave'},'https://classroom.microbit.org')});
}};
window.pxt={blocks:{requireBlockly:()=>({BlockSvg:Marker,Blocks:{basic_show_icon:{}},getMainWorkspace:()=>workspace,
  Events:{isEnabled:()=>true,getGroup:()=>'',BLOCK_MOVE:'move',BLOCK_CREATE:'create',BLOCK_DELETE:'delete'}})}};
window.testBlock=block;
</script></body></html>`;
const fixtureStudent = `<!doctype html><html><body><section aria-label="Header">
<div><svg></svg><div class="ov_hidden"><p>Classroom Monitor</p></div></div>
<button data-testid="student-leave">Leave</button></section>
<section aria-label="Code editor"><iframe title="MakeCode" src="https://makecode.microbit.org/?controller=1" width="600" height="400"></iframe></section>
<script>window.Pusher={instances:[{connection:{state:'connected'}}]}</script></body></html>`;
let browserClosed = false;
try {
  let meta;
  for (let i = 0; i < 60; i++) {
    if (launchError) throw launchError;
    try { meta = await fetch("http://127.0.0.1:9224/json/version").then(r => r.json()); break; } catch { await delay(200); }
  }
  if (!meta) throw new Error("Test browser did not start.");
  socket = new WebSocket(meta.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = ({data}) => {
    const event = JSON.parse(data);
    if (event.id) {
      const p = pending.get(event.id); if (!p) return;
      clearTimeout(p.timer); pending.delete(event.id);
      event.error ? p.reject(new Error(event.error.message)) : p.resolve(event.result);
    } else Promise.resolve(handlers.get(event.method)?.(event.params, event.sessionId)).catch(error => {
      console.error(error.message); process.exitCode = 1;
    });
  };
  on("Fetch.requestPaused", async (event, session) => {
    const u = new URL(event.request.url);
    const body = u.hostname === "makecode.microbit.org" ? fixtureEditor :
      u.hostname === "classroom.microbit.org" ? fixtureStudent : "<!doctype html><title>Blocked by test harness</title>";
    await call("Fetch.fulfillRequest", {requestId: event.requestId, responseCode: 200,
      responseHeaders: [{name: "Content-Type", value: "text/html"}], body: Buffer.from(body).toString("base64")}, session);
  });
  on("Target.attachedToTarget", async ({sessionId, targetInfo, waitingForDebugger}) => {
    if (["page", "iframe"].includes(targetInfo.type)) {
      await call("Fetch.enable", {patterns: [{urlPattern: "http*"}]}, sessionId);
      await call("Target.setAutoAttach", {autoAttach: true, waitForDebuggerOnStart: true, flatten: true}, sessionId);
    }
    if (waitingForDebugger) await call("Runtime.runIfWaitingForDebugger", {}, sessionId);
  });
  await call("Target.setAutoAttach", {autoAttach: true, waitForDebuggerOnStart: true, flatten: true});
  let worker;
  for (let i = 0; i < 40; i++) {
    const {targetInfos} = await call("Target.getTargets");
    worker = targetInfos.find(t => t.type === "service_worker" && t.url.endsWith("/worker.js"));
    if (worker) break;
    await delay(200);
  }
  if (!worker) throw new Error("Unpacked extension worker unavailable; use an Edge build supporting --load-extension.");
  const id = new URL(worker.url).host;
  const fixture = await call("Target.createTarget", {url: "about:blank"});
  const {sessionId: fixtureSession} = await call("Target.attachToTarget", {targetId: fixture.targetId, flatten: true});
  await call("Fetch.enable", {patterns: [{urlPattern: "http*"}]}, fixtureSession);
  await call("Page.navigate", {url: "https://classroom.microbit.org/join"}, fixtureSession);
  await delay(1500);
  const popup = await call("Target.createTarget", {url: `chrome-extension://${id}/popup.html`, background: true});
  const {sessionId: popupSession} = await call("Target.attachToTarget", {targetId: popup.targetId, flatten: true});
  await delay(600);
  const tabs = await evaluate(popupSession, "chrome.tabs.query({url:'https://classroom.microbit.org/*'}).then(t=>t.map(x=>x.id))");
  assert.equal(tabs.length, 1);
  const tabId = tabs[0];
  await evaluate(popupSession, `chrome.tabs.update(${tabId},{active:true})`);
  const observation = await evaluate(fixtureSession, `(${studentProbe.toString()})()`);
  assert.equal(observation.eligible, true, JSON.stringify({observation,
    dom: await evaluate(fixtureSession, "document.body.innerHTML") }));
  const send = msg => evaluate(popupSession, `chrome.runtime.sendMessage(${JSON.stringify(msg)})`);
  await evaluate(popupSession, `document.getElementById('mode').value='layout';
    document.getElementById('mode').dispatchEvent(new Event('change'));
    document.getElementById('interval').value='1';
    document.getElementById('confirm').checked=true;
    document.getElementById('confirm').dispatchEvent(new Event('change'));
    document.getElementById('start').click();`);
  await delay(2200); // Periodic status rendering must not erase the validation message.
  assert.match(await evaluate(popupSession, "document.getElementById('notice').textContent"), /whole number from 3 to 60 minutes/);
  let status = await send({type: "STATUS"});
  assert.equal(status.state.running, false);
  assert.equal(status.state.warning, "");
  assert.equal(status.state.logs.length, 0);
  await evaluate(popupSession, `document.getElementById('interval').value='3';
    document.getElementById('interval').dispatchEvent(new Event('input'));`);
  console.log("PASS: popup explains the one-minute limit without starting or failing monitoring");
  let r = await send({type: "START", tabId, interval: 3, activity: true, confirm: true});
  assert.equal(r.ok, true);
  assert.equal(r.state.running, true, JSON.stringify(r));
  assert.equal(r.state.editor, "shifted", JSON.stringify(r));
  assert.equal(r.state.activityCount, 0);
  assert.equal(await evaluate(popupSession, "chrome.action.getBadgeText({})"), "?");
  const beforeInvalidInput = r.state;
  const invalid = await send({type: "START", tabId, interval: 1, activity: true, confirm: true});
  assert.equal(invalid.ok, false);
  assert.equal(invalid.kind, "input");
  assert.match(invalid.error, /whole number from 3 to 60 minutes/);
  status = await send({type: "STATUS"});
  assert.deepEqual(status.state, beforeInvalidInput);
  console.log("PASS: invalid interval leaves active monitoring, pending restoration, and diagnostics unchanged");
  await delay(100);
  r = await send({type: "CHECK"});
  assert.equal(r.state.editor, "restored", JSON.stringify(r));
  await delay(100);
  r = await send({type: "CHECK"});
  assert.equal(r.state.activityCount, 1, JSON.stringify(r));
  assert.equal(r.state.joinVerifiedAt, null);
  assert.ok(r.state.lastEditorSave);
  console.log("PASS: real MV3 messaging, cross-origin MAIN-world injection, verified edit/restore, no false join claim");
  await delay(2200); // Let popup polling render the current running state.
  await evaluate(popupSession, `document.getElementById('joined').checked=true;
    document.getElementById('joined').dispatchEvent(new Event('change'));
    document.getElementById('verify').click();`);
  await delay(100);
  r = await send({type: "STATUS"});
  assert.ok(r.state.joinVerifiedAt);
  const recordedJoin = r.state.joinVerifiedAt;
  assert.equal(await evaluate(popupSession, "chrome.action.getBadgeText({})"), "");
  r = await send({type: "CHECK"});
  assert.equal(r.state.running, true);
  assert.equal(r.state.joinVerifiedAt, recordedJoin);
  assert.equal(await evaluate(popupSession, "chrome.action.getBadgeText({})"), "");
  assert.match(await evaluate(popupSession, "document.getElementById('status').textContent"), /current reachability unverified/);
  console.log("PASS: recording a manual join clears the reminder while monitoring and historical verification remain");
  // Page messages cannot invoke extension commands.
  await evaluate(fixtureSession, "window.postMessage({type:'START',activity:true},'*')");
  r = await send({type: "STATUS"}); assert.equal(r.state.activityCount, 1);
  await evaluate(fixtureSession, "document.body.insertAdjacentHTML('beforeend','<div data-testid=connection-error-indicator>Session expired due to inactivity</div>')");
  r = await send({type: "CHECK"});
  assert.equal(r.state.connection, "expired"); assert.equal(r.state.activityEnabled, false);
  assert.equal(await evaluate(popupSession, "chrome.action.getBadgeText({})"), "!");
  await send({type: "JOIN_VERIFIED"});
  assert.equal(await evaluate(popupSession, "chrome.action.getBadgeText({})"), "!");
  console.log("PASS: expiration warning pauses edits");
  await send({type: "STOP"});
  await evaluate(fixtureSession, "document.querySelector('.ov_hidden p').textContent='Different fixture student'");
  r = await send({type: "START", tabId, interval: 3, activity: true, confirm: true});
  assert.equal(r.state.running, false); assert.equal(r.state.activityCount, 0);
  console.log("PASS: wrong student rejected");
  await evaluate(fixtureSession, "document.querySelector('.ov_hidden p').textContent='Classroom Monitor';document.querySelector('[data-testid=connection-error-indicator]').remove()");
  r = await send({type: "START", tabId, interval: 3, activity: false, confirm: true});
  assert.equal(r.state.running, true);
  assert.equal(r.state.joinVerifiedAt, null);
  assert.equal(await evaluate(popupSession, "chrome.action.getBadgeText({})"), "?");
  console.log("PASS: manual confirmation cannot hide warnings; a new monitoring run restores the reminder");
  await evaluate(fixtureSession, "document.querySelector('iframe').remove()");
  await delay(200);
  r = await send({type: "STATUS"});
  assert.equal(r.state.running, false);
  console.log("PASS: iframe replacement/removal invalidates authorization");
  await call("Page.navigate", {url: "https://classroom.microbit.org/join"}, fixtureSession);
  await delay(700);
  r = await send({type:"START",tabId,interval:1,mode:"marker",activity:true,confirm:true});
  assert.equal(r.state.editor, "marker-present", JSON.stringify(r));
  assert.ok(r.state.nextTransitionAt > Date.now() + 59000);
  const markerRead = () => evaluate(popupSession, `(async()=>{const {guardian:g}=await chrome.storage.session.get('guardian');
    const [r]=await chrome.scripting.executeScript({target:{tabId:g.tabId,documentIds:[g.editorDocument]},world:'MAIN',
      func:()=>{const p=globalThis.__classroomGuardianMarkerV1; const r=p?.block?.getSvgRoot()?.getBoundingClientRect();
        return {present:!!p?.workspace.getBlockById(p.id),disabled:p?.block?!p.block.isEnabled():null,
          left:r?.left,top:r?.top,right:r?.right,bottom:r?.bottom,originalX:window.testBlock.xy.x};}});return r.result;})()`);
  const initialMarker = await markerRead();
  assert.equal(initialMarker.present, true); assert.equal(initialMarker.disabled, true);
  assert.ok(initialMarker.left >= 8 && initialMarker.right <= 508 && initialMarker.top >= 8 && initialMarker.bottom <= 308);
  r = await send({type:"CHECK"}); assert.equal(r.state.editor,"marker-present");
  r = await send({type:"ACTIVITY"}); assert.equal(r.state.editor,"marker-present");
  assert.equal((await markerRead()).originalX, 100);
  console.log("PASS: visible disabled icon fits the viewport; Check now and activity requests cannot shorten the hold");
  if (process.argv.includes("--marker-alarms")) {
    const {targetInfos} = await call("Target.getTargets");
    const liveWorker = targetInfos.find(t=>t.type==='service_worker'&&t.url.endsWith('/worker.js'));
    await call("Target.closeTarget",{targetId:popup.targetId});
    await call("Target.closeTarget",{targetId:liveWorker.targetId});
    console.log("Waiting 65 seconds for automatic icon deletion with popup closed and worker stopped...");
    await delay(65000);
    const p = await call("Target.createTarget",{url:'chrome-extension://'+id+'/popup.html',background:true});
    const {sessionId:s} = await call("Target.attachToTarget",{targetId:p.targetId,flatten:true});
    await delay(500);
    const message = msg=>evaluate(s,`chrome.runtime.sendMessage(${JSON.stringify(msg)})`);
    r = await message({type:'STATUS'}); assert.equal(r.state.editor,'marker-absent',JSON.stringify(r));
    assert.ok(r.state.nextTransitionAt > Date.now() + 45000);
    r = await message({type:'ACTIVITY'}); assert.equal(r.state.editor,'marker-absent');
    console.log("PASS: icon deleted by real alarm; absence interval cannot be shortened. Waiting for re-add...");
    await delay(65000);
    r = await message({type:'STATUS'}); assert.equal(r.state.editor,'marker-present',JSON.stringify(r));
    assert.equal(r.state.activityCount,1);
    await message({type:'STOP'});
    console.log("PASS: icon re-added after a full absent minute; create/delete events counted once");
  } else {
    // Accelerate only the synthetic adapter's timestamps; exercise the real worker recovery.
    const ageMarker = age => evaluate(popupSession, `(async()=>{const {guardian:g}=await chrome.storage.session.get('guardian');
      await chrome.scripting.executeScript({target:{tabId:g.tabId,documentIds:[g.editorDocument]},world:'MAIN',
        func:age=>{window.testDropDelete=true;globalThis.__classroomGuardianMarkerV1.changedAt=Date.now()-age;},args:[${age}]});})()`);
    await ageMarker(60001);
    const otherTab = await evaluate(popupSession, "chrome.tabs.create({url:'about:blank',active:true}).then(t=>t.id)");
    await delay(200);
    r=await send({type:'CHECK'}); assert.equal(r.state.editorVisible,false,JSON.stringify(r));
    assert.equal(r.state.verificationNote,'editor-hidden'); assert.equal(r.state.activityEnabled,true);
    assert.equal(r.state.nextTransitionAt,null); assert.equal((await markerRead()).present,true);
    await evaluate(popupSession, `chrome.tabs.update(${tabId},{active:true})`);
    await delay(200);
    console.log('PASS: real background tab holds the icon; returning to the tab resumes with animation-frame event delivery');
    r=await send({type:'CHECK'}); assert.equal(r.state.editor,'marker-absent');
    await ageMarker(60001);
    r=await send({type:'CHECK'}); assert.equal(r.state.verificationNote,'waiting-for-delete-event');
    assert.equal(r.state.activityEnabled,true); assert.equal(r.state.activityCount,0);
    await ageMarker(180001);
    r=await send({type:'CHECK'}); assert.equal(r.state.editor,'marker-present',JSON.stringify(r));
    assert.equal(r.state.activityEnabled,true); assert.equal(r.state.activityCount,0);
    assert.equal(r.state.workspaceOnlyCount,1); assert.equal(r.state.lastActivity,null);
    assert.equal((await markerRead()).present,true);
    console.log('PASS: suppressed delete event retries then safely re-adds without claiming event-confirmed activity (accelerated timestamps)');
    // Model authorization lost on extension reload while the page's MAIN-world record survives.
    const orphanRecord = () => evaluate(popupSession, `(async()=>{const {guardian:g}=await chrome.storage.session.get('guardian');
      await chrome.scripting.executeScript({target:{tabId:g.tabId,documentIds:[g.editorDocument]},world:'MAIN',
        func:()=>{globalThis.__classroomGuardianMarkerV1.token='old-fixture-run';}});})()`);
    await orphanRecord();
    r=await send({type:'CHECK'}); assert.equal(r.state.editor,'previous-edit-pending');
    assert.equal(r.state.warning,'previous-monitor-run-needs-cleanup');
    await send({type:'STOP'});
    r=await send({type:'START',tabId,interval:1,mode:'marker',activity:true,confirm:true});
    assert.equal(r.state.editor,'marker-present',JSON.stringify(r)); assert.equal(r.state.warning,'');
    assert.equal(r.state.activityCount,0); assert.equal((await markerRead()).originalX,100);
    console.log('PASS: explicit Start recovers an unchanged owned icon after simulated lost authorization');
    await delay(200); await ageMarker(60001);
    r=await send({type:'CHECK'}); assert.equal(r.state.editor,'marker-absent');
    await orphanRecord(); await send({type:'STOP'});
    r=await send({type:'START',tabId,interval:1,mode:'marker',activity:true,confirm:true});
    assert.equal(r.state.editor,'marker-present',JSON.stringify(r)); assert.equal(r.state.warning,'');
    assert.equal(r.state.activityCount,0);
    console.log('PASS: completed old deletion record is cleared without reloading the student page or counting old activity');
    r=await send({type:'STOP'}); assert.equal(r.state.phase,'idle');
    assert.equal((await markerRead()).present,false);
  }
  if (process.argv.includes("--alarms")) {
    await call("Page.navigate", {url: "https://classroom.microbit.org/join"}, fixtureSession);
    await delay(700);
    r = await send({type: "START", tabId, interval: 3, activity: true, confirm: true});
    assert.equal(r.state.editor, "shifted", JSON.stringify(r));
    await call("Target.closeTarget", {targetId: popup.targetId});
    const {targetInfos} = await call("Target.getTargets");
    const liveWorker = targetInfos.find(t => t.type === "service_worker" && t.url.endsWith("/worker.js"));
    assert.ok(liveWorker);
    await call("Target.closeTarget", {targetId: liveWorker.targetId});
    console.log("Waiting 65 seconds for a real Chrome alarm with popup closed and worker stopped...");
    await delay(65000);
    const checkPopup = await call("Target.createTarget", {url: `chrome-extension://${id}/popup.html`, background: true});
    const {sessionId: checkSession} = await call("Target.attachToTarget", {targetId: checkPopup.targetId, flatten: true});
    await delay(500);
    const checkSend = msg => evaluate(checkSession, `chrome.runtime.sendMessage(${JSON.stringify(msg)})`);
    r = await checkSend({type: "STATUS"});
    assert.equal(r.state.editor, "restored", JSON.stringify(r));
    r = await checkSend({type: "CHECK"});
    assert.equal(r.state.activityCount, 1, JSON.stringify(r));
    await checkSend({type: "STOP"});
    console.log("PASS: actual alarm wakes worker, retains target authorization, and restores with popup closed");
  }
  console.log(`Browser fixture smoke passed on ${meta.Browser}. Live MakeCode/server behavior remains untested.`);
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    try { await call("Browser.close"); browserClosed = true; } catch { /* Process may already be gone. */ }
    socket.close();
  }
  if (!browserClosed) browser.kill();
  for (const p of pending.values()) { clearTimeout(p.timer); p.reject(new Error("Test browser closed")); }
  // This uniquely created temporary profile is the only recursively removed directory.
  if (resolve(profile).startsWith(resolve(tmpdir()) + "\\") || resolve(profile).startsWith(resolve(tmpdir()) + "/")) {
    await rm(profile, {recursive: true, force: true, maxRetries: 10, retryDelay: 300}).catch(() => {});
  }
}
