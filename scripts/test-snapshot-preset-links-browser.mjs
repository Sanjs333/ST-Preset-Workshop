import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PMM_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PMM_PLAYWRIGHT_MODULE).href : 'playwright');
const names=['snapshot-backup.js','snapshot-backup-core.js','snapshot-preset-links.js','snapshot-name-dialog.js'];
const files=Object.fromEntries(await Promise.all(names.map(async name=>[name,await readFile(new URL('../dist/'+name,import.meta.url),'utf8')])));
const bundle=await readFile(new URL('../dist/workshop-v3.02.js',import.meta.url),'utf8');
files['preset.js']=bundle.slice(0,bundle.indexOf('let pmmEditingContext'))+`import { requestSnapshotName } from './snapshot-name-dialog.js';\nimport { installPresetSnapshotLinks } from './snapshot-preset-links.js';\n`+bundle.slice(bundle.indexOf('/* ===== PMM_SWITCH_SNAPSHOTS_TEST52'),bundle.indexOf('/* ===== PMM_THEMED_COMPARE_DRAG_LINE_V289'));
files['scripts/openai.js']='export const promptManager={render(){}};';
const html=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{margin:0;background:#222;color:#eee;font:14px sans-serif;--SmartThemeBodyColor:#eee;--SmartThemeBlurTintColor:#25252b;--SmartThemeBorderColor:#888}
button{color:inherit;background:transparent}body.light{--SmartThemeBodyColor:#333;--SmartThemeBlurTintColor:#f5f3f2;background:#eee;color:#333}
</style><button id="open">快照</button><button id="backup">快照备份</button><script>
window.fixture={names:['新名字','另一份预设'],selected:'新名字',writes:0,prompts:[{id:'entry',name:'条目',enabled:true}],listeners:new Map()};
const eventSource={on(t,fn){if(!fixture.listeners.has(t))fixture.listeners.set(t,new Set());fixture.listeners.get(t).add(fn)},off(t,fn){fixture.listeners.get(t)?.delete(fn)},async emit(t,v){for(const fn of fixture.listeners.get(t)||[])await fn(v)}};
window.SillyTavern={getContext:()=>({eventSource,eventTypes:{PRESET_RENAMED:'renamed',CHAT_CHANGED:'chat_changed'},characters:[],getPresetManager:()=>({getSelectedPresetName:()=>fixture.selected,getAllPresets:()=>fixture.names})})};
window.getLoadedPresetName=()=>fixture.selected;window.getPreset=()=>({prompts:structuredClone(fixture.prompts)});window.setPreset=()=>{fixture.writes++};
const snapshot=(id,name,presetName,isDefault=false)=>({id,name,presetName,isDefault,states:[{id:'entry',name:'条目',enabled:false}],groupStates:[],characters:[],chats:[]});
window.seed=()=>localStorage.setItem('pmm.switch-snapshots.v1',JSON.stringify({version:1,snapshots:[snapshot('old-default','默认','旧名字',true),snapshot('old-role','角色方案','旧名字')]}));
window.readStore=()=>JSON.parse(localStorage.getItem('pmm.switch-snapshots.v1'));
seed();
window.tickCounters={intervals:0};const originalInterval=window.setInterval;window.setInterval=(...args)=>{tickCounters.intervals++;return originalInterval(...args)};
</script><script type="module">
import './preset.js';import {openSnapshotBackup} from './snapshot-backup.js';import {createBackup,readStores} from './snapshot-backup-core.js';
document.querySelector('#open').onclick=()=>__PMM_SWITCH_SNAPSHOTS_TEST52__.open({source:'native-preset'});
document.querySelector('#backup').onclick=()=>openSnapshotBackup(window);
window.backupFixture=()=>createBackup(readStores(localStorage));window.ready=true;
</script>`;
const server=createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname.slice(1);res.setHeader('Content-Type',files[name]?'text/javascript; charset=utf-8':'text/html; charset=utf-8');res.end(files[name]||html)});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'msedge',headless:true});
const output=new URL('../../outputs/snapshot-preset-links/',import.meta.url);await mkdir(output,{recursive:true});
async function assertFits(page) {
  const g=await page.locator('.pmm-backup-panel').evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,height:r.height,w:innerWidth,h:innerHeight,scroll:document.documentElement.scrollWidth}});
  assert.ok(g.x>=0&&g.y>=0&&g.right<=g.w&&g.bottom<=g.h,JSON.stringify(g));
  assert.ok(g.height<=g.h*(g.w<=768?.6:.7)+1,'Keep existing capped dialog height');
  assert.ok(g.scroll<=g.w,'No page horizontal overflow');
}
try {
  for(const width of [360,390,820,1280]) {
    const page=await browser.newPage({viewport:{width,height:844},hasTouch:width<1000});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>window.ready);
    if(width===390)await page.evaluate(()=>document.body.classList.add('light'));
    // Current renamed preset has no default: recovery is available without first saving one.
    await page.click('#open');await page.locator('.pmm-switch-snapshot-first-default').waitFor();
    await page.evaluate(()=>document.querySelector('#backup').click());
    await page.locator('[data-recovery] summary').click();
    await page.selectOption('[data-recovery-source]','旧名字');
    assert.match(await page.locator('[data-recovery-preview]').textContent(),/将复制 2 个/);
    await assertFits(page);
    await page.locator('[data-recover]').click();
    assert.match(await page.locator('[data-status]').textContent(),/已复制 2 个/);
    assert.equal(await page.locator('[data-recover]').isDisabled(),true);
    await page.locator('[data-close]').click();
    assert.equal(await page.locator('.pmm-switch-snapshot-row').count(),1,'Recovered snapshot visible under current preset');
    assert.match(await page.locator('.pmm-switch-snapshot-meta').textContent(),/0\/1 条/);
    await page.locator('[data-pmm-snapshot-action="close"]').click();
    assert.equal(await page.evaluate(()=>fixture.writes),0,'Recovery does not save/apply native switches');

    // Reproduce original complaint: all preset rows are skipped by ID until an explicit mapping is chosen.
    const backup=await page.evaluate(()=>{seed();return backupFixture()});
    await page.click('#backup');
    await page.locator('[data-file]').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
    assert.equal(await page.locator('[data-import]').isDisabled(),true);
    assert.match(await page.locator('[data-status]').textContent(),/没有可新增/);
    assert.match(await page.locator('[data-conflicts] pre').textContent(),/预设：旧名字/);
    assert.equal(await page.locator('[data-mapping]').getAttribute('open'),'');
    await page.selectOption('[data-preset-source="旧名字"]','新名字');
    assert.match(await page.locator('[data-counts]').textContent(),/预设快照 2 个/);
    await assertFits(page);
    await page.locator('[data-preset-source="旧名字"]').scrollIntoViewIfNeeded();
    await page.screenshot({path:fileURLToPath(new URL(`mapping-${width}.png`,output))});
    await page.locator('[data-import]').click();
    assert.match(await page.locator('[data-status]').textContent(),/导入完成：预设快照 2 个/);
    const imported=await page.evaluate(()=>readStore());
    assert.equal(imported.snapshots.filter(s=>s.presetName==='旧名字').length,2);
    assert.equal(imported.snapshots.filter(s=>s.presetName==='新名字').length,2);
    assert.equal(await page.evaluate(()=>fixture.writes),0);
    await page.locator('[data-close]').click();
    // Real successful rename event updates list, all runtime references and currently opened snapshot header.
    await page.evaluate(()=>{fixture.selected='旧名字';fixture.names=['旧名字','另一个'];__PMM_SWITCH_SNAPSHOTS_TEST52__.open({source:'native-preset'});});
    await page.evaluate(async()=>{fixture.selected='改名成功';fixture.names=['改名成功','另一个'];await SillyTavern.getContext().eventSource.emit('renamed',{apiId:'openai',oldName:'旧名字',newName:'改名成功'});});
    assert.match(await page.locator('.pmm-switch-snapshot-head p').textContent(),/改名成功/);
    assert.equal(await page.locator('.pmm-switch-snapshot-row').count(),1);
    assert.equal(await page.evaluate(()=>readStore().snapshots.filter(s=>s.presetName==='旧名字').length),0);
    assert.equal(await page.evaluate(()=>fixture.listeners.get('renamed').size),1);
    assert.equal(await page.evaluate(()=>tickCounters.intervals),0,'No polling added');
    await page.evaluate(()=>__PMM_SWITCH_SNAPSHOTS_TEST52__.cleanup());
    assert.equal(await page.evaluate(()=>fixture.listeners.get('renamed').size),0);
    assert.deepEqual(errors,[]);await page.close();
  }
  console.log('Snapshot relink browser passed: missing-default recovery, mapped duplicate import, rename visible state, no native writes, 360/390/820/1280 viewport, no polling and cleanup.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
