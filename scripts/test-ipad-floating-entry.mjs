import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PMM_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PMM_PLAYWRIGHT_MODULE).href : 'playwright');
const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
const runtimePrelude = source.slice(0, source.indexOf('let pmmEditingContext'));
const start = source.indexOf('/* ===== PMM_FLOATING_PANEL_BATCH_V1');
const floating = runtimePrelude + source.slice(start, source.indexOf('/* ===== PMM_NATIVE_PRESET_ENTRY_TEST80', start)) + '\n//# sourceURL=pmm-floating-under-test.js';
assert.ok(start > 0);
function fn(name) {
  const start = source.indexOf(`  function ${name}(`);
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf('\n  function ', start + 1));
}
// Run the real toolbar/control functions; unrelated branch and standalone FAB UI are fixture stubs.
const controls = runtimePrelude + `(() => {
  const parentDoc=document,docs=[document],FAB_RUNTIME_TOKEN=Symbol(),FAB_VISIBILITY_KEY='pmm_mobile_fab_visible_v1';
  const isMobile=()=>innerWidth<=768;
  const makeFab=()=>{},removeFab=()=>{},ensureBranchEntryVisibilityControls=()=>{},setRuntimeButtonVisual=()=>{};
  ${['fabIsEnabled','saveFabEnabled','setFabEnabled','setFabSwitchVisual','isIPadFloatingEntry','ensureFabVisibilityControl','ensureWorkshopControls'].map(fn).join('\n')}
  window.refreshControls=()=>ensureWorkshopControls(document);
  refreshControls();
})();`;
const html = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{margin:0;font:14px sans-serif}.floating-panel-root{position:fixed;left:45%;top:50%;width:328px}
.panel-wrapper{width:328px;background:#eee}.panel-header{display:flex;align-items:center}.edge-tab{margin-left:auto;width:32px;height:32px;background:#ddd}
.panel-action,.panel-collapse{padding:4px}.panel-section{display:flex}.panel-select{width:130px}
#preset-manager-main-panel{position:absolute;left:20px;top:70px;width:350px}.theme-switch-card{display:flex;gap:8px}
</style><button id="native-entry">预设工坊（原生入口）</button>
<div id="preset-manager-floating-panel"><div class="floating-panel-root floating-mode">
<div class="panel-wrapper" style="display:none"><div class="panel-header"><div class="panel-section"><i class="fa-solid fa-sliders section-icon"></i><select class="panel-select panel-select--preset"><option>测试预设</option></select></div><button class="panel-action"><i class="fa-edit"></i>编辑</button><button class="panel-collapse">收起</button></div></div>
<div class="edge-tab"><i class="fa-chevron-left">❮</i></div></div></div>
<iframe id="runtime" style="display:none"></iframe><script>
function workshop(){if(document.querySelector('#preset-manager-main-panel'))return;const el=document.createElement('div');el.id='preset-manager-main-panel';el.innerHTML='<div class="pm-panel-container"><div class="theme-switch-card"><button class="theme-btn" title="白色模式">白</button><button class="theme-btn" title="黑色模式">黑</button></div></div>';document.body.append(el);window.refreshControls?.();}
workshop();
document.querySelector('.panel-action').onclick=workshop;
document.querySelector('#native-entry').onclick=()=>window.__PMM_FLOATING_SNAPSHOT_ENTRY_TEST69__.openWorkshopHome();
window.nativeMouse=0;document.querySelector('.edge-tab').onmousedown=()=>{nativeMouse++;document.querySelector('.panel-wrapper').style.display='flex';};
window.listenerRecords=[];window.frameRequests=0;
function monitor(view){const proto=view.EventTarget.prototype,add=proto.addEventListener,remove=proto.removeEventListener;
proto.addEventListener=function(type,fn,opt){if(/^(pointer|touch)(move|up|end|cancel)$/.test(type) && new Error().stack.includes('pmm-floating-under-test.js'))listenerRecords.push({target:this,type,fn});return add.call(this,type,fn,opt)};
proto.removeEventListener=function(type,fn,opt){listenerRecords=listenerRecords.filter(r=>r.target!==this||r.type!==type||r.fn!==fn);return remove.call(this,type,fn,opt)};
const raf=view.requestAnimationFrame;view.requestAnimationFrame=fn=>{frameRequests++;return raf.call(view,fn)};}
monitor(window);monitor(document.querySelector('iframe').contentWindow);
</script>`;
const server = createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html)});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'msedge',headless:true});
const url=`http://127.0.0.1:${server.address().port}`;
async function setup({width=820,height=1180,ua='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15',touch=true}={}) {
  const page=await browser.newPage({viewport:{width,height},userAgent:ua,hasTouch:touch});
  // Edge may expose the host touchscreen even with hasTouch:false. Pin the fixture.
  await page.addInitScript(points=>Object.defineProperty(navigator,'maxTouchPoints',{get:()=>points}),touch?5:0);
  page.errors=[];page.on('pageerror',err=>page.errors.push(err.message));
  await page.goto(url);
  await install(page);
  assert.deepEqual(page.errors,[]);
  return page;
}
async function install(page){
  await page.addScriptTag({content:controls});
  await page.frames()[1].addScriptTag({content:floating});
  await page.waitForTimeout(100);
}
const root='.floating-panel-root';
async function rect(page,selector=root){return page.locator(selector).boundingBox();}
async function idle(page){
  await page.waitForTimeout(120);
  const before=await page.evaluate(()=>frameRequests);
  await page.waitForTimeout(180);
  assert.equal(await page.evaluate(()=>frameRequests),before,'Idle floating entry must not schedule frames repeatedly');
  assert.equal(await page.evaluate(()=>listenerRecords.length),0,'No move/end listeners after gesture');
}
async function pointer(page,type,x,y,target='.edge-tab'){
  await page.locator(target).dispatchEvent(type,{pointerId:7,pointerType:'touch',isPrimary:true,button:0,clientX:x,clientY:y,bubbles:true,cancelable:true});
}
try {
  const page=await setup();
  assert.ok((await rect(page)).x>790,'Wide iPad starts at right edge despite narrow runtime iframe');
  assert.equal(await page.locator('.pmm-mobile-fab-toggle').count(),1);
  assert.equal(await page.locator('.theme-btn[title="白色模式"]').isVisible(),true,'Tablet retains desktop theme controls');
  // Include the real batch trigger: without section-icon the fixture skipped its
  // binding, hiding a class mutation that continuously rescheduled this observer.
  assert.equal(await page.locator('.section-icon').getAttribute('role'),'button');
  assert.equal(await page.locator('.section-icon').getAttribute('tabindex'),'0');
  assert.equal(await page.locator('.section-icon').getAttribute('aria-label'),'批量管理预设');
  await idle(page);
  // Real browser touch sequence (also emits pointer events) catches double binding / compatibility click issues.
  const client=await page.context().newCDPSession(page);
  let r=await rect(page,'.edge-tab');
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+8,y:r.y+20}]});
  await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:r.x-100,y:r.y+160}]});
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForTimeout(80);
  assert.equal((await rect(page)).x,0,'Touch drag docks left');
  assert.ok((await rect(page)).y>r.y+100,'Touch drag moves vertically');
  assert.equal(await page.evaluate(()=>nativeMouse),0,'Native mouse drag must not also fire');
  await idle(page);
  const saved=await page.evaluate(()=>localStorage.getItem('pmm_ipad_floating_dock_v1'));
  assert.equal(JSON.parse(saved).dock,'left');
  await page.reload();await install(page);
  assert.equal((await rect(page)).x,0,'Reload retains dock');
  await pointer(page,'pointerdown',8,600);await pointer(page,'pointermove',130,1600);await pointer(page,'pointerup',130,1600);
  await page.setViewportSize({width:1180,height:820});await page.waitForTimeout(100);
  r=await rect(page);assert.ok(r.y>=0 && r.y+r.height<=820 && r.x+r.width<=1180,'Rotation clamps entry inside viewport');
  await idle(page);
  await page.waitForTimeout(450);
  await page.locator('.edge-tab').tap();
  assert.equal(await page.locator('.panel-wrapper').isVisible(),true,'Tap still opens');
  assert.ok((await rect(page,'.panel-wrapper')).width>=320,'Wide iPad retains room for toolbar');
  await page.locator('.panel-collapse').tap();
  assert.equal(await page.locator('.panel-wrapper').isVisible(),false,'Tap collapse works');
  await pointer(page,'pointerdown',1170,400);await pointer(page,'pointercancel',1170,400);await idle(page);
  // Visibility toggle cancels any in-flight gesture, persists, and leaves native opening available.
  await pointer(page,'pointerdown',1170,400);
  await page.locator('.pmm-mobile-fab-toggle').click();await page.waitForTimeout(100);
  assert.equal(await page.locator(root).isVisible(),false);await idle(page);
  await page.evaluate(()=>document.querySelector('#preset-manager-main-panel').remove());
  await page.locator('#native-entry').click();
  assert.equal(await page.locator('.pmm-mobile-fab-toggle').isVisible(),true,'Hidden entry can be re-enabled through native entry');
  await page.reload();await install(page);
  assert.equal(await page.locator(root).isVisible(),false,'Hidden preference survives reload');
  await page.locator('.pmm-mobile-fab-toggle').click();await page.waitForTimeout(100);
  assert.equal(await page.locator(root).isVisible(),true);await idle(page);
  // Reinstall uses the same DOM: no duplicate gesture handlers or stale cleanup.
  await page.frames()[1].addScriptTag({content:floating});await page.waitForTimeout(80);
  await pointer(page,'pointerdown',810,300);
  assert.equal(await page.evaluate(()=>listenerRecords.length),3);
  await page.frames()[1].evaluate(()=>window.__PMM_FLOATING_PANEL_BATCH_CLEANUP__());
  assert.equal(await page.evaluate(()=>listenerRecords.length),0);
  await pointer(page,'pointerdown',810,300);
  assert.equal(await page.evaluate(()=>listenerRecords.length),0,'Cleanup removes start handlers too');
  assert.deepEqual(page.errors,[]);await page.close();
  for(const cfg of [
    {width:768,height:1024,ua:'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)',touch:true,adapted:true},
    {width:390,height:844,ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',touch:true,adapted:true},
    {width:1280,height:800,ua:'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',touch:false,adapted:false},
    {width:1280,height:800,ua:'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',touch:true,adapted:false},
    {width:1280,height:800,ua:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)',touch:false,adapted:false},
  ]) {
    const p=await setup(cfg);
    assert.equal(await p.locator(root).evaluate(el=>el.classList.contains('pmm-floating-mobile')),cfg.adapted,JSON.stringify(cfg));
    assert.equal(await p.locator('.pmm-mobile-fab-toggle').count(),cfg.adapted?1:0);
    if(cfg.adapted){await pointer(p,'pointerdown',cfg.width-8,300);await pointer(p,'pointermove',20,400);await pointer(p,'pointerup',20,400);assert.equal((await rect(p)).x,0);}
    else {await p.locator('.edge-tab').click();assert.equal(await p.evaluate(()=>nativeMouse),1,'Desktop retains native mouse handler');}
    await idle(p);assert.deepEqual(p.errors,[]);await p.close();
  }
  console.log('iPad floating entry passed: touch/desktop UA, iframe, rotation, persistence, visibility/native reopening, cleanup, idle, phone and desktop regressions.');
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
