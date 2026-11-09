/* ─────────────────────────────────────────────
   Home toggle: Semi-D | Bungalow
   A sticky pill in the top bar picks which house type the page shows.
   Only home-specific blocks switch (hero price chip, the #homes / #bungalow
   sections, the two pricing cards). Everything else is shared.

   · Default Semi-D. "#bungalow" or "?home=bungalow" opens on Bungalow.
     Nothing is stored; the URL is kept shareable with history.replaceState.
   · Without JS (or if this file fails) both homes show, as before.
   · Contract for the 3D hero (walkthrough/):
       document.documentElement.dataset.home = 'semid' | 'bungalow'
       window 'panthera:home' CustomEvent, detail { home, source }
         source: 'pill' | 'url' | 'hero'
       This file listens for source 'hero' and follows it. The hero should
       ignore events whose source is 'hero' (they are its own echo).
       window.PantheraHome = { get(), set(home, source) }
   Loaded after app.js (classic, defer), so it runs before app.js's
   DOMContentLoaded init, which then translates the injected pill.
   ───────────────────────────────────────────── */
(function(){
  "use strict";

  var HOMES = ["semid", "bungalow"];
  var SECTION_ID = { semid: "homes", bungalow: "bungalow" };
  var FADE_OUT = 140, FADE_IN = 240;

  var root = document.documentElement;
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
  var current = null;
  var pill = null, buttons = [];
  var heroV = null, heroK = null;
  var swapToken = 0;

  function valid(h){ return HOMES.indexOf(h) !== -1; }
  function other(h){ return h === "semid" ? "bungalow" : "semid"; }
  function motionOK(){ return !(reduceMotion && reduceMotion.matches); }
  function lang(){
    try { return (typeof currentLang === "string" && currentLang) || "en"; } catch (e) { return "en"; }
  }
  function t(key, fallback){
    try {
      var d = (typeof I18N === "object" && I18N) ? (I18N[lang()] || I18N.en) : null;
      if (d && d[key] != null) return d[key];
      if (typeof I18N === "object" && I18N && I18N.en && I18N.en[key] != null) return I18N.en[key];
    } catch (e) {}
    return fallback;
  }

  /* ── Which elements belong to which home ─────── */
  function blocks(home){
    var out = [];
    var sec = document.getElementById(SECTION_ID[home]);
    if (sec) out.push(sec);
    var cards = document.querySelectorAll('#pricing .prc-card[data-home="' + home + '"]');
    for (var i = 0; i < cards.length; i++) out.push(cards[i]);
    return out;
  }
  function allBlocks(){ return blocks("semid").concat(blocks("bungalow")); }
  function tagBlocks(){
    HOMES.forEach(function(h){
      blocks(h).forEach(function(el){ el.setAttribute("data-home-block", h); });
    });
  }

  /* ── Reading the URL ─────────────────────────── */
  function homeFromHash(hash){
    var id = (hash || "").replace(/^#/, "");
    if (id === SECTION_ID.semid) return "semid";
    if (id === SECTION_ID.bungalow) return "bungalow";
    return null;
  }
  function homeFromQuery(){
    try {
      var v = new URLSearchParams(location.search).get("home");
      if (v === "bungalow" || v === "semid") return v;
      if (v === "semi-d" || v === "semi" || v === "semid") return "semid";
    } catch (e) {}
    return null;
  }
  function writeUrl(home){
    if (!window.history || !history.replaceState) return;
    try {
      var url = new URL(location.href);
      if (home === "bungalow") url.searchParams.set("home", "bungalow");
      else url.searchParams.delete("home");
      // A hash that points at the other home's section would override the
      // param when the link is shared, so point it at the shown section.
      var hh = homeFromHash(url.hash);
      if (hh && hh !== home) url.hash = "#" + SECTION_ID[home];
      var next = url.pathname + url.search + url.hash;
      if (next !== location.pathname + location.search + location.hash){
        history.replaceState(history.state, "", next);
      }
    } catch (e) {}
  }

  /* ── Scroll anchoring across the swap ────────── */
  function topLine(){
    var bar = document.querySelector(".topbar");
    var y = bar ? bar.getBoundingClientRect().bottom : 0;
    if (pill && getComputedStyle(pill).position === "absolute"){   // floating under the bar
      var r = pill.getBoundingClientRect();
      if (r.bottom > y) y = r.bottom;
    }
    return Math.max(0, y) + 2;
  }
  function isShown(el){ return !el.hidden && el.getClientRects().length > 0; }
  function inSwapped(el){ return !!(el.closest && el.closest("[data-home-block]")); }

  function captureAnchor(shownHome){
    var line = topLine();
    // Inside a home section: after the swap, land on the new section's top.
    var sec = shownHome ? document.getElementById(SECTION_ID[shownHome]) : null;
    if (sec && isShown(sec)){
      var r = sec.getBoundingClientRect();
      if (r.top <= line && r.bottom > line) return { mode: "section" };
    }
    // Otherwise pin the deepest shared block that crosses the top line.
    var cands = document.querySelectorAll("body > section, body > footer, section > .wrap > *, .price-ranges");
    var best = null, firstBelow = null;
    for (var i = 0; i < cands.length; i++){
      var el = cands[i];
      if (inSwapped(el) || !isShown(el)) continue;
      var b = el.getBoundingClientRect();
      if (b.height <= 0) continue;
      if (b.top <= line && b.bottom > line) best = el;            // document order, so deeper wins
      else if (!firstBelow && b.top > line) firstBelow = el;
    }
    var anchor = best || firstBelow;
    return anchor ? { mode: "anchor", el: anchor, top: anchor.getBoundingClientRect().top } : null;
  }
  function instantScrollTo(y){
    try { window.scrollTo({ top: y, left: window.scrollX, behavior: "instant" }); }
    catch (e) { window.scrollTo(window.scrollX, y); }
  }
  function restoreAnchor(a, home){
    if (!a) return;
    if (a.mode === "section"){
      var sec = document.getElementById(SECTION_ID[home]);
      if (!sec) return;
      var y = window.scrollY + sec.getBoundingClientRect().top - topLine() + 2;
      instantScrollTo(Math.max(0, Math.round(y)));
      return;
    }
    var delta = a.el.getBoundingClientRect().top - a.top;
    if (Math.abs(delta) > 1) instantScrollTo(Math.round(window.scrollY + delta));
  }
  // Images in the newly shown home can finish loading after the swap and
  // grow the page above the visitor (browsers without scroll anchoring,
  // e.g. Safari). Re-pin the anchor on those loads for a moment, unless the
  // visitor starts scrolling themselves.
  function holdAnchor(a, home){
    if (!a || a.mode !== "anchor") return;
    var stop = false, until = Date.now() + 2500;
    var quit = function(){ stop = true; };
    window.addEventListener("wheel", quit, { passive: true, once: true });
    window.addEventListener("touchstart", quit, { passive: true, once: true });
    window.addEventListener("keydown", quit, { once: true });
    blocks(home).forEach(function(el){
      var imgs = el.querySelectorAll("img");
      for (var i = 0; i < imgs.length; i++){
        if (imgs[i].complete) continue;
        imgs[i].addEventListener("load", function(){
          if (!stop && Date.now() < until && a.el.isConnected) restoreAnchor(a, home);
        }, { once: true });
      }
    });
  }

  /* ── Applying a home ─────────────────────────── */
  function setVisibility(home){
    blocks(home).forEach(function(el){ el.hidden = false; });
    blocks(other(home)).forEach(function(el){ el.hidden = true; });
    var grid = document.querySelector("#pricing .price-ranges");
    if (grid) grid.classList.add("is-single");
    // Hero price chip: swap the i18n key so later language switches keep it right.
    if (heroV && heroK){
      var kv = home === "bungalow" ? "hero.f1b.v" : "hero.f1.v";
      var kk = home === "bungalow" ? "hero.f1b.k" : "hero.f1.k";
      heroV.setAttribute("data-i18n", kv);
      heroK.setAttribute("data-i18n", kk);
      heroV.textContent = t(kv, home === "bungalow" ? "Price" : "RM 726k");
      heroK.textContent = t(kk, home === "bungalow" ? "on request" : "from");
    }
    // Pricing intro: one home's line instead of "two house types"
    var pl = document.querySelector('#pricing [data-i18n^="pricing.lede"]'), pf = document.querySelector('#pricing [data-i18n^="pricing.frame"]');
    if (pl){ var kl = home === "bungalow" ? "pricing.lede.bg" : "pricing.lede.sd"; pl.setAttribute("data-i18n", kl); pl.textContent = t(kl, pl.textContent); }
    if (pf){ var kf = home === "bungalow" ? "pricing.frame.bg" : "pricing.frame"; pf.setAttribute("data-i18n", kf); pf.textContent = t(kf, pf.textContent); }
    // Anything in the newly shown blocks that is already on screen should
    // not wait for the scroll reveal.
    var vh = window.innerHeight;
    blocks(home).forEach(function(el){
      var rs = el.querySelectorAll("[data-reveal]");
      for (var i = 0; i < rs.length; i++){
        if (rs[i].getBoundingClientRect().top < vh * 0.96) rs[i].classList.add("in");
      }
    });
  }
  function syncControls(home){
    root.dataset.home = home;
    buttons.forEach(function(b){
      var on = b.getAttribute("data-home") === home;
      b.setAttribute("aria-checked", String(on));
      b.tabIndex = on ? 0 : -1;
    });
    placeThumb();
    // Generic "Homes" links (dock, footer, old nav) go to the shown home.
    var gen = document.querySelectorAll('a[data-dock="homes"], a[data-i18n="nav.homes"]');
    for (var i = 0; i < gen.length; i++){
      gen[i].setAttribute("href", "#" + SECTION_ID[home]);
      gen[i].setAttribute("data-home-generic", "");
    }
  }
  function fadeTargets(home){
    var list = blocks(home).slice();
    if (heroV) list.push(heroV.closest("li"));
    var vh = window.innerHeight;
    return list.filter(function(el){
      if (!el || !isShown(el)) return false;
      var r = el.getBoundingClientRect();
      return r.bottom > 0 && r.top < vh;
    });
  }
  function fadeIn(home){
    if (!motionOK()) return;
    fadeTargets(home).forEach(function(el){
      el.classList.remove("home-fade-out");
      el.classList.remove("home-fade-in");
      void el.offsetWidth;
      el.classList.add("home-fade-in");
      setTimeout(function(){ el.classList.remove("home-fade-in"); }, FADE_IN + 40);
    });
  }
  function nudgeScrollListeners(){
    try { window.dispatchEvent(new Event("scroll")); } catch (e) {}
  }

  function emit(home, source){
    try {
      window.dispatchEvent(new CustomEvent("panthera:home", { detail: { home: home, source: source } }));
    } catch (e) {}
  }

  // opts.animate: fade out then in (pill and hero); opts.dispatch: send the
  // event; opts.keepScroll false: a link jump is about to set the position.
  function apply(home, source, opts){
    opts = opts || {};
    if (!valid(home) || home === current) return false;
    var prev = current;
    current = home;
    syncControls(home);
    if (opts.url !== false) writeUrl(home);
    if (opts.dispatch !== false) emit(home, source);

    var token = ++swapToken;
    function swap(){
      if (token !== swapToken) return;
      var a = opts.keepScroll === false ? null : captureAnchor(prev);
      root.style.overflowAnchor = "none";
      clearFadeOut();
      setVisibility(home);
      restoreAnchor(a, home);
      holdAnchor(a, home);
      setTimeout(function(){ root.style.overflowAnchor = ""; }, 60);
      fadeIn(home);
      nudgeScrollListeners();
    }
    var outs = (opts.animate && prev && motionOK()) ? fadeTargets(prev) : [];
    if (outs.length){
      outs.forEach(function(el){ el.classList.add("home-fade-out"); });
      setTimeout(swap, FADE_OUT);
    } else {
      // Swap now: for link clicks the browser's own jump must land on a
      // section that is already visible.
      swap();
    }
    return true;
  }
  function clearFadeOut(){
    var els = document.querySelectorAll(".home-fade-out");
    for (var i = 0; i < els.length; i++) els[i].classList.remove("home-fade-out");
  }

  /* ── The pill ────────────────────────────────── */
  function buildPill(){
    var wrap = document.createElement("div");
    wrap.className = "home-pill";
    wrap.setAttribute("role", "radiogroup");
    wrap.setAttribute("aria-labelledby", "home-pill-lbl");
    wrap.innerHTML =
      '<span id="home-pill-lbl" class="home-pill-sr" data-i18n="home.pill.label">Choose a home type</span>' +
      '<span class="home-pill-thumb" aria-hidden="true"></span>' +
      '<button type="button" role="radio" data-home="semid" data-i18n="home.pill.semid">Semi-D</button>' +
      '<button type="button" role="radio" data-home="bungalow" data-i18n="home.pill.bungalow">Bungalow</button>';
    return wrap;
  }
  function placeThumb(){
    if (!pill) return;
    var on = null;
    for (var i = 0; i < buttons.length; i++){
      if (buttons[i].getAttribute("data-home") === current) on = buttons[i];
    }
    if (!on || !on.offsetWidth) return;
    var first = !pill.classList.contains("has-thumb");
    if (first) pill.classList.add("thumb-init");     // no slide-in from 0 on load
    pill.style.setProperty("--thumb-x", on.offsetLeft + "px");
    pill.style.setProperty("--thumb-w", on.offsetWidth + "px");
    pill.classList.add("has-thumb");
    if (first){
      void pill.offsetWidth;
      setTimeout(function(){ pill.classList.remove("thumb-init"); }, 60);
    }
  }
  function mountPill(){
    var right = document.querySelector(".topbar .topbar-side.right");
    if (!right) return;
    pill = buildPill();
    right.insertBefore(pill, right.firstChild);
    // Tucked away while the hero fills the screen (owner, Nov 2026): the 3D hero has its own Semi-D and Bungalow
    // buttons, and on phones this pill floated over the hero copy. It slides in once the hero scrolls away.
    var heroEl = document.querySelector("section.hero");
    if (heroEl){
      var tuck = function(){ pill.classList.toggle("is-tucked", heroEl.getBoundingClientRect().bottom > window.innerHeight * 0.45); };
      var ticking = false;
      window.addEventListener("scroll", function(){ if (ticking) return; ticking = true; requestAnimationFrame(function(){ ticking = false; tuck(); }); }, { passive: true });
      window.addEventListener("resize", tuck);
      tuck();
    }
    buttons = Array.prototype.slice.call(pill.querySelectorAll("button[data-home]"));
    buttons.forEach(function(b){
      b.addEventListener("click", function(){
        apply(b.getAttribute("data-home"), "pill", { animate: true });
      });
    });
    pill.addEventListener("keydown", function(e){
      var k = e.key;
      if (k !== "ArrowLeft" && k !== "ArrowRight" && k !== "ArrowUp" && k !== "ArrowDown" && k !== "Home" && k !== "End") return;
      e.preventDefault();
      var idx = HOMES.indexOf(current);
      var next;
      if (k === "Home") next = 0;
      else if (k === "End") next = HOMES.length - 1;
      else next = (idx + ((k === "ArrowLeft" || k === "ArrowUp") ? -1 : 1) + HOMES.length) % HOMES.length;
      apply(HOMES[next], "pill", { animate: true });
      buttons[next].focus();
    });
    // Label widths change with language and font loading; keep the thumb on.
    if ("ResizeObserver" in window){
      var ro = new ResizeObserver(placeThumb);
      buttons.forEach(function(b){ ro.observe(b); });
    }
    window.addEventListener("resize", placeThumb);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeThumb);
    document.querySelectorAll(".lang button").forEach(function(b){
      b.addEventListener("click", function(){ setTimeout(placeThumb, 0); });
    });
  }

  /* ── Links and hash changes ──────────────────── */
  function onLinkClick(e){
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    var href = a.getAttribute("href") || "";
    if (href.charAt(0) !== "#") return;
    var h = homeFromHash(href);
    if (!h || h === current) return;
    // An explicit link to the other home's section: switch first (synchronously),
    // then let the browser's normal anchor jump land on it.
    apply(h, "url", { keepScroll: false });
  }
  function onHashChange(){
    var h = homeFromHash(location.hash);
    if (h && h !== current){
      apply(h, "url", { keepScroll: false });
      var el = document.getElementById(SECTION_ID[h]);
      if (el) el.scrollIntoView();
    }
  }

  /* ── 3D hero → page ──────────────────────────── */
  function onHomeEvent(e){
    var d = e && e.detail;
    if (!d || d.source !== "hero") return;
    if (!valid(d.home) || d.home === current) return;
    // The hero already announced it; follow without echoing.
    apply(d.home, "hero", { animate: true, dispatch: false });
  }

  /* ── Init ────────────────────────────────────── */
  function init(){
    if (!document.getElementById(SECTION_ID.semid) || !document.getElementById(SECTION_ID.bungalow)) return;
    tagBlocks();
    var specV = document.querySelector('.hero-specs [data-i18n="hero.f1.v"]');
    var specK = document.querySelector('.hero-specs [data-i18n="hero.f1.k"]');
    if (specV && specK){ heroV = specV; heroK = specK; }
    mountPill();
    root.classList.add("home-toggle-on");

    var start = homeFromHash(location.hash) || homeFromQuery() || "semid";
    current = start;
    syncControls(start);
    setVisibility(start);
    writeUrl(start);
    emit(start, "url");

    // Deep link to a home section: hiding the other one can move it, so jump
    // again once now and once after load (unless the visitor scrolled).
    var hashHome = homeFromHash(location.hash);
    if (hashHome){
      var target = document.getElementById(SECTION_ID[hashHome]);
      var userScrolled = false;
      var mark = function(){ userScrolled = true; };
      window.addEventListener("wheel", mark, { passive: true, once: true });
      window.addEventListener("touchmove", mark, { passive: true, once: true });
      window.addEventListener("keydown", mark, { once: true });
      var jump = function(){ if (!userScrolled && target) target.scrollIntoView({ behavior: "instant", block: "start" }); };
      setTimeout(jump, 0);
      window.addEventListener("load", function(){ setTimeout(jump, 60); });
    }

    document.addEventListener("click", onLinkClick, true);
    window.addEventListener("hashchange", onHashChange);
    window.addEventListener("panthera:home", onHomeEvent);
  }

  window.PantheraHome = {
    get: function(){ return current; },
    set: function(home, source){
      if (!valid(home)) return false;
      return apply(home, source || "hero", { animate: true });
    }
  };

  init();
})();
