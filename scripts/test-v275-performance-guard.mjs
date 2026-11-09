import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = (await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8')).replace(/pmmRuntimeResource\((\w+)\)/g, '$1');
const entry = await readFile(new URL('../dist/index.js', import.meta.url), 'utf8');
const marker = '/* ===== PMM_MOBILE_PERFORMANCE_GUARD_V275';
const nextMarker = '/* ===== PMM_VARIABLE_MACRO_ASSISTANT_V263';
const start = source.indexOf(marker);
const end = source.indexOf(nextMarker, start);

assert.ok(start >= 0 && end > start, '缺少 v2.75 性能保护模块');
assert.ok(source.includes("listen(DOC, 'scroll', onScroll, { capture: true, passive: true })"), '滚动监听没有使用被动捕获模式');
assert.ok(source.includes('.pmm-perf-busy .prompt-item'), '忙碌期间没有关闭卡片重绘特效');
assert.ok(source.includes('content-visibility: auto'), '移动端折叠条目没有启用离屏渲染');
assert.ok(source.includes(':not(.prompt-item--expanded):not(.prompt-item--editing):not(.prompt-item--dragging)'), '离屏渲染没有避开编辑和拖拽中的条目');
assert.ok(source.includes("guard.noteDeferredScan?.('variable-editor')"), 'S/G 编辑器扫描没有避开滚动和拖拽峰值');
assert.ok(source.includes("guard.noteDeferredScan?.('variable-basket')"), '变量清单核对没有避开滚动和拖拽峰值');
assert.ok(source.includes("guard.noteDeferredScan?.('mobile-dom')"), '移动端入口与工具扫描没有避开滚动和拖拽峰值');
assert.ok(source.includes('const mo = new MutationObserver(records =>') && source.includes(".pmm-content-diff-overlay')) requestScan();"), '移动端 DOM 变化必须先过滤相关节点，再安排扫描');
assert.ok(source.includes('if (performanceGuard()?.isBusy?.())'), '延迟后的变量核对没有再次确认忙碌状态');
assert.ok(source.includes('V2.75 已加载'), '缺少 v2.75 业务加载标记');

assert.ok(entry.includes('VERSION_CHECK_INTERVAL = 30_000'), '扩展版本轮询仍然过于频繁');
assert.ok(entry.includes("document.visibilityState === 'hidden'"), '页面进入后台时没有暂停版本检查');
assert.ok(entry.includes("markReloadReason?.('extension-update')"), '扩展主动刷新前没有记录原因');
assert.ok(entry.includes("document.addEventListener('visibilitychange', handleVisibilityChange)"), '回到前台后不会立即补做版本检查');

const listeners = new Map();
const rootClasses = new Set();
const scrollTarget = {};
const root = {
  isConnected: true,
  contains: target => target === scrollTarget,
  classList: {
    toggle(name, enabled) {
      if (enabled) rootClasses.add(name);
      else rootClasses.delete(name);
    },
  },
};
const documentElement = { appendChild() {} };
const body = {};
let injectedStyle = null;
const fakeDocument = {
  head: { appendChild(node) { injectedStyle = node; } },
  body,
  documentElement,
  defaultView: null,
  querySelector: selector => selector === '#preset-manager-main-panel' ? root : null,
  getElementById: id => injectedStyle?.id === id ? injectedStyle : null,
  createElement: tag => ({ tagName: tag.toUpperCase(), id: '', textContent: '' }),
  addEventListener(type, handler) { listeners.set(type, handler); },
  removeEventListener(type, handler) { if (listeners.get(type) === handler) listeners.delete(type); },
};
const session = new Map();
class FakePerformanceObserver {
  constructor(callback) { this.callback = callback; }
  observe() {}
  disconnect() {}
}
const fakeWindow = {
  document: fakeDocument,
  setTimeout,
  clearTimeout,
  queueMicrotask,
  requestIdleCallback: callback => setTimeout(callback, 0),
  addEventListener(type, handler) { listeners.set(`window:${type}`, handler); },
  removeEventListener(type, handler) { if (listeners.get(`window:${type}`) === handler) listeners.delete(`window:${type}`); },
  sessionStorage: {
    getItem: key => session.get(key) ?? null,
    setItem: (key, value) => session.set(key, value),
    removeItem: key => session.delete(key),
  },
  performance: { getEntriesByType: () => [{ type: 'navigate' }] },
  PerformanceObserver: FakePerformanceObserver,
};
fakeWindow.top = fakeWindow;
fakeDocument.defaultView = fakeWindow;

const context = {
  pmmRuntimeResource: target => target,
  window: fakeWindow,
  document: fakeDocument,
  console: { info() {}, warn() {}, error() {} },
  setTimeout,
  clearTimeout,
  queueMicrotask,
  Promise,
};
vm.runInNewContext(source.slice(start, end), context, { filename: 'performance-guard-v275.js' });

const api = fakeWindow.__PMM_PERFORMANCE_GUARD_V275__;
assert.ok(api && typeof api.snapshot === 'function', '性能保护 API 没有挂到顶层页面');
assert.ok(injectedStyle?.textContent.includes('content-visibility: auto'), '性能保护样式没有注入');

listeners.get('scroll')({ target: scrollTarget });
assert.equal(api.isBusy(), true, '滚动开始后没有进入忙碌状态');
assert.ok(rootClasses.has('pmm-perf-scrolling'), '滚动状态类没有加到工坊根节点');
let idleRan = false;
api.noteDeferredScan('test');
api.whenIdle(() => { idleRan = true; });
await new Promise(resolve => setTimeout(resolve, 230));
assert.equal(api.isBusy(), false, '滚动停止后没有退出忙碌状态');
assert.equal(idleRan, true, '滚动结束后没有执行延后的任务');
assert.equal(api.snapshot().deferredScans.test, 1, '本地诊断没有记录延后的扫描');

listeners.get('dragstart')({ target: scrollTarget });
assert.equal(api.isBusy(), true, '拖拽开始后没有进入忙碌状态');
listeners.get('dragend')({ target: scrollTarget });
assert.equal(api.isBusy(), false, '拖拽结束后没有恢复空闲状态');

api.markReloadReason('extension-update');
assert.ok(session.get('pmm-performance-reload-reason-v275')?.includes('extension-update'), '主动刷新原因没有写入本地会话');
api.cleanup();

console.log('v2.75 性能保护测试通过：滚动、拖拽和变量扫描会错峰，移动端折叠条目按需绘制。');
