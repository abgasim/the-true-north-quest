# The True North Quest

Interactive Grade 4 & 5 Canadian Social Studies and Mathematics activities. Works offline.

## Open it

| Where | How |
|---|---|
| **This computer, no internet** | Double-click `index.html`. |
| **A phone on the same Wi-Fi** | Run `npm run serve`, then type the "On your phone" address it prints into the phone's browser. |
| **Any phone, anywhere, offline-installable** | Publish the folder to a static https host (for example GitHub Pages), open the address once, then add it to the home screen (below). |

### Install on a phone (needs the https address)

- **iPhone / iPad (Safari):** Share button → **Add to Home Screen**. The menu (☰) shows the same hint.
- **Android (Chrome):** tap **📲 Install** in the top bar, or ⋮ → **Install app**.

After one visit with internet, every lesson opens with no connection (airplane mode included).

## For developers

```sh
npm install        # once: test tooling only (playwright-core); the site itself has no build step
npm run boot       # after adding/editing a module or tools/tnq-boot.js: stamps loaders + regenerates sw.js
npm test           # math engine, English-only guard, offline modes, hub, phone layout, print, PWA
npm run serve      # LAN server on port 8080 (PORT=xxxx to change)
```

- Lessons are registered in `LESSONS_REGISTRY` in `index.html`.
- Specs: [`specs/SPEC-CORE.md`](specs/SPEC-CORE.md), [`specs/SPEC-OFFLINE.md`](specs/SPEC-OFFLINE.md), [`specs/SPEC-MODULES.md`](specs/SPEC-MODULES.md), [`specs/TEST-SPECS.feature`](specs/TEST-SPECS.feature).
