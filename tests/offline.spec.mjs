// @OFFLINE-* scenarios: the dual-mode loader in every registered module.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, contextFor, collectIssues, openModule, fileUrl, startServer, MODULES } from './support/harness.mjs';

let browser, cdnServer;
before(async () => { browser = await launch(); cdnServer = await startServer({ libMissing: true }); });
after(async () => { await cdnServer?.close(); await browser?.close(); });

const required = (html) => ['tailwind', 'tone', 'confetti'].filter((k) => html.includes(`TNQB.n('${k}'`));
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './support/harness.mjs';

for (const m of MODULES) {
  const html = fs.readFileSync(path.join(ROOT, m.file), 'utf8');
  const libs = required(html);

  test(`@OFFLINE-ZERO-ERRORS ${m.file} offline from disk: zero console errors, libraries resolved locally`, async () => {
    const ctx = await contextFor(browser, 'offline-file');
    const page = await ctx.newPage();
    const issues = collectIssues(page);
    await openModule(page, fileUrl(m.file));
    await page.mouse.click(5, 5);  // a user gesture, unlocks audio paths
    await page.waitForTimeout(200);
    const st = await page.evaluate(() => ({ libs: TNQ.libs, fonts: TNQ.fonts }));
    await ctx.close();
    assert.deepEqual(issues.pageErrors, []);
    assert.deepEqual(issues.consoleErrors, []);
    assert.deepEqual(issues.failedRequests, [], 'nothing should even be attempted over the network');
    for (const k of libs) assert.equal(st.libs[k], 'local', k);
    assert.equal(st.fonts, 'native');
  });

  if (libs.length) {
    test(`@OFFLINE-CDN-FALLBACK ${m.file} with lib/ missing: every library is loaded from its CDN`, async () => {
      const ctx = await contextFor(browser, 'cdn-only');
      const page = await ctx.newPage();
      const issues = collectIssues(page);
      await openModule(page, cdnServer.origin + '/' + m.file);
      const st = await page.evaluate(() => ({ libs: TNQ.libs, real: { tone: typeof window.Tone?.Synth === 'function' && !!window.Tone.version, confetti: typeof window.confetti === 'function', tailwind: !!document.querySelector('style') } }));
      await ctx.close();
      assert.deepEqual(issues.pageErrors, []);
      for (const k of libs) { assert.equal(st.libs[k], 'cdn', k); assert.ok(st.real[k], `${k} is the real library`); }
      // The only console errors allowed are the expected 404s for the missing local files.
      assert.deepEqual(issues.consoleErrors.filter((e) => !/Failed to load resource.*404/.test(e)), []);
    });

    test(`@OFFLINE-STUBS ${m.file} with neither lib/ nor network: inert stubs, zero page errors`, async () => {
      const ctx = await contextFor(browser, 'nothing');
      const page = await ctx.newPage();
      const issues = collectIssues(page);
      await openModule(page, cdnServer.origin + '/' + m.file);
      const st = await page.evaluate(() => TNQ.libs);
      // Exercise the audio/confetti paths through the stubs.
      await page.evaluate(async () => {
        if (window.Tone) { const s = new Tone.Synth().toDestination(); s.triggerAttackRelease('C4', '8n'); await Tone.start(); Tone.Transport.bpm.value = 90; }
        if (window.confetti) await confetti({ particleCount: 5 });
      });
      await ctx.close();
      for (const k of libs) assert.equal(st[k], 'stub', k);
      assert.deepEqual(issues.pageErrors, []);
    });
  }

  test(`@OFFLINE-FONT-STACK ${m.file} falls back to native OS fonts on Windows, Apple and Android`, async () => {
    const ctx = await contextFor(browser, 'offline-file');
    const page = await ctx.newPage();
    await openModule(page, fileUrl(m.file));
    const ff = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    await ctx.close();
    for (const f of ['Segoe UI', '-apple-system', 'Roboto']) assert.ok(ff.includes(f), `${f} missing from: ${ff}`);
    assert.doesNotMatch(ff, /Ethiopic|Nyala|Ebrima|Kefa/, 'no Ethiopic fonts');
  });
}

test('@OFFLINE-STUBS column ops stays fully playable with no libraries at all', async () => {
  const ctx = await contextFor(browser, 'nothing');
  const page = await ctx.newPage();
  const issues = collectIssues(page);
  await openModule(page, cdnServer.origin + '/column_ops_word_quest.html');
  await page.evaluate(() => { switchMode('grid_sub'); problemIdx = 3; renderCurrentProblem(); });
  for (const [id, v] of [['ans_3', '2'], ['ans_2', '1'], ['ans_1', '7'], ['ans_0', '5']]) await page.fill('#' + id, v);
  await page.click('#gameArena button:has-text("Verify")');
  const fb = await page.textContent('#gridFeedback');
  await ctx.close();
  assert.match(fb, /2175/);
  assert.deepEqual(issues.pageErrors, []);
});
