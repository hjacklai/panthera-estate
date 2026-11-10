// Panthera Bertam · Semi-D walkthrough, checkpoint 1.
//
// The drawing is the model. Every wall below comes from the amended building
// plan (Oct 2025): the CAD wall lines were paired into solid walls and saved in
// semid.json, in metres. x runs across the pair (0 = party wall), z runs from
// the front wall (0) toward the street (+z) and the back garden (-z).
//
// A very long lens looking straight down makes the 3D model read as a flat
// plan. Scrolling opens the lens, raises the walls and walks the camera from
// the street, under the car porch, through the front door into the living
// room, where the materials sweep in while the rest of the house stays ink.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildEstate } from './estate.js?v=33';
import { createHD, SKIES } from './hd.js?v=8';
import { BAKE_VER, ENTRY_P } from './versions.js?v=1';

const texCache = new Map();   // procedural textures, made once and shared (see cachedTex)
const COL = {
  paper: 0xF2E9DF, ink: 0x2E2825, wall: 0xF7F3EC, plaster: 0xF3EEE5,   // cream white, as in the street render
  cream: 0xE7DBC7,   // the painted walls, a shade deeper (owner, Nov 2026: the near-white read too bright in the sun; then "super pale": one more step)
  slab: 0xF3EEE5, glass: 0xC9DADB, road: 0xE7DDCF, green: 0xD9E0C6, terra: 0xB17664,
};
const MOBILE = matchMedia('(max-width: 760px)').matches;
const COARSE = matchMedia('(pointer: coarse)').matches;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
// Desktop-only post-processing (ambient occlusion, bloom, grade) is fetched only on desktop, in parallel with the data.
const FXMODS = !(MOBILE || COARSE) ? Promise.all(['EffectComposer', 'RenderPass', 'GTAOPass', 'OutputPass', 'UnrealBloomPass', 'ShaderPass']
  .map(n => import(`three/addons/postprocessing/${n}.js`))).catch(() => null) : null;

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (p, a, b) => clamp((p - a) / (b - a));
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const sine = t => 0.5 - 0.5 * Math.cos(Math.PI * t);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// The walkthrough page runs the walk at once (bottom of this file). The estate hero imports walk.js?lib=1 and
// calls mountWalk({ lib: true, ... }) itself: shared renderer and canvas, its own HUD copy, no own frame loop.
const AUTO = !new URL(import.meta.url).searchParams.has('lib');
const MODDIR = new URL('./', import.meta.url).href;
// one task's break during an embedded build, so the hero keeps drawing (MessageChannel: not throttled when hidden).
// Not scheduler.yield: its continuations jump ahead of the frames and timers the hero draws its flight with, so a build
// of many short slices still froze the fly-in (owner, Nov 2026: "when i click into the semi d and bungalow walk through
// tour, the animation like its abit laging"). explore.js passes opts.pace to break at the display's own frames instead.
const yieldTask = () => new Promise(r => {
  const c = new MessageChannel(); c.port1.onmessage = () => { c.port1.close(); r(); }; c.port2.postMessage(0);
});

export async function mountWalk(opts = {}) {
const LIB = !!opts.lib;                          // embedded in the estate hero
const BASE = LIB ? MODDIR : '';                  // embedded: data and images load relative to walk.js
const UI = LIB ? opts.ui : null, SCROLLER = LIB ? opts.scroller : null;   // the hero's copy of the HUD, and its scroller
const ac = new AbortController(), sig = { signal: ac.signal };
let yields = 0, disposed = false, sliceT = performance.now();
const brk = () => (opts.pace ? opts.pace() : yieldTask());
const Y = async () => { yields++; if (opts.onProgress) opts.onProgress(Math.min(1, yields / 26)); if (opts.cooperative) { await brk(); sliceT = performance.now(); } };
// inside the build's long loops (furniture, cars, walls...): a break whenever a slice of work (about 8 ms, opts.budget)
// has run since the last one, so no single stretch holds a frame of the flight up. Not Y(): that counts build progress.
const slice = async () => {
  if (!opts.cooperative || performance.now() - sliceT < (opts.budget ? opts.budget() : 8)) return;
  await brk(); sliceT = performance.now();
};
const QS = LIB ? '' : location.search;           // embedded: no page flags

// Levels (m): ground floor finish = 0, porch + garden 0.30 below,
// first floor 3.70 above (from sections A-A / B-B of the amended plans).
// GF ceiling = underside of the 1F slab (sections A-A, B-B: 3500).
// Which home: ?home=bungalow switches the whole walkthrough to the bungalow's own drawings.
const HOME = (LIB ? opts.home : new URLSearchParams(QS).get('home')) === 'bungalow' ? 'bungalow' : 'semid';
const SEMID = HOME === 'semid';
const BAKE = new URLSearchParams(QS).has('bake');   // hidden helper page: builds this house and hands its exterior to the estate
const Q = new URLSearchParams(QS);
const LIVE = Q.has('live');                     // ?live=1: build the estate here and bake the other home in a hidden page (no pack)
const PACKBAKE = Q.get('bake') === 'pack';      // tools/bake.html: this house, and (Semi-D page) the whole estate, for the pack
// The Semi-D's patio daylight uses area lights (a 110 KB table): desktop Semi-D only, fetched alongside the data.
const RALMOD = SEMID && !BAKE && !(MOBILE || COARSE) ? import('three/addons/lights/RectAreaLightUniformsLib.js').catch(() => null) : null;
// Procedural textures at full size on desktop (and in the hidden bake page, which serves desktop estates); half on phones/tablets.
const TEXHI = !(COARSE || (MOBILE && !BAKE));

// DOM lookups: the page itself, or (embedded) only inside the hero's HUD copy
const $ = id => UI ? UI.querySelector('#' + id) : document.getElementById(id);
const DQ = s => UI ? UI.querySelector(s) : document.querySelector(s);
const DQA = s => UI ? UI.querySelectorAll(s) : document.querySelectorAll(s);
const loader = $('loader');
// The switch and the page text follow the chosen home.
DQA('.hometoggle a').forEach(a => a.classList.toggle('on', a.dataset.home === HOME));
if (!SEMID) {
  if (!LIB) document.title = 'Bungalow 3D Walkthrough · Panthera Bertam';
  const q = DQ;
  q('.intro .eyebrow').textContent = 'Bungalow · 2,642 sq ft · 4+1 bed · 4+1 bath';
  q('.intro p').textContent = 'The bungalow in 3D. Scroll to walk through every room.';
  const tb = DQA('.titleblock > div');
  tb[1].innerHTML = '<span class="k">Drawing</span>Bungalow · ground floor';
  tb[2].innerHTML = '<span><span class="k">House</span>46 × 28 ft</span><span><span class="k">Lot</span>5,308 sq ft</span>';
  q('.endcard p').textContent = 'Bungalow · 2,642 sq ft built-up · 4+1 bedrooms · 4+1 bathrooms · freehold. Pre-launch registration is open.';
  if (!LIB) $('scene').setAttribute('aria-label', '3D model of the Panthera Bertam bungalow, built from its building plans');
}

function fail(msg) {
  if (LIB) { if (opts.onError) opts.onError(msg); return; }
  loader.classList.add('fail');
  loader.innerHTML = `<span>${msg} <a href="../">Back to Panthera Bertam</a></span>`;
}

const CTX_MATS = [];   // the neighbourhood's materials (hero-context.js), faded in with the real world
let D, X, FIT = [], FURN = [], CARS = [], buildCar = null, ESTATE = null, OTHER = null, CAR_SPOTS = { semid: [], bungalow: [] }, TOUR = null, PARAPETS = null, SD_LIGHTS = [], makeFurniture = null, SD_FURN = [];
// The baked estate (bake/estate.<ver>.*, made by tools/bake.html): all 19 homes and the grounds, loaded instead of
// building the estate here and baking the other home in a hidden page. Missing or broken: the old path runs.
const PACK_P = LIB ? Promise.resolve(opts.pack || null)   // embedded: the hero's pack, already loaded
  : (!BAKE && !LIVE) ? import('./pack.js?v=3').then(m => m.fetchPack({ base: './bake/', ver: BAKE_VER, tier: TEXHI ? 1024 : 512 }))
  .catch(e => { console.warn('pack: building the estate here instead', e && e.message); return null; }) : null;
// Everything loads at once (index.html also preloads the data files while three.js downloads).
{
  const J = u => fetch(BASE + u).then(r => { if (!r.ok) throw new Error(u); return r.json(); });
  const opt = (pr, d) => pr.catch(() => d);
  const other = SEMID ? 'bungalow' : 'semid';
  let main, est, od, ox, carMod, sdCars, bgFurn, tour, para, sdl, furnMod, sdf;
  try {
    [main, FIT, bgFurn, sdCars, est, od, ox, carMod, , tour, para, sdl, furnMod, sdf] = await Promise.all([   // (the empty slot is the font load)
      Promise.all([J(`./${HOME}.json?v=10`), J(`./${HOME}_detail.json?v=5`)]),   // plans; verified windows/doors, roof, stair, balconies
      opt(J(`./${HOME}_fittings.json?v=7`), []),                                   // switches and sockets
      opt(J('./bungalow_furniture.json?v=14'), []),                                 // bungalow furniture (8 Apr 2026 layout, audited) and its cars
      opt(J('./semid_cars.json?v=1'), []),                                         // Semi-D: two cars per porch, as drawn
      opt(J('./estate.json?v=12'), null),                                           // the estate, for the road view and the bird's-eye
      PACK_P ? null : opt(J(`./${other}.json?v=10`), null), PACK_P ? null : opt(J(`./${other}_detail.json?v=5`), null),   // the other home (not with the pack)
      import('./car.js?v=4').catch(() => null),                                    // the detailed car (falls back to a simple one)
      Promise.race([document.fonts.load('500 40px "JetBrains Mono"'), new Promise(r => setTimeout(r, 1500))]).catch(() => null),
      BAKE ? null : opt(J(`./tour_${HOME}.json?v=11${/[?&]tourdev/.test(QS) ? '&t=' + Date.now() : ''}`), null),   // the room-by-room tour
      opt(J('./parapets.json?v=1'), null),                                         // balcony half-wall grooves
      SEMID ? opt(J('./semid_lights.json?v=5'), []) : [],                          // E-01 lights, fans, wall lights, air-con
      import('./furniture.js?v=12').catch(() => null),                              // realistic furniture and sanitary ware
      SEMID ? opt(J('./semid_furniture.json?v=15'), []) : [],                       // Semi-D furniture, 8 Apr 2026 layout (audited)
    ]);
  } catch (e) { fail('Could not load the drawings.'); throw e; }
  [D, X] = main;
  if (tour && Array.isArray(tour.frames) && tour.frames.length > 1) TOUR = tour;
  PARAPETS = para; SD_LIGHTS = sdl || [];
  makeFurniture = furnMod && furnMod.makeFurniture || null; SD_FURN = sdf || [];
  FURN = SEMID ? [] : bgFurn; CARS = SEMID ? sdCars : [];
  CAR_SPOTS = { semid: sdCars, bungalow: bgFurn.filter(f => f.kind === 'car') };
  buildCar = carMod && carMod.buildCar || null;
  if (est && od && ox && (!BAKE || PACKBAKE)) { ESTATE = est; OTHER = { D: od, X: ox }; }
  else if (est && PACK_P) ESTATE = est;   // the pack brings the other home (OTHER is fetched later only if the pack fails)
}
performance.mark('walk-data');
const GROUND = -0.30, GF_TOP = 3.50, CUT = 1.20, FF_BASE = 3.70;
const HOUSE = SEMID ? { x0: -6.72, x1: 6.72, z0: -13.255, z1: 0 } : { x0: X.house.x0, x1: X.house.x1, z0: X.house.z0, z1: X.house.z1 };
const LOT = SEMID ? { x0: -9.395, x1: 9.395, z0: -15.855, z1: 6.70 } : { x0: D.lot.x0, x1: D.lot.x1, z0: D.lot.z0, z1: D.lot.z1 };
const PORCH_DEPTH = SEMID ? 4.80 : X.porch.r[3];
const LIVING = SEMID ? { x0: -6.57, x1: -0.12, z0: -4.60, z1: -0.15 }   // left-hand unit: its patio faces west, into the afternoon sun
  : { x0: X.finish_zone.x0, x1: X.finish_zone.x1, z0: X.finish_zone.z0, z1: X.finish_zone.z1 };
// The open plan the finishes sweep across: living, dining and the dry kitchen.
const FINISH = SEMID ? { x0: -6.57, x1: -0.12, z0: -9.20, z1: -0.15 } : LIVING;
const inZone = r => Math.min(r[0], r[2]) > LOT.x0 - 1 && Math.max(r[0], r[2]) < LOT.x1 + 1 && Math.min(r[1], r[3]) > LOT.z0 - 1.5 && Math.max(r[1], r[3]) < LOT.z1 + 1.5;
const HCX = (HOUSE.x0 + HOUSE.x1) / 2, HCZ = (HOUSE.z0 + HOUSE.z1) / 2;   // house centre, for outward directions


// ---------- renderer, scene, light ----------
const canvas = LIB ? opts.canvas : $('scene');
let renderer;
try {
  renderer = LIB ? opts.renderer : new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });   // embedded: the hero's renderer
} catch (e) { fail('Your browser could not start 3D.'); throw e; }
let walkDPR = Math.min(window.devicePixelRatio || 1, (MOBILE || COARSE) ? 1.5 : 2);
if (!LIB) renderer.setPixelRatio(walkDPR);   // sharp, capped at 1.5x on phones/tablets; lowered automatically if a device can't keep up (embedded: set in activate)
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;       // Khronos PBR Neutral: true-to-material colour, soft highlight roll-off
if (!LIB) renderer.toneMappingExposure = 1.05;
renderer.localClippingEnabled = true;
renderer.shadowMap.enabled = true;                  // soft sun and leaf shadows on every device
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const HIFI = !(MOBILE || COARSE);                        // desktop: ambient occlusion, MSAA, 4K shadow map
const RALm = RALMOD ? await RALMOD : null;
if (RALm) RALm.RectAreaLightUniformsLib.init();
renderer.shadowMap.autoUpdate = false;              // the shadow map is redrawn only when something moved (see frame / apply)

// Photo textures and HDRI skies (hd.js): the page opens with its drawn textures and the photo maps swap in as they
// arrive. Desktop 2k (ground, roof and tiles 1k), phones and tablets 1k colour + normal only. ?hd=0 turns it all off,
// ?hd=1k or ?hd=2k picks the size. The bake page loads nothing: the page that receives its parts applies the maps.
const HDQ = new URLSearchParams(QS).get('hd');
const HD_RES = BAKE || HDQ === '0' ? null : HDQ === '1k' || HDQ === '2k' ? HDQ : TEXHI && HIFI ? '2k' : '1k';
// Japandi floors (owner, Nov 2026: "lighter beige floor"): the FF floor is now drawn in light oak and hd.js lifts the
// spc_oak photo by [1.86, 1.77, 1.61] (hd.js SETS). Its colour match alone renders a mid greige-brown, so the lift is
// kept and raised to [2.05, 1.95, 1.72] here for a light oak, once per material, after hd.js applies the set (onChange
// runs after every flush). Keep in step with hd.js if its lift changes.
// Then (owner, Nov 2026: "can the spc flooring be darker tone?", then "lighter abit") a warm honey oak: [1.66, 1.50, 1.28].
const LIFT_FIX = { spc_oak: [1.66 / 1.86, 1.50 / 1.77, 1.28 / 1.61] }, LIFT_MATS = [];
// pace: embedded, each photo map is uploaded at the build's own breaks (explore.js), not all in one task
const hd = createHD({ THREE, renderer, res: HD_RES, lite: !HIFI, base: BASE + './hd/', pace: LIB && opts.pace ? opts.pace : null, onChange: name => {
  const k = LIFT_FIX[name];
  if (k) for (const m of LIFT_MATS) if (m.userData.hd === name && !m.userData.lifted) { m.color.setRGB(m.color.r * k[0], m.color.g * k[1], m.color.b * k[2]); m.userData.lifted = true; }
  needRender = true; shadowDirty = true;   // a new map can change a cut-out (leaves) in the shadow
} });

const scene = new THREE.Scene();
scene.background = new THREE.Color(COL.paper);
const pmrem = new THREE.PMREMGenerator(renderer);
const roomScene = new RoomEnvironment(), roomRT = pmrem.fromScene(roomScene, 0.04);
scene.environment = roomRT.texture;   // until the HDRI sky arrives (setTimeOfDay)
scene.environmentIntensity = 0.5;
const roomEnv = scene.environment;
// Time-of-day multipliers on the walk's own light levels (apply), set by setTimeOfDay; golden is the walkthrough as built.
const LIGHT = { env: 1, out: 1, expo: 1, sun: 1, hemi: 1, lamp: 0.9, glow: 1, inl: 1 };   // street lamps on at golden hour, as the estate hero (owner, Nov 2026); out: extra sky fill over the estate (fly-over); inl: interior lights
const TOD = { name: 'golden', dir: null, fog: 0xF3E7D6 };

const hemi = new THREE.HemisphereLight(0xfff4e4, 0xcbb8a2, 0.55); scene.add(hemi);
// The fly-over at the end of the tour, at golden hour: the estate hero's own golden light (hero-tod.js), so the tour ends
// on the same warm, low-sun estate as the landing (owner, Nov 2026: "this does not seem golden hour")
const GOLD_BASE = { sun: new THREE.Color(0xFFE2BF), hemi: [new THREE.Color(0xFFF4E4), new THREE.Color(0xCBB8A2)] };   // = TODS.golden
const GOLD_WIDE = { sun: new THREE.Color(0xFFC58C), sunI: 2.95, hemi: [new THREE.Color(0xFFE6CC), new THREE.Color(0xC9A984)], hemiI: 0.24, expo: 0.9 };
// Late-afternoon sun, low from the west-southwest (street side, left).
const sun = new THREE.DirectionalLight(0xffe2bf, 2.3);
sun.position.set(-20, 15, 18);
sun.target.position.set(0, 0, -4);
sun.castShadow = renderer.shadowMap.enabled;
if (sun.castShadow) {
  sun.shadow.mapSize.set(HIFI ? 4096 : 2048, HIFI ? 4096 : 2048);
  Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 90 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
}
scene.add(sun, sun.target);

const camera = new THREE.PerspectiveCamera(2.2, innerWidth / innerHeight, 1, 2000);
const fixGF = new THREE.Group(), fixFF = new THREE.Group(); scene.add(fixGF, fixFF);   // fittings appear once their floor is built

if (LIB) await Y();   // embedded build: let the hero draw a frame
// ---------- materials ----------
const mWall = new THREE.MeshStandardMaterial({ color: COL.cream, roughness: 0.95 }); mWall.name = 'wall';   // names tag the pack's role materials
hd.use(mWall, 'plaster_wall', { world: true, normalScale: 0.3 });   // painted plaster relief (walls are scaled boxes: world metres)
const mRender = new THREE.MeshStandardMaterial({ color: COL.cream, roughness: 0.95 });   // boundary walls: the same cream, sand render
hd.use(mRender, 'render_ext', { world: true, normalScale: 0.35 });
const mCap = new THREE.MeshBasicMaterial({ color: COL.ink });         // section poché on the cut
const mLight = new THREE.MeshStandardMaterial({ color: COL.wall, roughness: 0.95 });
const mSlab = new THREE.MeshStandardMaterial({ color: COL.slab, roughness: 0.95 });
const mGlass = new THREE.MeshStandardMaterial({ color: COL.glass, roughness: 0.14, metalness: 0.15, envMapIntensity: 1.6, transparent: true, opacity: 0.22, depthWrite: false }); mGlass.name = 'glass';
const mInk = new LineMaterial({ color: COL.ink, linewidth: MOBILE ? 1.0 : 1.15, transparent: true, opacity: 0.92 });
const mInkSoft = new LineMaterial({ color: COL.ink, linewidth: 0.8, transparent: true, opacity: 0.38 });
const lineMats = [mInk, mInkSoft];

const BOX = new THREE.BoxGeometry(1, 1, 1); BOX.translate(0, 0.5, 0);
const BOX_EDGES = new LineSegmentsGeometry().fromEdgesGeometry(new THREE.EdgesGeometry(BOX));

// A box from plan rect [x0,z0,x1,z1], standing on `base`, `h` tall, outlined in ink.
function block(r, base, h, mats, parent, line = mInk) {
  const [x0, z0, x1, z1] = r;
  const m = new THREE.Mesh(BOX, mats);
  m.position.set((x0 + x1) / 2, base, (z0 + z1) / 2);
  m.scale.set(Math.max(Math.abs(x1 - x0), 0.02), Math.max(h, 0.001), Math.max(Math.abs(z1 - z0), 0.02));
  m.castShadow = m.receiveShadow = true;
  if (line) m.add(new LineSegments2(BOX_EDGES, line));
  m.userData.h = h;
  parent.add(m);
  return m;
}
const setH = (m, h) => { m.scale.y = Math.max(h, 0.001); m.visible = h > 0.002; };

if (LIB) await Y();   // embedded build: let the hero draw a frame
// ---------- ground, street, green ----------
function paperTexture() {
  const s = TEXHI ? 2048 : 1024, c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d');
  g.fillStyle = '#F2E9DF'; g.fillRect(0, 0, s, s);
  const px = s / 64; // 64 m across
  for (let i = 0; i <= 64; i++) {
    g.strokeStyle = i % 5 === 0 ? 'rgba(46,40,37,0.09)' : 'rgba(46,40,37,0.045)';
    g.lineWidth = i % 5 === 0 ? 1.4 : 1;
    g.beginPath(); g.moveTo(i * px, 0); g.lineTo(i * px, s); g.stroke();
    g.beginPath(); g.moveTo(0, i * px); g.lineTo(s, i * px); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
const ground = new THREE.Mesh(new THREE.PlaneGeometry(64, 64), new THREE.MeshStandardMaterial({ map: paperTexture(), roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.position.set(0, GROUND, -4); ground.receiveShadow = true;
scene.add(ground);

const street = new THREE.Group(); scene.add(street);
// 40-ft (12.2 m) estate road in front of the gates, then the central green.
const road = block([-32, LOT.z1, 32, LOT.z1 + 12.2], GROUND, 0.004, new THREE.MeshStandardMaterial({ color: COL.road, roughness: 1 }), street, mInkSoft);
road.castShadow = false;
const green = block([-32, LOT.z1 + 12.2, 32, LOT.z1 + 42], GROUND, 0.004, new THREE.MeshStandardMaterial({ color: COL.green, roughness: 1 }), street, mInkSoft);
green.castShadow = false;
{ // dashed centre line
  const pts = [];
  for (let x = -30; x < 30; x += 3) pts.push(x, GROUND + 0.01, LOT.z1 + 6.1, x + 1.5, GROUND + 0.01, LOT.z1 + 6.1);
  const g = new LineSegmentsGeometry().setPositions(pts);
  street.add(new LineSegments2(g, mInkSoft));
}

if (LIB) await Y();   // embedded build: let the hero draw a frame
// ---------- the house, from the plans ----------
const gfWalls = [], gfHeads = [], ffParts = [], siteWalls = [];
const house = new THREE.Group(); scene.add(house);
// Detail meshes that grow with their floor: frames, glass, doors, stair rails (GF); balconies, frames (FF); the roof.
const gfDetail = new THREE.Group(), ffDetail = new THREE.Group(), roof = new THREE.Group();
scene.add(gfDetail, ffDetail, roof);

// Plinth: the ground floor slab sits 0.30 m above the porch, with a 600 mm step at -0.15 along the front.
block([HOUSE.x0, HOUSE.z0, HOUSE.x1, HOUSE.z1], GROUND, -GROUND, [mSlab, mSlab, mLight, mSlab, mSlab, mSlab], house, mInkSoft);
if (SEMID) block([HOUSE.x0, 0, HOUSE.x1, 0.6], GROUND, 0.15, [mSlab, mSlab, mLight, mSlab, mSlab, mSlab], house, mInkSoft);

// A ground-floor wall piece: cut at +1.20 m on the plan, rising to its full height.
function gfWall(r, base, full, mats = [mWall, mWall, mCap, mWall, mWall, mWall], line = mInk) {
  const m = block(r, base, 0.001, mats, house, line);
  m.userData.full = full; m.userData.h0 = Math.max(0, Math.min(full, CUT - base));
  setH(m, m.userData.h0); gfWalls.push(m); return m;
}
function ffBlock(r, base, h, mats = mWall, line = mInk) {
  const m = block(r, base, h, mats, house, line);
  m.userData.full = h; setH(m, 0); ffParts.push(m); return m;
}
// The old stair's stringer wall (x 0.965..1.115 beside flight 1) only rises to the stair; the stair below replaces it.
const isStringer = r => {
  if (!SEMID) return false;
  const a = Math.min(Math.abs(r[0]), Math.abs(r[2])), b = Math.max(Math.abs(r[0]), Math.abs(r[2]));
  return a > 0.9 && b < 1.13 && Math.max(r[1], r[3]) < -3.3 && Math.min(r[1], r[3]) > -7.1;
};
// Wall-pairing artefacts behind the house (tank-to-apron gaps, apron edge against the corner fin): not walls.
const ARTEFACTS = ['-1.145,-13.855,-0.215,-13.685', '0.215,-13.855,1.145,-13.685', '-0.715,-13.355,-0.215,-13.255', '0.215,-13.355,0.715,-13.255', '-7.32,-13.255,-7.175,-12.712', '7.175,-13.255,7.32,-12.712'];
const rkey = r => [Math.min(r[0], r[2]), Math.min(r[1], r[3]), Math.max(r[0], r[2]), Math.max(r[1], r[3])].map(v => +v.toFixed(3)).join(',');
// Walls whose top follows a line instead of a storey height (the bungalow's under-stair walls and the
// balustrade walls along its flights): an extrusion of [along, top] points, a hair proud so the treads beside don't flicker.
const profAt = (prof, a) => {
  const q = [...prof].sort((u, v) => u[0] - v[0]);
  if (a <= q[0][0]) return q[0][1];
  for (let i = 1; i < q.length; i++) if (a <= q[i][0]) { const t = (a - q[i - 1][0]) / ((q[i][0] - q[i - 1][0]) || 1); return q[i - 1][1] + t * (q[i][1] - q[i - 1][1]); }
  return q[q.length - 1][1];
};
function profWall(r, axis, prof, a0, a1, yb, parent, mat = mWall) {
  const top = [[a0, profAt(prof, a0)], ...prof.filter(([a]) => a > a0 + 1e-3 && a < a1 - 1e-3).sort((u, v) => u[0] - v[0]), [a1, profAt(prof, a1)]];
  const pts = top.map(([a, y]) => new THREE.Vector2(a, y)); pts.push(new THREE.Vector2(a1, yb), new THREE.Vector2(a0, yb));
  const e = 0.004, x0 = Math.min(r[0], r[2]) - (axis === 'x' ? 0 : e), x1 = Math.max(r[0], r[2]) + (axis === 'x' ? 0 : e);
  const z0 = Math.min(r[1], r[3]) - (axis === 'x' ? e : 0), z1 = Math.max(r[1], r[3]) + (axis === 'x' ? e : 0);
  const m = new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: axis === 'x' ? z1 - z0 : x1 - x0, bevelEnabled: false }), mat);
  if (axis === 'x') m.position.set(0, 0, z0); else { m.rotation.y = -Math.PI / 2; m.position.set(x1, 0, 0); }
  m.castShadow = m.receiveShadow = true; parent.add(m); return m;
}
const STRINGER_DROP = 0.75;   // bungalow stair (owner, Nov 2026): a mild-steel balustrade, so the walls that rose to the handrail line stop 0.75 below it
const WALL_TOPS = ((!SEMID && D.gf_wall_tops && D.gf_wall_tops.value) || []).map(w => /rail line/.test(w.notes || '') ? { ...w, prof: w.prof.map(([a, y]) => [a, y > 1.1 ? y - STRINGER_DROP : y]) } : w);
for (const r of D.gf.filter(inZone)) {
  await slice();   // embedded build: a break between pieces once a slice of work has run
  if (isStringer(r) || (SEMID && ARTEFACTS.includes(rkey(r)))) continue;
  const wt = WALL_TOPS.find(w => rkey(w.r) === rkey(r));
  if (wt) {                                                       // rises with the walls, cut at the plan height like the rest
    const [a0, a1] = wt.axis === 'x' ? [Math.min(r[0], r[2]), Math.max(r[0], r[2])] : [Math.min(r[1], r[3]), Math.max(r[1], r[3])];
    const m = profWall(r, wt.axis, wt.prof, a0, a1, 0, house), hi = Math.max(...wt.prof.map(q => q[1]));
    m.userData.full = 1; m.userData.h0 = Math.min(1, CUT / hi); setH(m, m.userData.h0); gfWalls.push(m);
    continue;
  }
  if (SEMID && rkey(r) === '-0.115,0.6,0.115,4.798') {   // porch party wall: open panel between the porches (z 0.6..4.098, y 1.2..3.0), column C17 beyond
    gfWall([-0.115, 0.6, 0.115, 4.098], GROUND, 1.2 - GROUND);
    const b = block([-0.115, 0.6, 0.115, 4.098], 3.0, 0.45, mWall, house); b.userData.full = 0.45; setH(b, 0); gfHeads.push(b);
    gfWall([-0.115, 4.098, 0.115, 4.798], GROUND, 3.45 - GROUND);
    continue;
  }
  const front = Math.max(r[1], r[3]) > PORCH_DEPTH + 0.05;      // beyond the porch roof: low gate wall
  const inPorch = Math.min(r[1], r[3]) > 0.05;
  const base = inPorch ? GROUND : 0;
  gfWall(r, base, front ? 1.5 : (inPorch ? 3.45 - GROUND : GF_TOP));
}

// First-floor wall tops: up to the eave soffit (7.245) under the pitched roofs,
// 7.00 under the flat party-wall strips, 6.80 under the right unit's middle flat roof.
const FF_TOP_EAVE = 7.245;
function ffTop(r) {
  const cx = (r[0] + r[2]) / 2, cz = (r[1] + r[3]) / 2;
  if (!SEMID) {   // bungalow: walls rise to the truss seat, except under the flat roof between the two pitched roofs
    for (const zn of X.ff_top.zones) if (cx > zn.r[0] && cx < zn.r[2] && cz > zn.r[1] && cz < zn.r[3]) return zn.top;
    return X.ff_top.default;
  }
  if (Math.abs(cx) < 1.62 && cz < -2.78 && cz > -10.47) return 7.0;
  if (Math.abs(cx) < 0.12) return 7.0;
  if (cx > 1.6 && cz < -6.17 && cz > -7.08) return 6.8;
  return FF_TOP_EAVE;
}

if (LIB) await Y();   // embedded build: let the hero draw a frame
// ---- openings: the verified window and door schedule (semid_detail.json) ----
// Every exterior gap in the CAD walls is refilled: solid wall where the elevations
// show no opening, and frame, glass or timber leaves where they do.
const mFrame = new THREE.MeshStandardMaterial({ color: 0xF1EFEA, roughness: 0.4, metalness: 0.15 }); mFrame.name = 'frame';   // white powder-coated aluminium (owner, Nov 2026: all houses)
const mTimber = new THREE.MeshStandardMaterial({ color: 0x6B4A33, roughness: 0.6 });                  // panelled timber doors
// Room and bathroom doors (owner, Nov 2026: "nicer minimalist door, just slight darker cream"): flush leaves with no
// grooves, satin paint a shade darker than the cream walls, slim architraves in the same colour, a slim lever on a round rose.
const DOOR_CREAM = 0xE4D9C6;
const mDoorHDF = new THREE.MeshStandardMaterial({ color: DOOR_CREAM, roughness: 0.48 });   // leaf faces
const mDoorPlain = new THREE.MeshStandardMaterial({ color: DOOR_CREAM, roughness: 0.5 });   // frames, architraves, leaf edges
const hdfLeaf = thinZ => thinZ ? [mDoorPlain, mDoorPlain, mDoorPlain, mDoorPlain, mDoorHDF, mDoorHDF] : [mDoorHDF, mDoorHDF, mDoorPlain, mDoorPlain, mDoorPlain, mDoorPlain];   // HDF faces, plain edges
const paintedDoor = s => s.kind === 'timber' && s.floor === 1;   // upstairs balcony doors are painted like the room doors (owner, Nov 2026); front doors stay timber
const mSteel = new THREE.MeshStandardMaterial({ color: 0x2B2927, roughness: 0.4, metalness: 0.5 });
// a minimalist lever: a round-looking rose (50 mm), a short neck and a 130 mm bar pointing back toward the hinge.
// along: the axis the leaf runs along; a: the spindle position on it; dir: +1/-1, the way the bar points;
// face: the leaf face coordinate across it; out: +1/-1, the side the lever stands off; y: spindle height
function lever(along, a, dir, face, out, y, parent) {
  const span = (p, q) => [Math.min(p, q), Math.max(p, q)], o = (d0, d1) => span(face + out * d0, face + out * d1);
  const put = ([a0, a1], [c0, c1], y0, h) => block(rectAlong(along, a0, a1, c0, c1), y0, h, mSteel, parent, null);
  put([a - 0.025, a + 0.025], o(0, 0.008), y - 0.025, 0.05);          // rose
  put([a - 0.008, a + 0.008], o(0.008, 0.052), y - 0.008, 0.016);     // neck
  put(span(a - dir * 0.008, a + dir * 0.13), o(0.04, 0.056), y - 0.008, 0.016);   // bar
}
const mRailBlack = new THREE.MeshStandardMaterial({ color: 0x18181A, roughness: 0.42, metalness: 0.35 });   // satin black powder-coat
const mOakRail = new THREE.MeshStandardMaterial({ color: 0xC4A880, roughness: 0.45 });                    // oiled light-oak handrail (Japandi)
const dedupe = list => { const seen = new Set(); return list.filter(o => { const k = o.r.map(v => v.toFixed(2)).join(); return seen.has(k) ? false : (seen.add(k), true); }); };
const wallAxis = r => {
  const x0 = Math.min(r[0], r[2]), x1 = Math.max(r[0], r[2]), z0 = Math.min(r[1], r[3]), z1 = Math.max(r[1], r[3]);
  if (SEMID) {
    if (z0 > -0.2 && Math.abs(z1) < 0.05) return 'x';                                   // front wall
    if (z0 < -13.2 && z1 < -13.0) return 'x';                                           // rear wall
    if ((x0 > 6.5 && x1 < 6.75) || (x1 < -6.5 && x0 > -6.75)) return 'z';               // side walls
    return null;
  }
  // Bungalow (recessed front and rear): an exterior gap is one that carries a scheduled exterior opening.
  const hit = X.openings.find(s => {
    const along = s.axis === 'x' ? [x0, x1] : [z0, z1], cross = s.axis === 'x' ? (z0 + z1) / 2 : (x0 + x1) / 2;
    return Math.abs((s.c0 + s.c1) / 2 - cross) < 0.15 && s.a1 > along[0] + 0.02 && s.a0 < along[1] - 0.02;
  });
  return hit ? hit.axis : null;
};
const rectAlong = (ax, a0, a1, c0, c1) => (ax === 'x' ? [a0, c0, a1, c1] : [c0, a0, c1, a1]);
const builtOpenings = new Set(), swingDoors = [];
const slidingPanes = [];
function detailOpening(s, parent) {
  const mid = (s.c0 + s.c1) / 2, R = (a0, a1, d) => rectAlong(s.axis, a0, a1, mid - d / 2, mid + d / 2);
  const fw = 0.05, fd = 0.07;
  // The walked Semi-D's balcony slider (FF-F2): its middle panel slides open over the left one as you walk out.
  const slide = SEMID && s.id === 'FF-F2' && s.a1 < 0 && s.mull.length >= 2 && s.transom;
  let sm0 = null, sm1 = null;
  if (slide) { const ms = s.mull.filter(([, y0]) => y0 < s.transom[0]).map(q => q[0]).sort((a, b) => a - b); [sm0, sm1] = [ms[0], ms[1]]; }
  if (s.kind !== 'timber' && !slide) {   // timber doors are solid panelled leaves: no glass across them
    const glass = block(R(s.a0, s.a1, 0.012), s.sill, s.head - s.sill, mGlass, parent, null); glass.castShadow = false;
  } else if (slide) {
    // A 3-panel telescopic slider (owner, Nov 2026): the outer panel is fixed; the middle and end panels run on their own
    // tracks and open together, stacking behind the fixed one, so two thirds of the width opens onto the balcony.
    for (const [a, b, y0, y1] of [[s.a0, sm0, s.sill, s.transom[0]], [s.a0, s.a1, s.transom[1], s.head]]) {
      const g = block(R(a, b, 0.012), y0, y1 - y0, mGlass, parent, null); g.castShadow = false;
    }
    for (const [k, p0, p1] of [[1, sm0, sm1], [2, sm1, s.a1 - fw]]) {
      const pane = new THREE.Group(); parent.add(pane);
      const Rb = (a0, a1, d) => rectAlong(s.axis, a0, a1, mid - 0.034 * k - d / 2, mid - 0.034 * k + d / 2);   // its own track, further in
      const g = block(Rb(p0, p1, 0.012), s.sill + 0.03, s.transom[0] - s.sill - 0.06, mGlass, pane, null); g.castShadow = false;
      for (const a of [p0, p1 - fw]) block(Rb(a, a + fw, 0.03), s.sill, s.transom[0] - s.sill, mFrame, pane, null);
      for (const y of [s.sill, s.transom[0] - 0.04]) block(Rb(p0, p1, 0.03), y, 0.04, mFrame, pane, null);
      if (k === 2) block(Rb(p1 - fw - 0.04, p1 - fw - 0.018, 0.08), s.sill + 0.85, 0.38, mSteel, pane, null);   // the pull
      pane.userData.dx = -(p0 - s.a0 - fw * 0.5); slidingPanes.push(pane);
    }
    block(R(sm0 - fw, sm0, fd), s.sill, s.transom[0] - s.sill, mFrame, parent, null);   // the fixed panel's meeting stile
  }
  // Timber doors: a slim timber door frame (jambs + head) only, no mullion between the leaves and no sill bar.
  const timber = s.kind === 'timber', fm = timber ? (paintedDoor(s) ? mDoorPlain : mTimber) : mFrame, jw = timber ? 0.04 : fw;
  block(R(s.a0, s.a0 + jw, fd), s.sill, s.head - s.sill, fm, parent, null);
  block(R(s.a1 - jw, s.a1, fd), s.sill, s.head - s.sill, fm, parent, null);
  block(R(s.a0, s.a1, fd), s.head - jw, jw, fm, parent, null);
  if (!timber) block(R(s.a0, s.a1, fd), s.sill, fw, mFrame, parent, null);
  if (s.transom) block(R(s.a0, s.a1, fd), s.transom[0], s.transom[1] - s.transom[0], fm, parent, null);
  // Sliding glass doors (both homes, every floor-level slider bar the walked Semi-D's animated balcony door): each panel
  // is its own framed sash, fixed ones on the outer track and sliding ones on the inner, overlapping where they meet,
  // with a slim pull on each sliding sash, so they read as sliding doors and not as a fixed window wall.
  const sdoor = (s.kind === 'slider' || s.kind === 'folding') && s.sill - (s.floor ? FF_BASE : 0) < 0.1 && !slide;
  const sTop = s.transom ? s.transom[0] : s.head - fw;
  if (sdoor) {
    const xs = [s.a0 + fw, ...s.mull.filter(([, y0]) => y0 < sTop - 0.01).map(q => q[0]).sort((a, b) => a - b), s.a1 - fw];
    const n = xs.length - 1, sw = 0.045, am = (s.a0 + s.a1) / 2;
    const Rt = (a0, a1, off) => rectAlong(s.axis, a0, a1, mid + off - 0.02, mid + off + 0.02);
    for (let i = 0; i < n; i++) {
      const moving = n === 1 ? false : n === 2 ? i === 1 : i > 0 && i < n - 1, off = moving ? -0.022 : 0.022;
      const a = xs[i] - (i > 0 ? sw / 2 : 0), b = xs[i + 1] + (i < n - 1 ? sw / 2 : 0), y0 = s.sill + fw, y1 = sTop;
      for (const u of [a, b - sw]) block(Rt(u, u + sw, off), y0, y1 - y0, mFrame, parent, null);   // stiles
      block(Rt(a, b, off), y0, 0.075, mFrame, parent, null);                                      // bottom rail
      block(Rt(a, b, off), y1 - 0.05, 0.05, mFrame, parent, null);                                // top rail
      if (moving) {   // the pull, on the edge that opens
        const e = Math.abs(a - am) < Math.abs(b - am) ? b - sw - 0.03 : a + sw + 0.03;
        block(rectAlong(s.axis, e - 0.011, e + 0.011, mid + off - 0.045, mid + off + 0.045), s.sill + 0.85, 0.38, mSteel, parent, null);
      }
    }
  }
  if (!timber) for (const [m, y0, y1] of s.mull) if (!(slide && y0 < s.transom[0] && (m === sm0 || m === sm1)) && !(sdoor && y0 < sTop - 0.01)) block(R(m - fw / 2, m + fw / 2, fd), y0, y1 - y0, mFrame, parent, null);
  // Panelled timber leaves. The walked unit's front door (GF-F2) is hinged at its outer edges and
  // swings inward as drawn on the plan, opening as you reach it (see apply()).
  // The bungalow's balcony door (FF-F4, one timber leaf) opens the same way as you walk out to the balcony.
  const late = !SEMID && s.id === (X.balcony_door_id || 'FF-F4') && s.leaves.length === 1;
  const swing = late || (s.id === (SEMID ? 'GF-F2' : X.front_door_id) && s.leaves.length === 2), meet = s.leaves.length === 2 ? (s.leaves[0][1] + s.leaves[1][0]) / 2 : null;
  for (const [a0, a1, y0, y1] of s.leaves) {
    if (swing && s.axis === 'x') {
      const hinge = meet === null ? a0 : Math.abs(a0 - meet) > Math.abs(a1 - meet) ? a0 : a1, w = a1 - a0, sg = hinge === a0 ? 1 : -1;
      const pivot = new THREE.Group(); pivot.position.set(hinge, 0, mid); parent.add(pivot);
      if (paintedDoor(s)) {   // painted HDF leaf with lever handles both sides, like the room doors
        block([sg > 0 ? 0 : -w, -0.025, sg > 0 ? w : 0, 0.025], y0, y1 - y0, hdfLeaf(true), pivot, null);
        for (const sd of [-1, 1]) lever('x', sg * (w - 0.08), -sg, sd * 0.025, sd, y0 + 1.0, pivot);
      } else {
        block([sg > 0 ? 0 : -w, -0.025, sg > 0 ? w : 0, 0.025], y0, y1 - y0, mTimber, pivot, mInkSoft);
        for (const py of [0.55, 1.2, 1.85]) block([sg > 0 ? 0.08 : -w + 0.08, 0.024, sg > 0 ? w - 0.08 : -0.08, 0.034], y0 + py - 0.27, 0.54, mTimber, pivot, null);   // raised panels
        block([sg * (w - 0.1) - 0.012, -0.06, sg * (w - 0.1) + 0.012, 0.06], y0 + 0.95, 0.22, mSteel, pivot, null);                    // handle
      }
      pivot.userData.sg = sg; pivot.userData.late = late; swingDoors.push(pivot);
      continue;
    }
    const hx = a1 - a0 > 0.6 ? (Math.abs(a0) < Math.abs(a1) ? a0 + 0.08 : a1 - 0.08) : a1 - 0.08;   // handle on the meeting edge
    if (paintedDoor(s)) {   // painted HDF leaf with lever handles both sides, like the room doors
      block(R(a0, a1, 0.05), y0, y1 - y0, hdfLeaf(s.axis === 'x'), parent, null);
      for (const sd of [-1, 1]) lever(s.axis, hx, hx < (a0 + a1) / 2 ? 1 : -1, mid + sd * 0.025, sd, y0 + 1.0, parent);
      continue;
    }
    block(R(a0, a1, 0.05), y0, y1 - y0, mTimber, parent, mInkSoft);
    block(R(hx - 0.012, hx + 0.012, 0.11), y0 + 0.95, 0.22, mSteel, parent, null);
  }
  if (s.hood) {
    const out = s.axis === 'x' ? (mid > HCZ ? 1 : -1) : (mid > HCX ? 1 : -1);
    const c = out > 0 ? [s.c1, s.c1 + s.hood.proj] : [s.c0 - s.hood.proj, s.c0];
    block(rectAlong(s.axis, s.hood.a0, s.hood.a1, c[0], c[1]), s.hood.y0, s.hood.y1 - s.hood.y0, mWall, parent, mInk);
  }
}
function refillGap(fl, r, ax) {
  const A0 = ax === 'x' ? Math.min(r[0], r[2]) : Math.min(r[1], r[3]), A1 = ax === 'x' ? Math.max(r[0], r[2]) : Math.max(r[1], r[3]);
  const C0 = ax === 'x' ? Math.min(r[1], r[3]) : Math.min(r[0], r[2]), C1 = ax === 'x' ? Math.max(r[1], r[3]) : Math.max(r[0], r[2]);
  const mid = (C0 + C1) / 2;
  const mine = X.openings.filter(s => s.floor === fl && s.axis === ax && Math.abs((s.c0 + s.c1) / 2 - mid) < 0.12 && s.a1 > A0 + 0.02 && s.a0 < A1 - 0.02);
  let cur = A0;
  for (const [a, b] of mine.map(s => [Math.max(s.a0, A0), Math.min(s.a1, A1)]).sort((p, q) => p[0] - q[0])) {
    if (a > cur + 0.01) { const rr = rectAlong(ax, cur, a, C0, C1); fl ? ffBlock(rr, FF_BASE, ffTop(rr) - FF_BASE) : gfWall(rr, 0, GF_TOP); }
    cur = Math.max(cur, b);
  }
  if (A1 > cur + 0.01) { const rr = rectAlong(ax, cur, A1, C0, C1); fl ? ffBlock(rr, FF_BASE, ffTop(rr) - FF_BASE) : gfWall(rr, 0, GF_TOP); }
  for (const s of mine) {
    if (builtOpenings.has(s.id)) continue; builtOpenings.add(s.id);
    const rr = rectAlong(ax, s.a0, s.a1, C0, C1), floor = fl ? FF_BASE : 0, top = fl ? ffTop(rr) : GF_TOP;
    const over = mine.some(o => o !== s && o.a1 > s.a0 + 0.02 && o.a0 < s.a1 - 0.02 && o.sill >= s.head - 0.01);   // a fanlight sits above
    const under = mine.some(o => o !== s && o.a1 > s.a0 + 0.02 && o.a0 < s.a1 - 0.02 && o.head <= s.sill + 0.01);  // something sits below
    if (!over) { if (fl) ffBlock(rr, s.head, top - s.head); else { const h = block(rr, s.head, top - s.head, mWall, house); h.userData.full = top - s.head; setH(h, 0); gfHeads.push(h); } }
    if (!under && s.sill > floor + 0.01) { if (fl) ffBlock(rr, floor, s.sill - floor); else gfWall(rr, 0, s.sill, [mWall, mWall, mLight, mWall, mWall, mWall]); }
    detailOpening(s, fl ? ffDetail : gfDetail);
  }
}
// The undersides of the stair's slab flights and landings (mirrored for the right unit), for lintels below them.
const SHELF_FROM = 0.6;   // Semi-D: steps from this height up are a slab over the under-stair shelving
const rOver = (p, q) => Math.min(Math.max(p[0], p[2]), Math.max(q[0], q[2])) - Math.max(Math.min(p[0], p[2]), Math.min(q[0], q[2])) > 0.01 && Math.min(Math.max(p[1], p[3]), Math.max(q[1], q[3])) - Math.max(Math.min(p[1], p[3]), Math.min(q[1], q[3])) > 0.01;
const SOLID_STEP = st => (SEMID ? st.flight === 1 && st.top < SHELF_FROM : !!st.solid);
const STAIR_SOFFITS = X.stair.steps.filter(st => !SOLID_STEP(st)).flatMap(st => (SEMID ? [1, -1] : [1]).map(s => ({ r: [s * st.r[0], st.r[1], s * st.r[2], st.r[3]], y: st.top - (st.flight === 'landing' ? 0.15 : 0.2 + (X.stair.riser || 0.176)) })));
for (const o of dedupe(D.gf_open.filter(o => inZone(o.r) && Math.max(o.r[1], o.r[3]) < PORCH_DEPTH))) {
  const r = o.r, ax = wallAxis(r);
  if (ax) { refillGap(0, r, ax); continue; }
  if (SEMID && Math.abs(r[2] - r[0]) > 2.0 && r[0] * r[2] < 0) continue;   // beam line across the party wall: no beam, flat plaster ceiling
  // interior door: lintel over the head; under a slab flight (the bungalow's under-stair door) it stops at the soffit
  const lt = Math.min(GF_TOP, ...STAIR_SOFFITS.filter(q => rOver(q.r, r)).map(q => q.y));
  if (lt > o.head + 0.005) { const h = block(r, o.head, lt - o.head, mWall, house); h.userData.full = lt - o.head; setH(h, 0); gfHeads.push(h); }
  if (o.win) gfWall(r, 0, o.sill, [mWall, mWall, mLight, mWall, mWall, mWall]);
}

for (const r of D.site.filter(inZone)) {
  const m = block(r, GROUND, 0.9, [mWall, mWall, mLight, mWall, mWall, mWall], house);
  m.userData.full = 1.5; siteWalls.push(m);
  m.userData.vent = Math.max(Math.abs(r[2] - r[0]), Math.abs(r[3] - r[1])) > 2.5;
}
if (LIB) await Y();   // embedded build: let the hero draw a frame
// Boundary fences as built (tender BQ: 1500 high, 600 solid wall with ventilation-block panels; the street
// render shows the lattice): solid plinth, breeze-block panels between piers at <= 3 m, capping beam.
const fence = new THREE.Group(); scene.add(fence);
{
  const ventTex = ventTexture();
  // Street-facing runs only: the walls between units stay plain (vent blocks are on the front fence, as in the render).
  const roadPoly = ESTATE && ESTATE.road.reserve, wp = ESTATE && (SEMID ? ESTATE.pairs.find(q => q.id === 'pair_002_001') : ESTATE.bungalows.find(q => q.id === 'bungalow_001'));
  const toEst = (x, z) => { const a = wp.rot * Math.PI / 180, mx = wp.mirror ? -x : x; return [wp.o[0] + mx * Math.cos(a) + z * Math.sin(a), wp.o[1] - mx * Math.sin(a) + z * Math.cos(a)]; };
  const nearRoad = (x, z) => { const [ex, ez] = toEst(x, z); let d = Infinity;
    for (let i = 0; i < roadPoly.length; i++) { const A = roadPoly[i], B = roadPoly[(i + 1) % roadPoly.length], dx = B[0] - A[0], dz = B[1] - A[1], L2 = dx * dx + dz * dz || 1;
      const t = clamp(((ex - A[0]) * dx + (ez - A[1]) * dz) / L2); d = Math.min(d, Math.hypot(ex - A[0] - t * dx, ez - A[1] - t * dz)); }
    return d < 0.6; };
  const isFront = r => roadPoly && wp ? nearRoad((r[0] + r[2]) / 2, (r[1] + r[3]) / 2) : Math.abs(r[2] - r[0]) > Math.abs(r[3] - r[1]) && Math.max(r[1], r[3]) > LOT.z1 - 0.3;
  for (const r of D.site.filter(inZone)) {
    if (!SEMID && ESTATE) break;   // bungalow: its boundary walls and gate come from the estate site plan (splayed corner)
    const L = Math.max(Math.abs(r[2] - r[0]), Math.abs(r[3] - r[1]));
    const vent = L > 2.5 && isFront(r);   // long street-facing runs; side and rear walls, the meter block and short pieces stay solid
    const ax = Math.abs(r[2] - r[0]) > Math.abs(r[3] - r[1]) ? 'x' : 'z';
    const a0 = ax === 'x' ? Math.min(r[0], r[2]) : Math.min(r[1], r[3]), a1 = a0 + L;
    const c0 = ax === 'x' ? Math.min(r[1], r[3]) : Math.min(r[0], r[2]), c1 = ax === 'x' ? Math.max(r[1], r[3]) : Math.max(r[0], r[2]), mid = (c0 + c1) / 2;
    if (!vent) {   // meter block / party-line walls stay solid, with a timber accent band like the render
      block(r, GROUND, 1.5, mRender, fence, null);
      if (L < 1.2) block(rectAlong(ax, a0, a1, c0 - 0.012, c1 + 0.012), GROUND + 1.12, 0.14, new THREE.MeshStandardMaterial({ color: 0x8A6A4C, roughness: 0.7 }), fence, null);
      continue;
    }
    block(rectAlong(ax, a0, a1, c0, c1), GROUND, 0.6, mRender, fence, null);                         // plinth
    block(rectAlong(ax, a0, a1, c0 - 0.025, c1 + 0.025), GROUND + 1.38, 0.12, mRender, fence, null);  // capping beam
    const n = Math.max(1, Math.ceil((L - 0.23) / 3.0)), step = (L - 0.23) / n;
    const piers = Array.from({ length: n + 1 }, (_, k) => a0 + 0.115 + k * step);
    for (const pc of piers) block(rectAlong(ax, pc - 0.115, pc + 0.115, c0 - 0.03, c1 + 0.03), GROUND, 1.55, mRender, fence, null);
    for (let k = 0; k < n; k++) {
      const p0 = piers[k] + 0.115, p1 = piers[k + 1] - 0.115, len = p1 - p0, h = 0.78;
      for (const off of [-0.05, 0.05]) {
        const t = ventTex.clone(); t.needsUpdate = true; t.repeat.set(len / 0.39, h / 0.39);
        const pl = new THREE.Mesh(new THREE.PlaneGeometry(len, h), new THREE.MeshStandardMaterial({ color: COL.plaster, map: t, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 }));
        if (ax === 'x') pl.position.set((p0 + p1) / 2, GROUND + 0.6 + h / 2, mid + off);
        else { pl.rotation.y = Math.PI / 2; pl.position.set(mid + off, GROUND + 0.6 + h / 2, (p0 + p1) / 2); }
        pl.castShadow = pl.receiveShadow = true; fence.add(pl);
      }
    }
  }
}

// Parts of the house rectangle that are outdoors on a floor (the bungalow's entrance and rear stair-core recesses),
// found by testing a grid built from the outline's own corners.
function outsideRects(poly) {
  if (!poly) return [];
  const xs = [...new Set([HOUSE.x0, HOUSE.x1, ...poly.map(q => q[0])])].sort((a, b) => a - b), zs = [...new Set([HOUSE.z0, HOUSE.z1, ...poly.map(q => q[1])])].sort((a, b) => a - b);
  const inPoly = (x, z) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
  const out = [];
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) if (!inPoly((xs[i] + xs[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2)) out.push([xs[i], zs[j], xs[i + 1], zs[j + 1]]);
  return out;
}
const OUT_FF = SEMID ? [] : outsideRects(D.outline && D.outline.FF);
if (LIB) await Y();   // embedded build: let the hero draw a frame
// First floor: slab with the stair void cut out, the porch/balcony slab, then the walls.
{
  const holes = [...X.voids, ...OUT_FF.filter(r => r[1] <= HOUSE.z0 + 0.01)], zs = [HOUSE.z0, HOUSE.z1, ...holes.flatMap(h => [h[1], h[3]])].sort((a, b) => a - b);   // the slab still roofs the entrance recess
  for (let i = 0; i < zs.length - 1; i++) {
    const z0 = zs[i], z1 = zs[i + 1]; if (z1 - z0 < 0.01) continue;
    let xs = [[HOUSE.x0, HOUSE.x1]];
    for (const h of holes) if (h[1] < z1 - 0.01 && h[3] > z0 + 0.01) xs = xs.flatMap(([a, b]) => (h[2] <= a || h[0] >= b) ? [[a, b]] : [[a, h[0]], [h[2], b]].filter(([p, q]) => q - p > 0.01));
    for (const [a, b] of xs) ffBlock([a, z0, b, z1], GF_TOP, FF_BASE - GF_TOP, mSlab);
  }
}
for (const f of X.roof.flats.filter(f => f.y1 < 4)) ffBlock(f.r, f.y0, f.y1 - f.y0, mSlab);
for (const r of D.ff.filter(inZone)) {
  await slice();
  if (SEMID && (Math.max(r[1], r[3]) > 0.01 || Math.min(Math.abs(r[0]), Math.abs(r[2])) > 6.73 || Math.max(Math.abs(r[0]), Math.abs(r[2])) > 6.75)) continue;   // balcony + outside bits: from the spec below
  ffBlock(r, FF_BASE, ffTop(r) - FF_BASE);
}
for (const o of dedupe(D.ff_open.filter(o => inZone(o.r)))) {
  const r = o.r, ax = wallAxis(r);
  if (ax) { refillGap(1, r, ax); continue; }
  if (SEMID && Math.abs(r[2] - r[0]) > 2.0 && r[0] * r[2] < 0) continue;   // spurious span across the party wall
  const head = FF_BASE + o.head;
  ffBlock(r, head, ffTop(r) - head);
  if (o.win) ffBlock(r, FF_BASE, o.sill);
}
// Front balcony: 1100 mm solid parapet, L-shaped, both units; party-wall fin up to the eave.
// Solid rendered parapet with a proud coping; the short side returns are horizontal slats (as in the street render).
// Guard rail along a void edge, matching the stair: oak handrail on satin-black square balusters at 110 mm.
function railGuard(r, y0, y1, parent) {
  const ax = Math.abs(r[2] - r[0]) > Math.abs(r[3] - r[1]) ? 'x' : 'z';
  const a0 = ax === 'x' ? Math.min(r[0], r[2]) : Math.min(r[1], r[3]), a1 = ax === 'x' ? Math.max(r[0], r[2]) : Math.max(r[1], r[3]);
  const c = ax === 'x' ? (r[1] + r[3]) / 2 : (r[0] + r[2]) / 2, gs = [];
  for (let a = a0 + 0.05; a <= a1 - 0.03; a += 0.11) { const g = new THREE.BoxGeometry(0.02, y1 - 0.05 - y0, 0.02); g.translate(ax === 'x' ? a : c, (y1 - 0.05 + y0) / 2, ax === 'x' ? c : a); gs.push(g); }
  for (const a of [a0 + 0.025, a1 - 0.025]) { const g = new THREE.BoxGeometry(0.05, y1 - y0, 0.05); g.translate(ax === 'x' ? a : c, (y1 + y0) / 2, ax === 'x' ? c : a); gs.push(g); }   // end posts
  { const g = new THREE.BoxGeometry(ax === 'x' ? a1 - a0 : 0.03, 0.025, ax === 'x' ? 0.03 : a1 - a0); g.translate(ax === 'x' ? (a0 + a1) / 2 : c, y0 + 0.1, ax === 'x' ? c : (a0 + a1) / 2); gs.push(g); }   // bottom rail
  const m = new THREE.Mesh(mergeGeometries(gs), mRailBlack); m.castShadow = true; parent.add(m);
  const h = new THREE.Mesh(new RoundedBoxGeometry(ax === 'x' ? a1 - a0 : 0.06, 0.045, ax === 'x' ? 0.06 : a1 - a0, 2, 0.012), mOakRail);
  h.position.set(ax === 'x' ? (a0 + a1) / 2 : c, y1 - 0.0225, ax === 'x' ? c : (a0 + a1) / 2); h.castShadow = true; parent.add(h);
}
const slatGroup = (r, y0, y1, parent) => {   // horizontal slats between two end posts, along the rect's long axis
  const ax = Math.abs(r[2] - r[0]) > Math.abs(r[3] - r[1]) ? 'x' : 'z';
  const a0 = ax === 'x' ? Math.min(r[0], r[2]) : Math.min(r[1], r[3]), a1 = ax === 'x' ? Math.max(r[0], r[2]) : Math.max(r[1], r[3]);
  const c0 = ax === 'x' ? Math.min(r[1], r[3]) : Math.min(r[0], r[2]), c1 = ax === 'x' ? Math.max(r[1], r[3]) : Math.max(r[0], r[2]), mid = (c0 + c1) / 2;
  block(rectAlong(ax, a0, a0 + 0.12, c0, c1), y0, y1 - y0, mWall, parent, null);
  block(rectAlong(ax, a1 - 0.12, a1, c0, c1), y0, y1 - y0, mWall, parent, null);
  block(rectAlong(ax, a0, a1, c0 - 0.01, c1 + 0.01), y1 - 0.08, 0.08, mWall, parent, null);            // top rail
  for (let y = y0 + 0.12; y < y1 - 0.14; y += 0.13) block(rectAlong(ax, a0 + 0.12, a1 - 0.12, mid - 0.03, mid + 0.03), y, 0.07, mWall, parent, null);
};
for (const b of X.balcony) {
  // Guard rails along the stair well / void stay slatted; every balcony half wall is solid rendered brick with a
  // flush top band (no projecting coping), grooved on its outer faces (see parapets.json below).
  if (!SEMID && (b.kind === 'slats' || b.kind === 'rail')) { railGuard(b.r, b.y0, b.y1, ffDetail); continue; }
  ffBlock(b.r, b.y0, b.y1 - b.y0);
}
if (SEMID) ffBlock([-0.115, 0, 0.115, 1.07], 4.7, 2.3);
// Bungalow: the projecting first-floor slab ledge (string course) round the house.
if (!SEMID) for (const l of X.ff_slab_ledge || []) ffBlock(l.r, l.y0, l.y1 - l.y0);
// Side balcony (Balkoni 2): a 600 mm ledge inside a gable-shaped frame on each outer wall.
for (const b of X.balcony2) {
  const ring = new THREE.Shape(b.outer.map(([z, y]) => new THREE.Vector2(-z, y)));
  ring.holes.push(new THREE.Path(b.inner.map(([z, y]) => new THREE.Vector2(-z, y))));
  const g = new THREE.ExtrudeGeometry(ring, { depth: b.x1 - b.x0, bevelEnabled: false });
  const m = new THREE.Mesh(g, mWall); m.rotation.y = Math.PI / 2; m.position.x = b.x0; m.castShadow = m.receiveShadow = true;
  m.add(new LineSegments2(new LineSegmentsGeometry().fromEdgesGeometry(new THREE.EdgesGeometry(g, 30)), mInk));
  ffDetail.add(m);
  const px = b.outer_x < 0 ? [b.x0, b.x0 + 0.15] : [b.x1 - 0.15, b.x1];
  ffBlock([px[0], b.parapet_z[0], px[1], b.parapet_z[1]], b.parapet_y[0], b.parapet_y[1] - b.parapet_y[0]);   // solid grooved half wall (section AA)
}
// Balcony half-wall design (amended CAD hatch + elevations, verified): horizontal render grooves at 125 mm with a
// joint under the flush 4.60-4.70 top band; plain 150 mm posts where the runs stop.
if (PARAPETS) {
  const gs = [];
  for (const f of PARAPETS.faces[HOME] || []) for (const [a0, a1] of f.runs) for (const y of f.ys) {
    const c0 = f.v, c1 = f.v + f.out * 0.003, lo = Math.min(c0, c1), hi = Math.max(c0, c1);
    const r = f.k === 'z' ? [Math.min(a0, a1), lo, Math.max(a0, a1), hi] : [lo, Math.min(a0, a1), hi, Math.max(a0, a1)];
    const g = new THREE.BoxGeometry(r[2] - r[0], 0.01, r[3] - r[1]); g.translate((r[0] + r[2]) / 2, y, (r[1] + r[3]) / 2); gs.push(g);
  }
  if (gs.length) { const m = new THREE.Mesh(mergeGeometries(gs), new THREE.MeshStandardMaterial({ color: 0xA4957F, roughness: 1 })); m.receiveShadow = true; ffDetail.add(m); }   // a shade deeper, so they read from the air
}

// Render groove lines (10 mm uPVC, 300 c/c) on the front and side walls.
const mGroove = new LineMaterial({ color: 0x8F8270, linewidth: 1.0, transparent: true, opacity: 0.4 });
lineMats.push(mGroove);
// Grooves stop at window and door openings (the elevations show them interrupted).
// Each groove: [x, y0, z, x, y1, z, nx, nz] with the wall's outward normal (the Semi-D data has none: derived).
const withNormal = g => g.length >= 8 ? g : (Math.abs(Math.abs(g[0]) - 6.723) < 0.01 ? [...g.slice(0, 6), Math.sign(g[0]), 0] : [...g.slice(0, 6), 0, 1]);
function clipGrooves(list) {
  const out = [];
  for (const g of list.map(withNormal)) {
    const [x, y0, z, , y1, , nx, nz] = g, side = nx !== 0;
    const cuts = X.openings.filter(o => side
      ? o.axis === 'z' && Math.abs((o.c0 + o.c1) / 2 - x) < 0.25 && z > o.a0 - 0.06 && z < o.a1 + 0.06
      : o.axis === 'x' && Math.abs((o.c0 + o.c1) / 2 - z) < 0.25 && x > o.a0 - 0.06 && x < o.a1 + 0.06)
      .map(o => [o.sill - 0.05, o.head + 0.05]).sort((a, b) => a[0] - b[0]);
    let cur = y0;
    for (const [c0, c1] of cuts) { if (c1 <= cur || c0 >= y1) continue; if (c0 > cur + 0.05) out.push([x, cur, z, x, c0, z, nx, nz]); cur = Math.max(cur, c1); }
    if (y1 > cur + 0.05) out.push([x, cur, z, x, y1, z, nx, nz]);
  }
  return out;
}
const GRV = clipGrooves(X.grooves);
const grooveGF = new LineSegments2(new LineSegmentsGeometry().setPositions(GRV.filter(g => g[1] < 3.5).flatMap(g => g.slice(0, 6))), mGroove);
const grooveFF = new LineSegments2(new LineSegmentsGeometry().setPositions(GRV.filter(g => g[1] >= 3.5).flatMap(g => g.slice(0, 6))), mGroove);
scene.add(grooveGF, grooveFF);
// ...and in the real view they read as raised battens (board-and-batten look of the renders), catching the sun.
// Owner (Nov 2026: "the facade ... got groovelines ... it should show? shadow too?"): the battens stand a little prouder
// (16 mm) and each has a thin shadow line either side where it meets the wall, so the rhythm reads from the air as well.
const mBattenShade = new THREE.MeshStandardMaterial({ color: 0xA99B86, roughness: 1 });
function battens(list) {
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mWall, list.length), M4 = new THREE.Matrix4();
  const sh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mBattenShade, list.length * 2), Q = new THREE.Quaternion();
  list.forEach(([x, y0, z, , y1, , nx, nz], i) => {
    const side = nx !== 0, h = y1 - y0, cy = (y0 + y1) / 2;
    M4.compose(V(x + nx * 0.008, cy, z + nz * (side ? 0 : 0.008)), Q, V(side ? 0.016 : 0.035, h, side ? 0.035 : 0.016));
    im.setMatrixAt(i, M4);
    for (const k of [-1, 1]) {   // the shadow gaps: 7 mm strips on the wall face, hard against each edge of the batten
      const t = k * (0.035 / 2 + 0.0035);
      M4.compose(V(x + (side ? nx * 0.0012 : t), cy, z + (side ? t : nz * 0.0012)), Q, V(side ? 0.002 : 0.007, h, side ? 0.007 : 0.002));
      sh.setMatrixAt(i * 2 + (k > 0 ? 1 : 0), M4);
    }
  });
  sh.receiveShadow = true; im.add(sh);
  im.castShadow = im.receiveShadow = true; scene.add(im); return im;
}
const battenGF = battens(GRV.filter(g => g[1] < 3.5)), battenFF = battens(GRV.filter(g => g[1] >= 3.5));

if (LIB) await Y();   // embedded build: let the hero draw a frame
// ---- finishing details: interior doors, skirting, exterior sills, switches and sockets ----
const mSkirting = new THREE.MeshStandardMaterial({ color: 0xF6F3EC, roughness: 0.6 });   // white skirting
// Interior doors (tender: HDF 900 x 2100 rooms, 750 bathrooms): the leaf stands open 90 deg against the jamb,
// with a slim timber-look architrave both sides.
const DOOR_LEAVES = [];   // every open leaf, for checking that none clash
function interiorDoor(r, floorY, headY, parent, closed = false) {
  const ax = Math.abs(r[2] - r[0]) > Math.abs(r[3] - r[1]) ? 'x' : 'z';
  const a0 = ax === 'x' ? Math.min(r[0], r[2]) : Math.min(r[1], r[3]), a1 = ax === 'x' ? Math.max(r[0], r[2]) : Math.max(r[1], r[3]);
  const c0 = ax === 'x' ? Math.min(r[1], r[3]) : Math.min(r[0], r[2]), c1 = ax === 'x' ? Math.max(r[1], r[3]) : Math.max(r[0], r[2]);
  const w = a1 - a0; if (w < 0.6 || w > 1.15) return;
  for (const c of [c0 - 0.012, c1]) {   // architraves on both faces
    block(rectAlong(ax, a0 - 0.045, a0, c, c + 0.012), floorY, headY - floorY + 0.045, mDoorPlain, parent, null);
    block(rectAlong(ax, a1, a1 + 0.045, c, c + 0.012), floorY, headY - floorY + 0.045, mDoorPlain, parent, null);
    block(rectAlong(ax, a0 - 0.045, a1 + 0.045, c, c + 0.012), headY, 0.045, mDoorPlain, parent, null);
  }
  const fl = floorY > 1 ? 1 : 0, walls = (fl ? D.ff : D.gf).filter(inZone);
  if (closed) {   // shut in the middle of the wall, lever handles on both faces near the free end
    const t = 0.038, cm = (c0 + c1) / 2, L = rectAlong(ax, a0 + 0.004, a1 - 0.004, cm - t / 2, cm + t / 2);
    const lf = block(L, floorY + 0.01, headY - floorY - 0.02, ax === 'x' ? [mDoorPlain, mDoorPlain, mDoorPlain, mDoorPlain, mDoorHDF, mDoorHDF] : [mDoorHDF, mDoorHDF, mDoorPlain, mDoorPlain, mDoorPlain, mDoorPlain], parent, null);
    lf.castShadow = true;
    DOOR_LEAVES.push({ fl, door: [a0, a1, c0, c1, ax], leaf: ax === 'x' ? [L[0], L[1], L[2], L[3]] : [L[0], L[1], L[2], L[3]], closed: true });
    for (const sd of [-1, 1]) lever(ax, a1 - 0.07, -1, cm + sd * t / 2, sd, floorY + 1.0, parent);
    return;
  }
  // The leaf stands open 90 deg into the ROOM, never into a corridor, landing or open-plan space, hinged at the
  // end nearest a return wall so it sits back against it.
  const solid = [...walls, ...(fl ? D.ff_open : D.gf_open).filter(o => inZone(o.r) && o.r[0] * o.r[2] >= 0).map(o => o.r)];   // other doorways close each room off (not the beam lines drawn across the party wall)
  const ray = (x, z, dx, dz, list = solid) => { let best = 9; for (const q of list) { const x0 = Math.min(q[0], q[2]), x1 = Math.max(q[0], q[2]), z0 = Math.min(q[1], q[3]), z1 = Math.max(q[1], q[3]);
    if (dx) { if (z < z0 || z > z1) continue; const d = dx > 0 ? x0 - x : x - x1; if (d > -0.01 && d < best) best = Math.max(d, 0); }
    else { if (x < x0 || x > x1) continue; const d = dz > 0 ? z0 - z : z - z1; if (d > -0.01 && d < best) best = Math.max(d, 0); } } return best; };
  const mid = (a0 + a1) / 2, sideInfo = sgn => {   // the space 0.6 m out from the door on one side: its extent and the room label in it
    const c = sgn > 0 ? c1 + 0.6 : c0 - 0.6, px = ax === 'x' ? mid : c, pz = ax === 'x' ? c : mid;
    const bx0 = px - ray(px, pz, -1, 0), bx1 = px + ray(px, pz, 1, 0), bz0 = pz - ray(px, pz, 0, -1), bz1 = pz + ray(px, pz, 0, 1);
    const labs = (D.labels.filter(l => (l.floor || 0) === fl && l.x > bx0 && l.x < bx1 && l.z > bz0 && l.z < bz1)
      .sort((u, v) => Math.hypot(u.x - px, u.z - pz) - Math.hypot(v.x - px, v.z - pz))[0] || { t: '' }).t;   // the room this side is in
    return { area: (bx1 - bx0) * (bz1 - bz0), circ: /KORIDOR|LANDING|LEGAR|LOBI|TANGGA|LALUAN|RUANG TAMU|RUANG MAKAN|DAPUR KERING/.test(labs) && !/BILIK/.test(labs), bath: /BILIK AIR|BEDAK/.test(labs) };
  };
  const P1 = sideInfo(1), M1 = sideInfo(-1);
  const sg = P1.circ && !M1.circ ? -1 : M1.circ && !P1.circ ? 1 : P1.bath && !M1.bath ? 1 : M1.bath && !P1.bath ? -1 : (P1.area <= M1.area ? 1 : -1);   // bathroom doors open into the bathroom; otherwise into the smaller room
  const cf = sg > 0 ? c1 : c0;
  const ret = a => ray(ax === 'x' ? a : cf + sg * 0.3, ax === 'x' ? cf + sg * 0.3 : a, ax === 'x' ? (a === a0 ? -1 : 1) : 0, ax === 'x' ? 0 : (a === a0 ? -1 : 1), walls);
  const lw = w - 0.04, t = 0.038;
  const lc = sg > 0 ? [cf, cf + lw] : [cf - lw, cf];
  // Hinge at the end nearest a return wall, unless the open leaf would then stand in front of a basin, WC or counter.
  const fixtures = (SEMID ? SD_FURN : FURN).filter(f => (f.floor || 0) === fl && /^(basin|wc|counter|vanity|sink)$/.test(f.kind) && f.x0 != null)
    .map(f => [Math.min(f.x0, f.x1) - 0.6, Math.min(f.z0, f.z1) - 0.6, Math.max(f.x0, f.x1) + 0.6, Math.max(f.z0, f.z1) + 0.6]);
  const blocks = h => { const L = ax === 'x' ? [h, lc[0], h + t, lc[1]] : [lc[0], h, lc[1], h + t];
    return fixtures.some(q => Math.min(L[2], q[2]) > Math.max(L[0], q[0]) && Math.min(L[3], q[3]) > Math.max(L[1], q[1])); };
  const hinges = [[a0 + 0.01, ret(a0)], [a1 - 0.01 - t, ret(a1)]].sort((u, v) => (blocks(u[0]) - blocks(v[0])) || (u[1] - v[1]));
  const ha = hinges[0][0];
  const leaf = block(ax === 'x' ? [ha, lc[0], ha + t, lc[1]] : [lc[0], ha, lc[1], ha + t], floorY + 0.01, headY - floorY - 0.02, ax === 'x' ? [mDoorHDF, mDoorHDF, mDoorPlain, mDoorPlain, mDoorPlain, mDoorPlain] : [mDoorPlain, mDoorPlain, mDoorPlain, mDoorPlain, mDoorHDF, mDoorHDF], parent, null);
  leaf.castShadow = true;
  DOOR_LEAVES.push({ fl, door: [a0, a1, c0, c1, ax], leaf: ax === 'x' ? [ha, lc[0], ha + t, lc[1]] : [lc[0], ha, lc[1], ha + t] });
  const cross = ax === 'x' ? 'z' : 'x', spin = sg > 0 ? cf + lw - 0.07 : cf - lw + 0.07;   // lever handles, both faces
  const room = hinges[0][1];   // clear space beside the open leaf, toward the hinge-side wall
  for (const [fc, sd] of [[ha, -1], [ha + t, 1]]) if (room > 0.07 || sd === (ha < mid ? 1 : -1)) lever(cross, spin, -sg, fc, sd, floorY + 1.0, parent);
}
const againstOuterWall = r => Math.min(r[1], r[3]) < HOUSE.z0 + 0.16 || Math.min(r[0], r[2]) < HOUSE.x0 + 0.16 || Math.max(r[0], r[2]) > HOUSE.x1 - 0.16;   // a lining strip, not a door
for (const o of dedupe(D.gf_open.filter(o => inZone(o.r) && Math.max(o.r[1], o.r[3]) < 0))) if (!wallAxis(o.r) && o.head < (SEMID ? 2.3 : 2.5) && !(o.sill > 0.3) && !againstOuterWall(o.r)) interiorDoor(o.r, 0, o.head, gfDetail, !!o.closed);   // the bungalow's ground-floor doors are 2.4 m high
for (const o of dedupe(D.ff_open.filter(o => inZone(o.r) && Math.max(o.r[1], o.r[3]) < 0))) if (!wallAxis(o.r) && o.head < 2.3 && !(SEMID && Math.abs(o.r[2] - o.r[0]) > 2.0 && o.r[0] * o.r[2] < 0)) interiorDoor(o.r, FF_BASE, FF_BASE + o.head, ffDetail);
// 100 mm skirting (tender) on every wall inside the house, both floors.
{
  const inside = r => Math.min(r[1], r[3]) > HOUSE.z0 - 0.01 && Math.max(r[1], r[3]) < 0.01 && Math.min(r[0], r[2]) > HOUSE.x0 - 0.01 && Math.max(r[0], r[2]) < HOUSE.x1 + 0.01;
  for (const r of D.gf.filter(inZone).filter(inside).filter(r => !isStringer(r))) block([Math.min(r[0], r[2]) - 0.008, Math.min(r[1], r[3]) - 0.008, Math.max(r[0], r[2]) + 0.008, Math.max(r[1], r[3]) + 0.008], 0, 0.1, mSkirting, gfDetail, null);
  for (const r of D.ff.filter(inZone).filter(inside)) block([Math.min(r[0], r[2]) - 0.008, Math.min(r[1], r[3]) - 0.008, Math.max(r[0], r[2]) + 0.008, Math.max(r[1], r[3]) + 0.008], FF_BASE, 0.1, mSkirting, ffDetail, null);
}
// (No projecting window sills: none are drawn on any of the four elevations.)
// Exterior details from the verified exterior spec (wf_semid_ext): both units unless noted.
const extDetail = new THREE.Group(); scene.add(extDetail);
if (!SEMID) {   // bungalow: downpipes from the roof plan, tanks on the flat roof, gutters
  const mPVC = new THREE.MeshStandardMaterial({ color: 0xEDE9E2, roughness: 0.5 });
  // Each pipe drops from its gutter outlet, kinks back to the nearest outer wall (swan neck) and runs down it on brackets.
  const poly = (D.outline && D.outline.GF) || [];
  const pipe = (A, B) => { const L = A.distanceTo(B), m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, L, 14), mPVC);
    m.position.copy(A).lerp(B, 0.5); m.quaternion.setFromUnitVectors(V(0, 1, 0), B.clone().sub(A).normalize()); m.castShadow = true; extDetail.add(m); };
  for (const [x, z] of (X.roof.downpipes || []).filter(() => false)) {   // owner (Nov 2026): no exposed downpipes on any house
    const g = (X.roof.gutters || []).filter(q => x >= q.r[0] - 0.2 && x <= q.r[2] + 0.2 && z >= q.r[1] - 0.2 && z <= q.r[3] + 0.2);
    const yTop = g.length ? Math.min(...g.map(q => q.y0)) : 7.4;
    let best = null;
    for (let i = 0; i < poly.length; i++) {
      const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
      const t = clamp(((x - ax) * dx + (z - az) * dz) / L2), fx = ax + t * dx, fz = az + t * dz, d = Math.hypot(x - fx, z - fz);
      if (!best || d < best.d) best = { d, fx, fz };
    }
    if (best && best.d > 0.1 && best.d < 0.8) {
      const ux = (x - best.fx) / best.d, uz = (z - best.fz) / best.d, wx = best.fx + ux * 0.08, wz = best.fz + uz * 0.08;
      const k1 = V(x, yTop - 0.15, z), k2 = V(wx, yTop - 0.15 - Math.max(0.35, best.d * 0.9), wz);
      pipe(V(x, yTop, z), k1); pipe(k1, k2); pipe(k2, V(wx, GROUND, wz));
      for (let y = GROUND + 0.5; y < k2.y - 0.2; y += 1.8) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.04, 14), mPVC); c.position.set(wx, y, wz); extDetail.add(c); }   // brackets
    }   // a pipe with no wall within reach is left out (it would hang in the open)
  }
  // Owner (Nov 2026): no exposed eave gutters either (rainwater concealed, as on every house), so X.roof.gutters is not drawn.
}
if (SEMID) {
  const mPVC = new THREE.MeshStandardMaterial({ color: 0xEDE9E2, roughness: 0.5 });
  // Rainwater downpipes (roof plan, after amendment; the two outer rear-corner pipes were demolished).
  // Owner (Nov 2026): no exposed downpipes on any house (concealed in the walls), so none are drawn.
  for (const [x, z, y0, y1] of []) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, y1 - y0, 14), mPVC); p.position.set(x, (y0 + y1) / 2, z); p.castShadow = true; extDetail.add(p);
    for (let y = y0 + 0.4; y < y1 - 0.2; y += 1.8) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.04, 14), mPVC); c.position.set(x, y, z); extDetail.add(c); }   // brackets
  }
  // SPAH rainwater tanks, 930 x 330 x 790 mm (230 L), at the back by the party wall, with a tap.
  const mTank = new THREE.MeshStandardMaterial({ color: 0x8E989C, roughness: 0.55 });
  for (const s of [1, -1]) {
    block(s > 0 ? [0.215, -13.685, 1.145, -13.355] : [-1.145, -13.685, -0.215, -13.355], -0.15, 0.79, mTank, extDetail, null);
    block([s * 1.27 - 0.02, -13.53, s * 1.27 + 0.02, -13.49], 0.08, 0.12, mSteel, extDetail, null);
  }
  // First-floor slab band projecting 150 mm (rear and both sides), y 3.55..3.70.
  for (const s of [1, -1]) {
    for (const [z0, z1] of [[-5.027, -0.543], [-12.712, -8.228]]) block(s > 0 ? [6.72, z0, 6.869, z1] : [-6.869, z0, -6.72, z1], 3.55, 0.15, mWall, extDetail, null);
  }
  block([-6.871, -13.405, 6.869, -13.255], 3.55, 0.15, mWall, extDetail, null);
  // Aprons at -0.15: rear and rear side; side patio paved strip (1.265 m, z 0.6..-8.59).
  const mApron = new THREE.MeshStandardMaterial({ color: 0xC9C2B7, roughness: 0.9 });
  for (const s of [1, -1]) {
    const R = r => s > 0 ? [-r[2], r[1], -r[0], r[3]] : r;
    block(R([-7.32, -13.855, -0.075, -13.255]), GROUND, 0.15, mApron, extDetail, null);
    block(R([-7.32, -13.255, -6.72, -8.59]), GROUND, 0.15, mApron, extDetail, null);
    // perimeter drain (300 wide) along the side and rear, a dark channel just below the garden
    for (const r of [[-8.285, -8.891, -7.985, 0.9], [-7.62, -14.155, -7.32, -8.891], [-7.62, -14.155, -0.075, -13.855]])
      block(R(r), GROUND - 0.02, 0.025, new THREE.MeshStandardMaterial({ color: 0x6F6A64, roughness: 0.9 }), extDetail, null);
  }
}
// Switch banks, sockets, water-heater switches and the DB at the electrician's points, on the nearest wall face.
{
  const mPlate = new THREE.MeshStandardMaterial({ color: 0xFAF8F4, roughness: 0.35 });
  const mDB = new THREE.MeshStandardMaterial({ color: 0xE9E6E0, roughness: 0.5 });
  for (const f of FIT) {
    if (f.k === 'light' || f.k === 'fan' || f.k === 'wall_light' || f.k === 'gate_light') continue;   // fittings placed below
    if (!['switch', 'socket', 'wh', 'db'].includes(f.k)) continue;
    const ff = f.y > 3.6, rects = (ff ? D.ff : D.gf).filter(inZone);
    let best = null;
    for (const r of rects) {
      const x0 = Math.min(r[0], r[2]), x1 = Math.max(r[0], r[2]), z0 = Math.min(r[1], r[3]), z1 = Math.max(r[1], r[3]);
      for (const [d, nx, nz, px, pz] of [[Math.abs(f.x - x0), -1, 0, x0, f.z], [Math.abs(f.x - x1), 1, 0, x1, f.z], [Math.abs(f.z - z0), 0, -1, f.x, z0], [Math.abs(f.z - z1), 0, 1, f.x, z1]]) {
        const along = nx ? f.z >= z0 - 0.05 && f.z <= z1 + 0.05 : f.x >= x0 - 0.05 && f.x <= x1 + 0.05;
        if (along && d < 0.45 && (!best || d < best.d)) best = { d, nx, nz, px, pz };
      }
    }
    if (!best) continue;
    const big = f.k === 'db', w = big ? 0.45 : f.k === 'socket' ? 0.146 : (f.n <= 2 ? 0.086 : f.n <= 4 ? 0.146 : 0.2), h = big ? 0.55 : 0.086, dep = big ? 0.09 : 0.01;
    const m = new THREE.Mesh(new THREE.BoxGeometry(best.nx ? dep : w, h, best.nx ? w : dep), big ? mDB : mPlate);
    m.position.set(best.px + best.nx * dep / 2, f.y, best.pz + best.nz * dep / 2); (ff ? fixFF : fixGF).add(m);
  }
}

if (LIB) await Y();   // embedded build: let the hero draw a frame
// ---- SPC flooring (stone-plastic composite, light oak look for Japandi, owner Nov 2026) on the stair and the whole first floor ----
function spcTexture() {   // 180 mm x 1220 mm planks, staggered, light oak tone with grain and soft bevels
  return canvasTex(1024, (g, s) => {
    const rows = 6, rowH = s / rows, plankL = s;              // texture = 1.22 m (x) by 1.08 m (y)
    for (let r = 0; r < rows; r++) {
      const off = ((r * 0.37) % 1) * plankL;
      for (let k = -1; k < 2; k++) {
        const x = k * plankL + off, v = (rnd() - 0.5) * 14;
        g.fillStyle = `rgb(${Math.round(194 + v)},${Math.round(164 + v * 0.8)},${Math.round(126 + v * 0.6)})`;   // warm honey oak (owner: darker, then a bit lighter)
        g.fillRect(x, r * rowH, plankL, rowH);
        for (let i = 0; i < 22; i++) {                        // grain
          const y0 = r * rowH + rnd() * rowH, a = 0.04 + rnd() * 0.08;
          g.strokeStyle = `rgba(118,86,56,${a * 0.85})`; g.lineWidth = 0.8 + rnd() * 1.6;
          g.beginPath(); for (let xx = 0; xx <= plankL; xx += 16) g.lineTo(x + xx, y0 + Math.sin((xx + i * 40) * 0.012) * 2.5); g.stroke();
        }
        g.fillStyle = 'rgba(110,88,64,0.32)'; g.fillRect(x, r * rowH, 2, rowH);   // end joint
      }
      g.fillStyle = 'rgba(110,88,64,0.36)'; g.fillRect(0, r * rowH, s, 2);       // long joint
    }
  });
}
const mSPC = new THREE.MeshStandardMaterial({ map: spcTexture(), roughness: 0.55 });
// First-floor floor finish: the house footprint less the stair void, with the bathrooms in porcelain tile.
{
  // Narrow ledges between a double-height void and the wall beyond it are slab edge, not floor: no SPC there.
  const ffWalls = D.ff.filter(inZone), ledges = [];
  for (const v of X.voids) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const ex = dx > 0 ? v[2] : dx < 0 ? v[0] : null, ez = dz > 0 ? v[3] : dz < 0 ? v[1] : null;
    let gap = 9;
    for (const q of ffWalls) {
      const x0 = Math.min(q[0], q[2]), x1 = Math.max(q[0], q[2]), z0 = Math.min(q[1], q[3]), z1 = Math.max(q[1], q[3]);
      if (dx && Math.min(z1, v[3]) - Math.max(z0, v[1]) > 0.3) { const d = dx > 0 ? x0 - ex : ex - x1; if (d > 0.02) gap = Math.min(gap, d); }
      if (dz && Math.min(x1, v[2]) - Math.max(x0, v[0]) > 0.3) { const d = dz > 0 ? z0 - ez : ez - z1; if (d > 0.02) gap = Math.min(gap, d); }
    }
    if (gap < 0.9) ledges.push(dx ? (dx > 0 ? [ex, v[1], ex + gap, v[3]] : [ex - gap, v[1], ex, v[3]]) : (dz > 0 ? [v[0], ez, v[2], ez + gap] : [v[0], ez - gap, v[2], ez]));
  }
  const holes = [...X.voids, ...OUT_FF, ...ledges], zs = [HOUSE.z0, HOUSE.z1, ...holes.flatMap(h => [h[1], h[3]])].sort((a, b) => a - b);
  for (let i = 0; i < zs.length - 1; i++) {
    const z0 = zs[i], z1 = zs[i + 1]; if (z1 - z0 < 0.01) continue;
    let xs = [[HOUSE.x0 + 0.15, HOUSE.x1 - 0.15]];
    for (const h of holes) if (h[1] < z1 - 0.01 && h[3] > z0 + 0.01) xs = xs.flatMap(([a, b]) => (h[2] <= a || h[0] >= b) ? [[a, b]] : [[a, h[0]], [h[2], b]].filter(([p, q]) => q - p > 0.01));
    for (const [a, b] of xs) {
      const t = mSPC.map.clone(); t.needsUpdate = true; t.repeat.set((b - a) / 1.22, (z1 - z0) / 1.08); t.offset.set(a / 1.22, -z1 / 1.08);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(b - a, z1 - z0), new THREE.MeshStandardMaterial({ map: t, roughness: 0.55 }));
      LIFT_MATS.push(m.material);   // light-oak lift (see LIFT_FIX; listed before use, which may apply at once)
      hd.use(m.material, 'spc_oak', { su: b - a, sv: z1 - z0, ou: a, ov: -z1 });   // the same world-locked planks (u = x, v = -z)
      m.rotation.x = -Math.PI / 2; m.position.set((a + b) / 2, FF_BASE + 0.004, (z0 + z1) / 2); m.receiveShadow = true; ffDetail.add(m);
    }
  }
  // Bathrooms (both homes, both floors): porcelain floor tile and wall tile floor to ceiling, room found from the plan
  // label and fixtures, then traced round its true outline; wall tile stops only where a doorway or window goes through.
  const bathTile = tileTexture(), wallTileTex = cachedTex('walltile', () => canvasTex(512, (g, n) => {
    g.fillStyle = '#ece8e1'; g.fillRect(0, 0, n, n);
    blotches(g, n, 60, 10, 50, a => `rgba(${a > 0.5 ? '255,255,255' : '160,150,140'},${0.04 + a * 0.04})`);
    g.strokeStyle = 'rgba(170,162,152,0.4)'; g.lineWidth = 1.4; for (let i = 0; i <= 2; i++) { g.beginPath(); g.moveTo(0, i * n / 2); g.lineTo(n, i * n / 2); g.stroke(); }
    g.beginPath(); g.moveTo(0, 0); g.lineTo(0, n); g.stroke();
  }), 1);   // 300 x 600 wall tile, stack bond (one texture tile = 0.6 x 0.6 m)
  const BATH_PORTRAIT = false;   // photo wall tile: false keeps the drawn landscape lay (600 along, 300 up); true stands it portrait
  for (const fl of [0, 1]) {
    const walls = (fl ? D.ff : D.gf).filter(inZone), opens = (fl ? D.ff_open : D.gf_open).filter(o => inZone(o.r)), y0 = fl ? FF_BASE : 0;
    const solid = [...walls, ...opens.filter(o => o.r[0] * o.r[2] >= 0).map(o => o.r)];   // windows and doors close the room too (not beam lines across the party wall)
    const ray = (x, z, dx, dz) => { let best = 6; for (const q of solid) { const x0 = Math.min(q[0], q[2]), x1 = Math.max(q[0], q[2]), z0 = Math.min(q[1], q[3]), z1 = Math.max(q[1], q[3]);
      if (dx) { if (z < z0 || z > z1) continue; const d = dx > 0 ? x0 - x : x - x1; if (d > -0.01 && d < best) best = Math.max(d, 0); }
      else { if (x < x0 || x > x1) continue; const d = dz > 0 ? z0 - z : z - z1; if (d > -0.01 && d < best) best = Math.max(d, 0); } } return best; };
    const inWall = (x, z) => solid.some(q => x > Math.min(q[0], q[2]) - 0.01 && x < Math.max(q[0], q[2]) + 0.01 && z > Math.min(q[1], q[3]) - 0.01 && z < Math.max(q[1], q[3]) + 0.01);
    // The bathroom boxes: one from each room label, plus one from each basin / WC / shower, so a bathroom split by a
    // ledge or a nib is covered end to end. A box that contains an earlier one replaces it; one mostly inside is skipped.
    const todo = [], area = b => (b[2] - b[0]) * (b[3] - b[1]);
    const inter = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
    const boxAt = (x, z) => Object.assign([x - ray(x, z, -1, 0), z - ray(x, z, 0, -1), x + ray(x, z, 1, 0), z + ray(x, z, 0, 1)], { seed: [x, z] });
    const okBox = b => b[2] - b[0] >= 0.6 && b[3] - b[1] >= 0.6 && b[2] - b[0] <= 5 && b[3] - b[1] <= 5;
    const addBox = b => {
      if (!okBox(b)) return;
      for (let i = 0; i < todo.length; i++) {
        const a = todo[i];
        if (b[0] <= a[0] + 0.02 && b[1] <= a[1] + 0.02 && b[2] >= a[2] - 0.02 && b[3] >= a[3] - 0.02) { todo[i] = b; return; }   // contains it: use the bigger one
        if (inter(a, b) > 0.5 * area(b)) return;                                                                           // mostly the same room
      }
      todo.push(b);
    };
    for (const l of D.labels.filter(l => (l.floor || 0) === fl && /BILIK AIR|BEDAK/.test(l.t) && (SEMID ? l.x < 0 : true))) {
      // A label that sits on a wall line is nudged into the smallest room beside it.
      const probes = inWall(l.x, l.z) ? [[0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]].map(([dx, dz]) => [l.x + dx, l.z + dz]).filter(([x, z]) => !inWall(x, z)) : [[l.x, l.z]];
      const boxes = probes.map(([x, z]) => boxAt(x, z)).filter(okBox).filter(b => !todo.some(a => inter(a, b) > 0.5 * area(b))).sort((u, v) => area(u) - area(v));
      if (boxes.length) addBox(boxes[0]);
    }
    for (const f of (SEMID ? SD_FURN : FURN).filter(f => (f.floor || 0) === fl && /^(basin|wc|shower|vanity)$/.test(f.kind) && /BILIK AIR|BEDAK/.test(f.room || '') && f.x0 != null)) {
      let x = (f.x0 + f.x1) / 2, z = (f.z0 + f.z1) / 2;
      if (SEMID && x >= 0) continue;
      if (f.back) { const d = 0.35; if (f.back === '-x') x = Math.max(f.x0, f.x1) + 0.05; else if (f.back === '+x') x = Math.min(f.x0, f.x1) - 0.05; else if (f.back === '-z') z = Math.max(f.z0, f.z1) + 0.05; else z = Math.min(f.z0, f.z1) - 0.05; void d; }
      if (inWall(x, z)) continue;
      addBox(boxAt(x, z));
    }
    // Floor-to-ceiling tiles: the clear height of the ceiling over that bathroom.
    const ceilAt = (x, z) => {
      if (SEMID) return fl ? (Math.abs(x) < 1.615 && z > -10.466 && z < -2.789 ? 7.0 : 7.2) - FF_BASE : GF_TOP;
      const c = ((X.ceilings && X.ceilings[fl ? 'FF' : 'GF']) || []).find(c => typeof c.ceiling === 'number' && x > c.r[0] && x < c.r[2] && z > c.r[1] && z < c.r[3]);
      return c ? c.ceiling - (fl ? FF_BASE : 0) : (fl ? 3.3 : GF_TOP);
    };
    // Each box grows into the room's true outline (a flood over a grid cut at every wall edge), so short returns, nibs
    // and the faces beside doors are tiled too. A room that runs more than 1 m past its box keeps the box.
    const inR = (q, x, z, e = 0) => x > Math.min(q[0], q[2]) - e && x < Math.max(q[0], q[2]) + e && z > Math.min(q[1], q[3]) - e && z < Math.max(q[1], q[3]) + e;
    const cellOf = (a, v) => a.findIndex((p, k) => k < a.length - 1 && v > p && v < a[k + 1]);
    const roomOf = b => {
      const L = [b[0] - 1, b[1] - 1, b[2] + 1, b[3] + 1];
      const cut = (k, lo, hi) => [...new Set([lo, hi, ...solid.flatMap(q => [q[k], q[k + 2]]).filter(v => v > lo && v < hi).map(v => Math.round(v * 1e4) / 1e4)])].sort((p, q) => p - q);
      const xs = cut(0, L[0], L[2]), zs = cut(1, L[1], L[3]), cells = new Set();
      const free = (i, j) => !solid.some(q => inR(q, (xs[i] + xs[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2, 0.01));
      const st = [b.seed || [], [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]].map(([x, z]) => [cellOf(xs, x), cellOf(zs, z)]).filter(([i, j]) => i >= 0 && j >= 0 && free(i, j)).slice(0, 1);
      let leak = !st.length;
      while (st.length && !leak) {
        const [i, j] = st.pop(), k = i + ',' + j;
        if (cells.has(k) || !free(i, j)) continue;
        if (i === 0 || j === 0 || i === xs.length - 2 || j === zs.length - 2) leak = true;
        cells.add(k); st.push([i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]);
      }
      return leak ? { xs: [b[0], b[2]], zs: [b[1], b[3]], cells: new Set(['0,0']) } : { xs, zs, cells };
    };
    const inRoom = (R, x, z) => R.cells.has(cellOf(R.xs, x) + ',' + cellOf(R.zs, z));
    // What stands behind a face at one point along it: the height bands left open right through (a doorway, the true
    // window from the schedule), and how deep the frame sits. A shallow recess backed by a wall counts as solid.
    const holesAt = (ax, c, n, am) => {
      let open = [[0, 99]], d = 0.004, dep = 0, hit = false;
      for (let k = 0; k < 6 && d < 0.8; k++) {
        const x = ax === 'x' ? am : c - n * d, z = ax === 'x' ? c - n * d : am;
        if (walls.some(q => inR(q, x, z))) return { open: [], dep };
        const o = opens.find(o => o.r[0] * o.r[2] >= 0 && inR(o.r, x, z));
        if (!o) break;
        hit = true;
        const r = o.r, oax = wallAxis(r), q0 = ax === 'x' ? Math.min(r[1], r[3]) : Math.min(r[0], r[2]), q1 = ax === 'x' ? Math.max(r[1], r[3]) : Math.max(r[0], r[2]);
        let band;
        if (oax) {   // an outside wall gap is filled in except where the schedule has a window or door (as refillGap builds it)
          const mid = oax === 'x' ? (r[1] + r[3]) / 2 : (r[0] + r[2]) / 2, A0 = oax === 'x' ? Math.min(r[0], r[2]) : Math.min(r[1], r[3]), A1 = oax === 'x' ? Math.max(r[0], r[2]) : Math.max(r[1], r[3]), aa = oax === 'x' ? x : z;
          band = X.openings.filter(s => s.floor === fl && s.axis === oax && Math.abs((s.c0 + s.c1) / 2 - mid) < 0.12 && s.a1 > A0 + 0.02 && s.a0 < A1 - 0.02 && aa > s.a0 && aa < s.a1).map(s => [s.sill - y0, s.head - y0]);
        } else band = [[o.win ? o.sill || 0 : 0, o.head || 2.1]];   // inside wall: lintel over the head, wall under a window sill
        open = open.flatMap(([a, b]) => band.map(([p, q]) => [Math.max(a, p), Math.min(b, q)])).filter(([a, b]) => b - a > 0.01);
        if (!open.length) return { open, dep };
        dep = Math.abs((q0 + q1) / 2 - c);
        d = (n > 0 ? c - q0 : q1 - c) + 0.004;
      }
      return { open: hit ? open : [], dep };
    };
    const rooms = [];
    for (const b of todo) {
      const pts = [b.seed, [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]].filter(Boolean);
      if (rooms.some(R => pts.some(([x, z]) => inRoom(R, x, z)))) continue;   // the same room from another box: tiled once
      const R = roomOf(b); rooms.push(R);
      const { xs, zs, cells } = R, has = (i, j) => cells.has(i + ',' + j), parent = fl ? ffDetail : gfDetail;
      const ch = ceilAt((b[0] + b[2]) / 2, (b[1] + b[3]) / 2) - 0.01;
      // porcelain floor: each run of cells along a row, merged down the rows while the run stays the same
      const strips = []; let prev = new Map();
      for (let j = 0; j < zs.length - 1; j++) {
        const next = new Map();
        for (let i = 0; i < xs.length - 1; i++) if (has(i, j) && !has(i - 1, j)) {
          let e = i; while (has(e + 1, j)) e++;
          const key = i + ',' + e; let s = prev.get(key);
          if (!s) { s = [xs[i], zs[j], xs[e + 1], zs[j + 1]]; strips.push(s); }
          s[3] = zs[j + 1]; next.set(key, s);
        }
        prev = next;
      }
      for (const [x0, z0, x1, z1] of strips) {
        const t = bathTile.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set((x1 - x0) / 1.2, (z1 - z0) / 2.4); t.offset.set(((x0 / 1.2) % 1 + 1) % 1, ((-z1 / 2.4) % 1 + 1) % 1);
        const fm = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 }));
        hd.use(fm.material, 'bath_wall_tile', { su: x1 - x0, sv: z1 - z0, ou: x0, ov: -z1 });   // 300 (x) by 600 (z), on the same world grid
        fm.rotation.x = -Math.PI / 2; fm.position.set((x0 + x1) / 2, y0 + 0.007, (z0 + z1) / 2); fm.receiveShadow = true; parent.add(fm);
      }
      // grout locked to the wall: every panel's texture starts on the same 0.6 m grid (along the wall, and up from the
      // floor), so joints run straight across doors and corners
      const plane = (w, h, ox, oy, x, y, z, rx, ry) => {
        const tt = wallTileTex.clone(); tt.needsUpdate = true; tt.wrapS = tt.wrapT = THREE.RepeatWrapping; tt.repeat.set(w / 0.6, h / 0.6);
        tt.offset.set(((ox / 0.6) % 1 + 1) % 1, ((oy / 0.6) % 1 + 1) % 1);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tt, roughness: 0.35 }));
        hd.use(m.material, 'bath_wall_tile', { su: w, sv: h, ou: ox, ov: oy, rot: BATH_PORTRAIT ? 0 : 90 });   // same 0.6 m grid from the floor
        m.position.set(x, y, z); m.rotation.order = 'YXZ'; m.rotation.set(rx, ry, 0); m.receiveShadow = true; parent.add(m);
      };
      // every face round the room's outline, joined into runs along each wall line
      const lines = new Map(), edge = (ax, c, n, a0, a1) => { const k = ax + ',' + c + ',' + n; if (!lines.has(k)) lines.set(k, []); lines.get(k).push([a0, a1]); };
      for (const k of cells) {
        const [i, j] = k.split(',').map(Number);
        if (!has(i, j - 1)) edge('x', zs[j], 1, xs[i], xs[i + 1]);
        if (!has(i, j + 1)) edge('x', zs[j + 1], -1, xs[i], xs[i + 1]);
        if (!has(i - 1, j)) edge('z', xs[i], 1, zs[j], zs[j + 1]);
        if (!has(i + 1, j)) edge('z', xs[i + 1], -1, zs[j], zs[j + 1]);
      }
      for (const [k, spans] of lines) {
        const [ax, cs, ns] = k.split(','), c = +cs, n = +ns, nx = ax === 'z' ? n : 0, nz = ax === 'x' ? n : 0;
        const runs = [];
        for (const s of spans.sort((p, q) => p[0] - q[0])) { const r = runs[runs.length - 1]; if (r && s[0] <= r[1] + 1e-6) r[1] = Math.max(r[1], s[1]); else runs.push([...s]); }
        for (const [a0, a1] of runs) {
          // split the run wherever what stands behind it changes: wall and opening ends, and the schedule's own jambs
          const ks = [...new Set([a0, a1, ...solid.flatMap(q => ax === 'x' ? [q[0], q[2]] : [q[1], q[3]]), ...X.openings.filter(s => s.floor === fl && s.axis === ax).flatMap(s => [s.a0, s.a1])].filter(v => v >= a0 && v <= a1))].sort((p, q) => p - q)
            .filter((v, m, all) => m === 0 || v - all[m - 1] > 0.003);   // drop near-duplicate ends (a schedule jamb 1 mm off a wall end)
          ks[ks.length - 1] = a1;
          const parts = [];
          for (let m = 0; m < ks.length - 1; m++) {
            const u = ks[m], v = ks[m + 1];
            const H = holesAt(ax, c, n, (u + v) / 2), open = H.open.map(([lo, hi]) => [lo < 0.05 ? 0 : lo, hi]).sort((p, q) => p[0] - q[0]), bands = [];
            let cur = 0;
            for (const [lo, hi] of open) { if (lo > cur + 0.02) bands.push([cur, Math.min(lo, ch)]); cur = Math.max(cur, hi); }
            if (ch > cur + 0.02) bands.push([cur, ch]);
            const key = bands.map(q => q.map(y => y.toFixed(3)).join('-')).join() + '|' + (open.length ? H.dep : 0).toFixed(3), p = parts[parts.length - 1];
            if (p && p.key === key && Math.abs(p.v - u) < 1e-6) p.v = v; else parts.push({ u, v, key, bands, open, dep: H.dep });
          }
          const solidOver = (q, lo, hi) => q && q.bands.some(([a, b]) => a <= lo + 0.01 && b >= hi - 0.01);
          parts.forEach((p, m) => {
            const { u, v } = p, w = v - u, am = (u + v) / 2, left = (ax === 'x' ? nz > 0 : nx < 0) ? u : -v;   // the plane's local +x runs along +a or -a
            for (const [yb, yt] of p.bands) {
              const h = yt - yb; if (h < 0.02) continue;
              if (ax === 'x') plane(w, h, left, yb, am, y0 + yb + h / 2, c + nz * 0.004, 0, Math.atan2(nx, nz));
              else plane(w, h, left, yb, c + nx * 0.004, y0 + yb + h / 2, am, 0, Math.atan2(nx, nz));
            }
            // a window: tile its reveals too (sill, head and both jambs, back to the frame)
            const dp = p.dep - 0.035 + 0.004, cm = c + n * 0.004 - n * dp / 2;
            if (dp > 0.015 && dp < 0.5) for (const [lo, hi0] of p.open) {
              const hi = Math.min(hi0, ch); if (lo < 0.3 || hi - lo < 0.05) continue;
              for (const [y, rx] of [[lo + 0.003, -Math.PI / 2], [hi - 0.003, Math.PI / 2]]) {
                if (rx > 0 && hi > ch - 0.02) continue;
                if (ax === 'x') plane(w, dp, u, 0, am, y0 + y, cm, rx, 0); else plane(w, dp, u, 0, cm, y0 + y, am, rx, -Math.PI / 2);   // local +x runs along +a, so grout matches the wall
              }
              for (const [a, s, q] of [[u, 1, parts[m - 1]], [v, -1, parts[m + 1]]]) {
                if (!solidOver(q, lo, hi)) continue;
                const rnx = ax === 'x' ? s : 0, rnz = ax === 'x' ? 0 : s;
                if (ax === 'x') plane(dp, hi - lo, 0, lo, a + s * 0.003, y0 + (lo + hi) / 2, cm, 0, Math.atan2(rnx, rnz));
                else plane(dp, hi - lo, 0, lo, cm, y0 + (lo + hi) / 2, a + s * 0.003, 0, Math.atan2(rnx, rnz));
              }
            }
          });
        }
      }
    }
  }
}

// Windows on the plan with no schedule entry (the bungalow powder-room vent): a white-framed frosted glass louvre (nako).
{
  const mFrost = new THREE.MeshStandardMaterial({ color: 0xEEF2F2, roughness: 0.25, transparent: true, opacity: 0.6 });
  const scheduled = (fl, r) => { const cx = (r[0] + r[2]) / 2, cz = (r[1] + r[3]) / 2; return X.openings.some(o => o.floor === fl && (o.axis === 'x' ? cx > o.a0 - 0.05 && cx < o.a1 + 0.05 && cz > Math.min(o.c0, o.c1) - 0.1 && cz < Math.max(o.c0, o.c1) + 0.1 : cz > o.a0 - 0.05 && cz < o.a1 + 0.05 && cx > Math.min(o.c0, o.c1) - 0.1 && cx < Math.max(o.c0, o.c1) + 0.1)); };
  for (const [fl, list, parent] of [[0, D.gf_open, gfDetail], [1, D.ff_open, ffDetail]]) for (const o of list.filter(o => o.win && inZone(o.r) && !scheduled(fl, o.r))) {
    const r = o.r, ax = Math.abs(r[2] - r[0]) > Math.abs(r[3] - r[1]) ? 'x' : 'z', a0 = ax === 'x' ? Math.min(r[0], r[2]) : Math.min(r[1], r[3]), a1 = ax === 'x' ? Math.max(r[0], r[2]) : Math.max(r[1], r[3]);
    const cm = ax === 'x' ? (r[1] + r[3]) / 2 : (r[0] + r[2]) / 2, base = fl ? FF_BASE : 0, y0 = base + (o.sill || 0), y1 = base + o.head, fw = 0.04;
    for (const [u, v] of [[a0, a0 + fw], [a1 - fw, a1]]) block(rectAlong(ax, u, v, cm - 0.035, cm + 0.035), y0, y1 - y0, mFrame, parent, null);
    for (const y of [y0, y1 - fw]) block(rectAlong(ax, a0, a1, cm - 0.035, cm + 0.035), y, fw, mFrame, parent, null);
    for (let y = y0 + fw + 0.05; y < y1 - fw - 0.03; y += 0.1) {   // glass blades, tilted open
      const b = new THREE.Mesh(new THREE.BoxGeometry(ax === 'x' ? a1 - a0 - 2 * fw : 0.1, 0.005, ax === 'x' ? 0.1 : a1 - a0 - 2 * fw), mFrost);
      b.position.set(ax === 'x' ? (a0 + a1) / 2 : cm, y, ax === 'x' ? cm : (a0 + a1) / 2); if (ax === 'x') b.rotation.x = 0.45; else b.rotation.z = 0.45; parent.add(b);
    }
  }
}
// Italian (venetian) louvre blinds, owner request Nov 2026: slim oak-tone slats tilted half open on every bedroom
// window (not the sliding doors), on the room side of the frame.
{
  // Light-oak basswood slats (Japandi, owner Nov 2026; was walnut): satin, each slat a shade apart like real timber, linen tapes.
  const mSlat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.48 }), mRail = new THREE.MeshStandardMaterial({ color: 0xB59870, roughness: 0.45 });
  const mTape = new THREE.MeshStandardMaterial({ color: 0xD8CBB4, roughness: 0.85 }), slatBase = new THREE.Color(0xC9AE88), slatC = new THREE.Color();
  for (const [fl, list, parent] of [[0, D.gf_open, gfDetail], [1, D.ff_open, ffDetail]]) {
    const walls = (fl ? D.ff : D.gf).filter(inZone), base = fl ? FF_BASE : 0;
    const solid = [...walls, ...list.filter(o => inZone(o.r) && o.r[0] * o.r[2] >= 0).map(o => o.r)];
    const ray = (x, z, dx, dz) => { let best = 8; for (const q of solid) { const x0 = Math.min(q[0], q[2]), x1 = Math.max(q[0], q[2]), z0 = Math.min(q[1], q[3]), z1 = Math.max(q[1], q[3]);
      if (dx) { if (z < z0 || z > z1) continue; const d = dx > 0 ? x0 - x : x - x1; if (d > -0.01 && d < best) best = Math.max(d, 0); } else { if (x < x0 || x > x1) continue; const d = dz > 0 ? z0 - z : z - z1; if (d > -0.01 && d < best) best = Math.max(d, 0); } } return best; };
    // the window schedule has the true sills (absolute heights): bedroom windows with a sill 0.3..1.3 m off the floor
    for (const o of X.openings.filter(o => o.floor === fl && o.kind === 'window' && o.sill - base >= 0.3 && o.sill - base <= 1.3 && o.head - o.sill > 0.5 && !(o.sill - base <= 0.5 && o.head - o.sill >= 2.0) && (SEMID ? o.a1 <= 0.01 || o.axis === 'z' && Math.min(o.c0, o.c1) < 0 : true))) {
      const ax = o.axis, a0 = o.a0, a1 = o.a1, r = ax === 'x' ? [a0, o.c0, a1, o.c1] : [o.c0, a0, o.c1, a1];
      if (a1 - a0 < 0.5) continue;
      const c0 = ax === 'x' ? Math.min(r[1], r[3]) : Math.min(r[0], r[2]), c1 = ax === 'x' ? Math.max(r[1], r[3]) : Math.max(r[0], r[2]), am = (a0 + a1) / 2;
      // which side is the room: the side whose box holds a bedroom label
      let side = 0, label = '';
      for (const sg of [1, -1]) {
        const c = sg > 0 ? c1 + 0.4 : c0 - 0.4, px = ax === 'x' ? am : c, pz = ax === 'x' ? c : am;
        // (the Semi-D's party wall is not in this unit's wall list: the room box stops at it, x = 0)
        const bx0 = px - ray(px, pz, -1, 0), bx1 = Math.min(px + ray(px, pz, 1, 0), SEMID ? 0 : Infinity), bz0 = pz - ray(px, pz, 0, -1), bz1 = pz + ray(px, pz, 0, 1);
        if (bx1 - bx0 > 7.5 || bz1 - bz0 > 7.5) continue;
        // the room's label: inside the box, or (labels are often set right on a wall line) within 0.6 m of it
        const near = (l, m) => l.x > bx0 - m && l.x < bx1 + m && l.z > bz0 - m && l.z < bz1 + m;
        const beds = D.labels.filter(l => (l.floor || 0) === fl && /BILIK TIDUR/.test(l.t)), l = beds.find(l => near(l, 0)) || beds.find(l => near(l, 0.6));
        if (l) { side = sg; label = l.t; }
      }
      // upstairs, every window low enough for a blind is a bedroom's (both homes): if the room couldn't be read off the
      // plan (a nib or a wardrobe wall in the way), the blind goes on the inside face
      if (!side && fl === 1) side = (ax === 'x' ? HCZ : HCX) > (c0 + c1) / 2 ? 1 : -1;
      if (!side) continue;
      const face = side > 0 ? c1 + 0.03 : c0 - 0.03, y0 = o.sill, y1 = o.head, w = a1 - a0 - 0.06;
      const n = Math.floor((y1 - y0 - 0.06) / 0.022), g = new THREE.BoxGeometry(ax === 'x' ? w : 0.025, 0.0025, ax === 'x' ? 0.025 : w);
      const im = new THREE.InstancedMesh(g, mSlat, n), M4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(ax === 'x' ? V(1, 0, 0) : V(0, 0, 1), 0.7);
      for (let i = 0; i < n; i++) {
        M4.compose(ax === 'x' ? V(am, y1 - 0.06 - i * 0.022, face) : V(face, y1 - 0.06 - i * 0.022, am), q, V(1, 1, 1)); im.setMatrixAt(i, M4);
        const k = ((i * 37 + Math.round(am * 100)) % 9) / 9 - 0.5; im.setColorAt(i, slatC.copy(slatBase).offsetHSL(k * 0.012, k * 0.05, k * 0.035));
      }
      im.castShadow = true; parent.add(im);
      for (const f of [0.22, 0.78]) for (const d of [-0.016, 0.016]) {   // ladder tapes, front and back of the slats
        const ta = a0 + 0.03 + w * f; block(rectAlong(ax, ta - 0.011, ta + 0.011, face + d - 0.0008, face + d + 0.0008), y0 + 0.02, y1 - y0 - 0.06, mTape, parent, null);
      }
      block(rectAlong(ax, a0 + 0.02, a1 - 0.02, face - 0.025, face + 0.025), y1 - 0.045, 0.045, mRail, parent, null);   // head rail
      block(rectAlong(ax, a0 + 0.03, a1 - 0.03, face - 0.015, face + 0.015), y0 + 0.005, 0.02, mRail, parent, null);    // bottom rail
    }
  }
}
if (LIB) await Y();   // embedded build: let the hero draw a frame
// ---- the stair: concrete, 21 risers of 176 mm, quarter landing at +2.816, finished in SPC (mirrored for the right unit) ----
// Owner (Nov 2026, both homes): "the risers are wall colour, the steps are spc". Each tread is a 35 mm SPC board with a
// 20 mm nosing over the riser; risers, sides and soffits are plastered. A plastered string 12 mm proud runs along each
// wall and any open side, 65 mm above the nosing line, so the steps meet the wall on one clean line.
const stairTex = spcTexture();                                   // tread UVs are set in plank metres below
const mStairTop = new THREE.MeshStandardMaterial({ map: stairTex, roughness: 0.55 });
LIFT_MATS.push(mStairTop); hd.use(mStairTop, 'spc_oak', { su: 1.22, sv: 1.08 });   // tread uvs are in drawn-plank units (1.22 x 1.08 m)
const mNosing = new THREE.MeshStandardMaterial({ color: 0xC4A880, roughness: 0.55 });   // board edges, a shade darker than the face
const mTread = [mNosing, mNosing, mStairTop, mNosing, mNosing, mNosing];
const TREAD_T = 0.035, NOSE = 0.02;
const STAIR = (() => {
  const RISE = X.stair.riser || 0.176, UP = 0.065, DN = RISE + 0.045, OUT = 0.012;   // DN: below the nosing line, past the back of each 35 mm board
  const steps = X.stair.steps.map(st => ({ top: st.top, land: st.flight === 'landing', flight: st.flight, solid: SOLID_STEP(st),
    x0: Math.min(st.r[0], st.r[2]), x1: Math.max(st.r[0], st.r[2]), z0: Math.min(st.r[1], st.r[3]), z1: Math.max(st.r[1], st.r[3]) }));
  const ovl = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0);
  const touch = (c, o) => {   // the side of step c that meets step o
    if (!o) return null;
    if (ovl(c.z0, c.z1, o.z0, o.z1) > 0.05) { if (Math.abs(c.x0 - o.x1) < 0.02) return '-x'; if (Math.abs(c.x1 - o.x0) < 0.02) return '+x'; }
    if (ovl(c.x0, c.x1, o.x0, o.x1) > 0.05) { if (Math.abs(c.z0 - o.z1) < 0.02) return '-z'; if (Math.abs(c.z1 - o.z0) < 0.02) return '+z'; }
    return null;
  };
  const opp = s => s && (s[0] === '-' ? '+' : '-') + s[1];
  const edge = (c, s) => s === '-x' ? c.x0 : s === '+x' ? c.x1 : s === '-z' ? c.z0 : c.z1;
  steps.forEach((c, i) => {
    const prev = steps[i - 1], next = steps[i + 1], tp = touch(c, prev), tn = touch(c, next);
    c.front = tp || opp(tn); c.prev = tp ? prev : null; c.tn = tn;
    c.rise = tn ? next.top - c.top : (FF_BASE - c.top > 0.1 && FF_BASE - c.top < 0.25 ? FF_BASE - c.top : RISE);
    if (!c.land && c.front) {   // the nosing line over this tread: at the tread on its front edge, one riser up at the back
      c.aF = edge(c, c.front); c.aB = edge(c, opp(c.front));
      c.nl = a => c.top + c.rise * (a - c.aF) / (c.aB - c.aF);
    }
  });
  // Walls beside the stair (left unit). A wall that only ends against a step edge doesn't count.
  const X0 = q => Math.min(q[0], q[2]), X1 = q => Math.max(q[0], q[2]), Z0 = q => Math.min(q[1], q[3]), Z1 = q => Math.max(q[1], q[3]);
  const parallel = (q, s) => s[1] === 'x' ? Z1(q) - Z0(q) >= X1(q) - X0(q) : X1(q) - X0(q) >= Z1(q) - Z0(q);
  const along = (q, s) => s[1] === 'x' ? [Z0(q), Z1(q)] : [X0(q), X1(q)];
  const face = (q, s) => s === '+x' ? X0(q) : s === '-x' ? X1(q) : s === '+z' ? Z0(q) : Z1(q);
  const gfW = [
    ...D.gf.filter(inZone).filter(r => !isStringer(r) && !(SEMID && ARTEFACTS.includes(rkey(r)))).map(r => { const wt = WALL_TOPS.find(w => rkey(w.r) === rkey(r)); return { r, top: wt ? a => profAt(wt.prof, a) : () => GF_TOP }; }),
    ...(D.gf_open || []).filter(o => o.win && inZone(o.r)).map(o => ({ r: o.r, top: () => o.sill })),   // wall below a window sill
  ];
  const ffW = D.ff.filter(inZone).map(r => ({ r }));
  const nearW = [...gfW.map(q => q.r), ...(X.stair.inner_walls || []).map(w => w.r)];
  const abut = (list, s, e) => list.filter(q => parallel(q.r, s) && Math.abs(face(q.r, s) - e) < 0.03);
  const frac = (spans, a0, a1) => spans.reduce((t, [u, v]) => t + Math.max(0, ovl(u, v, a0, a1)), 0) / (a1 - a0);
  const kindOf = (c, s) => {   // 'wall', 'open', or null where a stringer wall already stands
    const e = edge(c, s), A = s[1] === 'x' ? [c.z0, c.z1] : [c.x0, c.x1];
    if (frac(abut(gfW, s, e).map(q => along(q.r, s)), A[0], A[1]) >= 0.5) return 'wall';
    const near = nearW.filter(q => parallel(q, s) && (s[1] === 'x' ? X0(q) < e + 0.13 && X1(q) > e - 0.13 : Z0(q) < e + 0.13 && Z1(q) > e - 0.13));
    return frac(near.map(q => along(q, s)), A[0], A[1]) >= 0.5 ? null : 'open';
  };
  const lines = new Map();
  const seg = (s, e, kind, a0, a1, f) => {
    const k = `${s}|${e.toFixed(3)}|${kind}`;
    if (!lines.has(k)) lines.set(k, { s, e, kind, segs: [] });
    lines.get(k).segs.push({ a0: Math.min(a0, a1), a1: Math.max(a0, a1), f });
  };
  for (const c of steps) {
    if (!c.front) continue;
    const sides = c.land ? ['-x', '+x', '-z', '+z'].filter(s => s !== c.front && s !== c.tn) : (c.front[1] === 'z' ? ['-x', '+x'] : ['-z', '+z']);
    for (const s of sides) {
      const kind = kindOf(c, s); if (!kind) continue;
      const e = edge(c, s), A = s[1] === 'x' ? [c.z0, c.z1] : [c.x0, c.x1];
      if (c.land) { const dn = kind === 'wall' ? 0.02 : c.solid ? DN : 0.17; seg(s, e, kind, A[0], A[1], () => [c.top - dn, c.top + UP]); continue; }
      const dn = kind === 'wall' || c.solid ? DN : RISE + 0.215;   // an open string on a slab flight covers its soffit
      seg(s, e, kind, c.aF, c.aB, a => { const n = c.nl(a); return [n - dn, n + UP]; });
      if ((!c.prev || c.prev.land) && (kind === 'wall' || (c.prev && lines.has(`${s}|${e.toFixed(3)}|open`)))) {   // ease down onto the floor or landing below
        const lo = c.prev ? c.prev.top - (kind === 'open' && !c.prev.solid ? 0.17 : 0.02) : 0;
        seg(s, e, kind, 2 * c.aF - c.aB, c.aF, a => { const n = c.nl(a); return [Math.max(n - dn, lo), n + UP]; });
      }
    }
  }
  const bands = [];
  for (const L of lines.values()) {
    const ws = L.kind === 'wall' ? abut(gfW, L.s, L.e) : [], fs = L.kind === 'wall' ? abut(ffW, L.s, L.e) : [];
    const on = (q, a) => { const [u, v] = along(q.r, L.s); return a > u - 0.005 && a < v + 0.005; };
    const wallTop = a => {   // the string stops where the wall does (over a window sill, at a wall top beside the well)
      if (L.kind !== 'wall') return Infinity;
      let t = -Infinity; for (const q of ws) if (on(q, a)) t = Math.max(t, q.top(a));
      return t >= GF_TOP - 0.01 && fs.some(q => on(q, a)) ? Infinity : t;
    };
    const as = new Set();
    for (const g of L.segs) { for (const a of [g.a0, g.a0 + 1e-4, g.a1 - 1e-4, g.a1]) as.add(+a.toFixed(5)); for (let a = g.a0 + 0.05; a < g.a1 - 0.01; a += 0.05) as.add(+a.toFixed(5)); }
    const runs = []; let cur = [];
    for (const a of [...as].sort((p, q) => p - q)) {
      let top = -Infinity, bot = Infinity;
      for (const g of L.segs) if (a >= g.a0 - 0.006 && a <= g.a1 + 0.006) { const [b, t] = g.f(a); top = Math.max(top, t); bot = Math.min(bot, b); }
      top = Math.min(top, wallTop(a), FF_BASE); bot = Math.max(bot, 0);   // flush with the first floor at the stair head
      if (top - bot > 0.005) cur.push([a, bot, top]); else if (cur.length) { runs.push(cur); cur = []; }
    }
    if (cur.length) runs.push(cur);
    const dir = (L.s[0] === '+' ? 1 : -1) * (L.kind === 'wall' ? -1 : 1);   // on the stair side of a wall, outside an open edge
    const [c0, c1] = dir > 0 ? [L.e, L.e + OUT] : [L.e - OUT, L.e];
    for (const run of runs) if (run.length > 1) bands.push({ ax: L.s[1] === 'x' ? 'z' : 'x', c0, c1, pts: [...run.map(([a, , t]) => [a, t]), ...run.reverse().map(([a, b]) => [a, b])] });
  }
  // Under the slab flights: one straight plastered soffit instead of a saw-tooth of step ends.
  for (let i = 0; i < steps.length; i++) {
    const c = steps[i]; if (c.land || c.solid || !c.nl) continue;
    let j = i; while (steps[j + 1] && !steps[j + 1].land && !steps[j + 1].solid && steps[j + 1].flight === c.flight && steps[j + 1].front === c.front) j++;
    const d = steps[j], y0 = c.top - 0.2, y1 = d.top + d.rise - 0.2;
    const [c0, c1] = c.front[1] === 'z' ? [c.x0 + 0.002, c.x1 - 0.002] : [c.z0 + 0.002, c.z1 - 0.002];
    bands.push({ ax: c.front[1], c0, c1, pts: [[c.aF, y0], [d.aB, y1], [d.aB, y1 - RISE], [c.aF, y0 - RISE]] });
    i = j;
  }
  return { steps, bands };
})();
// A plastered extrusion of an [along, y] outline between two cross-axis lines (mirrored for the right unit).
function stairBand(ax, c0, c1, pts, sgn) {
  if (sgn < 0) { if (ax === 'x') pts = pts.map(([a, y]) => [-a, y]); else [c0, c1] = [-c1, -c0]; }
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([a, y]) => new THREE.Vector2(a, y))), { depth: c1 - c0, bevelEnabled: false });
  const m = new THREE.Mesh(g, mWall);
  if (ax === 'x') m.position.set(0, 0, c0); else { m.rotation.y = -Math.PI / 2; m.position.set(c1, 0, 0); }
  m.castShadow = m.receiveShadow = true; gfDetail.add(m); return m;
}
for (const sgn of SEMID ? [1, -1] : [1]) {
  STAIR.steps.forEach((c, i) => {
    const r = [sgn * c.x0, c.z0, sgn * c.x1, c.z1];
    if (c.solid) gfWall(r, 0, c.top - TREAD_T, mWall, mInk);                                   // solid to the floor (enclosed below)
    else { const th = c.land ? 0.15 : 0.2; gfWall(r, c.top - th, th - TREAD_T, mWall, mInk); }   // slab flights and landings
    // the SPC board, 20 mm over the riser below; planks run across the flight
    let { x0, z0, x1, z1 } = c;
    if (c.front === '-x') x0 -= NOSE; else if (c.front === '+x') x1 += NOSE; else if (c.front === '-z') z0 -= NOSE; else if (c.front === '+z') z1 += NOSE;
    const m = gfWall([sgn * x0, z0, sgn * x1, z1], c.top - TREAD_T, TREAD_T, mTread, mInk);
    const wx = x1 - x0, wz = z1 - z0, alongX = c.land || !c.front ? wx >= wz : c.front[1] === 'z';
    const g = BOX.clone(), uv = g.attributes.uv, ox = (i * 0.37) % 1, oy = (i * 0.61) % 1;
    for (let k = 8; k < 12; k++) { const u = uv.getX(k), v = uv.getY(k); uv.setXY(k, (alongX ? u * wx : v * wz) / 1.22 + ox, (alongX ? v * wz : u * wx) / 1.08 + oy); }   // top face only
    m.geometry = g;
  });
  for (const b of STAIR.bands) stairBand(b.ax, b.c0, b.c1, b.pts, sgn);
  // Mild-steel balustrade: oak handrail on satin-black square balusters at about 125 mm, two per tread.
  const tube = (a, b, rad = 0.022, mat = mOakRail) => {
    const A = V(sgn * a[0], a[1], a[2]), B = V(sgn * b[0], b[1], b[2]), L = A.distanceTo(B);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, L, 16), mat); m.castShadow = true;
    m.position.copy(A).lerp(B, 0.5); m.quaternion.setFromUnitVectors(V(0, 1, 0), B.clone().sub(A).normalize());
    gfDetail.add(m);
  };
  const support = (x, z, yRail) => {   // what a baluster stands on: the tread under it, else the floor
    let top = null;
    for (const st of X.stair.steps) { const r = st.r; if (x > Math.min(r[0], r[2]) - 0.13 && x < Math.max(r[0], r[2]) + 0.13 && z > Math.min(r[1], r[3]) - 0.01 && z < Math.max(r[1], r[3]) + 0.01) top = Math.max(top ?? -9, st.top); }
    return top ?? (yRail > FF_BASE + 0.3 ? FF_BASE : 0);
  };
  const onWall = (x, z) => (X.stair.inner_walls || []).some(w => x > Math.min(w.r[0], w.r[2]) - 0.08 && x < Math.max(w.r[0], w.r[2]) + 0.08 && z > Math.min(w.r[1], w.r[3]) - 0.08 && z < Math.max(w.r[1], w.r[3]) + 0.08);
  const bal = [];
  for (const run of X.stair.rails) {
    const flatTop = run.every(q => Math.abs(q[1] - run[0][1]) < 0.02) && run[0][1] > FF_BASE + 0.5;
    if (!SEMID && flatTop) continue;   // the bungalow's guard along the well top is drawn with the balcony guards
    for (let i = 0; i < run.length - 1; i++) {
      tube(run[i], run[i + 1], 0.026);
      const A = run[i], B = run[i + 1], L = Math.hypot(B[0] - A[0], B[2] - A[2]);
      for (let t = 0.06; t < L - 0.03; t += 0.125) {
        const x = A[0] + (B[0] - A[0]) * t / L, z = A[2] + (B[2] - A[2]) * t / L, y = A[1] + (B[1] - A[1]) * t / L;
        const wall = onWall(x, z);
        if (wall && SEMID) continue;
        const y0 = wall ? y - STRINGER_DROP : support(x, z, y); if (y - y0 < 0.3) continue;   // bungalow: balusters stand on the stringer
        const g = new THREE.BoxGeometry(0.02, y - 0.03 - y0, 0.02); g.translate(sgn * x, (y - 0.03 + y0) / 2, z); bal.push(g);
      }
    }
  }
  if (bal.length) { const m = new THREE.Mesh(mergeGeometries(bal), mRailBlack); m.castShadow = true; gfDetail.add(m); }
  // Bungalow (owner, Nov 2026): the same mild-steel balustrade as the Semi-D instead of solid half-walls. The wall on
  // the well side of each flight is kept only as a plastered stringer up to 0.75 m below the handrail (about 150 mm
  // above the treads); the balusters stand on it. Where an under-stair wall already stands it is left out; over a
  // doorway nothing is built (the flight above is its own slab).
  if (!SEMID) for (const w0 of X.stair.inner_walls || []) {
    const w = { ...w0, r: [...w0.r], prof: w0.prof.map(([a, y]) => [a, y - STRINGER_DROP]) };
    // as wide as the under-stair wall it runs on from (flight 3: 150 mm), so its face beside the treads stays straight
    const [la, lb, aa, ab] = w0.axis === 'z' ? [0, 2, 1, 3] : [1, 3, 0, 2], sp = (q, i, j) => [Math.min(q[i], q[j]), Math.max(q[i], q[j])];
    for (const t of WALL_TOPS) {
      const [l0, l1] = sp(t.r, la, lb), [m0, m1] = sp(t.r, aa, ab), [L0, L1] = sp(w.r, la, lb), [M0, M1] = sp(w.r, aa, ab);
      if (t.axis === w0.axis && Math.min(l1, L1) - Math.max(l0, L0) > 0.02 && Math.min(m1, M1) - Math.max(m0, M0) > 0.02) { w.r[la] = Math.min(L0, l0); w.r[lb] = Math.max(L1, l1); }
    }
    const ax = w.axis, lo = q => ax === 'x' ? Math.min(q[0], q[2]) : Math.min(q[1], q[3]), hi = q => ax === 'x' ? Math.max(q[0], q[2]) : Math.max(q[1], q[3]);
    const crossOK = q => (ax === 'x' ? Math.min(q[3], w.r[3]) - Math.max(q[1], w.r[1]) : Math.min(q[2], w.r[2]) - Math.max(q[0], w.r[0])) > 0.02;
    const A0 = lo(w.r), A1 = hi(w.r);
    const cuts = [
      ...WALL_TOPS.filter(t => crossOK(t.r)).map(t => [lo(t.r), hi(t.r), null]),
      ...(D.gf_open || []).filter(o => crossOK(o.r)).map(o => [lo(o.r), hi(o.r), o.head]),
    ].map(([u, v, h]) => [Math.max(A0, u), Math.min(A1, v), h]).filter(([u, v]) => v > u + 0.01).sort((u, v) => u[0] - v[0]);
    let cur = A0;
    for (const [u, v, head] of cuts) {
      if (u > cur + 0.01) profWall(w.r, ax, w.prof, cur, u, w.y0 || 0, gfDetail);
      if (head !== null && v > Math.max(cur, u) + 0.01 && Math.min(profAt(w.prof, Math.max(cur, u)), profAt(w.prof, v)) > head + 0.1) profWall(w.r, ax, w.prof, Math.max(cur, u), v, head, gfDetail);
      cur = Math.max(cur, v);
    }
    if (A1 > cur + 0.01) profWall(w.r, ax, w.prof, cur, A1, w.y0 || 0, gfDetail);
  }
}

// No downstand beam across the dining room (owner, Nov 2026): every room has a flat plaster ceiling.

if (LIB) await Y();   // embedded build: let the hero draw a frame
// ---- the roof (amended): left unit hipped with gablets, right unit twin cross ridges; cement tile ----
function roofTileTexture() {
  const s = TEXHI ? 2048 : 1024, c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d'), rows = 12, cols = 12, w = s / cols, h = s / rows;   // 4 m square, 333 mm courses
  // Clay barrel tiles: each tile shaded across its width (light crown, dark troughs), courses overlapping.
  for (let j = 0; j < rows; j++) for (let i = -1; i <= cols; i++) {
    const v = Math.random() * 18 - 9, x = i * w, y = j * h;
    const base = [Math.round(176 + v), Math.round(86 + v * 0.55), Math.round(58 + v * 0.45)];
    const gr = g.createLinearGradient(x, 0, x + w, 0);
    gr.addColorStop(0.00, `rgb(${base[0] - 62},${base[1] - 38},${base[2] - 28})`);
    gr.addColorStop(0.30, `rgb(${base[0]},${base[1]},${base[2]})`);
    gr.addColorStop(0.50, `rgb(${base[0] + 22},${base[1] + 16},${base[2] + 12})`);
    gr.addColorStop(0.72, `rgb(${base[0]},${base[1]},${base[2]})`);
    gr.addColorStop(1.00, `rgb(${base[0] - 62},${base[1] - 38},${base[2] - 28})`);
    g.fillStyle = gr; g.fillRect(x, y, w, h);
    const sh = g.createLinearGradient(0, y + h * 0.72, 0, y + h); sh.addColorStop(0, 'rgba(40,16,8,0)'); sh.addColorStop(1, 'rgba(40,16,8,0.35)');
    g.fillStyle = sh; g.fillRect(x, y + h * 0.72, w, h * 0.28);   // shadow under the next course's lip
  }
  for (let k = 0, nW = 48000 * (s / 2048) ** 2; k < nW; k++) { g.fillStyle = `rgba(60,30,18,${Math.random() * 0.12})`; g.fillRect(Math.random() * s, Math.random() * s, 2, 2); }   // weathering
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy()); t.repeat.set(0.25, 0.25);
  return t;
}
function polyGeometry(polys, tiled) {
  const pos = [], uv = [];
  for (const P of polys) {
    const pts = P.map(([x, y, z]) => V(x, y, z));
    const n = V(0, 0, 0);
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; n.x += (a.y - b.y) * (a.z + b.z); n.y += (a.z - b.z) * (a.x + b.x); n.z += (a.x - b.x) * (a.y + b.y); }
    n.normalize(); if (n.y < -0.01) n.negate();
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    const to2 = ay >= ax && ay >= az ? p => new THREE.Vector2(p.x, p.z) : ax >= az ? p => new THREE.Vector2(p.z, p.y) : p => new THREE.Vector2(p.x, p.y);
    const down = V(n.x, 0, n.z); if (down.lengthSq() < 1e-6) down.set(0, 0, 1); down.normalize();
    const u = V(-down.z, 0, down.x), d = down.clone().sub(n.clone().multiplyScalar(down.dot(n))).normalize();
    for (const [i, j, k] of THREE.ShapeUtils.triangulateShape(pts.map(to2), [])) {
      let tri = [pts[i], pts[j], pts[k]];
      const tn = tri[1].clone().sub(tri[0]).cross(tri[2].clone().sub(tri[0]));
      if (tn.dot(n) < 0) tri = [tri[0], tri[2], tri[1]];
      for (const p of tri) { pos.push(p.x, p.y, p.z); uv.push(p.dot(u), -p.dot(d)); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (tiled) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals(); return g;
}
const tileTex = roofTileTexture();
const mTile = new THREE.MeshStandardMaterial({ map: tileTex, bumpMap: tileTex, bumpScale: 3.5, roughness: 0.8, side: THREE.FrontSide }); mTile.name = 'tile';
// Photo roof tile: uv metres, u along the eave, v up the slope (polyGeometry). ROOF_V = -1 turns the courses over.
const ROOF_V = 1;
hd.use(mTile, 'roof_tile', { sv: ROOF_V });
const mCapTile = new THREE.MeshStandardMaterial({ color: 0xA9573A, roughness: 0.75 });
// Timber louvre vents for the gablet / gable triangles.
const louvreTex = canvasTex(256, (g, s) => {
  g.fillStyle = '#8a6648'; g.fillRect(0, 0, s, s);
  for (let y = 0; y < s; y += 16) { const gr = g.createLinearGradient(0, y, 0, y + 16); gr.addColorStop(0, '#a77d58'); gr.addColorStop(0.7, '#7b5a3e'); gr.addColorStop(1, '#3d2a1c'); g.fillStyle = gr; g.fillRect(0, y, s, 16); }
}, { repeat: 1 });
const mLouvre = new THREE.MeshStandardMaterial({ map: louvreTex, roughness: 0.7, side: THREE.DoubleSide });
const mSoffit = new THREE.MeshStandardMaterial({ color: 0xEDE6DA, roughness: 0.95, side: THREE.BackSide });
const mFascia = new THREE.MeshStandardMaterial({ color: 0xF1EFEA, roughness: 0.45 });                   // white fascia and barge boards (owner, Nov 2026)
const mPlasterDS = new THREE.MeshStandardMaterial({ color: COL.cream, roughness: 0.95, side: THREE.DoubleSide });
hd.use(mPlasterDS, 'render_ext', { world: true, normalScale: 0.35 });   // gable and parapet faces: outside only
{
  const tg = polyGeometry(X.roof.tiles, true);
  for (const mat of [mTile, mSoffit]) { const m = new THREE.Mesh(tg, mat); m.castShadow = m.receiveShadow = true; roof.add(m); }
  roof.add(new LineSegments2(new LineSegmentsGeometry().fromEdgesGeometry(new THREE.EdgesGeometry(tg, 12)), mInk));
  // Vertical faces: triangles (gablets, the cross-gable end) get timber louvres, the rest is render.
  const tri = X.roof.faces.filter(f => f.length === 3), rest = X.roof.faces.filter(f => f.length !== 3);
  const fg = polyGeometry(rest, false);
  const fm = new THREE.Mesh(fg, mPlasterDS); fm.castShadow = fm.receiveShadow = true; roof.add(fm);
  fm.add(new LineSegments2(new LineSegmentsGeometry().fromEdgesGeometry(new THREE.EdgesGeometry(fg, 12)), mInk));
  {
    const pos = [], uv = [];
    for (const P of tri) {
      const ys = P.map(q => q[1]), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const vertX = Math.abs(P[0][0] - P[1][0]) < 0.01 && Math.abs(P[1][0] - P[2][0]) < 0.01;   // face in a y-z plane
      for (const q of P) {
        const off = vertX ? [Math.sign(q[0]) * -0.04, 0, 0] : [0, 0, q[2] > -6 ? -0.04 : 0.04];   // set back a little behind the eave line
        pos.push(q[0] + off[0], q[1], q[2] + off[2]); uv.push((vertX ? q[2] : q[0]) / 1.2, (q[1] - y0) / Math.max(0.1, y1 - y0) * (y1 - y0) / 0.6);
      }
    }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); lg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); lg.computeVertexNormals();
    const lm = new THREE.Mesh(lg, mLouvre); lm.castShadow = true; roof.add(lm);
  }
  // Ridge, hip and verge caps: rounded clay caps on every convex edge between roof planes (and where a
  // roof plane meets a gable face along a slope). Valleys are left open.
  {
    const key = p => p.map(v => v.toFixed(2)).join(',');
    const edges = new Map();
    const addPoly = (P, kind) => P.forEach((a, i) => {
      const b = P[(i + 1) % P.length], k = [key(a), key(b)].sort().join('|');
      if (!edges.has(k)) edges.set(k, { a, b, polys: [] });
      edges.get(k).polys.push({ P, kind });
    });
    X.roof.tiles.forEach(P => addPoly(P, 'tile')); X.roof.faces.forEach(P => addPoly(P, 'face'));
    const cent = P => P.reduce((s, q) => [s[0] + q[0] / P.length, s[1] + q[1] / P.length, s[2] + q[2] / P.length], [0, 0, 0]);
    const caps = [];
    for (const { a, b, polys } of edges.values()) {
      const tiles = polys.filter(q => q.kind === 'tile');
      if (!tiles.length) continue;
      const midY = (a[1] + b[1]) / 2, sloped = Math.abs(a[1] - b[1]) > 0.1;
      let isCap = false;
      if (tiles.length >= 2) isCap = tiles.every(q => cent(q.P)[1] < midY - 0.05);            // ridge or hip (convex)
      else if (polys.length >= 2 && sloped && !X.roof.gables.some(G => Math.min(a[0], b[0]) > G.x0 - 0.06 && Math.max(a[0], b[0]) < G.x1 + 0.06)) isCap = true;   // verge against a gablet face (gable walls get a barge board instead)
      if (!isCap) continue;
      const A = V(...a), B = V(...b), L = A.distanceTo(B); if (L < 0.2) continue;
      const g = new THREE.CylinderGeometry(0.095, 0.095, L, 14, 1, false, 0, Math.PI);
      const m = new THREE.Mesh(g, mCapTile);
      m.position.copy(A).lerp(B, 0.5); m.position.y += 0.035;
      m.quaternion.setFromUnitVectors(V(0, 1, 0), B.clone().sub(A).normalize());
      m.rotateY(Math.PI / 2 + (Math.abs(B.x - A.x) > Math.abs(B.z - A.z) ? 0 : 0));
      m.castShadow = true; caps.push(m); roof.add(m);
    }
    // keep the half-round crown facing up
    for (const m of caps) { const up = V(0, 0, 1).applyQuaternion(m.quaternion); if (up.y < 0) m.rotateY(Math.PI); }
  }
  const extrudeZY = (prof, x0, x1, mat) => {   // a wall standing on x0..x1 with its top following prof [[z, y]...]
    const sh = new THREE.Shape(prof.map(([z, y]) => new THREE.Vector2(-z, y)));
    const g = new THREE.ExtrudeGeometry(sh, { depth: x1 - x0, bevelEnabled: false });
    const m = new THREE.Mesh(g, mat); m.rotation.y = Math.PI / 2; m.position.x = x0; m.castShadow = m.receiveShadow = true;
    m.add(new LineSegments2(new LineSegmentsGeometry().fromEdgesGeometry(new THREE.EdgesGeometry(g, 30)), mInk));
    roof.add(m);
  };
  for (const G of X.roof.gables) {
    const p = G.prof; extrudeZY([[p[0][0], G.y0], ...p, [p[p.length - 1][0], G.y0]], G.x0, G.x1, mWall);
  }
  // Gable verges (owner, Nov 2026): the tiles run 300 mm out past every gable wall, finished with a white barge board
  // down the slope and a white plastered soffit under the overhang.
  {
    const inTiles = (x, z) => X.roof.tiles.some(P => { let ins = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, , zi] = P[i], [xj, , zj] = P[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) ins = !ins; } return ins; });
    const band = (za, ya, zb, yb, top, bot, x0, x1, mats) => {   // a strip following one roof slope, between x0 and x1
      const sh = new THREE.Shape([[za, ya + top], [zb, yb + top], [zb, yb + bot], [za, ya + bot]].map(([z, y]) => new THREE.Vector2(-z, y)));
      const g = new THREE.ExtrudeGeometry(sh, { depth: x1 - x0, bevelEnabled: false });
      const m = new THREE.Mesh(g, mats); m.rotation.y = Math.PI / 2; m.position.x = x0; m.castShadow = m.receiveShadow = true; roof.add(m); return m;
    };
    const prism = (pts, x0, x1, mat) => {   // a flat piece in the z-y plane ([[z, y]...]), from x0 to x1
      const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(-z, y))), { depth: x1 - x0, bevelEnabled: false });
      const m = new THREE.Mesh(g, mat); m.rotation.y = Math.PI / 2; m.position.x = x0; m.castShadow = m.receiveShadow = true; roof.add(m); return m;
    };
    const planeY = (P, x, z) => { for (let i = 1; i + 1 < P.length; i++) { const a = P[0], b = P[i], c = P[i + 1];
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      if (Math.abs(ny) > 1e-6) return a[1] - (nx * (x - a[0]) + nz * (z - a[2])) / ny; } return null; };
    const inP = (P, x, z) => { let ins = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, , zi] = P[i], [xj, , zj] = P[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) ins = !ins; } return ins; };
    const tileY = (x, z) => { let y = null; for (const P of X.roof.tiles) if (inP(P, x, z)) { const v = planeY(P, x, z); if (v != null && (y == null || v > y)) y = v; } return y; };
    const reach = (x, z, dir) => { let d = 0; while (d < 1.2 && inTiles(x + dir * (d + 0.02), z)) d += 0.02; return d; };
    const OV = 0.3, BB = 0.2, sides = new Map();
    for (const G of X.roof.gables) {
      const segs = G.prof.slice(1).map((q, i) => [G.prof[i], q]).filter(([u, v]) => Math.abs(u[1] - v[1]) > 0.05 && Math.abs(u[0] - v[0]) > 0.05);
      if (!segs.length) continue;
      const [[za, ya], [zb, yb]] = segs[0], zt = (za + zb) / 2;
      // which face is outside: where the tiles stop after a short overhang (inside, the roof carries on over the house)
      const rP = reach(G.x1, zt, 1), rN = reach(G.x0, zt, -1);
      const out = rP < rN ? 1 : rP > rN ? -1 : (inTiles(G.x1 + 0.25, zt) ? -1 : 1), xw = out > 0 ? G.x1 : G.x0, R = out > 0 ? rP : rN;
      if (R < 0.2) {   // the tiles stop at the wall: they run 300 mm out over it
        const xo = xw + out * OV, [lo, hi] = out > 0 ? [xw, xo] : [xo, xw];
        for (const [[z0, y0], [z1, y1]] of segs) {
          band(z0, y0, z1, y1, 0.065, 0.02, out > 0 ? lo : lo - 0.03, out > 0 ? hi + 0.03 : hi, [mCapTile, mTile]);                           // tile run-out
          band(z0, y0, z1, y1, 0.02, 0.02 - BB, out > 0 ? hi - 0.025 : lo, out > 0 ? hi : lo + 0.025, mFascia);                                // barge board
          band(z0, y0, z1, y1, 0.02 - BB + 0.03, 0.02 - BB + 0.018, lo + (out > 0 ? 0 : 0.025), hi - (out > 0 ? 0.025 : 0), mFascia);          // soffit
        }
        continue;
      }
      // the tiles already overhang the wall (the Semi-D's gable unit, the bungalow's east gable: 600 mm): the barge board
      // goes on the tiles' own edge and the soffit under them (owner, Nov 2026: it was put inside the roof, out of sight,
      // and the eave soffits ended in mid-air at the corners as a white wedge)
      let xo = xw + out * R; for (const P of X.roof.tiles) for (const q of P) if (Math.abs(q[0] - xo) < 0.05 && (q[0] - xo) * out > 0) xo = q[0];
      const k = out + ':' + xo.toFixed(2); if (!sides.has(k)) sides.set(k, { out, xw, xo, gz: [] });
      const sd = sides.get(k), zs = G.prof.map(q => q[0]); sd.gz.push([Math.min(...zs), Math.max(...zs)]); sd.xw = out > 0 ? Math.min(sd.xw, xw) : Math.max(sd.xw, xw);
    }
    for (const { out, xw, xo, gz } of sides.values()) {
      const T = 0.03, xb0 = out > 0 ? xo - T : xo, xb1 = out > 0 ? xo + 0.005 : xo + T;   // barge board, a hair proud of the tile edge
      const [lo, hi] = out > 0 ? [xw, xo - T] : [xo + T, xw];
      const edges = [];
      for (const P of X.roof.tiles) P.forEach((a, i) => { const b = P[(i + 1) % P.length];
        if (Math.abs(a[0] - xo) < 0.01 && Math.abs(b[0] - xo) < 0.01 && Math.abs(a[2] - b[2]) > 0.05 && Math.abs(a[1] - b[1]) > 0.05) edges.push([[a[2], a[1]], [b[2], b[1]]]); });
      for (const [[z0, y0], [z1, y1]] of edges) {
        band(z0, y0, z1, y1, 0.03, 0.03 - BB, xb0, xb1, mFascia);                                                        // barge board, eave to ridge
        for (const [g0, g1] of gz) {                                                                                       // soffit, over the gable wall's own length
          const za = Math.max(Math.min(z0, z1), g0), zb = Math.min(Math.max(z0, z1), g1); if (zb - za < 0.02) continue;
          const yAt = z => y0 + (y1 - y0) * (z - z0) / (z1 - z0);
          band(za, yAt(za), zb, yAt(zb), -0.17, -0.19, lo, hi, mFascia);
        }
      }
      // an eave soffit that runs out to the verge: its end boxed in up to the verge soffit (no open wedge at the corner)
      const gmin = Math.min(...gz.map(g => g[0])), gmax = Math.max(...gz.map(g => g[1])), xi = xo - out * 0.05;
      for (const s of X.roof.soffits) {
        const sx0 = Math.min(s.r[0], s.r[2]), sx1 = Math.max(s.r[0], s.r[2]), sz0 = Math.min(s.r[1], s.r[3]), sz1 = Math.max(s.r[1], s.r[3]);
        if (out > 0 ? sx1 < xo - 0.05 : sx0 > xo + 0.05) continue;
        if (sx1 - sx0 < sz1 - sz0) continue;   // eaves along x only (front and back)
        const zIn = sz0 >= gmin - 0.05 && sz0 <= gmax + 0.05 ? sz0 : sz1 >= gmin - 0.05 && sz1 <= gmax + 0.05 ? sz1 : null; if (zIn == null) continue;
        const zOut = zIn === sz0 ? sz1 : sz0, yIn = tileY(xi, zIn - Math.sign(zOut - zIn) * 0.01), yOut = tileY(xi, zOut - Math.sign(zOut - zIn) * 0.01);
        if (yIn == null || yOut == null) continue;
        const yb = s.y - 0.02, tIn = Math.max(yb + 0.02, yIn - 0.17), tOut = Math.max(yb + 0.02, yOut - 0.17);
        prism([[zOut, yb], [zIn, yb], [zIn, tIn], [zOut, tOut]], out > 0 ? xo - T - 0.02 : xo + T, out > 0 ? xo - T : xo + T + 0.02, mFascia);   // the end panel
        const zb0 = zIn + Math.sign(zOut - zIn) * 0.0, zb1 = zIn + Math.sign(zOut - zIn) * 0.02;
        block([Math.min(lo, hi), Math.min(zb0, zb1), Math.max(lo, hi), Math.max(zb0, zb1)], yb, tIn - yb, mFascia, roof, null);   // and its back, at the wall line
      }
    }
  }
  // Party wall top brought flush with the roof (the drawing stands it ~0.28 m proud): it follows the right
  // unit's tile line at the wall (20 then 35 deg up to the ridges) and the flat strips in between.
  const P = X.roof.parapet;
  if (P) {
  P.prof = [[1.07, 7.42], [-0.819, 8.108], [-2.789, 9.487], [-2.789, 7.17], [-10.466, 7.17], [-10.466, 9.487], [-12.436, 8.108], [-13.255, 7.81]];
  const pp = P.prof;
  extrudeZY([[pp[0][0], P.y0], ...pp, [pp[pp.length - 1][0], P.y0]], P.x0, P.x1, mWall);
  { // clay coping along the whole stepped top of the party wall, 40 mm proud each side, like the ridge caps
    for (let i = 0; i < pp.length - 1; i++) {          // one cap per sloped / flat run; none on the vertical drops
      const [za, ya] = pp[i], [zb, yb] = pp[i + 1]; if (Math.abs(za - zb) < 0.01) continue;
      const band = [[za, ya + 0.05], [zb, yb + 0.05], [zb, yb - 0.03], [za, ya - 0.03]];
      const sh = new THREE.Shape(band.map(([z, y]) => new THREE.Vector2(-z, y)));
      const g = new THREE.ExtrudeGeometry(sh, { depth: P.x1 - P.x0 + 0.08, bevelEnabled: false });
      const m = new THREE.Mesh(g, mCapTile); m.rotation.y = Math.PI / 2; m.position.x = P.x0 - 0.04; m.castShadow = true; roof.add(m);
    }
  }
  }
  // Flat concrete roofs: cement render with a waterproof membrane, weathered grey.
  const flatTex = canvasTex(256, (c, n) => { c.fillStyle = '#a39d95'; c.fillRect(0, 0, n, n); blotches(c, n, 140, 6, 34, a => `rgba(${a > 0.5 ? '230,226,220' : '60,56,52'},${0.06 + a * 0.08})`); }, { repeat: 2 });
  const mFlat = new THREE.MeshStandardMaterial({ color: 0xC9C3BA, map: flatTex, roughness: 0.95 });
  for (const f of X.roof.flats.filter(f => f.y1 >= 4)) block(f.r, f.y0, f.y1 - f.y0, [mWall, mWall, mFlat, mWall, mWall, mWall], roof);
  // Rooflights ("BUMBUNG KACA 2.83 mp"): 12.38 mm laminated tinted glass in an aluminium frame, centre mullion.
  const mRoofGlass = new THREE.MeshStandardMaterial({ color: 0x4F6168, roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.55, envMapIntensity: 1.6 });
  for (const g of X.roof.glass) {
    const [x0, z0, x1, z1] = g.r, m = block([x0 + 0.04, z0 + 0.04, x1 - 0.04, z1 - 0.04], g.y, 0.015, mRoofGlass, roof, null); m.castShadow = false;
    for (const r of [[x0, z0, x1, z0 + 0.05], [x0, z1 - 0.05, x1, z1], [x0, z0, x0 + 0.05, z1], [x1 - 0.05, z0, x1, z1], [(x0 + x1) / 2 - 0.025, z0, (x0 + x1) / 2 + 0.025, z1]])
      block(r, g.y - 0.01, 0.05, mFrame, roof, null);
  }
  // Water tanks on the flat roof (unlabelled ~1.19 m circles on the roof plan; inferred to be tanks).
  // Semi-D: two tanks per house, four per pair (owner, Nov 2026), on each unit's flat strip by the party wall
  for (const tk of SEMID ? [[-0.95, -9.16], [-0.95, -7.88], [0.95, -9.16], [0.95, -7.88]].map(c => ({ c, d: 1.19, y0: 7.15 })) : (X.roof.tanks || [])) {
    const r = tk.d / 2, h = tk.h || 1.05;
    const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 36), new THREE.MeshStandardMaterial({ color: COL.plaster, roughness: 0.6 }));
    t.position.set(tk.c[0], tk.y0 + h / 2, tk.c[1]); t.castShadow = true; roof.add(t);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.08, 24), t.material); lid.position.set(tk.c[0], tk.y0 + h + 0.04, tk.c[1]); roof.add(lid);
  }
  for (const f of X.roof.fascia) block(f.r, f.y0, f.y1 - f.y0, mFascia, roof, mInkSoft);
  // Eave soffits: white plaster under every overhang.
  // Each soffit runs only where there is roof over it (tiles or a flat slab above its height): past a gable or a
  // roof's end the board stops, instead of carrying on as a bare timber shelf.
  const under = (x, z, y) => X.roof.tiles.some(P => {
      let ins = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, , zi] = P[i], [xj, , zj] = P[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) ins = !ins; }
      return ins;
    }) || X.roof.flats.some(f => f.y0 >= y - 0.05 && x > Math.min(f.r[0], f.r[2]) && x < Math.max(f.r[0], f.r[2]) && z > Math.min(f.r[1], f.r[3]) && z < Math.max(f.r[1], f.r[3]));
  const mSoffitPlaster = new THREE.MeshStandardMaterial({ color: 0xF3EFE8, roughness: 0.9 });
  for (const s of X.roof.soffits) {
    const x0 = Math.min(s.r[0], s.r[2]), x1 = Math.max(s.r[0], s.r[2]), z0 = Math.min(s.r[1], s.r[3]), z1 = Math.max(s.r[1], s.r[3]);
    const alongX = x1 - x0 >= z1 - z0, a0 = alongX ? x0 : z0, a1 = alongX ? x1 : z1, cm = alongX ? (z0 + z1) / 2 : (x0 + x1) / 2;
    const n = Math.max(1, Math.round((a1 - a0) / 0.1)), step = (a1 - a0) / n, runs = [];
    // across its width too: at a hip or valley the roof edge runs on the diagonal, so each 10 cm step keeps only the
    // part with tiles over it (owner, Nov 2026: a white wedge stuck out past the tiles at a hip corner)
    const c0 = alongX ? z0 : x0, c1 = alongX ? z1 : x1, NC = 12, cs = (c1 - c0) / NC;
    const span = a => { let lo = null, hi = null;
      for (let j = 0; j < NC; j++) { const c = c0 + (j + 0.5) * cs; if (under(alongX ? a : c, alongX ? c : a, s.y)) { if (lo === null) lo = j; hi = j; } }
      return lo === null ? null : [lo === 0 ? c0 : c0 + lo * cs, hi === NC - 1 ? c1 : c0 + (hi + 1) * cs]; };
    let cur = null;
    for (let i = 0; i <= n; i++) {
      const sp = i < n ? span(a0 + (i + 0.5) * step) : null;
      if (cur && sp && Math.abs(sp[0] - cur.c[0]) < 1e-6 && Math.abs(sp[1] - cur.c[1]) < 1e-6) continue;
      if (cur) runs.push([cur.a, a0 + i * step, cur.c]);
      cur = sp ? { a: a0 + i * step, c: sp } : null;
    }
    for (const [ra, rb, [ca, cb]] of runs) {
      if (rb - ra < 0.09 || cb - ca < 0.05) continue;
      const r = alongX ? [ra, ca, rb, cb] : [ca, ra, cb, rb];
      block(r, s.y - 0.02, 0.02, mSoffitPlaster, roof, null);   // white plastered soffit (owner, Nov 2026: was timber boards)
    }
  }
}

if (LIB) await Y();   // embedded build: let the hero draw a frame
// ---------- labels, straight off the drawing ----------
const labels = [];
// Areas in square feet, as Malaysian buyers read them (drawing areas are in m², 1 m² = 10.7639 sq ft).
const sqft = m2 => `${Math.round(m2 * 10.7639).toLocaleString('en-US')} sq ft`;
// Room name (wrapped to two lines when long, like the drawing) + area, lying on the floor.
// `x` is the left edge of the text; mirror=true places it as the right-hand unit's mirror image.
function label(text, sub, x, z, y, size = 0.24, mirror = false) {
  const words = text.split(' ');
  const lines = text.length > 11 && words.length > 1
    ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')]
    : [text];
  const fs = 64, c = document.createElement('canvas'), g = c.getContext('2d');
  const f1 = `500 ${fs}px "JetBrains Mono", monospace`, f2 = `400 ${Math.round(fs * 0.8)}px "JetBrains Mono", monospace`;
  g.font = f1; const w1 = Math.max(...lines.map(s => g.measureText(s).width));
  g.font = f2; const w2 = sub ? g.measureText(sub).width : 0;
  const lh = fs * 1.12;
  c.width = Math.ceil(Math.max(w1, w2) + 16); c.height = Math.ceil(lh * lines.length + (sub ? fs * 1.0 : 0) + 10);
  g.fillStyle = '#2E2825'; g.textBaseline = 'top';
  g.font = f1; lines.forEach((s, i) => g.fillText(s, 8, 4 + i * lh));
  if (sub) { g.globalAlpha = 0.6; g.font = f2; g.fillText(sub, 8, 6 + lines.length * lh); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const h = size * c.height / fs, w = h * c.width / c.height;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.renderOrder = 2;
  m.position.set(mirror ? -x - w / 2 : x + w / 2, y, z + h / 2);
  scene.add(m); labels.push(m); return m;
}
// The two units are mirror images. As on the architect's furnished sheet, the
// left unit shows the furniture and the right unit carries the room names.
for (const l of D.labels.filter(l => l.floor === 0 && (SEMID ? l.x < 0 : true))) {
  const mm = l.t.match(/^(.*?)\s+(\d+\.\d+\s*mp)$/i);
  if (SEMID && (Math.abs(l.x) > 10 || l.z < -17 || l.z > 8)) continue;
  if (!SEMID && furnishedRoom(l)) continue;      // bungalow: rooms with furniture drawn stay clear of text
  const name = mm ? mm[1] : l.t, area = mm ? sqft(parseFloat(mm[2])) : '';
  const outside = l.z > HOUSE.z1 + 0.2 || l.z < HOUSE.z0 - 0.2 || l.x < HOUSE.x0 - 0.2 || l.x > HOUSE.x1 + 0.2;
  label(name, area, l.x, l.z, (outside ? GROUND : 0) + 0.02, 0.24, SEMID);
}
function furnishedRoom(l) { return FURN.some(f => f.floor === 0 && l.t.startsWith(f.room) && !/KERETA|SPAH/.test(f.room)); }
if (SEMID) {
label('TEMPAT LETAK KERETA', sqft(38.54), -5.4, 2.0, GROUND + 0.02);
label('TEMPAT LETAK KERETA', sqft(38.54), -5.4, 2.0, GROUND + 0.02, 0.24, true);
label('PATIO', sqft(27.19), -9.1, -6.4, GROUND + 0.02);
label('PATIO', sqft(27.19), -9.1, -6.4, GROUND + 0.02, 0.24, true);
}
const streetLabels = [
  label('JALAN 40 KAKI', '12.2 m', -4.5, LOT.z1 + 4.4, GROUND + 0.02, 0.42),
];

if (LIB) await Y();   // embedded build: let the hero draw a frame
// ---------- the living room turns real ----------
// ---- procedural textures (drawn once in the browser, nothing to download) ----
function rnd() { rnd.s = ((rnd.s || 7) * 16807) % 2147483647; return rnd.s / 2147483647; }   // repeatable noise (hoisted: the roof uses it early)
function canvasTex(size, draw, { srgb = true, repeat = 1 } = {}) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = renderer ? Math.min(16, renderer.capabilities.getMaxAnisotropy()) : 8;
  return t;
}
function blotches(g, s, n, rMin, rMax, rgba) {   // soft mottling
  for (let i = 0; i < n; i++) {
    const x = rnd() * s, y = rnd() * s, r = rMin + rnd() * (rMax - rMin);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, rgba(rnd())); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
}
// 600 x 600 matt porcelain, concrete look ("Concretum" in the tender), greige with 2 mm grout.
function tileTexture(base = [206, 199, 189], vary = 8, mottle = 1) {   // GF: a warmer beige, less variation, almost no clouding
  return canvasTex(1024, (g, s) => {
    const n = 4, step = s / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const v = Math.round((rnd() - 0.5) * vary);
      g.fillStyle = `rgb(${base[0] + v},${base[1] + v},${base[2] + v})`; g.fillRect(i * step, j * step, step, step);
    }
    blotches(g, s, 260, 10, 70, a => `rgba(${a > 0.5 ? '255,250,240' : '120,110,98'},${(0.05 + a * 0.05) * mottle})`);
    for (let k = 0; k < 9000; k++) { g.fillStyle = `rgba(90,82,74,${rnd() * 0.08 * (mottle < 1 ? 0.6 : 1)})`; g.fillRect(rnd() * s, rnd() * s, 1.5, 1.5); }
    g.strokeStyle = 'rgba(165,154,140,0.4)'; g.lineWidth = 1.4;   // soft, fine grout (owner)
    for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * step, 0); g.lineTo(i * step, s); g.stroke(); g.beginPath(); g.moveTo(0, i * step); g.lineTo(s, i * step); g.stroke(); }
  });
}
function woodTexture() {   // near-white grain, multiplied by each piece's own colour
  return canvasTex(512, (g, s) => {
    g.fillStyle = '#f4f1ec'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 140; i++) {
      const y0 = rnd() * s, amp = 2 + rnd() * 7, f = 0.004 + rnd() * 0.01, a = 0.05 + rnd() * 0.13;
      g.strokeStyle = `rgba(${70 + rnd() * 40},${45 + rnd() * 25},${25},${a})`; g.lineWidth = 0.6 + rnd() * 2.2;
      g.beginPath(); for (let x = 0; x <= s; x += 8) g.lineTo(x, y0 + Math.sin(x * f + i) * amp); g.stroke();
    }
  });
}
function weaveBump() {   // boucle / jute texture as a bump map
  return canvasTex(256, (g, s) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, s, s);
    for (let k = 0; k < 5000; k++) { const v = Math.round(rnd() * 255); g.fillStyle = `rgba(${v},${v},${v},0.55)`; g.beginPath(); g.arc(rnd() * s, rnd() * s, 0.8 + rnd() * 1.8, 0, 7); g.fill(); }
  }, { srgb: false, repeat: 3 });
}
function stoneTexture() {   // travertine: soft bands and pits
  return canvasTex(512, (g, s) => {
    g.fillStyle = '#f3ede3'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(${150 + rnd() * 40},${125 + rnd() * 30},${95},${0.04 + rnd() * 0.06})`; g.fillRect(0, rnd() * s, s, 2 + rnd() * 10); }
    for (let k = 0; k < 400; k++) { g.fillStyle = `rgba(120,100,80,${0.15 + rnd() * 0.2})`; g.beginPath(); g.ellipse(rnd() * s, rnd() * s, 1 + rnd() * 4, 0.6 + rnd() * 1.2, 0, 0, 7); g.fill(); }
  });
}
function limewashTexture() {   // clay feature wall, brushed limewash
  return canvasTex(512, (g, s) => {
    g.fillStyle = '#f7f5f0'; g.fillRect(0, 0, s, s);   // Japandi review: lighter base and softer clouding, the old one multiplied the sage down to a muddy olive
    blotches(g, s, 420, 20, 90, a => `rgba(${a > 0.5 ? '255,255,255' : '170,160,140'},${0.03 + a * 0.04})`);
  });
}
// Per-pixel noise written straight into the canvas (fast), made once and shared: callers get clones.
function pixelTex(size, fill) {
  return canvasTex(size, (g, s) => { const im = g.createImageData(s, s); fill(im.data, s); g.putImageData(im, 0, 0); });
}
function cachedTex(key, make, repeat) {
  if (!texCache.has(key)) texCache.set(key, make());
  const t = texCache.get(key).clone(); t.needsUpdate = true; t.repeat.set(repeat, repeat); return t;
}
function ventTexture() {   // 4 x 4 grid of square holes per 390 mm block (alpha-tested)
  return cachedTex('vent', () => canvasTex(256, (g, s) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, s, s);
    const n = 4, cell = s / n, hole = cell * 0.6;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) g.clearRect(i * cell + (cell - hole) / 2, j * cell + (cell - hole) / 2, hole, hole);
    g.strokeStyle = 'rgba(120,108,92,0.35)'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, s - 3, s - 3);   // block joints
  }), 1);
}
function grassTexture() {   // grass blades: short vertical streaks over a mid green
  return cachedTex('grass', () => pixelTex(HIFI ? 1024 : 512, (d, s) => {
    for (let i = 0; i < s * s; i++) { d[i * 4] = 0x7d; d[i * 4 + 1] = 0x8c; d[i * 4 + 2] = 0x55; d[i * 4 + 3] = 255; }
    for (let k = 0, n = 26000 * (s / 512) ** 2; k < n; k++) {
      const v = rnd(), x = Math.floor(rnd() * s), y0 = Math.floor(rnd() * s), L = 2 + Math.floor(rnd() * 3);
      const r = 90 + v * 60, gg = 110 + v * 50, b = 50 + v * 25;
      for (let y = y0; y < y0 + L; y++) { const i = ((y % s) * s + x) * 4; d[i] = (d[i] + r) / 2; d[i + 1] = (d[i + 1] + gg) / 2; d[i + 2] = (d[i + 2] + b) / 2; }
    }
  }), 6);
}
function asphaltTexture() {   // fine grey aggregate
  return cachedTex('asphalt', () => pixelTex(HIFI ? 1024 : 512, (d, s) => {
    for (let i = 0; i < s * s; i++) { d[i * 4] = 0x6f; d[i * 4 + 1] = 0x6b; d[i * 4 + 2] = 0x67; d[i * 4 + 3] = 255; }
    for (let k = 0, n = 30000 * (s / 512) ** 2; k < n; k++) {
      const v = 80 + rnd() * 70, x = Math.floor(rnd() * (s - 1)), y = Math.floor(rnd() * (s - 1));
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const i = ((y + dy) * s + x + dx) * 4; d[i] = (d[i] + v) / 2; d[i + 1] = (d[i + 1] + v - 3) / 2; d[i + 2] = (d[i + 2] + v - 6) / 2; }
    }
  }), 1);
}
function pavingTexture(tile, rgb) {   // imprinted concrete / pavers (made once per pattern)
  return cachedTex(`paving${tile}|${rgb}`, () => canvasTex(512, (g, s) => {
    g.fillStyle = `rgb(${rgb})`; g.fillRect(0, 0, s, s);
    blotches(g, s, 200, 8, 40, a => `rgba(${a > 0.5 ? '255,255,255' : '80,70,60'},${0.04 + a * 0.05})`);
    g.strokeStyle = 'rgba(70,62,55,0.35)'; g.lineWidth = 2;
    const step = s / tile; for (let i = 0; i <= tile; i++) { g.beginPath(); g.moveTo(i * step, 0); g.lineTo(i * step, s); g.stroke(); g.beginPath(); g.moveTo(0, i * step); g.lineTo(s, i * step); g.stroke(); }
  }), 1);
}
const TEX = { wood: woodTexture(), weave: weaveBump(), stone: stoneTexture(), lime: limewashTexture() };
const sweepPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0.15);   // keeps z >= -constant
const floorTex = tileTexture([233, 220, 198], 4, 0.15);   // plain light beige matt porcelain (owner, Nov 2026: "lighter beige"), very little tile-to-tile shade
const lw = FINISH.x1 - FINISH.x0, ld = FINISH.z1 - FINISH.z0;
floorTex.repeat.set(lw / 2.4, ld / 2.4);
const realFloor = new THREE.Mesh(new THREE.PlaneGeometry(lw, ld),
  new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.86, envMapIntensity: 0.6, clippingPlanes: [sweepPlane] }));   // GF tiles: beige, matt finish (owner): no sheen
hd.use(realFloor.material, 'porcelain_beige', { su: lw, sv: ld, color: 'keep', rough: false, normalScale: 0.2 });   // owner: plain beige matt porcelain, no marble veining: the drawn beige stays, a hint of relief only
realFloor.rotation.x = -Math.PI / 2; realFloor.position.set((FINISH.x0 + FINISH.x1) / 2, 0.004, (FINISH.z0 + FINISH.z1) / 2);
realFloor.receiveShadow = true; scene.add(realFloor);
// The rest of the ground floor (bedrooms, kitchens, bathrooms) in the same porcelain, laid once the sweep is done.
const gfFloorTex = floorTex.clone(); gfFloorTex.needsUpdate = true; gfFloorTex.repeat.set((HOUSE.x1 - HOUSE.x0) / 2.4, (HOUSE.z1 - HOUSE.z0) / 2.4);
const gfFloor = new THREE.Mesh(new THREE.PlaneGeometry(HOUSE.x1 - HOUSE.x0, HOUSE.z1 - HOUSE.z0), new THREE.MeshStandardMaterial({ map: gfFloorTex, roughness: 0.86, envMapIntensity: 0.6 }));
hd.use(gfFloor.material, 'porcelain_beige', { su: HOUSE.x1 - HOUSE.x0, sv: HOUSE.z1 - HOUSE.z0, color: 'keep', rough: false, normalScale: 0.2 });
gfFloor.rotation.x = -Math.PI / 2; gfFloor.position.set((HOUSE.x0 + HOUSE.x1) / 2, 0.003, (HOUSE.z0 + HOUSE.z1) / 2); gfFloor.receiveShadow = true; gfFloor.visible = false; scene.add(gfFloor);
const sweepLine = new LineSegments2(new LineSegmentsGeometry().setPositions([FINISH.x0, 0.012, 0, FINISH.x1, 0.012, 0]),
  new LineMaterial({ color: COL.terra, linewidth: 2.2, transparent: true, opacity: 0 }));
lineMats.push(sweepLine.material); scene.add(sweepLine);

if (LIB) await Y();   // embedded build: let the hero draw a frame
// Furniture, from the architect's furnished layout plan (LOT24480, 27 Nov 2025),
// traced off the vector PDF at 1:100 and registered to the walls above.
// Like that sheet, the left-hand unit is furnished. Pieces in the living room
// start as ink and turn real as the sweep reaches them; the rest stay ink.
const furn = [];
const mInkFurn = new LineMaterial({ color: COL.ink, linewidth: MOBILE ? 0.9 : 1.0, transparent: true, opacity: 0.9 });
lineMats.push(mInkFurn);
const inLiving = z => z > FINISH.z0 - 0.3;
// cx, cz centre on plan; w (x) by d (z) footprint; sits on `base`, `h` tall.
// Options: rot (radians about y), parent (a rotated group), zf (front edge for the sweep), round (cylinder), noLine.
let BUNG_PIECE = false;   // the hand-placed Semi-D furniture below is skipped for the bungalow; its own list is placed further down
const NEWFURN = !!makeFurniture && (SEMID ? SD_FURN.length > 0 : FURN.length > 0);   // realistic furniture from the audited lists
function piece(cx, cz, w, d, base, h, color, radius = 0.04, o = {}) {
  if (!SEMID && !BUNG_PIECE && !o.keep) return new THREE.Group();
  if (NEWFURN && !o.keep) return new THREE.Group();   // replaced by furniture.js pieces (see below)
  const g = o.geom ? o.geom.clone()
    : o.round ? new THREE.CylinderGeometry(o.rTop ?? w / 2, w / 2, h, 48)
    : new RoundedBoxGeometry(w, h, d, 3, Math.min(radius, h / 2.01, w / 2.01, d / 2.01));
  if (!o.geom) g.translate(0, h / 2, 0);
  const zf = o.zf ?? cz + d / 2, live = o.live ?? true;   // every room is visited on the tour, so every piece gets its real finish
  const mat = new THREE.MeshStandardMaterial({ color: COL.wall, roughness: live ? o.rough ?? 0.82 : 0.82, metalness: live ? o.metal ?? 0 : 0,
    map: live ? o.map ?? null : null, bumpMap: live ? o.bump ?? null : null, bumpScale: o.bumpScale ?? 1.2,
    flatShading: !!o.flat, emissive: o.emissive ?? 0x000000, side: o.side ?? THREE.FrontSide, envMapIntensity: o.env ?? 1, vertexColors: !!o.vcol });
  const m = new THREE.Mesh(g, mat);
  m.position.set(cx, base, cz); m.rotation.y = o.rot || 0; m.castShadow = m.receiveShadow = true;
  m.userData.base = base;
  // Outline from a plain box (a rounded box has no hard edges to draw), or the cylinder's rims.
  const eg = o.round ? g : new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
  if (!o.noLine) m.add(new LineSegments2(new LineSegmentsGeometry().fromEdgesGeometry(new THREE.EdgesGeometry(eg, 35)), live ? mInkFurn : mInk));
  m.userData.real = new THREE.Color(live ? color : COL.wall); m.userData.white = new THREE.Color(COL.wall);
  m.userData.zf = zf; m.scale.y = 0.001; m.userData.ff = !!o.ff;
  (o.parent || scene).add(m); furn.push(m); return m;
}
// from a plan rectangle [x0, z0, x1, z1]
const box = (x0, z0, x1, z1, base, h, color, radius, o) => piece((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, base, h, color, radius, o);
// Palette, Japandi (owner, Nov 2026): light oak, oatmeal linen, muted sage and charcoal (CLAY is now the sage limewash).
const BOUCLE = 0xE6DDCF, OATMEAL = 0xE3D9C8, RUST = 0x9FA592, OLIVE = 0x4A4744, LEATHER = 0xD0B48C,
  JUTE = 0xC9BBA2, TRAVERTINE = 0xDDD2C0, OAK = 0xD4BC98, WALNUT = 0xC4A880, CHARCOAL = 0x4A4744,
  BLACK = 0x1E1C1B, STEEL = 0xCFCCC6, SAGE = 0xD0B48C, QUARTZ = 0xECE7DE, CLAY = 0xD3D6C4, POT = 0x4D4A46, LEAF = 0x5C6E40;
const W = { map: TEX.wood }, FAB = { bump: TEX.weave, bumpScale: 1.4, rough: 0.95 };

// Sage limewash feature wall behind the TV (front wall, inside face; Japandi, was clay).
const LIMEWASH = 0xE4E6DA;   // pale sage limewash for the TV feature walls (lighter than CLAY, which the texture darkens)
if (SEMID) box(-6.566, -0.176, -3.11, -0.151, 0, GF_TOP - 0.01, LIMEWASH, 0.002, { map: TEX.lime, rough: 0.97, zf: -0.15, keep: true });   // Semi-D living only
if (!SEMID) box(2.17, -8.1, 2.195, -5.3, 0, 2.99, LIMEWASH, 0.002, { map: TEX.lime, rough: 0.97, keep: true });   // bungalow living: the same sage limewash feature wall behind the TV (to the 3.0 false ceiling)

// Living room. Sofa faces the TV console on the front wall; armchair angled toward the rug.
box(-6.566, -0.609, -3.175, -0.157, 0, 0.45, OAK, 0.02, W);                     // TV console, 3.39 m, light oak
piece(-5.063, -0.405, 0.24, 0.24, 0.45, 0.03, BLACK, 0.01, { round: true, noLine: true });   // TV stand
box(-5.682, -0.425, -4.444, -0.385, 0.53, 0.72, BLACK, 0.01, { rough: 0.3, env: 0.15 });    // 55-inch TV, screen off
box(-5.972, -2.507, -3.895, -1.162, 0, 0.014, JUTE, 0.004, { bump: TEX.weave, bumpScale: 2, rough: 1 });   // jute rug 2.08 x 1.35
piece(-5.206, -1.863, 0.72, 0.72, 0, 0.36, TRAVERTINE, 0, { round: true, map: TEX.stone, rough: 0.6 });   // nesting tables
piece(-4.647, -1.878, 0.60, 0.60, 0, 0.45, WALNUT, 0, { round: true, ...W, rough: 0.5 });
// sofa, 2.03 m, three seats, boucle
box(-5.824, -3.599, -3.997, -2.787, 0, 0.40, BOUCLE, 0.05, FAB);                // base
box(-5.824, -3.599, -3.997, -3.370, 0.40, 0.42, BOUCLE, 0.09, FAB);             // back
box(-5.926, -3.599, -5.824, -2.837, 0, 0.62, BOUCLE, 0.05, FAB);                // arms
box(-3.997, -3.599, -3.895, -2.837, 0, 0.62, BOUCLE, 0.05, FAB);
for (const [a, b] of [[-5.824, -5.215], [-5.215, -4.606], [-4.606, -3.997]]) box(a + 0.01, -3.370, b - 0.01, -2.800, 0.40, 0.13, OATMEAL, 0.06, FAB);
for (const [x, c, r] of [[-5.55, RUST, 0.12], [-4.25, OLIVE, -0.1]]) {        // scatter cushions leaning on the back
  const g = new THREE.Group(); g.position.set(x, 0.53, -3.25); g.rotation.set(-0.28, r, 0); scene.add(g);
  piece(0, 0, 0.44, 0.13, 0, 0.44, c, 0.06, { parent: g, zf: -3.2, ...FAB, noLine: true });
}
{ // armchair 0.76 x 0.81, turned 19.8 deg, its back toward the party wall; cognac leather on oak legs
  const g = new THREE.Group(); g.position.set(-3.304, 0, -2.120); g.rotation.y = 0.346; scene.add(g);
  const o = { parent: g, zf: -1.75, rough: 0.55 };
  piece(0, 0, 0.76, 0.81, 0.12, 0.30, LEATHER, 0.07, o);
  piece(0.28, 0, 0.20, 0.81, 0.42, 0.40, LEATHER, 0.08, o);
  piece(-0.02, -0.345, 0.72, 0.12, 0.42, 0.20, LEATHER, 0.05, o);
  piece(-0.02, 0.345, 0.72, 0.12, 0.42, 0.20, LEATHER, 0.05, o);
  for (const [x, z] of [[-0.32, -0.35], [0.32, -0.35], [-0.32, 0.35], [0.32, 0.35]]) piece(x, z, 0.04, 0.04, 0, 0.12, OAK, 0, { ...o, noLine: true });
}

// Dining: 1.94 x 0.91 m solid oak table, charcoal chairs, three a side and one at each end.
box(-5.850, -6.091, -3.906, -5.183, 0.72, 0.04, OAK, 0.01, W);
for (const [x, z] of [[-5.75, -6.0], [-4.0, -6.0], [-5.75, -5.27], [-4.0, -5.27]]) piece(x, z, 0.06, 0.06, 0, 0.72, OAK, 0.01, { noLine: true, ...W });
function chair(cx, cz, rot) {   // seat 0.41 x 0.43; rot turns the back to face away from the table
  const g = new THREE.Group(); g.position.set(cx, 0, cz); g.rotation.y = rot; scene.add(g);
  const o = { parent: g, zf: cz, rough: 0.6 };
  piece(0, 0, 0.41, 0.43, 0.42, 0.04, CHARCOAL, 0.01, o);
  piece(0, 0.195, 0.41, 0.04, 0.46, 0.38, CHARCOAL, 0.01, o);
  for (const [x, z] of [[-0.18, -0.19], [0.18, -0.19], [-0.18, 0.19], [0.18, 0.19]]) piece(x, z, 0.03, 0.03, 0, 0.42, CHARCOAL, 0, { ...o, noLine: true });
}
for (const x of [-5.5175, -4.8775, -4.238]) { chair(x, -6.095, Math.PI); chair(x, -5.180, 0); }
chair(-5.843, -5.637, -Math.PI / 2); chair(-3.897, -5.637, Math.PI / 2);
// Styling props: books and ceramics on the console, a tray on the coffee table, a vase on the dining table.
piece(-6.2, -0.40, 0.24, 0.17, 0.450, 0.040, 0x8C6B4E, 0.005);                                                 // stacked books
piece(-6.2, -0.40, 0.22, 0.16, 0.490, 0.035, 0xE6DCCB, 0.005);
piece(-6.2, -0.40, 0.23, 0.17, 0.525, 0.030, 0x5C6E5A, 0.005);
piece(-5.85, -0.40, 0.16, 0.16, 0.45, 0.30, 0xD8CBB6, 0, { round: true, rTop: 0.05, rough: 0.5 });            // ceramic vase
piece(-3.55, -0.42, 0.22, 0.22, 0.45, 0.16, 0x9A5E3A, 0, { round: true, rTop: 0.11, rough: 0.6 });            // terracotta bowl
box(-5.40, -2.0, -5.0, -1.72, 0.36, 0.02, 0x2B2725, 0.01, { rough: 0.4 });                                      // tray
box(-5.36, -1.98, -5.10, -1.80, 0.38, 0.03, 0xE8E0D2, 0.005);                                                   // book on the tray
piece(-4.88, -5.637, 0.14, 0.14, 0.76, 0.26, 0xEDE6DA, 0, { round: true, rTop: 0.045, rough: 0.3 });           // vase on the table
piece(-4.88, -5.637, 0.5, 0.5, 1.02, 0.42, 0xFFFFFF, 0, { geom: plantGeometry(0.42, 14, 0.12, 9), side: THREE.DoubleSide, vcol: true, noLine: true, zf: -5.0 });   // eucalyptus stems
// Two washi paper sphere lanterns over the table (Japandi, owner Nov 2026; were black domes), softly lit, on black cords.
const pendants = [], lanterns = [];
const PEND = SEMID ? { xs: [-5.35, -4.40], z: -5.637 } : { xs: [-5.09, -4.14], z: -1.59 };   // over the dining table (both 1.95 m tables)
for (const x of PEND.xs) {
  piece(x, PEND.z, 0.012, 0.012, 2.41, GF_TOP - 2.41, BLACK, 0, { round: true, noLine: true, zf: PEND.z + 0.6, keep: true });
  lanterns.push(piece(x, PEND.z, 0.46, 0.46, 1.95, 0.46, 0xF3ECE0, 0, { geom: new THREE.SphereGeometry(0.23, 32, 20).translate(0, 0.23, 0), rough: 0.95, emissive: 0x7A5A2E, noLine: true, zf: PEND.z + 0.6, keep: true }));
  const bulb = new THREE.Mesh(new THREE.CircleGeometry(0.075, 32), new THREE.MeshBasicMaterial({ color: 0xFFE7C2, transparent: true, opacity: 0 }));   // the lit opening under the lantern
  bulb.rotation.x = Math.PI / 2; bulb.position.set(x, 1.947, PEND.z); scene.add(bulb); pendants.push(bulb);
}
// A few ceramics (Japandi: minimal decor): a stoneware vase and a charcoal bowl on the dining table and on the TV console.
{
  const vase = (x, z, y) => piece(x, z, 0.15, 0.15, y, 0.26, 0xE9E2D6, 0, { round: true, rTop: 0.045, rough: 0.8, noLine: true, keep: true });
  const bowl = (x, z, y) => piece(x, z, 0.16, 0.16, y, 0.07, 0x45423F, 0, { round: true, rTop: 0.13, rough: 0.6, noLine: true, keep: true });
  if (SEMID) { vase(-4.62, -5.64, 0.75); bowl(-5.15, -5.64, 0.75); vase(-6.25, -0.39, 0.45); bowl(-3.55, -0.39, 0.45); }
  else { vase(-4.35, -1.59, 0.75); bowl(-4.88, -1.59, 0.75); vase(2.40, -7.95, 0.45); bowl(2.40, -5.45, 0.45); }
}

// Dry kitchen: sage cabinets under a quartz top, built-in oven, peninsula with two oak stools, fridge.
box(-6.566, -9.152, -5.962, -7.853, 0, 0.86, SAGE, 0.01, { rough: 0.6 });
box(-5.962, -9.152, -4.464, -8.457, 0, 0.86, SAGE, 0.01, { rough: 0.6 });
box(-6.586, -9.172, -5.942, -7.833, 0.86, 0.04, QUARTZ, 0.006, { rough: 0.3, zf: -7.83 });
box(-5.962, -9.172, -4.434, -8.417, 0.86, 0.04, QUARTZ, 0.006, { rough: 0.3, zf: -8.42 });
box(-6.566, -7.833, -5.916, -6.934, 0, 1.85, STEEL, 0.02, { metal: 0.6, rough: 0.3 });
for (const x of [-5.629, -4.989]) {
  piece(x, -8.40, 0.40, 0.40, 0.62, 0.05, OAK, 0.02, W);
  piece(x, -8.22, 0.40, 0.04, 0.67, 0.30, OAK, 0.01, W);
  piece(x, -8.40, 0.05, 0.05, 0, 0.62, BLACK, 0, { noLine: true, metal: 0.5, rough: 0.4 });
}
// Plants, built leaf by leaf (fiddle-leaf fig style): cupped leaves on a stem, a little colour variation.
function plantGeometry(height, leaves, leafLen, seed = 1) {
  let s = seed * 9973; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const L = leafLen, Wd = leafLen * 0.55, leaf = new THREE.Shape();
  leaf.moveTo(0, 0); leaf.bezierCurveTo(Wd * 0.6, L * 0.15, Wd * 0.55, L * 0.75, 0, L); leaf.bezierCurveTo(-Wd * 0.55, L * 0.75, -Wd * 0.6, L * 0.15, 0, 0);
  const colorize = (g, c) => g.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: g.attributes.position.count }, () => [c.r, c.g, c.b]).flat(), 3));
  const parts = [];
  for (let i = 0; i < leaves; i++) {
    const g = new THREE.ShapeGeometry(leaf, 6), pos = g.attributes.position;
    for (let k = 0; k < pos.count; k++) { const x = pos.getX(k), y = pos.getY(k); pos.setZ(k, -0.35 * x * x / Wd - 0.08 * y * y / L); }
    const h = height * (0.35 + 0.65 * Math.pow(i / leaves, 0.8));
    g.rotateX(-Math.PI / 2 + 0.55 + r() * 0.7);             // tilt out from the stem
    g.rotateY(i * 2.4 + r() * 0.6);                          // golden-angle spiral
    g.translate((r() - 0.5) * 0.1, h, (r() - 0.5) * 0.1);
    g.deleteAttribute('uv'); colorize(g, new THREE.Color(LEAF).offsetHSL((r() - 0.5) * 0.03, (r() - 0.5) * 0.1, (r() - 0.5) * 0.08));
    parts.push(g.toNonIndexed());
  }
  const stem = new THREE.CylinderGeometry(0.012, 0.02, height * 0.95, 6).translate(0, height * 0.475, 0);
  stem.deleteAttribute('uv'); colorize(stem, new THREE.Color(0x6B5843)); parts.push(stem.toNonIndexed());
  const out = mergeGeometries(parts); out.computeVertexNormals(); return out;
}
for (const [x, z, s, seed] of [[-2.70, -0.55, 0.85, 3], [-6.22, -4.15, 1.2, 5]]) {
  piece(x, z, 0.40 * s, 0.40 * s, 0, 0.40 * s, POT, 0, { round: true, rTop: 0.22 * s, rough: 0.85 });
  piece(x, z, 0.8, 0.8, 0.36 * s, 1, 0xFFFFFF, 0, { geom: plantGeometry(1.25 * s, 34, 0.26 * s, seed), side: THREE.DoubleSide, vcol: true, noLine: true, rough: 0.6, zf: z + 0.2 });
}
// Wet kitchen: counter along the outer wall with the double sink and the hob.
box(-6.566, -12.55, -5.966, -9.95, 0, 0.85, COL.wall, 0.01);
box(-6.500, -12.376, -6.017, -11.493, 0.85, 0.005, STEEL, 0, { metal: 0.5 });
box(-6.479, -10.848, -5.982, -10.000, 0.85, 0.008, BLACK, 0);

// Guest bedroom: 1.83 m bed, headboard on the party wall, two bedside tables.
box(-2.144, -11.858, -0.240, -10.031, 0, 0.50, OATMEAL, 0.06);
box(-0.240, -11.858, -0.113, -10.031, 0, 1.10, WALNUT, 0.02);
for (const z of [-11.35, -10.54]) piece(-0.495, z, 0.39, 0.56, 0.50, 0.12, 0xF4EFE7, 0.05);
box(-0.621, -12.508, -0.113, -11.884, 0, 0.50, WALNUT, 0.02);
box(-0.621, -10.005, -0.113, -9.386, 0, 0.50, WALNUT, 0.02);

// ---- First floor, from page 4 of the same furnished plan (left unit) ----
const F = FF_BASE, UP = { ff: true, live: true };
const DUVET = 0xF4EFE7;
function bed(x0, z0, x1, z1, headX, throwC) {        // headboard on the x = headX side
  const toPos = headX > (x0 + x1) / 2, hb = toPos ? [x1, z0 - 0.07, headX, z1 + 0.07] : [headX, z0 - 0.07, x0, z1 + 0.07];
  box(x0, z0, x1, z1, F, 0.30, OAK, 0.02, { ...UP, ...W });                                        // oak base
  box(x0 + 0.02, z0 + 0.02, x1 - 0.02, z1 - 0.02, F + 0.30, 0.22, DUVET, 0.07, { ...UP, ...FAB, noLine: true });   // mattress + duvet
  box(toPos ? x0 + 0.03 : x1 - 0.55, z0 + 0.01, toPos ? x0 + 0.55 : x1 - 0.03, z1 - 0.01, F + 0.52, 0.03, throwC, 0.01, { ...UP, ...FAB, noLine: true });   // throw at the foot
  box(...hb, F, 1.15, BOUCLE, 0.05, { ...UP, ...FAB });                                            // upholstered headboard
  const px = toPos ? x1 - 0.32 : x0 + 0.32, zs = (z1 - z0) / 4;
  for (const z of [z0 + zs, z1 - zs]) piece(px, z, 0.40, Math.min(0.62, (z1 - z0) / 2.2), F + 0.52, 0.15, 0xFFFFFF, 0.06, { ...UP, ...FAB, noLine: true });
}
function bedside(x0, z0, x1, z1) {
  box(x0, z0, x1, z1, F, 0.50, WALNUT, 0.02, { ...UP, ...W });
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  piece(cx, cz, 0.16, 0.16, F + 0.50, 0.22, 0xD9CDBA, 0, { ...UP, round: true, rTop: 0.05 });     // ceramic lamp base
  piece(cx, cz, 0.30, 0.30, F + 0.72, 0.20, 0xF5EEE3, 0, { ...UP, round: true, rTop: 0.12, emissive: 0x3A2A14 });   // linen shade
}
// Master bedroom: 1.83 m bed with its head on the party wall, bench at the foot, TV unit on the bathroom wall,
// wardrobe run along the back, round ottoman in the dressing zone, double vanity / WC / shower in the bath.
bed(-2.144, -3.030, -0.240, -1.203, -0.113, RUST);
bedside(-0.621, -3.66, -0.113, -3.10); bedside(-0.621, -1.13, -0.113, -0.57);
box(-2.723, -2.873, -2.266, -1.355, F, 0.45, LEATHER, 0.05, { ...UP, rough: 0.55 });                // bench
box(-4.840, -3.213, -4.342, -1.015, F, 0.45, OAK, 0.02, { ...UP, ...W });                            // TV unit
box(-4.846, -2.70, -4.818, -1.50, F + 0.95, 0.70, BLACK, 0.01, { ...UP, rough: 0.3, env: 0.15 });   // wall TV
box(-6.266, -6.467, -3.433, -5.867, F, 2.40, OAK, 0.01, { ...UP, ...W, rough: 0.5 });               // wardrobes
piece(-5.611, -4.736, 0.43, 0.43, F, 0.42, CLAY, 0, { ...UP, round: true, ...FAB });                 // ottoman
box(-6.566, -4.081, -5.962, -2.264, F, 0.82, OAK, 0.01, { ...UP, ...W });                            // vanity
box(-6.586, -4.091, -5.942, -2.254, F + 0.82, 0.04, QUARTZ, 0.006, { ...UP, rough: 0.3 });
for (const z of [-3.6, -2.75]) piece(-6.26, z, 0.42, 0.42, F + 0.86, 0.12, 0xFFFFFF, 0, { ...UP, round: true, rTop: 0.2, rough: 0.2 });   // basins
box(-6.566, -1.979, -5.890, -1.456, F, 0.40, 0xFFFFFF, 0.08, { ...UP, rough: 0.2 });                  // WC
box(-6.566, -2.02, -6.40, -1.42, F + 0.40, 0.42, 0xFFFFFF, 0.04, { ...UP, rough: 0.2 });             // cistern
// Bathrooms, from the furnished plan: one-piece WC (tender: ORIN Chara 375 x 690) and wall-hung basin.
const PORC = 0xFBFAF7;
function wc(x0, z0, x1, z1, base, o = {}) { box(x0, z0, x1, z1, base, 0.40, PORC, 0.09, { rough: 0.15, ...o }); }
function basin(x0, z0, x1, z1, base, o = {}) { box(x0, z0, x1, z1, base + 0.70, 0.16, PORC, 0.05, { rough: 0.15, ...o }); }
wc(-3.702, -11.586, -3.032, -11.058, 0); basin(-3.438, -12.266, -3.032, -11.743, 0);                 // GF guest bathroom
wc(-4.296, -13.102, -3.768, -12.427, F, UP); wc(-3.433, -13.102, -2.718, -12.427, F, UP);            // FF rear bathrooms 1 and 2
basin(-3.992, -11.939, -3.581, -11.417, F, UP); basin(-3.428, -11.939, -3.022, -11.417, F, UP);
// Bedroom 1 (rear, outer wall) and Bedroom 2 (rear, party wall): 1.52 m beds, bedsides.
bed(-6.44, -9.83, -4.54, -8.30, -6.566, OLIVE);
bedside(-6.566, -10.45, -6.06, -9.93); bedside(-6.566, -8.20, -6.06, -7.68);
bed(-2.144, -10.37, -0.24, -8.84, -0.113, CLAY);
bedside(-0.621, -10.98, -0.113, -10.47); bedside(-0.621, -8.74, -0.113, -8.23);
// Study corners (added at the client's request, not on the architect's furniture sheet): oak desk on walnut
// side panels, a task chair and a small lamp. Bedroom 1 under the high side window, Bedroom 2 on its free side wall.
function desk(x0, z0, x1, z1, wall) {        // wall: the side the desk backs onto ('-x' | '+x' | '-z' | '+z')
  const alongX = wall === '-z' || wall === '+z', t = 0.03;
  box(x0, z0, x1, z1, F + 0.72, 0.03, OAK, 0.006, { ...UP, ...W });                                   // top
  if (alongX) { box(x0, z0, x0 + t, z1, F, 0.72, WALNUT, 0.004, { ...UP, ...W }); box(x1 - t, z0, x1, z1, F, 0.72, WALNUT, 0.004, { ...UP, ...W }); }
  else { box(x0, z0, x1, z0 + t, F, 0.72, WALNUT, 0.004, { ...UP, ...W }); box(x0, z1 - t, x1, z1, F, 0.72, WALNUT, 0.004, { ...UP, ...W }); }
  const back = wall === '-z' ? [x0, z0, x1, z0 + 0.02] : wall === '+z' ? [x0, z1 - 0.02, x1, z1] : wall === '-x' ? [x0, z0, x0 + 0.02, z1] : [x1 - 0.02, z0, x1, z1];
  box(...back, F + 0.30, 0.42, WALNUT, 0, { ...UP, ...W, noLine: true });                              // modesty panel
  const lx = wall === '-x' ? x0 + 0.14 : wall === '+x' ? x1 - 0.14 : x0 + 0.16, lz = wall === '-z' ? z0 + 0.14 : wall === '+z' ? z1 - 0.14 : z0 + 0.16;
  piece(lx, lz, 0.12, 0.12, F + 0.75, 0.30, BLACK, 0, { ...UP, round: true, rTop: 0.02 });            // lamp stem
  piece(lx, lz, 0.22, 0.22, F + 1.02, 0.12, 0xF5EEE3, 0, { ...UP, round: true, rTop: 0.07, emissive: 0x3A2A14 });   // shade
  // task chair, pulled up to the desk
  const cx = alongX ? (x0 + x1) / 2 + 0.05 : wall === '-x' ? x1 + 0.20 : x0 - 0.20, cz = alongX ? (wall === '-z' ? z1 + 0.20 : z0 - 0.20) : (z0 + z1) / 2 + 0.05;
  box(cx - 0.23, cz - 0.23, cx + 0.23, cz + 0.23, F + 0.44, 0.06, CHARCOAL, 0.02, { ...UP, ...FAB });
  const bk = alongX ? (wall === '-z' ? [cx - 0.22, cz + 0.20, cx + 0.22, cz + 0.24] : [cx - 0.22, cz - 0.24, cx + 0.22, cz - 0.20])
    : (wall === '-x' ? [cx + 0.20, cz - 0.22, cx + 0.24, cz + 0.22] : [cx - 0.24, cz - 0.22, cx - 0.20, cz + 0.22]);
  box(...bk, F + 0.50, 0.42, CHARCOAL, 0.02, { ...UP, ...FAB });
  piece(cx, cz, 0.05, 0.05, F + 0.08, 0.36, BLACK, 0, { ...UP, round: true, noLine: true });          // gas lift
  piece(cx, cz, 0.56, 0.56, F + 0.02, 0.05, BLACK, 0, { ...UP, round: true, rTop: 0.26, noLine: true });   // five-star base
}
desk(-6.30, -11.23, -5.30, -10.68, '-z');     // Bedroom 1
desk(-3.435, -10.55, -2.885, -9.35, '-x');    // Bedroom 2
// ---- Bungalow furniture, measured off pages 1-2 of the architect's furnished layout (bungalow_furniture.json) ----
const carGroup = new THREE.Group(); scene.add(carGroup);
// Cars from the architect's furniture layout. With car.js: an unbranded, detailed modern car (no logos, no text).
const CAR_COLOURS = [0xE9E9E6, 0x3B4248, 0x8C9196, 0x2B3A4F];
let carCount = 0;
function car(x0, z0, x1, z1, y0, color = CAR_COLOURS[carCount++ % CAR_COLOURS.length], front = '+z') {
  const L = Math.max(x1 - x0, z1 - z0), Wd = Math.min(x1 - x0, z1 - z0);
  if (buildCar) try {
    const g = buildCar(THREE, { color, length: Math.min(L, 4.6), width: Math.min(Wd - 0.1, 1.82), style: 'sedan', envMap: scene.environment });
    g.position.set((x0 + x1) / 2, y0, (z0 + z1) / 2);
    g.rotation.y = x1 - x0 > z1 - z0 ? (front === '-x' ? -Math.PI / 2 : Math.PI / 2) : (front === '-z' ? Math.PI : 0);
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    carGroup.add(g); return;
  } catch (e) { console.warn('car', e); }
  const g = new THREE.Group();
  g.position.set((x0 + x1) / 2, y0, (z0 + z1) / 2); if (x1 - x0 > z1 - z0) g.rotation.y = Math.PI / 2; carGroup.add(g);
  const body = new THREE.MeshPhysicalMaterial({ color, roughness: 0.25, metalness: 0.6, clearcoat: 1, clearcoatRoughness: 0.08 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1D2226, roughness: 0.05, metalness: 0.8 });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x1A1A1A, roughness: 0.8 });
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  add(new RoundedBoxGeometry(Wd * 0.96, 0.62, L * 0.98, 4, 0.16), body, 0, 0.62, 0);
  add(new RoundedBoxGeometry(Wd * 0.84, 0.5, L * 0.52, 4, 0.18), glass, 0, 1.08, -L * 0.04);
  add(new RoundedBoxGeometry(Wd * 0.8, 0.06, L * 0.5, 2, 0.03), body, 0, 1.33, -L * 0.04);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const w = add(new THREE.CylinderGeometry(0.33, 0.33, 0.24, 24), tyre, sx * Wd * 0.43, 0.33, sz * L * 0.33); w.rotation.z = Math.PI / 2; }
}
// Semi-D: two cars per porch as drawn, except where the walked unit's open gate leaves swing in (hinges at
// x -5.49 and -1.14, leaves 2.148 m back from z 6.62): there the outer car is left out, so one car is parked.
const OPEN_LEAVES = SEMID ? [[-5.54, 6.62 - 2.2, -5.44, 6.66], [-1.19, 6.62 - 2.2, -1.09, 6.66]] : [];
if (LIB) await Y();   // embedded build: let the hero draw a frame
// ---- Furniture and sanitary ware: the audited lists (8 Apr 2026 layouts, sized against the CAD rooms and standard
// sizes), built by furniture.js: real toilets, basins with taps, vanities, showers, kitchen cabinets, sofas, beds...
const furnGF = new THREE.Group(), furnFF = new THREE.Group(), furnPlan = new THREE.Group(); scene.add(furnGF, furnFF, furnPlan);
const TALL_TOP = 0.9 + 0.55 + 0.75;
const KITCHEN_OAK = 0xDAC6A6;   // Japandi (owner, Nov 2026): light-oak kitchen cabinetry in both homes (was walnut), slim black pulls
const mKitchenWood = new THREE.MeshStandardMaterial({ color: KITCHEN_OAK, map: TEX.wood, roughness: 0.5 });   // tall kitchen units line up with the tops of the wall cabinets (worktop 0.90 + 0.55 gap + 0.75)
hd.use(mKitchenWood, 'oak_veneer', { world: true, rot: 90, dispose: false });   // box faces carry 0..1 uvs: world metres, turned so the grain runs up the doors (TEX.wood is shared)
if (NEWFURN) {
  const list = (SEMID ? SD_FURN : FURN).filter(f => f.kind !== 'car');
  const fctx = { tex: { wood: TEX.wood, weave: TEX.weave, stone: TEX.stone }, envMap: scene.environment, hd: hd.use };
  const rect = f => f.x0 != null ? [Math.min(f.x0, f.x1), Math.min(f.z0, f.z1), Math.max(f.x0, f.x1), Math.max(f.z0, f.z1)] : [f.cx - f.w / 2, f.cz - f.d / 2, f.cx + f.w / 2, f.cz + f.d / 2];
  const inside = (q, r) => { const [a, b, c, d] = rect(q), cx = (a + c) / 2, cz = (b + d) / 2; return cx > r[0] && cx < r[2] && cz > r[1] && cz < r[3]; };
  const MAP = { stool: ['chair', { stool: true }], armchair: ['chair', { armchair: true }], island: ['counter', {}] };
  const planSegs = [];
  for (const f of list) {
    await slice();
    let [kind, extra] = MAP[f.kind] || [f.kind, {}];
    const spec = { ...f, ...extra };
    if (spec.seat_h != null && spec.seatH == null) spec.seatH = spec.seat_h;
    if (!spec.back && !spec.head && !spec.front && f.x0 != null) {   // no orientation given: back onto the nearest wall
      const fr = rect(f), cxm = (fr[0] + fr[2]) / 2, czm = (fr[1] + fr[3]) / 2, walls = (f.floor ? D.ff : D.gf).filter(inZone);
      let best = null;
      const thinX = fr[2] - fr[0] < fr[3] - fr[1];   // a wall panel backs onto one of its long sides, never its thin end (the bungalow maid's headboard)
      for (const [side, dx, dz, edge] of [['-x', -1, 0, fr[0]], ['+x', 1, 0, fr[2]], ['-z', 0, -1, fr[1]], ['+z', 0, 1, fr[3]]].filter(([sd]) => f.kind !== 'panel' || (sd[1] === 'x') === thinX)) {
        let d = 9;
        for (const q of walls) {
          const x0 = Math.min(q[0], q[2]), x1 = Math.max(q[0], q[2]), z0 = Math.min(q[1], q[3]), z1 = Math.max(q[1], q[3]);
          if (dx && czm > z0 && czm < z1) { const dd = dx > 0 ? x0 - edge : edge - x1; if (dd > -0.05) d = Math.min(d, Math.abs(dd)); }
          if (dz && cxm > x0 && cxm < x1) { const dd = dz > 0 ? z0 - edge : edge - z1; if (dd > -0.05) d = Math.min(d, Math.abs(dd)); }
        }
        if (!best || d < best.d) best = { d, side };
      }
      if (best && best.d < 0.4) spec[f.kind === 'bed' ? 'head' : 'back'] = best.side;
    }
    if (spec.task != null && spec.chair == null) spec.chair = !!spec.task;
    if (kind === 'bed' && spec.headboard == null && spec.head) {   // the drawn wall headboard (a panel piece) at its head: no second one on the bed
      const [a, b, c, d] = rect(f), e = 0.03, sd = spec.head, along = sd[1] === 'x', at = along ? (sd[0] === '+' ? c : a) : (sd[0] === '+' ? d : b);
      const wall = list.find(q => { if (q.kind !== 'panel' || !q.floor !== !f.floor) return false; const [p0, p1, p2, p3] = rect(q);
        return along ? p0 - e <= at && at <= p2 + e && Math.min(d, p3) - Math.max(b, p1) > 0.6 * (d - b)
                     : p1 - e <= at && at <= p3 + e && Math.min(c, p2) - Math.max(a, p0) > 0.6 * (c - a); });
      if (wall) { spec.headboard = 0; spec.backTop = (wall.y0 ?? 0) + (wall.h || 1.2) - (f.y0 ?? 0); }
    }
    const r = rect(f), base = f.y0 ?? (f.floor ? FF_BASE : 0), parent = f.floor ? furnFF : furnGF;
    if (kind === 'counter' && spec.wood == null && spec.color == null) spec.wood = KITCHEN_OAK;   // light-oak fronts (islands too)
    if (kind === 'counter') spec.cutouts = list.filter(q => (q.kind === 'sink' || q.kind === 'hob') && inside(q, r)).map(rect);
    let g = null;
    if (!(f.kind === 'fridge' && f.integrated)) try { g = makeFurniture(THREE, kind, spec, fctx); } catch (e) { console.warn('furniture', f.kind, e); }
    if (!g) {   // the few kinds the module doesn't make: upholstered bench / ottoman, potted plant
      g = new THREE.Group();
      const w = r[2] - r[0], d = r[3] - r[1], h = f.h || 0.45;
      if (f.kind === 'fridge' && f.integrated) {   // integrated fridge-freezer: tall oak unit, freezer below, fridge above, cabinet over, slim black pulls
        const H = TALL_TOP, cab = mKitchenWood, brass = new THREE.MeshStandardMaterial({ color: 0x1F1E1D, roughness: 0.45, metalness: 0.5 });
        const fr = { '+x': [1, 0], '-x': [-1, 0], '+z': [0, 1], '-z': [0, -1] }, fc = fr[f.front] || [1, 0], across = fc[0] ? d : w, deep = fc[0] ? w : d;
        const body = new THREE.Mesh(new THREE.BoxGeometry(w, H - 0.1, d), cab); body.position.y = 0.1 + (H - 0.1) / 2; g.add(body);
        const top = (f.floor ? 3.3 : GF_TOP) - H; if (top > 0.03) { const bx = new THREE.Mesh(new THREE.BoxGeometry(w, top - 0.002, d), mWall); bx.position.y = H + top / 2; g.add(bx); }   // box-up to the ceiling
        const plinth = new THREE.Mesh(new THREE.BoxGeometry(fc[0] ? w - 0.06 : w, 0.1, fc[0] ? d : d - 0.06), new THREE.MeshStandardMaterial({ color: 0x2E2B28, roughness: 0.7 }));
        plinth.position.set(-fc[0] * 0.03, 0.05, -fc[1] * 0.03); g.add(plinth);
        for (const [y0, y1, pull] of [[0.1, 0.86, 'top'], [0.86, 1.86, 'bottom'], [1.86, H, 'bottom']]) {   // freezer, fridge, top cabinet
          const dh = y1 - y0 - 0.004, door = new THREE.Mesh(new RoundedBoxGeometry(fc[0] ? 0.02 : across - 0.006, dh, fc[0] ? across - 0.006 : 0.02, 2, 0.003), cab);
          door.position.set(fc[0] * (deep / 2 + 0.01), (y0 + y1) / 2, fc[1] * (deep / 2 + 0.01)); g.add(door);
          const len = Math.min(0.5, dh - 0.12), py = pull === 'top' ? y1 - 0.06 - len / 2 : y0 + 0.06 + len / 2, side = across / 2 - 0.05;
          const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, len, 10), brass);
          bar.position.set(fc[0] * (deep / 2 + 0.045) + (fc[1] ? side : 0), py, fc[1] * (deep / 2 + 0.045) + (fc[0] ? side : 0)); g.add(bar);
        }
      } else if (f.kind === 'oven') {   // tall oak oven tower: built-in oven and a microwave in black glass, steel bars
        const H = TALL_TOP, cab = mKitchenWood;
        const body = new THREE.Mesh(new RoundedBoxGeometry(w, H, d, 2, 0.004), cab); body.position.y = H / 2; g.add(body);
        const fr = { '+x': [1, 0], '-x': [-1, 0], '+z': [0, 1], '-z': [0, -1] }, facing = fr[f.front] || (f.back === '-x' ? [1, 0] : f.back === '+x' ? [-1, 0] : f.back === '+z' ? [0, -1] : [0, 1]);
        const glass = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.12, metalness: 0.5 }), steel = new THREE.MeshStandardMaterial({ color: 0xBEBDB8, roughness: 0.3, metalness: 0.9 });
        for (const [y0, hh] of [[0.78, 0.6], [1.44, 0.38]]) {
          const fw = (facing[0] ? d : w) - 0.06, door = new THREE.Mesh(new THREE.BoxGeometry(facing[0] ? 0.02 : fw, hh, facing[0] ? fw : 0.02), glass);
          door.position.set(facing[0] * (w / 2 + 0.005), y0 + hh / 2, facing[1] * (d / 2 + 0.005)); g.add(door);
          const bar = new THREE.Mesh(new THREE.BoxGeometry(facing[0] ? 0.02 : fw * 0.8, 0.02, facing[0] ? fw * 0.8 : 0.02), steel);
          bar.position.set(facing[0] * (w / 2 + 0.03), y0 + hh - 0.05, facing[1] * (d / 2 + 0.03)); g.add(bar);
        }
      } else if (f.kind === 'plant') {
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(Math.min(w, d) * 0.32, Math.min(w, d) * 0.26, 0.36, 24), new THREE.MeshStandardMaterial({ color: POT, roughness: 0.85 }));
        pot.position.y = 0.18; g.add(pot);
        const pl = new THREE.Mesh(plantGeometry(Math.max(0.6, h - 0.36), 30, 0.26, 1 + Math.abs(Math.round(r[0] * 13)) % 97), new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.6 }));
        pl.position.y = 0.36; g.add(pl);
      } else {
        const round = f.kind === 'ottoman';
        const geo = round ? new THREE.CylinderGeometry(w / 2, w / 2, h, 40) : new RoundedBoxGeometry(w, h, d, 3, 0.04);
        const m = new THREE.Mesh(geo, f.kind === 'bench' ? new THREE.MeshStandardMaterial({ color: 0xDAC6A6, map: TEX.wood, roughness: 0.55 })   // Japandi: a light-oak bench
          : new THREE.MeshStandardMaterial({ color: 0xC6A77A, roughness: 0.8, bumpMap: TEX.weave, bumpScale: 1.2 }));   // and a woven rattan / seagrass ottoman
        m.position.y = h / 2; g.add(m);
      }
      g.position.set((r[0] + r[2]) / 2, f.kind === 'oven' || f.kind === 'fridge' ? (f.floor ? FF_BASE : 0) : base, (r[1] + r[3]) / 2);   // tall units stand on the floor
    }
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    parent.add(g);
    if (!f.floor) { const y = 0.02; planSegs.push(r[0], y, r[1], r[2], y, r[1], r[2], y, r[1], r[2], y, r[3], r[2], y, r[3], r[0], y, r[3], r[0], y, r[3], r[0], y, r[1]); }
  }
  // the furniture as drawn on the plan sheet (ink outlines) until the house turns real
  if (planSegs.length) furnPlan.add(new LineSegments2(new LineSegmentsGeometry().setPositions(planSegs), mInkFurn));
  // Bathrooms: a frameless mirror over every basin and vanity, on the wall behind it.
  const mMirror = new THREE.MeshStandardMaterial({ color: 0xE4E8EA, metalness: 1, roughness: 0.03, envMapIntensity: 1.3 }), mMirrorEdge = new THREE.MeshStandardMaterial({ color: 0xBFC6C8, roughness: 0.2, metalness: 0.6 });
  for (const f of list.filter(q => (q.kind === 'basin' || q.kind === 'vanity' || (q.kind === 'desk' && /dressing/i.test(q.notes || ''))) && q.back && q.x0 != null)) {
    await slice();
    const dress = f.kind === 'desk';   // the master dressing table: a taller mirror over it
    const r = rect(f), fb = f.floor ? FF_BASE : 0, parent = f.floor ? furnFF : furnGF, ax = f.back[1] === 'x' ? 'z' : 'x';
    const wallC = f.back === '-x' ? r[0] : f.back === '+x' ? r[2] : f.back === '-z' ? r[1] : r[3], out = f.back[0] === '-' ? 1 : -1;
    const a0 = ax === 'x' ? r[0] : r[1], a1 = ax === 'x' ? r[2] : r[3], bc = (a0 + a1) / 2, w0 = dress ? Math.min(0.9, a1 - a0 - 0.1) : Math.max(0.5, Math.min(1.2, a1 - a0 + 0.08));
    const y0 = dress ? fb + (f.h || 0.75) + 0.2 : (f.y0 ?? fb) + (f.h || 0.16) + 0.25, y1 = Math.min(y0 + (dress ? 0.95 : 0.8), fb + 2.05);
    let m0 = bc - w0 / 2, m1 = bc + w0 / 2, behind = false;
    for (const o of (f.floor ? D.ff_open : D.gf_open)) {
      const oc = ax === 'x' ? (o.r[1] + o.r[3]) / 2 : (o.r[0] + o.r[2]) / 2, oa0 = ax === 'x' ? Math.min(o.r[0], o.r[2]) : Math.min(o.r[1], o.r[3]), oa1 = ax === 'x' ? Math.max(o.r[0], o.r[2]) : Math.max(o.r[1], o.r[3]);
      if (Math.abs(oc - wallC) > 0.3 || oa0 >= m1 || oa1 <= m0 || fb + (o.sill || 0) >= y1 || fb + o.head <= y0 || oa1 - oa0 > 2.5) continue;   // > 2.5 m: a wall line, not a door
      if (o.win || (o.sill || 0) > 0.3) { behind = true; break; }   // a window behind the basin: no mirror
      if (oa1 <= bc) m0 = Math.max(m0, oa1 + 0.08); else m1 = Math.min(m1, oa0 - 0.08);   // a doorway beside it: trim
    }
    if (behind || m1 - m0 < 0.35) continue;
    const ac = (m0 + m1) / 2, mw = m1 - m0;
    const c = wallC + out * 0.025, gm = ax === 'x' ? [mw, y1 - y0, 0.006] : [0.006, y1 - y0, mw];
    const glass = new THREE.Mesh(new THREE.BoxGeometry(...gm), mMirror); glass.position.set(ax === 'x' ? ac : c, (y0 + y1) / 2, ax === 'x' ? c : ac); parent.add(glass);
    const back = new THREE.Mesh(new THREE.BoxGeometry(ax === 'x' ? mw + 0.006 : 0.012, y1 - y0 + 0.006, ax === 'x' ? 0.012 : mw + 0.006), mMirrorEdge);
    back.position.set(ax === 'x' ? ac : wallC + out * 0.016, (y0 + y1) / 2, ax === 'x' ? wallC + out * 0.016 : ac); parent.add(back);
  }
  // Kitchens: wall cabinets over every counter run on a wall (not across windows or over the hob) and a chimney hood
  // over each hob, up to that room's ceiling.
  const mCab = mKitchenWood, mCabIn = new THREE.MeshStandardMaterial({ color: 0xF2EBDD, roughness: 0.45 });
  const mSteelHood = new THREE.MeshStandardMaterial({ color: 0xD9D8D4, roughness: 0.28, metalness: 0.85 }), mHandle = new THREE.MeshStandardMaterial({ color: 0x1F1E1D, roughness: 0.45, metalness: 0.5 });   // slim satin-black pulls (Japandi)
  for (const f of list.filter(q => q.kind === 'counter' && q.back)) {
    await slice();
    const r = rect(f), base = f.y0 ?? (f.floor ? FF_BASE : 0), parent = f.floor ? furnFF : furnGF, ceil = base + (f.floor ? 3.3 : GF_TOP);
    const ax = f.back === '-x' || f.back === '+x' ? 'z' : 'x';   // the run's direction
    const wallC = f.back === '-x' ? r[0] : f.back === '+x' ? r[2] : f.back === '-z' ? r[1] : r[3], out = f.back[0] === '-' ? 1 : -1;
    const a0 = ax === 'x' ? r[0] : r[1], a1 = ax === 'x' ? r[2] : r[3];
    // only where a wall really stands behind the run (islands and peninsulas get no wall cabinets or hood)
    const backed = (f.floor ? D.ff : D.gf).filter(inZone).some(q => {
      const qa0 = ax === 'x' ? Math.min(q[0], q[2]) : Math.min(q[1], q[3]), qa1 = ax === 'x' ? Math.max(q[0], q[2]) : Math.max(q[1], q[3]);
      const qc0 = ax === 'x' ? Math.min(q[1], q[3]) : Math.min(q[0], q[2]), qc1 = ax === 'x' ? Math.max(q[1], q[3]) : Math.max(q[0], q[2]);
      return Math.min(Math.abs(qc0 - wallC), Math.abs(qc1 - wallC)) < 0.08 && Math.min(qa1, a1) - Math.max(qa0, a0) > 0.4 * (a1 - a0);
    });
    if (!backed) continue;
    const opens = (f.floor ? D.ff_open : D.gf_open).filter(o => { const oc = ax === 'x' ? (o.r[1] + o.r[3]) / 2 : (o.r[0] + o.r[2]) / 2; return Math.abs(oc - wallC) < 0.35; })
      .map(o => ax === 'x' ? [Math.min(o.r[0], o.r[2]), Math.max(o.r[0], o.r[2])] : [Math.min(o.r[1], o.r[3]), Math.max(o.r[1], o.r[3])]);
    const hobs = list.filter(q => q.kind === 'hob' && inside(q, r)).map(q => { const qr = rect(q); return ax === 'x' ? (qr[0] + qr[2]) / 2 : (qr[1] + qr[3]) / 2; });
    // a window in the cross wall at either end of the run: keep the wall cabinets 0.45 m clear of its glass
    const cLo = Math.min(wallC, wallC + out * 0.35), cHi = Math.max(wallC, wallC + out * 0.35);
    const cross = (f.floor ? D.ff_open : D.gf_open).filter(o => o.win).map(o => {
      const oa0 = ax === 'x' ? Math.min(o.r[0], o.r[2]) : Math.min(o.r[1], o.r[3]), oa1 = ax === 'x' ? Math.max(o.r[0], o.r[2]) : Math.max(o.r[1], o.r[3]);
      const oc0 = ax === 'x' ? Math.min(o.r[1], o.r[3]) : Math.min(o.r[0], o.r[2]), oc1 = ax === 'x' ? Math.max(o.r[1], o.r[3]) : Math.max(o.r[0], o.r[2]);
      if (oa1 - oa0 > 0.4 || Math.min(oc1, cHi) - Math.max(oc0, cLo) <= 0) return null;
      if (Math.abs(oa1 - a0) < 0.1) return [oa0, a0 + 0.45];
      if (Math.abs(oa0 - a1) < 0.1) return [a1 - 0.45, oa1];
      return null;
    }).filter(Boolean);
    const talls = list.filter(q => (q.kind === 'oven' || q.kind === 'fridge' || (q.h || 0) > 1.5) && q.x0 != null && inside(q, r)).map(q => { const qr = rect(q); return ax === 'x' ? [qr[0] - 0.02, qr[2] + 0.02] : [qr[1] - 0.02, qr[3] + 0.02]; });
    const blocked = [...opens.map(([u, v]) => [u - 0.05, v + 0.05]), ...cross, ...talls, ...hobs.map(h => [h - 0.46, h + 0.46])].sort((u, v) => u[0] - v[0]);
    const runs = []; let cur = a0;
    for (const [u, v] of blocked) { const e = Math.min(u, a1); if (e > cur + 0.3) runs.push([cur, e]); cur = Math.max(cur, v); }
    if (a1 > cur + 0.3) runs.push([cur, a1]);
    const u0 = base + (f.h || 0.9) + 0.55, u1 = Math.min(ceil - 0.05, u0 + 0.75), dep = 0.35;
    const boxUp = (ra, rb, y0, d) => { if (ceil - y0 < 0.03 || rb - ra < 0.05) return;   // plastered box-up from the cabinet top to the ceiling
      const r = ax === 'x' ? [ra, Math.min(wallC, wallC + out * d), rb, Math.max(wallC, wallC + out * d)] : [Math.min(wallC, wallC + out * d), ra, Math.max(wallC, wallC + out * d), rb];
      block(r, y0, ceil - y0 - 0.002, mWall, parent, null); };
    for (const [ra, rb] of runs) boxUp(ra, rb, u1, dep);
    for (const hc of hobs) boxUp(hc - 0.45, hc + 0.45, u1, dep);
    for (const [ta, tb] of talls) boxUp(ta + 0.02, tb - 0.02, TALL_TOP + base, 0.6);
    for (const [ra, rb] of runs) {
      const n = Math.max(1, Math.round((rb - ra) / 0.6)), mw = (rb - ra) / n;
      const cc = wallC + out * dep / 2;
      const carc = new THREE.Mesh(new THREE.BoxGeometry(ax === 'x' ? rb - ra : dep - 0.02, u1 - u0, ax === 'x' ? dep - 0.02 : rb - ra), mCab);
      carc.position.set(ax === 'x' ? (ra + rb) / 2 : cc - out * 0.01, (u0 + u1) / 2, ax === 'x' ? cc - out * 0.01 : (ra + rb) / 2); parent.add(carc);
      const under = new THREE.Mesh(new THREE.BoxGeometry(ax === 'x' ? rb - ra - 0.03 : dep - 0.04, 0.004, ax === 'x' ? dep - 0.04 : rb - ra - 0.03), mCabIn);
      under.position.set(carc.position.x, u0 - 0.002, carc.position.z); parent.add(under);
      for (let i = 0; i < n; i++) {   // doors with 3 mm seams and a slim black pull at the bottom
        const ca = ra + i * mw + 0.0015, cb = ca + mw - 0.003, fc = wallC + out * (dep - 0.009);
        const door = new THREE.Mesh(new RoundedBoxGeometry(ax === 'x' ? cb - ca : 0.018, u1 - u0 - 0.004, ax === 'x' ? 0.018 : cb - ca, 2, 0.003), mCab);
        door.position.set(ax === 'x' ? (ca + cb) / 2 : fc, (u0 + u1) / 2, ax === 'x' ? fc : (ca + cb) / 2); door.castShadow = true; parent.add(door);
        const hx = i % 2 ? ca + 0.04 : cb - 0.04;
        const pull = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.14, 10), mHandle);
        pull.position.set(ax === 'x' ? hx : fc + out * 0.022, u0 + 0.1, ax === 'x' ? fc + out * 0.022 : hx); parent.add(pull);
      }
    }
    for (const hc of hobs) {   // built-in slim hood (no chimney duct) under a wall cabinet over the hob
      const ha = hc - 0.45, hb = hc + 0.45, hy0 = base + (f.h || 0.9) + 0.65, hy1 = hy0 + 0.12, cc = wallC + out * dep / 2;
      const at = (a, c, y) => ax === 'x' ? [a, y, c] : [c, y, a];
      const sizeOf = (along, across, hh) => ax === 'x' ? [along, hh, across] : [across, hh, along];
      // the cabinet above the hood, same carcass and doors as the run
      const cy0 = hy1 + 0.005, ch = u1 - cy0;
      if (ch > 0.2) {
        const carc = new THREE.Mesh(new THREE.BoxGeometry(...sizeOf(hb - ha, dep - 0.02, ch)), mCab); carc.position.set(...at((ha + hb) / 2, cc - out * 0.01, (cy0 + u1) / 2)); parent.add(carc);
        for (let i = 0; i < 2; i++) {
          const ca = ha + i * 0.45 + 0.0015, cb = ca + 0.45 - 0.003, fcz = wallC + out * (dep - 0.009);
          const door = new THREE.Mesh(new RoundedBoxGeometry(...sizeOf(cb - ca, 0.018, ch - 0.004), 2, 0.003), mCab); door.position.set(...at((ca + cb) / 2, fcz, (cy0 + u1) / 2)); door.castShadow = true; parent.add(door);
          const pull = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.14, 10), mHandle); pull.position.set(...at(i ? ca + 0.04 : cb - 0.04, fcz + out * 0.022, cy0 + 0.1)); parent.add(pull);
        }
      }
      // the hood: stainless body flush with the cabinets, a slim pull-out visor, filters and a lamp underneath
      const body = new THREE.Mesh(new THREE.BoxGeometry(...sizeOf(hb - ha - 0.004, dep - 0.03, hy1 - hy0)), mSteelHood); body.position.set(...at((ha + hb) / 2, cc - out * 0.015, (hy0 + hy1) / 2)); body.castShadow = true; parent.add(body);
      const visor = new THREE.Mesh(new THREE.BoxGeometry(...sizeOf(hb - ha - 0.01, 0.06, 0.035)), mSteelHood); visor.position.set(...at((ha + hb) / 2, wallC + out * (dep + 0.02), hy0 + 0.0175)); parent.add(visor);
      const filt = new THREE.Mesh(new THREE.BoxGeometry(...sizeOf(hb - ha - 0.08, dep - 0.1, 0.004)), new THREE.MeshStandardMaterial({ color: 0x55534F, roughness: 0.5, metalness: 0.6 })); filt.position.set(...at((ha + hb) / 2, cc, hy0 - 0.002)); parent.add(filt);
      for (const k of [-0.25, 0.25]) { const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.025, 16), new THREE.MeshBasicMaterial({ color: 0xFFE6C0 })); lamp.rotation.x = Math.PI / 2; lamp.position.set(...at(hc + k, wallC + out * (dep - 0.06), hy0 - 0.005)); parent.add(lamp); }
    }
  }
}
// Open light-oak shelving under the Semi-D's first flight (owner, Nov 2026: "open shelving on the stairs"; Japandi oak): from its fourth
// step the flight is a slab, and the space below, open to the dining side, holds 400 mm deep shelves in bays that step
// up with the stair, a light-oak back panel, and a few books and vases. Both units (mirrored). The bungalow's flights sit
// over its utility room or between walls, so it has no open under-stair side to shelve.
if (SEMID) {
  const run = STAIR.steps.filter(c => c.flight === 1 && !c.solid && c.nl), land = STAIR.steps.find(c => c.land);
  if (run.length > 1 && land) {
    const c = run[0], d = run[run.length - 1], RISE = X.stair.riser || 0.176;
    const zF = c.aF, zB = d.aB, yF = c.top - 0.2 - RISE, yB = d.top + d.rise - 0.2 - RISE, soff = z => yF + (yB - yF) * (z - zF) / (zB - zF);
    const xo = c.x0, xb = c.x0 + 0.4, xi = c.x1, T = 0.025, P = 0.07;   // open face, back panel, far side; board, plinth
    const n = Math.max(3, Math.round((zF - zB) / 0.62)), bw = (zF - zB) / n;
    const mDark = new THREE.MeshStandardMaterial({ color: 0x2E2B28, roughness: 0.7 });
    let seed = 7; const rr = () => (seed = (seed * 16807) % 2147483647) / 2147483647;   // its own repeatable sequence
    const BOOK = [0xE3DACB, 0xB9AD99, 0x8E9484, 0x5B5853, 0xCFC3AE, 0x6E7566, 0xA89A86];   // Japandi: linen, greige, sage, charcoal spines
    const mBooks = BOOK.map(col => new THREE.MeshStandardMaterial({ color: col, roughness: 0.8 }));
    const mCeram = [new THREE.MeshStandardMaterial({ color: 0xE9E2D6, roughness: 0.8 }), new THREE.MeshStandardMaterial({ color: 0x45423F, roughness: 0.6 })];   // matt stoneware
    for (const sgn of [1, -1]) {
      const host = NEWFURN ? furnGF : gfDetail;   // with the furniture, like the stair cabinets
      const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(sgn * x, y, z); m.castShadow = m.receiveShadow = true; host.add(m); return m; };
      const box3 = (x0, x1, y0, y1, z0, z1, mat) => add(new THREE.BoxGeometry(x1 - x0, y1 - y0, Math.abs(z1 - z0)), mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      const panel = (x0, x1, za, zb, y0, mat) => {   // a board in the z-y plane, its top on the soffit slope
        const sh = new THREE.Shape([new THREE.Vector2(zb, y0), new THREE.Vector2(za, y0), new THREE.Vector2(za, soff(za) - 0.004), new THREE.Vector2(zb, soff(zb) - 0.004)]);
        const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: x1 - x0, bevelEnabled: false }), mat);
        m.rotation.y = -Math.PI / 2; m.position.set(Math.max(sgn * x0, sgn * x1), 0, 0); m.castShadow = m.receiveShadow = true; host.add(m); return m;
      };
      panel(xb, xb + 0.018, zF, zB, 0, mKitchenWood);                                      // back panel
      box3(xo, xi, 0, land.top - 0.15, zB - 0.02, zB, mWall);                              // closes the end under the landing
      box3(xo + 0.05, xb, 0, P, zB, zF, mDark);                                            // plinth, 50 mm back
      box3(xo, xb, P, P + T, zB, zF, mKitchenWood);                                        // base board
      for (let i = 0; i <= n; i++) {                                                       // dividers, up to the soffit
        const z = zF - i * bw, za = Math.min(zF, z + T / 2), zb = Math.max(zB, z - T / 2);
        panel(xo, xb, za, zb, P + T, mKitchenWood);
      }
      seed = 7;
      for (let i = 0; i < n; i++) {
        const z1 = zF - i * bw - T / 2, z0 = zF - (i + 1) * bw + T / 2, low = soff(zF - i * bw);
        const levels = [P + T]; for (let y = 0.42; y + 0.24 < low; y += 0.38) { box3(xo + 0.01, xb, y, y + T, z0, z1, mKitchenWood); levels.push(y + T); }
        for (const [k, y] of levels.entries()) {   // dress about half the shelves: a row of books, or a vase or two
          const room = (k + 1 < levels.length ? levels[k + 1] - T : low) - y; if (room < 0.22 || rr() < 0.45) continue;
          if (rr() < 0.6) {
            let z = z1 - 0.04 - rr() * 0.1; const stop = z - (0.12 + rr() * 0.22);
            while (z > Math.max(stop, z0 + 0.03)) { const t = 0.022 + rr() * 0.02, h = Math.min(room - 0.03, 0.2 + rr() * 0.08), dd = 0.16 + rr() * 0.06;
              box3(xo + 0.38 - dd, xo + 0.38, y, y + h, z - t, z, mBooks[(rr() * BOOK.length) | 0]); z -= t + 0.002; }
          } else {
            const h = Math.min(room - 0.04, 0.16 + rr() * 0.12), r = 0.045 + rr() * 0.03, zc = z0 + 0.12 + rr() * (z1 - z0 - 0.24);
            add(new THREE.CylinderGeometry(r * 0.7, r, h, 20), mCeram[rr() < 0.7 ? 0 : 1], xo + 0.2, y + h / 2, zc);
          }
        }
      }
    }
  }
}
// Built-in light-oak cabinetry in the recess beside the stair, under the top flight (owner, Nov 2026; Japandi oak): floor to the beam
// or stair soffit, a dark plinth, a shadow gap under the plastered head, flush doors with slim black pulls.
const STAIR_CABINETS = SEMID ? [
  { r: [-3.035, -6.842, -1.115, -6.465], back: '-z', top: 3.20,   // dining wall under flight 2, front flush with the downstand beam
    heads: [[-3.033, -6.840, -2.241, -6.617, 3.20, 3.498], [-2.239, -6.840, -1.117, -6.467, 3.20, 3.498]] },
] : [
  { r: [1.12, -5.72, 2.02, -5.32], back: '-z', top: 3.10,         // hall wall under flight 3, between the stringer and the living-room wall
    heads: [[1.122, -5.718, 2.018, -5.322, 3.10, 3.318], [1.122, -5.463, 2.018, -5.322, 3.318, 3.498]] },
];
if (NEWFURN) {
  const brass = new THREE.MeshStandardMaterial({ color: 0x1F1E1D, roughness: 0.45, metalness: 0.5 });   // satin black (Japandi; name kept)
  const mPlinth = new THREE.MeshStandardMaterial({ color: 0x2E2B28, roughness: 0.7 }), mGap = new THREE.MeshStandardMaterial({ color: 0x1C1A18, roughness: 0.9 });
  for (const c of STAIR_CABINETS) {
    const ax = c.back === '-x' || c.back === '+x' ? 'z' : 'x', out = c.back[0] === '-' ? 1 : -1;
    const wallC = c.back === '-x' ? c.r[0] : c.back === '+x' ? c.r[2] : c.back === '-z' ? c.r[1] : c.r[3];
    const a0 = (ax === 'x' ? c.r[0] : c.r[1]) + 0.002, a1 = (ax === 'x' ? c.r[2] : c.r[3]) - 0.002, w = a1 - a0, am = (a0 + a1) / 2;
    const F = Math.abs(ax === 'x' ? c.r[3] - c.r[1] : c.r[2] - c.r[0]) - 0.002;   // door face, out from the wall
    const at = (a, d, y) => ax === 'x' ? [a, y, wallC + out * d] : [wallC + out * d, y, a];
    const size = (along, across, h) => ax === 'x' ? [along, h, across] : [across, h, along];
    const add = (geo, mat, a, d, y) => { const m = new THREE.Mesh(geo, mat); m.position.set(...at(a, d, y)); m.castShadow = m.receiveShadow = true; furnGF.add(m); return m; };
    const P = 0.10, G = 0.015, T = c.top - 0.002, split = 2.20;   // plinth, top shadow gap, top, lower / upper door line
    add(new THREE.BoxGeometry(...size(w, F - 0.052, P)), mPlinth, am, 0.002 + (F - 0.052) / 2, P / 2);              // plinth, 50 mm back
    add(new THREE.BoxGeometry(...size(w, F - 0.02, T - G - P)), mKitchenWood, am, 0.002 + (F - 0.02) / 2, (P + T - G) / 2);   // carcass
    add(new THREE.BoxGeometry(...size(w, F - 0.042, G)), mGap, am, 0.002 + (F - 0.042) / 2, T - G / 2);             // shadow gap under the head
    const n = Math.max(1, Math.round(w / 0.5)), dw = w / n;
    for (const [y0, y1, upper] of [[P, split, false], [split, T - G, true]]) {
      for (let i = 0; i < n; i++) {   // flush doors, 3 mm seams; pulls on the meeting edges of each pair
        const ca = a0 + i * dw + 0.0015, cb = ca + dw - 0.003, dy0 = y0 + 0.0015, dy1 = y1 - 0.0015;
        add(new RoundedBoxGeometry(...size(cb - ca, 0.018, dy1 - dy0), 2, 0.003), mKitchenWood, (ca + cb) / 2, F - 0.009, (dy0 + dy1) / 2);
        const len = upper ? 0.14 : 0.32, hx = n === 1 ? cb - 0.04 : i % 2 ? ca + 0.035 : cb - 0.035;
        add(new THREE.CylinderGeometry(0.006, 0.006, len, 10), brass, hx, F + 0.022, upper ? y0 + 0.1 : 1.05);
      }
    }
    for (const h of c.heads) block([h[0], h[1], h[2], h[3]], h[4], h[5] - h[4], mWall, furnGF, null);   // plastered head over the recess
  }
}
const leafHit = c => OPEN_LEAVES.some(r => c.x0 < r[2] && c.x1 > r[0] && c.z0 < r[3] && c.z1 > r[1]);
for (const c of CARS) {
  await slice();
  if (leafHit(c)) continue;
  let { x0, x1 } = c;
  // the walked unit parks its one car in the outer bay (clear of the open gate leaf), not in front of the front door
  if (SEMID && c.unit === 'left' && CARS.some(o => o !== c && o.unit === c.unit && leafHit(o))) { const w = x1 - x0; x0 = OPEN_LEAVES[0][2] + 0.08; x1 = x0 + w; }
  car(x0, c.z0, x1, c.z1, GROUND, undefined, c.front);
}
if (!SEMID) {
  BUNG_PIECE = true;
  const C = { counter: SAGE, sink: STEEL, hob: BLACK, fridge: STEEL, chair: CHARCOAL, table: OAK, tv_console: OAK, tv_stand: BLACK, tv: BLACK, rug: JUTE,
    round: TRAVERTINE, sofa: BOUCLE, bed: OAK, panel: BOUCLE, bedside: WALNUT, lamp: 0xF5EEE3, wc: PORC, basin: PORC, bath: PORC, wardrobe: OAK, tank: 0x8E989C };
  for (const f of FURN) {
    await slice();
    if (f.kind === 'floor_trap' || f.kind === 'shower') continue;
    const x0 = f.x0 ?? f.cx - f.w / 2, x1 = f.x1 ?? f.cx + f.w / 2, z0 = f.z0 ?? f.cz - f.d / 2, z1 = f.z1 ?? f.cz + f.d / 2;
    const base = f.y0 ?? (f.floor ? FF_BASE : 0), h = Math.max(f.h || 0.02, 0.012), o = { live: true, ff: f.floor === 1, rot: f.rot || 0 };
    if (f.kind === 'car') { car(x0, z0, x1, z1, base, undefined, f.front || '+z'); continue; }
    if (NEWFURN) continue;   // drawn by furniture.js below
    if (f.kind === 'counter') { box(x0, z0, x1, z1, base, h - 0.04, SAGE, 0.01, { ...o, rough: 0.6 }); box(x0 - 0.01, z0 - 0.01, x1 + 0.01, z1 + 0.01, base + h - 0.04, 0.04, QUARTZ, 0.006, { ...o, rough: 0.3 }); continue; }
    if (f.kind === 'sofa') {
      box(x0, z0, x1, z1, base, 0.40, BOUCLE, 0.05, { ...o, ...FAB });
      const b = f.back || '+x', t = 0.22;
      const br = b === '+x' ? [x1 - t, z0, x1, z1] : b === '-x' ? [x0, z0, x0 + t, z1] : b === '+z' ? [x0, z1 - t, x1, z1] : [x0, z0, x1, z0 + t];
      box(...br, base + 0.40, 0.42, BOUCLE, 0.08, { ...o, ...FAB }); continue;
    }
    if (f.kind === 'bed') {
      box(x0, z0, x1, z1, base, 0.30, OAK, 0.02, { ...o, ...W });
      const m = f.mattress || [x0 + 0.03, z0 + 0.03, x1 - 0.03, z1 - 0.03];
      box(m[0], m[1], m[2], m[3], base + 0.30, 0.22, DUVET, 0.07, { ...o, ...FAB, noLine: true }); continue;
    }
    if (f.kind === 'chair') {
      box(x0, z0, x1, z1, base + 0.42, 0.04, CHARCOAL, 0.01, o);
      const b = f.back, t = 0.04, br = b === '+x' ? [x1 - t, z0, x1, z1] : b === '-x' ? [x0, z0, x0 + t, z1] : b === '-z' ? [x0, z0, x1, z0 + t] : [x0, z1 - t, x1, z1];
      box(...br, base + 0.46, 0.40, CHARCOAL, 0.01, o);
      for (const [px, pz] of [[x0 + 0.03, z0 + 0.03], [x1 - 0.03, z0 + 0.03], [x0 + 0.03, z1 - 0.03], [x1 - 0.03, z1 - 0.03]]) piece(px, pz, 0.03, 0.03, base, 0.42, CHARCOAL, 0, { ...o, noLine: true });
      continue;
    }
    if (f.kind === 'table') { box(x0, z0, x1, z1, base + h - 0.04, 0.04, OAK, 0.01, { ...o, ...W }); for (const [px, pz] of [[x0 + 0.08, z0 + 0.08], [x1 - 0.08, z0 + 0.08], [x0 + 0.08, z1 - 0.08], [x1 - 0.08, z1 - 0.08]]) piece(px, pz, 0.06, 0.06, base, h - 0.04, OAK, 0.01, { ...o, ...W, noLine: true }); continue; }
    const round = !!f.round || f.kind === 'lamp';
    const extra = f.kind === 'tv' ? { rough: 0.3, env: 0.15 } : f.kind === 'wardrobe' || f.kind === 'tv_console' || f.kind === 'bedside' ? W : f.kind === 'rug' ? { bump: TEX.weave, bumpScale: 2, rough: 1 } : f.kind === 'wc' || f.kind === 'basin' || f.kind === 'bath' ? { rough: 0.15 } : {};
    if (round) piece((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, base, h, C[f.kind] ?? OAK, 0, { ...o, round: true, ...extra });
    else box(x0, z0, x1, z1, base, h, C[f.kind] ?? OAK, f.kind === 'wc' ? 0.09 : 0.02, { ...o, ...extra });
  }
  BUNG_PIECE = false;
}

if (LIB) await Y();   // embedded build: let the hero draw a frame
// Sheer linen curtains on ripple-fold tracks, drawn to the sides of the big glass doors.
const mSheer = new THREE.MeshPhysicalMaterial({ color: 0xF1EADF, roughness: 0.95, sheen: 1, sheenRoughness: 0.7, sheenColor: 0xFFFFFF,
  side: THREE.DoubleSide, transparent: true, opacity: 0.9, bumpMap: TEX.weave, bumpScale: 0.6 });
const mTrack = new THREE.MeshStandardMaterial({ color: 0x24211F, roughness: 0.4, metalness: 0.5 });
// One stacked panel: width w along the wall, hanging from y0 to y1, folds of ~110 mm, 90 mm deep.
function curtainPanel(w, y0, y1) {
  const folds = Math.max(3, Math.round(w / 0.11)), g = new THREE.PlaneGeometry(w, y1 - y0, folds * 10, 24), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), t = (x / w + 0.5) * folds * Math.PI * 2;
    const hem = 1 - 0.25 * Math.max(0, (-(y) / (y1 - y0) - 0.35));               // folds open slightly toward the hem
    p.setZ(i, Math.sin(t) * 0.045 * hem + Math.sin(t * 0.5 + y * 3) * 0.006);
  }
  g.computeVertexNormals(); g.translate(0, (y0 + y1) / 2, 0); return g;
}
// [wall axis, wall inner-face line, opening a0, a1, floor y, inward sign]
const CURTAINS = SEMID ? [
  ['z', -6.57, -3.70, -0.75, 0, 1, fixGF],       // living-room patio doors (west wall)
  ['z', -6.57, -6.842, -5.042, 0, 1, fixGF],     // dining patio doors
  ['x', -0.15, -4.672, -2.515, F, -1, fixFF],    // master bedroom balcony doors (front wall)
] : X.openings.filter(s => (s.kind === 'slider' || s.kind === 'folding') && s.a1 - s.a0 > 1.4).map(s => {
  const mid = (s.c0 + s.c1) / 2, inward = s.axis === 'x' ? (mid > HCZ ? -1 : 1) : (mid > HCX ? -1 : 1);
  return [s.axis, inward < 0 ? s.c0 : s.c1, s.a0, s.a1, s.floor ? FF_BASE : 0, inward, s.floor ? fixFF : fixGF];
});
for (const [ax, c, a0, a1, base, inward, parent] of CURTAINS) {
  const top = base + 2.98, stack = 0.55, off = c + inward * 0.11;
  for (const [s0, s1] of [[a0 - 0.30, a0 - 0.30 + stack], [a1 + 0.30 - stack, a1 + 0.30]]) {
    const m = new THREE.Mesh(curtainPanel(s1 - s0, base + 0.02, top - 0.03), mSheer);
    if (ax === 'z') { m.rotation.y = Math.PI / 2; m.position.set(off, 0, (s0 + s1) / 2); } else m.position.set((s0 + s1) / 2, 0, off);
    m.castShadow = true; m.receiveShadow = true; parent.add(m);
  }
  const t = new THREE.Mesh(new THREE.BoxGeometry(ax === 'z' ? 0.03 : a1 - a0 + 0.7, 0.03, ax === 'z' ? a1 - a0 + 0.7 : 0.03), mTrack);
  t.position.set(ax === 'z' ? off : (a0 + a1) / 2, top, ax === 'z' ? (a0 + a1) / 2 : off); parent.add(t);
}
// Tall, near-full-height windows (sill <= 0.5 m, 2 m+ of glass; owner, Nov 2026): a floor-length sheer drawn across on a
// slim ceiling track instead of a venetian blind, both homes.
const tallWin = o => o.kind === 'window' && o.sill - (o.floor ? FF_BASE : 0) <= 0.5 && o.head - o.sill >= 2.0;
for (const o of X.openings.filter(o => tallWin(o) && (SEMID ? o.a1 <= 0.01 || o.axis === 'z' && Math.min(o.c0, o.c1) < 0 : true))) {
  const mid = (o.c0 + o.c1) / 2, inward = o.axis === 'x' ? (mid > HCZ ? -1 : 1) : (mid > HCX ? -1 : 1), base = o.floor ? FF_BASE : 0;
  const c = inward < 0 ? Math.min(o.c0, o.c1) : Math.max(o.c0, o.c1), off = c + inward * 0.1, top = base + 2.98, parent = o.floor ? fixFF : fixGF;
  const s0 = o.a0 - 0.15, s1 = o.a1 + 0.15;
  const m = new THREE.Mesh(curtainPanel(s1 - s0, base + 0.02, top - 0.03), mSheer);
  if (o.axis === 'z') { m.rotation.y = Math.PI / 2; m.position.set(off, 0, (s0 + s1) / 2); } else m.position.set((s0 + s1) / 2, 0, off);
  m.castShadow = true; m.receiveShadow = true; parent.add(m);
  const t = new THREE.Mesh(new THREE.BoxGeometry(o.axis === 'z' ? 0.03 : s1 - s0 + 0.1, 0.03, o.axis === 'z' ? s1 - s0 + 0.1 : 0.03), mTrack);
  t.position.set(o.axis === 'z' ? off : (s0 + s1) / 2, top, o.axis === 'z' ? (s0 + s1) / 2 : off); parent.add(t);
}

// The estate's other homes (pack bake only): a pale sheer just inside every window and glass door, drawn about two
// thirds across, with a faint warm glow, so from the estate the houses read as lived in, not empty glass (owner, Nov
// 2026: "give curtains to the houses ... so that in 3d the houses not look empty"). A few triangles each: a light
// zigzag of folds, not the tour's full curtain. The walked homes keep their own curtains and blinds.
const extSheer = new THREE.Group(); extSheer.name = 'extSheer'; scene.add(extSheer);
if (PACKBAKE) {
  const mExtSheer = new THREE.MeshStandardMaterial({ color: 0xF0E8DC, roughness: 0.95, side: THREE.DoubleSide, emissive: 0xFFD9A8, emissiveIntensity: 0.22 });
  mExtSheer.name = 'ext-sheer';
  const zig = (w, h, folds) => {   // a vertical zigzag: folds x 2 strips of 2 triangles
    const P = [], n = folds * 2;
    for (let i = 0; i < n; i++) {
      const x0 = -w / 2 + w * i / n, x1 = -w / 2 + w * (i + 1) / n, z0 = i % 2 ? 0.035 : 0, z1 = i % 2 ? 0 : 0.035;
      P.push(x0, 0, z0, x1, 0, z1, x1, h, z1, x0, 0, z0, x1, h, z1, x0, h, z0);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.computeVertexNormals(); return g;
  };
  X.openings.filter(o => o.kind === 'window' || o.kind === 'slider' || o.kind === 'fixed').forEach((o, i) => {
    const mid = (o.c0 + o.c1) / 2, inward = o.axis === 'x' ? (mid > HCZ ? -1 : 1) : (mid > HCX ? -1 : 1);
    const c = inward < 0 ? Math.min(o.c0, o.c1) : Math.max(o.c0, o.c1), off = c + inward * 0.09;
    const span = o.a1 - o.a0, w = span * (0.6 + (i % 3) * 0.06), left = i % 2 === 0;
    const y0 = Math.max(o.sill, (o.floor ? FF_BASE : 0)) + 0.03, y1 = o.head - 0.04; if (y1 - y0 < 0.4 || w < 0.3) return;
    const m = new THREE.Mesh(zig(w, y1 - y0, Math.max(2, Math.round(w / 0.35))), mExtSheer);
    const along = left ? o.a0 + w / 2 + 0.02 : o.a1 - w / 2 - 0.02;
    if (o.axis === 'z') { m.rotation.y = Math.PI / 2; m.position.set(off, y0, along); } else m.position.set(along, y0, off);
    extSheer.add(m);
  });
}

// First-floor ceiling at +7.20 (bedrooms 3.50 clear), open over the party-wall strip and stair void.
// Split the house rectangle around holes into plain rects (slabs, ceilings, floor finishes).
function rectsMinus(holes, inset = 0) {
  const out = [], zs = [HOUSE.z0, HOUSE.z1, ...holes.flatMap(h => [h[1], h[3]])].filter(z => z >= HOUSE.z0 && z <= HOUSE.z1).sort((a, b) => a - b);
  for (let i = 0; i < zs.length - 1; i++) {
    const z0 = zs[i], z1 = zs[i + 1]; if (z1 - z0 < 0.01) continue;
    let xs = [[HOUSE.x0 + inset, HOUSE.x1 - inset]];
    for (const h of holes) if (h[1] < z1 - 0.01 && h[3] > z0 + 0.01) xs = xs.flatMap(([a, b]) => (h[2] <= a || h[0] >= b) ? [[a, b]] : [[a, h[0]], [h[2], b]].filter(([p, q]) => q - p > 0.01));
    for (const [a, b] of xs) out.push([a, z0, b, z1]);
  }
  return out;
}
if (SEMID) for (const r of [[-6.72, -13.255, 6.72, -10.466], [-6.72, -2.789, 6.72, 0], [-6.72, -10.466, -1.615, -2.789], [1.615, -10.466, 6.72, -2.789]]) ffBlock(r, 7.20, 0.045, mSlab, mInkSoft);
else for (const r of rectsMinus([...X.voids, ...OUT_FF, ...X.ff_top.zones.map(z => z.r)])) ffBlock(r, X.levels.ff_ceiling || 7.0, 0.045, mSlab, mInkSoft);
if (!SEMID && X.ceilings) {   // Bungalow: the right wing's flat plaster false ceiling at 3.00 (section BB HEIGHT 3.000), hiding the 3.15 beams
  const fc = X.ceilings.GF.filter(c => c.ceiling === 3.0).map(c => c.r);
  for (const r of fc) ffBlock(r, 3.0, 0.02, mSlab, mInkSoft);
  for (const o of D.gf_open) {   // a bulkhead closes any opening into that wing that runs up past the false ceiling
    const cx = (o.r[0] + o.r[2]) / 2, cz = (o.r[1] + o.r[3]) / 2;
    if (o.head > 3.0 && fc.some(r => Math.abs(cx - r[0]) < 0.2 && cz > r[1] && cz < r[3])) ffBlock(o.r, 3.0, o.head - 3.0, mWall);
  }
}

if (LIB) await Y();   // embedded build: let the hero draw a frame
// Light fittings at the electrician's points (E-01 LGT/SSO/1, Mar 2026, verified): flush ceiling lights,
// the living-room ceiling fan, the stair wall light, the porch and patio lights. Left unit, as walked.
const downs = [], outdoorGlow = [];
const mHousing = new THREE.MeshStandardMaterial({ color: 0xF4F1EC, roughness: 0.5 });
// Lights ON: each fitting's lens glows warm white (HDR, so the lamps themselves bloom) with a soft halo on the ceiling
// around it; the real light comes from a small pool of warm spotlights that sit in the fittings nearest the camera and
// aim down (a flush fitting sends no light up onto its own ceiling), see apply().
// fixtures: { p: pool position, d: aim direction, fl: storey, shared: serves both storeys (stair / void), I: intensity, a: cone }
const fixtures = [];
const VOIDS = [...(X.voids || []), ...((X.double_height || []).map(v => v.r))];
const inVoid = (x, z) => VOIDS.some(v => x > Math.min(v[0], v[2]) && x < Math.max(v[0], v[2]) && z > Math.min(v[1], v[3]) && z < Math.max(v[1], v[3]));
const LENS = new THREE.Color(0xFFF2DE).multiplyScalar(3), WGLOW = new THREE.Color(0xFFE3B8).multiplyScalar(3);
const haloTex = canvasTex(128, (g, n) => { const gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); gr.addColorStop(0, 'rgba(255,226,180,0.85)'); gr.addColorStop(0.35, 'rgba(255,214,160,0.28)'); gr.addColorStop(1, 'rgba(255,210,150,0)'); g.fillStyle = gr; g.fillRect(0, 0, n, n); }, { repeat: 1 });
haloTex.wrapS = haloTex.wrapT = THREE.ClampToEdgeWrapping;
// Recessed eyeball downlights (owner, Nov 2026: "ceiling lights can use eyeball lights?"), every ceiling point in both
// homes: a 110 mm white trim ring flush with the ceiling, a dark recess, and a white gimbal ball dropping just below it,
// tilted a little, its small lens glowing when the lights come on.
const EYE_R = 0.055;   // trim radius (also sets the drop under a sloped soffit)
const EYE = { trim: new THREE.CylinderGeometry(EYE_R, EYE_R, 0.006, 32), hole: new THREE.CircleGeometry(0.044, 28),
  ball: new THREE.SphereGeometry(0.036, 24, 14), lens: new THREE.CircleGeometry(0.019, 20) };
const mEyeHole = new THREE.MeshStandardMaterial({ color: 0x2A2724, roughness: 0.8 });
function ceilingLight(x, z, y, outdoor = false, parent = y > 5 ? fixFF : fixGF, halo = 1.5) {
  const tr = new THREE.Mesh(EYE.trim, mHousing); tr.position.set(x, y - 0.003, z); parent.add(tr);
  const hole = new THREE.Mesh(EYE.hole, mEyeHole); hole.rotation.x = Math.PI / 2; hole.position.set(x, y - 0.0065, z); parent.add(hole);
  const eye = new THREE.Group(); eye.position.set(x, y - 0.012, z);
  eye.rotation.set(0.14 * Math.sin(x * 3.1 + z), 0, 0.14 * Math.cos(x * 1.7 - z * 2.3)); parent.add(eye);   // aimed a little, each its own way
  const ball = new THREE.Mesh(EYE.ball, mHousing); ball.scale.y = 0.85; eye.add(ball);
  const d = new THREE.Mesh(EYE.lens, new THREE.MeshBasicMaterial({ color: LENS, transparent: true, opacity: 0 }));
  d.rotation.x = Math.PI / 2; d.position.y = -0.0315; eye.add(d); (outdoor ? outdoorGlow : downs).push(d);
  halo *= 0.7;   // a smaller, tighter glow on the ceiling round a small fitting
  const hl = new THREE.Mesh(new THREE.PlaneGeometry(halo, halo), new THREE.MeshBasicMaterial({ map: haloTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  hl.rotation.x = Math.PI / 2; hl.position.set(x, y - 0.007, z); if (halo > 0) { parent.add(hl); (outdoor ? outdoorGlow : downs).push(hl); }
  if (outdoor) return;
  const v = inVoid(x, z);   // over a double-height void: its pool light hangs in the void at first-floor ceiling level, for both storeys
  fixtures.push({ p: V(x, v ? Math.min(y - 0.05, 4.2) : y - 0.05, z), d: V(0, -1, 0), fl: y > 5 ? 1 : 0, shared: v, I: 7.5, a: 1.15 });
}
const LIGHT_POOL = Array.from({ length: HIFI ? 6 : 3 }, () => { const l = new THREE.SpotLight(0xFFD2A0, 0, 7, 1.15, 0.8, 2); l.castShadow = false; scene.add(l, l.target); return l; });
// Is there a wall of that storey on the straight line (in plan) between the camera and a fitting? (slab test per wall)
const WALLS2D = [0, 1].map(fl => (fl ? D.ff : D.gf).filter(inZone).map(q => [Math.min(q[0], q[2]), Math.min(q[1], q[3]), Math.max(q[0], q[2]), Math.max(q[1], q[3])]));
function wallBetween(a, b, fl) {
  const dx = b.x - a.x, dz = b.z - a.z;
  for (const [x0, z0, x1, z1] of WALLS2D[fl ? 1 : 0]) {
    let t0 = 0.02, t1 = 0.98;   // ignore the very ends (a fitting or the camera right at a wall)
    if (Math.abs(dx) < 1e-9) { if (a.x <= x0 || a.x >= x1) continue; } else { let u = (x0 - a.x) / dx, v = (x1 - a.x) / dx; if (u > v) [u, v] = [v, u]; t0 = Math.max(t0, u); t1 = Math.min(t1, v); }
    if (Math.abs(dz) < 1e-9) { if (a.z <= z0 || a.z >= z1) continue; } else { let u = (z0 - a.z) / dz, v = (z1 - a.z) / dz; if (u > v) [u, v] = [v, u]; t0 = Math.max(t0, u); t1 = Math.min(t1, v); }
    if (t0 < t1) return true;
  }
  return false;
}
// Nearest wall face to a drawn point (for wall lights and air-con units): the point on that face and its outward normal.
function wallFace(x, z, fl, want) {   // want: the drawn outward normal [nx, nz], when the fittings list gives one
  let best = null;
  for (const q of (fl ? D.ff : D.gf).filter(inZone)) {
    const x0 = Math.min(q[0], q[2]), x1 = Math.max(q[0], q[2]), z0 = Math.min(q[1], q[3]), z1 = Math.max(q[1], q[3]);
    for (const [fx, fz, nx, nz] of [[x0, clamp(z, z0, z1), -1, 0], [x1, clamp(z, z0, z1), 1, 0], [clamp(x, x0, x1), z0, 0, -1], [clamp(x, x0, x1), z1, 0, 1]]) {
      if (want && (nx !== want[0] || nz !== want[1])) continue;
      if ((x - fx) * nx + (z - fz) * nz < -0.02) continue;   // the point must be on that face's side
      const d = Math.hypot(x - fx, z - fz); if (!best || d < best.d) best = { d, x: fx, z: fz, nx, nz };
    }
  }
  return best;
}
// Wall light at a WLP point: dark up/down cylinder with a warm glow both ends.
function wallLight(x, z, y, fl, outdoor, want, shared = false) {
  const f = wallFace(x, z, fl, want) || (want ? wallFace(x, z, fl) : null); if (!f || f.d > 0.8) return;
  const parent = fl || y > FF_BASE ? fixFF : fixGF, ry = Math.atan2(f.nx, f.nz);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.22, 20), new THREE.MeshStandardMaterial({ color: 0x2B2725, roughness: 0.45, metalness: 0.4 }));
  body.position.set(f.x + f.nx * 0.07, y, f.z + f.nz * 0.07); parent.add(body);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.02), body.material); plate.position.set(f.x + f.nx * 0.01, y, f.z + f.nz * 0.01); plate.rotation.y = ry; parent.add(plate);
  for (const dy of [0.12, -0.12]) {
    const g = new THREE.Mesh(new THREE.CircleGeometry(0.04, 20), new THREE.MeshBasicMaterial({ color: WGLOW, transparent: true, opacity: 0 }));
    g.rotation.x = dy > 0 ? -Math.PI / 2 : Math.PI / 2; g.position.set(body.position.x, y + dy * 0.93, body.position.z); parent.add(g); (outdoor ? outdoorGlow : downs).push(g);
  }
  // its pool light stands 0.6 m out in the room and faces the wall: a soft up/down wash on the plaster, no hotspot
  if (!outdoor) fixtures.push({ p: V(f.x + f.nx * 0.6, y, f.z + f.nz * 0.6), d: V(-f.nx, 0, -f.nz), fl: y > FF_BASE + 0.3 && !shared ? 1 : 0, shared: shared || inVoid(x, z), I: 1.6, a: 1.3 });
}
// Wall-mounted split air-conditioner indoor unit at an AC point: 0.80 x 0.28 x 0.20, white, louvre slot underneath.
const mAC = new THREE.MeshStandardMaterial({ color: 0xF4F3EF, roughness: 0.35 }), mACslot = new THREE.MeshStandardMaterial({ color: 0x3A3836, roughness: 0.6 });
function acUnit(x, z, y, fl, off = 0.105) {
  const f = wallFace(x, z, fl); if (!f || f.d > 1.0) return;
  const g = new THREE.Group(); g.position.set(f.x + f.nx * off, y, f.z + f.nz * off); g.rotation.y = Math.atan2(f.nx, f.nz); (fl ? fixFF : fixGF).add(g);
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.80, 0.28, 0.20, 3, 0.04), mAC); body.castShadow = true; g.add(body);
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.035, 0.08), mACslot); slot.position.set(0, -0.125, 0.06); g.add(slot);
  const flap = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.012, 0.07), mAC); flap.position.set(0, -0.145, 0.085); flap.rotation.x = -0.35; g.add(flap);
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.008, 0.004), new THREE.MeshBasicMaterial({ color: 0x9FD7FF })); led.position.set(0.28, -0.07, 0.101); g.add(led);
}
if (LIB) await Y();   // embedded build: let the hero draw a frame
// Wall art (owner request, Nov 2026; styling, not on the drawings): framed abstract pieces in the estate palette, no
// people. Each is hung on a real wall face at its point; one that would cover a window or a door is left out.
const ART = SEMID ? [
  { x: -1.0, z: -2.0, y: 1.55, w: 1.0, h: 0.7, fl: 0, n: [0, 1], s: 1 },        // foyer wall, facing the front door
  { x: -0.13, z: -11.506, y: 1.8, w: 0.9, h: 0.6, fl: 0, n: [-1, 0], s: 3 },    // guest bedroom, over the bed
  { x: -6.56, z: -9.06, y: FF_BASE + 1.8, w: 1.0, h: 0.6, fl: 1, n: [1, 0], s: 4 },     // bedroom 1, over the bed
  { x: -0.13, z: -9.353, y: FF_BASE + 1.8, w: 0.9, h: 0.6, fl: 1, n: [-1, 0], s: 5 },   // bedroom 2, over the bed
  { x: -0.13, z: -2.112, y: FF_BASE + 1.9, w: 1.4, h: 0.7, fl: 1, n: [-1, 0], s: 6 },   // master bedroom, over the bed
] : [
  { x: 6.86, z: -6.72, y: 1.65, w: 1.4, h: 0.8, fl: 0, n: [-1, 0], s: 2 },      // living room, over the sofa
  { x: 2.18, z: -1.364, y: 1.8, w: 0.9, h: 0.6, fl: 0, n: [1, 0], s: 3 },       // guest bedroom, over the bed
  { x: -6.86, z: -6.075, y: FF_BASE + 1.8, w: 1.0, h: 0.6, fl: 1, n: [1, 0], s: 4 },    // bedroom 1, over the bed
  { x: -6.86, z: -1.538, y: FF_BASE + 1.8, w: 1.0, h: 0.6, fl: 1, n: [1, 0], s: 5 },    // bedroom 2, over the bed
  { x: 6.86, z: -6.197, y: FF_BASE + 1.9, w: 1.4, h: 0.7, fl: 1, n: [-1, 0], s: 6 },    // master bedroom, over the bed
  { x: -2.18, z: -1.6, y: 1.6, w: 1.2, h: 0.8, fl: 0, n: [-1, 0], s: 1 },       // dining room, on the wing wall
];
function artTexture(seed, w, h) {
  const W = 1024, H = Math.round(1024 * h / w), c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); let q = seed * 9301 + 49297; const r = () => (q = (q * 9301 + 49297) % 233280) / 233280;
  const pal = ['#8E9A86', '#6E7766', '#3E3B38', '#CFC4B2', '#E6DED0', '#B9AE9C', '#A39684', '#F3EEE5', '#A9B7A8'];   // Japandi: muted sage, charcoal, linen
  g.fillStyle = '#F1EADD'; g.fillRect(0, 0, W, H);
  const style = seed % 6;
  if (style === 1) {          // sun over layered hills
    g.fillStyle = '#BBA88E'; g.beginPath(); g.arc(W * 0.62, H * 0.42, H * 0.22, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 4; i++) { g.fillStyle = ['#D8CFBF', '#A9B7A8', '#8E9A86', '#6E7766'][i]; g.beginPath(); g.moveTo(0, H);
      for (let x = 0; x <= W; x += 16) g.lineTo(x, H * (0.55 + i * 0.11) + Math.sin(x / W * Math.PI * (1.4 + i * 0.5) + i) * H * 0.06); g.lineTo(W, H); g.fill(); }
  } else if (style === 2) {   // stacked arches
    for (let i = 0; i < 5; i++) { const cx = W * (0.18 + i * 0.16), rad = W * 0.07; g.fillStyle = pal[(i * 3) % 7];
      g.beginPath(); g.moveTo(cx - rad, H * 0.82); g.lineTo(cx - rad, H * (0.55 - (i % 2) * 0.12)); g.arc(cx, H * (0.55 - (i % 2) * 0.12), rad, Math.PI, 0); g.lineTo(cx + rad, H * 0.82); g.fill(); }
    g.fillStyle = '#3E3A36'; g.fillRect(W * 0.08, H * 0.82, W * 0.84, H * 0.012);
  } else if (style === 3) {   // a single botanical leaf, line drawn
    g.strokeStyle = '#3E3B38'; g.lineWidth = W * 0.006; g.beginPath(); g.moveTo(W * 0.5, H * 0.88); g.bezierCurveTo(W * 0.48, H * 0.6, W * 0.52, H * 0.35, W * 0.5, H * 0.12); g.stroke();
    for (let i = 0; i < 9; i++) { const t = 0.2 + i * 0.075, y = H * (0.88 - t * 0.78), sd = i % 2 ? 1 : -1, L = W * (0.2 - Math.abs(i - 4) * 0.02);
      g.fillStyle = i % 3 ? '#8E9A86' : '#A9B7A8'; g.beginPath(); g.moveTo(W * 0.5, y); g.quadraticCurveTo(W * 0.5 + sd * L * 0.6, y - H * 0.1, W * 0.5 + sd * L, y - H * 0.02); g.quadraticCurveTo(W * 0.5 + sd * L * 0.5, y + H * 0.02, W * 0.5, y); g.fill(); }
  } else if (style === 4) {   // colour-field blocks
    const cols = ['#6E7766', '#D8CFBF', '#A39684', '#E6DED0'];
    g.fillStyle = cols[0]; g.fillRect(W * 0.1, H * 0.12, W * 0.38, H * 0.76); g.fillStyle = cols[1]; g.fillRect(W * 0.52, H * 0.12, W * 0.38, H * 0.36);
    g.fillStyle = cols[2]; g.fillRect(W * 0.52, H * 0.52, W * 0.38, H * 0.36); g.fillStyle = '#F3EEE5'; g.beginPath(); g.arc(W * 0.29, H * 0.5, H * 0.16, 0, Math.PI * 2); g.fill();
  } else if (style === 5) {   // brush strokes
    for (let i = 0; i < 7; i++) { g.strokeStyle = pal[(i * 2 + 1) % 7]; g.globalAlpha = 0.85; g.lineWidth = H * (0.05 + r() * 0.05); g.lineCap = 'round';
      g.beginPath(); const y = H * (0.18 + i * 0.11); g.moveTo(W * (0.1 + r() * 0.1), y); g.bezierCurveTo(W * 0.35, y - H * 0.08 * r(), W * 0.6, y + H * 0.08 * r(), W * (0.75 + r() * 0.12), y); g.stroke(); }
    g.globalAlpha = 1;
  } else {                    // horizon and moon, quiet
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#E6DED0'); gr.addColorStop(0.62, '#D8CFBF'); gr.addColorStop(0.63, '#A9B7A8'); gr.addColorStop(1, '#8E9A86');
    g.fillStyle = gr; g.fillRect(W * 0.06, H * 0.1, W * 0.88, H * 0.8); g.fillStyle = '#F3EEE5'; g.beginPath(); g.arc(W * 0.3, H * 0.36, H * 0.1, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#3E3B38'; g.lineWidth = H * 0.008; g.beginPath(); g.moveTo(W * 0.06, H * 0.62); g.lineTo(W * 0.94, H * 0.62); g.stroke();
  }
  for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${r() > 0.5 ? '255,255,255' : '60,50,40'},${0.03 + r() * 0.03})`; g.fillRect(r() * W, r() * H, 2, 2); }   // paper grain
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy()); return t;
}
{
  const mFrameOak = new THREE.MeshStandardMaterial({ color: 0xDCC9AA, roughness: 0.5 }), mMat = new THREE.MeshStandardMaterial({ color: 0xF6F2EA, roughness: 0.9 });
  let hung = 0;
  for (const a of ART) {
    await slice();
    const f = wallFace(a.x, a.z, a.fl, a.n); if (!f || f.d > 0.4) continue;
    const ax = f.nx ? 'z' : 'x', along = ax === 'x' ? f.x : f.z, base = a.fl ? FF_BASE : 0;
    const covers = (a.fl ? D.ff_open : D.gf_open).some(o => {   // a window or doorway behind it
      const oc = ax === 'x' ? (o.r[1] + o.r[3]) / 2 : (o.r[0] + o.r[2]) / 2, o0 = ax === 'x' ? Math.min(o.r[0], o.r[2]) : Math.min(o.r[1], o.r[3]), o1 = ax === 'x' ? Math.max(o.r[0], o.r[2]) : Math.max(o.r[1], o.r[3]);
      return Math.abs(oc - (ax === 'x' ? f.z : f.x)) < 0.3 && o1 - o0 < 2.5 && o0 < along + a.w / 2 + 0.05 && o1 > along - a.w / 2 - 0.05 && base + (o.sill || 0) < a.y + a.h / 2 && base + o.head > a.y - a.h / 2;
    });
    if (covers) continue;
    const grp = new THREE.Group(); grp.position.set(f.x + f.nx * 0.022, a.y, f.z + f.nz * 0.022); grp.rotation.y = Math.atan2(f.nx, f.nz);
    const fw = 0.03, d = 0.035;
    for (const [px, py, sw, sh] of [[0, a.h / 2 - fw / 2, a.w, fw], [0, -a.h / 2 + fw / 2, a.w, fw], [-a.w / 2 + fw / 2, 0, fw, a.h - 2 * fw], [a.w / 2 - fw / 2, 0, fw, a.h - 2 * fw]]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, d), mFrameOak); b.position.set(px, py, 0); b.castShadow = true; grp.add(b);
    }
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(a.w - 2 * fw, a.h - 2 * fw), mMat); mat.position.z = -0.002; grp.add(mat);
    const mw = a.w - 2 * fw - 0.12, mh = a.h - 2 * fw - 0.12;
    const art = new THREE.Mesh(new THREE.PlaneGeometry(mw, mh), new THREE.MeshStandardMaterial({ map: artTexture(a.s, mw, mh), roughness: 0.8 })); art.position.z = 0.0005; grp.add(art);
    (a.fl ? fixFF : fixGF).add(grp); hung++;
  }
  if (hung < ART.length) console.info(`wall art: ${ART.length - hung} spot(s) left out (window or door behind)`);
}
// Ceiling fans at the fan points: 52-inch, three oak blades, matte black motor.
const fans = [];
let fanNear = false; const tmpFanV = new THREE.Vector3();   // fans spin (and keep the page redrawing) only when one is near and in view
const fanBlack = new THREE.MeshStandardMaterial({ color: 0x24211F, roughness: 0.45, metalness: 0.3 });
const fanOak = new THREE.MeshStandardMaterial({ color: OAK, map: TEX.wood, roughness: 0.6 });
function makeFan(x, z, ceil, ff = false) {
  const fan = new THREE.Group(); fan.position.set(x, ceil, z); (ff ? fixFF : fixGF).add(fan);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 10), fanBlack); rod.position.y = -0.16; fan.add(rod);
  const canopy = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.05, 24), fanBlack); canopy.position.y = -0.025; fan.add(canopy);
  const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.12, 32), fanBlack); motor.position.y = -0.38; fan.add(motor);
  const rotor = new THREE.Group(); rotor.position.y = -0.40; rotor.rotation.y = x * 3; fan.add(rotor); fan.userData.rotor = rotor; fan.userData.ff = ff;
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(new RoundedBoxGeometry(0.56, 0.012, 0.13, 2, 0.005), fanOak);
    blade.position.set(0.40, 0, 0); blade.rotation.x = 0.12;
    const arm = new THREE.Group(); arm.rotation.y = i * 2 * Math.PI / 3; arm.add(blade); rotor.add(arm);
  }
  fan.traverse(o => { if (o.isMesh) o.castShadow = true; });
  fans.push(fan); return fan;
}
// Bungalow foyer (owner, Nov 2026: "double volume foyer, a modern pendant chandelier"): three slim satin-brass LED rings,
// 1.0, 0.75 and 0.5 m across, hung on fine cables at staggered heights in the void, the lowest 4.0 m up (clear of the
// first-floor edge sightline); each ring's opal underside glows with the other lights.
function ringChandelier(x, z, ceil, r) {
  const cx = clamp(x, Math.min(r[0], r[2]) + 0.6, Math.max(r[0], r[2]) - 0.6), cz = clamp(z, Math.min(r[1], r[3]) + 0.6, Math.max(r[1], r[3]) - 0.6);
  const g = new THREE.Group(); g.position.set(cx, 0, cz); fixFF.add(g);
  const brass = new THREE.MeshStandardMaterial({ color: 0xC9A66B, roughness: 0.32, metalness: 0.85 });
  const cable = new THREE.MeshStandardMaterial({ color: 0x3A3632, roughness: 0.5, metalness: 0.4 });
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 32), brass); can.position.y = ceil - 0.015; g.add(can);
  for (const [R, y, tilt] of [[0.5, 4.0, 0.0], [0.375, 4.45, 0.08], [0.25, 4.85, -0.06]]) {
    const ring = new THREE.Group(); ring.position.y = y; ring.rotation.z = tilt; g.add(ring);
    const band = new THREE.Mesh(new THREE.TorusGeometry(R, 0.018, 12, 96), brass); band.rotation.x = Math.PI / 2; band.castShadow = true; ring.add(band);
    const glow = new THREE.Mesh(new THREE.RingGeometry(R - 0.012, R + 0.012, 96), new THREE.MeshBasicMaterial({ color: LENS, transparent: true, opacity: 0, side: THREE.DoubleSide }));
    glow.rotation.x = Math.PI / 2; glow.position.y = -0.019; ring.add(glow); downs.push(glow);
    for (let k = 0; k < 3; k++) {   // three cables up to the ceiling
      const a = k * Math.PI * 2 / 3 + R * 4, px = Math.cos(a) * R, pz = Math.sin(a) * R;
      const bx = px * Math.cos(tilt), by = y + px * Math.sin(tilt) + 0.018, len = ceil - by;   // from the top of the tilted ring
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, len, 5), cable); c.position.set(bx, by + len / 2, pz); g.add(c);
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 12), brass); cup.position.set(bx, ceil - 0.006, pz); g.add(cup);
    }
  }
  fixtures.push({ p: V(cx, 3.95, cz), d: V(0, -1, 0), fl: 0, shared: true, I: 7.5, a: 1.2 });   // its pool of light on the foyer floor
}
const ffLights = [];
if (SEMID) {
  // Semi-D: every lighting point, fan, wall light and air-con point of drawing E-01 (verified), at its room's ceiling.
  for (const f of SD_LIGHTS) {
    await slice();
    if (f.k === 'light') { const n = downs.length; ceilingLight(f.x, f.z, f.y, f.out, undefined, f.halo ?? 1.5); if (f.floor) ffLights.push(downs[n]); }
    else if (f.k === 'fan') makeFan(f.x, f.z, f.y, !!f.floor);
    else if (f.k === 'wall_light') wallLight(f.x, f.z, f.y + (f.floor ? FF_BASE : 0), f.floor, f.out, null, /STAIR/i.test(f.room || ''));
    else if (f.k === 'ac') acUnit(f.x, f.z, f.y, f.floor, f.off);
  }
} else {
  // Bungalow: every ceiling light, fan and wall light at its E-02 point (verified), at that room's ceiling.
  const outside = f => /PORCH|PATIO|KERETA|BALKONI|LALUAN|HIJAU|GATE|PAGAR|EXTERIOR|LUAR/i.test(f.room || '') || f.x <= HOUSE.x0 + 0.01 || f.x >= HOUSE.x1 - 0.01 || f.z >= HOUSE.z1 - 0.01 || f.z <= HOUSE.z0 + 0.01;
  // Under the roof overhang (balconies) the fitting sits on the underside of the tiles at its point.
  const tileY = (x, z) => {
    for (const poly of X.roof.tiles) {
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, , zi] = poly[i], [xj, , zj] = poly[j];
        if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
      }
      if (!inside) continue;
      const [a, b, c] = [poly[0], poly[1], poly[2]].map(q => V(...q)), n = b.clone().sub(a).cross(c.clone().sub(a));
      if (Math.abs(n.y) > 1e-6) return { y: a.y - (n.x * (x - a.x) + n.z * (z - a.z)) / n.y, slope: Math.hypot(n.x, n.z) / Math.abs(n.y) };
    }
    return null;
  };
  const foyer = (X.double_height || []).find(v => v.id === 'entrance_void');
  for (const f of FIT) {
    await slice();
    if (f.k === 'light' && foyer && f.y > 5 && inVoid(f.x, f.z) && f.x > foyer.r[0] && f.x < foyer.r[2] && f.z > foyer.r[1] && f.z < foyer.r[3]) { ringChandelier(f.x, f.z, f.y, foyer.r); continue; }
    if (f.k === 'light') { const t = f.y > 7.2 && /BALKONI/i.test(f.room || '') ? tileY(f.x, f.z) : null; ceilingLight(f.x, f.z, t ? t.y - 0.003 - EYE_R * t.slope : f.y, outside(f), undefined, t ? 0.6 : 1.5); }
    else if (f.k === 'fan') makeFan(f.x, f.z, f.y, f.y > 5);
    else if (f.k === 'wall_light') wallLight(f.x, f.z, f.y, f.y > 3.6 ? 1 : 0, outside(f), f.nx != null && f.nz != null && (f.nx || f.nz) ? [f.nx, f.nz] : null, /STAIR|TANGGA/i.test(f.room || ''));
    else if (f.k === 'ac') acUnit(f.x, f.z, (f.y > 3.6 ? FF_BASE : 0) + (f.affl || 2.55), f.y > 3.6 ? 1 : 0);
  }
}

if (LIB) await Y();   // embedded build: let the hero draw a frame
// Front gate (E-01 plan): per unit a 4.503 m opening, double swing gate of two 2.148 m leaves in black
// flat bars at 250 mm centres; 1450 high per the tender BQ. The walked unit's gate stands open as drawn.
const gate = new THREE.Group(); scene.add(gate);
{
  const m = new THREE.MeshStandardMaterial({ color: 0x1F1D1C, roughness: 0.5, metalness: 0.4 });
  function leaf(hx, dir, open) {   // hinge x, leaf runs toward +dir in x when closed, swings into the lot when open
    const g = new THREE.Group(); g.position.set(hx, GROUND + 0.05, 6.62); gate.add(g);
    if (open) g.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    const L = 2.148, H = 1.40, add = (x, y, w, h) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), m); b.position.set(dir * x, y, 0); b.castShadow = true; g.add(b); };
    add(0.025, H / 2, 0.05, H); add(L - 0.025, H / 2, 0.05, H);      // stiles
    for (const y of [0.05, 0.62, H - 0.03]) add(L / 2, y, L, 0.05);   // rails
    for (let x = 0.25; x < L - 0.1; x += 0.25) add(x, H / 2, 0.05, H - 0.1);   // flat bars
  }
  if (SEMID) { leaf(-5.49, 1, true); leaf(-1.14, -1, true); }        // left unit: open
  if (SEMID) { leaf(5.49, -1, false); leaf(1.14, 1, false); }        // right unit: closed
  const gl = SEMID ? [[-5.813, 6.68], [-1.008, 6.76], [5.813, 6.68], [1.008, 6.76]] : FIT.filter(f => f.k === 'gate_light').map(f => [f.x, f.z]);
  for (const [x, z] of gl) {   // gate lights on the piers
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.16), m); lamp.position.set(x, GROUND + 1.62, SEMID ? Math.min(z, 6.62) : z); gate.add(lamp);
    const glow = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.17), new THREE.MeshBasicMaterial({ color: 0xFFE2B0, transparent: true, opacity: 0 }));
    glow.position.copy(lamp.position); gate.add(glow); outdoorGlow.push(glow);
  }
}
const roomLight = new THREE.PointLight(0xFFE2BE, 0, 11, 1.6);
if (SEMID) roomLight.position.set(-3.3, 2.0, -2.4); else roomLight.position.set((FINISH.x0 + FINISH.x1) / 2, 2.0, (FINISH.z0 + FINISH.z1) / 2);
scene.add(roomLight);
const diningLight = new THREE.PointLight(0xFFD9A8, 0, 6, 1.8);              // warm 2700 K under the pendants
diningLight.position.set((PEND.xs[0] + PEND.xs[1]) / 2, 2.2, PEND.z); scene.add(diningLight);
// Daylight through the patio doors: soft area lights in the glass, facing into the room.
const skyLights = [];
for (const [z, w] of SEMID && RALm ? [[-2.225, 2.95], [-5.942, 1.8]] : []) {
  const l = new THREE.RectAreaLight(0xEFF2F2, 0, w, 2.4);
  l.position.set(-6.60, 1.25, z); l.lookAt(0, 1.25, z); scene.add(l); skyLights.push(l);
}

if (LIB) await Y();   // embedded build: let the hero draw a frame
// ---------- the real world fades in once the house stands: sky, lawn, paving, road ----------
const world = [];
let makeTree = null, PLACEHOLDERS = [], TREE_MATS = [];
function worldPlane(r, y, tex, rough = 1, order = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r[2] - r[0], r[3] - r[1]),
    new THREE.MeshStandardMaterial({ map: tex, roughness: rough, transparent: true, opacity: 0, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set((r[0] + r[2]) / 2, y, (r[1] + r[3]) / 2); m.receiveShadow = true; m.renderOrder = order;
  scene.add(m); world.push(m); return m;
}
{
  const g = grassTexture();
  const lawn = worldPlane([LOT.x0, LOT.z0, LOT.x1, LOT.z1], GROUND + 0.003, g);
  g.repeat.set((LOT.x1 - LOT.x0) / 2.5, (LOT.z1 - LOT.z0) / 2.5);
  // photo maps on these planes: uv 0..1 across the rectangle, u = x, v = -z
  const hdPlane = (m, r, set, o = {}) => { hd.use(m.material, set, { su: r[2] - r[0], sv: r[3] - r[1], ou: r[0], ov: -r[3], ...o }); return m; };
  hdPlane(lawn, [LOT.x0, LOT.z0, LOT.x1, LOT.z1], 'grass', { grass: true });
  const pr = SEMID ? [-6.87, 0.6, 6.87, LOT.z1] : X.porch.r;
  const pv = pavingTexture(4, '178,170,160'); pv.repeat.set((pr[2] - pr[0]) / 2.4, (pr[3] - pr[1]) / 2.4);
  hdPlane(worldPlane(pr, GROUND + 0.006, pv, 0.9, 1), pr, 'concrete_paving', { color: 'keep', normalScale: 0.6 });   // car porch, imprinted concrete (drawn joints kept)
  if (!SEMID) {                                                                              // bungalow: driveway out to the gate
    const wp = ESTATE && ESTATE.bungalows.find(q => q.id === 'bungalow_001'), gt = ESTATE && ESTATE.gates.find(q => q.plot === 'BG-001');
    if (wp && gt) {   // the gate is on the corner splay (site plan): an angled drive from the porch to it
      const a = wp.rot * Math.PI / 180, toM = ([ex, ez]) => { const dx = ex - wp.o[0], dz = ez - wp.o[1], mx = dx * Math.cos(a) - dz * Math.sin(a); return [wp.mirror ? -mx : mx, dx * Math.sin(a) + dz * Math.cos(a)]; };
      const h = gt.h.map(toM).sort((p0, p1) => p0[0] - p1[0]);
      const dv = pavingTexture(4, '178,170,160'); dv.repeat.set(1 / 2.4, 1 / 2.4);
      const sg = new THREE.ShapeGeometry(new THREE.Shape([[pr[0] + 0.5, pr[3]], [pr[2], pr[3]], h[1], h[0]].map(([x, z]) => new THREE.Vector2(x, -z))));
      const m = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ map: dv, roughness: 0.9, transparent: true, opacity: 0, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.y = GROUND + 0.006; m.receiveShadow = true; m.renderOrder = 1; scene.add(m); world.push(m);
      window.__gateModel = h;
    } else {
      const dv = pavingTexture(4, '178,170,160'); dv.repeat.set((pr[2] - pr[0]) / 2.4, (LOT.z1 - pr[3]) / 2.4);
      worldPlane([pr[0], pr[3], pr[2], LOT.z1], GROUND + 0.006, dv, 0.9, 1);
    }
  }
  for (const s of SEMID ? [-1, 1] : []) {                                                   // side patios at -0.15: the paved 1.265 m strip (z 0.6..-8.59)
    const pt = pavingTexture(4, '206,198,186'); pt.repeat.set(1.265 / 1.2, 9.19 / 1.2);
    const r = s < 0 ? [-7.985, -8.59, HOUSE.x0, 0.6] : [HOUSE.x1, -8.59, 7.985, 0.6];
    hdPlane(worldPlane(r, -0.15, pt, 0.85, 1), r, 'concrete_paving', { color: 'keep', normalScale: 0.6 });
  }
  const asphalt = asphaltTexture();
  asphalt.repeat.set(64 / 3, 12.2 / 3);
  const placeholders = [lawn];
  { const r = [-32, LOT.z1, 32, LOT.z1 + 12.2]; placeholders.push(hdPlane(worldPlane(r, GROUND + 0.006, asphalt, 0.95, 1), r, 'asphalt')); }
  // Road detail: the drain cover in front of the gates (E-01: z 6.70..7.45, bars at 0.6 m), white lane lines.
  const grate = canvasTex(256, (c, s) => { c.fillStyle = '#9b958d'; c.fillRect(0, 0, s, s); c.fillStyle = '#4a4642'; for (let i = 0; i < 16; i++) c.fillRect(i * s / 16 + 3, 6, s / 32, s - 12); c.fillStyle = '#7d7871'; c.fillRect(0, 0, s, 6); c.fillRect(0, s - 6, s, 6); });
  grate.repeat.set(64 / 0.6, 1);
  placeholders.push(worldPlane([-32, LOT.z1 + 0.005, 32, LOT.z1 + 0.75], GROUND + 0.009, grate, 0.8, 2));
  const lineTex = canvasTex(64, (c, s) => { c.fillStyle = '#f2efe8'; c.fillRect(0, 0, s, s); });
  for (let x = -31; x < 31; x += 6) placeholders.push(worldPlane([x, LOT.z1 + 6.05, x + 3, LOT.z1 + 6.17], GROUND + 0.01, lineTex, 0.6, 2));   // centre line, 3 m dash / 3 m gap
  placeholders.push(worldPlane([-32, LOT.z1 + 0.95, 32, LOT.z1 + 1.05], GROUND + 0.01, lineTex, 0.6, 2));                                    // edge lines
  placeholders.push(worldPlane([-32, LOT.z1 + 11.15, 32, LOT.z1 + 11.25], GROUND + 0.01, lineTex, 0.6, 2));
  const g2 = grassTexture(); g2.repeat.set(64 / 2.5, 30 / 2.5);
  { const r = [-32, LOT.z1 + 12.2, 32, LOT.z1 + 42]; placeholders.push(hdPlane(worldPlane(r, GROUND + 0.006, g2, 1, 1), r, 'grass', { grass: true })); }
  if (ESTATE) for (const m of placeholders) m.visible = false;   // the estate draws the real road, drains, plots and green
  PLACEHOLDERS = placeholders;
  // shade trees: on the green across the road, and beyond the side boundaries
  const trunkM = new THREE.MeshStandardMaterial({ color: 0x5B4A3C, roughness: 0.9, transparent: true, opacity: 0 });
  const crownM = new THREE.MeshStandardMaterial({ color: 0x5F7443, roughness: 0.9, transparent: true, opacity: 0 });
  world.push({ material: trunkM }, { material: crownM }); TREE_MATS = [trunkM, crownM];
  const crownGeo = (s, seed) => {   // canopy of individual leaves scattered through an ellipsoid shell
    let q = (Math.abs(seed * 7919) % 2147483646) + 1; const r = () => ((q = (q * 16807) % 2147483647) / 2147483647);   // seed kept positive (west-side trees gave a negative one: a canopy of NaN)
    const leaf = new THREE.PlaneGeometry(0.62 * s, 0.62 * s).toNonIndexed();   // a cut-out cluster of leaves per card
    const parts = [], e = new THREE.Euler(), base = new THREE.Color(0x6A7E4A);
    for (let i = 0; i < 300; i++) {
      const u = r() * 2 - 1, th = r() * Math.PI * 2, rad = Math.pow(r(), 0.35), sq = Math.sqrt(1 - u * u);
      const g = leaf.clone(); e.set(r() * 6.3, r() * 6.3, r() * 6.3); g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(e));
      g.translate(sq * Math.cos(th) * rad * 2.6 * s, u * rad * 1.8 * s, sq * Math.sin(th) * rad * 2.6 * s);
      const c = base.clone().offsetHSL((r() - 0.5) * 0.04, (r() - 0.5) * 0.12, (r() - 0.5) * 0.14 + (u > 0 ? 0.04 : -0.04));
      g.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: g.attributes.position.count }, () => [c.r, c.g, c.b]).flat(), 3));
      parts.push(g);
    }
    const out = mergeGeometries(parts); out.computeVertexNormals(); return out;
  };
  crownM.vertexColors = true; crownM.side = THREE.DoubleSide; crownM.color.set(0xFFFFFF);
  // Leaf-cluster cut-out: 7 pointed leaves with a midrib, alpha-tested so the canopy edge breaks up naturally.
  crownM.map = canvasTex(256, (g, s) => {
    g.clearRect(0, 0, s, s);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + rnd() * 0.5, r = s * (0.18 + rnd() * 0.12), cx = s / 2 + Math.cos(a) * r, cy = s / 2 + Math.sin(a) * r;
      g.save(); g.translate(cx, cy); g.rotate(a + Math.PI / 2);
      const L = s * 0.26, Wd = L * 0.42, v = Math.round(rnd() * 40);
      g.fillStyle = `rgb(${200 + v},${220 + v / 2},${170})`;
      g.beginPath(); g.moveTo(0, -L / 2); g.quadraticCurveTo(Wd, 0, 0, L / 2); g.quadraticCurveTo(-Wd, 0, 0, -L / 2); g.fill();
      g.strokeStyle = 'rgba(90,110,60,0.6)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, -L / 2); g.lineTo(0, L / 2); g.stroke();
      g.restore();
    }
  });
  crownM.map.wrapS = crownM.map.wrapT = THREE.ClampToEdgeWrapping; crownM.alphaTest = 0.5;
  const crownCache = new Map();
  makeTree = (x, z, s, parent = scene) => {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * s, 0.2 * s, 2.6 * s, 10), trunkM);
    t.position.set(x, GROUND + 1.3 * s, z); t.castShadow = true; parent.add(t);
    const key = `${s.toFixed(1)}|${Math.abs(Math.round(x * 13 + z * 7)) % 3}`;   // a few canopy shapes, shared between trees
    if (!crownCache.has(key)) crownCache.set(key, crownGeo(s, Math.round(x * 13 + z * 7 + 400)));
    const c = new THREE.Mesh(crownCache.get(key), crownM);
    c.position.set(x, GROUND + 3.6 * s, z); c.castShadow = true; parent.add(c);
  };
  if (!ESTATE) for (const [x, z, s] of [[-14, 24, 1.1], [-5, 27, 1.35], [6, 23.5, 1.0], [15, 26, 1.25], [-22, 25, 1.0], [-14.5, -3, 1.2], [-16, -10, 1.35], [14.5, -6, 1.2], [-3, -21, 1.3], [5, -22, 1.1]]) makeTree(x, z, s);
}
// Planting along both side boundaries, seen through the patio doors.
const garden = new THREE.Group(); scene.add(garden);
{
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.7 });
  let k = 0;
  if (SEMID) for (const sx of [-1, 1]) for (let z = -0.9; z > -10.2; z -= 1.15) {
    const h = 1.2 + ((k * 37) % 7) / 10, g = plantGeometry(h, 26, 0.42, 11 + k++);
    const mesh = new THREE.Mesh(g, m); mesh.position.set(sx * 9.0, -0.15, z + ((k * 13) % 5) / 20); mesh.castShadow = true; garden.add(mesh);
  }
  // A clipped hedge of low shrubs inside the front fence (as in the street render).
  if (SEMID) for (const sx of [-1, 1]) for (let x = 6.0; x < 9.1; x += 0.42) {
    const g = plantGeometry(0.75 + ((k * 17) % 5) / 25, 22, 0.2, 31 + k++);
    const mesh = new THREE.Mesh(g, m); mesh.position.set(sx * x, GROUND, 6.25 + ((k * 7) % 3) / 30); mesh.castShadow = true; garden.add(mesh);
  }
  // Bungalow: planting along the side and rear of the house (KAWASAN HIJAU), seen from the living spaces.
  if (!SEMID) {
    for (let z = -0.5; z > HOUSE.z0 - 1.5; z -= 1.2) for (const x of [HOUSE.x0 - 2.6, HOUSE.x1 + 2.6]) {
      const g = plantGeometry(1.2 + ((k * 37) % 7) / 10, 26, 0.42, 11 + k++);
      const mesh = new THREE.Mesh(g, m); mesh.position.set(x, GROUND, z); mesh.castShadow = true; garden.add(mesh);
    }
  }
}
// Sky dome: soft late-afternoon gradient, fades in as we come down to eye level.
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, transparent: true,
  uniforms: { top: { value: new THREE.Color(0x9DBBD0) }, horizon: { value: new THREE.Color(0xF3E7D6) }, opacity: { value: 0 } },
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform vec3 top; uniform vec3 horizon; uniform float opacity; varying vec3 vP; void main(){ float t = pow(clamp(vP.y, 0.0, 1.0), 0.55); gl_FragColor = vec4(mix(horizon, top, t), opacity);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(120, 32, 16), skyMat); sky.renderOrder = -1; scene.add(sky);

performance.mark('walk-house');
if (LIB) await Y();   // embedded build: let the hero draw a frame
// ---------- the estate around the walked home ----------
let estate = null;
// The same detailed car as in the walked porch, merged per material once, for every porch in the estate.
// lod 'mid': the same car at about 3k triangles, for the other porches where the full one is too heavy (the hero, phones).
function carKit(lod) {
  if (!buildCar) return null;
  try {
    const g = buildCar(THREE, { color: 0xFFFFFF, length: 4.55, width: 1.80, style: 'sedan', envMap: scene.environment, metallic: true, lod });
    g.updateMatrixWorld(true);
    return bakeRoots([g]).map(pt => ({ ...pt, paint: !!(pt.material.isMeshPhysicalMaterial && pt.material.clearcoat > 0.5 && pt.material.color.getHex() === 0xFFFFFF) }));
  } catch (e) { console.warn('car kit', e); return null; }
}
// The estate's drawn textures (the pack bake uses the same).
function estateTextures() {
  return {
    grass: grassTexture,
    paving: pavingTexture,
    vent: ventTexture,
    asphalt: asphaltTexture,
    bars: () => canvasTex(256, (c, n) => {   // gate: 25 mm bars at 125 c/c in a frame, as on the gate elevation
      c.clearRect(0, 0, n, n); c.fillStyle = '#fff';
      for (let i = 0; i < 8; i++) c.fillRect(i * n / 8 + n / 32, 0, n / 40, n);
      c.fillRect(0, 0, n, n / 30); c.fillRect(0, n - n / 30, n, n / 30); c.fillRect(0, n * 0.36, n, n / 40);
    }),
    mesh: () => canvasTex(128, (c, n) => {   // anti-climb mesh
      c.clearRect(0, 0, n, n); c.strokeStyle = '#fff'; c.lineWidth = 2;
      for (let i = 0; i <= n; i += n / 16) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, n); c.stroke(); }
      for (let j = 0; j <= n; j += n / 4) { c.beginPath(); c.moveTo(0, j); c.lineTo(n, j); c.stroke(); }
    }),
    frond: () => canvasTex(128, (c, n) => {   // a palm frond: midrib with leaflets
      c.clearRect(0, 0, n, n); c.strokeStyle = '#fff'; c.lineWidth = 3; c.beginPath(); c.moveTo(n / 2, 0); c.lineTo(n / 2, n); c.stroke();
      c.lineWidth = 5; for (let y = 3; y < n; y += 4) { const w = n / 2 * (1 - y / n * 0.5); c.beginPath(); c.moveTo(n / 2, y); c.lineTo(n / 2 - w, y - 10); c.moveTo(n / 2, y); c.lineTo(n / 2 + w, y - 10); c.stroke(); }
    }),
  };
}
// Built just after the first frame (it's only seen once the house is real), so the page opens sooner.
// With the pack: all 19 homes and the grounds come ready-made, nothing else is built or baked here.
let estateBusy = false, estateFrom = null;
let ctxP = null;   // the neighbourhood, once it is in (the embedded build waits for it before compiling)
async function buildEstateNow() {
  if (estate || !ESTATE || estateBusy) return;
  estateBusy = true;
  const pk = PACK_P ? await PACK_P : null;
  if (pk) {
    try {
      estate = pk.forWalk(HOME, { THREE, hifi: HIFI, envMap: scene.environment, hd: hd.use, aniso: renderer.capabilities.getMaxAnisotropy() });
      scene.add(estate.root);
      for (const m of estate.worldMats) world.push({ material: m });   // the trees fade in with the rest of the real world
      estateFrom = 'pack';
      // the other homes' windows lit warm, as in the estate hero at golden hour (owner, Nov 2026: "are the lights on in all
      // the houses?"); hero-tod.js: GLOW 0xFFC98A at 3.6 x glow (0.45 at golden)
      { const seen = new Set(); estate.root.traverse(o => { if (!o.isMesh) return; for (const m of [].concat(o.material)) if (m && m.name === 'glass' && m !== mGlass && !seen.has(m)) {
        seen.add(m); m.emissive.setHex(0xFFC98A); m.emissiveIntensity = 1.62 * LIGHT.glow; } }); }
      // and the neighbourhood round it in low detail, as on the landing (owner, Nov 2026: "when i come out of tour, i should
      // still see the surrounding also right? like the neighbour lot"): hero-context.js in the estate's own frame, after the
      // estate is up so it never holds the tour back
      const hc = opts.context && opts.context();
      if (hc && hc.hideIn && hc.group) {   // embedded: a copy of the estate hero's own (built once; rebuilding it here was the
        // longest stretch of the tour's opening): the same geometry, its own materials so the tour's fade leaves the hero's be
        const host = estate.root, g = hc.group.clone(), own = new Map();
        g.traverse(o => {
          if (!o.isMesh) return;
          o.geometry.userData.pk = 1;   // shared: never freed by this walk
          o.material = [].concat(o.material).map(m => { if (!own.has(m)) { const c = m.clone(); c.userData.keepTex = true; own.set(m, c); } return own.get(m); });
          if (o.material.length === 1) o.material = o.material[0];
        });
        host.add(g); hc.hideIn(host, g);
        for (const m of own.values()) { m.userData.t0 = m.transparent; m.userData.o0 = m.opacity; CTX_MATS.push(m); }
      } else { const host = estate.root;
        ctxP = import('./hero-context.js?v=14').then(m => m.addContext({ THREE, scene: host, url: BASE + './context.e1.json?v=1', lite: !HIFI }))
          .then(c => { if (disposed || !estate || estate.root !== host) { c.dispose && c.dispose(); return; }
            c.group.traverse(o => { for (const m of [].concat(o.material || [])) if (m && !CTX_MATS.includes(m)) { m.userData.t0 = m.transparent; m.userData.o0 = m.opacity; CTX_MATS.push(m); } });
            // the page: its shaders now, in their opaque (photograph) state, not when they first show mid-scroll
            if (!LIB && renderer.compileAsync) { apply(0.65); clipReset(); renderer.compileAsync(c.group, camera, scene).catch(() => {}); }
            if (progress >= 0) apply(progress); needRender = true; shadowDirty = true; })
          .catch(e => console.warn('walk: no neighbourhood', e)); }
    } catch (e) { console.warn('pack: building the estate here instead', e); estate = null; }
  }
  if (!estate && !OTHER) {   // no pack: fetch the other home's plans after all
    const J = u => fetch(BASE + u).then(r => { if (!r.ok) throw new Error(u); return r.json(); });
    const other = SEMID ? 'bungalow' : 'semid';
    try { const [od, ox] = await Promise.all([J(`./${other}.json?v=10`), J(`./${other}_detail.json?v=5`)]); OTHER = { D: od, X: ox }; }
    catch (e) { console.warn('estate: no plans for the other home', e); for (const m of PLACEHOLDERS) m.visible = true; }
  }
  try {
    if (!estate && OTHER) {
      estate = buildEstate({ THREE, E: ESTATE, home: HOME, models: { [HOME]: { D, X }, [SEMID ? 'bungalow' : 'semid']: OTHER },
        mats: { wall: mWall, tile: mTile }, tex: estateTextures(), polyGeometry, mergeGeometries, makeTree, carSpots: CAR_SPOTS, carKit: HIFI ? carKit() : null, carMid: HIFI ? null : carKit('mid'), hd: hd.use });
      scene.add(estate.root);
      estateFrom = 'live';
    }
    if (estate) {
      retargetEnv(estate.root, roomEnv);   // the estate's cars carry their own env map: the current sky, at the current level
      sky.scale.setScalar(5);
      scene.fog = new THREE.Fog(TOD.fog, 260, 720);   // far ground fades into the sky's horizon colour   // a 600 m dome so the far side of the estate sits inside it (camera.far is 700 here)
      if (!LIB) window.__estate = estate;
      performance.mark('walk-estate');
    }
  } catch (e) { console.warn('estate', e); estate = null; }
  estateBusy = false;
  if (estate && progress >= 0) apply(progress);
  needRender = true; shadowDirty = true;
}


// ---------- the house, baked for the estate ----------
// Every neighbouring home is the same full model as the one you walk through: its exterior (walls, windows and
// doors, roof, battens, balconies, downpipes, porch, planting) is merged per material into a handful of
// meshes, so all 19 homes stay as detailed as this one and still draw quickly.
function bakeExterior() {
  return bakeRoots([house, gfDetail, ffDetail, roof, extDetail, battenGF, battenFF, extSheer], new Set(furn));   // cars are added by the estate; no boundary planting
}
// Only position, normal, uv (and colour for vertex-coloured materials), no draw groups.
function normGeo(g, vc) {
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', ...(vc ? ['color'] : [])].includes(k)) g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  const n = g.attributes.position.count;
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  if (vc && !g.attributes.color) g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  g.groups = []; return g;
}
// A plain, non-indexed copy of a geometry (interleaved attributes de-interleaved), optionally one draw group.
function flatGeo(geo, grp) {
  const src = geo.index ? geo.toNonIndexed() : geo, out = new THREE.BufferGeometry();
  const s0 = grp ? grp.start : 0, cnt = grp ? Math.min(grp.count, src.attributes.position.count - s0) : src.attributes.position.count;
  for (const k of Object.keys(src.attributes)) {
    const a = src.attributes[k], arr = new Float32Array(cnt * a.itemSize);
    for (let i = 0; i < cnt; i++) for (let c = 0; c < a.itemSize; c++) arr[i * a.itemSize + c] = a.getComponent(s0 + i, c);
    out.setAttribute(k, new THREE.BufferAttribute(arr, a.itemSize));
  }
  return out;
}
function bakeRoots(roots, skip = new Set()) {
  const byMat = new Map();
  const add = (mat, g) => { if (!byMat.has(mat)) byMat.set(mat, []); byMat.get(mat).push(g); };
  const norm = normGeo, flat = flatGeo;
  scene.updateMatrixWorld(true);
  const visibleChain = o => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true; };
  for (const r of roots) r.traverse(o => {
    if (!o.isMesh || skip.has(o) || !visibleChain(o)) return;
    // drawing-only materials (the cut poché on a wall top, ink, glow) are left out per face group, not per mesh,
    // so a ground-floor wall with a poché cap still bakes its plastered faces
    const bad = m => !m || m.isMeshBasicMaterial || m.isShaderMaterial || m.isLineMaterial || (m.transparent && m.opacity < 0.05);
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (!Array.isArray(o.material) && bad(mats[0])) return;
    if (Array.isArray(o.material) && mats.every(bad)) return;
    const inst = o.isInstancedMesh ? o.count : 1, M = new THREE.Matrix4(), I = new THREE.Matrix4();
    for (let i = 0; i < inst; i++) {
      if (o.isInstancedMesh) { o.getMatrixAt(i, I); M.multiplyMatrices(o.matrixWorld, I); } else M.copy(o.matrixWorld);
      if (Array.isArray(o.material) && o.geometry.groups.length) {
        for (const grp of o.geometry.groups) {
          const m = o.material[grp.materialIndex]; if (bad(m)) continue;
          const sub = flat(o.geometry, grp); sub.applyMatrix4(M); add(m, norm(sub, m.vertexColors));
        }
      } else { const g = flat(o.geometry); g.applyMatrix4(M); add(mats[0], norm(g, mats[0].vertexColors)); }
    }
  });
  const parts = [];
  for (const [mat, gs] of byMat) { const g = mergeGeometries(gs); if (g) parts.push({ material: mat, geometry: g }); }
  return parts;
}
// Materials and geometry to and from the helper page (textures travel as bitmaps).
async function packParts(parts) {
  const texOf = async t => t && t.image ? { bmp: await createImageBitmap(t.image), repeat: t.repeat.toArray(), offset: t.offset.toArray(), wrap: [t.wrapS, t.wrapT], cs: t.colorSpace, rot: t.rotation, fy: t.flipY } : null;
  const out = [], transfer = [];
  for (const { material: m, geometry: g } of parts) {
    const mp = { type: m.type, color: m.color && m.color.getHex(), roughness: m.roughness, metalness: m.metalness, emissive: m.emissive && m.emissive.getHex(), emissiveIntensity: m.emissiveIntensity,
      transparent: m.transparent, opacity: m.opacity, side: m.side, alphaTest: m.alphaTest, depthWrite: m.depthWrite, envMapIntensity: m.envMapIntensity, vertexColors: m.vertexColors,
      bumpScale: m.bumpScale, clearcoat: m.clearcoat, clearcoatRoughness: m.clearcoatRoughness, sheen: m.sheen, sheenRoughness: m.sheenRoughness, sheenColor: m.sheenColor && m.sheenColor.getHex(),
      map: await texOf(m.map), bumpMap: await texOf(m.bumpMap), normalMap: await texOf(m.normalMap), roughnessMap: await texOf(m.roughnessMap), alphaMap: await texOf(m.alphaMap),
      normalScale: m.normalScale && m.normalScale.toArray(), hd: hd.usesOf(m) };   // hd: the photo sets this material asked for (applied by the receiving page)
    for (const k of ['map', 'bumpMap', 'normalMap', 'roughnessMap', 'alphaMap']) if (mp[k]) transfer.push(mp[k].bmp);
    const attrs = {}; for (const k of Object.keys(g.attributes)) { attrs[k] = [g.attributes[k].array, g.attributes[k].itemSize]; transfer.push(g.attributes[k].array.buffer); }
    out.push({ mp, attrs });
  }
  return { out, transfer };
}
function unpackParts(list) {
  const tex = d => { if (!d) return null; const t = new THREE.Texture(d.bmp); t.flipY = false; t.repeat.fromArray(d.repeat); t.offset.fromArray(d.offset); [t.wrapS, t.wrapT] = d.wrap; t.colorSpace = d.cs; t.rotation = d.rot || 0; t.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy()); t.needsUpdate = true; return t; };
  return list.map(({ mp, attrs }) => {
    const Mat = mp.type === 'MeshPhysicalMaterial' ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
    const m = new Mat({ color: mp.color, roughness: mp.roughness, metalness: mp.metalness, emissive: mp.emissive, emissiveIntensity: mp.emissiveIntensity, transparent: mp.transparent, opacity: mp.opacity,
      side: mp.side, alphaTest: mp.alphaTest, depthWrite: mp.depthWrite, envMapIntensity: mp.envMapIntensity, vertexColors: mp.vertexColors, bumpScale: mp.bumpScale,
      map: tex(mp.map), bumpMap: tex(mp.bumpMap), normalMap: tex(mp.normalMap), roughnessMap: tex(mp.roughnessMap), alphaMap: tex(mp.alphaMap) });
    if (m.isMeshPhysicalMaterial) Object.assign(m, { clearcoat: mp.clearcoat || 0, clearcoatRoughness: mp.clearcoatRoughness || 0, sheen: mp.sheen || 0, sheenRoughness: mp.sheenRoughness == null ? 1 : mp.sheenRoughness });
    if (m.isMeshPhysicalMaterial && mp.sheenColor != null) m.sheenColor.setHex(mp.sheenColor);
    if (mp.normalScale && m.normalMap) m.normalScale.set(mp.normalScale[0], mp.normalMap.fy === false ? mp.normalScale[1] : -mp.normalScale[1]);   // bitmaps arrive unflipped
    for (const u of mp.hd || []) hd.use(m, u.set, u.o);   // photo maps, swapped in here as for the walked home
    const g = new THREE.BufferGeometry(); for (const k of Object.keys(attrs)) g.setAttribute(k, new THREE.BufferAttribute(attrs[k][0], attrs[k][1]));
    return { material: m, geometry: g };
  });
}
// ---------- the pack bake (tools/bake.html opens this page with ?bake=pack) ----------
// The estate's meshes in the estate frame, tagged for the pack: grp 'root' or 'houses', slot and variant for the
// per-home extras, car sets with their slot per instance. Plain meshes merge per material; a geometry drawn
// several times (the tree crowns) becomes instances.
function bakeEstateItems(est) {
  const root = est.root; root.updateMatrixWorld(true);
  const tagOf = o => {
    for (let q = o.parent; q && q !== root; q = q.parent) {
      if (q.userData.variant) return { grp: 'root', slot: q.userData.slot, variant: q.userData.variant };
      if (q.userData.slot) return { grp: 'houses', slot: q.userData.slot, variant: 'closed' };
      if (q === est.houses) return { grp: 'houses' };
    }
    return { grp: 'root' };
  };
  const visibleChain = o => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true; };
  const bad = m => !m || m.isMeshBasicMaterial || m.isShaderMaterial || m.isLineMaterial;
  const uses = new Map(); root.traverse(o => { if (o.isMesh && !o.isInstancedMesh) uses.set(o.geometry, (uses.get(o.geometry) || 0) + 1); });
  const merged = new Map(), inst = new Map(), items = [], I = new THREE.Matrix4(), Mw = new THREE.Matrix4();
  const flipWinding = g => { for (const k of Object.keys(g.attributes)) { const a = g.attributes[k], n = a.itemSize, arr = a.array;
    for (let t = 0; t < a.count; t += 3) for (let c = 0; c < n; c++) { const i1 = (t + 1) * n + c, i2 = (t + 2) * n + c, tmp = arr[i1]; arr[i1] = arr[i2]; arr[i2] = tmp; } } };
  root.traverse(o => {
    if (!o.isMesh || !visibleChain(o)) return;
    const t = tagOf(o), sh = { cast: o.castShadow, receive: o.receiveShadow }, key0 = [t.grp, t.slot, t.variant, +sh.cast, +sh.receive].join('|');
    if (o.isInstancedMesh) {
      if (Array.isArray(o.material) || bad(o.material)) { console.warn('pack bake: skipped an instanced mesh'); return; }
      const M = new Float32Array(o.count * 16);
      for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, I); Mw.multiplyMatrices(o.matrixWorld, I).toArray(M, i * 16); }
      const C = o.instanceColor ? new Float32Array(o.instanceColor.array.subarray(0, o.count * 3)) : null;
      items.push({ ...t, ...sh, mat: o.material, geo: normGeo(flatGeo(o.geometry), o.material.vertexColors), M, C, car: o.userData.car || null });
      return;
    }
    if (!Array.isArray(o.material) && !bad(o.material) && uses.get(o.geometry) > 1 && o.geometry.attributes.position.count >= 300) {
      const k = key0 + '|' + o.geometry.uuid + '|' + o.material.uuid;
      if (!inst.has(k)) inst.set(k, { ...t, ...sh, mat: o.material, src: o.geometry, list: [] });
      inst.get(k).list.push(o.matrixWorld.clone());
      return;
    }
    const mirror = o.matrixWorld.determinant() < 0;   // a mirrored plot: keep the faces facing out
    const add = (m, g) => { if (bad(m)) return; g.applyMatrix4(o.matrixWorld); if (mirror) flipWinding(g);
      const k = key0 + '|' + m.uuid; if (!merged.has(k)) merged.set(k, { ...t, ...sh, mat: m, gs: [] }); merged.get(k).gs.push(normGeo(g, m.vertexColors)); };
    if (Array.isArray(o.material) && o.geometry.groups.length) { for (const grp of o.geometry.groups) add(o.material[grp.materialIndex], flatGeo(o.geometry, grp)); }
    else add(Array.isArray(o.material) ? o.material[0] : o.material, flatGeo(o.geometry));
  });
  for (const v of inst.values()) {
    const M = new Float32Array(v.list.length * 16); v.list.forEach((m, i) => m.toArray(M, i * 16));
    const { src, list, ...rest } = v; items.push({ ...rest, geo: normGeo(flatGeo(src), v.mat.vertexColors), M, C: null, car: null });
  }
  for (const v of merged.values()) { const g = mergeGeometries(v.gs); const { gs, ...rest } = v; if (g) items.push({ ...rest, geo: g, M: null, C: null, car: null }); else console.warn('pack bake: merge failed', v.mat.type); }
  return items;
}
// Materials as three's own JSON (textures by index), textures as their settings, images as bitmaps (deduplicated
// here by source, and again by pixels in the bake page).
async function packTables(estMats = { fade: [], lamp: null }) {
  const mats = new Map(), texs = new Map(), imgs = new Map(), out = { mats: [], texs: [], imgs: [] }, transfer = [];
  const imgOf = async src => {
    if (imgs.has(src)) return imgs.get(src);
    let d = src.data, bmp = null;
    try {
      const px = d && (d.data instanceof Uint8Array || d.data instanceof Uint8ClampedArray);   // a DataTexture: RGBA bytes only
      if (px && d.data.length === d.width * d.height * 4) bmp = await createImageBitmap(new ImageData(new Uint8ClampedArray(d.data), d.width, d.height));
      else if (d && !px) bmp = await createImageBitmap(d);
    } catch (e) { console.warn('pack bake: image skipped', e); }
    const i = bmp ? out.imgs.push(bmp) - 1 : -1; if (bmp) transfer.push(bmp);
    imgs.set(src, i); return i;
  };
  const texOf = async t => {
    if (texs.has(t)) return texs.get(t);
    const img = await imgOf(t.source);
    const i = img < 0 ? -1 : out.texs.push({ img, mapping: t.mapping, channel: t.channel, wrap: [t.wrapS, t.wrapT], mag: t.magFilter, min: t.minFilter, aniso: t.anisotropy,
      flipY: t.flipY, cs: t.colorSpace, pma: t.premultiplyAlpha, mips: t.generateMipmaps, repeat: t.repeat.toArray(), offset: t.offset.toArray(), center: t.center.toArray(), rot: t.rotation }) - 1;
    texs.set(t, i); return i;
  };
  const matOf = async m => {
    if (mats.has(m)) return mats.get(m);
    const meta = { textures: {}, images: {} }, keys = [];
    for (const k in m) { const v = m[k]; if (v && v.isTexture) { keys.push(k); meta.textures[v.uuid] = { uuid: v.uuid }; } }   // skips three's own texture export
    const j = m.toJSON(meta);
    delete j.metadata; delete j.uuid; delete j.userData; delete j.envMap;
    for (const k of keys) { if (k === 'envMap') continue; const i = await texOf(m[k]); if (i >= 0) j[k] = 't' + i; else delete j[k]; }
    const i = out.mats.push({ json: j, hd: hd.usesOf(m), env: !!m.envMap, fade: estMats.fade.includes(m), lamp: m === estMats.lamp, world: TREE_MATS.includes(m) }) - 1;
    mats.set(m, i); return i;
  };
  const geo = g => { const a = {}; for (const k of Object.keys(g.attributes)) { const x = g.attributes[k]; a[k] = [x.array, x.itemSize]; transfer.push(x.array.buffer); } return a; };
  return { out, transfer, matOf, geo };
}
async function packBake(est) {
  apply(ENTRY_P);   // the walk camera where the estate hands over (model frame)
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  const entry = { pos: camera.position.toArray(), tgt: camera.position.clone().addScaledVector(dir, 20).toArray(), fov: camera.fov };
  apply(0.8);       // everything standing, finished and lit (as the hidden-page bake)
  const tb = await packTables(est ? { fade: est.fadeMats, lamp: est.mLamp } : undefined);
  const house = []; for (const { material, geometry } of bakeExterior()) house.push({ mat: await tb.matOf(material), attrs: tb.geo(geometry) });
  let estate = null;
  if (est) {
    const items = [];
    for (const it of bakeEstateItems(est)) {
      const { mat, geo, M, C, ...rest } = it;
      if (M) tb.transfer.push(M.buffer); if (C) tb.transfer.push(C.buffer);
      items.push({ ...rest, mat: await tb.matOf(mat), attrs: tb.geo(geo), M, C });
    }
    const cen = poly => poly.reduce((a, q) => [a[0] + q[0] / poly.length, a[1] + q[1] / poly.length], [0, 0]);
    const pc = ESTATE.persiaran.centre;
    estate = { items,
      slots: est.placements.map(p => ({ id: p.id, kind: p.kind, plots: p.plots, M: est.placeM(p.o, p.rot, p.mirror).toArray(), mirror: !!p.mirror })),
      walked: { semid: 'pair_002_001', bungalow: 'bungalow_001' },
      pois: [{ id: 'semid', slot: 'pair_002_001' }, { id: 'bungalow', slot: 'bungalow_001' }, { id: 'playground', xz: [-35.5, 48.5] },
        { id: 'pond', xz: ESTATE.pond ? cen(ESTATE.pond.top) : null }, { id: 'green', xz: cen(ESTATE.island.edge) },
        { id: 'entrance', xz: ESTATE.road.centre[0] }, { id: 'persiaran', xz: pc[Math.floor(pc.length / 2)] }] };
  }
  return { msg: { type: 'panthera-bake', mode: 'pack', home: HOME, entry, mats: tb.out.mats, texs: tb.out.texs, imgs: tb.out.imgs, house, estate }, transfer: tb.transfer };
}
// The walked type is baked right here; the other type comes from a hidden copy of this page (?bake=1).
let walkedLOD = null;
function bakeForEstate() {
  if (!estate) return;
  if (estate.baked) {   // the pack: the walked home's far copy shares the pack's geometry and materials
    walkedLOD = new THREE.Group(); walkedLOD.visible = false; scene.add(walkedLOD);
    for (const { material, geometry } of estate.parts[HOME]) { const m = new THREE.Mesh(geometry, material); m.castShadow = !material.transparent; m.receiveShadow = true; walkedLOD.add(m); }
    refreshSkipAO(); needRender = true; shadowDirty = true; performance.mark('walk-estate-full');
    return;
  }
  warming = true;
  apply(0.8);                                       // everything standing, finished and lit
  try {
    const parts = bakeExterior();
    estate.setHouses(HOME, parts);
    walkedLOD = new THREE.Group(); walkedLOD.visible = false; scene.add(walkedLOD);
    for (const { material, geometry } of parts) { const m = new THREE.Mesh(geometry, material); m.castShadow = !material.transparent; m.receiveShadow = true; walkedLOD.add(m); }
  } catch (e) { console.warn('bake', e); }
  apply(progress >= 0 ? progress : 0); warming = false; needRender = true; shadowDirty = true;
  const other = SEMID ? 'bungalow' : 'semid';
  const fr = document.createElement('iframe');
  fr.setAttribute('aria-hidden', 'true'); fr.tabIndex = -1;
  fr.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none;border:0';
  addEventListener('message', function onMsg(ev) {
    if (ev.source !== fr.contentWindow || !ev.data || ev.data.type !== 'panthera-bake') return;
    removeEventListener('message', onMsg);
    try { estate.setHouses(other, unpackParts(ev.data.parts)); needRender = true; shadowDirty = true; refreshSkipAO(); performance.mark('walk-estate-full'); } catch (e) { console.warn('bake other', e); }
    setTimeout(() => fr.remove(), 0);
  });
  fr.src = `./index.html?home=${other}&bake=1`;
  document.body.appendChild(fr);
}

// ---------- the standing house, merged ----------
// From P 0.25 the house stands: its walls, frames, roof, fittings and fence do not move again, about 1,300 meshes in
// about 100 materials. A merged copy, one mesh per material, is drawn in their place from there on to the fly-over
// (scrolling back up brings the originals back), so each frame issues several hundred fewer draws and the shadow pass
// a thousand fewer (owner, Nov 2026: "scrolling through it also laggy, mobile mode especially"). The same geometry and
// the same materials, so the picture is the same. Only meshes with the same place and the same visibility at four
// states between P 0.25 and 0.89 are merged: doors, sliders, fans, the gate and anything see-through or fading stay as
// they are. The originals are put on a layer the cameras do not see, so their ink outlines still draw until they fade.
const FREEZE_P = 0.25, FREEZE_AT = [0.25, 0.5, 0.75, 0.89], HIDE_LAYER = 5;
let frozen = null, frozenSrc = [], frozenOn = false;
async function freezeStatic() {
  if (frozen || disposed) return;
  const skip = new Set();
  for (const r of [...swingDoors, ...slidingPanes, ...fans, gate, ...labels, ...streetLabels, ...furn]) if (r && r.traverse) r.traverse(o => skip.add(o));
  for (const m of siteWalls) skip.add(m);
  const plain = THREE.Object3D.prototype.onBeforeRender;
  const okMat = m => m && !m.transparent && !m.isLineMaterial && !m.isShaderMaterial && m.visible !== false && m.blending === THREE.NormalBlending;
  const cand = [];
  for (const r of [house, gfDetail, ffDetail, roof, extDetail, fence, fixGF, fixFF]) r.traverse(o => {
    if (!o.isMesh || o.isLineSegments2 || o.isInstancedMesh || o.isSkinnedMesh || skip.has(o)) return;
    if (o.onBeforeRender !== plain || o.customDepthMaterial || o.customDistanceMaterial || o.renderOrder !== 0 || o.layers.mask !== 1) return;
    if (Object.keys(o.geometry.morphAttributes || {}).length) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (Array.isArray(o.material) && !o.geometry.groups.length) return;
    if (!mats.every(okMat)) return;
    cand.push(o);
  });
  // where each one sits, and whether it shows, at four states (each set and put back in this task)
  const seen = (o) => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true; };
  const rec = new Map();
  for (const P of FREEZE_AT) {
    apply(P); scene.updateMatrixWorld(true);
    for (const o of cand) {
      const v = seen(o), e = o.matrixWorld.elements, r = rec.get(o);
      if (!r) { rec.set(o, { v, m: o.matrixWorld.clone() }); continue; }
      if (!r.ok && r.ok !== undefined) continue;
      let same = r.v === v;
      for (let i = 0; same && i < 16; i++) if (Math.abs(r.m.elements[i] - e[i]) > 1e-6) same = false;
      r.ok = same && (r.ok !== false);
    }
  }
  apply(progress >= 0 ? progress : 0);
  const keep = cand.filter(o => { const r = rec.get(o); return r.ok && r.v && r.m.determinant() > 0; });
  // merged per material, shadow flags and vertex attributes
  const groups = new Map();
  for (const o of keep) {
    await slice();
    if (disposed) return;
    const M = rec.get(o).m, multi = Array.isArray(o.material);
    const pieces = multi ? o.geometry.groups.map(g => [o.material[g.materialIndex], flatGeo(o.geometry, g)]) : [[o.material, flatGeo(o.geometry)]];
    for (const [mat, g] of pieces) {
      if (!g.attributes.position || !g.attributes.position.count) continue;
      g.applyMatrix4(M);
      const sig = Object.keys(g.attributes).sort().map(k => k + g.attributes[k].itemSize).join();
      const key = mat.uuid + '|' + (o.castShadow ? 1 : 0) + (o.receiveShadow ? 1 : 0) + '|' + sig;
      if (!groups.has(key)) groups.set(key, { mat, cast: o.castShadow, recv: o.receiveShadow, gs: [] });
      groups.get(key).gs.push(g);
    }
  }
  const out = new THREE.Group(); out.name = 'frozen'; out.visible = false;
  for (const { mat, cast, recv, gs } of groups.values()) {
    await slice();
    const g = gs.length > 1 ? mergeGeometries(gs) : gs[0];
    for (const x of gs) if (x !== g) x.dispose();
    if (!g) continue;
    const m = new THREE.Mesh(g, mat); m.castShadow = cast; m.receiveShadow = recv; m.matrixAutoUpdate = false; out.add(m);
  }
  if (disposed) return;
  scene.add(out); frozen = out; frozenSrc = keep; frozenOn = false;
  refreshSkipAO();
  if (progress >= 0) apply(progress);
  needRender = true; shadowDirty = true;
}

if (LIB) await Y();   // embedded build: let the hero draw a frame
// ---------- camera path ----------
const PATH = SEMID ? [
  // p, eye position, look-at, lens (deg vertical)
  { p: 0.52, pos: null, tgt: null, fov: 42 },                          // filled from the long-lens rig
  { p: 0.64, pos: V(-4.4, 1.32, 15.5), tgt: V(-3.0, 3.0, 0), fov: 50 },    // standing in the street, at the open gate
  { p: 0.70, pos: V(-4.6, 1.32, 7.4), tgt: V(-3.0, 2.2, -1), fov: 54 },     // through the gate
  { p: 0.745, pos: V(-4.6, 1.35, 1.6), tgt: V(-2.0, 1.5, -1.5), fov: 56 },  // under the car porch, beside the parked car
  { p: 0.785, pos: V(-2.9, 1.42, 0.4), tgt: V(-1.4, 1.5, -3.0), fov: 58 },   // along the front, past the car's tail
  { p: 0.82, pos: V(-1.45, 1.50, 0.45), tgt: V(-3.4, 1.40, -5), fov: 58 },  // at the front door, doors open: through the middle
  { p: 0.91, pos: V(-2.05, 1.60, -1.45), tgt: V(-4.6, 1.30, -4.7), fov: 62 }, // inside, across the living room
  { p: 1.00, pos: V(-2.45, 1.60, -2.95), tgt: V(-9.0, 1.20, -2.6), fov: 62 }, // past the end of the stair screen wall, to the patio doors
] : [
  // Bungalow: from the driveway, under the balcony, through the double door into the double-height hall.
  { p: 0.52, pos: null, tgt: null, fov: 42 },
  // In from the road through the open gate on the corner splay (site plan), down the drive, between the two cars.
  { p: 0.64, pos: V(16.7, 1.55, 16.3), tgt: V(3.0, 2.8, 0.0), fov: 50 },     // on the estate road, at the gate
  { p: 0.70, pos: V(12.4, 1.50, 12.3), tgt: V(2.0, 2.2, -1.0), fov: 54 },    // through the gate
  { p: 0.74, pos: V(3.4, 1.45, 6.6), tgt: V(1.5, 1.6, -2.0), fov: 56 },      // in front of the porch, the cars either side
  { p: 0.775, pos: V(3.4, 1.45, 1.6), tgt: V(0.5, 1.6, -3.0), fov: 58 },     // between the cars, under the balcony
  { p: 0.795, pos: V(1.35, 1.48, 0.45), tgt: V(0.55, 1.7, -4.0), fov: 58 },   // turning to the double door
  { p: 0.82, pos: V(0.52, 1.50, -0.7), tgt: V(0.6, 1.9, -5.5), fov: 58 },  // at the double door, doors open
  { p: 0.91, pos: V(0.85, 1.60, -1.9), tgt: V(-0.2, 2.5, -7.4), fov: 64 }, // in the hall, the void and the stair ahead
  { p: 0.955, pos: V(1.6, 1.60, -4.0), tgt: V(5.5, 1.3, -5.6), fov: 63 },  // in the wide opening to the living room
  { p: 1.00, pos: V(3.30, 1.60, -4.6), tgt: V(6.6, 1.20, -6.8), fov: 62 }, // through the wide opening into the living room
];

const isWide = () => innerWidth / innerHeight > 1.05 && innerWidth > 760;
function fitDistance(W, H, fovDeg) {
  const v = THREE.MathUtils.degToRad(fovDeg);
  const hf = 2 * Math.atan(Math.tan(v / 2) * camera.aspect);
  return Math.max(H / 2 / Math.tan(v / 2), W / 2 / Math.tan(hf / 2));
}
function rig(p) {
  // Long lens straight down -> lens opens while the framing holds -> oblique view from the street.
  const a = ease(seg(p, 0.06, 0.30)), b = ease(seg(p, 0.30, 0.52));
  const wide = isWide();
  const sheetT = SEMID ? (wide ? V(-6.0, 0, -5.3) : V(0, 0, -10.2)) : (wide ? V(-5.0, 0, -1.6) : V(0.4, 0, -4.2));
  const sheetW = SEMID ? (wide ? 34 : 21) : (wide ? 34 : 20), sheetH = SEMID ? (wide ? 27.5 : 42) : (wide ? 24 : 36);
  const midT = SEMID ? V(0, 1.2, -4.2) : V(0.5, 1.2, -2.0), endT = SEMID ? V(-1.2, 2.2, -2.5) : V(1.0, 2.4, -0.5);
  const tgt = sheetT.clone().lerp(midT, a).lerp(endT, b);
  const W = lerp(lerp(sheetW, 25, a), wide ? 26 : 19, b);
  const H = lerp(lerp(sheetH, 25, a), wide ? 17 : 30, b);
  const fov = lerp(lerp(2.2, 8, a), 42, b);
  const tilt = lerp(lerp(0, 0.38, a), 1.02, b);          // radians from straight down, toward the street
  const dir = V(0, Math.cos(tilt), Math.sin(tilt));
  const pos = tgt.clone().addScaledVector(dir, fitDistance(W, H, fov));
  const up = V(0, Math.sin(tilt), -Math.cos(tilt));      // keeps the plan upright on screen
  return { pos, tgt, fov, up };
}
// The scroll runs the house walk over its first 62 %, then upstairs, then out to the estate.
const HOUSE_END = 0.62;
const PATH_UP = !SEMID ? [
  { p: 0.62, pos: V(3.30, 1.60, -4.6), tgt: V(6.6, 1.20, -6.8), fov: 62 },
  { p: 0.665, pos: V(1.6, 2.40, -3.0), tgt: V(-0.2, 2.8, -7.4), fov: 64 },    // back through the opening into the hall, the stair ahead
  { p: 0.70, pos: V(0.9, 5.00, -2.4), tgt: V(-0.6, 4.6, -6.8), fov: 64 },     // rising through the double-height void
  { p: 0.745, pos: V(-0.6, 5.30, -4.3), tgt: V(4.5, 5.0, -4.2), fov: 64 },    // first-floor corridor, facing the master door
  { p: 0.80, pos: V(3.2, 5.30, -4.3), tgt: V(6.3, 4.4, -6.8), fov: 62 },      // master bedroom
  { p: 0.83, pos: V(3.15, 5.30, -1.7), tgt: V(3.3, 4.85, 6.0), fov: 62 },     // the balcony door open ahead
  { p: 0.87, pos: V(3.15, 5.30, 1.0), tgt: V(20, 3.0, 16), fov: 56 },        // on the balcony, over the corner gate and down the road
  ...(ESTATE ? [
    { p: 0.905, pos: V(15.7, 1.32, 17.5), tgt: V(53, 2.6, 17.3), fov: 50 },   // out of the gate onto the estate road, the Semi-D row ahead
    { p: 0.94, pos: V(23.3, 1.34, 15.9), tgt: V(63, 2.8, 16.6), fov: 50 },    // walking down the street
    { p: 0.952, pos: V(25.5, 11.5, 15.0), tgt: V(52, 1.5, 22), fov: 47 },     // rising straight up, above the street lights, before pulling out
    { p: 1.00, pos: V(101, 62, 109), tgt: V(31, 0, 33), fov: 42 },            // bird's-eye over all 19 homes
  ] : [{ p: 1.00, pos: V(28, 44, 50), tgt: V(0.5, 2.0, -3.0), fov: 40 }]),   // rising over the estate
] : [
  // P (whole scroll), eye, look-at, lens
  { p: 0.62, pos: V(-2.45, 1.60, -2.95), tgt: V(-9.0, 1.20, -2.6), fov: 62 },   // end of the ground-floor walk (behind the stair screen wall)
  { p: 0.655, pos: V(-0.62, 1.62, -2.72), tgt: V(-0.62, 2.9, -7.5), fov: 62 },  // foot of the stair, looking up the flight
  { p: 0.69, pos: V(-0.62, 2.95, -4.90), tgt: V(-4.6, 2.0, -5.7), fov: 64 },    // halfway up: over the rail, down through the void to the dining room
  { p: 0.72, pos: V(-0.62, 4.42, -7.45), tgt: V(-4.0, 5.1, -7.45), fov: 64 },   // landing, turning onto the second flight
  { p: 0.745, pos: V(-2.75, 5.30, -7.40), tgt: V(-2.84, 5.2, -2.0), fov: 64 },  // first floor, facing the master bedroom door
  { p: 0.775, pos: V(-2.84, 5.30, -6.05), tgt: V(-1.3, 4.5, -2.1), fov: 64 },   // through the door
  { p: 0.80, pos: V(-4.05, 5.30, -4.30), tgt: V(-1.2, 4.4, -2.0), fov: 62 },    // master bedroom
  { p: 0.83, pos: V(-3.60, 5.30, -0.70), tgt: V(-3.6, 4.9, 6.0), fov: 60 },     // at the balcony doors
  { p: 0.87, pos: V(-3.60, 5.30, 1.05), tgt: V(-2.6, 4.2, 14.0), fov: 56 },     // on the balcony, over the street
  ...(ESTATE ? [
    { p: 0.905, pos: V(6.0, 1.32, 11.2), tgt: V(-34, 2.6, 9.6), fov: 50 },      // down on the estate road, looking along the row
    { p: 0.94, pos: V(-9.0, 1.34, 11.4), tgt: V(-44, 2.8, 10.4), fov: 50 },     // walking down the street
    { p: 1.00, pos: V(42, 62, 100), tgt: V(-25, 0, 27), fov: 42 },              // bird's-eye over all 19 homes
  ] : [{ p: 1.00, pos: V(26, 46, 52), tgt: V(0, 2.0, -5.0), fov: 40 }]),      // rising over the estate
];
// The room-by-room tour (tour_<home>.json): its frames fill P 0.62..0.87, spaced by their weights 't'.
const TOUR_A = 0.62, TOUR_B = 0.87;
if (TOUR) {
  const fr = TOUR.frames, tot = fr.reduce((a, f) => a + (f.t || 1), 0);
  let acc = 0;
  const mid = fr.map(f => { acc += f.t || 1; return { p: TOUR_A + (TOUR_B - TOUR_A) * acc / tot, pos: V(...f.pos), tgt: V(...f.tgt), fov: f.fov || 62, cap: f.cap, door: f.door }; });
  const tail = PATH_UP.filter(k => k.p > TOUR_B + 1e-6);
  PATH_UP.length = 0; PATH_UP.push({ p: TOUR_A, pos: V(...TOUR.start.pos), tgt: V(...TOUR.start.tgt), fov: TOUR.start.fov || 62 }, ...mid, ...tail);
}
// Scroll position -> walk progress. With the room tour the rooms get more of the scroll.
const S_KNOTS = TOUR ? [[0, 0], [0.40, 0.62], [0.86, 0.87], [1, 1]] : [[0, 0], [1, 1]];
const pw = (k, x, a, b) => { for (let i = 1; i < k.length; i++) if (x <= k[i][a]) { const t = (x - k[i - 1][a]) / ((k[i][a] - k[i - 1][a]) || 1); return k[i - 1][b] + t * (k[i][b] - k[i - 1][b]); } return k[k.length - 1][b]; };
const StoP = s => pw(S_KNOTS, s, 0, 1), PtoS = p => pw(S_KNOTS, p, 1, 0);
if (TOUR) { const sp = DQ('.spacer'); if (sp) sp.style.height = '3000vh'; }
function along(path, P) {
  let i = 0; while (i < path.length - 2 && P > path[i + 1].p) i++;
  const A = path[i], B = path[i + 1], u = seg(P, A.p, B.p);
  // Inside the room tour: a steady glide in straight lines (safe past walls and doors) with the gaze turning on a
  // smooth curve through the neighbouring look points, instead of easing to a stop at every frame.
  const tour = TOUR && A.p >= TOUR_A - 1e-6 && B.p <= TOUR_B + 1e-6;
  if (!tour) { const t = sine(u); return { pos: A.pos.clone().lerp(B.pos, t), tgt: A.tgt.clone().lerp(B.tgt, t), fov: lerp(A.fov, B.fov, t), up: V(0, 1, 0) }; }
  const first = A.p <= TOUR_A + 1e-6, last = B.p >= TOUR_B - 1e-6;
  const t = first && last ? sine(u) : first ? u * u * (2 - u) : last ? 1 - (1 - u) * (1 - u) * (1 + u) : u;   // ease in/out only at the two ends of the tour
  const P0 = path[Math.max(0, i - 1)], P3 = path[Math.min(path.length - 1, i + 2)];
  const cr = (a, b, c, d, x) => { const x2 = x * x, x3 = x2 * x; return b.clone().multiplyScalar(2).add(c.clone().sub(a).multiplyScalar(x)).add(a.clone().multiplyScalar(2).sub(b.clone().multiplyScalar(5)).add(c.clone().multiplyScalar(4)).sub(d).multiplyScalar(x2)).add(b.clone().multiplyScalar(3).sub(a).sub(c.clone().multiplyScalar(3)).add(d).multiplyScalar(x3)).multiplyScalar(0.5); };
  return { pos: A.pos.clone().lerp(B.pos, t), tgt: cr(P0.tgt, A.tgt, B.tgt, P3.tgt, t), fov: lerp(A.fov, B.fov, t), up: V(0, 1, 0) };
}
function pose(p) {
  if (p <= PATH[0].p) return rig(p);
  const r0 = rig(PATH[0].p); PATH[0].pos = r0.pos; PATH[0].tgt = r0.tgt;
  let i = 0; while (i < PATH.length - 2 && p > PATH[i + 1].p) i++;
  const A = PATH[i], B = PATH[i + 1], t = sine(seg(p, A.p, B.p));
  const up = i === 0 ? r0.up.clone().lerp(V(0, 1, 0), t).normalize() : V(0, 1, 0);
  return { pos: A.pos.clone().lerp(B.pos, t), tgt: A.tgt.clone().lerp(B.tgt, t), fov: lerp(A.fov, B.fov, t), up };
}

if (LIB) await Y();   // embedded build: let the hero draw a frame
// ---------- the scroll timeline ----------
const capEl = $('caption'), capNum = $('cap-num'), capText = $('cap-text');
// Captions, in whole-scroll units (the house part runs 0..0.62).
const ESTATE_CAPS = ESTATE ? [
  [0.895, 0.95, '10 · The street', 'A 40 ft estate road with open drains and LED street lights on 9 m poles.'],
  [0.95, 0.975, '11 · The estate', '19 homes on 1.96 acres: 16 Semi-Ds and 3 bungalows around a central green.'],
] : [];
const CAPS_BASE = !SEMID ? [
  [0.05, 0.223, '02 · Walls', 'Built from the floor plan. The house is 46 ft wide and 28 ft deep.'],
  [0.223, 0.36, '03 · The house', 'Five bedrooms on a 5,308 sq ft corner lot. Two pitched roofs with a flat roof between them.'],
  [0.36, 0.484, '04 · Porch', '491 sq ft, for two cars, beside the entrance.'],
  [0.484, 0.570, '05 · Entrance hall', '279 sq ft, double height, behind a timber double door.'],
  [0.570, 0.64, '06 · Living', '276 sq ft. Sliding glass doors to the garden.'],
  [0.65, 0.735, '07 · Stair', 'The stair turns around an open well in the double-height hall.'],
  [0.745, 0.835, '08 · Master bedroom', '344 sq ft, with its own bathroom.'],
  [0.84, 0.90, '09 · Balcony', '159 sq ft, over the porch.'],
  ...ESTATE_CAPS,
] : [
  [0.05, 0.223, '02 · Walls', 'Built from the floor plan. Each home is 22 ft wide and 43.5 ft deep.'],
  [0.223, 0.36, '03 · The pair', 'Two homes share a party wall. Each has its own gate, car porch and side patio.'],
  [0.36, 0.484, '04 · Porch', '415 sq ft, for two cars, under the first-floor balcony.'],
  [0.484, 0.570, '05 · Living', '321 sq ft, with a 3.5 m (11 ft 6 in) ceiling.'],
  [0.570, 0.64, '06 · Patio', 'A 293 sq ft side patio, through sliding glass doors from the living room.'],
  [0.65, 0.735, '07 · Stair', '176 mm risers. A glass rooflight over the stair void.'],
  [0.745, 0.835, '08 · Master bedroom', '337 sq ft, with a dressing area and its own bathroom.'],
  [0.84, 0.90, '09 · Balcony', '105 sq ft, over the car porch.'],
  ...ESTATE_CAPS,
];
// Brochure images from the site that pop up along the walk (no people in any of them).
const CAPS = (() => {
  if (!TOUR) return CAPS_BASE;
  const keep = CAPS_BASE.filter(c => c[0] < TOUR_A - 0.01 || c[0] >= 0.895).map(c => c[0] < TOUR_A ? [c[0], Math.min(c[1], TOUR_A + 0.002), c[2], c[3]] : c);
  const capped = PATH_UP.filter(k => k.cap && k.p > TOUR_A && k.p <= TOUR_B + 1e-6);
  const own = capped.map((k, i) => {
    const i0 = PATH_UP.indexOf(k), prev = PATH_UP[i0 - 1];
    const a = prev ? (prev.p + k.p) / 2 : k.p, next = capped[i + 1], nb = next ? PATH_UP[PATH_UP.indexOf(next) - 1].p + 0.002 : TOUR_B + 0.025;
    return [a, nb, k.cap[0], k.cap[1]];
  });
  const all = [...keep, ...own].sort((x, y) => x[0] - y[0]);
  let n = 0;   // number the captions straight through (the street and estate ones follow the rooms)
  return all.map(c => { const m = /^(\d+)( · .*)$/.exec(c[2]); if (!m) return c; n = Math.max(n + 1, c[0] < TOUR_A ? +m[1] : n + 1); return [c[0], c[1], String(n).padStart(2, '0') + m[2], c[3]]; });
})();
// (owner, Nov 2026: "no need to have these popup": the photo and plan cards that popped up during the tour are gone)
const BALC_DOOR = (() => {   // the balcony door opens over the approach to the frame marked door: 'balcony'
  const i = PATH_UP.findIndex(k => k.door === 'balcony');
  return i > 0 ? [PATH_UP[i - 1].p, PATH_UP[i].p] : [0.80, 0.826];
})();
const SLIDE = (() => {   // the balcony slider opens over the walk up to the door: the two frames before the balcony frame
  if (typeof TOUR_B === 'undefined' || !TOUR) return [0.842, 0.864];
  const i = PATH_UP.findIndex(k => Math.abs(k.p - TOUR_B) < 1e-6);
  return i > 1 ? [PATH_UP[i - 2].p, PATH_UP[i - 1].p] : [0.842, 0.864];
})();
$('endcard').inert = true;
let lastCap = -1;
// room names in the visitor's language (owner, Nov 2026: "shud be in mandarin no?"): the page's dictionary key room.<name>
const roomName = n => { const T = opts.T, k = 'room.' + n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); const v = T ? T(k) : null; return v && v !== k ? v : n; };
const ink = new THREE.Color(COL.ink), wallC = new THREE.Color(COL.wall), plaster = new THREE.Color(COL.plaster);
const paperC = new THREE.Color(COL.paper), skyC = new THREE.Color(0xE9E4DA), floorC = new THREE.Color(0xE3DACB);
// Every ink line in the scene except the render grooves and the sweep line: hidden once fully faded.
const inkLines = [];
scene.traverse(o => { if (o.isLineSegments2 && (o.material === mInk || o.material === mInkSoft)) inkLines.push(o); });
// The sun's shadow map is redrawn only when the sun, or something that casts a shadow, moved, appeared or went away,
// never for a camera move alone (owner, Nov 2026: "scrolling through it also laggy, mobile mode especially": inside
// the rooms the sun stands still, and redrawing its ~2,900 shadow draws on every scroll frame was a third of each frame).
// apply() builds a key of everything that moves a caster; tick() redraws the map on the next drawn frame when it changed.
let shadowKey = '', shadowDirty = true;
const SHADOW_REAL = [0.002, 0.01, 0.02, 0.45, 0.5, 0.98, 0.995];   // the drawing-to-photograph steps that show or hide casters
const hudLens = $('h-lens'), hudEye = $('h-eye'), hudCut = $('h-cut');
const chapterBtns = [...DQA('#chapters button')];

function apply(P) {
  const p = Math.min(P / HOUSE_END, 1);                      // the house timeline below runs on p
  // walls rise, the cut poché fades to wall
  const rise = ease(seg(p, 0.07, 0.20));
  for (const m of gfWalls) setH(m, lerp(m.userData.h0, m.userData.full, rise));
  mCap.color.copy(ink).lerp(wallC, seg(p, 0.09, 0.2));
  const heads = ease(seg(p, 0.15, 0.22));
  for (const m of gfHeads) setH(m, m.userData.full * heads);
  gfDetail.scale.y = Math.max(heads, 0.001); gfDetail.visible = heads > 0.002;
  const site = ease(seg(p, 0.12, 0.22));
  for (const m of siteWalls) setH(m, lerp(0.9, m.userData.full, site));
  const ff = ease(seg(p, 0.20, 0.32));
  for (const m of ffParts) setH(m, m.userData.full * ff);
  ffDetail.scale.y = Math.max(ff, 0.001); ffDetail.position.y = FF_BASE * (1 - ff); ffDetail.visible = ff > 0.002;
  const rf = ease(seg(p, 0.29, 0.40));                       // the roof settles onto the walls
  roof.scale.y = 1; roof.position.y = 6.0 * (1 - ease(rf)); roof.visible = rf > 0.002;   // lands from above, full size
  grooveGF.visible = rise > 0.98; grooveFF.visible = ff > 0.98;
  battenGF.visible = rise > 0.98; battenFF.visible = ff > 0.98;
  for (const l of labels) l.material.opacity = 1 - seg(p, 0.07, 0.15);
  for (const l of streetLabels) l.material.opacity = seg(p, 0.30, 0.40) * (1 - seg(p, 0.6, 0.66));
  // Drawing -> photograph: the ink fades as we come down to eye level, the real world fades in.
  const real = ease(seg(p, 0.50, 0.64));
  mInk.opacity = lerp(lerp(0.92, 0.7, seg(p, 0.2, 0.5)), 0, real);
  mInkSoft.opacity = lerp(0.38, 0, real);
  for (const l of inkLines) l.visible = real < 0.98;
  mGroove.opacity = lerp(0.4, 0.22, real);
  for (const w of world) w.material.opacity = real;
  if (estate) estate.update(real, Math.max(ease(seg(P, 0.9, 1.0)) * 0.7, LIGHT.lamp));   // street lamps: full at night
  for (const m of CTX_MATS) {   // the neighbourhood fades in with the estate (opaque again once fully real)
    const t = real < 0.999 || m.userData.t0; if (m.transparent !== t) { m.transparent = t; m.needsUpdate = true; }
    m.opacity = m.userData.o0 * real; m.visible = real > 0.002;
  }
  if (estate) { street.visible = real < 0.5; ground.visible = real < 0.98; }   // the drawing's road and paper give way to the estate's own ground
  skyMat.uniforms.opacity.value = real; sky.visible = real > 0.002; garden.visible = real > 0.5;
  fence.visible = real > 0.5;                                  // vent-block fences replace the drawn site walls
  extDetail.visible = rf > 0.98;                               // downpipes, tanks, slab band, aprons once the roof is on
  if (real > 0.5) { for (const m of siteWalls) m.visible = false; grooveGF.visible = grooveFF.visible = false; }
  scene.background.copy(paperC).lerp(skyC, real);
  mLight.color.copy(wallC).lerp(floorC, real);                // floor tops and sills: drawing white -> porcelain

  // the living room sweep: floor, furniture, walls warm up
  const sw = ease(seg(p, 0.835, 0.95));
  const front = lerp(0.15, -FINISH.z0 + 0.2, sw);
  sweepPlane.constant = front;
  sweepLine.position.z = -front;
  sweepLine.material.opacity = sw > 0 && sw < 1 ? 0.9 : 0;
  const fr = ease(seg(p, 0.16, 0.24));
  const ffShow = ff > 0.98;
  fixGF.visible = heads > 0.98; fixFF.visible = ffShow;
  furnPlan.visible = real < 0.45; furnGF.visible = real > 0.45 || heads > 0.98 && real > 0.02; furnFF.visible = ffShow;
  for (const m of furn) {
    if (m.userData.ff) {   // upstairs: already finished when you arrive
      m.scale.y = 1; m.position.y = m.userData.base; m.visible = ffShow; m.material.color.copy(m.userData.real); continue;
    }
    m.scale.y = Math.max(fr, 0.001); m.position.y = m.userData.base * fr + 0.012 * (1 - fr);   // lifted off the floor while flat, so its ink reads on the plan
    const reached = P > 0.6 ? 1 : clamp((front + m.userData.zf) / 0.8);   // the sweep has passed this piece's front edge (every room is finished for the tour)
    m.material.color.copy(m.userData.white).lerp(m.userData.real, reached);
  }
  // Sun: overhead while it's a drawing (no shadows across the plan), then down to late afternoon.
  const sunT = sine(seg(p, 0.14, 0.5));
  sun.position.set(lerp(0.3, -20, sunT), lerp(60, 15, sunT), lerp(-4, 18, sunT));
  const sunIn = sine(seg(p, 0.80, 0.93));                     // inside: swing west so it pours through the patio doors
  sun.position.lerp(V(-24, 10.5, 1.5), sunIn);
  // Over the estate: the same low sun, but its shadow box widens to take in all 19 homes.
  const wide = estate ? sine(seg(P, 0.88, 0.97)) : 0;
  sun.target.position.set(0, 0, -4).lerp(estate ? estate.centre : V(0, 0, -4), wide);
  if (wide > 0) {   // and swings round to the south-west, so the shadows fall sideways across the plots, as seen from above
    const dir = sun.position.clone().sub(V(0, 0, -4)), L = dir.length();
    dir.multiplyScalar(1 / L).lerp(V(-1, 0.42, 0.95).normalize(), wide).normalize();   // low, about 16 deg, as the hero's golden sun
    sun.position.copy(sun.target.position).add(dir.multiplyScalar(lerp(L, 160, wide)));
  }
  if (TOD.dir) sun.position.copy(sun.target.position).addScaledVector(TOD.dir, sun.position.distanceTo(sun.target.position));   // day / night: the sky's own sun
  const half = lerp(24, 82, wide), cam = sun.shadow.camera;
  if (Math.abs(cam.right - half) > 0.01) { Object.assign(cam, { left: -half, right: half, top: half, bottom: -half, far: lerp(90, 360, wide) }); cam.updateProjectionMatrix(); }
  mWall.color.copy(wallC).lerp(plaster, ease(seg(p, 0.32, 0.5)));   // drawing-white -> the house's cream once it stands
  mPlasterDS.color.copy(mWall.color);                          // roof gables, strip faces and parapet: the same cream white
  mRender.color.copy(mWall.color);                             // boundary walls too
  mInkFurn.opacity = lerp(0.9, 0.08, sw);
  const inside = seg(p, 0.78, 0.9);
  // Inside: less flat fill, more sun, so the light through the glass and the leaf shadows read.
  // Interior lights always on in the tour (owner, Nov 2026: "the lights should be always on"), whatever the time of day:
  // lit from the moment the drawing becomes the photograph, off only once the interior is put away over the estate.
  // The point lights (no shadows, no wall test) stay on the inside ramp, or they would light the porch through the walls.
  const farIn = !!walkedLOD && P > 0.9;
  const lightsOn = farIn ? 0 : real;
  diningLight.intensity = 5 * inside * LIGHT.inl;
  for (const l of lanterns) l.material.emissiveIntensity = lightsOn * LIGHT.inl;
  for (const d of downs) d.material.opacity = lightsOn * (d.material.map ? 0.75 : 1);
  const cPose = P <= HOUSE_END ? pose(p) : along(PATH_UP, P);
  {
    const at = cPose.pos;
    // Each fitting is weighted by storey (cross-faded on the stair) and ranked by distance; a fitting behind a wall gives
    // no light (no shadows here, so it would bleed through); the last slots fade in and out instead of popping.
    const up = seg(at.y, 3.0, 4.6), N = LIGHT_POOL.length;
    const cand = [];
    for (const f of lightsOn > 0 ? fixtures : []) {
      const w = f.shared ? 1 : f.fl ? up : 1 - up;
      if (w < 0.01) continue;
      const b = wallBetween(at, f.p, f.shared ? up > 0.5 : f.fl);
      cand.push({ f, w, b, d: f.p.distanceTo(at) + (b ? 4 : 0) });
    }
    cand.sort((a, b) => a.d - b.d);
    const open = cand.filter(c => !c.b), dOut = open.length > N ? open[N].d : Infinity;
    LIGHT_POOL.forEach((l, i) => {
      const c = cand[i];
      if (!c) { l.intensity = 0; return; }
      l.intensity = c.b ? 0 : c.f.I * lightsOn * LIGHT.inl * c.w * clamp(dOut - c.d);
      l.angle = c.f.a; l.position.copy(c.f.p); l.target.position.copy(c.f.p).add(c.f.d); l.target.updateMatrixWorld();
    });
    roomLight.intensity = (HIFI ? 2.2 : 2.8) * inside * LIGHT.inl * (1 - up);
  }
  for (const d of outdoorGlow) {   // porch, patio and gate lights on at golden hour (brighter at night)
    const m = d.material; m.opacity = real * 0.9;
    if (m.userData.glow !== LIGHT.glow) { if (!m.userData.c0) m.userData.c0 = m.color.clone(); m.color.copy(m.userData.c0).multiplyScalar(LIGHT.glow); m.userData.glow = LIGHT.glow; }
  }
  gate.visible = real > 0.02;
  const doorOpen = ease(seg(p, 0.755, 0.80));                 // the front door swings open as you reach it
  for (const sp of slidingPanes) sp.position.x = sp.userData.dx * ease(seg(P, SLIDE[0], SLIDE[1]));   // slider opens onto the balcony
  for (const d of swingDoors) d.rotation.y = d.userData.sg * (d.userData.late ? ease(seg(P, BALC_DOOR[0], BALC_DOOR[1])) : doorOpen) * Math.PI * 0.5;
  for (const b of pendants) b.material.opacity = lightsOn;
  for (const l of skyLights) l.intensity = 1.8 * inside;
  hemi.intensity = lerp(0.55, 0.3, inside) * LIGHT.hemi;
  sun.intensity = lerp(2.3, 3.4, inside) * LIGHT.sun;
  scene.environmentIntensity = lerp(0.5, 0.45, inside) * LIGHT.env * lerp(1, LIGHT.out, wide);   // LIGHT.env matches the HDRI's level to RoomEnvironment's
  renderer.toneMappingExposure = lerp(1.0, 0.98, inside) * LIGHT.expo;   // lighter floors and oak inside (Japandi): a touch less exposure
  if (TOD.name === 'golden') {   // over the estate: warmer sun, warm low fill, a touch less exposure (GOLD_WIDE)
    sun.color.copy(GOLD_BASE.sun).lerp(GOLD_WIDE.sun, wide);
    hemi.color.copy(GOLD_BASE.hemi[0]).lerp(GOLD_WIDE.hemi[0], wide); hemi.groundColor.copy(GOLD_BASE.hemi[1]).lerp(GOLD_WIDE.hemi[1], wide);
    sun.intensity = lerp(sun.intensity, GOLD_WIDE.sunI, wide); hemi.intensity = lerp(hemi.intensity, GOLD_WIDE.hemiI, wide);
    renderer.toneMappingExposure = lerp(renderer.toneMappingExposure, GOLD_WIDE.expo, wide);
  }

  // camera
  const c = cPose;
  // Indoors, a wide architectural lens (like an interior photographer's 16-20 mm) so rooms read at their true
  // size: about 80 deg across on a landscape screen; on a portrait phone the same width, so a taller view.
  {
    const indoor = P > HOUSE_END ? clamp(seg(P, 0.60, 0.63) * (1 - seg(P, 0.865, 0.885))) : seg(p, 0.80, 0.86);
    if (indoor > 0) {
      const hTarget = 80 * Math.PI / 180, vFromH = 2 * Math.atan(Math.tan(hTarget / 2) / Math.max(camera.aspect, 0.3)) * 180 / Math.PI;
      c.fov = lerp(c.fov, clamp(Math.max(c.fov, vFromH), 0, 100), indoor);
    }
  }
  if (ESTATE && camera.aspect < 1 && P > 0.94) {   // portrait screens: stand further back for the bird's-eye so the whole estate fits
    const k = lerp(1, Math.min(2.1, Math.pow(1 / camera.aspect, 0.85)), sine(seg(P, 0.94, 1)));
    c.pos = c.tgt.clone().add(c.pos.clone().sub(c.tgt).multiplyScalar(k));
  }
  camera.fov = c.fov; camera.up.copy(c.up);
  camera.position.copy(c.pos); camera.lookAt(c.tgt);
  const dist = c.pos.distanceTo(c.tgt);
  // Long-lens plan/aerial: a far near-plane keeps depth precise. Walking at eye level: almost zero, so a wall
  // half a metre away is never clipped open.
  camera.near = p > PATH[0].p || P > HOUSE_END ? 0.05 : Math.max(0.05, Math.min(dist * 0.25, 40));
  if (P > 0.875) camera.near = Math.max(0.05, Math.min(camera.position.y * 0.08, 4));   // outdoors again: keep depth precision for the estate ground
  camera.far = ESTATE ? Math.max(dist + 160, 700) : dist + 160;
  camera.updateProjectionMatrix();
  sky.position.copy(camera.position);
  useFX = !!composer && real > 0.98;
  fanNear = !REDUCED && inside > 0.3 && fans.some(f => f.parent && f.parent.visible && f.getWorldPosition(tmpFanV).distanceToSquared(camera.position) < 64);

  // overlays
  $('intro').classList.toggle('is-hidden', p > 0.05);
  $('titleblock').classList.toggle('is-hidden', p > 0.12);
  { const on = P > 0.975, ec = $('endcard'); if (ec.classList.contains('show') !== on) { ec.classList.toggle('show', on); ec.inert = !on; } }
  toggleEl && toggleEl.classList.toggle('dim', P > 0.06 && P < 0.975);
  let ci = CAPS.findIndex(([a, b]) => P >= a && P < b);
  if (ci !== lastCap) {
    lastCap = ci;
    // the room name alone (owner, Nov 2026: "just show the room name"); from one room straight into the next, the name
    // settles in again (the class comes off for a frame so its transition replays)
    capEl.classList.remove('show');
    if (ci >= 0) { capNum.textContent = roomName(CAPS[ci][2].replace(/^\d+\s*·\s*/, '')); capText.textContent = ''; void capEl.offsetWidth; capEl.classList.add('show'); }
  }
  hudLens.textContent = c.fov.toFixed(1) + '°';
  const floorY = c.pos.z > 0.05 && c.pos.y < FF_BASE ? GROUND : (c.pos.y > FF_BASE + 0.6 && c.pos.y < 8 ? FF_BASE : 0);
  hudEye.textContent = p > 0.58 && c.pos.y < 8 ? (c.pos.y - floorY).toFixed(2) + ' m' : '–';
  gfFloor.visible = P > 0.6 && !(walkedLOD && P > 0.9);
  // Out over the estate: your home swaps to its baked copy and the interior is put away (far fewer draw calls).
  const far = !!walkedLOD && P > 0.9;
  if (walkedLOD) {
    walkedLOD.visible = far; house.visible = !far;
    if (far) for (const g of [gfDetail, ffDetail, roof, extDetail, garden, battenGF, battenFF, fixGF, fixFF, furnGF, furnFF]) g.visible = false;
    for (const m of furn) if (far) m.visible = false; else if (!m.userData.ff) m.visible = true;
  }
  if (frozen) {   // the merged standing house (freezeStatic) in place of its ~1,300 parts, from P 0.25 to the fly-over
    const fz = P >= FREEZE_P && P <= 0.9 && !far;
    frozen.visible = fz;
    if (fz !== frozenOn) { frozenOn = fz; for (const o of frozenSrc) o.layers.set(fz ? HIDE_LAYER : 0); }
  }
  {   // the shadow key (see shadowKey): sun and its shadow box, everything that rises, lands, swings or slides, what is shown
    const sp = sun.position, st = sun.target.position;
    let k = '';
    for (const v of [sp.x, sp.y, sp.z, st.x, st.y, st.z, half, rise, heads, site, ff, rf, fr, doorOpen, seg(P, SLIDE[0], SLIDE[1]), seg(P, BALC_DOOR[0], BALC_DOOR[1])]) k += v.toFixed(4) + ',';
    for (const t of SHADOW_REAL) k += real > t ? 1 : 0;
    k += (far ? 'F' : 'f') + (gfFloor.visible ? 'G' : 'g') + (frozenOn ? 'Z' : 'z');
    if (k !== shadowKey) { shadowKey = k; shadowDirty = true; }
  }
  hudCut.textContent = p < 0.08 ? '+1.20 m' : 'none';
  const chap = [0, 0.112, 0.248, 0.384, 0.496, 0.63, 0.88].reduce((acc, v, i) => (P >= v ? i : acc), 0);
  chapterBtns.forEach((b, i) => b.classList.toggle('on', i === chap));
}

if (LIB) await Y();   // embedded build: let the hero draw a frame
// ---------- resize, scroll, loop ----------
// HD path (desktop, once the drawing has become a photograph): MSAA render target,
// ground-truth ambient occlusion for soft contact shadows, then tone mapping + sRGB.
let useFX = false, composer = null, gtao = null, grade = null, refreshSkipAO = () => {};
const FXm = HIFI && FXMODS ? await FXMODS : null;
const skipAO = [];
if (FXm) {
  const [{ EffectComposer }, { RenderPass }, { GTAOPass }, { OutputPass }, { UnrealBloomPass }, { ShaderPass }] = FXm;
  const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 4 });
  composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  composer.addPass(new RenderPass(scene, camera));
  gtao = new GTAOPass(scene, camera, innerWidth, innerHeight);
  // More AO samples and a wider, edge-aware denoise: soft contact shadows without the grain.
  gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.4, thickness: 1.2, scale: 1.0, samples: 24, screenSpaceRadius: false });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 9, rings: 3, samples: 24 });
  gtao.blendIntensity = 0.85;
  // Lines, glass, sky and bulbs must not write into the AO normal/depth pass.
  refreshSkipAO = () => { skipAO.length = 0; scene.traverse(o => { if (o.isLineSegments2 || o === sky || (o.material && !Array.isArray(o.material) && (o.material.transparent || o.material.isMeshBasicMaterial))) skipAO.push(o); }); };
  refreshSkipAO();
  const aoRender = gtao.render.bind(gtao);
  gtao.render = (...a) => { const v = skipAO.map(o => o.visible); skipAO.forEach(o => { o.visible = false; }); aoRender(...a); skipAO.forEach((o, i) => { o.visible = v[i]; }); };
  composer.addPass(gtao);
  // Guard: a single invalid (NaN / infinite) pixel would be smeared by the bloom blur into a black block across the
  // frame (seen on very wide windows over the estate), so any such pixel is zeroed and HDR is capped before the bloom.
  composer.addPass(new ShaderPass({
    uniforms: { tDiffuse: { value: null } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
      void main(){ vec4 c = texture2D(tDiffuse, vUv);
        bool bad = any(isnan(c.rgb)) || any(isinf(c.rgb)) || c.r < 0.0 || c.g < 0.0 || c.b < 0.0;
        gl_FragColor = vec4(bad ? vec3(0.0) : min(c.rgb, vec3(32.0)), 1.0); }`,
  }));
  // Cinematic finish: a soft bloom on lamps, lit windows and sun glints, then a filmic grade (warm highlights,
  // slightly cool shadows, gentle contrast and richness), a soft vignette and a whisper of film grain.
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.2, 0.45, 1.05);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, seed: { value: 0 }, amount: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float seed; uniform float amount; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + seed) * 43758.5453); }
      void main(){
        vec3 c = texture2D(tDiffuse, vUv).rgb, g = c;
        float l = dot(g, vec3(0.2126, 0.7152, 0.0722));
        g = mix(vec3(l), g, 1.08);                                                  // a little richer
        g = mix(g, g * vec3(1.04, 1.0, 0.94), smoothstep(0.45, 1.0, l));            // warm highlights
        g = mix(g, g * vec3(0.95, 0.99, 1.04), 1.0 - smoothstep(0.0, 0.35, l));      // cool, deep shadows
        g = (g - 0.5) * 1.06 + 0.5;                                                 // gentle S
        vec2 q = vUv - 0.5; g *= 1.0 - 0.16 * smoothstep(0.4, 0.9, length(q * vec2(1.15, 1.0)));   // vignette (the page adds a soft one too)
        g += (h(vUv * 1024.0) - 0.5) * 0.022;                                       // fine grain
        gl_FragColor = vec4(mix(c, clamp(g, 0.0, 1.0), amount), 1.0);
      }`,
  });
  composer.addPass(grade);
}
function resize() {
  const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
  if (!LIB) renderer.setSize(w, h, false);   // embedded: the hero sizes the shared canvas
  camera.aspect = w / h; camera.updateProjectionMatrix();
  for (const m of lineMats) m.resolution.set(w, h);
  if (composer) composer.setSize(w, h);
}
addEventListener('resize', resize, sig);
resize();

// Embedded: Lenis drives the overlay's own scroller (wheel anywhere over this home's HUD), not the page.
// Touch screens with no mouse or trackpad: the browser's own scroll, no Lenis. Lenis never smooths a finger anyway (its
// glide is for the wheel), but it puts blocking touch listeners on the HUD, so every swipe waited for the walk's frame
// before the page could scroll (owner, Nov 2026: "scrolling through it also laggy, mobile mode especially").
const TOUCH = COARSE && !matchMedia('(any-pointer: fine)').matches;
const LenisC = (LIB && opts.Lenis) || window.Lenis;
const lenis = TOUCH || !LenisC
  ? { raf() {}, destroy() {}, scrollTo(y, o = {}) { (SCROLLER || window).scrollTo({ top: y, behavior: o.immediate || REDUCED ? 'auto' : 'smooth' }); } }   // auto: at once (no CSS smooth scroll on either)
  : SCROLLER ? new LenisC({ wrapper: SCROLLER, content: SCROLLER.firstElementChild, eventsTarget: UI, smoothWheel: !REDUCED, lerp: 0.065 })
  : new LenisC({ smoothWheel: !REDUCED, lerp: 0.065 });   // a slower, dolly-like glide
const maxScroll = () => SCROLLER ? SCROLLER.scrollHeight - SCROLLER.clientHeight : document.documentElement.scrollHeight - innerHeight;
const scrollPos = () => SCROLLER ? SCROLLER.scrollTop : window.scrollY;
if (TOUR) { const up = chapterBtns.find(b => /Upstairs/.test(b.textContent)); if (up) { up.textContent = '06 Rooms'; up.dataset.p = String(TOUR_A + 0.004); } }
chapterBtns.forEach(b => b.addEventListener('click', () => lenis.scrollTo(PtoS(parseFloat(b.dataset.p)) * maxScroll() + 1, { immediate: REDUCED })));

const toggleEl = DQ('.hometoggle');
let progress = -1, needRender = true, spinTick = 0;
addEventListener('resize', () => { needRender = true; progress = -1; }, sig);   // re-run the camera rig for the new shape
// One frame: scroll -> walk state -> draw if anything moved. The page loops it; the hero calls it from its own loop.
function tick(t) {
  lenis.raf(t);
  const p = StoP(clamp(scrollPos() / Math.max(1, maxScroll())));
  if (Math.abs(p - progress) > 1e-5) { progress = p; apply(p); needRender = true; }
  const spin = progress > 0.44 && progress < 0.9 && fanNear;   // fans turn slowly once one is near
  // Desktop: every frame, the rotor's shadow refreshed every 4th. Phones: the same speed in steps of two frames, so a
  // visitor standing under a fan does not keep the phone drawing (and heating) at full rate; its shadow is left as is.
  if (spin && (HIFI || (spinTick & 1) === 0)) { for (const f of fans) f.userData.rotor.rotation.y += HIFI ? 0.035 : 0.07; needRender = true; if (HIFI && (spinTick & 3) === 0) shadowDirty = true; }
  if (spin) spinTick++;
  if (needRender && !document.hidden && !warming) {   // draw only when something moved
    if (shadowDirty) { renderer.shadowMap.needsUpdate = true; shadowDirty = false; }   // the sun's shadows, only when they changed
    if (grade) grade.uniforms.seed.value = (grade.uniforms.seed.value + 0.137) % 10;
    if (useFX) composer.render(); else renderer.render(scene, camera); needRender = false;
    adapt(t);
  } else lastDraw = 0;
}
function frame(t) {
  tick(t);
  requestAnimationFrame(frame);
}
// Adaptive sharpness: start at the screen's own resolution; if frames keep running slow while you scroll,
// step the render resolution down a little (never below 1x) so the walk stays smooth.
let lastDraw = 0, slow = 0, okFrames = 0;
function adapt(t) {
  if (lastDraw) {
    const dt = t - lastDraw;
    if (dt > 26) slow++; else if (dt < 20) okFrames++;   // under ~38 fps counts as slow
    if (slow > 20 && slow > okFrames * 0.5) {
      const pr = renderer.getPixelRatio();
      if (pr > 1.01) { const np = Math.max(1, pr - 0.25); walkDPR = np; renderer.setPixelRatio(np); if (composer) composer.setPixelRatio(np); resize(); }
      slow = okFrames = 0;
    }
    if (okFrames > 400) slow = okFrames = 0;
  }
  lastDraw = t;
}
// Compile every material once, in the background, so nothing hitches when it first appears mid-scroll: at the opening
// drawing, as the photograph arrives (P 0.385: the desktop finish is on, the estate still fading) and at the photograph
// (P 0.65), where the estate and the neighbourhood are opaque (other shaders each time).
// compile() takes every mesh, shown or not. The embedded build compiles a part of the scene at a time with a break
// between (no long stretch of shader set-up on the main thread); the page does it all at once, so it never shows a state.
let warming = false;
// compile() builds each shader for the clipping state the last draw left behind (a clipped wall: one plane), so most of
// the warm-up was for shaders nothing used; an empty draw first puts that state back to none (no shadows, no pixels)
const EMPTY = new THREE.Scene();
let emptyRT = null;
function clipReset() {
  const prev = renderer.getRenderTarget(), sh = renderer.shadowMap.needsUpdate;
  emptyRT = emptyRT || new THREE.WebGLRenderTarget(1, 1);
  renderer.shadowMap.needsUpdate = false; renderer.setRenderTarget(emptyRT); renderer.render(EMPTY, camera);
  renderer.setRenderTarget(prev); renderer.shadowMap.needsUpdate = sh;
}
async function prewarm(states = [0, 0.385, 0.65]) {
  if (!renderer.compileAsync) return;
  const jobs = [];
  warming = true;
  try {
    for (const P of states) {
      apply(P);
      // desktop, once the drawing is a photograph: the scene is drawn into the finish's own target (AO, bloom, grade),
      // which takes its own shaders (no tone mapping there): those too, or the first photograph frame stalled seconds
      const tgts = composer && P > 0.38 ? [null, composer.renderTarget1] : [null];
      for (const tg of tgts) for (const part of scene.children) {
        if (disposed) break;
        if (!part.isMesh && !part.children.length) continue;
        await slice();
        clipReset();
        const prev = renderer.getRenderTarget(); renderer.setRenderTarget(tg);
        jobs.push(renderer.compileAsync(part, camera, scene).catch(() => {}));   // the shaders are created now, the wait is below
        renderer.setRenderTarget(prev);
      }
    }
  } catch (e) { /* compile on first use instead */ }
  if (!disposed) apply(progress >= 0 ? progress : 0);
  await Promise.all(jobs);
  warming = false; needRender = true; shadowDirty = true;
}
// Draw everything once, a few groups at a time with a break between, so every mesh and map is on the GPU and the
// shaders the compile above cannot know (the clipped materials such as the walls, the shadow pass) are built before the
// walk is on screen: without it the first frame of the plan froze for a quarter of a second, and the merged house
// (freezeStatic) would upload in the middle of the scroll. Drawn to the screen (a render target would build other
// shaders), and at once covered by the frame the visitor sees (opts.cover: the hero's own frame; the page: the walk's),
// so the screen never shows it.
async function warmDraw() {
  const sh0 = renderer.shadowMap.needsUpdate, prev = renderer.getRenderTarget();
  const tops = scene.children.filter(o => !o.isLight && o !== sun.target), batches = [];
  { let cur = [], n = 0;
    const CAP = opts.warmBatch ? opts.warmBatch() : 600;   // embedded and built ahead: smaller batches (explore.js)
    for (const o of tops) { let c = 0; o.traverse(q => { if (q.isMesh) c++; }); cur.push(o); n += c; if (n > CAP) { batches.push(cur); cur = []; n = 0; } }
    if (cur.length) batches.push(cur); }
  const vis = new Map(), cull = [];   // the state as it is, taken again for each batch (the page may scroll meanwhile)
  const take = () => { vis.clear(); cull.length = 0; scene.traverse(o => { vis.set(o, o.visible); if (o.frustumCulled && (o.isMesh || o.isLine || o.isPoints)) cull.push(o); }); };
  const restore = () => { for (const [o, v] of vis) o.visible = v; for (const o of cull) o.frustumCulled = true; };
  const cover = () => {
    if (opts.cover) { opts.cover(); return; }
    renderer.shadowMap.needsUpdate = true; if (useFX) composer.render(); else renderer.render(scene, camera);
  };
  warming = true;
  try {
    for (const b of batches) {
      if (disposed) break;
      take();
      for (const o of tops) o.visible = false;
      for (const o of b) o.traverse(q => { q.visible = true; });
      for (const o of cull) o.frustumCulled = false;
      renderer.setRenderTarget(null); renderer.shadowMap.needsUpdate = true; renderer.render(scene, camera);
      restore(); renderer.shadowMap.needsUpdate = sh0; renderer.setRenderTarget(prev);
      cover();
      await brk();
    }
    if (composer && !disposed) {   // desktop: the photograph's finish (contact shadows, bloom, grade), first used at P 0.4,
      apply(0.65); take();         // at the photograph's state, everything once (set, drawn and put back in this task)
      scene.traverse(o => { o.visible = true; }); for (const o of cull) o.frustumCulled = false;
      renderer.setRenderTarget(null); renderer.shadowMap.needsUpdate = true; composer.render(); restore();
      renderer.shadowMap.needsUpdate = sh0; renderer.setRenderTarget(prev);
      apply(progress >= 0 ? progress : 0);
      cover();
    }
  } catch (e) { /* drawn on first use instead */ }
  finally { restore(); renderer.shadowMap.needsUpdate = sh0; renderer.setRenderTarget(prev); }
  if (!disposed && progress >= 0) apply(progress);
  warming = false; needRender = true; shadowDirty = true;
}

// ---------- light and sky: the HDRI and the time of day ----------
// The golden sky is turned so its sun glow sits where the walk's street sun is (sun at (-20, 15, 18) over (0, 0, -4)).
const ENV_YAW = Math.atan2(SKIES.golden.sun[2], SKIES.golden.sun[0]) - Math.atan2(22, -20);
// For the estate hero (not wired to the page yet): window.__walk.setTimeOfDay('day' | 'golden' | 'night') switches the
// HDRI that lights and reflects, the sun, sky dome, fog, exposure and the outdoor lamps. Golden is the walk as built.
// L multiplies the walk's own levels in apply(); out lifts the sky fill over the estate (a horizon-lit sky gives roofs
// and lawns less light than RoomEnvironment did; 2 brings the golden fly-over back to its old brightness). inl scales the
// interior lights, which are on at every time of day (owner, Nov 2026).
const TODS = {
  golden: { top: 0x9DBBD0, horizon: 0xF3E7D6, bg: 0xE9E4DA, sun: 0xFFE2BF, hemi: [0xFFF4E4, 0xCBB8A2], L: { env: 1, out: 1, expo: 1, sun: 1, hemi: 1, lamp: 0.9, glow: 1, inl: 1 } },   // out 1: no doubled flat fill over the estate (the low sun lights it)
  day: { top: 0x7FA8D2, horizon: 0xE8EEF1, bg: 0xE8ECEE, sun: 0xFFF5E6, hemi: [0xF4F7FF, 0xC8C0B0], L: { env: 1.15, out: 1.5, expo: 1, sun: 1.1, hemi: 1.1, lamp: 0, glow: 0.5, inl: 0.85 } },
  night: { top: 0x1E2B45, horizon: 0x5E6382, bg: 0x2B3247, sun: 0xA9BCE0, hemi: [0x56648A, 0x2A2724], L: { env: 0.3, out: 1, expo: 0.85, sun: 0.1, hemi: 0.3, lamp: 1, glow: 1.8, inl: 1.3 } },
};
let roomLevel = 0;
// Materials that carry their own env map (the cars): point them at the current sky, at the current level.
function retargetEnv(root, from) {
  const env = scene.environment;
  root.traverse(o => {
    for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
      if (!m.envMap || (m.envMap !== from && m.envMap !== env)) continue;
      if (m.userData.envI0 == null) m.userData.envI0 = m.envMapIntensity;
      m.envMap = env; m.envMapIntensity = m.userData.envI0 * LIGHT.env;
      if (m.envMapRotation) m.envMapRotation.copy(scene.environmentRotation);
    }
  });
}
async function setTimeOfDay(name = 'golden') {
  const T = TODS[name];
  if (!T) return false;
  TOD.name = name;
  const s = await hd.sky(name);              // null with HD off or a failed file: RoomEnvironment stays
  if (TOD.name !== name || disposed) return false;   // a later call took over (or the embedded walk was closed)
  Object.assign(LIGHT, T.L);
  skyMat.uniforms.top.value.set(T.top); skyMat.uniforms.horizon.value.set(T.horizon); skyC.set(T.bg);
  TOD.fog = T.horizon; if (scene.fog) scene.fog.color.set(T.horizon);
  sun.color.set(T.sun); hemi.color.set(T.hemi[0]); hemi.groundColor.set(T.hemi[1]);
  TOD.dir = name === 'golden' ? null : new THREE.Vector3(...SKIES[name].sun).applyAxisAngle(new THREE.Vector3(0, 1, 0), ENV_YAW).normalize();
  const old = scene.environment;
  if (s) {   // same mean light on a white cube as RoomEnvironment gave, so rooms are no brighter or flatter than before
    if (!roomLevel) roomLevel = hd.level(roomEnv);
    LIGHT.env *= roomLevel > 0 && s.level > 0 ? clamp(roomLevel / s.level, 0.25, 4) : 1;
    scene.environment = s.env; scene.environmentRotation.set(0, ENV_YAW, 0);
  } else { scene.environment = roomEnv; scene.environmentRotation.set(0, 0, 0); LIGHT.out = 1; }   // out only makes up for the HDRI
  retargetEnv(scene, old);
  if (progress >= 0) apply(progress);
  needRender = true; shadowDirty = true;
  return true;
}

performance.mark('walk-built');
if (PACKBAKE) {   // tools/bake.html: this home's exterior, and on the Semi-D page the whole estate (every plot, both gate states)
  apply(0);       // the estate is built at the walk's opening state, as on the page (its boundary-wall colour follows mWall)
  let est = null;
  if (SEMID && ESTATE && OTHER) {
    est = buildEstate({ THREE, E: ESTATE, home: HOME, all: true, models: { semid: { D, X }, bungalow: OTHER },
      mats: { wall: mWall, tile: mTile }, tex: estateTextures(), polyGeometry, mergeGeometries, makeTree, carSpots: CAR_SPOTS, carKit: carKit(), carMid: carKit('mid'), hd: hd.use });
  }
  const { msg, transfer } = await packBake(est);
  parent.postMessage(msg, location.origin, transfer);
} else if (BAKE) {   // helper page: build, stand everything up, bake the exterior and hand it to the page that opened us
  apply(0.8);
  const { out, transfer } = await packParts(bakeExterior());
  parent.postMessage({ type: 'panthera-bake', home: HOME, parts: out }, location.origin, transfer);
} else if (!LIB) {
  apply(0); progress = 0;
  renderer.shadowMap.needsUpdate = true; shadowDirty = false;   // the first frame draws the sun's shadows too
  renderer.render(scene, camera);
  performance.mark('walk-ready');
  loader.classList.add('done');
  requestAnimationFrame(frame);
  hd.start();                                  // photo maps swap in from here as they arrive (needRender is live now)
  const todP = HD_RES ? setTimeOfDay('golden') : null;   // the HDRI sky replaces RoomEnvironment when it arrives
  (window.requestIdleCallback || ((f) => setTimeout(f, 60)))(() => { buildEstateNow().then(() => setTimeout(async () => {
    bakeForEstate(); await freezeStatic();
    // the golden sky first (as embedded, 2.5 s at most): its light takes other shaders, which otherwise compiled mid-scroll
    await Promise.race([Promise.all([todP, ctxP]), new Promise(r => setTimeout(r, 2500))]);
    await prewarm(); warmDraw();
    hd.settled().then(() => { if (progress < 0.45 && !warming) prewarm(); });   // compile the new map variants while still on the plan
  }, 50)); }, { timeout: 1200 });
}
if (LIB && !PACKBAKE && !BAKE) {   // embedded: the estate and every shader ready before the hero hands over (it draws the frames)
  apply(0); progress = 0;
  performance.mark('walk-ready');
  hd.start();
  const todP = HD_RES ? setTimeOfDay('golden') : null;
  await buildEstateNow(); bakeForEstate(); await Y();
  await freezeStatic();
  // the photo maps, the golden sky and the neighbourhood in before the shaders are built (each one changes them), so
  // the hand-over and the scroll compile nothing; a slow connection waits 2.5 s at most and its late maps compile on use
  await Promise.race([Promise.all([hd.settled(), todP, ctxP]), new Promise(r => setTimeout(r, 2500))]);
  if (!disposed) { await prewarm(); await warmDraw(); }
  await Y();
}
const dbg = { apply, scene, camera, renderer, doors: DOOR_LEAVES, setTimeOfDay, hd, LIGHT, ENTRY_P,
  tick, prewarm, warmDraw, shadowDirty: () => shadowDirty,   // checking: one frame as the loop draws it, the warm-ups, the shadow flag
  getEstate: () => estate, estateFrom: () => estateFrom, bakeExterior, bakeRoots,
  goto: P => lenis.scrollTo(PtoS(P) * maxScroll(), { immediate: true }),   // jump the real page to walk state P (for checking)
  // preview a camera at walk state P (for authoring the tour)
  view(pos, tgt, fov, P) { apply(P); camera.position.set(...pos); camera.lookAt(...tgt); camera.fov = fov || 62; camera.near = 0.05; camera.updateProjectionMatrix(); renderer.render(scene, camera); },
  // is the straight line a->b free of walls, doors and furniture at walk state P? returns the first thing hit
  clear(a, b, P = 0.75) {
    apply(P); scene.updateMatrixWorld(true);
    const A = V(...a), B = V(...b), d = B.clone().sub(A), L = d.length(), rc = new THREE.Raycaster(A, d.normalize(), 0, L); rc.camera = camera;
    rc.camera = camera;
    const cands = []; scene.traverseVisible(o => { if (o.isMesh && !o.isLineSegments2 && o !== sky && !(estate && isIn(o, estate.root)) && !(walkedLOD && isIn(o, walkedLOD))) cands.push(o); });
    const hits = rc.intersectObjects(cands, false).filter(h => !(h.object.material && h.object.material.transparent && h.object.material.opacity < 0.05));
    return hits.length ? { clear: false, at: +hits[0].distance.toFixed(2), point: hits[0].point.toArray().map(v => +v.toFixed(2)), what: hits[0].object.name || hits[0].object.geometry.type } : { clear: true };
  },
  path: () => PATH_UP.map(k => ({ p: +k.p.toFixed(4), pos: k.pos.toArray(), tgt: k.tgt.toArray(), fov: k.fov, cap: k.cap })),
};
if (!LIB) window.__walk = dbg;
function isIn(o, root) { for (let q = o; q; q = q.parent) if (q === root) return true; return false; }
if (!LIB) return dbg;

// ---------- embedded API (the estate hero) ----------
// activate: the shared renderer takes this walk's settings; tick(t): one frame (scroll, apply, draw);
// setProgress(P): jump; dispose(): frees everything this walk put on the GPU (the pack's geometry stays).
function activate() {
  if (renderer.getPixelRatio() !== walkDPR) renderer.setPixelRatio(walkDPR);   // only on a change (it reallocates the buffer)
  renderer.localClippingEnabled = true; renderer.shadowMap.autoUpdate = false;
  resize(); progress = -1; needRender = true; shadowDirty = true; lastDraw = 0;
}
function dispose() {
  if (disposed) return;
  disposed = true; ac.abort(); lenis.destroy();
  const geos = new Set(), mats = new Set(), texs = new Set();
  scene.traverse(o => {
    if (o.geometry && !o.geometry.userData.pk) geos.add(o.geometry);
    for (const m of [].concat(o.material || [])) mats.add(m);
    if (o.isLight && o.dispose) o.dispose();   // shadow maps
  });
  for (const m of mats) {
    if (m.userData.keepTex) continue;   // a copy of the hero's material: its maps are the hero's
    for (const k in m) { const v = m[k]; if (v && v.isTexture) texs.add(v); }
    if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u && u.value && u.value.isTexture) texs.add(u.value);
  }
  for (const g of geos) g.dispose();
  for (const m of mats) m.dispose();
  for (const t of texs) t.dispose();
  hd.dispose(); roomRT.dispose(); roomScene.dispose(); pmrem.dispose(); if (emptyRT) emptyRT.dispose();
  if (composer) { for (const ps of composer.passes) if (ps.dispose) ps.dispose(); composer.dispose(); }
  scene.clear();
}
return {
  home: HOME, scene, camera, ready: true,
  tick, resize, activate,
  setProgress(P) { lenis.scrollTo(PtoS(P) * maxScroll(), { immediate: true }); progress = -1; needRender = true; },
  progress: () => progress,
  redraw() { needRender = true; },
  dispose, debug: dbg,
};
}
if (AUTO) mountWalk();
