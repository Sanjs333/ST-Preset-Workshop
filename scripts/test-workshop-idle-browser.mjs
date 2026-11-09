import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PMM_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PMM_PLAYWRIGHT_MODULE).href : 'playwright');
const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
const runtimePrelude = source.slice(0, source.indexOf('let pmmEditingContext'));
function moduleBetween(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a); return runtimePrelude + source.slice(a, b);
}
const nesting = moduleBetween('/* ===== PMM_GROUP_SELECT_NESTING_TEST24', '/* ===== PMM_TAURI_EDITOR_OVERFLOW_TEST28');
const tuner = moduleBetween('/* ===== PMM_MOBILE_LAYOUT_TUNER_V1', '/* ===== PMM_FLOATING_PANEL_BATCH_V1');
const browser = await chromium.launch({ channel:'msedge', headless:true });
try {
  const page = await browser.newPage({viewport:{width:390,height:844}});
  await page.route('http://workshop.test/**', route=>route.fulfill({contentType:'text/html',body:'<!doctype html><body></body>'}));
  await page.goto('http://workshop.test/');
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.evaluate(() => {
    window.framesRun=0;
    const raf=window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame=callback=>raf(time=>{window.framesRun++;callback(time)});
    window.pmmTopNotificationsEnabled=()=>true;
    window.pmmSetTopNotificationsEnabled=()=>true;
    window.mountGroups=()=>{
      document.querySelector('#groups').innerHTML=Array.from({length:40},(_,i)=>`<div class="section-group section-group--collapsed" data-section-id="baibai_${i}" data-item-count="10" data-enabled-count="5" data-selected-count="0"><div class="section-header"><span class="section-header__count">5/10</span><div class="section-header__actions"><button title="解散分组">删除</button></div></div><div class="section-content" hidden>${'<div class="prompt-item">条目</div>'.repeat(10)}</div></div>`).join('');
    };
    document.body.innerHTML='<div id="preset-manager-main-panel"><div class="pm-panel-container"><div class="pm-main-wrapper"><div class="preset-panel"><header class="pm-header"><div class="header-left"><div class="title-card"><div class="title-row"><select class="title-select"><option>预设</option></select></div></div></div><div class="header-right"><button class="action-card">☰</button><div class="theme-switch-card"><button class="theme-btn">☾</button><button class="pmm-mobile-fab-toggle theme-btn">◉</button></div><button class="action-card">✓</button><button class="close-card" title="关闭">×</button></div></header><div id="groups"></div></div><div class="side-panel-root"><div class="side-panel-content"><div class="panel-buttons"></div></div></div></div></div></div>';
    mountGroups();
  });
  await page.addScriptTag({content:nesting});
  async function settled(label) {
    await page.waitForTimeout(1500);
    const before=await page.evaluate(()=>framesRun);
    await page.waitForTimeout(500);
    const count=await page.evaluate(()=>framesRun)-before;
    console.log(`${label}: ${count} animation-frame callbacks during 500ms idle`);
    assert.ok(count<=2, `${label}: unchanged DOM must not trigger a continuous scan loop (${count})`);
    assert.deepEqual(errors,[]);
  }
  await settled('40 collapsed groups');
  await page.addScriptTag({content:tuner});
  await settled('mobile header and group observers together');
  await page.locator('.pmm-layout-trigger').click();
  await settled('layout settings open');
  assert.equal(await page.locator('[data-pmm-layout-input="toolbarGap"]').count(),1);
  const gap=page.locator('[data-pmm-layout-input="toolbarGap"]');
  await gap.fill('12');await gap.dispatchEvent('input');
  await settled('toolbar spacing changed');
  const sizes=await page.evaluate(()=>({
    toolbar:getComputedStyle(document.querySelector('.header-right')).columnGap,
    theme:getComputedStyle(document.querySelector('.theme-switch-card')).columnGap,
    persisted:JSON.parse(localStorage.getItem('pmm_mobile_layout_shared_v2')).mobile.values.toolbarGap,
  }));
  assert.equal(sizes.toolbar,'12px');assert.notEqual(sizes.theme,'12px');assert.equal(sizes.persisted,12);
  await page.locator('[data-pmm-layout-done]').click();
  await page.addScriptTag({content:tuner});
  await settled('layout runtime reopened with saved spacing');
  assert.equal(await page.locator('.header-right').evaluate(node=>getComputedStyle(node).columnGap),'12px');
  await page.locator('.pmm-layout-trigger').click();
  for (const value of ['0','16']) {
    const control=page.locator('[data-pmm-layout-input="toolbarGap"]');
    await control.fill(value);await control.dispatchEvent('input');
    assert.equal(await page.locator('.header-right').evaluate(node=>getComputedStyle(node).columnGap),value+'px');
  }
  await page.locator('[data-pmm-layout-reset]').click();
  assert.equal(await page.locator('.header-right').evaluate(node=>getComputedStyle(node).columnGap),'1px');
  await page.locator('[data-pmm-layout-done]').click();
  await page.evaluate(()=>{mountGroups();});
  await settled('switch to another 400-entry preset');
  await page.evaluate(()=>{document.querySelector('.section-group').dataset.enabledCount='7'});
  await settled('group state change');
  assert.equal(await page.locator('.section-header__count').first().textContent(),'7/10');
  await page.evaluate(()=>{
    const first=document.querySelector('.section-group');
    first.classList.remove('section-group--collapsed');first.querySelector('.section-content').hidden=false;
    document.querySelectorAll('.prompt-item').forEach(node=>node.classList.add('prompt-item--multi-select'));
    const child=document.querySelectorAll('.section-group')[1]; child.dataset.parentSectionId=first.dataset.sectionId;
  });
  await settled('expanded nested group and multi-select');
  assert.ok(await page.locator('.pmm-section-select-all').count()>0);
  await page.evaluate(()=>{
    window.__PMM_MOBILE_LAYOUT_TUNER_CLEANUP__();
    window.__PMM_GROUP_SELECT_NESTING_TEST24__.cleanup();
  });
  await settled('cleanup');
  console.log('Idle and mobile spacing regressions passed.');
} finally {await browser.close();}
