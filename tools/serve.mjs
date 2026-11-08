#!/usr/bin/env node
// Serve the hub to phones/tablets on the same Wi-Fi:   npm run serve   (PORT=8080 by default)
// Prints every LAN address to type into the phone's browser. Zero dependencies.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 8080;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};
const BLOCKED = /^\/(node_modules|\.git|tests|tools)(\/|$)/;

const server = http.createServer((req, res) => {
  let url;
  try { url = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); return res.end(); }
  if (BLOCKED.test(url)) { res.writeHead(404); return res.end('Not found'); }
  const file = path.join(ROOT, url.endsWith('/') ? url + 'index.html' : url);
  if (!file.startsWith(ROOT + path.sep) && file !== ROOT) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, {
      'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-cache',
      'service-worker-allowed': '/',
    });
    fs.createReadStream(file).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const lan = Object.values(os.networkInterfaces()).flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
  console.log('\n  The True North Quest is running.\n');
  console.log(`  On this computer:  http://localhost:${PORT}/`);
  for (const ip of lan) console.log(`  On your phone:     http://${ip}:${PORT}/   (same Wi-Fi)`);
  console.log('\n  If the phone cannot connect, allow Node.js through Windows Firewall (Private networks).');
  console.log('  Note: offline install needs HTTPS (e.g. GitHub Pages); over Wi-Fi the site works while connected.');
  console.log('  Press Ctrl+C to stop.\n');
});
