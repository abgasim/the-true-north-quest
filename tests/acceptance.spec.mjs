// Step definitions for specs/TEST-SPECS.feature (math, clue and bilingual features).
// Each test title starts with the scenario's @tag so tests/meta.spec.mjs can prove coverage.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, contextFor, collectIssues, openModule, fileUrl } from './support/harness.mjs';

let browser, context, ops, ns, opsIssues, nsIssues;

before(async () => {
  browser = await launch();
  context = await contextFor(browser, 'offline-file');
  ops = await context.newPage(); opsIssues = collectIssues(ops);
  ns = await context.newPage(); nsIssues = collectIssues(ns);
  await openModule(ops, fileUrl('column_ops_word_quest.html'));
  await openModule(ns, fileUrl('number_sense_studio.html'));
});
after(async () => { await browser?.close(); });

const solve = (a, b, op) => ops.evaluate(([a, b, op]) => TNQMath.solve(a, b, op), [a, b, op]);
const evalGrid = (a, b, op, digits, marks) => ops.evaluate(([a, b, op, d, m]) => evaluateGrid(TNQMath.solve(a, b, op), d, m), [a, b, op, digits, marks]);
// UI order is thousands..ones; the engine indexes by power (ones = 0).
const byPower = (thToOnes) => thToOnes.slice().reverse();

// ---------------------------------------------------------------- regrouping
test('@SUB-BORROW-CASCADE 5944 − 3769 borrows through tens and hundreds to 2175', async () => {
  const sol = await solve(5944, 3769, '-');
  const ones = sol.steps[0], tens = sol.steps[1], hundreds = sol.steps[2];
  assert.equal(ones.borrowed, true); assert.equal(ones.lender, 'tens'); assert.equal(ones.topWorking, 14); assert.equal(ones.digit, 5);
  assert.equal(tens.topBefore, 3, 'tens already lent 1 to the ones (4 → 3)');
  assert.equal(tens.borrowed, true); assert.equal(tens.lender, 'hundreds');
  assert.equal(tens.topWorking, 13, 'tens becomes 13 after borrowing');
  assert.equal(tens.digit, 7, 'tens result digit is 7');
  assert.equal(hundreds.topBefore, 8, 'hundreds reduced 9 → 8');
  assert.equal(sol.result, 2175);
  assert.deepEqual(byPower(sol.marks), ['', '8', '13', '14']);
  assert.equal(sol.regroupCount, 2);
  const r = await evalGrid(5944, 3769, '-', byPower(['2', '1', '7', '5']), byPower(['', '8', '13', '14']));
  assert.equal(r.status, 'correct');
});

test('@SUB-NO-SPURIOUS-BORROW 7685 − 2142 needs zero borrows and expects 5543', async () => {
  const sol = await solve(7685, 2142, '-');
  assert.equal(sol.regroupCount, 0);
  assert.equal(sol.result, 5543);
  assert.deepEqual(sol.marks, ['', '', '', '']);
  const spurious = await evalGrid(7685, 2142, '-', byPower(['5', '5', '4', '3']), byPower(['', '', '7', '15']));
  assert.equal(spurious.status, 'unnecessary');
  assert.deepEqual(spurious.mk.unnecessary.sort(), ['ones', 'tens']);
  const clean = await evalGrid(7685, 2142, '-', byPower(['5', '5', '4', '3']), ['', '', '', '']);
  assert.equal(clean.status, 'correct');
  // UI path: spurious mark gives a warning and no points.
  await ops.evaluate(() => { switchMode('grid_sub'); problemIdx = 4; renderCurrentProblem(); });
  for (const [id, v] of [['ans_3', '5'], ['ans_2', '5'], ['ans_1', '4'], ['ans_0', '3'], ['carry_0', '15']]) await ops.fill('#' + id, v);
  const before = Number(await ops.textContent('#scoreVal'));
  await ops.click('text=Verify Answer');
  assert.match(await ops.textContent('#gridFeedback'), /zero borrows/);
  assert.equal(Number(await ops.textContent('#scoreVal')), before);
});

