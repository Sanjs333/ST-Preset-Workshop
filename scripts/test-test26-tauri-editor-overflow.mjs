import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8');
const runtime = await readFile(new URL('../patches/test26-tauri-editor-overflow.js', import.meta.url), 'utf8');

assert.ok(source.includes(runtime.trim()), 'test.28 Tauri iOS 防溢出补丁没有进入业务入口');
assert.ok(runtime.includes('PMM_TAURI_EDITOR_OVERFLOW_TEST28'), '缺少 test.28 运行标记');

const tauriRead = runtime.indexOf('scope?.__TAURI_RUNNING__ === true');
const hardGuard = runtime.indexOf('if (!tauriDetected || !isIOS) return;');
const styleInstall = runtime.indexOf('function installStyle()');
assert.ok(tauriRead >= 0 && hardGuard > tauriRead && styleInstall > hardGuard, '必须在安装任何样式与监听前硬隔离非 Tauri iOS 环境');
assert.ok(runtime.includes('/iPad|iPhone|iPod/i.test(ua)'), '缺少 Tauri iOS 平台识别');
assert.ok(runtime.includes('scope?.__TAURITAVERN__'), '必须兼容完整平台 ABI 标记');
assert.ok(runtime.includes('for (const scope of [TOP, window])'), '必须同时识别顶层窗口与脚本当前窗口');

for (const marker of [
  'html.${ROOT_CLASS} ${PANEL_SELECTOR} .prompt-editor',
  'width: calc(100% - 20px) !important',
  'margin-right: 20px !important',
  'white-space: pre-wrap !important',
  'overflow-wrap: anywhere !important',
  'word-break: break-word !important',
  'overflow-x: hidden !important',
  '.inline-editor-inner',
  '.prompt-item--expanded .prompt-item__main',
  '.prompt-item--expanded .prompt-card',
  'grid-template-areas:',
  '"label-icon label tools tools"',
  '". . count expand" !important',
  'element.scrollWidth',
  'header.clientWidth + 1',
  'new win.ResizeObserver(schedule)',
  'if (pmmMutationsAffect(records, PANEL_SELECTOR, true)) schedule();',
]) {
  assert.ok(runtime.includes(marker), `test.28 缺少实现：${marker}`);
}

assert.ok(runtime.includes("header.classList.toggle(COMPACT_CLASS, needsCompactLayout(header))"), '字符数与全屏键必须只在真实放不下时换行');
assert.ok(runtime.includes("DOC.documentElement.classList.remove(ROOT_CLASS)"), '清理时必须移除 Tauri iOS 专用根样式');
assert.ok(runtime.includes('test.28 已加载：Tauri iOS 展开条目的真实过渡容器'), '缺少 test.28 加载标记');

console.log('test.28 回归通过：早期 Tauri 标记可启动补丁，真实展开过渡容器不再把编辑器撑出可见区域。');
