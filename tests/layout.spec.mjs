// @LAYOUT-* and @MOBILE-* scenarios: no sideways scroll, no layout shift, touch-sized hub controls.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, contextFor, openModule, fileUrl, MODULES, VIEWPORTS } from './support/harness.mjs';

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

const PHONE = new Set(['iphone-14', 'android-360']);

for (const file of ['index.html', ...MODULES.map((m) => m.file)]) {
  test(`@LAYOUT-NO-SHIFT ${file}: no horizontal scroll and zero layout shift at every width`, async () => {
    const failures = [];
    for (const [name, vp] of Object.entries(VIEWPORTS)) {
      const mobile = PHONE.has(name) || name.startsWith('ipad');
      const ctx = await contextFor(browser, 'offline-file', { viewport: vp, isMobile: mobile, hasTouch: mobile });
      await ctx.addInitScript(() => {
        window.__cls = 0;
        new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; })
          .observe({ type: 'layout-shift', buffered: true });
      });
      const page = await ctx.newPage();
      await openModule(page, fileUrl(file));
      await page.waitForTimeout(500);
      const r = await page.evaluate(() => ({ over: document.documentElement.scrollWidth - window.innerWidth, cls: window.__cls }));
      await ctx.close();
      if (r.over > 0) failures.push(`${name}: ${r.over}px horizontal overflow`);
      if (r.cls > 0.001) failures.push(`${name}: CLS ${r.cls.toFixed(4)}`);
    }
    assert.deepEqual(failures, []);
  });
}

test('@MOBILE-TOUCH hub controls are at least 44×44 px on touch screens', async () => {
  const ctx = await contextFor(browser, 'offline-file', { viewport: VIEWPORTS['android-360'], isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await openModule(page, fileUrl('index.html'));
  await page.click('#menuToggle'); await page.waitForTimeout(300);
  const small = await page.$$eval('button:not([hidden]), .lesson-item', (els) => els
    .filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden')
    .map((e) => ({ id: e.id || e.dataset.id || e.textContent.trim().slice(0, 20), w: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height }))
    .filter((b) => b.w < 44 || b.h < 44));
  await ctx.close();
  assert.deepEqual(small, []);
});

test('@MOBILE-READABLE no visible lesson text is smaller than 12 px on a phone', async () => {
  const ctx = await contextFor(browser, 'offline-file', { viewport: VIEWPORTS['iphone-14'], isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const tooSmall = [];
  for (const m of MODULES) {
    await openModule(page, fileUrl(m.file));
    const hits = await page.evaluate(() => {
      const out = [];
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        const el = n.parentElement;
        if (!el || !n.nodeValue.trim() || el.closest('svg, script, style, [aria-hidden="true"]')) continue;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || !el.getClientRects().length) continue;
        if (parseFloat(cs.fontSize) < 12) out.push(`${cs.fontSize} "${n.nodeValue.trim().slice(0, 30)}"`);
      }
      return out;
    });
    for (const h of hits) tooSmall.push(`${m.file}: ${h}`);
  }
  await ctx.close();
  assert.deepEqual(tooSmall, []);
});

test('@MOBILE-VIEWPORT every page is zoomable, fits the screen and respects the notch', async () => {
  const ctx = await contextFor(browser, 'offline-file', { viewport: VIEWPORTS['iphone-14'], isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  for (const file of ['index.html', ...MODULES.map((m) => m.file)]) {
    await openModule(page, fileUrl(file));
    const vp = await page.getAttribute('meta[name="viewport"]', 'content');
    assert.match(vp, /width=device-width/, file);
    assert.doesNotMatch(vp, /user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/, `${file} blocks zoom`);
  }
  await openModule(page, fileUrl('index.html'));
  const hub = await page.evaluate(() => ({ h: document.body.getBoundingClientRect().height, vh: window.innerHeight, frame: document.getElementById('stageFrame').getBoundingClientRect().height }));
  await ctx.close();
  assert.ok(Math.abs(hub.h - hub.vh) <= 1, 'hub fills exactly one screen (no page scroll behind the lesson)');
  assert.ok(hub.frame > hub.vh * 0.6, 'the lesson gets most of the screen on a phone');
});
