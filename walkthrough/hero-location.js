// hero-location.js · from the estate hero out to the page's Location map, and back (owner, Nov 2026: "at estate 3D
// how we can transition smoothly to the location section").
//
// Out: the camera lifts to look straight down on the estate, north up; a full-screen copy of the page's own street
// map (Leaflet, the same CARTO tiles) fades in under it at exactly the same spot and scale, the lot outlined; the map
// pulls out to the neighbourhood while the places drop in; behind it the page moves to "Where you are", and the map
// shrinks into the Location section's map box, which shows the same view, so it simply lands there.
// Back: the reverse, from the box to the full screen, down onto the lot, into the 3D, and the camera settles back.
//
// Geo-reference of the estate frame (x east, z south, metres; origin the NE lot corner): fitted on Esri imagery and
// OpenStreetMap (the lot sits on its oil-palm plot between the industrial compound and Persiaran Bertam Perdana 1;
// the road and the roadside trees line up), north = -z within about a degree. tools/geo-check.html draws it.
const LAT0 = 5.5311, LON0 = 100.465658, M_LAT = 110584.6, M_LON = 110804.7;
const LOT = [[0, 0], [-83.331, 1.843], [-89.013, 97.749], [-6.544, 95.922]];
const CEN = [-44.7, 48.8];   // the lot's centroid
const TOP_FOV = 30;          // a long lens for the top-down shot: flatter, closer to the map
const FRAME = 0.46;          // the lot's share of the screen height when the map takes over
const SITE_Z = 14;           // the Location map's own starting zoom (app.js initLocationMap)
const latLngOf = (x, z) => [LAT0 - z / M_LAT, LON0 + x / M_LON];
const zoomFor = mpp => Math.log2(156543.03392 * Math.cos(LAT0 * Math.PI / 180) / mpp);
const ease = u => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const wait = ms => new Promise(r => setTimeout(r, ms));
// app.js globals (a classic script: its top-level const / let are shared with modules by name, not on window)
/* global TILE_LAYERS, SITE_COORD, PIN_DATA, leafletMap, leafletMarkers */
const APP = {
  TILE_LAYERS: () => (typeof TILE_LAYERS !== 'undefined' ? TILE_LAYERS : null),
  SITE_COORD: () => (typeof SITE_COORD !== 'undefined' ? SITE_COORD : null),
  PIN_DATA: () => (typeof PIN_DATA !== 'undefined' ? PIN_DATA : null),
  leafletMap: () => (typeof leafletMap !== 'undefined' ? leafletMap : null),
  leafletMarkers: () => (typeof leafletMarkers !== 'undefined' ? leafletMarkers : null),
};
const appGet = name => APP[name]();

