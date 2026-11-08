/* TNQ boot runtime v1.0.0
 * SOURCE OF TRUTH. This file is inlined into every registered module by
 * tools/apply-boot.mjs (see specs/SPEC-OFFLINE.md). Do not edit the inlined copies.
 * Constraints: ES5-safe, must never contain a closing script tag, no external requests except the
 * optional Google Fonts stylesheet (only when navigator.onLine is not false).
 */
(function (w, d) {
  'use strict';
  var B = w.TNQB || { s: {} };
  var me = d.currentScript;
  var TNQ = w.TNQ = w.TNQ || {};
  var GLOBALS = { tailwind: 'tailwind', tone: 'Tone', confetti: 'confetti' };

  TNQ.version = '1.0.0';
  TNQ.module = (me && me.getAttribute('data-tnq-module')) ||
    (location.pathname.split('/').pop() || '').replace(/\.html?$/i, '');
  TNQ.libs = B.s;

  /* ---- 1. Resolution step 3: inert stubs when local AND CDN both failed ---- */
  function toneStub() {
    var P;
    var f = function () { return P; };
    P = new Proxy(f, {
      get: function (t, k) {
        if (k === 'then') return function (ok) { if (typeof ok === 'function') ok(); return Promise.resolve(); };
        if (k === Symbol.toPrimitive) return function (hint) { return hint === 'string' ? '' : 0; };
        if (k === 'state') return 'suspended';
        return P;
      },
      set: function () { return true; },
      apply: function () { return P; },
      construct: function () { return P; }
    });
    return P;
  }
  Object.keys(B.s).forEach(function (k) {
    if (w[GLOBALS[k]]) return;
    B.s[k] = 'stub';
    if (k === 'tailwind') w.tailwind = { config: {} };
    if (k === 'tone') w.Tone = toneStub();
    if (k === 'confetti') {
      var c = function () { return Promise.resolve(); };
      c.reset = function () { };
      c.create = function () { return c; };
      w.confetti = c;
    }
  });

  /* ---- 2. Web fonts are an enhancement; native stacks are the baseline ---- */
  var fontHref = me && me.getAttribute('data-tnq-fonts');
  TNQ.fonts = 'native';
  if (fontHref && navigator.onLine !== false) {
    d.write('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
      '<link rel="stylesheet" href="' + fontHref.replace(/"/g, '&quot;') + '">');
    TNQ.fonts = 'web';
  }

  /* ---- 3. Paint gate (SPEC-CORE.md §4.4, zero layout shift) ----
   * Long modules render their UI from an end-of-body script; Chrome may paint the
   * partially parsed page first, then everything below the injected content jumps.
   * Hold paint until DOMContentLoaded (all sync scripts done). Written via JS, so a
   * no-JS visitor is never gated; released after 3 s no matter what. */
  d.write('<style id="tnq-gate">html:not(.tnq-ready) body{visibility:hidden}</style>');

  /* ---- 3b. Phone readability (SPEC-CORE.md §4.3) ----
   * Lessons were designed on desktop with Tailwind's 12 px text-xs and 9-11 px
   * micro-labels. On phone screens raise them to 14 px / 13 px. Screen only, so
   * print layouts are untouched; !important beats the Tailwind runtime's styles. */
  d.write('<style id="tnq-readable">@media screen and (max-width:640px){' +
    'html{-webkit-text-size-adjust:100%;text-size-adjust:100%;font-size:17px}' +
    '.text-xs{font-size:.875rem!important;line-height:1.25rem!important}' +
    '[class~="text-[8px]"],[class~="text-[9px]"],[class~="text-[10px]"],[class~="text-[11px]"]' +
    '{font-size:.8125rem!important;line-height:1.2!important}}</style>');
  var release = function () { d.documentElement.classList.add('tnq-ready'); };
  setTimeout(release, 3000);

  /* ---- 4. Hub bridge (postMessage contract, specs/SPEC-CORE.md §3) ---- */
  var inFrame = false;
  try { inFrame = w.parent && w.parent !== w; } catch (e) { inFrame = true; }
  var target = location.protocol === 'file:' ? '*' : location.origin;

  TNQ.post = function (type, data) {
    if (!inFrame) return false;
    var msg = { tnq: 1, type: type, module: TNQ.module };
    if (data) for (var k in data) if (Object.prototype.hasOwnProperty.call(data, k)) msg[k] = data[k];
    try { w.parent.postMessage(msg, target); return true; } catch (e) { return false; }
  };
  TNQ.progress = function (score, streak) { TNQ.post('tnq:progress', { score: score, streak: streak }); };

  w.addEventListener('message', function (e) {
    var m = e.data;
    if (!inFrame || e.source !== w.parent || !m || m.tnq !== 1) return;
    if (target !== '*' && e.origin !== target) return;
    if (m.type === 'tnq:ping') TNQ.post('tnq:pong');
    else if (m.type === 'tnq:print') w.print();
  });
  d.addEventListener('DOMContentLoaded', function () {
    release();
    TNQ.post('tnq:ready', { title: d.title, libs: B.s, fonts: TNQ.fonts });
  });
  w.addEventListener('error', function (e) {
    if (e && e.message) TNQ.post('tnq:error', { message: String(e.message).slice(0, 200) });
  });
})(window, document);
