// hero-app.js · the site as one 3D screen, navigated by tapping (owner, Nov 2026: "it shud work like a mobile app ya,
// not scrolling page").
//
// The estate fills the screen and the page does not scroll. A menu inside it (Estate, Location, Site, Homes, Pricing,
// FAQ, Register) glides the camera to that part of the estate and slides in a panel holding the page's own section(s),
// moved in from the page and put back on close (one copy of every word; search engines and visitors without 3D keep
// the ordinary scrolling page). Hotspots on the estate itself do the same (Location on the main road, Site on the
// playground). Links anywhere on the page (#register, #location, ...) open the matching panel. Location plays the
// lift into the map (hero-location.js) and lands in its panel.
//
//   const app = createApp(ctx)  ->  { open(id), close(), current }
const VIEWS = {
  // camera goals (estate frame, x east, z south); limits keep the camera round its centre
  // estate: turns about the lot's middle (x -89..0, z 0..97), so it sits mid-screen
  estate: { title: 'nav.estate', sections: ['#estate'], hideSite: true,
    goal: { tgt: [-44.5, 0, 48.5], az: 0.61, el: 0.7, dist: 205, fov: 40 }, lim: { cx: -42, cz: 46, R: 28, dmin: 70, dmax: 240, emin: 0.2, emax: 1.35, arc: null } },
  location: { title: 'nav.location', sections: ['#location', '#bertam'], wide: true, special: 'location' },
  site: { title: 'nav.site', sections: ['#site'],
    goal: { tgt: [-44, 0, 48], az: 1.2, el: 1.15, dist: 175, fov: 38 }, lim: { cx: -44, cz: 48, R: 20, dmin: 90, dmax: 240, emin: 0.5, emax: 1.45, arc: null } },
  homes: { title: 'nav.homes', sections: ['#homes', '#bungalow'], home: true },
  pricing: { title: 'nav.pricing', sections: ['#pricing', '#calculator'],
    goal: { tgt: [-44, 2, 28], az: 0.95, el: 0.42, dist: 120, fov: 40 }, lim: { cx: -44, cz: 30, R: 25, dmin: 60, dmax: 220, emin: 0.15, emax: 1.3, arc: null } },
  faq: { title: 'nav.faq', sections: ['#faq'],
    goal: { tgt: [-42, 0, 46], az: 2.2, el: 0.62, dist: 160, fov: 40 }, lim: { cx: -42, cz: 46, R: 28, dmin: 70, dmax: 240, emin: 0.2, emax: 1.35, arc: null } },
  register: { title: 'nav.register', sections: ['#register', 'body > footer'],
    goal: { tgt: [-42, 0, 46], az: -0.4, el: 0.55, dist: 170, fov: 40 }, lim: { cx: -42, cz: 46, R: 28, dmin: 70, dmax: 240, emin: 0.2, emax: 1.35, arc: null } },
};
// a home: close round the house, a full turn allowed (the showroom view)
const HOME_GOAL = {
  semid: { goal: { tgt: [-14.6, 3.5, 16.2], az: 0.95, el: 0.32, dist: 34, fov: 40 }, lim: { cx: -14.6, cz: 16.2, R: 4, dmin: 16, dmax: 70, emin: 0.08, emax: 1.2, arc: null } },
  bungalow: { goal: { tgt: [-73.6, 3.5, 13.4], az: 0.7, el: 0.32, dist: 34, fov: 40 }, lim: { cx: -73.6, cz: 13.4, R: 4, dmin: 16, dmax: 70, emin: 0.08, emax: 1.2, arc: null } },
};
// in-page links -> panels
const HASH = { estate: 'estate', site: 'site', location: 'location', bertam: 'location', homes: 'homes', bungalow: 'homes', semid: 'homes',
  pricing: 'pricing', calculator: 'pricing', faq: 'faq', register: 'register' };
// Location, Site Plan and Homes have their own icons on the estate (owner, Nov 2026), so the menu keeps the rest; their
// panels still open from those icons and from links on the page
// Register and WhatsApp first (owner, Nov 2026); WhatsApp is the bar's only WhatsApp link, as a logo
const MENU_IC = { register: '<path d="M5 19h4l10-10-4-4L5 15z"/><path d="M13.5 6.5l4 4"/>', estate: '<path d="M4 11 12 4l8 7"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/>', location: '<path d="M12 21s-6-5.6-6-10.5a6 6 0 0 1 12 0C18 15.4 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.2"/>', pricing: '<path d="M4 13.2V5h8.2L20 12.8 12.8 20z"/><circle cx="8.2" cy="9.2" r="1.3"/>', faq: '<path d="M5 6.5h14v9H11l-4 3v-3H5z"/><path d="M10.4 9.6a1.7 1.7 0 1 1 2.3 1.6c-.5.2-.7.6-.7 1.1"/><path d="M12 13.9h.01"/>' };
const MENU = ['register', 'estate', 'location', 'pricing', 'faq', 'wa'];   // WhatsApp on the right; Location back in the bar as well as on the 3D (owner)

