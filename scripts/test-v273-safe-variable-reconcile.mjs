import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = (await readFile(new URL('../dist/workshop-v3.02.js', import.meta.url), 'utf8')).replace(/pmmRuntimeResource\((\w+)\)/g, '$1');

assert.ok(source.includes('function completePromptContentsInPanel(panel)'), '缺少完整预设数据读取');
assert.ok(source.includes('component.props?.prompts'), '没有优先读取面板的完整 prompts 数据');
assert.ok(source.includes("else return null;"), 'DOM 数据不完整时仍可能继续误清变量');
assert.ok(source.includes('if (pmmMutationsAffect(records, ROOT_SELECTOR)) queueScan();'), '普通折叠或滚动仍会触发变量清理');
assert.ok(source.includes("if (button && /撤销|删除/.test(label)) queueBasketReconcile();"), '撤销或删除后不会安全校准变量');
assert.ok(!source.includes('收集本条已有变量'), '旧变量整条收集入口重新出现');

const blockStart = source.indexOf('/* ===== PMM_VARIABLE_MACRO_ASSISTANT_V263');
const blockEnd = source.indexOf('\n;(()=>{\n  /* 预设工坊 V2.58', blockStart);
assert.ok(blockStart >= 0 && blockEnd > blockStart, '无法隔离变量助手运行块');

let runnable = source.slice(blockStart, blockEnd);
runnable = runnable.replace(/\}\)\(\);\s*$/, 'globalThis.__safeVariableTest = { addVariables, basketFor, reconcileBasket };\n})();');

const fakeDocument = {
  body: {},
  documentElement: {},
  head: { appendChild() {} },
  defaultView: { requestAnimationFrame(callback) { callback(); } },
  addEventListener() {},
  querySelector() { return null; },
  querySelectorAll() { return []; },
  getElementById() { return null; },
  createElement() { return { id: '', style: { setProperty() {} }, textContent: '' }; },
};
const sandbox = {
  pmmRuntimeResource: target => target,
  console,
  document: fakeDocument,
  requestAnimationFrame(callback) { callback(); },
  MutationObserver: class { observe() {} },
  setTimeout,
  clearTimeout,
};
sandbox.window = { top: { document: fakeDocument } };
sandbox.globalThis = sandbox;
vm.runInNewContext(runnable, sandbox);

const helper = sandbox.__safeVariableTest;
const prompts = [
  { id: 'new-item', name: '细描特化', content: '{{setvar::文风补丁7::细描正文}}' },
  { id: 'old-index', name: '获取变量', content: '{{setvar::文风框架::}}{{setvar::文风补丁1::}}' },
];
const panel = {
  __vueParentComponent: { props: { prompts }, parent: null },
  querySelector(selector) {
    if (selector === '.title-select') return { value: '目标预设' };
    return null;
  },
  querySelectorAll() { return []; },
};

helper.addVariables(panel, ['文风补丁7'], { quiet: true });
assert.deepEqual(Array.from(helper.basketFor(panel)), ['文风补丁7'], 'S 转换后没有立即记录新增变量');
assert.equal(helper.reconcileBasket(panel), 0, '完整数据中仍存在的变量被错误清理');
assert.deepEqual(Array.from(helper.basketFor(panel)), ['文风补丁7']);
assert.ok(!helper.basketFor(panel).includes('文风框架'), '原有变量索引被自动加入本次新增');

prompts.splice(0, 1);
assert.equal(helper.reconcileBasket(panel), 1, '撤销条目后没有移除已消失变量');
assert.deepEqual(Array.from(helper.basketFor(panel)), []);

prompts.unshift({ id: 'new-item', name: '细描特化', content: '{{setvar::文风补丁7::细描正文}}' });
assert.equal(helper.reconcileBasket(panel), 1, '恢复条目后没有恢复本次新增变量记录');
assert.deepEqual(Array.from(helper.basketFor(panel)), ['文风补丁7']);

assert.ok(source.includes('V2.73 已加载'), '缺少 v2.73 运行标记');
console.log('v2.73 安全校准测试通过：折叠不误删，撤销/恢复按完整 prompts 数据同步。');
