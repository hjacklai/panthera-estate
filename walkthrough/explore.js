// explore.js · the estate hero's tour overlay (loaded by hero.js on the first sign of interest in a home).
//
// Picking a home: the camera comes down onto its plot and ends straight above it, the lens closes down to the
// walkthrough's own long lens (so the roofs flatten into a plan), and the walkthrough takes over at its very start,
// the 3D floor plan, inside a full-screen overlay with its own scroller. One renderer, one canvas: walk.js?lib=1
// draws on the hero's canvas and never runs its own frame loop.
// Switching home in the tour: back up into the sky over the estate, across to the other plot, down again.
// Back to estate: up and back to where the visitor left the hero, then the page is as it was.
const SHEET = {   // walk.js rig(0): the plan sheet's centre (model frame) and the area that must fit, wide and tall screens
  semid: { wide: { t: [-6.0, 0, -5.3], w: 34, h: 27.5 }, tall: { t: [0, 0, -10.2], w: 21, h: 42 } },
  bungalow: { wide: { t: [-5.0, 0, -1.6], w: 34, h: 24 }, tall: { t: [0.4, 0, -4.2], w: 20, h: 36 } },
};
const PLAN_FOV = 2.2, NEAR_FOV = 35;
const LENIS_URL = 'https://cdn.jsdelivr.net/npm/lenis@1.1.14/dist/lenis.min.js';
const WALK_V = '145', CSS_V = '9';

