/* ===== PMM_GROUP_SELECT_NESTING_TEST24：分组内全选与一层工坊子分组 ===== */
;(() => {
  'use strict';

  const TOP = (() => { try { return window.top || window; } catch (_) { return window; } })();
  const DOC = (() => { try { return TOP.document || document; } catch (_) { return document; } })();
  const API_KEY = '__PMM_GROUP_SELECT_NESTING_TEST24__';
  const STYLE_ID = 'pmm-group-select-nesting-test24';
  const PANEL_SELECTOR = '#preset-manager-main-panel';
  const GROUP_SELECTOR = '.section-group[data-section-id]';
  const SELECT_CLASS = 'pmm-section-select-all';
  const SLOT_CLASS = 'pmm-nested-section-slot';

  try { TOP[API_KEY]?.cleanup?.(); } catch (_) {}

  let observer = null;
  let resizeObserver = null;
  let scheduled = 0;
  const win = DOC.defaultView || TOP;

  function directChild(element, selector) {
    return Array.from(element?.children || []).find(child => child.matches?.(selector)) || null;
  }

  function groups(root = DOC) {
    return Array.from(root.querySelectorAll?.(GROUP_SELECTOR) || []);
  }

  function groupId(group) {
    return String(group?.dataset?.sectionId || '');
  }

  function isNativeGroup(group) {
    return groupId(group).startsWith('baibai_');
  }

  function panelFor(group) {
    return group?.closest?.(PANEL_SELECTOR) || DOC.querySelector(PANEL_SELECTOR);
  }

  function multiSelectActive(group) {
    // 以条目真正进入多选布局为准。部分手机端主题虽然已经显示复选框，
    // 顶部按钮却不会保留 action-btn--active，不能只依赖按钮样式判断。
    if (group?.querySelector?.('.prompt-item--multi-select')) return true;
    const panel = panelFor(group);
    return Boolean(
      panel?.querySelector?.('.prompt-item--multi-select')
      || panel?.querySelector?.('button[title="多选模式"].action-btn--active'),
    );
  }

  function childMap(allGroups) {
    const map = new Map();
    for (const group of allGroups) {
      const parentId = String(group.dataset.parentSectionId || '');
      if (!parentId) continue;
      if (!map.has(parentId)) map.set(parentId, []);
      map.get(parentId).push(group);
    }
    return map;
  }

  function descendants(group, children, result = []) {
    for (const child of children.get(groupId(group)) || []) {
      if (result.includes(child)) continue;
      result.push(child);
      descendants(child, children, result);
    }
    return result;
  }

  function numberData(group, key) {
    const value = Number(group?.dataset?.[key]);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  }

  function aggregate(group, children, key) {
    return [group, ...descendants(group, children)].reduce((sum, item) => sum + numberData(item, key), 0);
  }

  function immediateHeader(group) {
    return directChild(group, '.section-header');
  }

  function immediateContent(group) {
    return directChild(group, '.section-content');
  }

  function dissolveButton(header) {
    return Array.from(header?.querySelectorAll?.('.section-header__actions > button') || [])
      .find(button => String(button.title || '').startsWith('解散分组')) || null;
  }

  function updateHeaderCount(group, children) {
    const count = immediateHeader(group)?.querySelector('.section-header__count');
    if (!count) return;
    const total = aggregate(group, children, 'itemCount');
    const enabled = aggregate(group, children, 'enabledCount');
    const value = isNativeGroup(group) ? `${enabled}/${total}` : String(total);
    if (count.textContent !== value) count.textContent = value;
  }

  function updateSelectButton(group, button, children) {
    const total = aggregate(group, children, 'itemCount');
    const selected = aggregate(group, children, 'selectedCount');
    const all = total > 0 && selected >= total;
    const partial = selected > 0 && !all;
    const icon = button.querySelector('i');
    if (icon.className !== 'fa-solid fa-check-double') icon.className = 'fa-solid fa-check-double';
    button.classList.toggle('pmm-section-select-all--checked', all);
    button.classList.toggle('pmm-section-select-all--partial', partial);
    button.title = all
      ? `取消选择本组（已选 ${selected}/${total}）`
      : partial ? `补选本组（已选 ${selected}/${total}）` : `选择本组全部 ${total} 条`;
    button.setAttribute('aria-label', button.title);
  }

  function createSelectButton(group, children) {
    const button = DOC.createElement('button');
    button.type = 'button';
    button.className = `section-action ${SELECT_CLASS}`;
    button.innerHTML = '<i class="fa-solid fa-check-double"></i>';
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      void toggleGroupSelection(group);
    });
    updateSelectButton(group, button, children);
    return button;
  }

  function ensureHeaderActions(group, children) {
    const header = immediateHeader(group);
    const actions = header?.querySelector('.section-header__actions');
    if (!header || !actions) return;
    const dissolve = dissolveButton(header);
    if (dissolve) dissolve.hidden = isNativeGroup(group);

    let select = actions.querySelector(`.${SELECT_CLASS}`);
    if (!multiSelectActive(group)) {
      select?.remove();
      return;
    }
    if (!select) {
      select = createSelectButton(group, children);
      if (isNativeGroup(group) && dissolve) dissolve.before(select);
      else actions.prepend(select);
    }
    updateSelectButton(group, select, children);
  }

  function directPromptCheckboxes(group) {
    const content = immediateContent(group);
    if (!content) return [];
    const result = [];
    for (const item of Array.from(content.children)) {
      if (!item.matches?.('.prompt-item')) continue;
      const checkbox = directChild(directChild(item, '.prompt-item__main'), '.prompt-item__checkbox');
      if (checkbox) result.push(checkbox);
    }
    return result;
  }

  function isCollapsed(group) {
    return group.classList.contains('section-group--collapsed') || !immediateContent(group);
  }

  function clickHeader(group) {
    immediateHeader(group)?.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
  }

  function twoFrames() {
    return new Promise(resolve => {
      const raf = win.requestAnimationFrame?.bind(win) || (callback => win.setTimeout(callback, 16));
      raf(() => raf(resolve));
    });
  }

  async function toggleGroupSelection(group) {
    const allGroups = groups(panelFor(group) || DOC);
    const children = childMap(allGroups);
    const targets = [group, ...descendants(group, children)];
    const total = targets.reduce((sum, item) => sum + numberData(item, 'itemCount'), 0);
    const selected = targets.reduce((sum, item) => sum + numberData(item, 'selectedCount'), 0);
    const shouldSelect = !(total > 0 && selected >= total);
    const collapsed = targets.filter(isCollapsed);

    for (const item of collapsed) clickHeader(item);
    if (collapsed.length) await twoFrames();

    let changed = 0;
    for (const item of targets) {
      for (const checkbox of directPromptCheckboxes(item)) {
        const checked = Boolean(checkbox.querySelector('.fa-square-check'));
        if (checked === shouldSelect) continue;
        checkbox.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
        changed++;
      }
    }

    if (changed) await twoFrames();
    for (const item of collapsed.reverse()) if (!isCollapsed(item)) clickHeader(item);
    schedule();
  }

  function promptItemById(content, promptId) {
    if (!content || !promptId) return null;
    return Array.from(content.children).find(item => (
      item.matches?.('.prompt-item')
      && String(item.querySelector('.prompt-card[data-prompt-id]')?.dataset?.promptId || '') === promptId
    )) || null;
  }

  function makeSlot(child) {
    const slot = DOC.createElement('div');
    slot.className = SLOT_CLASS;
    slot.dataset.childSectionId = groupId(child);
    slot.setAttribute('aria-hidden', 'true');
    return slot;
  }

  function findSlot(host, childId) {
    return Array.from(host.querySelectorAll(`.${SLOT_CLASS}`))
      .find(slot => String(slot.dataset.childSectionId || '') === childId) || null;
  }

  function layoutNestedGroup(child, parent, host) {
    const content = immediateContent(parent);
    let slot = findSlot(host, groupId(child));
    if (!content || parent.classList.contains('section-group--collapsed')) {
      slot?.remove();
      child.classList.toggle('pmm-nested-section--hidden', true);
      return;
    }

    if (!slot) slot = makeSlot(child);
    const before = promptItemById(content, String(child.dataset.parentBeforeItemId || ''));
    if (slot.parentElement !== content || slot.nextElementSibling !== before) content.insertBefore(slot, before);

    child.classList.toggle('pmm-nested-section--hidden', false);
    child.classList.toggle('pmm-nested-section--visual', true);
    slot.style.height = `${Math.max(52, child.getBoundingClientRect().height || 0) + 8}px`;

    const slotRect = slot.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    child.style.setProperty('--pmm-nested-top', `${slotRect.top - hostRect.top + host.scrollTop}px`);
    child.style.setProperty('--pmm-nested-left', `${slotRect.left - hostRect.left + host.scrollLeft + 6}px`);
    child.style.setProperty('--pmm-nested-width', `${Math.max(80, slotRect.width - 12)}px`);
  }

  function clearStaleSlots(host, liveChildIds) {
    for (const slot of host.querySelectorAll(`.${SLOT_CLASS}`)) {
      if (!liveChildIds.has(String(slot.dataset.childSectionId || ''))) slot.remove();
    }
  }

  function layoutNesting(allGroups) {
    // This module observes class changes. Forced toggle is a no-op when the
    // class already matches; unconditional add/remove re-queues every frame.
    const byId = new Map(allGroups.map(group => [groupId(group), group]));
    const hosts = new Set(allGroups.map(group => group.parentElement).filter(Boolean));
    const liveChildIds = new Set();

    for (const child of allGroups) {
      const parentId = String(child.dataset.parentSectionId || '');
      const parent = byId.get(parentId);
      const host = child.parentElement;
      if (!parentId || !parent || !host || parent.parentElement !== host) {
        child.classList.toggle('pmm-nested-section--visual', false);
        child.classList.toggle('pmm-nested-section--hidden', false);
        child.style.removeProperty('--pmm-nested-top');
        child.style.removeProperty('--pmm-nested-left');
        child.style.removeProperty('--pmm-nested-width');
        continue;
      }
      liveChildIds.add(groupId(child));
      host.classList.toggle('pmm-nested-section-layout', true);
      layoutNestedGroup(child, parent, host);
    }
    for (const host of hosts) clearStaleSlots(host, liveChildIds);
  }

  function scan() {
    scheduled = 0;
    const panel = DOC.querySelector(PANEL_SELECTOR);
    if (!panel) return;
    const allGroups = groups(panel);
    const children = childMap(allGroups);
    layoutNesting(allGroups);
    for (const group of allGroups) {
      ensureHeaderActions(group, children);
      updateHeaderCount(group, children);
    }
  }

  function schedule() {
    if (scheduled) return;
    const raf = win.requestAnimationFrame?.bind(win) || (callback => win.setTimeout(callback, 16));
    scheduled = raf(scan);
  }

  function installStyle() {
    DOC.getElementById(STYLE_ID)?.remove();
    const style = DOC.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
${PANEL_SELECTOR} .section-header__actions > button[hidden] { display: none !important; }
${PANEL_SELECTOR} .${SELECT_CLASS} { flex: 0 0 26px; }
${PANEL_SELECTOR} .${SELECT_CLASS} i { transition: color .18s ease, opacity .18s ease, transform .18s ease; }
${PANEL_SELECTOR} .${SELECT_CLASS}.${SELECT_CLASS}--partial i { color: var(--pm-quote-color, var(--pm-accent)); opacity: .76; }
${PANEL_SELECTOR} .${SELECT_CLASS}.${SELECT_CLASS}--checked {
  color: var(--pm-quote-color, var(--pm-accent)) !important;
  border-color: color-mix(in srgb, var(--pm-quote-color, var(--pm-accent)) 48%, transparent) !important;
  background: color-mix(in srgb, var(--pm-quote-color, var(--pm-accent)) 15%, transparent) !important;
}
${PANEL_SELECTOR} .${SELECT_CLASS}.${SELECT_CLASS}--checked i { color: var(--pm-quote-color, var(--pm-accent)); opacity: 1; transform: scale(1.04); }
${PANEL_SELECTOR} .pmm-nested-section-layout { position: relative !important; }
${PANEL_SELECTOR} .${SLOT_CLASS} { box-sizing: border-box; width: 100%; flex: 0 0 auto; pointer-events: none; }
${PANEL_SELECTOR} .section-group.pmm-nested-section--visual {
  position: absolute !important;
  z-index: 2 !important;
  top: var(--pmm-nested-top) !important;
  left: var(--pmm-nested-left) !important;
  width: var(--pmm-nested-width) !important;
  margin: 0 !important;
  box-sizing: border-box !important;
  border-style: dashed !important;
  background: color-mix(in srgb, var(--pm-card-bg, #1f2937) 90%, transparent) !important;
}
${PANEL_SELECTOR} .section-group.pmm-nested-section--visual > .section-header .section-header__icon {
  transform: scale(.9);
  opacity: .88;
}
${PANEL_SELECTOR} .section-group.pmm-nested-section--hidden { display: none !important; }
@media screen and (max-width: 768px) {
  ${PANEL_SELECTOR} .${SELECT_CLASS} { display: flex !important; opacity: 1 !important; }
}
`;
    (DOC.head || DOC.documentElement).appendChild(style);
  }

  function cleanup() {
    observer?.disconnect();
    resizeObserver?.disconnect();
    observer = null;
    resizeObserver = null;
    if (scheduled) {
      try { win.cancelAnimationFrame?.(scheduled); } catch (_) {}
      try { win.clearTimeout?.(scheduled); } catch (_) {}
      scheduled = 0;
    }
    DOC.querySelectorAll(`.${SELECT_CLASS}`).forEach(button => button.remove());
    DOC.querySelectorAll(`.${SLOT_CLASS}`).forEach(slot => slot.remove());
    for (const group of groups()) {
      group.classList.remove('pmm-nested-section--visual', 'pmm-nested-section--hidden');
      group.style.removeProperty('--pmm-nested-top');
      group.style.removeProperty('--pmm-nested-left');
      group.style.removeProperty('--pmm-nested-width');
      const dissolve = dissolveButton(immediateHeader(group));
      if (dissolve) dissolve.hidden = false;
    }
    DOC.querySelectorAll('.pmm-nested-section-layout').forEach(host => host.classList.remove('pmm-nested-section-layout'));
    DOC.getElementById(STYLE_ID)?.remove();
    win.removeEventListener('resize', schedule);
    try { if (TOP[API_KEY]?.cleanup === cleanup) delete TOP[API_KEY]; } catch (_) {}
  }

  installStyle();
  observer = new win.MutationObserver(records => {
    if (pmmMutationsAffect(records, PANEL_SELECTOR, true)) schedule();
  });
  observer.observe(DOC.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'data-selected-count', 'data-item-count', 'data-enabled-count'],
  });
  if (typeof win.ResizeObserver === 'function') {
    resizeObserver = new win.ResizeObserver(schedule);
    resizeObserver.observe(DOC.documentElement);
  }
  win.addEventListener('resize', schedule, { passive: true });
  TOP[API_KEY] = { cleanup, scan, toggleGroupSelection };
  schedule();
  console.info('[预设工坊] test.24 已加载：多选模式支持组内全选，同组连续条目可原位建立一层工坊子分组。');
})();