export function createApp(ctx) {
  const { ui, T, rig, homeNow, walkInto, location3d, setPanel, reduced } = ctx;
  const html = document.documentElement;
  let current = null, busy = false;

  // ---------- menu ----------
  // data-i18n-aria: app.js applyI18n re-labels it on a language switch
  const menu = document.createElement('nav'); menu.className = 'hxa-menu'; menu.setAttribute('aria-label', T('nav.menu')); menu.setAttribute('data-i18n-aria', 'nav.menu');
  const btns = {};
  const waSrc = document.querySelector('.dock-wa');
  for (const id of MENU) {
    if (id === 'wa') { if (waSrc) { const wa = waSrc.cloneNode(true); wa.className = 'hxa-wa'; menu.append(wa); } continue; }
    const b = document.createElement('button'); b.type = 'button'; b.dataset.view = id;
    b.className = 'hxa-m' + (id === 'register' ? ' hxa-m-cta' : '');
    // an icon over the word: shown as a phone tab bar (hero.css); wider screens show the word only
    const ic = document.createElement('span'); ic.className = 'hxa-m-ic'; ic.setAttribute('aria-hidden', 'true');
    ic.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + (MENU_IC[id] || '') + '</svg>';
    const lb = document.createElement('span'); lb.className = 'hxa-m-l'; lb.setAttribute('data-i18n', VIEWS[id].title); lb.textContent = T(VIEWS[id].title);
    b.append(ic, lb);
    b.addEventListener('click', () => (current === id ? close() : open(id)));
    menu.append(b); btns[id] = b;
  }
  document.body.append(menu);
  // the walk pill keeps clear of the menu at every screen shape (owner, Nov 2026, a folding phone: "the pill overlapping"):
  // the menu's real top, measured, is handed to the CSS as --hxa-mgap (screen bottom to the menu's top edge)
  // and the top bar's real bottom as --hxa-tbh (the OpenStreetMap credit sits just under it)
  { const tb = document.querySelector('.topbar'), st = document.documentElement.style;
    const gap = () => { const r = menu.getBoundingClientRect(); if (r.height > 0 && r.top > 0) st.setProperty('--hxa-mgap', Math.round(innerHeight - r.top) + 'px');
      const t = tb && tb.getBoundingClientRect(); if (t && t.height > 0) st.setProperty('--hxa-tbh', Math.round(t.bottom) + 'px'); };
    gap(); addEventListener('resize', gap); setTimeout(gap, 600);
    if ('ResizeObserver' in window) { const ro = new ResizeObserver(gap); ro.observe(menu); if (tb) ro.observe(tb); } }
  setTimeout(() => ctx.relayout && ctx.relayout(), 0);   // the menu now exists: the clear band can be measured
  const mark = id => { for (const k in btns) { btns[k].classList.toggle('on', k === id); btns[k].setAttribute('aria-current', k === id ? 'page' : 'false'); } };
  mark('estate');

  // ---------- panel ----------
  const panel = document.createElement('aside'); panel.className = 'hxa-panel'; panel.setAttribute('aria-hidden', 'true'); panel.tabIndex = -1;
  const head = document.createElement('div'); head.className = 'hxa-head';
  const title = document.createElement('h2'); title.className = 'hxa-title'; title.id = 'hxa-title'; panel.setAttribute('aria-labelledby', 'hxa-title');
  const x = document.createElement('button'); x.type = 'button'; x.className = 'hxa-x'; x.setAttribute('aria-label', T('hx.close')); x.setAttribute('data-i18n-aria', 'hx.close'); x.textContent = '×';
  const body = document.createElement('div'); body.className = 'hxa-body';
  // homes: the two houses and the room tour, at the top of the Homes panel
  const homeBar = document.createElement('div'); homeBar.className = 'hxa-homebar';
  const homeBtns = ['semid', 'bungalow'].map(h => {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.home = h; b.className = 'hxa-hb';
    b.setAttribute('data-i18n', 'hx.pin.' + h); b.textContent = T('hx.pin.' + h);
    b.addEventListener('click', () => { try { window.PantheraHome && window.PantheraHome.set(h, 'pill'); } catch (e) { /* page goes on */ } aimHome(h); markHomes(); });
    homeBar.append(b); return b;
  });
  const walk = document.createElement('button'); walk.type = 'button'; walk.className = 'hxa-walk';
  walk.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.8 3.5 7.4v9.2l8.5 4.6 8.5-4.6V7.4z"/><path d="M3.5 7.4 12 12l8.5-4.6M12 12v9.2"/></svg><span data-i18n="hx.walk"></span>';
  walk.lastChild.textContent = T('hx.walk');
  walk.addEventListener('click', () => walkInto(homeNow(), walk));
  const gal = document.createElement('button'); gal.type = 'button'; gal.className = 'hxa-gal';
  gal.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3 15l5-4.5 4 3.5 3-2.5 6 4.5"/><circle cx="15.5" cy="9.5" r="1.5"/></svg><span data-i18n="hx.gallery"></span>';
  gal.lastChild.textContent = T('hx.gallery');
  gal.addEventListener('click', () => import(new URL('./gallery.js?v=3', import.meta.url).href).then(m => m.openGallery(homeNow(), { T, from: gal })).catch(e => console.warn('gallery', e)));
  homeBar.append(gal, walk);
  const markHomes = () => homeBtns.forEach(b => b.classList.toggle('on', b.dataset.home === homeNow()));
  head.append(title, x); panel.append(head, homeBar, body); document.body.append(panel);
  x.addEventListener('click', () => close());

  // the page's own sections, borrowed into the panel and put back where they were
  const lent = [];
  function borrow(sel) {
    const el = document.querySelector(sel); if (!el || panel.contains(el) && !body.contains(el)) return;
    const mark = document.createComment('hxa'); el.before(mark); body.append(el); lent.push([el, mark]);
    el.querySelectorAll('[data-reveal]').forEach(e => e.classList.add('in'));
    if (el.matches('[data-reveal]')) el.classList.add('in');
  }
  function giveBack() { while (lent.length) { const [el, mark] = lent.pop(); mark.replaceWith(el); } }

  // ---------- views ----------
  const goalFor = id => (id === 'homes' ? HOME_GOAL[homeNow()] : VIEWS[id]);
  function aimHome(h) {   // phones: from twice as far, as the house icons do
    const g = HOME_GOAL[h], k = tall() ? 2 : 1, goal = k > 1 ? { ...g.goal, dist: g.goal.dist * k } : g.goal;
    rig.setGoal(goal, k > 1 ? { ...g.lim, dmax: Math.max(g.lim.dmax, goal.dist * 1.35) } : g.lim);
  }
  // a tall phone screen shows little across: the estate view opens further back there and may pull back further still
  // (owner, Nov 2026: "in mobile view ... zoom out further")
  const tall = () => innerWidth < innerHeight * 0.9;
  // the estate view: framed to the screen's clear band (hero.js fitDist), pulled back a touch more than a tight fit
  function home(instant = false) { const v = VIEWS.estate, el = tall() ? 0.78 : v.goal.el, d = ctx.fitDist ? ctx.fitDist(el, v.goal.fov) * 1.12 : v.goal.dist; rig.setGoal({ ...v.goal, el, dist: d }, { ...v.lim, dmax: Math.max(v.lim.dmax, d * 1.5) }, { instant }); }

  let opener = null;
  async function open(id, { fromHash = false, fromLink = false } = {}) {
    if (id === 'register') document.querySelectorAll('.reg-hero img[loading="lazy"]').forEach(i => { i.loading = 'eager'; });   // the banner starts loading with the panel
    if (busy || !VIEWS[id]) return;
    if (!fromHash) api.startHash = null;   // the visitor chose: a pending deep link no longer applies
    ctx.skipIntro(); unfeature();
    // the menu's Estate is the way home; a link to #estate (or Skip to content) opens its text
    if (id === 'estate' && !fromLink && !fromHash) { close(); home(); return; }
    if (!current && document.activeElement && !panel.contains(document.activeElement)) opener = document.activeElement;
    // from the Location panel: the camera comes down first (the 3D is held looking straight down until then)
    if (current === 'location' && locClose) { const f = locClose; locClose = null; await f(); }
    const v = VIEWS[id];
    if (v.special === 'location') { await openLocation(); return; }
    if (current) giveBack();
    current = id; mark(id);
    title.setAttribute('data-i18n', v.title); title.textContent = T(v.title);
    panel.classList.toggle('wide', !!v.wide); panel.classList.toggle('homes', !!v.home);
    panel.classList.toggle('hide-site', !!v.hideSite);
    for (const s of v.sections) borrow(s);
    if (v.home) markHomes();
    body.scrollTop = 0;
    panel.classList.add('open'); panel.setAttribute('aria-hidden', 'false'); html.classList.add('hxa-open');
    setPanel(true, !!v.wide);
    const g = goalFor(id); if (g) rig.setGoal(g.goal, g.lim);
    if (!fromHash) history.replaceState(history.state, '', location.pathname + location.search + '#' + id);
    setTimeout(() => panel.focus({ preventScroll: true }), 60);
    if (id === 'homes') ctx.prefetchHome(homeNow());
  }
  // focus back where the visitor came from (only if it is still inside the closing panel)
  function refocus(was) {
    const a = document.activeElement;
    if (!(a === panel || panel.contains(a))) return;
    const t = opener && opener.isConnected && !panel.contains(opener) ? opener : btns[was] || btns.estate || menu;
    opener = null; if (t && t.focus) t.focus({ preventScroll: true });
  }
  function close() {
    if (busy) return;
    if (current === 'location' && locClose) { const f = locClose; locClose = null; f(); return; }
    const was = current;
    giveBack(); current = null; mark('estate');
    panel.classList.remove('open', 'wide', 'homes', 'hide-site'); panel.setAttribute('aria-hidden', 'true'); html.classList.remove('hxa-open');
    refocus(was);
    setPanel(false, false); home();
    if (location.hash) history.replaceState(history.state, '', location.pathname + location.search);
  }

  // Location: the lift into the map, landing in the (wide) panel
  let locClose = null;
  async function openLocation() {
    if (current === 'location' || busy) return;
    busy = true;   // from here: no second panel can slip in while the move loads
    locClose = null;
    if (current) { giveBack(); current = null; panel.classList.remove('open'); }
    const v = VIEWS.location;
    const loc = await location3d().catch(() => null);
    let shown = false;
    const show = () => {   // under the map layer: the panel, open at once, holding the Location section
      shown = true; current = 'location'; mark('location');
      title.setAttribute('data-i18n', v.title); title.textContent = T(v.title);
      panel.classList.add('wide'); panel.classList.remove('homes', 'hide-site');
      for (const s of v.sections) borrow(s);
      body.scrollTop = 0;
      panel.classList.add('open', 'instant'); panel.setAttribute('aria-hidden', 'false'); html.classList.add('hxa-open');
      setPanel(true, true);
      void panel.offsetWidth; panel.classList.remove('instant');
      // the map box in view first, so the lift lands on the map in full (owner, Nov 2026: "the location animation ... i want
      // that"); once it has landed the panel glides up to its heading and intro ("it should show this first")
      const mb = document.getElementById('loc-leaflet');
      if (mb) { const br = body.getBoundingClientRect(), r = mb.getBoundingClientRect(); body.scrollTop += r.top - br.top - 12; }
      history.replaceState(history.state, '', location.pathname + location.search + '#location');
    };
    if (!loc) { busy = false; show(); body.scrollTop = 0; return; }
    try {
      locClose = await loc.goApp(show);   // resolves once the map has landed; returns how to fly back
    } finally { busy = false; }
    if (current === 'location') setTimeout(() => { try { body.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }); } catch (e) { body.scrollTop = 0; } }, 450);   // up to the heading and intro
    if (!locClose) { if (!shown) show(); return; }   // the map move could not run (Leaflet blocked): a plain panel, closed the usual way
    const back = locClose;
    locClose = async () => {   // closing the Location panel: the panel slides away and the camera comes back down
      busy = true;
      giveBack(); current = null; mark('estate');
      panel.classList.remove('open', 'wide'); panel.setAttribute('aria-hidden', 'true'); html.classList.remove('hxa-open');
      refocus('location');
      setPanel(false, false);
      if (location.hash) history.replaceState(history.state, '', location.pathname + location.search);
      try { await back(VIEWS.estate); home(); } finally { busy = false; }   // home(): the estate's camera limits again
    };
  }

  // ---------- features: icons on the estate, the caption changes (owner, Nov 2026) ----------
  // The words are the page's own notes (all three languages already); a tap glides the camera there.
  const FEATS = {
    green: { h: 'site.note1.h', t: 'idea.p1.t', b: 'idea.p1.b', goal: { tgt: [-26, 0, 47], az: 0.85, el: 0.72, dist: 62, fov: 40 }, lim: { cx: -26, cz: 47, R: 10, dmin: 30, dmax: 140, emin: 0.15, emax: 1.35, arc: null } },
    road: { h: 'site.note2.h', t: 'site.note2.t', goal: { tgt: [-32, 0, 30], az: 0.42, el: 0.36, dist: 52, fov: 40 }, lim: { cx: -32, cz: 30, R: 12, dmin: 25, dmax: 140, emin: 0.1, emax: 1.3, arc: null } },
    pond: { h: 'site.note4.h', t: 'site.note4.t', goal: { tgt: [-11, 0, 42], az: 0.25, el: 0.62, dist: 48, fov: 40 }, lim: { cx: -11, cz: 42, R: 8, dmin: 25, dmax: 130, emin: 0.15, emax: 1.35, arc: null } },
    // every plot on its own title: the whole estate from a helicopter (owner, Nov 2026: "should do bird eye view ... helicopter view")
    title: { h: 'site.note3.h', t: 'site.note3.t', goal: { tgt: [-44.5, 0, 48.5], az: 0.75, el: 0.95, dist: 190, fov: 40 }, lim: { cx: -44.5, cz: 48.5, R: 20, dmin: 90, dmax: 330, emin: 0.4, emax: 1.45, arc: null } },
    // the two houses: their name, the page's one-line description and figures (read from #homes / #bungalow)
    semid: { home: 'semid', h: 'hx.pin.semid', goal: HOME_GOAL.semid.goal, lim: HOME_GOAL.semid.lim },
    bungalow: { home: 'bungalow', h: 'hx.pin.bungalow', goal: HOME_GOAL.bungalow.goal, lim: HOME_GOAL.bungalow.lim },
  };
  const ORDER = Object.keys(FEATS);
  const cap = document.createElement('div'); cap.className = 'hxa-cap'; cap.setAttribute('role', 'region'); cap.setAttribute('aria-live', 'polite'); cap.hidden = true;
  const capIc = document.createElement('span'); capIc.className = 'hxa-cap-ic'; capIc.setAttribute('aria-hidden', 'true');
  const capH = document.createElement('div'); capH.className = 'hxa-cap-h';
  const capT = document.createElement('p'); capT.className = 'hxa-cap-t';
  const capB = document.createElement('p'); capB.className = 'hxa-cap-b';
  const capNav = document.createElement('div'); capNav.className = 'hxa-cap-nav';
  // key: its aria-label in the current language, kept in step on a language switch (data-i18n-aria, app.js applyI18n)
  const mk = (cls, key, txt) => { const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.setAttribute('aria-label', T(key)); b.setAttribute('data-i18n-aria', key); b.textContent = txt; return b; };
  const capPrev = mk('hxa-cap-prev', 'hx.prev', '‹'), capNext = mk('hxa-cap-next', 'hx.next', ''), capX = mk('hxa-cap-x', 'hx.close', '×');
  // Next carries its word as well as the arrow, so it reads as a button (owner, Nov 2026: "scare people dont know can click")
  { const w = document.createElement('span'); w.setAttribute('data-i18n', 'hx.next'); w.textContent = T('hx.next'); const a = document.createElement('span'); a.setAttribute('aria-hidden', 'true'); a.textContent = '›'; capNext.append(w, a); }
  const capMore = document.createElement('button'); capMore.type = 'button'; capMore.className = 'hxa-cap-more';
  capNav.append(capPrev, capNext, capMore, capX);
  const capSpecs = document.createElement('dl'); capSpecs.className = 'hxa-cap-specs'; capSpecs.hidden = true;
  const capPrice = document.createElement('p'); capPrice.className = 'hxa-cap-price'; capPrice.hidden = true;
  const capGal = document.createElement('button'); capGal.type = 'button'; capGal.className = 'hxa-cap-gal';
  const capWalk = document.createElement('button'); capWalk.type = 'button'; capWalk.className = 'hxa-cap-walk';
  const capHome = document.createElement('div'); capHome.className = 'hxa-cap-home'; capHome.hidden = true; capHome.append(capGal, capWalk);
  cap.append(capIc, capH, capT, capB, capSpecs, capPrice, capHome, capNav); ui.append(cap);
  // a house's details, from its own page section (current language, current figures)
  const txt = e => (e ? e.textContent.replace(/\s+/g, ' ').trim() : '');
  function houseInfo(h) {
    const sec = document.getElementById(h === 'bungalow' ? 'bungalow' : 'homes'); if (!sec) return null;
    const specs = [...sec.querySelectorAll('.specs > div')].map(d => [txt(d.querySelector('.k')), txt(d.querySelector('.v > span')) + (d.querySelector('.v > small') ? ' ' + txt(d.querySelector('.v > small')) : '')]);
    const pr = sec.querySelector('.product-foot .price');
    return { name: txt(sec.querySelector('.home-cover-copy .title')), pitch: txt(sec.querySelector('.home-cover-copy .product-pitch')), specs,
      price: pr ? [txt(pr.querySelector('.lbl')), txt(pr.querySelector('strong'))].filter(Boolean).join(' ') : '' };
  }
  capGal.addEventListener('click', () => { const f = FEATS[feat]; if (f && f.home) import(new URL('./gallery.js?v=3', import.meta.url).href).then(m => m.openGallery(f.home, { T, from: capGal })).catch(() => {}); });
  capWalk.addEventListener('click', () => { const f = FEATS[feat]; if (f && f.home) walkInto(f.home, capWalk); });
  let feat = null, warmT = 0;
  const say = (elx, key) => { if (key) { elx.setAttribute('data-i18n', key); elx.textContent = T(key); elx.hidden = false; } else { elx.removeAttribute('data-i18n'); elx.textContent = ''; elx.hidden = true; } };
  function feature(id, { move = true } = {}) {
    const f = FEATS[id]; if (!f || (move && busy)) return;
    if (move) { api.startHash = null; if (current) close(); ctx.skipIntro(); }
    feat = id;
    const src = document.querySelector('.hx-pin[data-id="' + id + '"] .hx-feat-ic svg');
    capIc.replaceChildren(...(src ? [src.cloneNode(true)] : []));
    const info = f.home ? houseInfo(f.home) : null;
    say(capH, info ? null : f.h);   // a house: its name says it (owner, Nov 2026: "no need repeat twice")
    if (info) {   // the house: its name and line, its figures, Gallery and Walk inside
      capT.removeAttribute('data-i18n'); capT.textContent = info.name; capT.hidden = false;
      capB.removeAttribute('data-i18n'); capB.textContent = info.pitch; capB.hidden = !info.pitch;
      capSpecs.replaceChildren(...info.specs.map(([k, v]) => { const d = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = k; dd.textContent = v; d.append(dt, dd); return d; }));
      capSpecs.hidden = !info.specs.length; capPrice.textContent = info.price; capPrice.hidden = !info.price;
      capGal.textContent = T('hx.gallery'); capWalk.textContent = T('hx.walk') + ' →'; capHome.hidden = false;
      if (move) try { if (window.PantheraHome && window.PantheraHome.get() !== f.home) window.PantheraHome.set(f.home, 'pill'); } catch (e) { /* the page goes on */ }
      // build this home's tour in the background while its caption is read (in idle time only, see explore.js), so Walk
      // inside flies straight in (owner, Nov 2026: "when i click into the semi d and bungalow walk through tour, the
      // animation like its abit laging"); after the camera has settled, and only if the caption is still this house
      clearTimeout(warmT); warmT = setTimeout(() => { if (feat === id && ctx.prefetchHome) ctx.prefetchHome(f.home); }, 1500);
    } else { say(capT, f.t); say(capB, f.b); capSpecs.hidden = capPrice.hidden = capHome.hidden = true; }
    cap.classList.toggle('house', !!info);
    capMore.hidden = !f.more; if (f.more) { capMore.setAttribute('data-i18n', VIEWS[f.more].title); capMore.textContent = T(VIEWS[f.more].title) + ' →'; }
    cap.hidden = false; html.classList.add('hxa-cap-on');
    // phones: each feature from further back (owner, Nov 2026: "in the mobile view ... less zoomed in when going through the
    // features"): the caption takes the lower part of a tall screen, so the same distance read as a close-up
    if (move) { const far = tall() ? (f.home ? 2 : 1.5) : 1, g = far > 1 ? { ...f.goal, dist: f.goal.dist * far } : f.goal;   // a house further back again (owner: "too close, mobile view")
      const l = far > 1 && f.lim ? { ...f.lim, dmax: Math.max(f.lim.dmax || 0, g.dist * 1.35) } : f.lim; rig.setGoal(g, l); }
    html.classList.add('hxa-felt');   // the visitor has found the icons: they stop pulsing
    const SITE = ['green', 'road', 'pond', 'title'];   // the phones' one site-features icon stands for these four
    document.querySelectorAll('.hx-pin.hx-feat').forEach(b => b.classList.toggle('sel', b.dataset.id === id || (b.dataset.id === 'features' && SITE.includes(id))));
  }
  function unfeature() {
    if (!feat) return;
    feat = null; cap.hidden = true; html.classList.remove('hxa-cap-on');
    document.querySelectorAll('.hx-pin.hx-feat.sel').forEach(b => b.classList.remove('sel'));
  }
  const step = d => { const i = ORDER.indexOf(feat); feature(ORDER[(i + d + ORDER.length) % ORDER.length]); };
  capPrev.addEventListener('click', () => step(-1));
  capNext.addEventListener('click', () => step(1));
  capX.addEventListener('click', () => { unfeature(); home(); });
  capMore.addEventListener('click', () => { const f = FEATS[feat]; if (f && f.more) { unfeature(); open(f.more); } });
  // whose Escape is it: noted as the key goes down (capture), before the tour or a lightbox closes itself
  let escOther = false;
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const lb = document.getElementById('plan-lightbox');
    escOther = !!document.querySelector('.pbw:not([hidden]), .pbg') || html.classList.contains('pbw-going') || !!(lb && !lb.hidden);
  }, true);
  addEventListener('keydown', e => { if (!feat || current || escOther || e.defaultPrevented) return; if (e.key === 'Escape') { unfeature(); home(); } else if (e.key === 'ArrowRight' && e.target === document.body) step(1); else if (e.key === 'ArrowLeft' && e.target === document.body) step(-1); });

  // links anywhere on the page open their panel
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const id = HASH[a.getAttribute('href').slice(1)];
    if (!id) return;
    e.preventDefault();
    const tour = a.closest('.pbw');
    if (tour && !tour.hidden) {   // the tour closes itself (and pops its history entry): the panel opens after that
      const mo = new MutationObserver(() => { if (tour.hidden) { mo.disconnect(); open(id, { fromLink: true }); } });
      mo.observe(tour, { attributes: true, attributeFilter: ['hidden'] });
      return;
    }
    open(id, { fromLink: true });
  }, true);
  addEventListener('keydown', e => { if (e.key === 'Escape' && current && !busy && !escOther && !e.defaultPrevented) close(); });
  // hiding the caption when a panel opens is done in open(); the hero copy comes back when the caption closes (CSS)

  // deep link (#pricing, ...) once the intro is done
  const start = HASH[(location.hash || '').slice(1)];
  // ---------- sound: quiet songbirds, clean (no hiss, no insects), off until the visitor turns it on
  // (owner, Nov 2026). One 390 KB loop (audio/SOURCE.txt: CC0), downloaded once (buffered at idle, or at the first tap; phones: at the first tap only); it fades in and out and
  // pauses while the tab is hidden. The button sits by the language button.
  {
    const side = document.querySelector('.topbar-side.right');
    const SPK = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z"/>';
    const ON = SPK + '<path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>', OFF = SPK + '<path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';
    const sb = document.createElement('button'); sb.type = 'button'; sb.className = 'hxa-sound'; sb.setAttribute('aria-pressed', 'false'); sb.setAttribute('aria-label', T('hx.sound')); sb.setAttribute('data-i18n-aria', 'hx.sound'); sb.innerHTML = OFF;
    if (side) side.insertBefore(sb, side.firstChild);
    let ac = null, gain = null, el = null, on = false;
    // the one <audio> element: made ahead at idle (it buffers the loop then) or at the first tap, and reused by start(),
    // so the file is downloaded once (a <link rel=prefetch> before it was a second, separate download of 388 KB:
    // load-time pass, Nov 2026). crossOrigin is set before src, so its one request is the one the Web Audio graph needs.
    // Buffered ahead (wider screens), the file is fetched whole with ?v= (the site's service worker keeps it, so a repeat
    // visit downloads nothing: the element's own range requests were never kept) and played from that copy. A tap that
    // comes first gives the element the file's address at once, so it plays from the tap as before (load-time pass, Nov 2026)
    const SRC = new URL('./audio/songbirds-loop.mp3?v=1', import.meta.url).href;
    let fileP = null;
    const audioEl = (now = true) => {
      if (!el) { el = new Audio(); el.crossOrigin = 'anonymous'; el.loop = true; el.preload = 'auto'; }
      if (!el.src) {
        if (now) el.src = SRC;
        else if (!fileP) fileP = fetch(SRC, { priority: 'low' }).then(r => { if (!r.ok) throw new Error('birdsong'); return r.blob(); })
          .then(b => { if (!el.src) { el.src = URL.createObjectURL(b); if (on && ac) el.play().catch(() => {}); } }).catch(() => {});
      }
      return el;
    };
    const fade = (to, s) => { if (!gain) return; const t0 = ac.currentTime; gain.gain.cancelScheduledValues(t0); gain.gain.setValueAtTime(gain.gain.value, t0); gain.gain.linearRampToValueAtTime(to, t0 + s); };
    const start = () => {
      if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
        ac = new AC(); audioEl();
        gain = ac.createGain(); gain.gain.value = 0; ac.createMediaElementSource(el).connect(gain).connect(ac.destination);
      }
      ac.resume(); el.play().catch(() => {}); fade(0.42, 1.6);
    };
    const stop = () => { if (!ac) return; fade(0, 0.8); setTimeout(() => { if (!on && el) el.pause(); }, 850); };
    const show = () => { sb.setAttribute('aria-pressed', String(on)); sb.innerHTML = on ? ON : OFF; };
    const remember = () => { try { localStorage.setItem('hx-sound', on ? 'on' : 'off'); } catch (e) { /* private mode */ } };
    // one switch for the whole site: the tour's speaker (explore.js) drives the same sound (window.PantheraSound)
    const subs = new Set();
    const setOn = v => { armed = false; on = v; show(); remember(); on ? start() : stop(); subs.forEach(f => f(on)); };
    sb.addEventListener('click', () => setOn(!on));
    window.PantheraSound = { get on() { return on; }, toggle() { setOn(!on); }, subscribe(f) { subs.add(f); f(on); return () => subs.delete(f); } };
    // on by default (owner, Nov 2026: "load with noise"): browsers allow sound only after the visitor's first touch,
    // click or key, so it fades in then; a visitor who muted it before stays muted. The loop is buffered quietly once
    // the 3D is ready (the element itself, see audioEl), so it starts at once (not on data saver)
    let armed = false;
    try { on = localStorage.getItem('hx-sound') !== 'off'; } catch (e) { on = true; }
    // data saver, and the careful visitors (slow connection, low memory, reduced data) who opted in to the 3D: no
    // birdsong fetched ahead; the speaker's own tap still fetches and starts it
    const saver = !!(navigator.connection && navigator.connection.saveData) || !!(window.__hx && window.__hx.careful);
    if (saver) on = false;
    const phone = !!(window.__hx && window.__hx.lite);
    show();
    if (on) {
      armed = true;
      const first = e => {
        if (!armed) return; armed = false;
        for (const t of ['pointerdown', 'keydown', 'touchstart', 'wheel']) removeEventListener(t, first, true);
        if (e.target && e.target.closest && e.target.closest('.hxa-sound')) return;   // the speaker's own tap decides
        if (on) start();
        // phones: a finger counts as the go-ahead for sound only when it lifts (touchend / pointerup), so the start
        // above may be refused there; each lift tries again until it plays
        // (pointerup comes first; a browser that counts only touchend or click gets those too). The listeners stay until
        // the sound is really playing, the visitor decides with the speaker, or a few lifts have gone by
        if (phone) {
          const LIFT = ['pointerup', 'touchend', 'click'];
          let tries = 9;
          const playing = () => ac && ac.state === 'running' && el && !el.paused;
          const drop = () => { for (const t of LIFT) removeEventListener(t, lift, true); };
          const lift = () => {
            if (!on || playing() || --tries < 0) return drop();
            start();
            if (ac) ac.resume().then(() => { if (playing()) drop(); }, () => {});
          };
          for (const t of LIFT) addEventListener(t, lift, true);
        }
      };
      for (const t of ['pointerdown', 'keydown', 'touchstart', 'wheel']) addEventListener(t, first, true);
      // phones (the hero's lite tier): nothing fetched at idle, the 388 KB loop starts downloading at the first touch
      // (start() above makes the element), so a visit with no touch costs no birdsong; wider screens buffer it at idle
      // (from the end of the intro: armed at the first frame, it landed in the middle of the 3D's own downloads)
      if (!phone) {
        const pre = () => (window.requestIdleCallback || (f => setTimeout(f, 1500)))(() => { if (on) audioEl(false); }, { timeout: 4000 });
        const html = document.documentElement;
        if (html.classList.contains('hx-app-ready')) pre();
        else { const mo = new MutationObserver(() => { if (html.classList.contains('hx-app-ready')) { mo.disconnect(); pre(); } }); mo.observe(html, { attributes: true, attributeFilter: ['class'] }); }
      }
    }
    document.addEventListener('visibilitychange', () => { if (!on || !ac) return; if (document.hidden) el.pause(); else { ac.resume(); el.play().catch(() => {}); } });
  }

  const api = {
    open, close, menu, panel, feature,
    toEstate() { if (current && current !== 'location') close(); unfeature(); home(true); },   // the tour's Back to estate
    get current() { return current; },
    startHash: start || null,
    onLang() { title.textContent = T(title.getAttribute('data-i18n') || ''); if (feat) feature(feat, { move: false }); },
  };
  return api;
}
