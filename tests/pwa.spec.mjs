// @PWA-* scenarios: installable on phones, and fully usable offline after the first visit.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { launch, contextFor, collectIssues, startServer, ROOT, MODULES } from './support/harness.mjs';

let browser, server;
before(async () => { browser = await launch(); server = await startServer(); });
after(async () => { await server?.close(); await browser?.close(); });

test('@PWA-MANIFEST manifest and icons meet Android and iOS install requirements', () => {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
  assert.equal(m.display, 'standalone');
  assert.ok(m.name && m.short_name && m.short_name.length <= 12, 'short_name fits under a home-screen icon');
  assert.equal(m.start_url, './index.html'); assert.equal(m.scope, './');
  const sizes = m.icons.map((i) => i.sizes);
  assert.ok(sizes.includes('192x192') && sizes.includes('512x512'), 'Chrome needs 192 and 512');
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'), 'Android adaptive icon');
  for (const i of m.icons) assert.ok(fs.existsSync(path.join(ROOT, i.src)), i.src);
  const hub = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  for (const tag of ['rel="manifest"', 'rel="apple-touch-icon"', 'apple-mobile-web-app-capable', 'viewport-fit=cover'])
    assert.ok(hub.includes(tag), tag);
  assert.ok(fs.existsSync(path.join(ROOT, 'icons/apple-touch-icon.png')));
});

test('@PWA-PRECACHE the service worker precaches the hub, every module and every local library', () => {
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const list = JSON.parse(sw.match(/const PRECACHE = (\[[\s\S]*?\]);/)[1]);
  for (const f of ['index.html', 'manifest.webmanifest', ...MODULES.map((m) => m.file), 'lib/tailwind.js', 'lib/Tone.js', 'lib/confetti.browser.min.js'])
    assert.ok(list.includes(f), `${f} precached`);
  for (const f of list.filter((f) => f !== './')) assert.ok(fs.existsSync(path.join(ROOT, f)), `${f} exists`);
});

test('@PWA-OFFLINE after one online visit, the hub and every lesson open with the network off', async () => {
  const ctx = await contextFor(browser, 'no-internet', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const issues = collectIssues(page);
  await page.goto(server.origin + '/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();   // now controlled by the worker
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await ctx.setOffline(true);   // phone in airplane mode
  for (const m of MODULES) {
    await page.goto(`${server.origin}/#/${m.id}`);
    await page.reload();
    await page.waitForFunction((file) => document.getElementById('stageFrame').dataset.lesson === file, m.file);
    const frame = page.frameLocator('#stageFrame');
    await frame.locator('html.tnq-ready').waitFor({ timeout: 10000 });
    const libs = await page.frames().find((f) => f.url().endsWith(m.file)).evaluate(() => TNQ.libs);
    for (const [k, v] of Object.entries(libs)) assert.equal(v, 'local', `${m.file} ${k} from cache`);
  }
  await ctx.close();
  assert.deepEqual(issues.pageErrors, []);
});