export function createTour(ctx) {
  const { THREE, renderer, canvas, camera, base, T, reduced } = ctx;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const smooth = t => t * t * (3 - 2 * t);
  // phones, tablets and iPhones (no deviceMemory there) keep one home in memory; desktops keep both
  const IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const LOWMEM = ctx.lite || IOS || matchMedia('(pointer: coarse)').matches || (navigator.deviceMemory && navigator.deviceMemory <= 4);
  const OTHER = { semid: 'bungalow', bungalow: 'semid' };

  // ---------- loading ----------
  let walkModP = null, lenisP = null, cssP = null;
  const loadWalk = () => walkModP || (walkModP = import(base + `walk.js?v=${WALK_V}&lib=1`));
  const loadLenis = () => lenisP || (lenisP = window.Lenis ? Promise.resolve(window.Lenis) : new Promise((ok, no) => {
    const s = document.createElement('script'); s.src = LENIS_URL; s.onload = () => ok(window.Lenis); s.onerror = () => { lenisP = null; no(new Error('lenis')); }; document.head.appendChild(s);
  }));
  const loadCss = () => cssP || (cssP = new Promise(ok => {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = base + `walk-hud.css?v=${CSS_V}`; l.onload = l.onerror = () => ok(); document.head.appendChild(l);
  }));

  // ---------- the overlay ----------
  const el = (tag, cls, attrs = {}, html) => { const e = document.createElement(tag); if (cls) e.className = cls; for (const k in attrs) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; };
  // aria-labels in the current language; data-i18n-aria lets app.js applyI18n re-label them on a switch
  const ov = el('div', 'pbw', { role: 'dialog', 'aria-modal': 'true', 'aria-label': T('hx.tour'), 'data-i18n-aria': 'hx.tour', hidden: '' });
  const stage = el('div', 'pbw-stage');
  const snap = el('canvas', 'pbw-snap', { 'aria-hidden': 'true' });
  stage.append(snap);
  const bar = el('div', 'pbw-bar');
  const back = el('button', 'pbw-back', { type: 'button', 'aria-label': T('hx.back'), 'data-i18n-aria': 'hx.back' });   // phones show the arrow only
  back.append(el('span', '', { 'aria-hidden': 'true' }, '←'), el('span', '', { 'data-i18n': 'hx.back' }, T('hx.back')));
  const pill = el('div', 'pbw-pill', { role: 'group', 'aria-label': T('hx.choose'), 'data-i18n-aria': 'hx.choose' });
  const pillBtns = ['semid', 'bungalow'].map(h => { const b = el('button', '', { type: 'button', 'data-home': h, 'aria-pressed': 'false', 'data-i18n': 'hx.pin.' + h }, T('hx.pin.' + h)); pill.append(b); return b; });
  // the home's pictures, full screen with left / right (gallery.js; owner, Nov 2026)
  const gal = el('button', 'pbw-gal', { type: 'button' }, '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3 15l5-4.5 4 3.5 3-2.5 6 4.5"/><circle cx="15.5" cy="9.5" r="1.5"/></svg><span data-i18n="hx.gallery"></span>');
  gal.lastChild.textContent = T('hx.gallery');
  gal.addEventListener('click', () => import(base + 'gallery.js?v=3').then(m => m.openGallery((active && active.home) || open || 'semid', { T, from: gal })).catch(e => console.warn('gallery', e)));
  // the site's sound (hero-app.js, window.PantheraSound): the same on/off from inside the tour (owner, Nov 2026)
  const SPK = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z"/>';
  const snd = el('button', 'pbw-snd', { type: 'button', 'aria-label': T('hx.sound'), 'data-i18n-aria': 'hx.sound', 'aria-pressed': 'false' });
  const paintSnd = on => { snd.setAttribute('aria-pressed', String(on)); snd.innerHTML = SPK + (on ? '<path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>' : '<path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>'); };
  snd.addEventListener('click', () => { if (window.PantheraSound) window.PantheraSound.toggle(); });
  if (window.PantheraSound) window.PantheraSound.subscribe(paintSnd); else snd.hidden = true;
  bar.append(back, pill, gal, snd);
  const wait = el('div', 'pbw-wait', { role: 'status', hidden: '' });
  const waitT = el('span', '', { 'data-i18n': 'hx.prep' }, T('hx.prep')), waitN = el('b', '', {}, '0%');
  wait.append(el('span', 'pbw-ring', { 'aria-hidden': 'true' }), waitT, waitN);
  ov.append(stage, bar, wait);
  document.body.append(ov);

  // one HUD per home (a copy of walkthrough/index.html's, ids unique as only the active one is in the page)
  const HUD = home => `
<div class="loader done" id="loader" hidden><span class="wt-mono"></span></div>
<div class="pbw-scroll"><div class="spacer"></div></div>
<div class="hud pbw-lens" aria-hidden="true">Lens <b id="h-lens">2.2°</b><i>·</i>Eye <b id="h-eye">–</b><i>·</i>Cut <b id="h-cut">+1.20 m</b></div>
<nav class="chapters wt-mono" id="chapters" aria-label="Chapters">
  <button type="button" data-p="0">01 Plan</button>
  <button type="button" data-p="0.124">02 Walls</button>
  <button type="button" data-p="0.279">03 Model</button>
  <button type="button" data-p="0.42">04 Porch</button>
  <button type="button" data-p="0.533">05 Living</button>
  <button type="button" data-p="0.70">06 Upstairs</button>
  <button type="button" data-p="0.90">07 Estate</button>
</nav>
<section class="intro" id="intro">
  <div class="eyebrow">Semi-D · 2,006 sq ft · 4 bed · 4 bath</div>
  <p>The Semi-D in 3D. Scroll to walk through every room.</p>
  <div class="scrollcue wt-mono">Scroll</div>
</section>
<div class="caption" id="caption" aria-live="polite"><span class="num wt-mono" id="cap-num"></span><p id="cap-text"></p></div>
<aside class="titleblock wt-mono" id="titleblock" aria-label="Drawing details">
  <div><span class="k">Project</span><span class="big">Panthera Bertam</span></div>
  <div><span class="k">Drawing</span>Semi-D pair · ground floor</div>
  <div class="row"><span><span class="k">Unit</span>22 × 43.5 ft</span><span><span class="k">Lot</span>31 ft wide</span></div>
</aside>
<section class="endcard" id="endcard">
  <p>Semi-D · 2,006 sq ft built-up · 4 bedrooms · 4 bathrooms · freehold. Pre-launch registration is open.</p>
  <div class="actions">
    <a class="btn btn-primary" href="#register" data-pbw="register"><span>Register your interest</span><span class="arrow" aria-hidden="true">→</span></a>
    <button type="button" class="btn btn-ghost" data-pbw="back"><span data-i18n="hx.back">${T('hx.back')}</span></button>
    <button type="button" class="btn btn-ghost" data-pbw="other"><span data-i18n="hx.other.${OTHER[home]}">${T('hx.other.' + OTHER[home])}</span></button>
  </div>
</section>`;

  // ---------- the walks ----------
  const walks = {};   // home -> { root, scroller, p (promise of the walk API), api, pct, failed }
  let active = null;  // the walk on screen
  function prefetch(home) {
    if (!SHEET[home]) return null;
    const have = walks[home];
    if (have && !have.failed) return have.p;
    if (LOWMEM) for (const h of Object.keys(walks)) if (h !== home && walks[h] !== active) drop(h);   // one home at a time
    const root = el('div', 'pbw-walk', { 'data-home': home }, HUD(home));
    const w = walks[home] = { home, root, scroller: root.querySelector('.pbw-scroll'), api: null, pct: 0, failed: false };
    w.p = Promise.all([loadWalk(), loadLenis(), loadCss()])
      .then(([m, Lenis]) => m.mountWalk({ lib: true, home, renderer, canvas, pack: ctx.pack, ui: root, scroller: w.scroller, Lenis, cooperative: true,
        onProgress: f => { w.pct = f; if (waitingFor === home) waitN.textContent = Math.round(f * 100) + '%'; },
        onError: msg => console.warn('tour:', msg) }))
      .then(api => { w.api = api; if (walks[home] !== w) api.dispose(); else fillIntro(root, home); return api; },
        e => { w.failed = true; console.warn('tour: the walk could not be built', e); throw e; });
    w.p.catch(() => {});
    return w.p;
  }
  // the intro card: the home's type, name, figures and price, from its own page section (current language and figures,
  // the same as the estate caption shows), above the line and the scroll cue (owner, Nov 2026: "show back this info in
  // the bungalow tour page also after loading"; both homes)
  const txt = e => (e ? e.textContent.replace(/\s+/g, ' ').trim() : '');
  function fillIntro(root, home) {
    const box = root.querySelector('.intro'), sec = document.getElementById(home === 'bungalow' ? 'bungalow' : 'homes');
    if (!box || !sec) return;
    const specs = [...sec.querySelectorAll('.specs > div')].map(d => [txt(d.querySelector('.k')), txt(d.querySelector('.v > span')) + (d.querySelector('.v > small') ? ' ' + txt(d.querySelector('.v > small')) : '')]).filter(([k, v]) => k && v);
    const pr = sec.querySelector('.product-foot .price'), price = pr ? [txt(pr.querySelector('.lbl')), txt(pr.querySelector('strong'))].filter(Boolean).join(' ') : '';
    const name = txt(sec.querySelector('.home-cover-copy .title'));
    const eb = box.querySelector('.eyebrow'); if (eb) eb.textContent = T('hx.pin.' + home);
    box.querySelectorAll('.pbw-intro-t, .pbw-specs, .pbw-price').forEach(n => n.remove());
    const add = [];
    if (name) { const t = el('div', 'pbw-intro-t'); t.textContent = name; add.push(t); }
    if (specs.length) { const dl = el('dl', 'pbw-specs'); for (const [k, v] of specs) { const d = el('div'), dt = el('dt', 'wt-mono'), dd = el('dd'); dt.textContent = k; dd.textContent = v; d.append(dt, dd); dl.append(d); } add.push(dl); }
    if (price) { const q = el('p', 'pbw-price'); q.textContent = price; add.push(q); }
    (eb || box.firstChild).after(...add);
  }
  function drop(home) {
    const w = walks[home]; if (!w) return;
    delete walks[home];
    w.root.remove();
    if (w.api) w.api.dispose();   // still building: disposed when it finishes (see prefetch)
  }

  // ---------- frames (the hero's loop is held while the overlay runs its own) ----------
  let loopFn = null, looping = false;
  function loop(fn) { loopFn = fn; if (!looping) { looping = true; ctx.nextFrame(step); } }
  function step(t) {
    if (!loopFn) { looping = false; return; }
    if (loopFn(t) === false) loopFn = null;
    if (loopFn) ctx.nextFrame(step); else looping = false;
  }
  // the moves' clock: real time (checking only: window.__pbwSlow stretches it, a huge value holds it still)
  let vt = 0, rt = performance.now(), rs = 1;
  const clock = () => { const n = performance.now(), sl = window.__pbwSlow || 1; vt += (n - rt) / (sl !== rs ? rs : sl); rt = n; rs = sl; return vt; };
  const phase = { name: '', u: 0, fade: 1 };
  const animate = (ms, fn, name = '') => new Promise(res => {
    const t0 = clock();
    loop(() => { const u = ms > 0 ? clamp((clock() - t0) / ms) : 1; phase.name = name; phase.u = u; fn(u); if (u >= 1) { res(); return false; } });
  });
  const frameOnce = () => new Promise(res => loop(() => { res(); return false; }));

  // ---------- camera poses (estate frame) ----------
  let W = 1, H = 1;
  const measure = () => { W = Math.max(1, stage.clientWidth || innerWidth); H = Math.max(1, stage.clientHeight || innerHeight); };
  const fit = (w, h, fov) => { const v = fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(v / 2) * W / H); return Math.max(h / 2 / Math.tan(v / 2), w / 2 / Math.tan(hf / 2)); };
  function planPose(home, fov) {   // straight down over the plot, framed as the walkthrough's opening plan
    const M = ctx.slotM(home), wide = innerWidth / innerHeight > 1.05 && innerWidth > 760, s = SHEET[home][wide ? 'wide' : 'tall'];
    const tgt = V(...s.t).applyMatrix4(M), up = V(0, 0, -1).transformDirection(M);
    return { pos: tgt.clone().add(V(0, fit(s.w, s.h, fov), 0)), tgt, up, fov, off: [0, 0] };
  }
  function approach(home) {   // high and a little in front of the plot, looking down at it
    const p = planPose(home, NEAR_FOV), front = V(0, 0, 1).transformDirection(ctx.slotM(home)), d = p.pos.y - p.tgt.y;
    return { pos: p.tgt.clone().add(V(0, d * 1.9, 0)).addScaledVector(front, d * 0.75), tgt: p.tgt.clone(), up: V(0, 1, 0), fov: 38, off: [0, 0] };
  }
  function exterior(home) {   // over the front of the plot (where a dive out of the rooms lands)
    const p = planPose(home, NEAR_FOV), front = V(0, 0, 1).transformDirection(ctx.slotM(home));
    return { pos: p.tgt.clone().add(V(0, 26, 0)).addScaledVector(front, 24), tgt: p.tgt.clone(), up: V(0, 1, 0), fov: 44, off: [0, 0] };
  }
  function aerial(a, b) {   // over the estate between two plots, from the south-east
    const c = ctx.plotCentre(a).add(ctx.plotCentre(b)).multiplyScalar(0.5);
    return { pos: c.clone().add(V(40, 105, 70)), tgt: c, up: V(0, 1, 0), fov: 38, off: [0, 0] };
  }
  const groundHit = (pos, dir) => (dir.y < -0.05 ? pos.clone().addScaledVector(dir, (pos.y - 0) / -dir.y) : pos.clone().addScaledVector(dir, 40));
  function heroNow() {   // the hero camera as it is now
    const dir = camera.getWorldDirection(V(0, 0, 0)), off = camera.view && camera.view.enabled ? [camera.view.offsetX / camera.view.fullWidth, camera.view.offsetY / camera.view.fullHeight] : [0, 0];
    return { pos: camera.position.clone(), tgt: groundHit(camera.position, dir), up: V(0, 1, 0), fov: camera.fov, off };
  }
  function walkNow(w) {   // the walk camera, carried into the estate frame
    const c = w.api.camera, M = ctx.slotM(w.home), dir = c.getWorldDirection(V(0, 0, 0));
    const pos = c.position.clone().applyMatrix4(M), d = dir.transformDirection(M);
    return { pos, tgt: groundHit(pos, d), up: c.up.clone().transformDirection(M), fov: c.fov, off: [0, 0] };
  }
  const fog = ctx.scene.fog, fog0 = fog ? [fog.near, fog.far] : null;
  function setCam(p) {
    camera.up.copy(p.up); camera.position.copy(p.pos); camera.lookAt(p.tgt);
    const d = p.pos.distanceTo(p.tgt);
    camera.fov = p.fov;
    camera.near = Math.max(2, Math.min(d - 40, d * 0.6)); camera.far = Math.max(6000, d + 3000);   // depth precision for the long lens
    if (fog) { fog.near = Math.max(fog0[0], d + 60); fog.far = Math.max(fog0[1], d + 1500); }
    if (p.off[0] || p.off[1]) camera.setViewOffset(W, H, p.off[0] * W, p.off[1] * H, W, H); else camera.clearViewOffset();
    camera.aspect = W / H; camera.updateProjectionMatrix();
  }
  function mix(a, b, t) {
    return { pos: a.pos.clone().lerp(b.pos, t), tgt: a.tgt.clone().lerp(b.tgt, t), up: a.up.clone().lerp(b.up, t).normalize(), fov: Math.exp(lerp(Math.log(a.fov), Math.log(b.fov), t)), off: [lerp(a.off[0], b.off[0], t), lerp(a.off[1], b.off[1], t)] };
  }
  // a smooth flight through key poses: positions and aim points on Catmull-Rom curves, lens and up per stretch
  function path(keys) {
    const P = new THREE.CatmullRomCurve3(keys.map(k => k.pos), false, 'centripetal'), A = new THREE.CatmullRomCurve3(keys.map(k => k.tgt), false, 'centripetal'), n = keys.length - 1;
    return u => { const x = u * n, i = Math.min(n - 1, Math.floor(x)), m = mix(keys[i], keys[i + 1], smooth(x - i)); m.pos = P.getPoint(u); m.tgt = A.getPoint(u); return m; };
  }
  async function fly(keys, ms, name = 'fly', onU = null) {
    if (reduced) ms = Math.min(ms, 250);
    const f = path(keys);
    await animate(ms, u => { if (onU) onU(u); setCam(f(ease(u))); ctx.renderHero(); }, name);
  }
  async function lens(home, from, to, ms) {   // the dolly: the lens closes (or opens) while the plot stays the same size
    if (reduced) ms = 0;
    await animate(ms, u => { const e = ease(u); setCam(planPose(home, Math.exp(lerp(Math.log(from), Math.log(to), e)))); ctx.renderHero(); }, from > to ? 'lens-in' : 'lens-out');
  }

  // ---------- snapshots (the crossfades between the two scenes on one canvas) ----------
  function grab() {   // the canvas as just drawn, into the 2D layer over it (same task, before the buffer is cleared)
    if (snap.width !== canvas.width || snap.height !== canvas.height) { snap.width = canvas.width; snap.height = canvas.height; }
    const g = snap.getContext('2d'); g.clearRect(0, 0, snap.width, snap.height); g.drawImage(canvas, 0, 0);
    fadeGen++; phase.fade = 0; snap.style.transform = 'none'; snap.style.opacity = '1';
  }
  let fadeGen = 0;   // a newer grab or fade stops the running fade
  // driven by ctx.nextFrame (rAF, with a 100 ms timer where rAF is held back), not a CSS transition, so it always runs
  // to the end, in step with the display (a 16 ms interval judders on 90 and 120 Hz screens)
  function fadeSnap(ms, shrink = false) {
    const g = ++fadeGen, t0 = clock();
    return new Promise(res => {
      const upd = () => {
        if (g !== fadeGen) return;
        const u = ms > 0 ? clamp((clock() - t0) / ms) : 1, e = smooth(u); phase.fade = u;
        snap.style.opacity = (1 - e).toFixed(3); snap.style.transform = shrink ? `scale(${(1 - 0.18 * e).toFixed(4)})` : 'none';
        if (u >= 1) res(); else ctx.nextFrame(upd);
      };
      upd();
    });
  }

  // ---------- state ----------
  let open = null, busy = false, pending = null, opener = null, waitingFor = null, heroPose = null, inertList = [], lockPad = '';
  const here = () => location.pathname + location.search;   // absolute, so a <base> on the page cannot redirect it
  const markPill = home => pillBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.home === home)));
  const showBar = on => { ov.classList.toggle('pbw-ui', on); };
  function lock(on) {
    const de = document.documentElement;
    if (on) {
      const sb = innerWidth - de.clientWidth;
      lockPad = document.body.style.paddingRight;
      if (sb > 0) document.body.style.paddingRight = sb + 'px';
      de.classList.add('pbw-lock');
      inertList = [...document.body.children].filter(e => e !== ov && !e.inert);
      inertList.forEach(e => { e.inert = true; });
    } else {
      de.classList.remove('pbw-lock'); document.body.style.paddingRight = lockPad;
      inertList.forEach(e => { e.inert = false; }); inertList = [];
    }
  }
  function attach(w) {   // this home's HUD into the overlay
    for (const x of ov.querySelectorAll('.pbw-walk')) if (x !== w.root) x.remove();
    if (!w.root.isConnected) ov.insertBefore(w.root, bar);
  }
  // hover over the plot until the walk is built (a slow drift; the percentage shows how far the build is)
  async function hoverUntil(home, w) {
    if (w.api) return w.api;
    waitingFor = home; waitN.textContent = Math.round(w.pct * 100) + '%'; wait.hidden = false;
    const p0 = planPose(home, NEAR_FOV), t0 = performance.now();
    let done = false; w.p.then(() => { done = true; }, () => { done = true; });
    loop(t => { const k = Math.sin((Math.max(t, performance.now()) - t0) / 1400) * 0.02; const p = { ...p0, pos: p0.tgt.clone().add(V(0, (p0.pos.y - p0.tgt.y) * (1 + k), 0)) }; setCam(p); ctx.renderHero(); return !done; });
    try { await w.p; } finally { waitingFor = null; wait.hidden = true; }
    await frameOnce();
    setCam(p0); ctx.renderHero();
    return w.api;
  }
  // the house turns into its plan: last hero frame into the 2D layer, the walk at P 0 under it, then the layer fades
  async function handoff(w) {
    ctx.renderHero(); grab();
    attach(w); active = w;
    w.api.activate(); w.api.setProgress(0); w.scroller.scrollTop = 0;
    ctx.sizeTo(stage);
    w.api.resize(); w.api.redraw(); w.api.tick(performance.now());
    markPill(w.home); showBar(true);
    loop(t => { tickTour(t); });
    await fadeSnap(reduced ? 200 : 750);
    if (!ov.contains(document.activeElement)) back.focus({ preventScroll: true });
  }
  function tickTour(t) {
    if (!active || !active.api) return;
    active.api.tick(t);
    const P = active.api.progress();
    bar.classList.toggle('dim', P > 0.06 && P < 0.975);
  }
  // leave the walk: its last frame into the 2D layer, the hero scene at the matching pose under it
  async function leave(w, calm = false) {   // calm: back to the estate (no shrink of the last frame, no lens swing)
    loopFn = null;
    const P = w.api.progress();
    w.api.redraw(); w.api.tick(performance.now()); grab();
    showBar(false);
    const plan = P < 0.06;
    let s;
    if (plan) s = planPose(w.home, calm ? NEAR_FOV : PLAN_FOV);   // the opening plan: the same view, the plan turns back into the house
    else if (P >= 0.975) s = walkNow(w);              // the bird's-eye over the estate: the same view in the hero
    else s = exterior(w.home);                        // drawing, rooms or street: dive out over the front of the plot
    ctx.heroDPR(); ctx.sizeTo(stage); setCam(s); ctx.renderHero();
    active = null;
    const fade = fadeSnap(reduced ? 200 : calm ? 800 : 650, !calm && !plan && P < 0.975);
    if (LOWMEM) { const h = w.home; setTimeout(() => { if (active !== w) drop(h); }, 0); }
    else w.root.remove();
    return { s, fade, plan };
  }

  // ---------- open, switch, back ----------
  async function openHome(home, from) {
    if (busy) { pending = ['open', home]; return; }
    if (open) { if (open !== home) switchHome(home); return; }
    busy = true; open = home; opener = from || document.activeElement;
    try {
      const w = walks[home] && !walks[home].failed ? walks[home] : (prefetch(home), walks[home]);
      measure();
      heroPose = heroNow();
      if (ctx.onHome) ctx.onHome(home);   // the landing page follows (before the push, so Back returns to its URL)
      history.pushState({ pbw: home }, '', here() + '#walk-' + home);
      ctx.leaving(true);   // the hero copy, pins and the site bars fade while the camera sets off
      ctx.hold(true);
      // the page must not scroll meanwhile (the scroll lock itself waits: it would unstick the sticky hero)
      // (app mode: the page cannot scroll anyway, so no blocking listeners that make touch input wait on the main thread)
      const stop = e => e.preventDefault();
      if (!document.documentElement.classList.contains('hx-app')) { addEventListener('wheel', stop, { passive: false }); addEventListener('touchmove', stop, { passive: false }); }
      // then the canvas moves into the overlay (the hero stage may sit a little off the top: it slides into place)
      const moveIn = () => {
        const r = canvas.getBoundingClientRect();
        ov.hidden = false; ov.classList.remove('pbw-ui');
        stage.insertBefore(canvas, snap);
        lock(true); removeEventListener('wheel', stop); removeEventListener('touchmove', stop);
        measure(); ctx.sizeTo(stage);
        stage.style.transition = 'none'; stage.style.transform = r.top ? `translateY(${r.top}px)` : '';
        void stage.offsetWidth; stage.style.transition = reduced ? 'none' : 'transform .6s cubic-bezier(.3,.1,.3,1)'; stage.style.transform = '';   // reduced motion: straight into place
      };
      const moved = () => canvas.parentElement === stage;
      try { await fly([heroPose, approach(home), planPose(home, NEAR_FOV)], 2400, 'fly-in', u => { if (!moved() && (u >= 0.16 || reduced)) moveIn(); }); }   // after about 0.4 s
      finally { if (!moved()) moveIn(); }
      const api = await hoverUntil(home, w);
      if (!api) throw new Error('no walk');
      await lens(home, NEAR_FOV, PLAN_FOV, 1100);
      await handoff(w);
    } catch (e) {
      console.warn('tour: back to the estate', e); busy = false; await closeTour(false); return;
    }
    busy = false; runPending();
  }
  async function switchHome(home) {
    if (!open || home === open) return;
    if (busy) { pending = ['open', home]; return; }
    const from = walks[open]; if (!from || !from.api) return;
    busy = true;
    const was = open; open = home;
    if (ctx.onHome) ctx.onHome(home);
    history.replaceState({ pbw: home }, '', here() + '#walk-' + home);
    markPill(home);
    try {
      const { s, fade, plan } = await leave(from);
      const w = (prefetch(home), walks[home]);
      if (plan) { await fade; await lens(was, s.fov, NEAR_FOV, 900); await fly([planPose(was, NEAR_FOV), aerial(was, home), approach(home), planPose(home, NEAR_FOV)], 3400, 'fly-across'); }
      else { await fly([s, aerial(was, home), approach(home), planPose(home, NEAR_FOV)], 3600, 'fly-across'); await fade; }
      const api = await hoverUntil(home, w);
      if (!api) throw new Error('no walk');
      await lens(home, NEAR_FOV, PLAN_FOV, 1100);
      await handoff(w);
    } catch (e) { console.warn('tour: back to the estate', e); busy = false; await closeTour(false); return; }
    busy = false; runPending();
  }
  async function closeTour(fromPop = false) {
    if (!open) return;
    if (busy) { pending = ['close', fromPop]; return; }
    busy = true;
    const w = walks[open];
    if (!fromPop && history.state && history.state.pbw) { ignorePop = true; history.back(); }
    try {
      let s = heroNow(), fade = null;
      if (w && w.api && active === w) ({ s, fade } = await leave(w, true));
      else { showBar(false); loopFn = null; }
      const to = ctx.heroPoseNow ? ctx.heroPoseNow() : heroPose;
      // owner, Nov 2026 ("zoom in and out abit, dizzy"): one steady pull-out straight to the estate view, while the
      // room's last frame simply fades (no climb and drop, no lens swing, no shrinking picture)
      if (s.fov < 20) s = planPose(open, NEAR_FOV);
      await fly([s, to], 2400, 'fly-back');
      if (fade) await fade;
    } catch (e) { console.warn('tour: closing', e); }
    // the hero takes its canvas back at the very pose it is now drawn at
    loopFn = null;
    camera.up.set(0, 1, 0); camera.near = 2; camera.far = 6000;
    if (fog) { fog.near = fog0[0]; fog.far = fog0[1]; }
    lock(false);   // first, so the sticky hero is back in place
    ctx.giveBack();
    ov.hidden = true; ov.classList.remove('pbw-ui');
    for (const x of ov.querySelectorAll('.pbw-walk')) x.remove();
    if (LOWMEM) for (const h of Object.keys(walks)) drop(h);
    active = null; open = null;
    ctx.hold(false); ctx.leaving(false);
    const f = opener && opener.isConnected && opener !== document.body ? opener : ctx.focusHome;   // focus back where the visitor left
    if (f) f.focus({ preventScroll: true });
    if (ctx.onClosed) ctx.onClosed();
    busy = false; runPending();
  }
  function runPending() {
    const p = pending; pending = null; if (!p) return;
    if (p[0] === 'open') { if (open) switchHome(p[1]); else openHome(p[1]); }
    else if (p[0] === 'close') closeTour(p[1]);
  }

  // ---------- controls ----------
  let ignorePop = false;
  addEventListener('popstate', () => { if (ignorePop) { ignorePop = false; return; } if (open) closeTour(true); });
  back.addEventListener('click', () => closeTour(false));
  pill.addEventListener('click', e => { const b = e.target.closest('button[data-home]'); if (b && open && b.dataset.home !== open) switchHome(b.dataset.home); });
  pill.addEventListener('pointerenter', () => { if (open && !LOWMEM) prefetch(OTHER[open]); });
  ov.addEventListener('click', e => {
    const a = e.target.closest('[data-pbw]'); if (!a) return;
    const k = a.dataset.pbw;
    if (k === 'back') closeTour(false);
    else if (k === 'other' && open) switchHome(OTHER[open]);
    else if (k === 'register') {   // close the tour, then go to the form on this page (or follow the link)
      e.preventDefault();
      closeTour(false).then(() => { const t = document.getElementById('register'); if (t) t.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' }); else location.href = a.href; });
    }
  });
  ov.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !open) return;
    e.stopPropagation(); e.preventDefault();   // the tour's own Escape (a panel or caption behind it stays)
    closeTour(false);
  });
  // once per frame at most (a phone's URL bar showing or hiding fires many resize events, each a WebGL resize and draw)
  let rz = 0;
  addEventListener('resize', () => {
    if (!open || rz) return;
    rz = 1;
    ctx.nextFrame(() => { rz = 0; if (!open) return; measure(); ctx.sizeTo(stage); if (active && active.api) { active.api.resize(); active.api.redraw(); } });
  });

  return {
    prefetch, open: openHome, close: () => closeTour(false), switchTo: switchHome,
    get phase() { return { ...phase }; },   // checking only
    get state() { return { open, busy, active: active && active.home, built: Object.keys(walks).filter(h => walks[h].api), lowmem: !!LOWMEM }; },
    walk: h => walks[h] && walks[h].api,
  };
}
