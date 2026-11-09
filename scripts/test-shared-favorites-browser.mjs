import { verifyCompareActions } from './verify-compare-actions.mjs';
// Full production bundle + real Vue, hosted in a hidden iframe like ST/TT.
// PMM_BROWSER_ASSET_DIR contains vue.runtime.global.prod.js, pinia.iife.prod.js,
// lodash.min.js, zod4.mjs and jquery.min.js. No dependency downloads during tests.
// Optional PMM_THEME_CSS / PMM_COMPANION_SCRIPT load local compatibility fixtures.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifySharedFavorites } from './verify-shared-favorites.mjs';
import { verifyPanelHeight } from './verify-panel-height.mjs';
import { verifyRegexManager } from './verify-regex-manager.mjs';
import { verifyWorkshopEditing } from './verify-workshop-editing.mjs';

const playwright = await import(process.env.PMM_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PMM_PLAYWRIGHT_MODULE).href : 'playwright');
const assets = process.env.PMM_BROWSER_ASSET_DIR;
assert.ok(assets, 'Set PMM_BROWSER_ASSET_DIR to the local browser dependency fixtures');
const asset = name => readFile(resolve(assets, name), 'utf8');
const engine = process.env.PMM_BROWSER_ENGINE || 'chromium';
const source = (await readFile(process.env.PMM_WORKSHOP_SOURCE || new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8'))
  .replace(/import\{createPinia[^;]+;import\{klona[^;]+;/, 'const e=Pinia.createPinia,n=Pinia.defineStore,t=_.cloneDeep;')
  .replace('export{xo as mountMainPanel,fo as toggleMainPanel,bo as unmountMainPanel};', 'window.testOpen=fo;window.testClose=bo;window.testStores=()=>({main:Je(),merge:mn(),branch:je(),diff:Cn(),groups:ze()});');
const browser = await playwright[engine].launch(engine === 'chromium' ? { channel: 'msedge', headless: true } : { headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true,
    ...(process.env.PMM_TEST_MUTATIONS_IOS ? { userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' } : {}),
  });
  const page = await context.newPage();
  if (process.env.PMM_TEST_COMPARE) page.setDefaultTimeout(10000);
  for (const pass of [0]) {
    await page.setViewportSize({ width:390, height:844 });
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); if(process.env.PMM_TEST_COMPARE) console.error(error); });
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (process.env.PMM_TEST_RUNTIME && url.origin !== 'http://startup.test') {
        let body = '';
        if(url.pathname.includes('vue.runtime.global')) body = await asset('vue.runtime.global.prod.js') + '\n' + await asset('pinia.iife.prod.js');
        else if(url.pathname.endsWith('log.js')) body = 'window.log={info(){},warn(){},error(){},debug(){}};';
        return route.fulfill({contentType:'application/javascript',body});
      }
      if (url.origin !== 'http://startup.test') return route.abort();
      if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><head></head><body><div id="top-bar"></div><div id="extensionsMenu"></div><div id="sheld"><div id="chat"><div class="welcomePanel"><span class="welcomeHeaderVersionDisplay">TT</span></div></div></div><div id="send_form"><textarea id="send_textarea"></textarea></div></body>' });
      if (url.pathname === '/zod4.mjs') return route.fulfill({ contentType: 'application/javascript', body: await asset('zod4.mjs') });
      if(process.env.PMM_TEST_RUNTIME && url.pathname === '/workshop-v3.02.js') return route.fulfill({contentType:'application/javascript',body:source});
      if(process.env.PMM_TEST_RUNTIME && url.pathname.startsWith('/bridge/')) return route.fulfill({contentType:'application/javascript',body:await readFile(new URL('..'+url.pathname,import.meta.url),'utf8')});
      if(url.pathname === '/manifest.json') return route.fulfill({contentType:'application/json',body:await readFile(new URL('../manifest.json',import.meta.url),'utf8')});
      if (/^\/[\w.-]+\.js$/.test(url.pathname)) return route.fulfill({ contentType: 'application/javascript', body: await readFile(new URL(`../dist${url.pathname}`, import.meta.url), 'utf8') });
      return route.abort();
    });
    await page.goto('http://startup.test/?host=' + (process.env.PMM_TEST_HOST || 'tt'));
    await page.addStyleTag({ content: 'html { --SmartThemeBlurTintColor:rgba(24,32,48,.6); --SmartThemeBodyColor:rgb(232,237,244); } body { background:repeating-linear-gradient(45deg,#475569 0 12px,#8fa1b8 12px 24px); }' });
    await page.addScriptTag({ content: await asset('lodash.min.js') });
    await page.addScriptTag({ content: await asset('jquery.min.js') });
    await page.evaluate(promptCount => {
      const prompts = Array.from({ length: promptCount }, (_, i) => ({ id: `p${i}`, name: `Prompt ${i}`, enabled: true, content: 'Fixture content', role: 'system', position: { type: 'relative' } }));
      prompts[0].name = '测试条目名称：这里是原本被隐藏按钮挡住的后半段';
      let variables = {};
      window.fixtureLoads = 0;
      window.fixtureBooks = { Source: { entries: { 0: { uid: 0, comment: '世界书同名条目', content: '世界书正文', key: ['关键词'], keysecondary: ['辅助词'], constant: false, disable: false, position: 4, depth: 7, role: 2, probability: 63, custom: { x: ['keep'] } } } }, Target: { extraBookSetting: 'keep', entries: { 0: { uid: 0, comment: '已有条目', content: 'existing', order: 10 } } } };
      window.fixtureWorldLoads = 0; window.fixtureWorldWrites = 0;
      const context = { getWorldInfoNames: async () => Object.keys(fixtureBooks), loadWorldInfo: async name => { fixtureWorldLoads++; return _.cloneDeep(fixtureBooks[name]); }, saveWorldInfo: async (name, data) => { fixtureWorldWrites++; fixtureBooks[name] = _.cloneDeep(data); }, getPresetManager: () => ({ readPresetExtensionField: () => null, getSelectedPresetName: () => 'First', getCompletionPresetByName: () => ({ prompts }) }), characters: [], chat: [], eventTypes: {}, eventSource: { on() {}, off() {}, emit() {}, removeListener() {} } };
      window.SillyTavern = { getContext: () => context };
      if (location.search.includes('host=tt')) window.__TAURITAVERN__ = {};
      window.TavernHelper = {
        SillyTavern, getVariables: () => _.cloneDeep(variables), replaceVariables: next => { variables = _.cloneDeep(next); },
        updateVariablesWith: fn => { variables = fn(_.cloneDeep(variables)); },
        getScriptId: () => 'startup-fixture', getButtonEvent: name => name,
        eventOn() {}, eventRemoveListener() {}, eventEmit() {}, eventClearAll() {},
        getPresetNames: () => ['First', 'Second'], getLoadedPresetName: () => 'First',
        getPreset: () => { fixtureLoads++; return _.cloneDeep({ prompts }); },
        isPresetPlaceholderPrompt: () => false, isPresetSystemPrompt: () => false,
        tavern_events: {}, toastr: { info() {}, warning() {}, success() {}, error() {} }, YAML: {},
      };
      Object.assign(window, TavernHelper);
      localStorage.setItem('preset-manager-theme-mode', 'auto');
    }, process.env.PMM_TEST_MUTATIONS ? 400 : 8);
    if (process.env.PMM_THEME_CSS) await page.evaluate(css => {
      const style = document.createElement('style'); style.textContent = css; document.head.append(style);
    }, await readFile(process.env.PMM_THEME_CSS, 'utf8'));
    if (process.env.PMM_COMPANION_SCRIPT) {
      await page.evaluate(() => { const f = document.createElement('iframe'); f.hidden = true; document.body.append(f); });
      await page.frames().at(-1).evaluate(script => { Object.assign(window, parent.TavernHelper); (0, eval)(script); }, await readFile(process.env.PMM_COMPANION_SCRIPT, 'utf8'));
    }
    if(process.env.PMM_TEST_RUNTIME) {
      const {verifyRuntimeModes}=await import('./verify-runtime-modes.mjs');
      await verifyRuntimeModes(page, engine);
      assert.deepEqual(errors,[]); continue;
    }
    await page.evaluate(() => { const f = document.createElement('iframe'); f.hidden = true; document.body.append(f); });
    const frame = page.frames().at(-1);
    for (const file of ['vue.runtime.global.prod.js', 'pinia.iife.prod.js']) await frame.addScriptTag({ content: await asset(file) });
    await frame.evaluate(async () => {
      Object.assign(window, parent.TavernHelper);
      window.TavernHelper = parent.TavernHelper;
      window._ = parent._; window.$ = window.jQuery = parent.jQuery;
      window.z = await import('http://startup.test/zod4.mjs');
      window.log = { info() {}, warn() {}, error() {}, debug() {} };
      window.__PMM_RUNTIME_SCOPE__ = (await import('/runtime-resources.js')).createRuntimeScope(window);
    });
    if (process.env.PMM_TEST_MUTATIONS) {
      const { instrumentWorkshopMutations } = await import('./verify-workshop-mutations.mjs');
      await instrumentWorkshopMutations(page, frame);
    }
    await frame.addScriptTag({ type: 'module', url: 'http://startup.test/shared-favorites.js' });
    await frame.evaluate(() => { window.__PMM_LOAD_WORLDBOOK_STITCH__ = async () => { await import('http://startup.test/worldbook-stitch-test3.js'); return parent.__PMM_WORLDBOOK_STITCH_TEST3__; }; });
    await frame.addScriptTag({ type: 'module', content: source });
    await frame.waitForFunction(() => typeof testOpen === 'function' && parent.document.querySelector('#preset-manager-floating-panel'), null, { polling: 25 });
    if (process.env.PMM_TEST_MUTATIONS) {
      const { verifyWorkshopMutations } = await import('./verify-workshop-mutations.mjs');
      await verifyWorkshopMutations(page, frame, engine);
      assert.deepEqual(errors, []);
      continue;
    }
    // Unmount before the deferred initializer: no late load is allowed.
    await page.waitForTimeout(220);
    const loadsBeforeCancel = await page.evaluate(() => fixtureLoads);
    await frame.evaluate(() => { testOpen(); testClose(); });
    await page.waitForTimeout(220);
    assert.equal(await page.locator('#preset-manager-main-panel').count(), 0);
    assert.equal(await page.evaluate(() => fixtureLoads), loadsBeforeCancel, 'Closing immediately cancels the pending preset load');
    const before = await page.evaluate(() => fixtureLoads);
    await frame.evaluate(() => testOpen());
    await page.waitForFunction(() => document.querySelector('.preset-panel .title-select')?.value === 'First' && document.querySelectorAll('.prompt-item').length > 0, null, { polling: 25, timeout: 5000 });
    await page.waitForTimeout(250);
    assert.ok(await page.evaluate(() => fixtureLoads) > before, 'Preset data loaded after reopening');
    await page.waitForFunction(() => {
      const node = document.querySelector('.pm-panel-container');
      return node && Number(getComputedStyle(node).opacity) > .9 && node.getBoundingClientRect().height > 100;
    }, null, { polling:25, timeout:5000 });
    const visible = await page.locator('.pm-panel-container').evaluate(node => {
      const style = getComputedStyle(node), rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0.9 && rect.width > 100 && rect.height > 100;
    });
    assert.ok(visible, 'Panel must be painted, not merely present in the DOM');
    if (process.env.PMM_TEST_DND_COMPAT) {
      const {verifyDndCompat}=await import('./verify-dnd-compat.mjs');
      await verifyDndCompat(page,frame,engine);
      assert.deepEqual(errors,[]);continue;
    }
    if (process.env.PMM_TEST_TOUCH_THEME) {
      const {verifyTouchTheme}=await import('./verify-touch-theme.mjs');
      try {await verifyTouchTheme(page,frame,engine);} catch(error) {await page.screenshot({path:assets+'/touch-theme-failure-'+engine+'.png'});throw error;}
      assert.deepEqual(errors,[]);continue;
    }
    if (process.env.PMM_TEST_COMPARE) {
      try { await verifyCompareActions(page, frame, engine); } catch(error) { console.error(errors); await page.screenshot({path:assets+'/compare-failure.png'}); throw error; }
      assert.deepEqual(errors, []); continue;
    }
    if (process.env.PMM_TEST_EDITING) {
      try { await verifyWorkshopEditing(page, frame, engine); } catch (error) { console.error(errors); await page.screenshot({path: assets + "/editing-failure.png"}); throw error; }
      assert.deepEqual(errors, []);
      console.log(`${engine}: switch transfer, undo and unsaved close passed`);
      continue;
    }
    await verifyPanelHeight(page, frame);
    await verifySharedFavorites(page, frame, engine);
    if (process.env.PMM_TEST_REGEX) await verifyRegexManager(page, frame, engine);
    // Preset selection and closing still work after changing appearance.
    await page.locator('.preset-panel .title-select').first().selectOption('Second');
    assert.equal(await page.locator('.preset-panel .title-select').first().inputValue(), 'Second');
    await page.locator('.preset-panel .close-card').first().evaluate(node => node.click());
    await page.waitForFunction(() => !document.querySelector('#preset-manager-main-panel'), null, { polling: 25 });
    assert.deepEqual(errors, []);
    console.log(`${engine}/${process.env.PMM_TEST_HOST || 'tt'}: real Vue startup, preset selection, close and cancellation passed`);
    await page.unrouteAll();
    page.removeAllListeners('pageerror');
  }
} finally { await browser.close(); }
