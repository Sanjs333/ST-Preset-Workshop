import assert from 'node:assert/strict';

// Measure callbacks, not wall-clock CPU/FPS: keep the regression hardware-independent.
export async function instrumentWorkshopMutations(page, frame) {
  await page.evaluate(() => {
    document.querySelector('#chat').innerHTML = Array.from({ length:500 }, (_, i) =>
      `<div class="mes"><div class="mes_text"><p>History ${i}</p></div></div>`).join('');
    document.body.insertAdjacentHTML('beforeend', '<div id="mutation-other-plugin"></div><div><button id="update_oai_preset">Save preset</button></div>');
    // The floating picker also depends on the native preset list, not only its UI.
    window.pmmMutationPresetNames = ['First', 'Second'];
    const context = SillyTavern.getContext(), getManager = context.getPresetManager;
    context.getPresetManager = (...args) => ({ ...getManager(...args), getAllPresets:()=>pmmMutationPresetNames });
    document.body.insertAdjacentHTML('beforeend', '<select id="settings_preset_openai" data-preset-manager-for="openai"><option>First</option><option>Second</option></select>');
    for (let n = 0; n < 2; n++) {
      const sibling = document.createElement('iframe'); sibling.hidden = true;
      sibling.dataset.mutationSibling = ''; document.body.append(sibling);
      sibling.contentDocument.body.innerHTML = '<div id="sibling-output">Other iframe</div>';
    }
  });
  for (const realm of [page, frame]) await realm.evaluate(() => {
    const request = window.requestAnimationFrame.bind(window);
    window.pmmMutationTestFrames = 0;
    window.requestAnimationFrame = callback => request(time => {
      window.pmmMutationTestFrames++;
      callback.call(window, time);
    });
  });
}

