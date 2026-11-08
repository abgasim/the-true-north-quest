// @PRINT-* scenarios: @media print fidelity for every generator view (US Letter, 8.5in).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, contextFor, openModule, fileUrl } from './support/harness.mjs';

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

const GENERATORS = [
  { file: 'column_ops_word_quest.html', open: () => switchMode('print_sheet'), content: '#printArea', minPages: 3 },
  { file: 'printable_number_sense_quiz_generator.html', open: () => { }, content: '#worksheetPage', minPages: 1 },
  { file: 'canada_capitals_game.html', open: () => switchGameMode('print'), content: '#printContainer', minPages: 1 },
];

for (const g of GENERATORS) {
  test(`@PRINT-FIDELITY ${g.file}: controls hidden, worksheet visible, nothing clipped, paginates to PDF`, async () => {
    const ctx = await contextFor(browser, 'offline-file', { viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await openModule(page, fileUrl(g.file));
    await page.evaluate(g.open);
    await page.waitForTimeout(300);
    await page.emulateMedia({ media: 'print' });
    await page.setViewportSize({ width: 768, height: 1056 }); // 8in printable width at 96 dpi
    await page.waitForTimeout(200);
    const r = await page.evaluate((sel) => {
      const shown = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
      const content = document.querySelector(sel);
      const leakedControls = [...document.querySelectorAll('.no-print')].filter(shown).length;
      const buttons = [...content.querySelectorAll('button')].filter((b) => shown(b) && !b.closest('.no-print')).length;
      const w = document.documentElement.clientWidth;
      const clipped = [...content.querySelectorAll('*')].filter((el) => shown(el) && el.getBoundingClientRect().right > w + 1).length;
      return { visible: shown(content), text: content.innerText.trim().length, leakedControls, buttons, clipped };
    }, g.content);
    const pdf = await page.pdf({ format: 'Letter', printBackground: true, preferCSSPageSize: true });
    await ctx.close();
    assert.ok(r.visible, 'worksheet is visible in print');
    assert.ok(r.text > 100, 'worksheet has content');
    assert.equal(r.leakedControls, 0, '.no-print controls are hidden');
    assert.equal(r.buttons, 0, 'no on-screen buttons on paper');
    assert.equal(r.clipped, 0, 'nothing runs off the right edge of the page');
    const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    assert.ok(pages >= g.minPages, `expected ≥${g.minPages} pages, got ${pages}`);
  });
}