export function createLocation(o) {
  const { THREE, camera, scene, stage, reduced, T } = o;
  const box = document.getElementById('loc-leaflet');
  if (!box || typeof window.loadLeaflet !== 'function') return null;   // no Location map on this page
  const section = document.getElementById('location');
  let busy = false, ov = null, map = null, lotPoly = null;

  // ---------- the camera ----------
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const c0 = V(CEN[0], 0, CEN[1]);
  const topPose = () => {
    const [W, H] = o.size(), half = Math.tan(TOP_FOV * Math.PI / 360);
    const h = (98 / FRAME) / (2 * half);   // the lot (about 96 m north to south) fills FRAME of the height
    return { pos: V(c0.x, h, c0.z + 0.001), tgt: c0.clone(), up: V(0, 0, -1), fov: TOP_FOV, off: [0, 0], h, mpp: 2 * h * half / H, W, H };
  };
  const fogFor = d => { scene.fog.near = d + 60; scene.fog.far = d + 1500; };
  function setCam(p) {
    const [W, H] = o.size();
    camera.up.copy(p.up); camera.position.copy(p.pos); camera.lookAt(p.tgt);
    const d = p.pos.distanceTo(p.tgt);
    camera.fov = p.fov; camera.near = Math.max(2, Math.min(d - 40, d * 0.6)); camera.far = Math.max(6000, d + 3000); fogFor(d);
    if (p.off[0] || p.off[1]) camera.setViewOffset(W, H, p.off[0] * W, p.off[1] * H, W, H); else camera.clearViewOffset();
    camera.updateProjectionMatrix(); o.render();
  }
  // a to b: the target slides over, the view direction swings up to straight down (slerp), the distance changes on a
  // log scale, the up vector turns to north, the lens and the off-centre framing ease across
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qm = new THREE.Quaternion(), Y = V(0, 1, 0);
  function between(a, b, u) {
    const da = a.pos.clone().sub(a.tgt), db = b.pos.clone().sub(b.tgt), la = da.length(), lb = db.length();
    qa.setFromUnitVectors(Y, da.normalize()); qb.setFromUnitVectors(Y, db.normalize()); qm.slerpQuaternions(qa, qb, u);
    const tgt = a.tgt.clone().lerp(b.tgt, u), dir = Y.clone().applyQuaternion(qm);
    const len = Math.exp(Math.log(la) + (Math.log(lb) - Math.log(la)) * u);
    const up = a.up.clone().lerp(b.up, u * u).normalize();
    return { pos: tgt.clone().addScaledVector(dir, len), tgt, up, fov: a.fov + (b.fov - a.fov) * u, off: [a.off[0] + (b.off[0] - a.off[0]) * u, a.off[1] + (b.off[1] - a.off[1]) * u] };
  }
  let flyGen = 0;   // a newer move (or a give-up) stops an older one
  function fly(a, b, ms) {
    const gen = ++flyGen;
    if (reduced || ms <= 0) { setCam(b); return Promise.resolve(); }
    return new Promise(res => {
      const t0 = performance.now();
      const step = () => {
        if (gen !== flyGen) { res(); return; }
        const u = Math.min(1, (performance.now() - t0) / ms);
        setCam(between(a, b, ease(u)));
        if (u < 1) o.nextFrame(step); else res();
      };
      o.nextFrame(step);
    });
  }

  // ---------- the map layer ----------
  // Leaflet, via app.js's own loader; gives up if the script is blocked or never arrives (no frozen page)
  const leaflet = () => (window.L && typeof window.L.map === 'function' ? Promise.resolve(window.L) : new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('leaflet: timed out')), 10000);
    document.addEventListener('leaflet:error', () => { clearTimeout(t); rej(new Error('leaflet: failed to load')); }, { once: true });
    window.loadLeaflet(() => { clearTimeout(t); res(window.L); });
  }));
  const FALLBACK = { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', maxZoom: 19, attribution: 'Tiles &copy; Esri' };
  // whatever the page map shows now: its tile layer (streets, satellite, terrain) and its category filter
  const chosen = sel => { const b = section && section.querySelector(sel); return b ? b.dataset : {}; };
  const layerCfg = () => { const TL = appGet('TILE_LAYERS') || {}; return TL[chosen('.loc-livemap-actions button.active[data-tile]').tile] || TL.streets || FALLBACK; };
  const filterKey = () => chosen('.map-filters button.active[data-filter]').filter || 'all';
  const vw = () => (ov ? ov.clientWidth : document.documentElement.clientWidth);    // the fixed layer's own size (no scrollbar)
  const vh = () => (ov ? ov.clientHeight : document.documentElement.clientHeight);
  const toCentre = rc => { const sz = map.getSize(); return [sz.x / 2 - (rc.left + rc.width / 2), sz.y / 2 - (rc.top + rc.height / 2)]; };   // panBy that puts the map's centre at rc's
  function buildOverlay(L, fade = true) {
    ov = document.createElement('div'); ov.className = 'hxl'; ov.setAttribute('aria-hidden', 'true');
    document.body.append(ov);
    map = L.map(ov, { zoomSnap: 0, maxZoom: 22, fadeAnimation: fade, zoomControl: false, attributionControl: true, dragging: false, scrollWheelZoom: false,
      doubleClickZoom: false, boxZoom: false, keyboard: false, touchZoom: false, tap: false, inertia: false, trackResize: false });
    const tl = layerCfg(), retina = tl.url.indexOf('{r}') >= 0 && L.Browser.retina, sub = tl.subdomains || 'abc';
    // underneath, the same map at the neighbourhood zoom, enlarged: always there while sharper tiles arrive (no blank edges)
    L.tileLayer(tl.url, { subdomains: sub, maxZoom: 22, maxNativeZoom: Math.min(SITE_Z - 1, tl.maxZoom), attribution: '' }).addTo(map);
    // the page map's own tiles; past their deepest zoom they are enlarged (the top-down match sits near z 19)
    const tiles = L.tileLayer(tl.url, { attribution: tl.attribution, subdomains: sub, maxZoom: 22, maxNativeZoom: retina ? tl.maxZoom - 1 : tl.maxZoom, detectRetina: retina }).addTo(map);
    lotPoly = L.polygon(LOT.map(p => latLngOf(p[0], p[1])), { color: '#8A4638', weight: 2, fillColor: '#B17664', fillOpacity: 0.16, interactive: false }).addTo(map);
    return tiles;
  }
  // the page map's dressing on the copy: rings and their labels, the site mark, the places (same classes, so the same
  // look; the places the page map's filter hides stay out)
  const RINGS = [[1000, '1 KM · 12 min walk'], [3000, '3 KM · 5 min drive'], [5000, '5 KM · 8 min drive']];   // as app.js initLocationMap
  function dress(L, dropIn) {
    const site = appGet('SITE_COORD') || latLngOf(-12, 48.8), f = filterKey();
    for (const [r, label] of RINGS) {
      L.circle(site, { radius: r, color: 'rgba(138,70,56,0.30)', weight: 1, dashArray: '3 5', fill: false, interactive: false }).addTo(map);
      L.marker([site[0] + r / 111320, site[1]], { interactive: false, keyboard: false, icon: L.divIcon({ className: 'ring-label-wrap', html: '<span class="ring-label">' + label + '</span>', iconSize: [120, 18], iconAnchor: [60, 9] }) }).addTo(map);
    }
    L.marker(site, { interactive: false, keyboard: false, zIndexOffset: 2000, icon: L.divIcon({ className: 'pin-site-wrap',
      html: '<div class="pin-site"><img src="assets/e-mark-square.png?v=5" alt="" aria-hidden="true" class="pin-site-img"></div><div class="pin-site-label">PANTHERA <span>· BERTAM</span></div>',
      iconSize: [44, 44], iconAnchor: [22, 22] }) }).addTo(map);
    const PIN = appGet('PIN_DATA') || {};
    Object.keys(PIN).sort((a, b) => a - b).forEach((id, i) => {
      const d = PIN[id], ll = String(d.gmaps || '').split(',').map(parseFloat); if (ll.length < 2 || ll.some(isNaN)) return;
      if (f !== 'all' && d.cat !== f) return;
      const m = L.marker(ll, { interactive: false, keyboard: false, icon: L.divIcon({ className: 'pin-chip-wrap ' + (dropIn ? 'pin-prep' : 'pin-in'),
        html: '<div class="pin-chip ' + d.cat + '">' + id + '</div>', iconSize: [32, 32], iconAnchor: [16, 16] }) }).addTo(map);
      if (dropIn) setTimeout(() => { const e = m.getElement(); if (e) { e.classList.remove('pin-prep'); e.classList.add('pin-in'); } }, (reduced ? 0 : 500) + i * (reduced ? 0 : 45));
    });
  }
  // the zoom the pull-out lands on, fetched while the camera lifts (the base layer covers the way there)
  function warm(L, ll, z) {
    const tl = layerCfg(); if (tl.url.indexOf('{r}') >= 0) return;
    const sub = tl.subdomains || 'abc', hw = vw() / 2 + 256, hh = vh() / 2 + 256, p = L.CRS.EPSG3857.latLngToPoint(L.latLng(ll), z);
    for (let x = Math.floor((p.x - hw) / 256); x <= Math.floor((p.x + hw) / 256); x++)
      for (let y = Math.floor((p.y - hh) / 256); y <= Math.floor((p.y + hh) / 256); y++)
        new Image().src = L.Util.template(tl.url, { s: sub[Math.abs(x + y) % sub.length], z, x, y, r: '' });
  }
  const tilesReady = (layer, ms) => Promise.race([new Promise(r => layer.once('load', r)), wait(ms)]);
  // flyTo, done once it is really there (an early 'moveend', e.g. from a resize, is not the end)
  const flyMap = (ll, z, s) => new Promise(res => {
    if (reduced) { map.setView(ll, z, { animate: false }); res(); return; }
    let done = false;
    const fin = () => { if (done) return; done = true; if (map) map.off('moveend', chk); res(); };
    const chk = () => { if (Math.abs(map.getZoom() - z) < 0.01) fin(); };
    map.on('moveend', chk); setTimeout(fin, s * 1000 + 800);
    map.flyTo(ll, z, { duration: s, easeLinearity: 0.2 });
  });
  const opacity = (v, ms) => { ov.style.transition = `opacity ${reduced ? 200 : ms}ms ease`; ov.style.opacity = String(v); return wait((reduced ? 200 : ms) + 30); };
  const clipTo = (r, ms) => {   // the layer's visible part: the map box (r) or the whole screen (null)
    const v = r ? `inset(${r.top.toFixed(1)}px ${(vw() - r.right).toFixed(1)}px ${(vh() - r.bottom).toFixed(1)}px ${r.left.toFixed(1)}px round 18px)` : 'inset(0px 0px 0px 0px round 0px)';
    ov.style.transition = ms && !reduced ? `clip-path ${ms}ms cubic-bezier(.65,0,.35,1), opacity .3s ease` : 'opacity .3s ease';
    ov.style.clipPath = v; return wait(ms && !reduced ? ms + 30 : 30);
  };
  function teardown() { if (map) { map.remove(); map = null; } if (ov) { ov.remove(); ov = null; } lotPoly = null; }

  // ---------- the page ----------
  // scrolling is held only while a move runs (no lasting non-passive listeners on the page)
  const block = e => e.preventDefault();
  const keys = e => { if (/^( |PageUp|PageDown|Home|End|ArrowUp|ArrowDown)$/.test(e.key)) e.preventDefault(); };
  const lockScroll = on => {
    const f = on ? addEventListener : removeEventListener;
    f('wheel', block, { passive: false }); f('touchmove', block, { passive: false }); f('keydown', keys, true);
  };
  const jump = y => window.scrollTo({ top: Math.max(0, y), behavior: 'instant' });
  const boxSpot = () => {   // where the map box should sit on screen when we land: centred under the top bar
    const bar = document.querySelector('.topbar'), barB = bar ? bar.getBoundingClientRect().bottom : 0;
    const h = box.offsetHeight, free = innerHeight - barB;
    return barB + Math.max(12, (free - h) / 2 - (innerWidth <= 720 ? 30 : 0));
  };
  const pageMap = () => appGet('leafletMap');
  async function pageMapReady() {   // the section's own map (app.js starts it when its box nears the screen)
    for (let i = 0; i < 80 && !pageMap(); i++) await wait(50);
    const pm = pageMap(); if (!pm) return null;
    pm.invalidateSize(); return pm;
  }
  function giveUp(e, toSection) {   // whatever happened, the page is usable again (and, going out, shows Location)
    console.warn('location', e);
    flyGen++; teardown(); o.leaving(false); o.restore(); o.hold(false);
    if (toSection && section) section.scrollIntoView();
  }

  // ---------- out ----------
  async function go() {
    if (busy) return; busy = true; lockScroll(true);
    try {
      const Lp = leaflet();
      o.leaving(true); o.hold(true); o.settleMix();
      const from = o.poseNow(), to = topPose();
      const flyP = fly(from, to, 2300);   // the lift starts at once; the map is built while it runs
      const L = await Lp, tiles = buildOverlay(L);
      warm(L, appGet('SITE_COORD') || latLngOf(-12, 48.8), SITE_Z);
      map.setView(latLngOf(CEN[0], CEN[1]), zoomFor(to.mpp), { animate: false });
      map.panBy(toCentre(stage.getBoundingClientRect()), { animate: false });   // the lot under the stage's centre, as in the 3D
      const ready = tilesReady(tiles, 2500);
      await flyP; await ready;
      await opacity(1, 750);   // the 3D and the map, one on the other
      // behind the map: the page moves to Where you are (measured before its reveal animation shifts it)
      const y = box.getBoundingClientRect().top + scrollY - boxSpot();
      if (section) section.querySelectorAll('[data-reveal]').forEach(e => e.classList.add('in'));
      jump(y);
      o.leaving(false); o.restore(); o.hold(false);
      const pmP = pageMapReady();
      dress(L, true);
      const site = appGet('SITE_COORD') || latLngOf(-12, 48.8);
      await flyMap(site, SITE_Z, 2.2);
      const pm = await pmP;
      if (pm) {
        pm.setView(site, SITE_Z, { animate: false });
        const ms = appGet('leafletMarkers') || {};   // its places already landed (no second drop-in after ours)
        for (const k in ms) { const e = ms[k].getElement && ms[k].getElement(); if (e) { e.classList.remove('pin-prep'); e.classList.add('pin-in'); } }
      }
      // shrink into the box: the site mark slides to the box's centre while the edges close in
      const r = box.getBoundingClientRect();
      map.panBy(toCentre(r), { duration: reduced ? 0 : 0.9, easeLinearity: 0.3, animate: !reduced });
      await clipTo(r, 900);
      await opacity(0, 350);
      teardown();
      if (backBtn) backBtn.focus({ preventScroll: true });
    } catch (e) { giveUp(e, true); }
    finally { busy = false; lockScroll(false); }
  }

  // ---------- out, in app mode (the page does not scroll) ----------
  // show(): opens the Location panel at once, under the map layer. The map lands in the panel's own map box and the
  // 3D stays held, looking straight down, beside the panel. Resolves with back(view): the camera down again.
  async function goApp(show) {
    if (busy) return null; busy = true; lockScroll(true);
    const to = topPose();
    try {
      const Lp = leaflet();
      o.leaving(true); o.hold(true); o.settleMix();
      const from = o.poseNow();
      const flyP = fly(from, to, 2300);
      const L = await Lp, tiles = buildOverlay(L);
      warm(L, appGet('SITE_COORD') || latLngOf(-12, 48.8), SITE_Z);
      map.setView(latLngOf(CEN[0], CEN[1]), zoomFor(to.mpp), { animate: false });
      map.panBy(toCentre(stage.getBoundingClientRect()), { animate: false });
      const ready = tilesReady(tiles, 2500);
      await flyP; await ready;
      await opacity(1, 750);
      show();                                    // the panel, behind the map layer
      o.leaving(false);
      await wait(60);
      const pmP = pageMapReady();
      dress(L, true);
      const site = appGet('SITE_COORD') || latLngOf(-12, 48.8);
      await flyMap(site, SITE_Z, 2.2);
      const pm = await pmP;
      if (pm) {
        pm.invalidateSize(); pm.setView(site, SITE_Z, { animate: false });
        const ms = appGet('leafletMarkers') || {};
        for (const k in ms) { const e = ms[k].getElement && ms[k].getElement(); if (e) { e.classList.remove('pin-prep'); e.classList.add('pin-in'); } }
      }
      const r = box.getBoundingClientRect();
      map.panBy(toCentre(r), { duration: reduced ? 0 : 0.9, easeLinearity: 0.3, animate: !reduced });
      await clipTo(r, 900);
      await opacity(0, 350);
      teardown();
    } catch (e) { giveUp(e, false); busy = false; lockScroll(false); return null; }
    busy = false; lockScroll(false);
    // back down: from straight above to the given view (a rig goal: tgt, az, el, dist, fov), then the hero has it again
    return async view => {
      const g = view && view.goal, offH = o.homeOff ? o.homeOff() : [0, 0];
      let dest = o.poseNow();
      if (g) {
        const c = Math.cos(g.el), T3 = new THREE.Vector3(...g.tgt);
        dest = { pos: new THREE.Vector3(T3.x + g.dist * c * Math.cos(g.az), T3.y + g.dist * Math.sin(g.el), T3.z + g.dist * c * Math.sin(g.az)), tgt: T3, up: new THREE.Vector3(0, 1, 0), fov: g.fov, off: offH };
      }
      o.leaving(true);
      await fly(to, dest, 2100);
      o.leaving(false); o.restore(dest); o.hold(false);
    };
  }

  // ---------- back ----------
  async function back() {
    if (busy) return; busy = true; lockScroll(true);
    try {
      const L = await leaflet(), pm = pageMap();
      const tiles = buildOverlay(L, false);   // no tile fade: it must look like the box from its first frame
      const r = box.getBoundingClientRect(), at = pm ? pm.getCenter() : (appGet('SITE_COORD') || latLngOf(-12, 48.8)), z = pm ? pm.getZoom() : SITE_Z;
      map.setView(at, z, { animate: false });
      const d = toCentre(r); map.panBy(d, { animate: false });
      dress(L, false);
      await clipTo(r, 0); await tilesReady(tiles, 800);
      ov.style.transition = 'none'; ov.style.opacity = '1';
      await wait(30);
      map.panBy([-d[0], -d[1]], { duration: reduced ? 0 : 0.8, animate: !reduced });
      await clipTo(null, 800);
      // behind the map: back to the end of the runway, the camera straight down over the lot, all 3D
      o.leaving(true); o.hold(true);
      jump(o.endY());
      await wait(60);
      o.settleMix();
      const to = topPose();
      setCam(to);
      const zt = zoomFor(to.mpp), off = toCentre(stage.getBoundingClientRect());
      const centre = map.unproject(map.project(latLngOf(CEN[0], CEN[1]), zt).add(off), zt);
      lotPoly.setStyle({ opacity: 0, fillOpacity: 0 });   // an outline enlarged mid-zoom goes thick and soft: drawn again once there
      await flyMap(centre, zt, 2.0);
      lotPoly.setStyle({ opacity: 1, fillOpacity: 0.16 });
      await wait(reduced ? 0 : 250);
      ov.querySelectorAll('.pin-chip-wrap, .pin-site-wrap, .ring-label-wrap').forEach(e => { e.style.transition = 'opacity .4s ease'; e.style.opacity = '0'; });
      await opacity(0, 800);
      teardown();
      o.restore();   // the hero's pose for the end of the runway, still held
      await fly(to, o.poseNow(), 2100);
      o.leaving(false); o.restore(); o.hold(false);
      const a = document.activeElement;
      if (!a || a === backBtn || a === document.body) stage.focus({ preventScroll: true });
    } catch (e) { giveUp(e, false); }
    finally { busy = false; lockScroll(false); }
  }

  // "Back to estate" on the Location map
  let backBtn = null;
  const bar = !o.app && section && section.querySelector('.loc-livemap-actions');
  if (bar) {
    backBtn = document.createElement('button'); backBtn.type = 'button'; backBtn.className = 'loc-back3d';
    backBtn.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.8 3.5 7.4v9.2l8.5 4.6 8.5-4.6V7.4z"/><path d="M3.5 7.4 12 12l8.5-4.6M12 12v9.2"/></svg><span data-i18n="hx.loc.back"></span>';
    backBtn.lastChild.textContent = T('hx.loc.back');
    backBtn.addEventListener('click', back);
    bar.prepend(backBtn);
  }
  return { go, back, goApp, prefetch: () => { leaflet().catch(() => {}); }, get busy() { return busy; } };
}