test('@SUB-ZERO-PLACEHOLDER borrowing across zeros turns them into 9s', async () => {
  const a = await solve(8504, 3276, '-');
  assert.equal(a.result, 5228); assert.deepEqual(byPower(a.marks), ['', '4', '9', '14']); assert.equal(a.acrossZero, true);
  const b = await solve(6500, 4235, '-');
  assert.equal(b.result, 2265); assert.deepEqual(byPower(b.marks), ['', '4', '9', '10']);
});

test('@ADD-CARRY 2894 + 4637 carries into tens, hundreds and thousands', async () => {
  const sol = await solve(2894, 4637, '+');
  assert.equal(sol.result, 7531);
  assert.deepEqual(byPower(sol.marks), ['1', '1', '1', '']);
  assert.deepEqual(sol.regroupPlaces, ['ones', 'tens', 'hundreds']);
  const r = await evalGrid(2894, 4637, '+', byPower(['7', '5', '3', '1']), byPower(['', '', '', '1']));
  assert.equal(r.status, 'unnecessary', 'a carry written above the ones column is never valid');
});

test('@GRID-DIGIT-INTEGRITY a blank inner column is not collapsed into a shorter number', async () => {
  // 2376 − 1657 = 719 (written 0719). "7 _ 1 9" used to concatenate to "719" and pass.
  const shifted = await evalGrid(2376, 1657, '-', byPower(['7', '', '1', '9']), ['', '', '', '']);
  assert.equal(shifted.status, 'wrong');
  const leadingBlank = await evalGrid(2376, 1657, '-', byPower(['', '7', '1', '9']), ['', '', '', '']);
  assert.equal(leadingBlank.status, 'correct', 'a blank leading zero is fine');
});

test('@BANK-INTEGRITY every bank problem is internally consistent', async () => {
  const report = await ops.evaluate(() => {
    const bad = [];
    for (const p of fullAdditionBank) { const s = TNQMath.columnAdd(p.num1, p.num2); if (s.overflow || s.result !== p.num1 + p.num2 || s.resultDigits.reduce((a, d, i) => a + d * 10 ** i, 0) !== s.result) bad.push(['+', p]); }
    for (const p of fullSubtractionBank) { const s = TNQMath.columnSub(p.num1, p.num2); if (s.result < 0 || s.resultDigits.reduce((a, d, i) => a + d * 10 ** i, 0) !== s.result) bad.push(['-', p]); }
    for (const w of fullWordBank) { if ((w.op === '+' ? w.num1 + w.num2 : w.num1 - w.num2) !== w.ans) bad.push(['word', w.id]); }
    return { bad, add: fullAdditionBank.length, sub: fullSubtractionBank.length, words: fullWordBank.length };
  });
  assert.deepEqual(report.bad, []);
  assert.deepEqual([report.add, report.sub, report.words], [10, 10, 10]);
});

// ---------------------------------------------------------------- clue detective
const classify = (text) => ops.evaluate((t) => TNQMath.classifyClue(t), text);

test('@CLUE-ADD "in total" / "altogether" validate addition and reject subtraction', async () => {
  for (const s of ['Mia has 1,250 red beads and 2,310 blue beads. How many beads does she have in total?',
    'The farm grew 3,850 apples and 2,965 pears. How many fruits did it grow altogether?']) {
    assert.equal((await classify(s)).op, '+', s);
  }
  for (const id of ['w1', 'w4']) {
    const r = await ops.evaluate((id) => { const it = fullWordBank.find(w => w.id === id); return [evaluateDetective(it, '-', it.ans).status, evaluateDetective(it, '+', it.ans).status]; }, id);
    assert.deepEqual(r, ['op-rejected', 'correct'], id);
  }
});

test('@CLUE-SUB "how many left" / "how much further" validate subtraction and reject addition', async () => {
  for (const s of ['Sam baked 2,400 cookies and sold 1,875. How many left?',
    'The trail is 4,200 m long. Ana walked 1,960 m. How much further must she walk?',
    'He spent $2,000 of his $5,500. How much money is left?']) {
    assert.equal((await classify(s)).op, '-', s);
  }
  for (const id of ['w2', 'w5']) {
    const r = await ops.evaluate((id) => { const it = fullWordBank.find(w => w.id === id); return [evaluateDetective(it, '+', it.ans).status, evaluateDetective(it, '-', it.ans).status]; }, id);
    assert.deepEqual(r, ['op-rejected', 'correct'], id);
  }
});

