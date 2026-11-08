# SPEC-MODULES — Module Contracts

**Status:** Implemented. M2 and M3 were refactored to this spec; the other modules were audited against it.
**Verified by:** `tests/acceptance.spec.mjs`, `tests/print.spec.mjs`, `tests/offline.spec.mjs`

## 0. Contract shared by every module

- MUST contain a current TNQ boot block ([SPEC-OFFLINE §3](SPEC-OFFLINE.md)), keep pinch-zoom enabled,
  and have no horizontal scroll at ≥ 360 px.
- Modules are English-only: no language switch, no translation dictionaries keyed by language, `<html lang="en">`.

---

## Social Studies

### S1 `canada_capitals_game.html`: Capitals Quest *(audited, compliant)*

- **Postal matcher:** a 2-column board pairing the 13 codes `BC AB SK MB ON QC NB NS PE NL YT NT NU` with provinces and territories.
- **SVG silhouette map:** a fill-in quiz.
- **3D flip study cards:** `rotateY` with `backface-visibility`.
- **Print layout:** `switchGameMode('print')` shows `#printContainer` on US Letter with `.print-card-box { break-inside: avoid }`.
- `canadian_capitals_game_printable_cards.html` is an older subset with no matcher. It is not registered.

### S2 `canada_car_driving_box_map.html` · S3 `cardinal_directions_studio.html` · S4 `canada_box_map_vector_icons.html` · S5 `canada_complete_grade4_hub.html` *(audited)*

These use plain CSS (no Tailwind) and load no third-party libraries. Their boot block carries only
the runtime: bridge, fonts and paint gate. S3 synthesises audio with Web Audio directly.

---

## Mathematics

### M1 `column_ops_word_quest.html`: Operation Grid & Word Quest *(refactored)*

#### Engine `window.TNQMath`

Pure functions; column index `p` = power of ten (ones = 0). Input ids are `ans_<p>` and `carry_<p>`.

| Function | Contract |
|---|---|
| `columnAdd(a,b)` | Per-column `{top,bottom,carryIn,sum,digit,carryOut}`. `marks[p] = '1'` where a carry enters column `p`. Also `regroupPlaces`, `regroupCount`, `overflow`. |
| `columnSub(a,b)` | Borrow **only** when the working top digit < the bottom digit. Borrow from the nearest non-zero column to the left; zeros in between become 9. Per-column `{topOriginal, topBefore, topWorking, borrowed, lender, digit}`. `marks[p]` = final working digit where it changed, else `''`. Also `acrossZero`. |
| `validateMarks(sol, entered)` | The regroup row is optional, but anything written must be necessary and correct. Returns `{ok, unnecessary[], wrong[], missing[]}`. |
| `validateAnswer(sol, entered)` | Checks each digit separately. Blank is accepted **only** for leading zeros. |
| `classifyClue(text)` | Strips HTML, then searches the **question sentence** first, then the whole story. Longest phrase wins. Returns `{op, phrase, scope}`. |

#### Worked example: 5944 − 3769

| Column | Before | Action | Working | Digit |
|---|---|---|---|---|
| ones | 4 | 4 < 9 → borrow from tens (4 → 3) | 14 | 5 |
| tens | **3** | 3 < 6 → borrow from hundreds (9 → 8) | **13** | **7** |
| hundreds | 8 | 8 ≥ 7 | 8 | 1 |
| thousands | 5 | 5 ≥ 3 | 5 | 2 |

Result **2175**. Borrow row (thousands → ones): `[ '', 8, 13, 14 ]`.

#### Grading outcomes

| Outcome | Condition | Score | Feedback |
|---|---|---|---|
| `correct` | Answer right, no wrong or unnecessary marks | +10 | Success. |
| `unnecessary` | Answer right, but a mark sits where no regrouping happens (e.g. 7685 − 2142) | 0, streak kept | Explains that zero borrows are needed. |
| `wrong-mark` | Answer right, but a mark has the wrong value | 0 | Points to the column. |
| `wrong` | Any digit wrong | 0, streak reset | Names the first wrong column (scanning from the left) and the expected answer. |

The strategy tip is **computed** from the engine (regroup places and count, plus "watch the zero").
Tips never reveal the answer.

#### Clue rules

- **Subtraction:** how many more, how much more, how much further, how many left, how much change,
  change back, not sold, gave away, take away, decreased by, fewer (than), difference, remaining,
  remain, further, spent, lost, left.
- **Addition:** in total, total sum, total amount, altogether, all together, increased by, added to,
  combined, (in) both, total, plus, sum, gained.
- Narrative verbs such as "earned" are deliberately excluded.
- Detective mode takes the expected operation from `classifyClue`, not from hand-entered data.

#### Banks and generator

- 10 addition, 10 subtraction and 10 word problems.
- 24 numberless clue terms (12 +, 12 −).
- Drop Bins shuffles a copy of the clue bank and never mutates it.
- The printable sheet has 3 parts (10 problems each), page breaks between parts, and an answer key
  that includes carry/borrow marks.

### M2 `number_sense_studio.html` *(refactored)*

- **Place value:** highlighting is by exact index (`highlightDigitByIndex`, `data-target`), never by
  searching for the digit. 5508 highlights only index 1.
- **Number words (`window.TNQNumber`):**
  - `enWords` and `amWords` cover 0–9999.
  - English: hyphenated 21–99, no "and".
  - Answers are matched case-insensitively; hyphens, extra spaces and "and" are ignored ("one hundred and twelve" = "one hundred twelve"); misspellings such as "fourty" are rejected.
- **Isometric MAB blocks (`window.MAB.piece`):**
  - Inline SVG, projection `P(x,y,z) = ((x−y)·u·cos30°, (x+y)·u·sin30° − z·u)`, one shared `u = 4.4`
    so pieces are to scale.
  - Three faces (top, front-left, front-right), each a different shade.

    | Piece | Size | Grid lines |
    |---|---|---|
    | Thousand | 10×10×10 | 54 |
    | Flat | 10×1×10 | 36 |
    | Rod | 1×1×10 | 18 |
    | Unit | 1×1×1 | 0 |

  - The group carries `role="img"` and a localised `aria-label`.

### M3 `printable_number_sense_quiz_generator.html` *(audited, print fixed)*

Renders before first paint. In print, `.no-print` is hidden, and tilted stickers print straight
so they don't overhang the page edge.

### M4 `rounding_number_line.html` · M5 `carpet_rolling_rounding.html` *(audited, compliant)*

Distance brackets for 10, 100 and 1000. Midpoint = lower + step/2; a value at or past the midpoint rounds up.
In the carpet module, the effort meters show `distLower/step` and `distUpper/step`, and a value exactly
at the midpoint "rolls forward" (rounds up).

### M6 `mental_math_studio.html` *(audited, layout-shift fixed)*

Renders synchronously instead of in `window.onload`.

---

## Legacy drafts

Earlier drafts and duplicates are not part of this project. They remain only in the old
`../the-true-north-quest/` folder (with its git history) and are never loaded by the hub.
