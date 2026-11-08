// Shared Playwright harness for the TNQ test suite (see specs/TEST-SPECS.feature).
// Network modes (SPEC-OFFLINE.md §6):
//   offline-file : file:// URLs, context offline            -> libs must resolve 'local', fonts 'native'
//   cdn-only     : http server with /lib/* returning 404,    -> libs must resolve 'cdn'
//                  CDN URLs fulfilled from the local copies (simulated, deterministic)
//   nothing      : /lib/* 404 AND every external request aborted -> libs 'stub', zero page errors
//   no-internet  : local http server reachable, every external request aborted (LAN / classroom)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { readRegistry, LIBS } from '../../tools/apply-boot.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const REGISTRY = readRegistry();
export const MODULES = REGISTRY.flatMap((g) => g.items);

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };
// Keys normalised the way the browser reports them (https://cdn.tailwindcss.com -> .../ ).
const CDN_TO_LOCAL = Object.fromEntries(Object.values(LIBS).map((l) => [new URL(l.cdn).href, path.join(ROOT, l.local)]));

export function startServer({ libMissing = false } = {}) {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (libMissing && url.startsWith('/lib/')) { res.writeHead(404); return res.end('missing'); }
    const file = path.join(ROOT, url === '/' ? 'index.html' : url);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('nf'); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    resolve({ origin: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(r)) });
  }));
}

export async function launch() {
  try { return await chromium.launch(); } catch (e) {
    return chromium.launch({ channel: 'msedge' });   // fallback: system Edge
  }
}

export const fileUrl = (rel) => pathToFileURL(path.join(ROOT, rel)).href;

// Creates a browser context wired for a network mode, plus an issues collector.
export async function contextFor(browser, mode, options = {}) {
  const context = await browser.newContext({ ...options });
  if (mode === 'offline-file') await context.setOffline(true);
  if (mode === 'cdn-only' || mode === 'nothing' || mode === 'no-internet') {
    await context.route(/^https?:\/\//, (route) => {
      const u = route.request().url();
      if (u.startsWith('http://127.0.0.1')) return route.continue();
      if (mode === 'cdn-only' && CDN_TO_LOCAL[u]) return route.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(CDN_TO_LOCAL[u]) });
      if (mode === 'cdn-only' && /fonts\.(googleapis|gstatic)\.com/.test(u)) return route.fulfill({ status: 200, contentType: 'text/css', body: '/* fonts stub */' });
      return route.abort('internetdisconnected');
    });
  }
  return context;
}

export function collectIssues(page) {
  const issues = { consoleErrors: [], pageErrors: [], failedRequests: [] };
  page.on('console', (m) => { if (m.type() === 'error') issues.consoleErrors.push(`${m.text()} @ ${m.location()?.url || ''}`); });
  page.on('pageerror', (e) => issues.pageErrors.push(String(e && e.stack || e)));
  page.on('requestfailed', (r) => issues.failedRequests.push(`${r.url()} ${r.failure()?.errorText || ''}`));
  return issues;
}

// Open a module and wait until its boot runtime + scripts have run.
export async function openModule(page, url) {
  await page.goto(url, { waitUntil: 'load' });
  // Lessons expose window.TNQ; the hub is ready once its sidebar is built.
  await page.waitForFunction(() => (window.TNQ || document.querySelector('.lesson-item')) && document.readyState === 'complete');
  await page.waitForTimeout(150);   // let Tailwind's JIT observer settle
}

export const VIEWPORTS = {
  'desktop-1440': { width: 1440, height: 900 },
  'ipad-landscape': { width: 1024, height: 768 },
  'ipad-portrait': { width: 768, height: 1024 },
  'iphone-14': { width: 390, height: 844 },
  'android-360': { width: 360, height: 740 },
};