export async function verifyWorkshopMutations(page, frame, engine) {
  const counts = async () => Promise.all([page, frame].map(realm => realm.evaluate(() => pmmMutationTestFrames)));
  async function stream(label) {
    // Let mount/resize transitions settle; the retained 1200ms recovery scan may run.
    await page.waitForTimeout(1500);
    const before = await counts();
    const updates = await page.evaluate(() => new Promise(resolve => {
      const message = document.querySelector('#chat .mes:last-child .mes_text');
      const other = document.getElementById('mutation-other-plugin');
      const siblings = Array.from(document.querySelectorAll('iframe[data-mutation-sibling]'));
      let ticks = 0;
      const timer = setInterval(() => {
        message.innerHTML = `<p>Streaming token ${++ticks}</p>`;
        other.textContent = `Other plugin ${ticks}`;
        other.classList.toggle('busy', ticks % 2 === 0);
        other.style.setProperty('--other-progress', String(ticks));
        for (const sibling of siblings) {
          sibling.contentDocument.getElementById('sibling-output').textContent = `Other iframe ${ticks}`;
          sibling.contentDocument.body.style.setProperty('--other-progress', String(ticks));
        }
      }, 16);
      setTimeout(() => { clearInterval(timer); resolve(ticks); }, 1500);
    }));
    const after = await counts();
    const frames = after.reduce((sum, count, i) => sum + count - before[i], 0);
    assert.ok(updates >= 20, `${label}: stimulus must actually run (${updates} updates)`);
    assert.ok(frames <= 40, `${label}: unrelated host changes must not repeatedly schedule UI scans (${frames} callbacks / ${updates} updates)`);
    console.log(`${engine}: ${label}: ${frames} callbacks / ${updates} unrelated update batches`);
  }
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height:844 });
    await stream(`${width}px / closed before use`);
    await frame.evaluate(() => testOpen());
    await page.waitForFunction(() => document.querySelectorAll('.prompt-item').length === 400, null, { polling:25 });
    await stream(`${width}px / 400-entry panel open`);
    // A real preset change still updates the Vue panel after filtering.
    await page.locator('.preset-panel .title-select').first().selectOption('Second');
    assert.equal(await page.locator('.preset-panel .title-select').first().inputValue(), 'Second');
    await frame.evaluate(() => testClose());
    await page.locator('#preset-manager-main-panel').waitFor({ state:'detached' });
    await stream(`${width}px / closed after use`);
    // Native create/rename/delete updates must still refresh the floating picker.
    const name = `New native preset ${width}`;
    await page.evaluate(name => {
      pmmMutationPresetNames.push(name);
      const option = document.createElement('option'); option.value = name; option.textContent = name;
      document.getElementById('settings_preset_openai').append(option);
    }, name);
    await page.waitForFunction(name => Array.from(document.querySelectorAll('.panel-select--preset option')).some(option => option.value === name), name, { polling:25 });
    await page.evaluate(name => {
      pmmMutationPresetNames = pmmMutationPresetNames.filter(value => value !== name);
      Array.from(document.getElementById('settings_preset_openai').options).find(option => option.value === name).remove();
    }, name);
    await page.waitForFunction(name => !Array.from(document.querySelectorAll('.panel-select--preset option')).some(option => option.value === name), name, { polling:25 });
    // Preserve root discovery through an added/removed wrapper, without cloning Vue UI.
    await page.evaluate(() => {
      const host = document.getElementById('preset-manager-floating-panel');
      const wrapper = document.createElement('div'); wrapper.id = 'mutation-floating-wrapper';
      host.remove(); wrapper.append(host); document.body.append(wrapper);
      host.querySelector('.floating-panel-root').classList.remove('pmm-floating-mobile');
    });
    if (width === 390) await page.waitForFunction(() => document.querySelector('.floating-panel-root')?.classList.contains('pmm-floating-mobile'), null, { polling:25 });
    // Replaced native menus must regain their workshop entry.
    await page.evaluate(() => {
      const menu = document.createElement('div'); menu.id = 'extensionsMenu';
      document.getElementById('extensionsMenu').replaceWith(menu);
    });
    await page.locator('#extensionsMenu #pmm-wand-open-workshop').waitFor();
    // Test inherited theme changes with a visible owner. Hidden iframe frames may
    // be suspended by WebKit, and a closed panel does not need layout work.
    await frame.evaluate(() => testOpen());
    await page.waitForFunction(() => document.querySelectorAll('.prompt-item').length === 400, null, { polling:25 });
    await page.waitForTimeout(1500);
    await page.evaluate(width => {
      document.documentElement.style.setProperty('--SmartThemeBodyColor', width === 390 ? 'rgb(210, 220, 230)' : 'rgb(190, 200, 210)');
      document.documentElement.classList.toggle('mutation-theme-mobile', width === 390);
    }, width);
    // Verify rendered theme behavior, not an assumed RAF path: the existing theme
    // watcher may update synchronously, especially in WebKit's hidden iframe.
    if (!await page.locator('.pmm-layout-trigger').isVisible()) {
      await page.locator('.side-tab[title="工具面板"]').click();
      await page.locator('.pmm-layout-trigger').waitFor({ state:'visible' });
    }
    await page.locator('.pmm-layout-trigger').click();
    await page.locator('#pmm-mobile-layout-card').waitFor();
    const colors = { surface:'rgb(32, 35, 40)', ink:'rgb(215, 225, 235)', accent:'rgb(140, 170, 200)' };
    await page.locator('.pm-panel-container').first().evaluate((el, { surface, ink, accent }) => {
      el.style.setProperty('--pm-panel-bg', surface);
      el.style.setProperty('--pm-text-primary', ink);
      el.style.setProperty('--pm-quote-color', accent);
    }, colors);
    await page.waitForFunction(({ surface, ink, accent }) => {
      const card = document.getElementById('pmm-mobile-layout-card');
      const css = card && getComputedStyle(card);
      return css && css.backgroundColor === surface && css.color === ink && css.getPropertyValue('--pmm-layout-thumb').trim() === accent;
    }, colors, { polling:25 });
    await page.locator('[data-pmm-layout-done]').click();
    await frame.evaluate(() => testClose());
    await page.locator('#preset-manager-main-panel').waitFor({ state:'detached' });
  }
  await frame.evaluate(() => window.__PMM_RUNTIME_SCOPE__.dispose());
  await stream('runtime disposed');
  assert.deepEqual(await frame.evaluate(() => __PMM_RUNTIME_SCOPE__.stats()), { listeners:0, observers:0, timers:0, emitters:0 });
}
