// hero-boot.js · the estate hero's gate and loader (classic script, defer, after app.js so I18N exists).
//
// Without WebGL2, import maps or DecompressionStream the page is left exactly as it is (poster hero).
// On data saver, slow connections or reduced data it shows the poster plus a small opt-in button.
// Otherwise it wraps the hero in a scroll runway (sticky stage), waits for the poster and an idle moment,
// then injects the import map, hero.css and hero.js. The 3D builds hidden; hero.js dissolves the photo into it as
// the visitor scrolls.
//
// Test flags: ?hero=off (act as data saver), ?hero=nogl (act as no WebGL), ?hero=lite (phone tier),
// ?hero=still (act as reduced motion), ?hero=full (no aerial pruning, to compare), ?hero=lodlive (work the pruning out
// here instead of using bake/hero-lod.<ver>.json), ?hero=none (do nothing at all).
(function () {
  'use strict';
  var hero = document.querySelector('section.hero--cinematic');
  if (!hero || hero.getAttribute('data-hx')) return;
  var me = document.currentScript;
  var host = document.getElementById('hero3d');
  // the script's own folder (walkthrough/), or #hero3d's data-base as a fallback
  var base = me && me.src ? new URL('./', me.src).href : new URL((host && host.getAttribute('data-base')) || 'walkthrough/', location.href).href;
  var Q = new URLSearchParams(location.search), flag = Q.get('hero');
  if (flag === 'none') return;

  // keep in step with versions.js THREE_URL
  var THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js';
  var ADDONS = 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/';
  var V = '115';   // bump with any hero file change

  // English strings (hx.*), merged into the site's I18N where missing. BM and ZH live in app.js (I18N.bm, I18N.zh);
  // a key missing there falls back to this English.
  var EN = {
    'hx.optin': 'View the estate in 3D',
    'hx.optin.note': 'about 1.6 MB',
    'hx.loading': 'Loading the estate',
    'hx.stage': '3D view of the estate',
    'hx.stage.role': '3D estate view',
    'hx.l1': '16 semi-detached homes and 3 bungalows.',
    'hx.l2': "A children's playground on the central green.",
    'hx.l3': 'Scroll on, then walk inside either home.',
    'hx.l3app': 'Drag to look around, then walk inside either home.',
    'hx.pins': 'Places in the estate',
    'hx.pin.semid': 'Semi-D',
    'hx.pin.bungalow': 'Bungalow',
    'hx.pin.features': 'Site features',
    'hx.next': 'Next',
    'hx.prev': 'Previous',
    'hx.sound': 'Countryside sound',
    'hx.walk': 'Walk inside',
    'hx.walk.sd': 'Walk inside the Semi-D →',
    'hx.walk.bg': 'Walk inside the bungalow →',
    'hx.close': 'Close',
    'hx.tod': 'Time of day',
    'hx.tod.day': 'Day',
    'hx.tod.golden': 'Golden hour',
    'hx.tod.night': 'Night',
    'hx.choose': 'Choose a home',
    'hx.tour': '3D walkthrough',
    'hx.back': 'Back to estate',
    'hx.prep': 'Preparing the rooms',
    'hx.other.semid': 'Walk the Semi-D',
    'hx.other.bungalow': 'Walk the bungalow',
    'hx.loc.back': 'Back to the 3D estate',
    'hx.pin.location': 'Location',
    'nav.pricing': 'Pricing',
    'nav.faq': 'FAQ',
    'nav.menu': 'Site menu',
    'hx.gallery': 'Gallery'
  };
  var dictOf = function (l) { try { return (typeof I18N !== 'undefined' && I18N[l]) || null; } catch (e) { return null; } };
  var en = dictOf('en');
  if (en) for (var k in EN) if (en[k] == null) en[k] = EN[k];
  var lang = function () { try { return typeof currentLang !== 'undefined' ? currentLang : 'en'; } catch (e) { return 'en'; } };
  var t = function (key) { var d = dictOf(lang()); if (d && d[key] != null) return d[key]; return (en && en[key] != null) ? en[key] : (EN[key] || key); };

  var mm = function (q) { return !!(window.matchMedia && matchMedia(q).matches); };
  var nav = navigator, con = nav.connection || {};
  var supported = flag !== 'nogl' && 'WebGL2RenderingContext' in window && typeof DecompressionStream !== 'undefined' &&
    !!(HTMLScriptElement.supports && HTMLScriptElement.supports('importmap')) && 'IntersectionObserver' in window;
  var unApp = function () { document.documentElement.classList.remove('hx-app'); };   // the page's early switch (its <head>), undone
  if (!supported) { unApp(); return; }   // the poster hero stays as it is
  // crawlers and automated browsers (Googlebot renders with Chromium and WebGL2) get the ordinary scrolling page:
  // the same DOM and words as any visitor without 3D, so every section is visible to them (not cloaking).
  // Any ?hero= test flag skips this check, so automated local testing still sees the 3D.
  var bot = !flag && (!!nav.webdriver || /bot|crawl|spider|slurp|Google-InspectionTool|Chrome-Lighthouse|HeadlessChrome|GPTBot|ClaudeBot|PerplexityBot|bingpreview/i.test(nav.userAgent || ''));
  if (bot) { unApp(); return; }
  // app mode (owner, Nov 2026): the site as one 3D screen, tapped through like an app; ?hero=scroll keeps the
  // scroll-played page
  var app = flag !== 'scroll';
  var careful = flag === 'off' || !!con.saveData || /^(slow-2g|2g|3g)$/.test(con.effectiveType || '') ||
    (nav.deviceMemory && nav.deviceMemory < 2) || mm('(prefers-reduced-data: reduce)');
  var lite = careful || flag === 'lite' || mm('(pointer: coarse)') || (nav.deviceMemory && nav.deviceMemory <= 4) || mm('(max-width: 760px)');
  var reduced = flag === 'still' || mm('(prefers-reduced-motion: reduce)');
  if (!app || careful) unApp();   // the scrolling page (and the data-saver opt-in) keep the page as it is

  // ---- the runway: the hero becomes a sticky stage over about three screens of scroll ----
  var RUN = 3.2;   // runway height in screens (the stage itself is one of them)
  var unit = (window.CSS && CSS.supports && CSS.supports('height', '1svh')) ? 'svh' : 'vh';
  var runway = null;
  function wrap() {
    if (runway || app) return;   // app mode: one screen, no scroll runway
    if (window.innerHeight < 520) return;   // too short for a sticky stage: the hero scrolls normally, the camera follows it out
    runway = document.createElement('div');
    runway.className = 'hx-runway';
    runway.style.cssText = 'position:relative;height:' + (RUN * 100) + unit + ';';
    hero.parentNode.insertBefore(runway, hero);
    runway.appendChild(hero);
    hero.style.position = 'sticky'; hero.style.top = '0'; hero.style.height = '100' + unit;
    // phones: the copy sits a little lower so the 3D gets more of the band under the top bar.
    // Set here, before first paint, so the copy does not jump when the 3D fades in (layout shift).
    var inner = hero.querySelector('.hero-inner');
    if (inner && mm('(max-width: 760px)')) inner.style.paddingBottom = 'clamp(92px, 11vh, 112px)';   // room above the walk button and its pulse
  }
  // undo the runway (3D failed): keep what the visitor sees in place
  function unwrap() {
    if (!runway) return;
    var r = runway.getBoundingClientRect(), extra = runway.offsetHeight - hero.offsetHeight, below = r.bottom < window.innerHeight;
    hero.style.position = hero.style.top = hero.style.height = '';
    var inner = hero.querySelector('.hero-inner'); if (inner) inner.style.paddingBottom = '';
    runway.parentNode.insertBefore(hero, runway); runway.parentNode.removeChild(runway); runway = null;
    if (below && extra > 0) window.scrollBy(0, -extra);
  }

  var state = 'idle';
  function fail(err) {
    if (err) console.warn('hero 3D: the poster stays', err);
    hero.setAttribute('data-hx', 'failed');
    hero.classList.remove('hx-on', 'hx-live', 'hx-done');
    var st = hero.querySelector('.h3d-stage'), ui = hero.querySelector('.h3d-ui');
    if (st) st.parentNode.removeChild(st); if (ui) ui.parentNode.removeChild(ui);
    document.documentElement.classList.remove('hx-app', 'hx-app-ready', 'hxa-open', 'hxa-cap-on');   // never a locked page without its 3D
    unwrap();
  }
  function addLink(rel, href, extra) {
    var l = document.createElement('link'); l.rel = rel; l.href = href;
    if (extra) for (var k in extra) l.setAttribute(k, extra[k]);
    document.head.appendChild(l); return l;
  }
  function load() {
    if (state !== 'idle') return;
    state = 'loading';
    performance.mark('hx-boot');
    if (!document.querySelector('script[type="importmap"]')) {
      var s = document.createElement('script'); s.type = 'importmap';
      s.textContent = JSON.stringify({ imports: { three: THREE_URL, 'three/addons/': ADDONS } });
      document.head.appendChild(s);
    }
    addLink('preconnect', 'https://cdn.jsdelivr.net', { crossorigin: '' });
    addLink('modulepreload', THREE_URL, { crossorigin: '' });
    // as hero.js imports them (keep in step with its import lines: a stale ?v= here is a second, wasted download)
    var VER = { 'hero.js': V, 'hero-lod.js': '4', 'hero-tod.js': '9', 'hero-orbit.js': '2', 'hero-rig.js': '5', 'pack.js': '3', 'hd.js': '7', 'versions.js': '1' };
    Object.keys(VER).forEach(function (f) { addLink('modulepreload', base + f + '?v=' + VER[f]); });
    addLink('modulepreload', ADDONS + 'utils/BufferGeometryUtils.js', { crossorigin: '' });
    addLink('stylesheet', base + 'hero.css?v=' + V);
    hero.classList.add('hx-on');
    import(base + 'hero.js?v=' + V).then(function (m) {
      return m.start({ app: app, hero: hero, runway: runway, base: base, lite: lite, careful: careful, reduced: reduced, t: t, fail: fail, flag: flag });
    }).catch(fail);
  }
  // after the poster has painted and the page is idle, and only while the hero is on screen
  function whenCalm(fn) {
    var img = hero.querySelector('.hero-slide');
    var idle = window.requestIdleCallback || function (f) { return setTimeout(f, 200); };
    var frame = function (f) {   // rAF, or a timer where rAF is throttled though the page is shown
      var done = false, run = function () { if (!done) { done = true; f(); } };
      requestAnimationFrame(run); setTimeout(run, 120);
    };
    var go = function () { frame(function () { frame(function () { idle(fn, { timeout: 800 }); }); }); };
    if (!img || (img.complete && img.naturalWidth)) go();
    else { img.addEventListener('load', go, { once: true }); img.addEventListener('error', go, { once: true }); }
  }
  function whenVisible(fn) {
    var r = (runway || hero).getBoundingClientRect();
    if (r.bottom > 0 && r.top < window.innerHeight) { fn(); return; }   // on screen now
    var io = new IntersectionObserver(function (es) {
      for (var i = 0; i < es.length; i++) if (es[i].isIntersecting) { io.disconnect(); fn(); return; }
    });
    io.observe(runway || hero);
  }

  // app.js shows the pre-launch bar once the page passes the hero's bottom, measured before the runway existed:
  // keep it hidden until the runway has been scrolled through (this listener runs after app.js's own).
  function holdBar() {
    if (!runway) return;
    var bar = document.getElementById('prelaunch-bar');
    if (!bar || !bar.classList.contains('is-visible')) return;
    if (runway.getBoundingClientRect().bottom - 140 > 0) {
      bar.classList.remove('is-visible'); document.body.classList.remove('has-prelaunch-bar');
      document.documentElement.style.setProperty('--prelaunch-h', '0px');
    }
  }
  document.addEventListener('DOMContentLoaded', function () {
    window.addEventListener('scroll', holdBar, { passive: true }); window.addEventListener('resize', holdBar); holdBar();
  });

  window.__hx = { t: t, EN: EN, lite: lite, careful: careful, reduced: reduced, fail: fail, load: load };

  if (careful) {   // poster, plus an opt-in button
    hero.setAttribute('data-hx', 'optin');
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'hx-optin';
    // phones: the copy fills the lower screen and the dock covers the bottom, so the button sits at the top of the poster
    var spot = mm('(max-width: 760px)') ? 'top:16px;' : 'bottom:clamp(18px,4vh,40px);';
    b.style.cssText = 'position:absolute;z-index:4;right:clamp(16px,3vw,44px);' + spot + 'display:inline-flex;gap:10px;align-items:center;' +
      'padding:10px 16px;border-radius:999px;border:1px solid rgba(242,233,223,0.45);background:rgba(22,15,10,0.45);color:#F2E9DF;' +
      'font:500 12px/1.2 "Inter Tight",system-ui,sans-serif;letter-spacing:0.04em;cursor:pointer;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);';
    var s1 = document.createElement('span'); s1.setAttribute('data-i18n', 'hx.optin'); s1.textContent = t('hx.optin');
    var s2 = document.createElement('span'); s2.setAttribute('data-i18n', 'hx.optin.note'); s2.textContent = t('hx.optin.note'); s2.style.opacity = '0.7';
    b.appendChild(s1); b.appendChild(s2);
    b.addEventListener('click', function () { b.parentNode.removeChild(b); wrap(); load(); });
    hero.appendChild(b);
    return;
  }
  hero.setAttribute('data-hx', 'on');
  wrap();
  // a deep link into the app (#pricing, ...) loads at once: the browser has scrolled to that section, off the hero
  var deep = app && /^#(estate|site|location|bertam|homes|bungalow|semid|pricing|calculator|faq|register)$/.test(location.hash);
  whenCalm(function () { if (deep) load(); else whenVisible(load); });
})();
