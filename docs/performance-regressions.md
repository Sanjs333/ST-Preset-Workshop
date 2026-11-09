# DOM 扫描的性能回归

完整模式包含多个独立的 UI 增强模块。它们需要发现被 Vue 或酒馆重新挂载的工坊节点，但不应因聊天流式输出或其他扩展更新而反复扫描整个工坊。

## 实现边界

`workshop-v3.02.js` 的 `pmmMutationsAffect()` 过滤移动入口、变量编辑器、布局调节、悬浮入口、分组、iOS 编辑器布局和桌面尺寸控制的 7 处全页观察器回调。

保留以下相关变化：

- 模块所属根节点内的变更，包括编辑器的文字变化。
- 根节点或包含根节点的包装器被新增、移除或重新挂载。
- 实际包含相关 UI 的 document 上，原本已监听的 html/body 主题类名和样式变化；其他 iframe 的全局样式变化不属于该 UI。
- 悬浮预设下拉框依赖的原生 OpenAI 预设列表更新。

过滤只决定是否安排原有回调，不改变回调中的业务逻辑、拖拽、保存接口、资源作用域或主题订阅。1200ms 恢复扫描仍保留，以减少对入口重挂载兼容性的影响。此改动不是一次全面的观察器生命周期重构。

`patches/test24-group-select-nesting.js` 和 `patches/test26-tauri-editor-overflow.js` 同步保留过滤，避免重建对应补丁时覆盖修复。

## 检查

不需要浏览器依赖的单元检查已加入 `npm run check`：

```sh
npm run test:mutation-filter
```

它覆盖无关聊天、文字节点、批量记录、包装器新增/移除、继承主题属性、无关 iframe 和跨 realm 节点。

完整业务包浏览器检查：

```sh
npm run test:workshop-mutations-browser
npm run test:workshop-idle
npm run test:ipad-floating-entry
```

浏览器测试沿用已有夹具：需要 Playwright（默认 Chromium 使用本地 Microsoft Edge），以及 `PMM_BROWSER_ASSET_DIR` 中的 `vue.runtime.global.prod.js`、`pinia.iife.prod.js`、`lodash.min.js`、`jquery.min.js` 和 `zod4.mjs`。若 Playwright 不在项目的模块搜索路径中，可设置 `PMM_PLAYWRIGHT_MODULE` 指向其 `index.mjs`。测试过程中不会下载依赖。

设置 `PMM_BROWSER_ENGINE=webkit`、`PMM_TEST_MUTATIONS_IOS=1`，可用已安装的 Playwright WebKit 执行同一性能回归，并启用 iPhone UA 对应的 iOS 布局分支。这不替代真实 iPhone/iPad 浏览器和 Tauri 客户端验证。

完整包测试预置 500 条聊天、400 条预设条目和两个同源兄弟 iframe。390px/1440px 下分别检查未打开、打开和使用后关闭的状态，持续 1.5 秒更新消息 HTML、其他扩展节点的文字/class/style、兄弟 iframe 的文字和 body 样式。

断言关注实际帧回调数量，而不是特定机器的 CPU 时间或 FPS；允许少量初始化和 1200ms 兜底任务，但拒绝持续随无关更新安排整模块扫描。另验证原生预设列表增删、浮窗包装器重挂载、魔法棒菜单替换、可见工坊的主题样式与实际布局面板配色、重新打开以及完整 runtime 释放。

修复后的原有浏览器回归仍需配合运行，尤其是编辑与未保存关闭、收藏/正则、正文对比、拖拽、快照、主题及完整/快照模式切换。发版前建议再做手机实机验证。
