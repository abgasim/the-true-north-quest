# SPEC-CORE — Hub Architecture

**Product:** The True North Quest (`TheTrueNorthQuest.com`) · Grade 4 & 5 Canadian Social Studies and Mathematics
**Status:** Implemented · **Verified by:** `tests/hub.spec.mjs`, `tests/layout.spec.mjs`, `tests/pwa.spec.mjs`
**Related:** [SPEC-OFFLINE.md](SPEC-OFFLINE.md) · [SPEC-MODULES.md](SPEC-MODULES.md) · [TEST-SPECS.feature](TEST-SPECS.feature)

The keywords MUST, MUST NOT, SHOULD and MAY are used as in RFC 2119.

---

## 1. System overview

```
index.html  (hub: header · sidebar/drawer · stage toolbar · <iframe id="stageFrame">)
   │  LESSONS_REGISTRY ──► sidebar links (#/<id>) ──► iframe.src = <module>.html
   │  window.postMessage  ◄──── tnq:ready / tnq:progress / tnq:error
   │                      ────► tnq:print / tnq:ping
   ▼
<module>.html  (self-contained lesson; TNQ boot block in <head>)
sw.js           (generated; offline cache for hub + every module)
```

Each module is a single self-contained HTML file. It MUST work in three contexts:
inside the hub iframe, opened on its own, and from `file://` with no network.

## 2. Lesson registry

`LESSONS_REGISTRY` in `index.html` is the **single source of truth**. `tools/apply-boot.mjs`
and the test suite both parse it from that file.

| Field | Rule |
|---|---|
| `id` | MUST be unique, `snake_case`. Used as the deep link `#/<id>`. |
| `file` | MUST be a relative `snake_case.html` path that exists. |
| `title`, `desc`, `icon`, `curriculum` | MUST be non-empty. Text is English. |

Registered modules (11): `canada_capitals_game`, `canada_car_driving_box_map`, `canada_box_map_vector_icons`,
`cardinal_directions_studio`, `canada_complete_grade4_hub`, `number_sense_studio`, `column_ops_word_quest`,
`mental_math_studio`, `rounding_number_line`, `carpet_rolling_rounding`,
`printable_number_sense_quiz_generator`.

Adding a module means: add a registry entry, run `npm run boot`, then run `npm test`.

## 3. Iframe lifecycle and postMessage contract

### 3.1 Lifecycle

```
idle ──loadLesson()──► loading ──iframe load──► loaded ──tnq:ready──► ready
  ▲                                                                       │
  └──────────────────── navigate (sidebar / hash / reload) ◄──────────────┘
```

- `loadLesson(item)` sets `iframe.src`, the sidebar `aria-current`, the toolbar title and curriculum tag,
  `document.title` and `iframe.title`, shows the loading overlay, and updates `location.hash`.
- On `load` the overlay is hidden. If the frame is same-origin, the hub reads its pathname and
  resyncs the sidebar when a module navigated by itself.
- On `tnq:ready` the hub resyncs the sidebar from `module` (this works on `file://` too).

### 3.2 Message envelope

All messages are plain objects of the form `{ tnq: 1, type: string, module?: string, ...payload }`.

| Direction | `type` | Payload | Behaviour |
|---|---|---|---|
| module → hub | `tnq:ready` | `title, libs, fonts` | Fired on `DOMContentLoaded`. |
| module → hub | `tnq:progress` | `score, streak` | Hub shows ⭐ score · 🔥 streak in the toolbar. |
| module → hub | `tnq:error` | `message` (≤200 chars) | Uncaught error, for diagnostics. |
| hub → module | `tnq:print` | none | `window.print()` (fallback when direct frame access is blocked). |
| hub → module | `tnq:ping` | none | Module replies `tnq:pong`. |

### 3.3 Security rules

- The hub MUST accept a message only when `event.source === stageFrame.contentWindow`,
  `data.tnq === 1`, and, on http(s), `event.origin === location.origin`.
- A module MUST accept a message only when `event.source === window.parent`.
- `targetOrigin` is `location.origin` on http(s), and `'*'` on `file://` (where the origin is `"null"`).
- Registry text is inserted with `textContent` only, never `innerHTML`.

## 4. Viewport contract

| Width | Mode | Sidebar | Toggle (☰) |
|---|---|---|---|
| ≥ 1024 px | **Multi-pane** | Static 320 px pane | Collapses or expands the pane (`aria-expanded`). |
| < 1024 px | **Drawer** | Off-canvas, `min(86vw, 320px)` | Opens a drawer over a backdrop: `rgba(15,23,42,.55)` + `backdrop-filter: blur(6px)`. |

### 4.1 Drawer behaviour

- Opening the drawer moves focus to the current lesson link and makes `#stage` `inert`.
- Escape, the ✕ button, a backdrop tap, or choosing a lesson closes it, and focus returns to ☰.
- Crossing the 1024 px breakpoint closes the drawer and resets `aria-expanded`.

### 4.2 Height and safe areas

- The page is `height: 100dvh` (with a `100vh` fallback), and the body never scrolls.
- The header, drawer and stage pad for the iPhone notch and home bar with `env(safe-area-inset-*)`
  (`viewport-fit=cover`, status bar `black-translucent`).

### 4.3 Small screens and touch

- Below 640 px, labels collapse to icons.
- Below 380 px, the score chip is hidden.
- On `pointer: coarse`, every hub control is at least 44 × 44 px (WCAG 2.5.5).

### 4.4 Layout stability

- No page may scroll horizontally at 1440, 1024, 768, 390 or 360 px.
- Cumulative Layout Shift MUST be ≤ 0.001 at all of these widths.
- **Paint gate:** the boot runtime keeps `body` hidden until `DOMContentLoaded` (with a 3 s safety
  release), so the first paint already shows the final layout.

## 5. Accessibility (WCAG 2.1 AA)

- Skip link to the activity.
- Landmarks: header, `nav` with grouped lists, `main`.
- `aria-current="page"` on the active lesson; `aria-live` on the score.
- Visible `:focus-visible` outline.
- Text contrast ≥ 4.5:1. The active item is `#0369a1` with white text (5.9:1).
- `prefers-reduced-motion` turns off transitions.
- Modules MUST NOT disable pinch-zoom (`user-scalable=no` and `maximum-scale=1` are removed by the generator).

## 6. Installable app (PWA)

- `manifest.webmanifest` declares `standalone`, scope `./`, start `./index.html`, icons at 192 and 512 px,
  a maskable 512 px icon, and an SVG icon. `icons/apple-touch-icon.png` (180 px) covers iOS.
- `sw.js` is registered only in a secure context (https or localhost), never on `file://`.
- **Android / desktop:** `beforeinstallprompt` reveals a 📲 Install button.
- **iOS Safari:** the drawer shows a "Share → Add to Home Screen" hint.
- Once installed, the "Open Standalone" button is hidden, because a new window would leave the app.

## 7. Language

The product is **English-only**. There is no language switch, no translation table and no
Ethiopic font. `tests/hub.spec.mjs @NO-AMHARIC-SOURCE` fails the build if Ge'ez script, an Ethiopic
font or language-switching code reappears in the hub, any registered module, `tools/` or `specs/`.
