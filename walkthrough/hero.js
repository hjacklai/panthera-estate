// hero.js · the scroll-played estate hero (loaded by hero-boot.js; one renderer, render on demand).
//
// The hero section is a sticky stage over a runway (hero-boot.js). Scroll progress through the runway plays a
// scripted camera path over the baked estate at golden hour: the whole estate from high up, down over the
// central green, along the estate road, settling on the Semi-D pair and the bungalow. Pins and cards appear at
// the end of the runway; on desktop a mouse drag then orbits gently (wheel always scrolls the page).
// Choosing a home (its pin's card, or the Semi-D | Bungalow pill) opens the tour overlay (explore.js): the camera
// comes down onto the plot and the walkthrough takes over on this same canvas.
// Arrival: the poster photo stays; the 3D builds hidden. The first key matches the photo's own viewpoint, and over
// the first half screen of scroll the photo dissolves into the 3D (scrolling back to the top brings the photo back).
// Semi-D | Bungalow stays in step with the landing page's pill (home-toggle.js: 'panthera:home', PantheraHome).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fetchPack } from './pack.js?v=4';
import { createHD } from './hd.js?v=9';
import { BAKE_VER, BAKE_REV } from './versions.js?v=3';
import { buildHeroEstate } from './hero-lod.js?v=4';
import { createTod } from './hero-tod.js?v=10';
import { createOrbit } from './hero-orbit.js?v=2';
import { createRig } from './hero-rig.js?v=6';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (p, a, b) => clamp((p - a) / (b - a));
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Camera path, estate frame (x east, z south, metres; the lot runs x -89..0, z 0..98), p = runway progress.
// The poster (assets/hero-aerial-dusk.webp, 1365 x 768) seen as a camera: the first key, so the photo dissolves
// into the same view. fov is vertical at the photo's own shape (object-fit: cover crops it on other screens).
const PHOTO = { pos: [65.1, 90.8, 12.8], tgt: [-32.9, 0, 48.2], fov: 29.4, aspect: 1365 / 768 };   // fitted to six landmarks (about 29 px rms at 1265 x 800; the photo is an artist's impression)
const DISSOLVE = [0.03, 0.45];   // screens of scroll over which the photo turns into the 3D
// A calm glide (owner, Nov 2026: the old dive to the road and climb back was "abit dizzy"): one slow swing round the
// estate from the photo's east side to the south-east, at about the same height, no dives
const KEYS = [
  { p: 0.00, pos: PHOTO.pos, tgt: PHOTO.tgt, fov: PHOTO.fov },     // (a) the whole estate from the east, as in the photo
  { p: 0.40, pos: [58, 82, 48], tgt: [-36, 0, 44], fov: 33 },       // (b) the green and its playground in the middle
  { p: 0.72, pos: [52, 80, 78], tgt: [-42, -1, 37], fov: 37 },
  { p: 1.00, pos: [46, 84, 96], tgt: [-46, -2, 32], fov: 40 },      // (c) settles on the Semi-D pairs and the bungalow, the green in view
];
// portrait screens: the copy covers most of the stage, so the last stretch ends on the row of homes seen from the
// south, laid across the band under the top bar
const END_PORTRAIT = { pos: [-44, 110, 210], tgt: [-44, 22, 28], fov: 44 };
const STILLS = [0, 0.42, 0.8, 1];   // reduced motion: crossfade between these
// hx.l1 and hx.l3 shown over these stretches (the pins take over at the end); the playground line is gone (owner, Nov 2026:
// "this one can remove")
const LINES = [[0.03, 0.40], [0.44, 0.95]];
// app mode: the lines keep their own slower clock (ms from the start of the intro), so they can be read whatever the
// camera does; no l1 (the headline already says it). Owner: "people no enough time to read"
const LINES_APP = [null, [600, 6800]], LINE_FADE = 450;
const PINS_AT = 0.93;
const POI = {   // anchors (estate frame) and what each card says
  // the estate itself carries no labels (owner, Nov 2026: "no need show" the Semi-D, Bungalow, Central green, Playground
  // and Estate entrance pills): the walk-in pill below opens either home, and the page carries the facts
  // app mode only (one 3D screen, owner, Nov 2026): LOCATION on the main road (the lift into the map), and quiet
  // feature icons on the places the page's notes describe; a tap glides the camera there and the caption changes
  // (hero-app.js FEATS). ico: the page's own line icon for it.
  location: { ay: 2, prio: 1, xz: [16.2, 30], go: 'location', app: true },
  // phones (owner, Nov 2026: the icons felt crowded): the four site features share one icon on the green; its caption's
  // arrows step through them. Wider screens keep the four.
  features: { ay: 4, prio: 2, xz: [-25.5, 47], feat: true, app: true, only: 'phone', opens: 'green', label: 'hx.pin.features', ico: '.site-notes .note:nth-child(1) .ico' },
  green: { ay: 4, prio: 2, xz: [-25.5, 47], feat: true, app: true, only: 'desk', label: 'site.note1.h', ico: '.site-notes .note:nth-child(1) .ico' },
  road: { ay: 1.5, prio: 3, xz: [-30, 29.4], feat: true, app: true, only: 'desk', label: 'site.note2.h', ico: '.site-notes .note:nth-child(2) .ico' },
  pond: { ay: 1, prio: 4, xz: [-10.6, 42.6], feat: true, app: true, only: 'desk', label: 'site.note4.h', ico: '.site-notes .note:nth-child(4) .ico' },
  title: { ay: 7, prio: 5, xz: [-44, 86], feat: true, app: true, only: 'desk', label: 'site.note3.h', ico: '.site-notes .note:nth-child(3) .ico' },
  semid: { ay: 12, prio: 6, xz: [-14.6, 16.2], feat: true, app: true, label: 'hx.pin.semid', svg: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 15 9.5 8l6.5 6.5L22.5 8l7 7"/><path d="M4.5 13.5V26h23V13.5M16 14.5V26"/><path d="M8 26v-5h3.5v5M20.5 26v-5H24v5"/></svg>' },
  bungalow: { ay: 11, prio: 7, xz: [-73.6, 13.4], feat: true, app: true, label: 'hx.pin.bungalow', svg: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15 16 5l12 10"/><path d="M7 13v13h18V13"/><path d="M13 26v-7h6v7"/></svg>' },
};

// Hermite through the keys (Catmull-Rom tangents on the uneven p, flat at both ends)
function curve(keys, get) {
  const n = keys.length, pts = keys.map(get), tan = pts.map((_, i) => {
    if (i === 0 || i === n - 1) return pts[i].map(() => 0);
    const dt = keys[i + 1].p - keys[i - 1].p;
    return pts[i].map((v, j) => (pts[i + 1][j] - pts[i - 1][j]) / dt);
  });
  return p => {
    p = clamp(p);
    let i = 0; while (i < n - 2 && p > keys[i + 1].p) i++;
    const h = keys[i + 1].p - keys[i].p, u = (p - keys[i].p) / h, u2 = u * u, u3 = u2 * u;
    const a = 2 * u3 - 3 * u2 + 1, b = u3 - 2 * u2 + u, c = -2 * u3 + 3 * u2, d = u3 - u2;
    return pts[i].map((v, j) => a * v + b * h * tan[i][j] + c * pts[i + 1][j] + d * h * tan[i + 1][j]);
  };
}
const posAt = curve(KEYS, k => k.pos), tgtAt = curve(KEYS, k => k.tgt), fovAt = curve(KEYS, k => [k.fov]);

export async function start(o) {
  const { hero, base, lite, reduced, t: T, fail } = o;
  // app mode: the site as one 3D screen, tapped through (hero-app.js); the page does not scroll
  const APP = !!o.app, html = document.documentElement, INTRO_MS = reduced ? 0 : 6500;
  let pendingWalk = null;   // a walk-in tapped before the 3D was ready: opened as soon as it is
  let life = null, lifeTimer = 0, neighbours = null, lineT0 = null, autoP = 0, introT0 = null, rigOn = false, panelOpen = false, panelWide = false, app = null, appOn = false;
  let runway = o.runway;
  // app mode: resolved when the intro glide has ended (finishIntro), so the idle work that swaps textures, decodes the
  // sky or adds meshes (each a shader compile or texture upload on the next frame) lands while the camera is still,
  // not as a hitch mid-glide. The scrolling page has no timed intro: at once.
  let introDoneRes = null;
  const introDone = APP ? new Promise(r => { introDoneRes = r; }) : Promise.resolve();
  const SEL = s => hero.querySelector(s);
  const bg = SEL('.hero-bg');
  // loop state (frames run only once everything below is built)
  let snapT = 0, s = 0, raf = 0, last = 0, dirty = true, visible = true, scrolledAt = 0, still = -1, slow = 0, okF = 0, frames = 0, live = false, held = false;
  // movingAt: the last frame the camera, the dissolve or the intro moved (quiet() waits for it to be a while ago).
  // introMs, lineMs: the intro's and its lines' own clocks, advanced per frame (see frame()); frameMs: the usual frame
  let movingAt = 0, introMs = 0, lineMs = 0, frameMs = 1000 / 60;
  let expo = 1;   // this scene's exposure (the walkthrough sets its own on the shared renderer)
  let ao = null;   // contact shadows (hero-ao.js), once loaded
  function need() { if (live && !held && !raf && visible && !document.hidden) raf = nextFrame(frame); }
  // requestAnimationFrame, with a timer as a fallback where rAF is throttled though the page is shown (some embedded views)
  function nextFrame(f) {
    let done = false;
    const go = t => { if (done) return; done = true; cancelAnimationFrame(id); clearTimeout(to); f(t); };
    const id = requestAnimationFrame(go), to = setTimeout(() => go(performance.now()), 100);
    return 1;
  }
  const idle = window.requestIdleCallback ? (f, o2) => window.requestIdleCallback(f, o2) : (f => setTimeout(f, 300));
  // resolves once the hero camera has been still for ms (no intro glide, drag, caption glide or dissolve; the cars and
  // birds do not count), or at once while the tour or the Location move has the canvas. One-off jobs (textures, the
  // tours built ahead, the sky) wait for it, so they never land on a moving frame
  function quiet(ms = 600) {
    return new Promise(r => { const chk = () => (held || (live && performance.now() - movingAt >= ms) ? r() : setTimeout(chk, 120)); chk(); });
  }

  // ---------- DOM ----------
  const stage = document.createElement('div');
  stage.className = 'h3d-stage'; stage.tabIndex = 0; stage.setAttribute('role', 'group');
  // labels in the current language; data-i18n-aria lets app.js applyI18n re-label on a switch (the role description
  // is refreshed by the language hook below)
  stage.setAttribute('aria-roledescription', T('hx.stage.role')); stage.setAttribute('aria-label', T('hx.stage')); stage.setAttribute('data-i18n-aria', 'hx.stage');
  const canvas = document.createElement('canvas'); canvas.className = 'hx-gl'; canvas.setAttribute('aria-hidden', 'true');
  const snap = document.createElement('canvas'); snap.className = 'hx-snap'; snap.setAttribute('aria-hidden', 'true');
  // the live scrim fades in with the 3D (the poster's own scrim fades out over it)
  const veil = document.createElement('div'); veil.className = 'hx-veil'; veil.setAttribute('aria-hidden', 'true');
  stage.append(canvas, snap, veil);
  // reduced motion: the rig's scripted moves (menu, icons, caption steps) jump instead of gliding; drags stay as they are
  const rig = APP ? createRig(THREE, stage, { onChange: () => { dirty = true; need(); }, reduced }) : null;
  stage.style.opacity = '0';
  bg.after(stage);
  const scrim = SEL('.hero-scrim'), slide = SEL('.hero-slide');
  const ui = document.createElement('div'); ui.className = 'h3d-ui';
  const el = (tag, cls, attrs = {}, text) => { const e = document.createElement(tag); if (cls) e.className = cls; for (const k in attrs) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; return e; };
  const i18n = (e, key) => { e.setAttribute('data-i18n', key); e.textContent = T(key); return e; };
  const lines = el('div', 'hx-lines');
  const lineEls = [1, 3].map(i => lines.appendChild(i18n(el('p', 'hx-line'), APP && i === 3 ? 'hx.l3app' : 'hx.l' + i)));
  const pinsNav = el('nav', 'hx-pins', { 'aria-label': T('hx.pins'), 'data-i18n-aria': 'hx.pins' });
  const hasLoc = !!document.getElementById('loc-leaflet');   // the Location pin only where the page has its map
  // app mode: Location lives in the bottom bar now, so no compass on the 3D (owner, Nov 2026: "no need keep compass icon")
  const pins = Object.entries(POI).filter(([id, d]) => (id !== 'location' || hasLoc) && (!d.app || APP)).map(([id, d]) => {
    const b = el('button', 'hx-pin' + (d.go ? ' hx-pin-go' : '') + (d.feat ? ' hx-feat' : ''), d.go || d.feat ? { type: 'button', 'data-id': id, tabindex: '-1' } : { type: 'button', 'aria-haspopup': 'dialog', 'aria-controls': 'hx-card', 'data-id': id, tabindex: '-1' });
    const lab = i18n(el('span', 'hx-pin-t'), d.label || 'hx.pin.' + id), pl = el('span', 'hx-pin-l');
    if (d.feat) {   // an icon only (its name shows on hover and to screen readers)
      const ic = el('span', 'hx-feat-ic', { 'aria-hidden': 'true' }), src = d.svg ? Object.assign(document.createElement('template'), { innerHTML: d.svg }).content.firstElementChild : d.ico && document.querySelector(d.ico);
      if (src) { const svg = src.cloneNode(true); svg.removeAttribute('class'); svg.setAttribute('width', '22'); svg.setAttribute('height', '22'); ic.append(svg); }
      pl.append(lab); b.append(ic, pl);
      pinsNav.append(b);
      return { id, ...d, b, w: 0, h: 0, on: false, x: 0, y: 0, world: null };
    }
    if (d.go) { const ic = el('span', 'hx-pin-ic', { 'aria-hidden': 'true' }); ic.innerHTML = d.go === 'site'
      ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="1.5"/><path d="M3.5 10h7v10.5M10.5 14h10"/></svg>'
      : '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><circle cx="12" cy="12" r="9.2"/><path d="M15.6 8.4 13.4 13.4 8.4 15.6 10.6 10.6z"/></svg>'; pl.append(ic); }
    pl.append(lab);
    b.append(el('span', 'hx-pin-dot', { 'aria-hidden': 'true' }), pl);
    pinsNav.append(b);
    return { id, ...d, b, w: 0, h: 0, on: false, x: 0, y: 0, world: null };
  });
  const card = el('div', 'hx-card', { id: 'hx-card', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'hx-card-h', hidden: '' });
  const cardH = el('h3', 'hx-card-h', { id: 'hx-card-h', tabindex: '-1' }), cardT = el('p', 'hx-card-t'), cardP = el('p', 'hx-card-p'), cardN = el('p', 'hx-card-n');
  const cardWalk = el('a', 'hx-card-walk'); i18n(cardWalk, 'hx.walk');
  const cardX = el('button', 'hx-card-x', { type: 'button', 'aria-label': T('hx.close'), 'data-i18n-aria': 'hx.close' }, '×');
  card.append(cardX, cardH, cardT, cardP, cardN, cardWalk);
  const tod = el('div', 'hx-tod', { role: 'radiogroup', 'aria-label': T('hx.tod'), 'data-i18n-aria': 'hx.tod' });
  const todBtns = ['day', 'golden', 'night'].map(n => { const b = i18n(el('button', 'hx-tod-b', { type: 'button', role: 'radio', 'aria-checked': 'false', 'data-tod': n }), 'hx.tod.' + n); tod.append(b); return b; });
  // One pill, two ways in (owner, Nov 2026: "maybe 2 button? semid and bungalow in one pill"): a '3D walkthrough /
  // Walk inside' head with a 3D-house mark, then big Semi-D and Bungalow buttons straight into that home's tour. The
  // home the landing page is on (its own pill, home-toggle.js) is the filled one. Shown once the flight has ended.
  const homes = el('div', 'hx-homes hx-two', { role: 'group', 'aria-label': T('hx.walk'), 'data-i18n-aria': 'hx.walk' });
  const walkIc = el('span', 'hx-walk-ic', { 'aria-hidden': 'true' });
  walkIc.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 2.8 3.5 7.4v9.2l8.5 4.6 8.5-4.6V7.4z"/><path d="M3.5 7.4 12 12l8.5-4.6M12 12v9.2"/></svg>';
  const walkTx = el('span', 'hx-walk-tx', { 'aria-hidden': 'true' });
  walkTx.append(i18n(el('small', 'hx-walk-k'), 'hx.tour'), i18n(el('b', 'hx-walk-l'), 'hx.walk'));
  homes.append(walkIc, walkTx);
  const homeBtns = ['semid', 'bungalow'].map(h => {
    const b = el('button', 'hx-homes-b hx-walk', { type: 'button', 'data-home': h });
    b.append(i18n(el('span', 'hx-walk-h'), 'hx.pin.' + h), el('span', 'hx-walk-ar', { 'aria-hidden': 'true' }, '→'));
    homes.append(b); return b;
  });
  ui.append(lines, pinsNav, card, homes);   // no time-of-day switch on the landing hero (owner, Nov 2026): always golden hour
  hero.append(ui);

  // ---------- renderer ----------
  let renderer;
  const AA = !lite || !(navigator.deviceMemory && navigator.deviceMemory <= 2);
  try {
    // MSAA on phones too (owner, Nov 2026: jagged roof and road edges): phone GPUs draw in tiles, where 4x MSAA is
    // nearly free; only very low-memory phones go without. The slow-frame step still lowers the pixel ratio if needed.
    renderer = new THREE.WebGLRenderer({ canvas, antialias: AA, powerPreference: 'high-performance', alpha: false });
  } catch (e) { fail(e); return; }
  if (!renderer.capabilities.isWebGL2) { renderer.dispose(); fail(new Error('no WebGL2')); return; }
  const DPR_MAX = Math.min(window.devicePixelRatio || 1, lite ? 1.5 : 2);   // phones sharper (was 1.25); the slow-frame step below brings it back down when a phone can't keep up
  let dpr = DPR_MAX, dprLock = false;   // dprLock: the frame times stepped it down, so it no longer steps back up
  const BUDGET = 22;   // ms for one opening frame, drawn and waited for (see the measure before the first frame)
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;

  // pace: each photo map uploaded on its own, when the camera is still and the browser idle (see quiet)
  const hd = createHD({ THREE, renderer, res: '1k', lite: true, base: base + 'hd/', pace: () => quiet(300).then(() => new Promise(r => idle(r, { timeout: 1000 }))), onChange: () => { renderer.compileAsync(scene, camera).catch(() => {}).then(() => { dirty = true; need(); }); } });
  // the pack and (desktop) the golden sky, in parallel
  const packP = fetchPack({ base: base + 'bake/', ver: BAKE_VER, tier: lite ? 512 : 1024, priority: 'high', rev: BAKE_REV });
  // the aerial copy's visibility result, saved ahead (saves the 2-3 s id render on phones); optional
  const masksP = o.flag === 'lodlive' ? Promise.resolve(null) : fetch(base + `bake/hero-lod.${BAKE_VER}.json?v=${BAKE_REV}`).then(r => (r.ok ? r.json() : null)).catch(() => null);
  const goldenP = lite ? null : hd.sky('golden');
  // the neighbourhood (hero-context.js and its data) and the breeze's shaders (hero-life.js), fetched beside the pack:
  // both go in before the first frame now (see there)
  const ctxP = Promise.all([import(base + 'hero-context.js?v=14'), fetch(base + 'context.e1.json?v=1').then(r => (r.ok ? r.json() : null))]).catch(e => { console.warn('hero 3D: no neighbourhood', e); return null; });
  const lifeP = reduced ? null : import(base + 'hero-life.js?v=9').catch(e => { console.warn('hero 3D: no life', e); return null; });
  let pack;
  try { pack = await packP; } catch (e) { renderer.dispose(); fail(e); return; }
  performance.mark('hx-data');

  // ---------- scene ----------
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xF3E7D6);
  scene.fog = new THREE.Fog(0xF3E7D6, 380, 1500);
  const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');
  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomEnv = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; pmrem.dispose();
  scene.environment = roomEnv;
  const lod = await masksP, masks = lod && lod.ver === BAKE_VER ? lod[lite ? 'lite' : 'full'] : null;
  const est = buildHeroEstate({ THREE, renderer, pack, mergeGeometries, lite, aniso: lite ? 4 : 8, prune: o.flag !== 'full', masks });   // ?hero=full: no pruning (for comparing)
  scene.add(est.root);
  const CENTRE = V(-42, 0, 48), LOT_C = V(-44.5, 0, 48.5);   // LOT_C: the middle of the lot (x -89..0, z 0..97)
  // the land beyond the estate's own ground, well below it (so the dry pond keeps its depth), lost in the fog
  const land = new THREE.Mesh(new THREE.CircleGeometry(2600, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xA9AE8C, roughness: 1 }));
  land.position.set(CENTRE.x, -2.6, CENTRE.z); land.receiveShadow = true; scene.add(land);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x9DBBD0) }, horizon: { value: new THREE.Color(0xF3E7D6) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 horizon; varying vec3 vP; void main(){ float t = pow(clamp(vP.y, 0.0, 1.0), 0.55); gl_FragColor = vec4(mix(horizon, top, t), 1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(2800, 32, 16), skyMat); sky.renderOrder = -1; sky.frustumCulled = false; scene.add(sky);
  const hemi = new THREE.HemisphereLight(0xfff4e4, 0xcbb8a2, 0.55); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe2bf, 2.3);
  sun.target.position.copy(CENTRE); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);   // phones too (owner, Nov 2026: "in mobile got show nice shadow hd?"): drawn only when the scene changes, so crisper costs no frame time
  Object.assign(sun.shadow.camera, { left: -100, right: 100, top: 100, bottom: -100, near: 20, far: 520 });
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.06;
  scene.add(sun, sun.target);
  // night: light pools on the ground under the street lamps (positions from estate.json, fetched on first night)
  const poolTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,214,160,0.9)'); gr.addColorStop(0.4, 'rgba(255,200,140,0.32)'); gr.addColorStop(1, 'rgba(255,200,140,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false, polygonOffset: true, polygonOffsetFactor: -4 }), 32);
  pools.count = 0; pools.visible = false; pools.frustumCulled = false; scene.add(pools);
  let poolsAsked = false;
  const loadPools = () => {
    if (poolsAsked) return; poolsAsked = true;
    fetch(base + 'estate.json?v=25').then(r => r.json()).then(E => {
      const S = { A: 15, B: 17, C: 13, D: 7 }, M4 = new THREE.Matrix4();
      const ls = (E.lights || []).filter(l => l.xz[0] > -110 && l.xz[0] < 40 && l.xz[1] > -20 && l.xz[1] < 125).slice(0, 32);
      ls.forEach((l, i) => { const s = S[l.t] || 12; pools.setMatrixAt(i, M4.makeScale(s, 1, s).setPosition(l.xz[0], -0.24, l.xz[1])); });
      pools.count = ls.length; pools.instanceMatrix.needsUpdate = true; dirty = true; need();
    }).catch(() => {});
  };

  const camera = new THREE.PerspectiveCamera(36, 1, 2, 6000);
  const todCtl = createTod({ THREE, renderer, scene, sun, hemi, sky: skyMat, hd, roomEnv, lamps: est.lamps, glass: est.glass, pools, reduced,
    onChange: () => { expo = renderer.toneMappingExposure; dirty = true; need(); } });
  let todName = 'golden';
  // always golden hour (the switch was removed); an older saved choice is ignored
  if (goldenP && todName === 'golden') { const s = await Promise.race([goldenP, new Promise(r => setTimeout(r, 1500))]); void s; }
  todCtl.jump(todName);
  if (!lite || todName !== 'golden') todCtl.set(todName, true);   // fetches the HDRI (phones: golden waits until idle, below)
  expo = renderer.toneMappingExposure;
  if (todName === 'night') loadPools();
  performance.mark('hx-decoded');

  // ---------- layout ----------
  let W = 1, H = 1, portrait = false, copyRect = null, travel = 1, off = [0, 0], offBase = [0, 0];
  let holdP = 0.14, joinP = 0.4;   // the camera holds the photo's pose up to holdP and is on its own path from joinP
  const copyEl = SEL('.hero-copy');
  const applyOff = () => {
    if (off[0] || off[1]) camera.setViewOffset(W, H, off[0] * W, off[1] * H, W, H);
    else camera.clearViewOffset();
  };
  let resizeMissed = false;   // a resize while held (the tour or the Location move has the camera): done on release
  const v2 = new THREE.Vector2();
  const resize = () => {
    if (held) { resizeMissed = true; return; }   // the tour overlay has the canvas: it sizes it (see giveBack)
    resizeMissed = false;
    W = Math.max(1, stage.clientWidth); H = Math.max(1, stage.clientHeight); portrait = W / H < 0.9;
    // only when the size really changes: each call reallocates the drawing buffers (setPixelRatio has already resized)
    const pr = renderer.getPixelRatio(), sz = renderer.getSize(v2);
    if (sz.x !== W || sz.y !== H || canvas.width !== Math.floor(W * pr) || canvas.height !== Math.floor(H * pr)) renderer.setSize(W, H, false);
    const sw = Math.round(W * dpr), sh = Math.round(H * dpr);
    if (snap.width !== sw || snap.height !== sh) { snap.width = sw; snap.height = sh; }
    camera.aspect = W / H;
    // the estate sits right of the copy on wide screens, above it on portrait ones (not while it is still the photo)
    // app mode: the estate in the middle of every screen (owner, Nov 2026: "ensure the 3d in middle of all viewport");
    // the scrolling page keeps it beside the copy
    // app mode: the estate in the middle of the OPEN part of the screen, above the copy, pill and bar (owner, Nov 2026:
    // "move up abit the center of screen for people to pan"): well up on phones, a little on wider screens
    offBase = APP ? openOff() : W > 760 && !portrait ? [-0.21, 0] : portrait ? [0, 0.3] : [0, 0];
    travel = APP ? Math.max(1, H * 2.2) : runway ? Math.max(1, runway.offsetHeight - hero.offsetHeight) : Math.max(1, hero.offsetHeight);
    if (rigOn) rig.setOff(...offNow());
    const dEnd = DISSOLVE[1] * H / travel;   // the dissolve's end in runway progress
    holdP = dEnd * 0.68; joinP = dEnd + 0.2;
    if (aimHome) aimFor(aimHome);   // portrait and landscape end on different poses
    applyOff(); camera.updateProjectionMatrix();
    for (const p of pins) p.w = 0;
    dirty = true; need();
    // drawn now, not on the next frame: a resized canvas is blank until it is drawn again, and while a window is being
    // dragged the next frame can come late (owner, Nov 2026: old page showing through on resize)
    if (frames > 0 && !lost) { try { render(); } catch (e) { /* the frame loop draws it */ } }
  };
  const progressNow = () => {
    if (APP) return autoP;   // app mode: the intro's own clock, not the scroll
    const r = (runway || hero).getBoundingClientRect();
    return clamp(-r.top / travel);
  };
  // how far into the dissolve (0 photo, 1 all 3D) for a runway progress
  const mixFor = p => { const u = seg(p * travel / H, DISSOLVE[0], DISSOLVE[1]); return u * u * (3 - 2 * u); };

  // ---------- camera ----------
  const pos = V(0, 0, 0), tgt = V(0, 0, 0), v1 = V(0, 0, 0), camWas = V(0, 0, 0), tgtWas = V(0, 0, 0);
  let fov = 36;
  // the path's own clock: still at the photo's pose up to holdP, eased in, then the runway progress itself from joinP
  const pathAt = p => {
    if (p <= holdP) return 0;
    if (p >= joinP) return p;
    const L = joinP - holdP, x = p - holdP, A = (3 * joinP - L) / (L * L), B = (1 - 2 * joinP / L) / (L * L);
    return A * x * x + B * x * x * x;
  };
  const settleAt = p => { const u = seg(p, holdP, joinP); return u * u * (3 - 2 * u); };   // 0 photo framing, 1 the path's own
  const D2R = Math.PI / 360;
  function poseAt(p) {
    const q = pathAt(p), w = settleAt(p);
    pos.fromArray(posAt(q)); tgt.fromArray(tgtAt(q)); fov = fovAt(q)[0];
    // the photo fills the stage (object-fit: cover): a screen wider than the photo sees less of its height
    if (w < 1 && camera.aspect > PHOTO.aspect) fov = lerp(Math.atan(Math.tan(fov * D2R) * PHOTO.aspect / camera.aspect) / D2R, fov, w);
    if (portrait && w > 0) {   // same width of estate on a tall screen: a wider lens and a step back
      const want = Math.atan(Math.tan(fov * D2R) * 1.6 / camera.aspect) / D2R * 0.8;
      const f = clamp(want, fov, 58), k = clamp(Math.pow(Math.tan(want * D2R) / Math.tan(f * D2R), 0.8), 1, 1.9);
      pos.sub(tgt).multiplyScalar(lerp(1, k, w)).add(tgt); fov = lerp(fov, f, w);
      const u = seg(p, 0.8, 1), e = u * u * (3 - 2 * u);
      if (e > 0) { pos.lerp(v1.fromArray(END_PORTRAIT.pos), e); tgt.lerp(v1.fromArray(END_PORTRAIT.tgt), e); fov = lerp(fov, END_PORTRAIT.fov, e); }
    }
    off[0] = offBase[0] * w; off[1] = offBase[1] * w;
    // the end pose leans toward the home the visitor picked on the page
    const u = seg(p, 0.86, 1), e = u * u * (3 - 2 * u);
    if (e > 0) { pos.addScaledVector(aimOff, e); tgt.addScaledVector(aimOff, e); }
  }
  // ---------- which home (in step with the landing page's pill) ----------
  const FOCUS = { semid: [-14.6, 16.2], bungalow: [-73.6, 13.4] };   // pins' plots (estate frame)
  const aimOff = V(0, 0, 0), aimGoal = V(0, 0, 0);
  let aimHome = null;
  const aimFor = h => {   // a partial pan of the end pose toward that plot
    if (!h || !FOCUS[h]) return aimGoal.set(0, 0, 0);
    const end = portrait ? END_PORTRAIT.tgt : KEYS[KEYS.length - 1].tgt;
    return aimGoal.set((FOCUS[h][0] - end[0]) * 0.4, 0, (FOCUS[h][1] - end[2]) * 0.4);
  };
  let override = null;   // a fixed pose (checking only, __hero.look)
  function place(p) {
    poseAt(p);
    if (override) { pos.fromArray(override.pos); tgt.fromArray(override.tgt); fov = override.fov; }
    if (rigOn) { const q = rig.pose(); pos.copy(q.pos); tgt.copy(q.tgt); fov = q.fov; off[0] = q.off[0]; off[1] = q.off[1]; }
    orbit.apply(pos, tgt);
    camera.position.copy(pos); camera.lookAt(tgt);
    camera.fov = fov; applyOff(); camera.updateProjectionMatrix();
    sky.position.copy(camera.position);
  }

  // ---------- pins and cards ----------
  for (const p of pins) {
    const a = est.pois.find(q => q.id === p.id);
    if (a) p.world = V(a.xz[0], p.ay, a.xz[1]);
    else if (p.xz) p.world = V(p.xz[0], p.ay, p.xz[1]);   // not in the baked pack: its own anchor
  }
  let openId = null;
  const v3 = V(0, 0, 0);
  const topbar = document.querySelector('.topbar');
  function layoutPins(show) {
    const sr = stage.getBoundingClientRect(), cr = copyEl && copyEl.getBoundingClientRect();
    if (cr) copyRect = { l: cr.left - sr.left - 8, t: cr.top - sr.top - 8, r: cr.right - sr.left + 8, b: cr.bottom - sr.top + 8 };
    // nothing to place or take down (the intro, before the pins show): skip the measuring below, a forced layout a frame
    if (!show && !openId && !pins.some(p => p.on)) return;
    const placed = [], top = Math.max(8, topInset + 8);
    for (const e of lineEls) if (+e.style.opacity > 0.3 && !openId) { const t = e.getBoundingClientRect(); placed.push({ l: t.left - sr.left - 6, r: t.right - sr.left + 6, t: t.top - sr.top - 6, b: t.bottom - sr.top + 6 }); }
    for (const c of [tod, homes]) if (c.isConnected && getComputedStyle(c).visibility !== 'hidden') { const t = c.getBoundingClientRect(); placed.push({ l: t.left - sr.left - 6, r: t.right - sr.left + 6, t: t.top - sr.top - 6, b: t.bottom - sr.top + 6 }); }
    // app mode: the caption is in the way too, and nothing may sit below the menu
    const capEl = APP && document.querySelector('.hxa-cap:not([hidden])');
    if (capEl) { const t = capEl.getBoundingClientRect(); placed.push({ l: t.left - sr.left - 6, r: t.right - sr.left + 6, t: t.top - sr.top - 6, b: t.bottom - sr.top + 6 }); }
    const menuEl = APP && document.querySelector('.hxa-menu');
    const floor = Math.min(H - 8, menuEl ? menuEl.getBoundingClientRect().top - sr.top - 8 : H - 8);
    const hit = (r, q) => r.r > q.l && r.l < q.r && r.b > q.t && r.t < q.b;
    if (APP && copyRect && !html.matches('.hxa-cap-on, .hxa-open')) placed.push(copyRect);
    for (const p of [...pins].sort((a, b) => a.prio - b.prio)) {
      if (APP && (p.feat || p.go)) {   // app mode (owner, Nov 2026): every icon stays on screen and tappable, from any view
        const on = show && !!p.world && (!p.only || (p.only === 'phone') === (W <= 760));   // phone-only or wide-only icons
        if (on) {
          v3.copy(p.world).project(camera);
          let x = v3.x, y = v3.y;
          if (v3.z > 1) { x = -x; y = -y; }   // behind the camera: mirrored, so it sits on the side to turn toward
          p.x = (x * 0.5 + 0.5) * W; p.y = (-y * 0.5 + 0.5) * H;
          if (!p.w) { p.w = p.b.offsetWidth || 44; p.h = p.b.offsetHeight || 44; }
          const hw = p.w / 2 + 8, up = p.feat ? p.h / 2 + 4 : p.h + 14, down = p.feat ? p.h / 2 + 4 : 6;
          const yMin = top + up, yMax = Math.max(yMin, floor - down);
          const rect = () => ({ l: p.x - p.w / 2 - 4, r: p.x + p.w / 2 + 4, t: p.y - up, b: p.y + down });
          const edge = v3.z > 1 || p.x < hw || p.x > W - hw || p.y < yMin || p.y > yMax;
          p.x = clamp(p.x, hw, W - hw); p.y = clamp(p.y, yMin, yMax);
          let free = false;
          for (let k = 0; k < 14; k++) {   // clear of what is already placed: up or down first, then sideways; the other way if the edge stops it
            const r = rect(), q = placed.find(o => hit(r, o)); if (!q) { free = true; break; }
            if (k < 7) {
              const upY = p.y - (r.b - q.t + 4), dnY = p.y + (q.b - r.t + 4), pref = p.y < (q.t + q.b) / 2 ? upY : dnY, alt = pref === upY ? dnY : upY;
              const ny = clamp(pref, yMin, yMax); p.y = Math.abs(ny - p.y) > 0.5 ? ny : clamp(alt, yMin, yMax);
            } else {
              const lx = p.x - (r.r - q.l + 4), rx = p.x + (q.r - r.l + 4), pref = p.x < (q.l + q.r) / 2 ? lx : rx, alt = pref === lx ? rx : lx;
              const nx = clamp(pref, hw, W - hw); p.x = Math.abs(nx - p.x) > 0.5 ? nx : clamp(alt, hw, W - hw);
            }
          }
          if (!free) free = !placed.some(o => hit(rect(), o));
          if (free) {
            placed.push(rect());
            p.b.classList.toggle('edge', edge);
            p.b.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
          }
          p.free = free;
        }
        const vis = on && p.free !== false;
        if (vis !== p.on) { p.on = vis; p.b.classList.toggle('on', vis); p.b.tabIndex = vis ? 0 : -1; }
        continue;
      }
      let on = show && !!p.world;
      if (on) {
        v3.copy(p.world).project(camera);
        if (v3.z > 1 || v3.z < -1) on = false;
        p.x = (v3.x * 0.5 + 0.5) * W; p.y = (-v3.y * 0.5 + 0.5) * H;
      }
      if (on) {
        if (!p.w) { p.w = p.b.offsetWidth || 90; p.h = p.b.offsetHeight || 30; }
        if (p.go) {   // an action pin, not a landmark: on a crowded screen (phones) it slides into the free band under the top bar
          const overCopy = copyRect && copyRect.l < p.x + p.w / 2 + 6 && copyRect.r > p.x - p.w / 2 - 6;
          const lo = top + p.h + 14, hi = (overCopy ? copyRect.t : H - 8) - 6;
          if (hi >= lo) p.y = clamp(p.y, lo, hi);
        }
        const r = { l: p.x - p.w / 2 - 6, r: p.x + p.w / 2 + 6, t: p.y - p.h - 14, b: p.y + 6 };
        if (r.l < 4 || r.r > W - 4 || r.t < top || r.b > H - 8) on = false;   // off the stage or under the top bar
        else if (copyRect && r.r > copyRect.l && r.l < copyRect.r && r.b > copyRect.t && r.t < copyRect.b) on = false;   // over the copy
        else if (placed.some(q => r.r > q.l && r.l < q.r && r.b > q.t && r.t < q.b)) on = false;   // decluttered by priority
        if (on) placed.push(r);
      }
      if (on) p.b.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
      if (on !== p.on) { p.on = on; p.b.classList.toggle('on', on); p.b.tabIndex = on ? 0 : -1; if (!on && openId === p.id) closeCard(); }
    }
    if (openId) positionCard();
  }
  function openCard(id) {
    const p = pins.find(q => q.id === id); if (!p) return;
    openId = id;
    i18n(cardH, 'hx.pin.' + id);
    i18n(cardT, 'hx.card.' + id + '.t');
    cardP.hidden = !p.home; if (p.home) i18n(cardP, 'hx.card.' + id + '.p');
    cardN.hidden = !p.note; if (p.note) i18n(cardN, 'hx.card.' + id + '.n');
    cardWalk.hidden = !p.home; if (p.home) cardWalk.href = base + 'index.html?home=' + p.home;
    for (const q of pins) q.b.classList.toggle('sel', q.id === id), q.b.setAttribute('aria-expanded', String(q.id === id));
    card.hidden = false; ui.classList.add('hx-card-open'); positionCard();
    cardH.focus({ preventScroll: true });
    if (p.home) intent(p.home);   // start building that home's walkthrough now
  }
  function closeCard(focusPin) {
    if (!openId) return;
    const p = pins.find(q => q.id === openId); openId = null; card.hidden = true; ui.classList.remove('hx-card-open');
    for (const q of pins) q.b.classList.remove('sel'), q.b.setAttribute('aria-expanded', 'false');
    if (focusPin && p && p.on) p.b.focus({ preventScroll: true });
  }
  function positionCard() {
    if (W < 760) { card.classList.add('sheet'); card.style.transform = ''; return; }
    card.classList.remove('sheet');
    const p = pins.find(q => q.id === openId); if (!p) return;
    const cw = card.offsetWidth || 300, ch = card.offsetHeight || 180;
    let x = p.x + 18, y = p.y - ch / 2;
    if (x + cw > W - 16) x = p.x - 18 - cw;
    x = clamp(x, 16, W - cw - 16); y = clamp(y, 76, H - ch - 16);
    card.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`;
  }
  pinsNav.addEventListener('click', e => {
    const b = e.target.closest('.hx-pin'); if (!b) return; const id = b.dataset.id;
    if (POI[id] && POI[id].go) { closeCard(); if (app) app.open(POI[id].go); else goLocation(); return; }
    if (POI[id] && POI[id].feat) { if (app) app.feature(POI[id].opens || id); return; }   // (goLocation ignores it while a move runs)   // straight out to the Location map
    if (openId === id) closeCard(true); else openCard(id);
  });
  cardX.addEventListener('click', () => closeCard(true));
  ui.addEventListener('keydown', e => { if (e.key === 'Escape' && openId) { closeCard(true); e.stopPropagation(); } });

  // ---------- time of day ----------
  const markTod = n => todBtns.forEach(b => { const on = b.dataset.tod === n; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
  markTod(todName);
  const pickTod = n => {
    if (n === todName) return;
    todName = n; markTod(n); todCtl.set(n); if (n === 'night') loadPools();
    try { localStorage.setItem('panthera.hx.tod', n); } catch (e) { /* private mode */ }
  };
  tod.addEventListener('click', e => { const b = e.target.closest('.hx-tod-b'); if (b) pickTod(b.dataset.tod); });
  tod.addEventListener('keydown', e => {
    const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]; if (!d) return;
    const i = (todBtns.findIndex(b => b.dataset.tod === todName) + d + 3) % 3; pickTod(todBtns[i].dataset.tod); todBtns[i].focus(); e.preventDefault();
  });
  // language switches: pins re-measure (the dict update itself is done by app.js applyI18n)
  // (and the stage's role description, which data-i18n-aria does not cover)
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('.lang button')) setTimeout(() => { for (const p of pins) p.w = 0; stage.setAttribute('aria-roledescription', T('hx.stage.role')); dirty = true; need(); }, 0); });

  // ---------- drag orbit (desktop, after the runway) ----------
  const FINE = matchMedia('(pointer: fine)').matches && !lite;
  const orbit = createOrbit(stage, { enabled: () => !APP && FINE && s > 0.985, onChange: () => need(),
    onStart: () => { if (dpr > 1) renderer.setPixelRatio(1); }, onEnd: () => { clearTimeout(dprT); dprT = setTimeout(() => { renderer.setPixelRatio(dpr); dirty = true; need(); }, 300); } });
  let dprT = 0;
  stage.classList.toggle('hx-orbit', FINE);

  // ---------- loop ----------
  const stillFor = p => { let k = 0; for (let i = 0; i < STILLS.length; i++) if (p >= (i ? (STILLS[i - 1] + STILLS[i]) / 2 : 0)) k = i; return k; };
  let topInset = 74, endState = null, pRaw = 0, landingPill = null, topCss = '';
  const lineCss = lineEls.map(() => ['', '']);   // each line's last opacity and transform, written only on a change
  const lineStyle = (e, i, q) => {
    const op = q.toFixed(3), tf = `translateY(${((1 - q) * 10).toFixed(1)}px)`, c = lineCss[i];
    if (op !== c[0]) { c[0] = op; e.style.opacity = op; }
    if (tf !== c[1]) { c[1] = tf; e.style.transform = tf; }
  };
  function overlay() {
    // the band under the top bar (phones put the lines and the time of day there)
    const sr = stage.getBoundingClientRect();
    let barB = topbar ? topbar.getBoundingClientRect().bottom : 0;
    // phones: the landing page's Semi-D | Bungalow pill floats just under the bar, so the band starts below it
    const lp = landingPill || (landingPill = document.querySelector('.topbar .home-pill'));
    if (lp && /^(absolute|fixed)$/.test(getComputedStyle(lp).position)) { const r = lp.getBoundingClientRect(); if (r.height) barB = Math.max(barB, r.bottom + 2); }
    topInset = Math.max(0, barB - sr.top);
    // written only when it changes: a style write every moving frame forces a style recalc at the reads in layoutPins
    const tCss = topInset.toFixed(0) + 'px';
    if (tCss !== topCss) { topCss = tCss; ui.style.setProperty('--hx-top', tCss); }
    const end = APP ? rigOn && !panelOpen : s >= (runway ? PINS_AT : 0.3) || orbit.active;   // no runway (short landscape screens): show the pins and the walk button early, while the stage is still in view
    if (end !== endState) { endState = end; ui.classList.toggle('hx-end', end); }
    const narrow = W < 760, room = !narrow || !copyRect || copyRect.t - (topInset + 12) > 56;   // phones: lines only if the band has room
    lineEls.forEach((e, i) => {
      if (APP) {   // its own clock, from the start of the intro
        const w = LINES_APP[i], t = lineT0 == null ? -1 : lineMs;
        let q = !w || t < 0 ? 0 : Math.min(1, (t - w[0]) / LINE_FADE, (w[1] - t) / LINE_FADE);
        q = room ? Math.max(0, q) : 0;
        lineStyle(e, i, q);
        return;
      }
      const [a, b0] = LINES[i], b = b0;
      // reduced motion: s jumps between stills, so the lines follow the raw scroll position instead
      let q = reduced ? (pRaw >= a && pRaw < b ? 1 : 0) : seg(s, a, a + 0.05) * (1 - seg(s, b - 0.05, b));
      if (!room) q = 0;
      lineStyle(e, i, q);
    });
    layoutPins(end);
  }
  function render() { renderer.toneMappingExposure = expo; sky.position.copy(camera.position); renderer.render(scene, camera); if (ao) ao.render(); frames++; }

  // ---------- the photo into the 3D ----------
  // m: how much of the 3D shows over the photo. It follows the scroll (damped), so scrolling back brings the photo
  // back; if the 3D arrives late it fades to wherever the scroll already is. Reduced motion: a short crossfade at the
  // dissolve's midpoint. Opt-in visitors (data saver) asked for the 3D, so it simply shows.
  let m = 0, mWant = 0, mOn = false, lost = false, kb = null, kbCss = '', mCss = '';
  const readKB = () => {   // the photo's slow drift (styles.css heroKen), paused where it is: the canvas wears the same
    kb = null;
    const t = slide ? getComputedStyle(slide).transform : 'none', v = /^matrix\(([^)]+)\)$/.exec(t || '');
    if (!v) return;
    const [a, b, , , e, f] = v[1].split(',').map(Number);
    kb = { k: Math.hypot(a, b), th: Math.atan2(b, a), x: e, y: f };
  };
  function mixTick(dt) {
    mWant = lost ? 0 : o.careful ? 1 : reduced ? (pRaw * travel / H > (DISSOLVE[0] + DISSOLVE[1]) / 2 ? 1 : 0) : mixFor(pRaw);
    if (reduced || o.careful) m = m < mWant ? Math.min(mWant, m + dt / (o.careful ? 0.9 : 0.5)) : Math.max(mWant, m - dt / 0.5);
    else m += (mWant - m) * (1 - Math.exp(-dt / 0.15));
    if (Math.abs(mWant - m) < 0.002) m = mWant;
    const on = m > 0 || mWant > 0;
    if (on !== mOn) { mOn = on; hero.classList.toggle('hx-mix', on); if (on) readKB(); }
    const c = m.toFixed(3);
    if (c !== mCss) { mCss = c; stage.style.opacity = c; if (scrim) scrim.style.opacity = (1 - m).toFixed(3); hero.classList.toggle('hx-done', m >= 0.999); }
    return m !== mWant;
  }
  function wearKB() {   // eases off as the camera leaves the photo's pose
    const r = kb ? 1 - settleAt(s) : 0;
    const t = r > 0.001 ? `translate(${(kb.x * r).toFixed(2)}px, ${(kb.y * r).toFixed(2)}px) rotate(${(kb.th * r).toFixed(5)}rad) scale(${(1 + (kb.k - 1) * r).toFixed(5)})` : '';
    if (t !== kbCss) { kbCss = t; canvas.style.transform = t; }
  }
  function frame(now) {
    raf = 0;
    if (held) return;
    const rawMs = last ? now - last : 1000 / 60, dt = Math.min(0.05, rawMs / 1000);
    last = now;
    // the intro's own clock: a frame that came late (a one-off stall) moves it on by at most about two usual frames, so
    // the glide pauses for a moment instead of jumping ahead (owner, Nov 2026: "its like lagging in the transition screen
    // and animation on 3d"); a device that is steadily slower still plays it in the same time
    const stepMs = Math.min(rawMs, Math.max(34, frameMs * 2));
    frameMs += (Math.min(rawMs, 120) - frameMs) * 0.1;
    if (introT0 != null) introMs += stepMs;
    if (lineT0 != null) lineMs += stepMs;
    const target = progressNow();
    pRaw = target;
    let moving = false;
    if (reduced) {
      const k = stillFor(target);
      if (k !== still) {
        if (still >= 0) {   // crossfade: the old still into the 2D layer, then the new one under it
          place(STILLS[still]); render();
          const g = snap.getContext('2d'); g.drawImage(canvas, 0, 0, snap.width, snap.height);
          snap.style.transition = 'none'; snap.style.opacity = '1';
          clearTimeout(snapT);
          setTimeout(() => { snap.style.transition = 'opacity .6s ease'; snap.style.opacity = '0'; }, 30);
          snapT = setTimeout(() => { snap.style.transition = 'none'; snap.style.opacity = '0'; }, 750);   // never left over the stage
        }
        still = k; s = STILLS[k]; dirty = true;
      }
    } else {
      const a = 1 - Math.exp(-dt / 0.13);
      s += (target - s) * a;
      if (Math.abs(target - s) < 2e-4) s = target; else moving = true;
    }
    const scrolling = now - scrolledAt < 160;
    if (orbit.tick(dt, scrolling)) moving = true;
    if (introT0 != null) {   // app mode: the intro glide plays by itself, then the visitor has the camera
      const u = INTRO_MS ? clamp(introMs / INTRO_MS) : 1; autoP = u * u * (3 - 2 * u); moving = true;
      if (u >= 1) finishIntro();
    }
    if (rigOn && rig.tick(dt)) moving = true;
    if (lineT0 != null && lineMs < LINES_APP[1][1] + 100) moving = true;   // the intro lines are still showing
    if (todCtl.tick(dt)) { moving = true; expo = renderer.toneMappingExposure; }
    if (mixTick(dt)) moving = true;
    if (aimOff.distanceToSquared(aimGoal) > 1e-4) { aimOff.lerp(aimGoal, 1 - Math.exp(-dt / 0.45)); moving = true; }
    else if (!aimOff.equals(aimGoal)) { aimOff.copy(aimGoal); dirty = true; }
    const lifeStep = !!(life && !reduced && m >= 0.999 && life.tick(now));   // the driving cars, birds and breeze (their own pace)
    if (moving || dirty || lifeStep) {
      place(s); wearKB();
      if (m > 0 || mWant > 0) { render(); dirty = false; }   // nothing to draw while only the photo shows
      overlay();
    }
    else if (reduced) overlay();   // lines follow the scroll between stills
    if (ao) ao.tick(now, moving);   // the contact shadows time themselves (passive)
    // still enough for one-off jobs (quiet): no intro, dissolve or intro lines, and the camera stopped or only creeping
    // through the last centimetres of a glide (the rig's tail runs on for seconds at well under a pixel a frame)
    const shift = camera.position.distanceTo(camWas) + tgt.distanceTo(tgtWas); camWas.copy(camera.position); tgtWas.copy(tgt);
    if (introT0 != null || (m > 0 && m < 0.999) || (lineT0 != null && lineMs < LINES_APP[1][1]) || (moving && shift > 0.03)) movingAt = now;
    if (moving) {   // adaptive resolution, as walk.js adapt()
      if (dt > 0.026 && dt < 0.09) slow++; else if (dt < 0.02) okF++;
      if (slow > 20 && slow > okF * 0.5) { if (dpr > 1.01) { dpr = Math.max(1, dpr - 0.25); dprLock = true; renderer.setPixelRatio(dpr); resize(); } slow = okF = 0; }
      if (okF > 400) slow = okF = 0;
      need();
    } else {
      last = 0;
      if (life && !reduced && !lifeTimer) lifeTimer = setTimeout(() => { lifeTimer = 0; need(); }, life.nextIn(performance.now()));   // the next life step
    }
  }
  addEventListener('scroll', () => { scrolledAt = performance.now(); need(); }, { passive: true });
  new ResizeObserver(resize).observe(stage);
  new IntersectionObserver(es => { for (const e of es) { visible = e.intersectionRatio > 0.05; if (visible) { dirty = true; need(); } } }, { threshold: [0, 0.05, 0.1] }).observe(stage);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { dirty = true; need(); } });
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; m = 0; mixTick(0); hero.classList.remove('hx-live'); if (ao) ao.lost(); });
  canvas.addEventListener('webglcontextrestored', () => { renderer.shadowMap.needsUpdate = true; lost = false; if (ao) ao.restored(); dirty = true; hero.classList.add('hx-live'); need(); });

  // ---------- the neighbourhood and the breeze, before the first frame ----------
  // Owner, Nov 2026: "if i load on like some laptop or mobile, its like lagging in the transition screen and animation on
  // 3d". The neighbourhood was built 0.4 s after the first frame, in one 0.6 s block (several seconds on a phone) right
  // where the photo dissolves, and its shaders, and the breeze's, compiled on the frames after. Now it is built while
  // the photo still shows (its slow drift runs on the compositor, so it never stutters), much faster (hero-context.js),
  // and every shader is compiled with the estate's below. The 3D is the same from its first frame, neighbours and all.
  let wind = null;
  try {
    const cm = await ctxP;
    if (cm && cm[1]) {
      const c = await cm[0].addContext({ THREE, scene, lite, data: cm[1] });
      neighbours = c; if (rig) rig.setFloor(c.floor);
      // the streets and areas round the estate are OpenStreetMap data (ODbL): its credit, small, in a corner of the 3D
      if (!ui.querySelector('.hx-osm')) { const a = document.createElement('a'); a.className = 'hx-osm'; a.href = 'https://www.openstreetmap.org/copyright'; a.target = '_blank'; a.rel = 'noopener';
        a.textContent = '© OpenStreetMap contributors'; ui.append(a); }
    }
  } catch (e) { console.warn('hero 3D: no neighbourhood', e); }
  // the leaves' and palms' sway at rest (the wind starts when hero-life.js does, after the intro)
  const lifeMod = lifeP && await lifeP;
  if (lifeMod && lifeMod.patchSway) { try { wind = lifeMod.patchSway(THREE, scene); } catch (e) { wind = null; } }

  // ---------- first frame (drawn hidden: the photo stays until the visitor scrolls) ----------
  resize();
  aimHome = homeNow() === 'bungalow' ? 'bungalow' : null;   // a page opened on the Bungalow ends looking its way
  aimOff.copy(aimFor(aimHome));
  pRaw = progressNow();
  s = reduced ? STILLS[stillFor(pRaw)] : pRaw; still = reduced ? stillFor(s) : -1;
  place(s);
  renderer.shadowMap.needsUpdate = true;
  try { await renderer.compileAsync(scene, camera); } catch (e) { /* compiles on first draw instead */ }
  render(); overlay();
  // Sharpness for this device, measured before anything shows (owner, Nov 2026: "if i load on like some laptop or mobile,
  // its like lagging in the transition screen and animation on 3d"): the opening view drawn twice more, each waited for
  // (a 1 px read), at the full pixel ratio. A GPU that cannot draw it in BUDGET ms plays the dissolve and the intro a step
  // softer; once the camera rests it goes back up as far as it holds (stepUp, below). Others are unchanged.
  const benchGl = renderer.getContext(), benchPx = new Uint8Array(4);
  const timed = () => { const t = performance.now(); renderer.render(scene, camera); benchGl.readPixels(0, 0, 1, 1, benchGl.RGBA, benchGl.UNSIGNED_BYTE, benchPx); return performance.now() - t; };
  let benchMs = 0;
  try {
    timed();   // pays for what the first draw left queued (uploads, links)
    benchMs = Math.min(timed(), timed());
    if (benchMs > BUDGET && dpr > 1) {
      dpr = Math.max(1, Math.floor(dpr * Math.sqrt(BUDGET / benchMs) * 4) / 4);
      renderer.setPixelRatio(dpr); resize(); benchMs = Math.min(benchMs, timed());
    }
    render();
  } catch (e) { /* drawn as it is */ }
  // phones and slower GPUs: the contact shadows wait for the end of the intro (below)
  const weak = lite || benchMs > BUDGET * 0.8;
  live = true;
  if (APP) startApp();
  if (pendingWalk) { const [h, f] = pendingWalk; pendingWalk = null; setTimeout(() => walkInto(h, f), 0); }
  performance.mark('hx-first-frame');
  hero.classList.add('hx-live');   // ready: the dissolve follows the scroll from here
  performance.mark('hx-interactive');
  dirty = true; need();

  // a little life (hero-life.js: cars, egrets, the breeze) once the intro has ended; its shaders are compiled before it
  // shows (the egrets' too, though they first fly a few seconds later), so no frame waits on one
  if (lifeMod) introDone.then(() => {
    try {
      const L = lifeMod.addLife({ THREE, scene, lite, wind });
      L.birds.visible = true;
      const p = renderer.compileAsync(L.group, camera, scene);
      L.birds.visible = false; L.group.visible = false;
      p.catch(() => {}).then(() => { L.group.visible = true; life = L; dirty = true; need(); });
    } catch (e) { console.warn('hero 3D: no life', e); }
  });

  // later, when idle (and, in app mode, once the intro glide has ended and the camera has come to rest): the golden sky
  // on phones, photo maps on desktop
  introDone.then(() => quiet(800)).then(() => idle(() => {
    if (lite && !o.careful && todName === 'golden') todCtl.set('golden', true);   // data saver: no extra sky download
    if (!lite) { for (const u of est.hdUses) hd.use(u.mat, u.set, u.o); hd.start(); }
  }, { timeout: 2000 }));
  // sharpness back up once the camera rests, if the opening measure took it down and the GPU has room for the next step
  const stepUp = () => {
    if (dprLock || dpr >= DPR_MAX - 0.01 || held || !live || lost) return;
    let ms = 1e9; try { ms = Math.min(timed(), timed()); render(); } catch (e) { return; }
    const next = Math.min(DPR_MAX, dpr + 0.25);
    if (ms * (next / dpr) ** 2 < BUDGET * 0.8) { dpr = next; renderer.setPixelRatio(dpr); resize(); quiet(1500).then(stepUp); }
  };
  if (!reduced) introDone.then(() => quiet(1500)).then(stepUp);
  // contact shadows (hero-ao.js, screen-space AO): loaded when idle after the first frame, phones too (not on data
  // saver); it measures its own cost and steps down, or off, by itself. ?hero=noao leaves it out
  if (!o.careful && o.flag !== 'noao') idle(() => import(base + 'hero-ao.js?v=3')
    .then(mod => mod.createAO({ THREE, renderer, scene, camera, lite, reduced }))
    .then(a => {
      // phones and slower GPUs: built and compiled now, but drawn from the end of the intro (owner, Nov 2026: "if i load
      // on like some laptop or mobile, its like lagging in the transition screen and animation on 3d"); it fades in over
      // the settle glide instead. Strong GPUs are unchanged
      if (a && APP && weak && a.hold) { a.hold(true); introDone.then(() => a.hold(false)); }
      ao = a; dirty = true; need();
    })
    .catch(e => console.warn('hero 3D: no contact shadows', e)), { timeout: 1500 });
  // the house tours built ahead, in the background, once the estate has loaded and settled (owner, Nov 2026: "shall we
  // preload the semi d and bungalow house tour? after landing hero 3d fully loaded"): the home the page shows first; on
  // desktop the other follows; phones build one home at a time (the other when it is picked: memory). Not on data saver.
  // After the intro has ended and the camera has rested 1.5 s (it started 3 s after the first frame, in the middle of the
  // glide: owner, Nov 2026: "if i load on like some laptop or mobile, its like lagging in the transition screen and
  // animation on 3d"); its steps also wait while the camera moves (explore.js, ctx.quiet)
  if (APP && !o.careful) introDone.then(() => quiet(1500)).then(() => idle(() => {
    const h = homeNow(); intent(h);
    if (!lite) setTimeout(() => quiet().then(() => intent(h === 'semid' ? 'bungalow' : 'semid')), 8000);
  }, { timeout: 4000 }));

  // ---------- the tour: Walk inside, the pill, deep links (explore.js, loaded on the first sign of interest) ----------
  const slotOf = h => pack.manifest.slots.find(q => q.id === pack.manifest.walked[h]);
  const ctx = {
    THREE, renderer, canvas, camera, scene, base, T, lite, reduced, pack, nextFrame, focusHome: stage, quiet,
    slotM: h => new THREE.Matrix4().fromArray(slotOf(h).M),
    plotCentre: h => V(0, 0, -6).applyMatrix4(new THREE.Matrix4().fromArray(slotOf(h).M)),
    hold(on) { held = on; if (on) { raf = 0; kbCss = ''; canvas.style.transform = ''; } else { last = 0; if (resizeMissed) resize(); dirty = true; need(); } },
    leaving(on) { hero.classList.toggle('hx-leave', on); ui.inert = on; document.documentElement.classList.toggle('pbw-going', on); if (on) closeCard(); },   // inert: the faded pins and buttons take no clicks or focus
    // only when the size or sharpness really changes: each call reallocates the drawing buffer (the tour calls these at
    // every hand-over, mid-flight on phones)
    sizeTo(box) { const w = Math.max(1, box.clientWidth), h = Math.max(1, box.clientHeight), sz = renderer.getSize(new THREE.Vector2()); if (sz.x !== w || sz.y !== h) renderer.setSize(w, h, false); },
    heroDPR() { if (renderer.getPixelRatio() !== dpr) renderer.setPixelRatio(dpr); },
    renderHero: render,
    heroPoseNow() {   // where the hero camera sits for the current scroll position (the pose Back returns to)
      if (rigOn) { const q = rig.pose(); return { pos: q.pos, tgt: q.tgt, up: V(0, 1, 0), fov: q.fov, off: q.off.slice() }; }
      poseAt(s); orbit.apply(pos, tgt);
      return { pos: pos.clone(), tgt: tgt.clone(), up: V(0, 1, 0), fov, off: off.slice() };
    },
    estatePoseNow() {   // Back to estate: the app's whole-estate view, set at once (the tour flies there), the home's caption closed
      if (rigOn && app && app.toEstate) app.toEstate();
      return ctx.heroPoseNow();
    },
    onHome: h => announce(h),   // the tour opened on, or switched to, this home
    context: () => neighbours,   // the neighbourhood (hero-context.js), once built: the tour lays a copy of it
    onClosed: () => syncUrl(),
    giveBack() {   // the canvas back into the stage, drawn at once at the hero's own pose
      stage.prepend(canvas);
      renderer.setPixelRatio(dpr);
      held = false; resize(); held = true;
      camera.up.set(0, 1, 0); place(s); render();
    },
  };
  let tourP = null;
  const tour = () => tourP || (tourP = import(base + 'explore.js?v=33').then(m => m.createTour(ctx)).catch(e => { tourP = null; throw e; }));
  function intent(h) { tour().then(t => t.prefetch(h)).catch(() => {}); }
  const moving = () => hero.classList.contains('hx-leave');   // the tour or the Location move is under way
  function walkInto(h, from) { if (moving()) return; if (!live) { pendingWalk = [h, from]; return; } tour().then(t => t.open(h, from)).catch(e => { console.warn('tour', e); location.href = base + 'index.html?home=' + h; }); }
  cardWalk.addEventListener('click', e => {
    if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;   // new tab: the walkthrough page
    const p = pins.find(q => q.id === openId); if (!p || !p.home) return;
    e.preventDefault(); walkInto(p.home, cardWalk);
  });
  homes.addEventListener('click', e => { const b = e.target.closest('.hx-homes-b'); if (b) walkInto(b.dataset.home, b); });
  homes.addEventListener('pointerover', e => { const b = e.target.closest('.hx-homes-b'); if (b && FINE) intent(b.dataset.home); });
  homes.addEventListener('focusin', e => { const b = e.target.closest('.hx-homes-b'); if (b) intent(b.dataset.home); });
  pinsNav.addEventListener('pointerover', e => { const b = e.target.closest('.hx-pin'); const p = b && pins.find(q => q.id === b.dataset.id); if (p && p.home && FINE) intent(p.home); if (p && p.go) location3d().then(l => l && l.prefetch()).catch(() => {}); });

  // ---------- out to the Location map and back (hero-location.js) ----------
  let locP = null;
  const location3d = () => locP || (locP = hasLoc ? import(base + 'hero-location.js?v=7').then(m => m.createLocation({
    THREE, camera, scene, renderer, stage, reduced, T, nextFrame, render,
    hold: ctx.hold, leaving: ctx.leaving, poseNow: ctx.heroPoseNow,
    size: () => [W, H],
    // the end of the runway (no runway on short screens: just past the dissolve and the pins' threshold)
    endY: () => endY(),
    settleMix() { pRaw = progressNow(); mixTick(0); m = mWant; mCss = ''; mixTick(0); },   // all 3D now (the photo dissolve may not have run)
    app: APP, homeOff: () => offNow(false),
    restore(pose) {   // the hero's own camera and fog again, at the current scroll position (held or not, as it is)
      camera.up.set(0, 1, 0); camera.near = 2; camera.far = 6000; scene.fog.near = 380; scene.fog.far = 1500;
      if (rigOn && pose) rig.fromPose(pose.pos, pose.tgt, pose.fov, pose.off);   // app mode: the camera stays where the move left it
      pRaw = progressNow(); s = pRaw; if (reduced) { still = stillFor(s); s = STILLS[still]; }
      place(s); render(); dirty = true;
    },
  })).catch(e => { locP = null; throw e; }) : Promise.resolve(null));   // a failed load is tried again next time
  // the page's own "Estate" links (the bottom bar): back to the settled 3D estate, which sits just above #estate
  // (owner, Nov 2026: after a bottom-bar link the 3D seemed gone, with no way back up to it)
  const endY = () => { const r = (runway || hero).getBoundingClientRect(); return r.top + scrollY + (runway ? travel : Math.min(travel, Math.max(0.3 * travel, DISSOLVE[1] * H) + 1)); };
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href="#estate"]');
    if (APP || e.defaultPrevented || !a || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || lost || moving()) return;
    e.preventDefault();
    window.scrollTo({ top: endY(), behavior: reduced ? 'auto' : 'smooth' });
  });
  // the bottom bar's LOCATION, pressed while the 3D estate fills the screen: the camera lifts into the page's map
  // (from anywhere else on the page it is the usual jump)
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href="#location"]');
    if (APP || e.defaultPrevented || !a || !hasLoc || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || lost || moving()) return;
    const r = hero.getBoundingClientRect();
    if (m < 0.98 || r.bottom < innerHeight * 0.6 || r.top > 1) return;
    e.preventDefault(); goLocation();
  });
  function goLocation() {
    if (moving()) return;
    const jump = () => { const el = document.getElementById('location'); if (el) el.scrollIntoView(); };
    location3d().then(l => (l ? l.go() : jump())).catch(e => { console.warn('location', e); jump(); });
  }
  if (hasLoc) introDone.then(() => quiet(1000)).then(() => idle(() => location3d().catch(() => {}), { timeout: 3000 }));   // its Back to estate button on the map (after the intro)
  { const m = /^#walk-(semid|bungalow)$/.exec(location.hash);   // a shared link straight into a home's tour
    if (m) { history.replaceState(history.state, '', location.pathname + location.search); setTimeout(() => walkInto(m[1], null), 400); } }

  // ---------- app mode: one 3D screen, tapped through (hero-app.js) ----------
  // The camera's view offset: the estate beside the copy (home), beside a panel (desktop: the panel on the right),
  // or above it (phones: a bottom sheet)
  // app mode, every screen: the clear band between the top bar and whatever sits at the bottom (the copy on tall
  // screens, the walk pill and the menu everywhere), measured from the page, so the estate centres in what is really
  // free (owner, Nov 2026: "ensure the panning adjusted for each viewport"; "slightly unbalanced")
  function openBand() {
    const sr = stage.getBoundingClientRect(), tb = document.querySelector('.topbar');
    const top = Math.max(0, (tb ? tb.getBoundingClientRect().bottom : sr.top) - sr.top);
    if (tb) document.documentElement.style.setProperty('--hx-tb', Math.round(tb.getBoundingClientRect().bottom) + 'px');   // panels start just under the bar
    let bot = H;
    for (const sel of [portrait || W <= 760 ? '.hero--cinematic .hero-copy' : null, '.h3d-ui .hx-homes.hx-two', '.hxa-menu']) {
      const e = sel && document.querySelector(sel); if (!e) continue;
      const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
      if (r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' && r.top - sr.top > top + 60) bot = Math.min(bot, r.top - sr.top);
    }
    return { top, bot: Math.max(top + 120, bot - 8) };
  }
  function openOff() { const b = openBand(); return [0, (H / 2 - (b.top + b.bot) / 2) / H]; }
  // the distance at which the whole lot (about 100 m across) fits the clear band with a little margin
  function fitDist(el = 0.7, fov = 40) {
    const b = openBand(), t = Math.tan(fov * Math.PI / 360), fv = (b.bot - b.top) / H, A = W / H;
    const across = 100 / (2 * t * A * 0.86), down = 100 * Math.sin(el) / (2 * t * fv * 0.8);
    return Math.max(150, Math.min(440, Math.max(across, down) * (portrait ? 1.04 : 1.08)));   // phones: a touch closer (owner: estate small); 1.0 clipped a corner house as the view turns
  }
  function relayout() { if (!APP) return; offBase = openOff(); if (rigOn) rig.setOff(...offNow()); dirty = true; need(); }
  addEventListener('panthera:lang', relayout);
  function offNow(open = panelOpen) {
    if (!open) return offBase.slice();
    if (W > 760 && !portrait) return [panelWide ? 0.27 : 0.23, 0];   // the estate stays in view beside the (wider) panel
    return [0, 0.34];
  }
  function finishIntro() {
    if (rigOn) return;
    const sNow = s;
    introT0 = null; autoP = 1; pRaw = 1;
    poseAt(1); const endPos = pos.clone(), endTgt = tgt.clone(), endFov = fov;
    // from wherever the camera is now (the intro may have been cut short) to the settled view
    place(sNow);
    rig.fromPose(camera.position.clone(), tgt.clone(), camera.fov, off.slice());
    s = 1; rigOn = true; rig.enable(true);
    endTgt.copy(LOT_C);   // the settled view turns about the lot's middle, so it sits mid-screen
    const d = endPos.clone().sub(endTgt), h = Math.hypot(d.x, d.z);
    rig.setGoal({ tgt: endTgt.toArray(), az: Math.atan2(d.z, d.x), el: Math.atan2(d.y, h), dist: fitDist(Math.atan2(d.y, h), endFov), fov: endFov, off: offNow() },
      { cx: -42, cz: 46, R: 28, dmin: 70, dmax: portrait ? 460 : 240, emin: 0.2, emax: 1.35, arc: null });   // phones may pull back further
    html.classList.add('hx-app-ready');
    if (introDoneRes) { introDoneRes(); introDoneRes = null; }   // the deferred idle work may run now
    if (app && app.startHash) setTimeout(() => { const h = app && app.startHash; if (!h || app.current) return; app.startHash = null; app.open(h, { fromHash: true }); }, 200);
    dirty = true; need();
  }
  function startApp() {
    const on = () => {
      if (appOn) return; appOn = true;
      html.classList.add('hx-app'); window.scrollTo({ top: 0, behavior: 'instant' });
      held = false; resize();
      introT0 = lineT0 = performance.now(); introMs = lineMs = 0; dirty = true; need();
      // a drag, pinch or wheel during the intro hands the camera over at once (capture: before the rig's own handler)
      const grab = () => { if (introT0 != null && !rigOn) finishIntro(); };
      for (const t of ['pointerdown', 'wheel', 'touchstart']) stage.addEventListener(t, grab, { capture: true, passive: true });
      import(base + 'hero-app.js?v=34').then(mod => {
        app = mod.createApp({ ui, T, rig, homeNow, walkInto, location3d, reduced,
          setPanel(open, wide) { panelOpen = open; panelWide = !!wide; rig.setOff(...offNow()); dirty = true; need(); },
          skipIntro() { if (!rigOn) finishIntro(); },
          relayout, fitDist,
          prefetchHome: h => intent(h) });
        if (rigOn && app.startHash && !app.current) { const h = app.startHash; app.startHash = null; app.open(h, { fromHash: true }); }
      }).catch(e => {   // no menu, no panels: back to the ordinary scrolling page rather than a locked one
        console.warn('app', e);
        html.classList.remove('hx-app', 'hx-app-ready', 'hxa-open', 'hxa-cap-on'); appOn = false; rig.enable(false);
      });
    };
    // a visitor already reading further down keeps the page until they are back at the top
    // a deep link (#pricing, ...) starts at once and opens its panel; a visitor already reading further down keeps the
    // page until they are back at the top (and an old hash is dropped then, so no stale panel pops open)
    const deep = /^#(estate|site|location|bertam|homes|bungalow|semid|pricing|calculator|faq|register)$/.test(location.hash);
    if (deep || scrollY < innerHeight * 0.6) on();
    else { const w = () => { if (scrollY < 40) { removeEventListener('scroll', w); if (location.hash) history.replaceState(history.state, '', location.pathname + location.search); on(); } }; addEventListener('scroll', w, { passive: true }); }
  }
  document.addEventListener('click', e => { if (app && e.target.closest && e.target.closest('.lang button')) setTimeout(() => app.onLang(), 0); });

  // ---------- Semi-D | Bungalow, in step with the landing page's pill (home-toggle.js) ----------
  // Its contract: html[data-home], window 'panthera:home' {home, source: 'pill' | 'url' | 'hero'}, window.PantheraHome.
  function homeNow() { return document.documentElement.dataset.home === 'bungalow' ? 'bungalow' : 'semid'; }
  // app mode: the Semi-D is always the filled one (owner, Nov 2026: "high light semi d instead"); the page marks the chosen home
  const markHome = h => { homeBtns.forEach(b => b.classList.toggle('hx-cur', b.dataset.home === (APP ? 'semid' : h))); };
  markHome(homeNow());
  function aimAt(h) {   // the end pose leans toward this home (straight away while the tour has the canvas)
    aimHome = h; aimFor(h);
    if (held) aimOff.copy(aimGoal);
    dirty = true; need();
  }
  function announce(h) {   // picked in the 3D: the page follows (its event comes back with source 'hero' and is ignored)
    markHome(h); aimAt(h);
    try { if (window.PantheraHome && window.PantheraHome.get() !== h) window.PantheraHome.set(h, 'hero'); } catch (e) { /* the page goes on */ }
  }
  addEventListener('panthera:home', e => {
    const d = e.detail || {};
    if (d.source === 'hero' || !FOCUS[d.home]) return;   // our own echo
    markHome(d.home); aimAt(d.home);
    // a tour on screen switches home its own way; otherwise only the end pose re-aims (the tour is not opened)
    if (tourP) tourP.then(t => { const st = t.state; if (st.open && st.open !== d.home) t.switchTo(d.home); }).catch(() => {});
  });
  // after the tour: history.back() returns to the entry from before it, which may name the other home
  function syncUrl() {
    try {
      const h = window.PantheraHome && window.PantheraHome.get(); if (!h) return;
      const u = new URL(location.href), q = u.searchParams.get('home') === 'bungalow' ? 'bungalow' : 'semid';
      if (q === h) return;
      if (h === 'bungalow') u.searchParams.set('home', 'bungalow'); else u.searchParams.delete('home');
      history.replaceState(history.state, '', u.pathname + u.search + u.hash);
    } catch (e) { /* the URL stays */ }
  }

  // for checking (tools/hero-preview.html, tests)
  window.__hero = {
    tour: () => tour(),
    renderer, scene, camera, est, tod: todCtl, KEYS, hd, pack,
    get s() { return s; },
    get ao() { return ao; },   // contact shadows: __hero.ao.report(), .set({...}), .bench()
    get sharp() { return { dpr, max: DPR_MAX, benchMs: +benchMs.toFixed(1), budget: BUDGET, weak, locked: dprLock, stillMs: Math.round(performance.now() - movingAt) }; },   // the opening measure and since when the camera has been still
    get mix() { return { m, want: mWant, kb, aim: aimOff.toArray().map(v => +v.toFixed(2)), home: aimHome, hold: holdP, join: joinP }; },
    settle() { s = progressNow(); dirty = true; need(); },
    pick: pickTod,
    // frame cost along the whole path: CPU + GPU per frame (a 1 px read waits for the GPU), and the busiest frame
    bench(n = 60) {
      const gl = renderer.getContext(), px = new Uint8Array(4), ts = []; let calls = 0, tris = 0;
      for (let i = 0; i <= n; i++) {
        place(i / n); const t0 = performance.now(); renderer.render(scene, camera); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        ts.push(performance.now() - t0); calls = Math.max(calls, renderer.info.render.calls); tris = Math.max(tris, renderer.info.render.triangles);
      }
      ts.sort((a, b) => a - b); dirty = true; need();
      return { frames: ts.length, avgMs: +(ts.reduce((a, b) => a + b, 0) / ts.length).toFixed(2), p95Ms: +ts[Math.floor(ts.length * 0.95)].toFixed(2), maxCalls: calls, maxTris: tris, dpr: renderer.getPixelRatio(), px: [canvas.width, canvas.height] };
    },
    look(p, t, f = 40) { override = p ? { pos: p, tgt: t, fov: f } : null; dirty = true; need(); },
    pins: () => pins.filter(p => p.on).map(p => [p.id, Math.round(p.x), Math.round(p.y)]),
    project: (x, y, z) => { const v = V(x, y, z).project(camera); return [Math.round((v.x * 0.5 + 0.5) * W), Math.round((-v.y * 0.5 + 0.5) * H)]; },
    info() {
      const i = renderer.info;
      return { calls: i.render.calls, tris: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures, frames, dpr: renderer.getPixelRatio(), size: [canvas.width, canvas.height], lod: est.stats, gpuMB: gpuEstimate() };
    },
  };
  function gpuEstimate() {   // rough bytes on the GPU: geometry buffers, textures (with mips), shadow map, frame buffers
    let b = 0; const geos = new Set(), texs = new Set();
    scene.traverse(x => {
      if (x.geometry && !geos.has(x.geometry)) { geos.add(x.geometry); for (const a of Object.values(x.geometry.attributes)) b += a.array.byteLength; if (x.geometry.index) b += x.geometry.index.array.byteLength; }
      if (x.isInstancedMesh) b += x.instanceMatrix.array.byteLength + (x.instanceColor ? x.instanceColor.array.byteLength : 0);
      if (x.material) for (const v of Object.values(x.material)) if (v && v.isTexture) texs.add(v.source || v);   // textures sharing an image share the upload
    });
    for (const t of texs) { const im = t.data || t.image || {}; const w = im.width || 0, h = im.height || 0; b += w * h * 4 * 1.34; }
    b += 6 * 256 * 256 * 8 * 1.5 * 2;   // two PMREM env maps (half float)
    const sm = sun.shadow.mapSize.x; b += sm * sm * 8;
    b += canvas.width * canvas.height * (AA ? 8 + 4 * 8 : 8);   // colour + depth, plus 4x MSAA where it is on
    if (ao) b += ao.bytes();   // the contact shadows' targets
    return Math.round(b / 1048576);
  }
}