test('@CLUE-BANK every word story classifies to its declared operation', async () => {
  const rows = await ops.evaluate(() => fullWordBank.map(w => ({ id: w.id, op: w.op, got: TNQMath.classifyClue(w.storyEn) })));
  for (const r of rows) {
    assert.equal(r.got.op, r.op, `${r.id} matched "${r.got.phrase}"`);
    assert.equal(r.got.scope, 'question', `${r.id} should be decided by the question sentence`);
  }
});

test('@CLUE-VOCAB 24 numberless terms, balanced, and Drop Bins never mutates the bank', async () => {
  const r = await ops.evaluate(() => {
    const ids = clueBank.map(c => c.id).join();
    switchMode('clue_arena'); setClueSubMode('bins'); setClueSubMode('bins');
    return { n: clueBank.length, add: clueBank.filter(c => c.op === '+').length, digits: clueBank.some(c => /\d/.test(c.en + c.noteEn)), same: ids === clueBank.map(c => c.id).join(), unique: new Set(clueBank.map(c => c.id)).size };
  });
  assert.deepEqual(r, { n: 24, add: 12, digits: false, same: true, unique: 24 });
});

test('@WORKSHEET-10 print sheet renders 10 + 10 + 10 problems and an answer key with regroup marks', async () => {
  const r = await ops.evaluate(() => {
    switchMode('print_sheet');
    const blank = document.querySelectorAll('#printArea .print-grid > .print-box').length;
    const stories = document.querySelectorAll('#printArea .space-y-4 > .print-box').length;
    togglePrintAnswers();
    const keyText = document.querySelector('#printArea').innerText;
    togglePrintAnswers();
    return { blank, stories, has2175: keyText.includes('2') && keyText.includes('13') };
  });
  assert.equal(r.blank, 20); assert.equal(r.stories, 10); assert.ok(r.has2175);
});

// ---------------------------------------------------------------- English-only
// Ge'ez script block is U+1200–U+137F; written as escapes so this file itself stays ASCII-clean.
const GEEZ = new RegExp(`[${String.fromCodePoint(0x1200)}-${String.fromCodePoint(0x137F)}]`);

test('@ENGLISH-ONLY math modules render every mode in English with no Amharic and no language switch', async () => {
  const geezIn = (page) => page.evaluate((src) => {
    const re = new RegExp(src);
    const attrs = [...document.querySelectorAll('[title],[aria-label],[placeholder]')].flatMap(e => ['title', 'aria-label', 'placeholder'].map(a => e.getAttribute(a) || ''));
    return [document.title, document.body.innerText, ...attrs].filter(t => re.test(t)).map(t => t.slice(0, 80));
  }, GEEZ.source);
  for (const [m, sub] of [['grid_add'], ['grid_sub'], ['word_detective'], ['clue_arena', 'rapid'], ['clue_arena', 'bins'], ['clue_arena', 'vault'], ['print_sheet']]) {
    await ops.evaluate(([m, sub]) => { switchMode(m); if (sub) setClueSubMode(sub); }, [m, sub]);
    if (m === 'word_detective') await ops.evaluate(() => { selectDetectiveOp('-'); checkDetectiveAnswer(); });
    assert.deepEqual(await geezIn(ops), [], `column ops ${m}${sub ? '/' + sub : ''}`);
  }
  for (const src of ['original', 'random']) {
    for (const cat of ['placeValue', 'numberWords', 'mabBlocks', 'expanded', 'comparison', 'rounding', 'bonus']) {
      await ns.evaluate(([cat, src]) => { setQuizSource(src); selectCategory(cat); }, [cat, src]);
      if (cat === 'numberWords' || cat === 'rounding') await ns.evaluate(() => submitAnswer());
      assert.deepEqual(await geezIn(ns), [], `number sense ${src}/${cat}`);
    }
  }
  await ns.evaluate(() => setQuizSource('original'));
  for (const page of [ops, ns]) {
    const r = await page.evaluate(() => ({ lang: document.documentElement.lang, toggles: typeof window.toggleLang + typeof window.toggleLanguage + typeof window.setLang, langs: window.TNQ && 'langs' in TNQ }));
    assert.deepEqual(r, { lang: 'en', toggles: 'undefinedundefinedundefined', langs: false });
  }
  const banks = await ops.evaluate(() => JSON.stringify([fullWordBank, clueBank]));
  assert.ok(!GEEZ.test(banks) && !/"(?:am|storyAm|clueAm|noteAm)"/.test(banks), 'no Amharic fields left in the data banks');
});

