# Behavioural acceptance criteria for The True North Quest.
# Every @TAG maps to exactly one test title prefix in tests/*.spec.mjs (enforced by tests/meta.spec.mjs).
# Run: npm test

Feature: Column regrouping engine (column_ops_word_quest.html)

  @SUB-BORROW-CASCADE
  Scenario: Borrowing remediation for 5944 − 3769
    Given a 4-digit subtraction grid with 5944 − 3769
    When the user evaluates the ones column
    Then the ones borrow from the tens, the tens drop from 4 to 3 and the ones work with 14, giving 5
    When the user evaluates the tens column
    Then the borrow cascade reduces the hundreds from 9 to 8
    And the tens working value becomes 13
    And the tens result digit is 7
    And the final result is 2175
    And the expected borrow row reads "8, 13, 14" above hundreds, tens and ones
    And an answer of 2175 written with that borrow row is marked correct

  @SUB-NO-SPURIOUS-BORROW
  Scenario: Unnecessary borrowing prevention for 7685 − 2142
    Given a 4-digit subtraction grid with 7685 − 2142 where every top digit exceeds the bottom digit
    Then the validation engine reports zero borrows and expects 5543
    When the user writes 5543 and enters borrow marks above the tens and ones
    Then the attempt is flagged "unnecessary" naming those columns
    And the feedback explains that the problem needs zero borrows
    And no score is awarded
    When the user clears the borrow row
    Then 5543 is marked correct

  @SUB-ZERO-PLACEHOLDER
  Scenario: Borrowing across a zero placeholder
    Given 8504 − 3276 and 6500 − 4235
    Then each zero passed over becomes 9 and the lending column drops by 1
    And the results are 5228 and 2265

  @ADD-CARRY
  Scenario: Multi-column carrying for 2894 + 4637
    Then carries enter the tens, hundreds and thousands columns and the sum is 7531
    And a carry mark written above the ones column is rejected as unnecessary

  @GRID-DIGIT-INTEGRITY
  Scenario: A blank inner column cannot shift the answer
    Given 2376 − 1657 = 0719
    When the user enters "7", blank, "1", "9" from thousands to ones
    Then the answer is wrong
    But blank, "7", "1", "9" is correct because only leading zeros may be left blank

  @BANK-INTEGRITY
  Scenario: Every bank problem is internally consistent
    Then there are 10 addition, 10 subtraction and 10 word problems
    And every engine result matches integer arithmetic with no 4-digit overflow

  @WORKSHEET-10
  Scenario: Printable worksheet generator
    When the Print Sheet mode is opened
    Then 10 addition grids, 10 subtraction grids and 10 word stories are rendered
    And the answer key shows the regroup marks

Feature: Word clue detective

  @CLUE-ADD
  Scenario: Addition clue phrases
    Given a problem containing the clue phrase "in total" or "altogether"
    When evaluated
    Then the system rejects subtraction and validates addition

  @CLUE-SUB
  Scenario: Subtraction clue phrases
    Given a problem containing "how many left" or "how much further"
    When evaluated
    Then the system rejects addition and validates subtraction

  @CLUE-BANK
  Scenario: Every story is decided by its question sentence
    Then every word-bank story classifies to its declared operation from the question sentence

  @CLUE-VOCAB
  Scenario: 24-term numberless vocabulary
    Then the clue bank has 24 unique terms, 12 for addition and 12 for subtraction, and no digits
    And opening Drop Bins never reorders the master bank

Feature: English-only content

  @ENGLISH-ONLY
  Scenario: No Amharic anywhere in the math modules
    When every mode of Column Ops and every category of Number Sense is shown, including feedback
    Then no visible text, title, aria-label or placeholder contains Ge'ez script
    And the page language is "en" and no language-switch functions exist
    And the word and clue banks carry no Amharic fields

  @NS-NUMBER-WORDS
  Scenario: English number words
    Then 7198 is "seven thousand one hundred ninety-eight" and 112 is "one hundred twelve"
    And "Forty six" and "one hundred and twelve" are accepted, but "fourty-six" is rejected

  @NS-EXACT-INDEX
  Scenario: Exact-index digit highlighting without string collision
    Given the number 5508 with target index 1
    Then only the second "5" is highlighted and its value is 500

  @NS-MAB-ISO
  Scenario: Isometric MAB blocks
    Given 7 thousands, 1 hundred, 9 tens and 8 ones
    Then 7 cubes, 1 flat, 9 rods and 8 units are drawn as SVG with three shaded faces each
    And every piece shares one unit scale

  @ENGINE-NO-ERRORS
  Scenario: No console or page errors while exercising the math modules

Feature: Offline-first loading

  @OFFLINE-ZERO-ERRORS
  Scenario: Opened from disk with no network
    Then every module loads its libraries from ./lib with zero console errors and no network requests

  @OFFLINE-CDN-FALLBACK
  Scenario: ./lib missing on a host
    Then every library resolves from its pinned CDN URL

  @OFFLINE-STUBS
  Scenario: Neither ./lib nor network
    Then libraries resolve to inert stubs, the module stays playable and no page error occurs

  @OFFLINE-FONT-STACK
  Scenario: Fonts without Google Fonts
    Then every module's font stack includes Segoe UI, -apple-system and Roboto, and no Ethiopic font

Feature: Hub

  @HUB-REGISTRY
  Scenario: Manifest and module audit
    Then registry ids and files are unique snake_case, every file exists and has a current boot block, and none blocks zoom

  @HUB-POSTMESSAGE
  Scenario: postMessage contract
    Then tnq:ready syncs the sidebar, tnq:progress updates the toolbar score, and messages from other sources are ignored

  @HUB-DEEPLINK
  Scenario: Deep links
    Then "#/<id>" opens that module and an unknown id falls back to the first module

  @HUB-DRAWER
  Scenario: Responsive drawer
    Given a 390 px phone
    Then the menu opens a drawer over a blurred backdrop, the stage is inert, Escape closes it and focus returns
    And at 1440 px the sidebar is a static pane

  @NO-AMHARIC-SOURCE
  Scenario: The shipped source stays English-only
    Then the hub, every registered module, tools/ and specs/ contain no Ge'ez script, no Ethiopic font and no language-switching code

Feature: Mobile, layout and print

  @LAYOUT-NO-SHIFT
  Scenario: Zero layout shift at desktop, iPad landscape/portrait, iPhone and 360 px
    Then no page scrolls horizontally and cumulative layout shift is at most 0.001

  @MOBILE-TOUCH
  Scenario: Touch targets
    Then every hub control is at least 44 × 44 px on a touch screen

  @MOBILE-VIEWPORT
  Scenario: Phone viewport
    Then every page allows pinch-zoom, and the hub fills exactly one screen with the lesson taking most of it

  @PRINT-FIDELITY
  Scenario: CSS @media print fidelity for every generator view
    Then controls are hidden, the worksheet is visible, nothing passes the page edge, and a US Letter PDF paginates

  @PWA-MANIFEST
  Scenario: Installable on Android and iOS
    Then the manifest is standalone with 192/512 and maskable icons, plus an apple-touch-icon

  @PWA-PRECACHE
  Scenario: Complete offline cache
    Then sw.js precaches the hub, every registered module and every local library

  @PWA-OFFLINE
  Scenario: Airplane mode after one visit
    Given the hub was opened once online on a phone
    When the network is turned off
    Then the hub and every lesson open from the cache with local libraries
