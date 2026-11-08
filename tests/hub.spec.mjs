// @HUB-* scenarios: registry audit, iframe lifecycle, postMessage contract, drawer, deep links.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { launch, contextFor, collectIssues, startServer, fileUrl, ROOT, MODULES, REGISTRY } from './support/harness.mjs';

// Ge'ez script block (U+1200-U+137F), written as escapes so this file stays ASCII-clean.
const GEEZ = new RegExp(`[${String.fromCodePoint(0x1200)}-${String.fromCodePoint(0x137F)}]`);

let browser, server;
before(async () => { browser = await launch(); server = await startServer(); });
after(async () => { await server?.close(); await browser?.close(); });

const frameModule = (page) => page.evaluate(() => document.getElementById('stageFrame').dataset.lesson);
async function openHub(page, url) {
  await page.goto(url);
  await page.waitForFunction(() => document.querySelector('.lesson-item[aria-current="page"]'));
}

test('@HUB-REGISTRY every registered module exists, is uniquely named, and carries a current boot block', () => {
  const ids = MODULES.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length, 'ids are unique');
  assert.equal(new Set(MODULES.map((m) => m.file)).size, MODULES.length, 'files are unique');
  for (const m of MODULES) {
    assert.match(m.id, /^[a-z][a-z0-9_]*$/, `id ${m.id} is snake_case`);
    assert.match(m.file, /^[a-z][a-z0-9_]*\.html$/, `file ${m.file} is snake_case .html, relative`);
    for (const k of ['title', 'desc', 'icon', 'curriculum']) assert.ok(m[k] && String(m[k]).trim(), `${m.id}.${k}`);
    assert.ok(!GEEZ.test(m.title + m.desc), `${m.id} registry text is English`);
    const html = fs.readFileSync(path.join(ROOT, m.file), 'utf8');
    assert.ok(html.includes('<!-- TNQ:BOOT:BEGIN'), `${m.file} has boot block`);
    assert.ok(html.includes(`data-tnq-module="${path.basename(m.file, '.html')}"`), `${m.file} module id`);
    assert.ok(!/onerror="this\.onerror=null;this\.src=/.test(html), `${m.file} still uses the broken src-swap fallback`);
    assert.ok(!/user-scalable=no|maximum-scale=1/.test(html), `${m.file} blocks zoom`);
  }
  assert.equal(REGISTRY.length, 3, 'three categories');
});