test('@NS-NUMBER-WORDS English number words are exact and tolerant of spacing, hyphens and "and"', async () => {
  const words = await ns.evaluate(() => [7198, 112, 46, 2020, 1000, 19, 10, 9005, 0].map(n => TNQNumber.enWords(n)));
  assert.deepEqual(words, ['seven thousand one hundred ninety-eight', 'one hundred twelve', 'forty-six', 'two thousand twenty',
    'one thousand', 'nineteen', 'ten', 'nine thousand five', 'zero']);
  const accepted = await ns.evaluate(() => [
    TNQNumber.matchesWords('Forty six', 46), TNQNumber.matchesWords('one hundred and twelve', 112),
    TNQNumber.matchesWords('  Seven-thousand one hundred ninety eight ', 7198), TNQNumber.matchesWords('fourty-six', 46)]);
  assert.deepEqual(accepted, [true, true, true, false]);
  assert.equal(await ns.evaluate(() => 'amWords' in TNQNumber), false);
});

test('@NS-EXACT-INDEX only the digit at the target index is highlighted (5508)', async () => {
  await ns.evaluate(() => { selectCategory('placeValue'); activeQuestionIndex = 1; loadCurrentQuestion(); });
  const spans = await ns.$$eval('#pvNumber > span', els => els.map(e => [e.textContent, e.dataset.target === 'true']));
  assert.deepEqual(spans, [['5', false], ['5', true], ['0', false], ['8', false]]);
  await ns.click('#quizWorkspace button[data-opt="500"]');
  assert.match(await ns.textContent('#feedbackTitle'), /correct/i);
});

test('@NS-MAB-ISO 7198 renders isometric SVG blocks with three shaded faces at one scale', async () => {
  await ns.evaluate(() => { setQuizSource('original'); selectCategory('mabBlocks'); });
  const r = await ns.$$eval('#mabDiagram svg[data-mab]', svgs => {
    const by = {};
    for (const s of svgs) {
      const k = s.dataset.mab;
      by[k] ??= { n: 0, faces: s.querySelectorAll('polygon').length, fills: new Set([...s.querySelectorAll('polygon')].map(p => p.getAttribute('fill'))).size, lines: s.querySelectorAll('line').length, w: +s.getAttribute('viewBox').split(' ')[2] };
      by[k].n++;
    }
    return by;
  });
  assert.deepEqual([r.thousand.n, r.hundred.n, r.ten.n, r.one.n], [7, 1, 9, 8]);
  for (const k of ['thousand', 'hundred', 'ten', 'one']) { assert.equal(r[k].faces, 3, k); assert.equal(r[k].fills, 3, `${k} has 3 distinct face shades`); }
  assert.equal(r.thousand.lines, 54, '1000-cube shows 9+9 grid lines on each of 3 faces');
  assert.equal(r.hundred.lines, 36, 'flat: 10×10 front grid (18) + 9 top dividers + 9 side dividers');
  assert.equal(r.ten.lines, 18); assert.equal(r.one.lines, 0);
  // One shared unit u: rod and unit have the same footprint, and the cube's (W+D) span is 10× the unit's.
  assert.equal(r.ten.w, r.one.w);
  assert.ok(Math.abs((r.thousand.w - 2) / (r.one.w - 2) - 10) < 0.01);
  await ns.fill('#mabInput', '7198'); await ns.click('#btnSubmitAnswer');
  assert.match(await ns.textContent('#feedbackExplanation'), /seven thousand one hundred ninety-eight/);
});

test('@ENGINE-NO-ERRORS math modules raised no console or page errors during the suite', async () => {
  assert.deepEqual([...opsIssues.pageErrors, ...nsIssues.pageErrors], []);
  assert.deepEqual([...opsIssues.consoleErrors, ...nsIssues.consoleErrors], []);
});
