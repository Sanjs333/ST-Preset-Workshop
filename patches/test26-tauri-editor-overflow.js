/* ===== PMM_TAURI_EDITOR_OVERFLOW_TEST28：Tauri iOS 展开编辑器防溢出 ===== */
;(() => {
  'use strict';

  const TOP = (() => { try { return window.top || window; } catch (_) { return window; } })();
  const DOC = (() => { try { return TOP.document || document; } catch (_) { return document; } })();
  function hasTauriRuntime() {
    for (const scope of [TOP, window]) {
      try {
        if (
          scope?.__TAURI_RUNNING__ === true
          || scope?.__TAURITAVERN__
          || scope?.__TAURI_INTERNALS__
        ) return true;
      } catch (_) {}
    }
    return false;
  }
  const ua = String(TOP.navigator?.userAgent || '');
  const platform = String(TOP.navigator?.userAgentData?.platform || TOP.navigator?.platform || '');
  const isIOS = /iPad|iPhone|iPod/i.test(ua) || (/Mac/i.test(platform) && Number(TOP.navigator?.maxTouchPoints || 0) > 1);
  const tauriDetected = hasTauriRuntime();
  if (!tauriDetected || !isIOS) return;

  const API_KEY = '__PMM_TAURI_EDITOR_OVERFLOW_TEST26__';
  const STYLE_ID = 'pmm-tauri-editor-overflow-test26';
  const ROOT_CLASS = 'pmm-tauri-ios-editor-fix';
  const COMPACT_CLASS = 'pmm-content-header--compact';
  const PANEL_SELECTOR = '#preset-manager-main-panel';
  const HEADER_SELECTOR = `${PANEL_SELECTOR} .prompt-editor__content-header`;

  try { TOP[API_KEY]?.cleanup?.(); } catch (_) {}

  const win = DOC.defaultView || TOP;
  let mutationObserver = null;
  let resizeObserver = null;
  let scheduledFrame = 0;
  const observedHeaders = new Set();

  function installStyle() {
    DOC.getElementById(STYLE_ID)?.remove();
    const style = pmmRuntimeResource(DOC).createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
html.${ROOT_CLASS} ${PANEL_SELECTOR} .prompt-editor {
  box-sizing: border-box !important;
  width: calc(100% - 20px) !important;
  max-width: calc(100% - 20px) !important;
  min-width: 0 !important;
  align-self: flex-start !important;
  margin-left: 0 !important;
  margin-right: 20px !important;
  overflow: hidden !important;
}
html.${ROOT_CLASS} ${PANEL_SELECTOR} .prompt-editor__header-row,
html.${ROOT_CLASS} ${PANEL_SELECTOR} .prompt-editor__name-group,
html.${ROOT_CLASS} ${PANEL_SELECTOR} .prompt-editor__position-group,
html.${ROOT_CLASS} ${PANEL_SELECTOR} .prompt-editor__content-section,
html.${ROOT_CLASS} ${PANEL_SELECTOR} .prompt-editor__content-header,
html.${ROOT_CLASS} ${PANEL_SELECTOR} .inline-editor-container,
html.${ROOT_CLASS} ${PANEL_SELECTOR} .inline-editor-inner,
html.${ROOT_CLASS} ${PANEL_SELECTOR} .prompt-item--expanded,
html.${ROOT_CLASS} ${PANEL_SELECTOR} .prompt-item--expanded .prompt-item__main,
html.${ROOT_CLASS} ${PANEL_SELECTOR} .prompt-item--expanded .prompt-card {
  box-sizing: border-box !important;
  min-width: 0 !important;
  max-width: 100% !important;
}
html.${ROOT_CLASS} ${PANEL_SELECTOR} .prompt-editor__header-row {
  width: 100% !important;
  overflow-x: hidden !important;
}
html.${ROOT_CLASS} ${PANEL_SELECTOR} .prompt-editor__name-group {
  flex: 1 1 100% !important;
  width: 100% !important;
}
html.${ROOT_CLASS} ${PANEL_SELECTOR} .prompt-editor__position-group {
  flex: 0 1 auto !important;
  width: auto !important;
  flex-wrap: wrap !important;
}
html.${ROOT_CLASS} ${PANEL_SELECTOR} .prompt-editor__name-input {
  box-sizing: border-box !important;
  flex: 1 1 0 !important;
  width: auto !important;
  min-width: 0 !important;
  max-width: 100% !important;
}
html.${ROOT_CLASS} ${PANEL_SELECTOR} .prompt-editor__content-section,
html.${ROOT_CLASS} ${PANEL_SELECTOR} .prompt-editor__content-header {
  width: 100% !important;
  overflow-x: hidden !important;
}
html.${ROOT_CLASS} ${PANEL_SELECTOR} .prompt-editor__textarea {
  box-sizing: border-box !important;
  display: block !important;
  width: 100% !important;
  max-width: 100% !important;
  min-width: 0 !important;
  margin-left: 0 !important;
  margin-right: 0 !important;
  white-space: pre-wrap !important;
  overflow-wrap: anywhere !important;
  word-break: break-word !important;
  overflow-x: hidden !important;
}
html.${ROOT_CLASS} ${PANEL_SELECTOR} .inline-editor-container,
html.${ROOT_CLASS} ${PANEL_SELECTOR} .inline-editor-inner {
  width: 100% !important;
  overflow-x: hidden !important;
}
html.${ROOT_CLASS} ${PANEL_SELECTOR} .${COMPACT_CLASS} {
  display: grid !important;
  grid-template-columns: auto auto minmax(0, 1fr) auto !important;
  grid-template-areas:
    "label-icon label tools tools"
    ". . count expand" !important;
  align-items: center !important;
  column-gap: 5px !important;
  row-gap: 3px !important;
}
html.${ROOT_CLASS} ${PANEL_SELECTOR} .${COMPACT_CLASS} > .prompt-editor__label-icon { grid-area: label-icon; }
html.${ROOT_CLASS} ${PANEL_SELECTOR} .${COMPACT_CLASS} > .prompt-editor__label { grid-area: label; }
html.${ROOT_CLASS} ${PANEL_SELECTOR} .${COMPACT_CLASS} > .pmm-variable-tools {
  grid-area: tools;
  justify-self: start;
  margin-left: 0 !important;
  min-width: 0 !important;
}
html.${ROOT_CLASS} ${PANEL_SELECTOR} .${COMPACT_CLASS} > .prompt-editor__char-count {
  grid-area: count;
  justify-self: end;
  margin-left: 0 !important;
  min-width: 0 !important;
  white-space: nowrap !important;
}
html.${ROOT_CLASS} ${PANEL_SELECTOR} .${COMPACT_CLASS} > .prompt-editor__expand-btn {
  grid-area: expand;
  justify-self: end;
  flex: 0 0 24px !important;
}
`;
    (pmmRuntimeResource(DOC.head || DOC.documentElement)).appendChild(style);
  }

  function pixels(value) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function intrinsicWidth(element) {
    const style = win.getComputedStyle(element);
    const rectWidth = element.getBoundingClientRect?.().width || 0;
    return Math.max(element.scrollWidth || 0, rectWidth)
      + pixels(style.marginLeft)
      + pixels(style.marginRight);
  }

  function needsCompactLayout(header) {
    const children = Array.from(header.children || []).filter(element => {
      const style = win.getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
    if (!children.length) return false;

    const style = win.getComputedStyle(header);
    const originalGap = 8;
    const requiredWidth = children.reduce((sum, element) => sum + intrinsicWidth(element), 0)
      + originalGap * Math.max(0, children.length - 1)
      + pixels(style.paddingLeft)
      + pixels(style.paddingRight);
    return requiredWidth > header.clientWidth + 1;
  }

  function updateHeader(header) {
    if (!header?.isConnected) return;
    header.classList.toggle(COMPACT_CLASS, needsCompactLayout(header));
  }

  function scan() {
    scheduledFrame = 0;
    const headers = Array.from(DOC.querySelectorAll(HEADER_SELECTOR));
    for (const header of headers) {
      if (!observedHeaders.has(header)) {
        observedHeaders.add(header);
        pmmRuntimeResource(resizeObserver)?.observe?.(header);
      }
      for (const child of header.children || []) pmmRuntimeResource(resizeObserver)?.observe?.(child);
      updateHeader(header);
    }
    for (const header of Array.from(observedHeaders)) {
      if (header.isConnected) continue;
      resizeObserver?.unobserve?.(header);
      observedHeaders.delete(header);
    }
  }

  function schedule() {
    if (scheduledFrame) return;
    scheduledFrame = pmmRuntimeResource(win).requestAnimationFrame(scan);
  }

  function onResize() {
    schedule();
  }

  function cleanup() {
    if (scheduledFrame) pmmRuntimeResource(win).cancelAnimationFrame(scheduledFrame);
    scheduledFrame = 0;
    pmmRuntimeResource(mutationObserver)?.disconnect?.();
    pmmRuntimeResource(resizeObserver)?.disconnect?.();
    mutationObserver = null;
    resizeObserver = null;
    observedHeaders.clear();
    pmmRuntimeResource(TOP).removeEventListener?.('resize', onResize);
    pmmRuntimeResource(TOP).removeEventListener?.('orientationchange', onResize);
    DOC.querySelectorAll(`.${COMPACT_CLASS}`).forEach(element => element.classList.remove(COMPACT_CLASS));
    DOC.documentElement.classList.remove(ROOT_CLASS);
    DOC.getElementById(STYLE_ID)?.remove();
    try { if (TOP[API_KEY]?.cleanup === cleanup) delete TOP[API_KEY]; } catch (_) {}
  }

  DOC.documentElement.classList.add(ROOT_CLASS);
  installStyle();
  resizeObserver = typeof win.ResizeObserver === 'function'
    ? new win.ResizeObserver(schedule)
    : null;
  mutationObserver = new win.MutationObserver(records => {
    if (pmmMutationsAffect(records, PANEL_SELECTOR, true)) schedule();
  });
  pmmRuntimeResource(mutationObserver).observe(DOC.documentElement, { childList: true, subtree: true, characterData: true });
  pmmRuntimeResource(TOP).addEventListener?.('resize', onResize);
  pmmRuntimeResource(TOP).addEventListener?.('orientationchange', onResize);
  scan();

  TOP[API_KEY] = { cleanup, scan, needsCompactLayout, isIOS: true };
  console.info('[预设工坊] test.28 已加载：Tauri iOS 展开条目的真实过渡容器已纳入防裁切与按需工具栏换行。');
})();