test('@HUB-POSTMESSAGE handshake syncs sidebar, progress reaches the toolbar, foreign messages are ignored', async () => {
  const ctx = await contextFor(browser, 'offline-file', { viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const issues = collectIssues(page);
  await openHub(page, fileUrl('index.html') + '#/column_ops');
  const frame = page.frameLocator('#stageFrame');
  await frame.locator('#ans_0').waitFor();
  await page.waitForFunction(() => document.getElementById('stageLoading').hidden);
  assert.equal(await page.getAttribute('.lesson-item[aria-current="page"]', 'data-id'), 'column_ops');
  // Progress: solve 5235 + 3533 = 8768 inside the frame.
  for (const [id, v] of [['ans_3', '8'], ['ans_2', '7'], ['ans_1', '6'], ['ans_0', '8']]) await frame.locator('#' + id).fill(v);
  await frame.locator('#gameArena button:has-text("Verify")').click();
  await page.waitForFunction(() => document.getElementById('scoreChip').textContent.includes('10'));
  // A message from the hub window itself (not the frame) must be ignored.
  await page.evaluate(() => window.postMessage({ tnq: 1, type: 'tnq:progress', score: 999 }, '*'));
  await page.waitForTimeout(100);
  assert.ok(!(await page.textContent('#scoreChip')).includes('999'));
  await ctx.close();
  assert.deepEqual(issues.pageErrors, []);
});

test('@HUB-DEEPLINK hash routes select the module; unknown ids fall back to the first module', async () => {
  const ctx = await contextFor(browser, 'no-internet');
  const page = await ctx.newPage();
  await openHub(page, server.origin + '/#/rounding_line');
  assert.equal(await frameModule(page), 'rounding_number_line.html');
  await page.click('.lesson-item[data-id="number_sense"]');
  await page.waitForFunction(() => location.hash === '#/number_sense');
  assert.equal(await frameModule(page), 'number_sense_studio.html');
  assert.equal(await page.textContent('#currentLessonTitle'), 'Number Sense Studio');
  await page.goto(server.origin + '/#/does_not_exist');
  await page.waitForFunction(() => document.getElementById('stageFrame').dataset.lesson);
  assert.equal(await frameModule(page), MODULES[0].file);
  await ctx.close();
});

test('@HUB-DRAWER mobile drawer with blurred backdrop; desktop multi-pane', async () => {
  const ctx = await contextFor(browser, 'no-internet', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto(server.origin + '/');
  await page.waitForSelector('.home-tile');          // phones open on the launcher
  const sidebarVisible =() => page.evaluate(() => { const r = document.getElementById('sidebar').getBoundingClientRect(); return getComputedStyle(document.getElementById('sidebar')).visibility === 'visible' && r.right > 0; });
  assert.equal(await sidebarVisible(), false, 'drawer starts closed on phones');
  assert.equal(await page.getAttribute('#menuToggle', 'aria-expanded'), 'false');
  await page.click('#menuToggle');
  await page.waitForTimeout(350);
  assert.equal(await sidebarVisible(), true);
  const bd = await page.evaluate(() => { const s = getComputedStyle(document.getElementById('backdrop')); return { display: s.display, blur: s.backdropFilter || s.webkitBackdropFilter }; });
  assert.equal(bd.display, 'block'); assert.match(bd.blur, /blur\(6px\)/);
  assert.equal(await page.evaluate(() => document.getElementById('stage').inert), true, 'stage is inert behind the drawer');
  assert.equal(await page.evaluate(() => document.activeElement.classList.contains('lesson-item')), true, 'focus moves into the drawer');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(350);
  assert.equal(await sidebarVisible(), false);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'menuToggle', 'focus returns to the toggle');
  await page.click('#menuToggle'); await page.waitForTimeout(300);
  await page.click('.lesson-item[data-id="carpet_rounding"]');
  await page.waitForTimeout(350);
  assert.equal(await sidebarVisible(), false, 'choosing a lesson closes the drawer');
  assert.equal(await frameModule(page), 'carpet_rolling_rounding.html');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(350);
  assert.equal(await sidebarVisible(), true, 'desktop shows the sidebar pane inline');
  const pane = await page.evaluate(() => getComputedStyle(document.getElementById('sidebar')).position);
  assert.equal(pane, 'static');
  await ctx.close();
});

test('@HUB-LAUNCHER phones get an app launcher, one app bar, and back navigation that leaves the lesson', async () => {
  const ctx = await contextFor(browser, 'no-internet', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const issues = collectIssues(page);
  await page.goto(server.origin + '/');
  await page.waitForSelector('.home-tile');
  const home = await page.evaluate(() => ({
    tiles: document.querySelectorAll('.home-tile').length,
    stageHidden: getComputedStyle(document.querySelector('.iframe-holder')).display === 'none',
    smallest: Math.min(...[...document.querySelectorAll('.home-tile')].map(t => Math.min(t.getBoundingClientRect().width, t.getBoundingClientRect().height))),
  }));
  assert.equal(home.tiles, MODULES.length, 'one tile per lesson');
  assert.ok(home.stageHidden, 'no lesson is loaded behind the launcher');
  assert.ok(home.smallest >= 120, `tiles are large touch targets (smallest side ${home.smallest}px)`);
  await page.tap('.home-tile[data-id="column_ops"]');
  await page.frameLocator('#stageFrame').locator('#ans_0').waitFor();
  const lesson = await page.evaluate(() => ({
    header: getComputedStyle(document.querySelector('header.app-header')).display,
    back: getComputedStyle(document.getElementById('btnHome')).display,
    title: document.getElementById('currentLessonTitle').textContent,
    frameH: document.getElementById('stageFrame').getBoundingClientRect().height,
  }));
  assert.equal(lesson.header, 'none', 'single app bar inside a lesson');
  assert.notEqual(lesson.back, 'none');
  assert.equal(lesson.title, 'Operation Grid & Word Quest');
  assert.ok(lesson.frameH >= 844 - 60, `the lesson gets the whole screen below one bar (${lesson.frameH}px)`);
  await page.tap('#btnHome');
  await page.waitForSelector('#home:not([hidden])');
  // The phone's own back gesture must also leave the lesson (iframe loads add no history entries).
  await page.tap('.home-tile[data-id="number_sense"]');
  await page.frameLocator('#stageFrame').locator('#quizWorkspace').waitFor();
  await page.goBack();
  await page.waitForSelector('#home:not([hidden])');
  // Deep link straight into a lesson, then ‹ goes to the launcher.
  await page.goto(server.origin + '/#/rounding_line');
  await page.waitForFunction(() => document.getElementById('stageFrame').dataset.lesson === 'rounding_number_line.html');
  await page.tap('#btnHome');
  await page.waitForSelector('#home:not([hidden])');
  await ctx.close();
  assert.deepEqual(issues.pageErrors, []);
});

test('@NO-AMHARIC-SOURCE the shipped app contains no Amharic text, Ethiopic fonts or language switching', () => {
  const files = ['index.html', 'manifest.webmanifest', 'sw.js', 'README.md', ...MODULES.map((m) => m.file),
    ...fs.readdirSync(path.join(ROOT, 'tools')).map((f) => `tools/${f}`),
    ...fs.readdirSync(path.join(ROOT, 'specs')).map((f) => `specs/${f}`)];
  const problems = [];
  for (const f of files) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    if (GEEZ.test(src)) problems.push(`${f}: Ge'ez script`);
    if (/Noto\+?\s?Sans\+?\s?Ethiopic|\bNyala\b|\bEbrima\b|\bKefa\b|Abyssinica/.test(src)) problems.push(`${f}: Ethiopic font`);
    if (/toggleLang|toggleLanguage|tnq:set-lang|tnq:lang\b|reportLang|onSetLang|langToggle/.test(src)) problems.push(`${f}: language switching code`);
  }
  assert.deepEqual(problems, []);
});
