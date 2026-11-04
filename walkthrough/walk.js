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
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildEstate } from './estate.js?v=8';

const texCache = new Map();   // procedural textures, made once and shared (see cachedTex)
const COL = {
  paper: 0xF2E9DF, ink: 0x2E2825, wall: 0xF7F3EC, plaster: 0xF3EEE5,   // cream white, as in the street render
  slab: 0xF3EEE5, glass: 0xC9DADB, road: 0xE7DDCF, green: 0xD9E0C6, terra: 0xB17664,
};
const MOBILE = matchMedia('(max-width: 760px)').matches;
const COARSE = matchMedia('(pointer: coarse)').matches;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (p, a, b) => clamp((p - a) / (b - a));
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const sine = t => 0.5 - 0.5 * Math.cos(Math.PI * t);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Levels (m): ground floor finish = 0, porch + garden 0.30 below,
// first floor 3.70 above (from sections A-A / B-B of the amended plans).
// GF ceiling = underside of the 1F slab (sections A-A, B-B: 3500).
// Which home: ?home=bungalow switches the whole walkthrough to the bungalow's own drawings.
const HOME = new URLSearchParams(location.search).get('home') === 'bungalow' ? 'bungalow' : 'semid';
const SEMID = HOME === 'semid';
const BAKE = new URLSearchParams(location.search).has('bake');   // hidden helper page: builds this house and hands its exterior to the estate

const $ = id => document.getElementById(id);
const loader = $('loader');
// The switch and the page text follow the chosen home.
document.querySelectorAll('.hometoggle a').forEach(a => a.classList.toggle('on', a.dataset.home === HOME));
if (!SEMID) {
  document.title = 'Bungalow Walkthrough · Panthera Bertam';
  const q = s => document.querySelector(s);
  q('.intro .eyebrow').textContent = 'Bungalow · ground floor · after amendment';
  q('.intro p').textContent = 'This is the approved bungalow drawing, built in 3D. Scroll and the walls go up. Keep going and you walk in through the front door.';
  const tb = document.querySelectorAll('.titleblock > div');
  tb[1].innerHTML = '<span class="k">Drawing</span>Bungalow · ground floor';
  tb[2].innerHTML = '<span><span class="k">House</span>46 × 28 ft</span><span><span class="k">Lot</span>5,308 sq ft</span>';
  q('.endcard p').textContent = "Bungalow, 2,642 sq ft built-up, 5 bedrooms and 5 bathrooms, freehold. Registration is open while we're in pre-launch.";
  $('scene').setAttribute('aria-label', '3D model of the Panthera Bertam bungalow, built from the approved plans');
}

function fail(msg) {
  loader.classList.add('fail');
  loader.innerHTML = `<span>${msg} <a href="../">Back to Panthera Bertam</a></span>`;
}

let D, X, FIT = [], FURN = [], CARS = [], buildCar = null, ESTATE = null, OTHER = null, CAR_SPOTS = { semid: [], bungalow: [] }, TOUR = null, PARAPETS = null, SD_LIGHTS = [], makeFurniture = null, SD_FURN = [];
// Everything loads at once (index.html also preloads the data files while three.js downloads).
{
  const J = u => fetch(u).then(r => { if (!r.ok) throw new Error(u); return r.json(); });
  const opt = (pr, d) => pr.catch(() => d);
  const other = SEMID ? 'bungalow' : 'semid';
  let main, est, od, ox, carMod, sdCars, bgFurn, tour, para, sdl, furnMod, sdf;
  try {
    [main, FIT, bgFurn, sdCars, est, od, ox, carMod, , tour, para, sdl, furnMod, sdf] = await Promise.all([   // (the empty slot is the font load)
      Promise.all([J(`./${HOME}.json?v=4`), J(`./${HOME}_detail.json?v=4`)]),   // plans; verified windows/doors, roof, stair, balconies
      opt(J(`./${HOME}_fittings.json?v=4`), []),                                   // switches and sockets
      opt(J('./bungalow_furniture.json?v=2'), []),                                 // bungalow furniture (8 Apr 2026 layout, audited) and its cars
      opt(J('./semid_cars.json?v=1'), []),                                         // Semi-D: two cars per porch, as drawn
      opt(J('./estate.json?v=1'), null),                                           // the estate, for the road view and the bird's-eye
      opt(J(`./${other}.json?v=4`), null), opt(J(`./${other}_detail.json?v=4`), null),
      import('./car.js?v=2').catch(() => null),                                    // the detailed car (falls back to a simple one)
      document.fonts.load('500 40px "JetBrains Mono"').catch(() => null),
      BAKE ? null : opt(J(`./tour_${HOME}.json?v=1${/[?&]tourdev/.test(location.search) ? '&t=' + Date.now() : ''}`), null),   // the room-by-room tour
      opt(J('./parapets.json?v=1'), null),                                         // balcony half-wall grooves
      SEMID ? opt(J('./semid_lights.json?v=1'), []) : [],                          // E-01 lights, fans, wall lights, air-con
      import('./furniture.js?v=2').catch(() => null),                              // realistic furniture and sanitary ware
      SEMID ? opt(J('./semid_furniture.json?v=1'), []) : [],                       // Semi-D furniture, 8 Apr 2026 layout (audited)
    ]);
  } catch (e) { fail('Could not load the drawings.'); throw e; }
  [D, X] = main;
  if (tour && Array.isArray(tour.frames) && tour.frames.length > 1) TOUR = tour;
  PARAPETS = para; SD_LIGHTS = sdl || [];
  makeFurniture = furnMod && furnMod.makeFurniture || null; SD_FURN = sdf || [];
  FURN = SEMID ? [] : bgFurn; CARS = SEMID ? sdCars : [];
  CAR_SPOTS = { semid: sdCars, bungalow: bgFurn.filter(f => f.kind === 'car') };
  buildCar = carMod && carMod.buildCar || null;
  if (est && od && ox && !BAKE) { ESTATE = est; OTHER = { D: od, X: ox }; }
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
const canvas = $('scene');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) { fail('Your browser could not start 3D.'); throw e; }
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));   // as sharp as the screen allows; lowered automatically if a device can't keep up
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;       // Khronos PBR Neutral: true-to-material colour, soft highlight roll-off
renderer.toneMappingExposure = 1.05;
renderer.localClippingEnabled = true;
renderer.shadowMap.enabled = true;                  // soft sun and leaf shadows on every device
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const HIFI = !(MOBILE || COARSE);                        // desktop: ambient occlusion, MSAA, 4K shadow map
RectAreaLightUniformsLib.init();

const scene = new THREE.Scene();
scene.background = new THREE.Color(COL.paper);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.5;

const hemi = new THREE.HemisphereLight(0xfff4e4, 0xcbb8a2, 0.55); scene.add(hemi);
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

// ---------- materials ----------
const mWall = new THREE.MeshStandardMaterial({ color: COL.wall, roughness: 0.95 });
const mCap = new THREE.MeshBasicMaterial({ color: COL.ink });         // section poché on the cut
const mLight = new THREE.MeshStandardMaterial({ color: COL.wall, roughness: 0.95 });
const mSlab = new THREE.MeshStandardMaterial({ color: COL.slab, roughness: 0.95 });
const mGlass = new THREE.MeshStandardMaterial({ color: COL.glass, roughness: 0.14, metalness: 0.15, envMapIntensity: 1.6, transparent: true, opacity: 0.22, depthWrite: false });
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

// ---------- ground, street, green ----------
function paperTexture() {
  const s = 2048, c = document.createElement('canvas'); c.width = c.height = s;
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
const WALL_TOPS = (!SEMID && D.gf_wall_tops && D.gf_wall_tops.value) || [];
for (const r of D.gf.filter(inZone)) {
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

// ---- openings: the verified window and door schedule (semid_detail.json) ----
// Every exterior gap in the CAD walls is refilled: solid wall where the elevations
// show no opening, and frame, glass or timber leaves where they do.
const mFrame = new THREE.MeshStandardMaterial({ color: 0x4A4744, roughness: 0.45, metalness: 0.3 });   // grey powder-coated aluminium
const mTimber = new THREE.MeshStandardMaterial({ color: 0x6B4A33, roughness: 0.6 });                  // panelled timber doors
const mSteel = new THREE.MeshStandardMaterial({ color: 0x2B2927, roughness: 0.4, metalness: 0.5 });
const mRailBlack = new THREE.MeshStandardMaterial({ color: 0x18181A, roughness: 0.42, metalness: 0.35 });   // satin black powder-coat
const mOakRail = new THREE.MeshStandardMaterial({ color: 0xB98A5A, roughness: 0.45 });                    // oiled oak handrail
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
    for (const [a, b, y0, y1] of [[s.a0, sm0, s.sill, s.transom[0]], [sm1, s.a1, s.sill, s.transom[0]], [s.a0, s.a1, s.transom[1], s.head]]) {
      const g = block(R(a, b, 0.012), y0, y1 - y0, mGlass, parent, null); g.castShadow = false;
    }
    const pane = new THREE.Group(); parent.add(pane);
    const Rb = (a0, a1, d) => rectAlong(s.axis, a0, a1, mid - 0.035 - d / 2, mid - 0.035 + d / 2);   // its own track, just inside
    const g = block(Rb(sm0, sm1, 0.012), s.sill + 0.03, s.transom[0] - s.sill - 0.06, mGlass, pane, null); g.castShadow = false;
    for (const a of [sm0, sm1 - fw]) block(Rb(a, a + fw, 0.05), s.sill, s.transom[0] - s.sill, mFrame, pane, null);
    for (const y of [s.sill, s.transom[0] - 0.04]) block(Rb(sm0, sm1, 0.05), y, 0.04, mFrame, pane, null);
    pane.userData.dx = -(sm1 - sm0 - 0.02); slidingPanes.push(pane);
  }
  // Timber doors: a slim timber door frame (jambs + head) only, no mullion between the leaves and no sill bar.
  const timber = s.kind === 'timber', fm = timber ? mTimber : mFrame, jw = timber ? 0.04 : fw;
  block(R(s.a0, s.a0 + jw, fd), s.sill, s.head - s.sill, fm, parent, null);
  block(R(s.a1 - jw, s.a1, fd), s.sill, s.head - s.sill, fm, parent, null);
  block(R(s.a0, s.a1, fd), s.head - jw, jw, fm, parent, null);
  if (!timber) block(R(s.a0, s.a1, fd), s.sill, fw, mFrame, parent, null);
  if (s.transom) block(R(s.a0, s.a1, fd), s.transom[0], s.transom[1] - s.transom[0], fm, parent, null);
  if (!timber) for (const [m, y0, y1] of s.mull) if (!(slide && y0 < s.transom[0] && (m === sm0 || m === sm1))) block(R(m - fw / 2, m + fw / 2, fd), y0, y1 - y0, mFrame, parent, null);
  // Panelled timber leaves. The walked unit's front door (GF-F2) is hinged at its outer edges and
  // swings inward as drawn on the plan, opening as you reach it (see apply()).
  // The bungalow's balcony door (FF-F4, one timber leaf) opens the same way as you walk out to the balcony.
  const late = !SEMID && s.id === (X.balcony_door_id || 'FF-F4') && s.leaves.length === 1;
  const swing = late || (s.id === (SEMID ? 'GF-F2' : X.front_door_id) && s.leaves.length === 2), meet = s.leaves.length === 2 ? (s.leaves[0][1] + s.leaves[1][0]) / 2 : null;
  for (const [a0, a1, y0, y1] of s.leaves) {
    if (swing && s.axis === 'x') {
      const hinge = meet === null ? a0 : Math.abs(a0 - meet) > Math.abs(a1 - meet) ? a0 : a1, w = a1 - a0, sg = hinge === a0 ? 1 : -1;
      const pivot = new THREE.Group(); pivot.position.set(hinge, 0, mid); parent.add(pivot);
      block([sg > 0 ? 0 : -w, -0.025, sg > 0 ? w : 0, 0.025], y0, y1 - y0, mTimber, pivot, mInkSoft);
      for (const py of [0.55, 1.2, 1.85]) block([sg > 0 ? 0.08 : -w + 0.08, 0.024, sg > 0 ? w - 0.08 : -0.08, 0.034], y0 + py - 0.27, 0.54, mTimber, pivot, null);   // raised panels
      block([sg * (w - 0.1) - 0.012, -0.06, sg * (w - 0.1) + 0.012, 0.06], y0 + 0.95, 0.22, mSteel, pivot, null);                    // handle
      pivot.userData.sg = sg; pivot.userData.late = late; swingDoors.push(pivot);
      continue;
    }
    block(R(a0, a1, 0.05), y0, y1 - y0, mTimber, parent, mInkSoft);
    const hx = a1 - a0 > 0.6 ? (Math.abs(a0) < Math.abs(a1) ? a0 + 0.08 : a1 - 0.08) : a1 - 0.08;   // handle on the meeting edge
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
for (const o of dedupe(D.gf_open.filter(o => inZone(o.r) && Math.max(o.r[1], o.r[3]) < PORCH_DEPTH))) {
  const r = o.r, ax = wallAxis(r);
  if (ax) { refillGap(0, r, ax); continue; }
  const h = block(r, o.head, GF_TOP - o.head, mWall, house);            // interior door: lintel over the head
  h.userData.full = GF_TOP - o.head; setH(h, 0); gfHeads.push(h);
  if (o.win) gfWall(r, 0, o.sill, [mWall, mWall, mLight, mWall, mWall, mWall]);
}

for (const r of D.site.filter(inZone)) {
  const m = block(r, GROUND, 0.9, [mWall, mWall, mLight, mWall, mWall, mWall], house);
  m.userData.full = 1.5; siteWalls.push(m);
  m.userData.vent = Math.max(Math.abs(r[2] - r[0]), Math.abs(r[3] - r[1])) > 2.5;
}
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
      block(r, GROUND, 1.5, mWall, fence, null);
      if (L < 1.2) block(rectAlong(ax, a0, a1, c0 - 0.012, c1 + 0.012), GROUND + 1.12, 0.14, new THREE.MeshStandardMaterial({ color: 0x8A6A4C, roughness: 0.7 }), fence, null);
      continue;
    }
    block(rectAlong(ax, a0, a1, c0, c1), GROUND, 0.6, mWall, fence, null);                         // plinth
    block(rectAlong(ax, a0, a1, c0 - 0.025, c1 + 0.025), GROUND + 1.38, 0.12, mWall, fence, null);  // capping beam
    const n = Math.max(1, Math.ceil((L - 0.23) / 3.0)), step = (L - 0.23) / n;
    const piers = Array.from({ length: n + 1 }, (_, k) => a0 + 0.115 + k * step);
    for (const pc of piers) block(rectAlong(ax, pc - 0.115, pc + 0.115, c0 - 0.03, c1 + 0.03), GROUND, 1.55, mWall, fence, null);
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
  if (gs.length) { const m = new THREE.Mesh(mergeGeometries(gs), new THREE.MeshStandardMaterial({ color: 0xB3A898, roughness: 1 })); m.receiveShadow = true; ffDetail.add(m); }
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
function battens(list) {
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mWall, list.length), M4 = new THREE.Matrix4();
  list.forEach(([x, y0, z, , y1, , nx, nz], i) => {
    const side = nx !== 0, h = y1 - y0;
    M4.compose(V(x + nx * 0.008, (y0 + y1) / 2, z + nz * (side ? 0 : 0.006)), new THREE.Quaternion(), V(side ? 0.016 : 0.035, h, side ? 0.035 : 0.016));
    im.setMatrixAt(i, M4);
  });
  im.castShadow = im.receiveShadow = true; scene.add(im); return im;
}
const battenGF = battens(GRV.filter(g => g[1] < 3.5)), battenFF = battens(GRV.filter(g => g[1] >= 3.5));

// ---- finishing details: interior doors, skirting, exterior sills, switches and sockets ----
const mDoorHDF = new THREE.MeshStandardMaterial({ color: 0xEFEAE2, roughness: 0.6,
  map: canvasTex(256, (g, s) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, s, s); g.fillStyle = 'rgba(120,110,95,0.35)'; for (const y of [0.25, 0.5, 0.75]) g.fillRect(0, y * s - 1, s, 2); }) });   // HDF door, 3 groove lines
const mSkirting = new THREE.MeshStandardMaterial({ color: 0xF6F3EC, roughness: 0.6 });   // white skirting
const mDoorPlain = new THREE.MeshStandardMaterial({ color: 0xEFEAE2, roughness: 0.6 });   // frames, architraves, leaf edges
// Interior doors (tender: HDF 900 x 2100 rooms, 750 bathrooms): the leaf stands open 90 deg against the jamb,
// with a slim timber-look architrave both sides.
const DOOR_LEAVES = [];   // every open leaf, for checking that none clash
function interiorDoor(r, floorY, headY, parent) {
  const ax = Math.abs(r[2] - r[0]) > Math.abs(r[3] - r[1]) ? 'x' : 'z';
  const a0 = ax === 'x' ? Math.min(r[0], r[2]) : Math.min(r[1], r[3]), a1 = ax === 'x' ? Math.max(r[0], r[2]) : Math.max(r[1], r[3]);
  const c0 = ax === 'x' ? Math.min(r[1], r[3]) : Math.min(r[0], r[2]), c1 = ax === 'x' ? Math.max(r[1], r[3]) : Math.max(r[0], r[2]);
  const w = a1 - a0; if (w < 0.6 || w > 1.15) return;
  for (const c of [c0 - 0.012, c1]) {   // architraves on both faces
    block(rectAlong(ax, a0 - 0.06, a0, c, c + 0.012), floorY, headY - floorY + 0.06, mDoorPlain, parent, null);
    block(rectAlong(ax, a1, a1 + 0.06, c, c + 0.012), floorY, headY - floorY + 0.06, mDoorPlain, parent, null);
    block(rectAlong(ax, a0 - 0.06, a1 + 0.06, c, c + 0.012), headY, 0.06, mDoorPlain, parent, null);
  }
  // The leaf stands open 90 deg into the ROOM, never into a corridor, landing or open-plan space, hinged at the
  // end nearest a return wall so it sits back against it.
  const fl = floorY > 1 ? 1 : 0, walls = (fl ? D.ff : D.gf).filter(inZone);
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
  const hzA = ha + (ha < mid ? t : -0.05), hzC = sg > 0 ? cf + lw - 0.09 : cf - lw + 0.07;
  block(ax === 'x' ? [hzA, hzC, hzA + 0.05, hzC + 0.02] : [hzC, hzA, hzC + 0.02, hzA + 0.05], floorY + 1.0, 0.025, mSteel, parent, null);   // lever handle
}
const againstOuterWall = r => Math.min(r[1], r[3]) < HOUSE.z0 + 0.16 || Math.min(r[0], r[2]) < HOUSE.x0 + 0.16 || Math.max(r[0], r[2]) > HOUSE.x1 - 0.16;   // a lining strip, not a door
for (const o of dedupe(D.gf_open.filter(o => inZone(o.r) && Math.max(o.r[1], o.r[3]) < 0))) if (!wallAxis(o.r) && o.head < (SEMID ? 2.3 : 2.5) && !(o.sill > 0.3) && !againstOuterWall(o.r)) interiorDoor(o.r, 0, o.head, gfDetail);   // the bungalow's ground-floor doors are 2.4 m high
for (const o of dedupe(D.ff_open.filter(o => inZone(o.r) && Math.max(o.r[1], o.r[3]) < 0))) if (!wallAxis(o.r) && o.head < 2.3 && !(SEMID && Math.abs(o.r[2] - o.r[0]) > 2.0 && o.r[0] * o.r[2] < 0)) interiorDoor(o.r, FF_BASE, FF_BASE + o.head, ffDetail);
// 100 mm skirting (tender) on every wall inside the house, both floors.
{
  const inside = r => Math.min(r[1], r[3]) > HOUSE.z0 - 0.01 && Math.max(r[1], r[3]) < 0.01 && Math.min(r[0], r[2]) > HOUSE.x0 - 0.01 && Math.max(r[0], r[2]) < HOUSE.x1 + 0.01;
  for (const r of D.gf.filter(inZone).filter(inside)) block([Math.min(r[0], r[2]) - 0.008, Math.min(r[1], r[3]) - 0.008, Math.max(r[0], r[2]) + 0.008, Math.max(r[1], r[3]) + 0.008], 0, 0.1, mSkirting, gfDetail, null);
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
  for (const [x, z] of (X.roof.downpipes || []).filter(([, z]) => z < -0.5)) {   // none across the front (client)
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
  for (const g of X.roof.gutters || []) block(g.r, g.y0, g.y1 - g.y0, mPVC, extDetail, null);
}
if (SEMID) {
  const mPVC = new THREE.MeshStandardMaterial({ color: 0xEDE9E2, roughness: 0.5 });
  // Rainwater downpipes (roof plan, after amendment; the two outer rear-corner pipes were demolished).
  for (const [x, z, y0, y1] of [[-0.06, -13.303, -0.261, 7.167],   // the four across the front are left out (client)
    [0.06, -13.303, -0.261, 7.167],
    [1.711, -7.153, 7.15, 7.387], [1.771, -6.098, 7.15, 7.387], [7.173, -7.151, 3.65, 7.387], [7.209, -6.107, 3.65, 7.387]]) {
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

// ---- SPC flooring (stone-plastic composite, light brown wood look) on the stair and the whole first floor ----
function spcTexture() {   // 180 mm x 1220 mm planks, staggered, light oak tone with grain and soft bevels
  return canvasTex(1024, (g, s) => {
    const rows = 6, rowH = s / rows, plankL = s;              // texture = 1.22 m (x) by 1.08 m (y)
    for (let r = 0; r < rows; r++) {
      const off = ((r * 0.37) % 1) * plankL;
      for (let k = -1; k < 2; k++) {
        const x = k * plankL + off, v = (rnd() - 0.5) * 14;
        g.fillStyle = `rgb(${Math.round(196 + v)},${Math.round(160 + v * 0.8)},${Math.round(118 + v * 0.6)})`;
        g.fillRect(x, r * rowH, plankL, rowH);
        for (let i = 0; i < 22; i++) {                        // grain
          const y0 = r * rowH + rnd() * rowH, a = 0.04 + rnd() * 0.08;
          g.strokeStyle = `rgba(110,72,40,${a})`; g.lineWidth = 0.8 + rnd() * 1.6;
          g.beginPath(); for (let xx = 0; xx <= plankL; xx += 16) g.lineTo(x + xx, y0 + Math.sin((xx + i * 40) * 0.012) * 2.5); g.stroke();
        }
        g.fillStyle = 'rgba(70,46,26,0.45)'; g.fillRect(x, r * rowH, 2, rowH);   // end joint
      }
      g.fillStyle = 'rgba(70,46,26,0.5)'; g.fillRect(0, r * rowH, s, 2);       // long joint
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
      m.rotation.x = -Math.PI / 2; m.position.set((a + b) / 2, FF_BASE + 0.004, (z0 + z1) / 2); m.receiveShadow = true; ffDetail.add(m);
    }
  }
  // Bathrooms (both homes, both floors): porcelain floor tile and wall tile to 2.4 m, room extents found from the
  // plan label by casting along the walls; wall tile stops at door and window openings.
  const bathTile = tileTexture(), wallTileTex = cachedTex('walltile', () => canvasTex(512, (g, n) => {
    g.fillStyle = '#ece8e1'; g.fillRect(0, 0, n, n);
    blotches(g, n, 60, 10, 50, a => `rgba(${a > 0.5 ? '255,255,255' : '160,150,140'},${0.04 + a * 0.04})`);
    g.strokeStyle = 'rgba(150,142,132,0.9)'; g.lineWidth = 2; for (let i = 0; i <= 2; i++) { g.beginPath(); g.moveTo(0, i * n / 2); g.lineTo(n, i * n / 2); g.stroke(); }
    g.beginPath(); g.moveTo(0, 0); g.lineTo(0, n); g.stroke();
  }), 1);   // 300 x 600 wall tile, stack bond (one texture tile = 0.6 x 0.6 m)
  for (const fl of [0, 1]) {
    const walls = (fl ? D.ff : D.gf).filter(inZone), opens = (fl ? D.ff_open : D.gf_open).filter(o => inZone(o.r)), y0 = fl ? FF_BASE : 0;
    const solid = [...walls, ...opens.filter(o => o.r[0] * o.r[2] >= 0).map(o => o.r)];   // windows and doors close the room too (not beam lines across the party wall)
    const ray = (x, z, dx, dz) => { let best = 6; for (const q of solid) { const x0 = Math.min(q[0], q[2]), x1 = Math.max(q[0], q[2]), z0 = Math.min(q[1], q[3]), z1 = Math.max(q[1], q[3]);
      if (dx) { if (z < z0 || z > z1) continue; const d = dx > 0 ? x0 - x : x - x1; if (d > -0.01 && d < best) best = Math.max(d, 0); }
      else { if (x < x0 || x > x1) continue; const d = dz > 0 ? z0 - z : z - z1; if (d > -0.01 && d < best) best = Math.max(d, 0); } } return best; };
    const inWall = (x, z) => solid.some(q => x > Math.min(q[0], q[2]) - 0.01 && x < Math.max(q[0], q[2]) + 0.01 && z > Math.min(q[1], q[3]) - 0.01 && z < Math.max(q[1], q[3]) + 0.01);
    const done = new Set();
    for (const l of D.labels.filter(l => (l.floor || 0) === fl && /BILIK AIR|BEDAK/.test(l.t) && (SEMID ? l.x < 0 : true))) {
      // A label that sits on a wall line is nudged into the smallest room beside it (one not already tiled).
      const probes = inWall(l.x, l.z) ? [[0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]].map(([dx, dz]) => [l.x + dx, l.z + dz]).filter(([x, z]) => !inWall(x, z)) : [[l.x, l.z]];
      const boxes = probes.map(([x, z]) => [x - ray(x, z, -1, 0), z - ray(x, z, 0, -1), x + ray(x, z, 1, 0), z + ray(x, z, 0, 1)])
        .filter(b => !done.has(b.map(v => v.toFixed(2)).join()) && b[2] - b[0] >= 0.8 && b[3] - b[1] >= 0.8)
        .sort((u, v) => (u[2] - u[0]) * (u[3] - u[1]) - (v[2] - v[0]) * (v[3] - v[1]));
      if (!boxes.length) continue;
      const [x0, z0, x1, z1] = boxes[0];
      if (x1 - x0 > 5 || z1 - z0 > 5 || x1 - x0 < 0.8 || z1 - z0 < 0.8) continue;   // not a closed room
      done.add(boxes[0].map(v => v.toFixed(2)).join());
      const t = bathTile.clone(); t.needsUpdate = true; t.repeat.set((x1 - x0) / 1.2, (z1 - z0) / 2.4);
      const fm = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 }));
      fm.rotation.x = -Math.PI / 2; fm.position.set((x0 + x1) / 2, y0 + 0.007, (z0 + z1) / 2); fm.receiveShadow = true; (fl ? ffDetail : gfDetail).add(fm);
      // wall tile on the four sides, cut at openings in those walls
      for (const [ax, c, a0, a1, nx, nz] of [['x', z0, x0, x1, 0, 1], ['x', z1, x0, x1, 0, -1], ['z', x0, z0, z1, 1, 0], ['z', x1, z0, z1, -1, 0]]) {
        const cuts = opens.filter(o => ax === 'x' ? Math.abs((o.r[1] + o.r[3]) / 2 - c) < 0.2 && Math.max(o.r[0], o.r[2]) > a0 && Math.min(o.r[0], o.r[2]) < a1
                                                 : Math.abs((o.r[0] + o.r[2]) / 2 - c) < 0.2 && Math.max(o.r[1], o.r[3]) > a0 && Math.min(o.r[1], o.r[3]) < a1)
          .map(o => ax === 'x' ? [Math.min(o.r[0], o.r[2]), Math.max(o.r[0], o.r[2]), o.sill || 0] : [Math.min(o.r[1], o.r[3]), Math.max(o.r[1], o.r[3]), o.sill || 0]).sort((u, v) => u[0] - v[0]);
        const segs = []; let cur = a0;
        for (const [u, v, sill] of cuts) { if (u > cur + 0.05) segs.push([cur, u, 2.4]); if (sill > 0.3) segs.push([Math.max(cur, u), Math.min(v, a1), Math.min(sill, 2.4)]); cur = Math.max(cur, v); }
        if (a1 > cur + 0.05) segs.push([cur, a1, 2.4]);
        for (const [u, v, h] of segs) {
          const tt = wallTileTex.clone(); tt.needsUpdate = true; tt.repeat.set((v - u) / 0.6, h / 0.6);
          const m = new THREE.Mesh(new THREE.PlaneGeometry(v - u, h), new THREE.MeshStandardMaterial({ map: tt, roughness: 0.35 }));
          if (ax === 'x') m.position.set((u + v) / 2, y0 + h / 2, c + nz * 0.004); else { m.position.set(c + nx * 0.004, y0 + h / 2, (u + v) / 2); }
          m.rotation.y = Math.atan2(nx, nz); m.receiveShadow = true; (fl ? ffDetail : gfDetail).add(m);
        }
      }
    }
  }
}

// ---- the stair: concrete, 21 risers of 176 mm, quarter landing at +2.816, finished in SPC (mirrored for the right unit) ----
const stairTex = spcTexture(); stairTex.repeat.set(0.8, 0.25);
const mStairTop = new THREE.MeshStandardMaterial({ map: stairTex, roughness: 0.55 });
const mStairSide = new THREE.MeshStandardMaterial({ color: 0xCDA67C, roughness: 0.6 });
const mStair = [mStairSide, mStairSide, mStairTop, mStairSide, mStairSide, mStairSide];   // treads in SPC, sides plain
for (const sgn of SEMID ? [1, -1] : [1]) {
  for (const st of X.stair.steps) {
    const r = [sgn * st.r[0], st.r[1], sgn * st.r[2], st.r[3]];
    const solid = SEMID ? st.flight === 1 : !!st.solid;
    if (solid) gfWall(r, 0, st.top, mStair, mInk);                                 // solid to the floor (enclosed below)
    else gfWall(r, st.top - (st.flight === 'landing' ? 0.15 : 0.2), st.flight === 'landing' ? 0.15 : 0.2, mStair, mInk);
  }
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
        if (onWall(x, z)) continue;
        const y0 = support(x, z, y); if (y - y0 < 0.3) continue;
        const g = new THREE.BoxGeometry(0.02, y - 0.03 - y0, 0.02); g.translate(sgn * x, (y - 0.03 + y0) / 2, z); bal.push(g);
      }
    }
  }
  if (bal.length) { const m = new THREE.Mesh(mergeGeometries(bal), mRailBlack); m.castShadow = true; gfDetail.add(m); }
  // Balustrade walls on the well side of the flights. Where an under-stair wall already stands they are left out;
  // over a doorway they start at its head.
  if (!SEMID) for (const w of X.stair.inner_walls || []) {
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
      if (head !== null && v > Math.max(cur, u) + 0.01) profWall(w.r, ax, w.prof, Math.max(cur, u), v, head, gfDetail);
      cur = Math.max(cur, v);
    }
    if (A1 > cur + 0.01) profWall(w.r, ax, w.prof, cur, A1, w.y0 || 0, gfDetail);
  }
}

// Downstand beam across the dining room (underside +3.20, section B-B), under the 1F bedroom wall above it.
if (SEMID) for (const s of [1, -1]) {
  const r = s > 0 ? [2.239, -6.615, 6.57, -6.465] : [-6.57, -6.615, -2.239, -6.465];
  const b = block(r, 3.20, GF_TOP - 3.20, mWall, house); b.userData.full = GF_TOP - 3.20; setH(b, 0); gfHeads.push(b);
}

// ---- the roof (amended): left unit hipped with gablets, right unit twin cross ridges; cement tile ----
function roofTileTexture() {
  const s = 2048, c = document.createElement('canvas'); c.width = c.height = s;
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
  for (let k = 0; k < 48000; k++) { g.fillStyle = `rgba(60,30,18,${Math.random() * 0.12})`; g.fillRect(Math.random() * s, Math.random() * s, 2, 2); }   // weathering
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
const mTile = new THREE.MeshStandardMaterial({ map: tileTex, bumpMap: tileTex, bumpScale: 3.5, roughness: 0.8, side: THREE.FrontSide });
const mCapTile = new THREE.MeshStandardMaterial({ color: 0xA9573A, roughness: 0.75 });
// Timber louvre vents for the gablet / gable triangles.
const louvreTex = canvasTex(256, (g, s) => {
  g.fillStyle = '#8a6648'; g.fillRect(0, 0, s, s);
  for (let y = 0; y < s; y += 16) { const gr = g.createLinearGradient(0, y, 0, y + 16); gr.addColorStop(0, '#a77d58'); gr.addColorStop(0.7, '#7b5a3e'); gr.addColorStop(1, '#3d2a1c'); g.fillStyle = gr; g.fillRect(0, y, s, 16); }
}, { repeat: 1 });
const mLouvre = new THREE.MeshStandardMaterial({ map: louvreTex, roughness: 0.7, side: THREE.DoubleSide });
const mSoffit = new THREE.MeshStandardMaterial({ color: 0xEDE6DA, roughness: 0.95, side: THREE.BackSide });
const mFascia = new THREE.MeshStandardMaterial({ color: 0x8A6A4C, roughness: 0.7 });                    // woodgrain fascia board
const mPlasterDS = new THREE.MeshStandardMaterial({ color: COL.wall, roughness: 0.95, side: THREE.DoubleSide });
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
      else if (polys.length >= 2 && sloped) isCap = true;                                      // verge against a gable face
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
  for (const tk of SEMID ? [{ c: [-0.95, -9.16], d: 1.19, y0: 7.15 }] : (X.roof.tanks || [])) {
    const r = tk.d / 2, h = tk.h || 1.05;
    const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 36), new THREE.MeshStandardMaterial({ color: COL.plaster, roughness: 0.6 }));
    t.position.set(tk.c[0], tk.y0 + h / 2, tk.c[1]); t.castShadow = true; roof.add(t);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.08, 24), t.material); lid.position.set(tk.c[0], tk.y0 + h + 0.04, tk.c[1]); roof.add(lid);
  }
  for (const f of X.roof.fascia) block(f.r, f.y0, f.y1 - f.y0, mFascia, roof, mInkSoft);
  // Eave soffits: 100 mm tongue-and-groove timber boards running along the eave, each board its own tone with
  // grain and staggered end joints, a dark shadow groove between boards, and a slim trim against the wall.
  const soffitTex = cachedTex('soffit', () => canvasTex(1024, (g, n) => {   // one tile = 1.2 m along x 1.2 m across (12 boards)
    const bw = n / 12;
    for (let i = 0; i < 12; i++) {
      let x = 0; const y0 = i * bw;
      while (x < n) {
        const len = n * (0.35 + rnd() * 0.5), v = (rnd() - 0.5) * 26;
        g.fillStyle = `rgb(${176 + v},${126 + v * 0.8},${84 + v * 0.6})`; g.fillRect(x, y0, len, bw);
        for (let k = 0; k < 14; k++) {   // grain streaks along the board
          const gy = y0 + 3 + rnd() * (bw - 6), a = 0.05 + rnd() * 0.12;
          g.strokeStyle = `rgba(${90 + rnd() * 30},${55 + rnd() * 20},30,${a})`; g.lineWidth = 0.8 + rnd() * 1.6;
          g.beginPath(); g.moveTo(x, gy); for (let t = 0; t <= len; t += 24) g.lineTo(x + t, gy + Math.sin((t + i * 37) * 0.02) * 1.6); g.stroke();
        }
        g.fillStyle = 'rgba(60,38,22,0.55)'; g.fillRect(x + len - 1.5, y0, 2, bw);   // end joint
        x += len;
      }
      g.fillStyle = 'rgba(48,30,18,0.85)'; g.fillRect(0, y0, n, 5);                 // shadow groove
      g.fillStyle = 'rgba(255,235,205,0.18)'; g.fillRect(0, y0 + 5, n, 2);           // lit tongue edge
    }
  }), 1);
  for (const s of X.roof.soffits) {
    const lx = Math.abs(s.r[2] - s.r[0]), lz = Math.abs(s.r[3] - s.r[1]), alongX = lx >= lz;
    const t = soffitTex.clone(); t.needsUpdate = true; t.center.set(0.5, 0.5);
    if (alongX) t.repeat.set(lx / 1.2, lz / 1.2); else { t.rotation = Math.PI / 2; t.repeat.set(lz / 1.2, lx / 1.2); }
    const m = new THREE.MeshStandardMaterial({ map: t, bumpMap: t, bumpScale: 1.2, roughness: 0.62, color: 0xFFFFFF });
    block(s.r, s.y - 0.02, 0.02, m, roof, null);
  }
}

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
function tileTexture() {
  return canvasTex(1024, (g, s) => {
    const n = 4, step = s / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const v = Math.round((rnd() - 0.5) * 8);
      g.fillStyle = `rgb(${206 + v},${199 + v},${189 + v})`; g.fillRect(i * step, j * step, step, step);
    }
    blotches(g, s, 260, 10, 70, a => `rgba(${a > 0.5 ? '255,250,240' : '120,110,98'},${0.05 + a * 0.05})`);
    for (let k = 0; k < 9000; k++) { g.fillStyle = `rgba(90,82,74,${rnd() * 0.08})`; g.fillRect(rnd() * s, rnd() * s, 1.5, 1.5); }
    g.strokeStyle = 'rgba(150,140,128,0.9)'; g.lineWidth = 2.2;
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
    g.fillStyle = '#f2ece6'; g.fillRect(0, 0, s, s);
    blotches(g, s, 420, 20, 90, a => `rgba(${a > 0.5 ? '255,255,255' : '150,120,100'},${0.05 + a * 0.08})`);
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
const floorTex = tileTexture();
const lw = FINISH.x1 - FINISH.x0, ld = FINISH.z1 - FINISH.z0;
floorTex.repeat.set(lw / 2.4, ld / 2.4);
const realFloor = new THREE.Mesh(new THREE.PlaneGeometry(lw, ld),
  new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.55, clippingPlanes: [sweepPlane] }));   // matt porcelain: soft sheen only
realFloor.rotation.x = -Math.PI / 2; realFloor.position.set((FINISH.x0 + FINISH.x1) / 2, 0.004, (FINISH.z0 + FINISH.z1) / 2);
realFloor.receiveShadow = true; scene.add(realFloor);
// The rest of the ground floor (bedrooms, kitchens, bathrooms) in the same porcelain, laid once the sweep is done.
const gfFloorTex = floorTex.clone(); gfFloorTex.needsUpdate = true; gfFloorTex.repeat.set((HOUSE.x1 - HOUSE.x0) / 2.4, (HOUSE.z1 - HOUSE.z0) / 2.4);
const gfFloor = new THREE.Mesh(new THREE.PlaneGeometry(HOUSE.x1 - HOUSE.x0, HOUSE.z1 - HOUSE.z0), new THREE.MeshStandardMaterial({ map: gfFloorTex, roughness: 0.55 }));
gfFloor.rotation.x = -Math.PI / 2; gfFloor.position.set((HOUSE.x0 + HOUSE.x1) / 2, 0.003, (HOUSE.z0 + HOUSE.z1) / 2); gfFloor.receiveShadow = true; gfFloor.visible = false; scene.add(gfFloor);
const sweepLine = new LineSegments2(new LineSegmentsGeometry().setPositions([FINISH.x0, 0.012, 0, FINISH.x1, 0.012, 0]),
  new LineMaterial({ color: COL.terra, linewidth: 2.2, transparent: true, opacity: 0 }));
lineMats.push(sweepLine.material); scene.add(sweepLine);

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
  if (!SEMID && !BUNG_PIECE) return new THREE.Group();
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
// Palette: warm minimal with a tropical touch, keyed to the brand's cream and terracotta.
const BOUCLE = 0xDDD2C2, OATMEAL = 0xE8DFD1, RUST = 0xA85C3B, OLIVE = 0x7B7D55, LEATHER = 0x9A5E3A,
  JUTE = 0xC7B190, TRAVERTINE = 0xDCCDB4, OAK = 0xC09A6E, WALNUT = 0x5E412F, CHARCOAL = 0x3A3430,
  BLACK = 0x1E1C1B, STEEL = 0xCFCCC6, SAGE = 0x8E9A82, QUARTZ = 0xEFEBE5, CLAY = 0xC08C70, POT = 0xB06A4C, LEAF = 0x5C6E40;
const W = { map: TEX.wood }, FAB = { bump: TEX.weave, bumpScale: 1.4, rough: 0.95 };

// Clay limewash feature wall behind the TV (front wall, inside face).
box(-6.566, -0.176, -3.11, -0.151, 0, GF_TOP - 0.01, CLAY, 0.002, { map: TEX.lime, rough: 0.97, zf: -0.15, keep: true });

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
// Two black dome pendants over the table.
const pendants = [];
for (const x of SEMID ? [-5.35, -4.40] : []) {
  piece(x, -5.637, 0.012, 0.012, 2.55, GF_TOP - 2.55, BLACK, 0, { round: true, noLine: true, zf: -5.0 });
  piece(x, -5.637, 0.46, 0.46, 2.32, 0.24, BLACK, 0, { round: true, rTop: 0.06, rough: 0.45, metal: 0.3, zf: -5.0 });
  const bulb = new THREE.Mesh(new THREE.CircleGeometry(0.16, 32), new THREE.MeshBasicMaterial({ color: 0xFFE7C2, transparent: true, opacity: 0 }));
  bulb.rotation.x = Math.PI / 2; bulb.position.set(x, 2.33, -5.637); scene.add(bulb); pendants.push(bulb);
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
// ---- Furniture and sanitary ware: the audited lists (8 Apr 2026 layouts, sized against the CAD rooms and standard
// sizes), built by furniture.js: real toilets, basins with taps, vanities, showers, kitchen cabinets, sofas, beds...
const furnGF = new THREE.Group(), furnFF = new THREE.Group(), furnPlan = new THREE.Group(); scene.add(furnGF, furnFF, furnPlan);
if (NEWFURN) {
  const list = (SEMID ? SD_FURN : FURN).filter(f => f.kind !== 'car');
  const fctx = { tex: { wood: TEX.wood, weave: TEX.weave, stone: TEX.stone }, envMap: scene.environment };
  const rect = f => f.x0 != null ? [Math.min(f.x0, f.x1), Math.min(f.z0, f.z1), Math.max(f.x0, f.x1), Math.max(f.z0, f.z1)] : [f.cx - f.w / 2, f.cz - f.d / 2, f.cx + f.w / 2, f.cz + f.d / 2];
  const inside = (q, r) => { const [a, b, c, d] = rect(q), cx = (a + c) / 2, cz = (b + d) / 2; return cx > r[0] && cx < r[2] && cz > r[1] && cz < r[3]; };
  const MAP = { stool: ['chair', { stool: true }], armchair: ['chair', { armchair: true }], island: ['counter', {}] };
  const planSegs = [];
  for (const f of list) {
    let [kind, extra] = MAP[f.kind] || [f.kind, {}];
    const spec = { ...f, ...extra };
    if (spec.seat_h != null && spec.seatH == null) spec.seatH = spec.seat_h;
    if (!spec.back && !spec.head && !spec.front && f.x0 != null) {   // no orientation given: back onto the nearest wall
      const fr = rect(f), cxm = (fr[0] + fr[2]) / 2, czm = (fr[1] + fr[3]) / 2, walls = (f.floor ? D.ff : D.gf).filter(inZone);
      let best = null;
      for (const [side, dx, dz, edge] of [['-x', -1, 0, fr[0]], ['+x', 1, 0, fr[2]], ['-z', 0, -1, fr[1]], ['+z', 0, 1, fr[3]]]) {
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
    const r = rect(f), base = f.y0 ?? (f.floor ? FF_BASE : 0), parent = f.floor ? furnFF : furnGF;
    if (kind === 'counter') spec.cutouts = list.filter(q => (q.kind === 'sink' || q.kind === 'hob') && inside(q, r)).map(rect);
    let g = null;
    try { g = makeFurniture(THREE, kind, spec, fctx); } catch (e) { console.warn('furniture', f.kind, e); }
    if (!g) {   // the few kinds the module doesn't make: upholstered bench / ottoman, potted plant
      g = new THREE.Group();
      const w = r[2] - r[0], d = r[3] - r[1], h = f.h || 0.45;
      if (f.kind === 'oven') {   // tall sage oven tower: built-in oven and a microwave in black glass, brass pulls
        const H = Math.max(f.h || 0, 2.1), cab = new THREE.MeshStandardMaterial({ color: SAGE, roughness: 0.5 });
        const body = new THREE.Mesh(new RoundedBoxGeometry(w, H, d, 2, 0.004), cab); body.position.y = H / 2; g.add(body);
        const facing = f.back === '-x' ? [1, 0] : f.back === '+x' ? [-1, 0] : f.back === '+z' ? [0, -1] : [0, 1];
        const glass = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.12, metalness: 0.5 }), steel = new THREE.MeshStandardMaterial({ color: 0xBEBDB8, roughness: 0.3, metalness: 0.9 });
        for (const [y0, hh] of [[0.78, 0.6], [1.44, 0.38]]) {
          const fw = (facing[0] ? d : w) - 0.06, door = new THREE.Mesh(new THREE.BoxGeometry(facing[0] ? 0.02 : fw, hh, facing[0] ? fw : 0.02), glass);
          door.position.set(facing[0] * (w / 2 + 0.005), y0 + hh / 2, facing[1] * (d / 2 + 0.005)); g.add(door);
          const bar = new THREE.Mesh(new THREE.BoxGeometry(facing[0] ? 0.02 : fw * 0.8, 0.02, facing[0] ? fw * 0.8 : 0.02), steel);
          bar.position.set(facing[0] * (w / 2 + 0.03), y0 + hh - 0.05, facing[1] * (d / 2 + 0.03)); g.add(bar);
        }
      } else if (f.kind === 'plant') {
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(Math.min(w, d) * 0.32, Math.min(w, d) * 0.26, 0.36, 24), new THREE.MeshStandardMaterial({ color: POT, roughness: 0.8 }));
        pot.position.y = 0.18; g.add(pot);
        const pl = new THREE.Mesh(plantGeometry(Math.max(0.6, h - 0.36), 30, 0.26, 1 + Math.abs(Math.round(r[0] * 13)) % 97), new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.6 }));
        pl.position.y = 0.36; g.add(pl);
      } else {
        const round = f.kind === 'ottoman';
        const geo = round ? new THREE.CylinderGeometry(w / 2, w / 2, h, 40) : new RoundedBoxGeometry(w, h, d, 3, 0.04);
        const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: f.kind === 'bench' ? LEATHER : CLAY, roughness: 0.6, bumpMap: TEX.weave, bumpScale: 1.2 }));
        m.position.y = h / 2; g.add(m);
      }
      g.position.set((r[0] + r[2]) / 2, base, (r[1] + r[3]) / 2);
    }
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    parent.add(g);
    if (!f.floor) { const y = 0.02; planSegs.push(r[0], y, r[1], r[2], y, r[1], r[2], y, r[1], r[2], y, r[3], r[2], y, r[3], r[0], y, r[3], r[0], y, r[3], r[0], y, r[1]); }
  }
  // the furniture as drawn on the plan sheet (ink outlines) until the house turns real
  if (planSegs.length) furnPlan.add(new LineSegments2(new LineSegmentsGeometry().setPositions(planSegs), mInkFurn));
  // Kitchens: wall cabinets over every counter run on a wall (not across windows or over the hob) and a chimney hood
  // over each hob, up to that room's ceiling.
  const mCab = new THREE.MeshStandardMaterial({ color: SAGE, roughness: 0.5 }), mCabIn = new THREE.MeshStandardMaterial({ color: 0xF2EBDD, roughness: 0.45 });
  const mSteelHood = new THREE.MeshStandardMaterial({ color: 0xD9D8D4, roughness: 0.28, metalness: 0.85 }), mHandle = new THREE.MeshStandardMaterial({ color: 0xB89463, roughness: 0.32, metalness: 0.8 });
  for (const f of list.filter(q => q.kind === 'counter' && q.back)) {
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
    const blocked = [...opens.map(([u, v]) => [u - 0.05, v + 0.05]), ...hobs.map(h => [h - 0.46, h + 0.46])].sort((u, v) => u[0] - v[0]);
    const runs = []; let cur = a0;
    for (const [u, v] of blocked) { const e = Math.min(u, a1); if (e > cur + 0.3) runs.push([cur, e]); cur = Math.max(cur, v); }
    if (a1 > cur + 0.3) runs.push([cur, a1]);
    const u0 = base + (f.h || 0.9) + 0.55, u1 = Math.min(ceil - 0.05, u0 + 0.75), dep = 0.35;
    for (const [ra, rb] of runs) {
      const n = Math.max(1, Math.round((rb - ra) / 0.6)), mw = (rb - ra) / n;
      const cc = wallC + out * dep / 2;
      const carc = new THREE.Mesh(new THREE.BoxGeometry(ax === 'x' ? rb - ra : dep - 0.02, u1 - u0, ax === 'x' ? dep - 0.02 : rb - ra), mCab);
      carc.position.set(ax === 'x' ? (ra + rb) / 2 : cc - out * 0.01, (u0 + u1) / 2, ax === 'x' ? cc - out * 0.01 : (ra + rb) / 2); parent.add(carc);
      const under = new THREE.Mesh(new THREE.BoxGeometry(ax === 'x' ? rb - ra - 0.03 : dep - 0.04, 0.004, ax === 'x' ? dep - 0.04 : rb - ra - 0.03), mCabIn);
      under.position.set(carc.position.x, u0 - 0.002, carc.position.z); parent.add(under);
      for (let i = 0; i < n; i++) {   // doors with 3 mm seams and a slim brass pull at the bottom
        const ca = ra + i * mw + 0.0015, cb = ca + mw - 0.003, fc = wallC + out * (dep - 0.009);
        const door = new THREE.Mesh(new RoundedBoxGeometry(ax === 'x' ? cb - ca : 0.018, u1 - u0 - 0.004, ax === 'x' ? 0.018 : cb - ca, 2, 0.003), mCab);
        door.position.set(ax === 'x' ? (ca + cb) / 2 : fc, (u0 + u1) / 2, ax === 'x' ? fc : (ca + cb) / 2); door.castShadow = true; parent.add(door);
        const hx = i % 2 ? ca + 0.04 : cb - 0.04;
        const pull = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.14, 10), mHandle);
        pull.position.set(ax === 'x' ? hx : fc + out * 0.022, u0 + 0.1, ax === 'x' ? fc + out * 0.022 : hx); parent.add(pull);
      }
    }
    for (const hc of hobs) {   // chimney hood: angled stainless canopy at 0.65 m over the hob, chimney to the ceiling
      const y0 = base + (f.h || 0.9) + 0.65, cw = 0.9, cd = 0.5;
      const sh = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(cd, 0), new THREE.Vector2(cd, 0.06), new THREE.Vector2(0.18, 0.32), new THREE.Vector2(0, 0.32)]);
      const cg = new THREE.ExtrudeGeometry(sh, { depth: cw, bevelEnabled: false }); cg.translate(0, 0, -cw / 2);
      const canopy = new THREE.Mesh(cg, mSteelHood); canopy.castShadow = true;
      const rotY = f.back === '-x' ? 0 : f.back === '+x' ? Math.PI : f.back === '-z' ? -Math.PI / 2 : Math.PI / 2;
      const hg = new THREE.Group(); hg.position.set(ax === 'x' ? hc : wallC, y0, ax === 'x' ? wallC : hc); hg.rotation.y = rotY; hg.add(canopy);
      const chim = new THREE.Mesh(new THREE.BoxGeometry(0.17, Math.max(0.1, ceil - (y0 + 0.32)), 0.28), mSteelHood);
      chim.position.set(0.09, 0.32 + (ceil - (y0 + 0.32)) / 2, 0); hg.add(chim);
      const filt = new THREE.Mesh(new THREE.BoxGeometry(cd - 0.06, 0.004, cw - 0.06), new THREE.MeshStandardMaterial({ color: 0x55534F, roughness: 0.5, metalness: 0.6 }));
      filt.position.set(cd / 2, -0.001, 0); hg.add(filt);
      const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.03, 16), new THREE.MeshBasicMaterial({ color: 0xFFE6C0 })); lamp.rotation.x = Math.PI / 2; lamp.position.set(cd * 0.6, -0.003, 0.2); hg.add(lamp);
      parent.add(hg);
    }
  }
}
for (const c of CARS) {
  const hit = OPEN_LEAVES.some(r => c.x0 < r[2] && c.x1 > r[0] && c.z0 < r[3] && c.z1 > r[1]);
  if (!hit) car(c.x0, c.z0, c.x1, c.z1, GROUND, undefined, c.front);
}
if (!SEMID) {
  BUNG_PIECE = true;
  const C = { counter: SAGE, sink: STEEL, hob: BLACK, fridge: STEEL, chair: CHARCOAL, table: OAK, tv_console: OAK, tv_stand: BLACK, tv: BLACK, rug: JUTE,
    round: TRAVERTINE, sofa: BOUCLE, bed: OAK, panel: BOUCLE, bedside: WALNUT, lamp: 0xF5EEE3, wc: PORC, basin: PORC, bath: PORC, wardrobe: OAK, tank: 0x8E989C };
  for (const f of FURN) {
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

// Sheer linen curtains on ripple-fold tracks, drawn to the sides of the big glass doors.
const mSheer = new THREE.MeshPhysicalMaterial({ color: 0xF4EFE7, roughness: 0.95, sheen: 1, sheenRoughness: 0.7, sheenColor: 0xFFFFFF,
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

// Light fittings at the electrician's points (E-01 LGT/SSO/1, Mar 2026, verified): flush ceiling lights,
// the living-room ceiling fan, the stair wall light, the porch and patio lights. Left unit, as walked.
const downs = [], outdoorGlow = [];
const mHousing = new THREE.MeshStandardMaterial({ color: 0xF4F1EC, roughness: 0.5 });
// Lights ON: each fitting's lens glows warm white with a soft halo on the ceiling around it; the real light comes
// from a small pool of warm point lights that sit in the fittings nearest the camera (see apply()).
const fixtures = [];
const haloTex = canvasTex(128, (g, n) => { const gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); gr.addColorStop(0, 'rgba(255,226,180,0.85)'); gr.addColorStop(0.35, 'rgba(255,214,160,0.28)'); gr.addColorStop(1, 'rgba(255,210,150,0)'); g.fillStyle = gr; g.fillRect(0, 0, n, n); }, { repeat: 1 });
haloTex.wrapS = haloTex.wrapT = THREE.ClampToEdgeWrapping;
function ceilingLight(x, z, y, outdoor = false, parent = y > 5 ? fixFF : fixGF) {
  const h = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.035, 36), mHousing); h.position.set(x, y - 0.0175, z); parent.add(h);
  const d = new THREE.Mesh(new THREE.CircleGeometry(0.15, 36), new THREE.MeshBasicMaterial({ color: 0xFFF2DE, transparent: true, opacity: 0 }));
  d.rotation.x = Math.PI / 2; d.position.set(x, y - 0.036, z); parent.add(d); (outdoor ? outdoorGlow : downs).push(d);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: haloTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.rotation.x = Math.PI / 2; halo.position.set(x, y - 0.006, z); parent.add(halo); (outdoor ? outdoorGlow : downs).push(halo);
  if (!outdoor) fixtures.push(V(x, y - 0.25, z));
}
const LIGHT_POOL = Array.from({ length: MOBILE || COARSE ? 4 : 6 }, () => { const l = new THREE.PointLight(0xFFD2A0, 0, 6.5, 2); l.castShadow = false; scene.add(l); return l; });
// Nearest wall face to a drawn point (for wall lights and air-con units): the point on that face and its outward normal.
function wallFace(x, z, fl) {
  let best = null;
  for (const q of (fl ? D.ff : D.gf).filter(inZone)) {
    const x0 = Math.min(q[0], q[2]), x1 = Math.max(q[0], q[2]), z0 = Math.min(q[1], q[3]), z1 = Math.max(q[1], q[3]);
    for (const [fx, fz, nx, nz] of [[x0, clamp(z, z0, z1), -1, 0], [x1, clamp(z, z0, z1), 1, 0], [clamp(x, x0, x1), z0, 0, -1], [clamp(x, x0, x1), z1, 0, 1]]) {
      if ((x - fx) * nx + (z - fz) * nz < -0.02) continue;   // the point must be on that face's side
      const d = Math.hypot(x - fx, z - fz); if (!best || d < best.d) best = { d, x: fx, z: fz, nx, nz };
    }
  }
  return best;
}
// Wall light at a WLP point: dark up/down cylinder with a warm glow both ends.
function wallLight(x, z, y, fl, outdoor) {
  const f = wallFace(x, z, fl); if (!f || f.d > 0.8) return;
  const parent = fl ? fixFF : fixGF, ry = Math.atan2(f.nx, f.nz);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.22, 20), new THREE.MeshStandardMaterial({ color: 0x2B2725, roughness: 0.45, metalness: 0.4 }));
  body.position.set(f.x + f.nx * 0.07, y, f.z + f.nz * 0.07); parent.add(body);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.02), body.material); plate.position.set(f.x + f.nx * 0.01, y, f.z + f.nz * 0.01); plate.rotation.y = ry; parent.add(plate);
  for (const dy of [0.12, -0.12]) {
    const g = new THREE.Mesh(new THREE.CircleGeometry(0.04, 20), new THREE.MeshBasicMaterial({ color: 0xFFE3B8, transparent: true, opacity: 0 }));
    g.rotation.x = dy > 0 ? -Math.PI / 2 : Math.PI / 2; g.position.set(body.position.x, y + dy * 0.93, body.position.z); parent.add(g); (outdoor ? outdoorGlow : downs).push(g);
  }
  if (!outdoor) fixtures.push(V(body.position.x, y, body.position.z));
}
// Wall-mounted split air-conditioner indoor unit at an AC point: 0.80 x 0.28 x 0.20, white, louvre slot underneath.
const mAC = new THREE.MeshStandardMaterial({ color: 0xF4F3EF, roughness: 0.35 }), mACslot = new THREE.MeshStandardMaterial({ color: 0x3A3836, roughness: 0.6 });
function acUnit(x, z, y, fl) {
  const f = wallFace(x, z, fl); if (!f || f.d > 1.0) return;
  const g = new THREE.Group(); g.position.set(f.x + f.nx * 0.105, y, f.z + f.nz * 0.105); g.rotation.y = Math.atan2(f.nx, f.nz); (fl ? fixFF : fixGF).add(g);
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.80, 0.28, 0.20, 3, 0.04), mAC); body.castShadow = true; g.add(body);
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.035, 0.08), mACslot); slot.position.set(0, -0.125, 0.06); g.add(slot);
  const flap = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.012, 0.07), mAC); flap.position.set(0, -0.145, 0.085); flap.rotation.x = -0.35; g.add(flap);
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.008, 0.004), new THREE.MeshBasicMaterial({ color: 0x9FD7FF })); led.position.set(0.28, -0.07, 0.101); g.add(led);
}
// Ceiling fans at the fan points: 52-inch, three oak blades, matte black motor.
const fans = [];
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
const ffLights = [];
if (SEMID) {
  // Semi-D: every lighting point, fan, wall light and air-con point of drawing E-01 (verified), at its room's ceiling.
  for (const f of SD_LIGHTS) {
    if (f.k === 'light') { const n = downs.length; ceilingLight(f.x, f.z, f.y, f.out); if (f.floor) ffLights.push(downs[n]); }
    else if (f.k === 'fan') makeFan(f.x, f.z, f.floor ? 7.20 : GF_TOP, !!f.floor);
    else if (f.k === 'wall_light') wallLight(f.x, f.z, f.y + (f.floor ? FF_BASE : 0), f.floor, f.out);
    else if (f.k === 'ac') acUnit(f.x, f.z, f.y, f.floor);
  }
} else {
  // Bungalow: every ceiling light, fan and wall light at its E-02 point (verified), at that room's ceiling.
  const outside = f => /PORCH|PATIO|KERETA|BALKONI|LALUAN|HIJAU|GATE|PAGAR/i.test(f.room || '') || f.x < HOUSE.x0 - 0.05 || f.x > HOUSE.x1 + 0.05 || f.z > HOUSE.z1 + 0.05 || f.z < HOUSE.z0 - 0.05;
  for (const f of FIT) {
    if (f.k === 'light') ceilingLight(f.x, f.z, f.y, outside(f));
    else if (f.k === 'fan') makeFan(f.x, f.z, f.y, f.y > 5);
    else if (f.k === 'wall_light') wallLight(f.x, f.z, f.y, f.y > 3.6 ? 1 : 0, outside(f));
    else if (f.k === 'ac') acUnit(f.x, f.z, (f.y > 3.6 ? FF_BASE : 0) + 2.55, f.y > 3.6 ? 1 : 0);
  }
}

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
if (SEMID) roomLight.position.set(-3.3, 3.1, -2.4); else roomLight.position.set((FINISH.x0 + FINISH.x1) / 2, 2.9, (FINISH.z0 + FINISH.z1) / 2);
scene.add(roomLight);
const diningLight = new THREE.PointLight(0xFFD9A8, 0, 6, 1.8);              // warm 2700 K under the pendants
diningLight.position.set(-4.88, 2.2, -5.64); if (SEMID) scene.add(diningLight);
// Daylight through the patio doors: soft area lights in the glass, facing into the room.
const skyLights = [];
for (const [z, w] of SEMID ? [[-2.225, 2.95], [-5.942, 1.8]] : []) {
  const l = new THREE.RectAreaLight(0xEFF2F2, 0, w, 2.4);
  l.position.set(-6.60, 1.25, z); l.lookAt(0, 1.25, z); scene.add(l); skyLights.push(l);
}

// ---------- the real world fades in once the house stands: sky, lawn, paving, road ----------
const world = [];
let makeTree = null;
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
  const pr = SEMID ? [-6.87, 0.6, 6.87, LOT.z1] : X.porch.r;
  const pv = pavingTexture(4, '178,170,160'); pv.repeat.set((pr[2] - pr[0]) / 2.4, (pr[3] - pr[1]) / 2.4);
  worldPlane(pr, GROUND + 0.006, pv, 0.9, 1);                                               // car porch, imprinted concrete
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
    worldPlane(r, -0.15, pt, 0.85, 1);
  }
  const asphalt = asphaltTexture();
  asphalt.repeat.set(64 / 3, 12.2 / 3);
  const placeholders = [lawn];
  placeholders.push(worldPlane([-32, LOT.z1, 32, LOT.z1 + 12.2], GROUND + 0.006, asphalt, 0.95, 1));
  // Road detail: the drain cover in front of the gates (E-01: z 6.70..7.45, bars at 0.6 m), white lane lines.
  const grate = canvasTex(256, (c, s) => { c.fillStyle = '#9b958d'; c.fillRect(0, 0, s, s); c.fillStyle = '#4a4642'; for (let i = 0; i < 16; i++) c.fillRect(i * s / 16 + 3, 6, s / 32, s - 12); c.fillStyle = '#7d7871'; c.fillRect(0, 0, s, 6); c.fillRect(0, s - 6, s, 6); });
  grate.repeat.set(64 / 0.6, 1);
  placeholders.push(worldPlane([-32, LOT.z1 + 0.005, 32, LOT.z1 + 0.75], GROUND + 0.009, grate, 0.8, 2));
  const lineTex = canvasTex(64, (c, s) => { c.fillStyle = '#f2efe8'; c.fillRect(0, 0, s, s); });
  for (let x = -31; x < 31; x += 6) placeholders.push(worldPlane([x, LOT.z1 + 6.05, x + 3, LOT.z1 + 6.17], GROUND + 0.01, lineTex, 0.6, 2));   // centre line, 3 m dash / 3 m gap
  placeholders.push(worldPlane([-32, LOT.z1 + 0.95, 32, LOT.z1 + 1.05], GROUND + 0.01, lineTex, 0.6, 2));                                    // edge lines
  placeholders.push(worldPlane([-32, LOT.z1 + 11.15, 32, LOT.z1 + 11.25], GROUND + 0.01, lineTex, 0.6, 2));
  const g2 = grassTexture(); g2.repeat.set(64 / 2.5, 30 / 2.5);
  placeholders.push(worldPlane([-32, LOT.z1 + 12.2, 32, LOT.z1 + 42], GROUND + 0.006, g2, 1, 1));
  if (ESTATE) for (const m of placeholders) m.visible = false;   // the estate draws the real road, drains, plots and green
  // shade trees: on the green across the road, and beyond the side boundaries
  const trunkM = new THREE.MeshStandardMaterial({ color: 0x5B4A3C, roughness: 0.9, transparent: true, opacity: 0 });
  const crownM = new THREE.MeshStandardMaterial({ color: 0x5F7443, roughness: 0.9, transparent: true, opacity: 0 });
  world.push({ material: trunkM }, { material: crownM });
  const crownGeo = (s, seed) => {   // canopy of individual leaves scattered through an ellipsoid shell
    let q = seed * 7919; const r = () => ((q = (q * 16807) % 2147483647) / 2147483647);
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
// ---------- the estate around the walked home ----------
let estate = null;
// The same detailed car as in the walked porch, merged per material once, for every porch in the estate.
function carKit() {
  if (!buildCar) return null;
  try {
    const g = buildCar(THREE, { color: 0xFFFFFF, length: 4.55, width: 1.80, style: 'sedan', envMap: scene.environment, metallic: true });
    g.updateMatrixWorld(true);
    return bakeRoots([g]).map(pt => ({ ...pt, paint: !!(pt.material.isMeshPhysicalMaterial && pt.material.clearcoat > 0.5 && pt.material.color.getHex() === 0xFFFFFF) }));
  } catch (e) { console.warn('car kit', e); return null; }
}
// Built just after the first frame (it's only seen once the house is real), so the page opens sooner.
function buildEstateNow() {
  if (estate || !ESTATE) return;
  try {
  const estTex = {
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
  estate = buildEstate({ THREE, E: ESTATE, home: HOME, models: { [HOME]: { D, X }, [SEMID ? 'bungalow' : 'semid']: OTHER },
    mats: { wall: mWall, tile: mTile }, tex: estTex, polyGeometry, mergeGeometries, makeTree, carSpots: CAR_SPOTS, carKit: carKit() });
  scene.add(estate.root);
  sky.scale.setScalar(5);
  scene.fog = new THREE.Fog(0xF3E7D6, 260, 720);   // far ground fades into the sky's horizon colour   // a 600 m dome so the far side of the estate sits inside it (camera.far is 700 here)
  window.__estate = estate;
  } catch (e) { console.warn('estate', e); estate = null; }
  if (estate && progress >= 0) apply(progress);
  needRender = true;
}


// ---------- the house, baked for the estate ----------
// Every neighbouring home is the same full model as the one you walk through: its exterior (walls, windows and
// doors, roof, battens, balconies, downpipes, porch, planting) is merged per material into a handful of
// meshes, so all 19 homes stay as detailed as this one and still draw quickly.
function bakeExterior() {
  return bakeRoots([house, gfDetail, ffDetail, roof, extDetail, battenGF, battenFF], new Set(furn));   // cars are added by the estate; no boundary planting
}
function bakeRoots(roots, skip = new Set()) {
  const byMat = new Map();
  const add = (mat, g) => { if (!byMat.has(mat)) byMat.set(mat, []); byMat.get(mat).push(g); };
  const norm = (g, vc) => {
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', ...(vc ? ['color'] : [])].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    const n = g.attributes.position.count;
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
    if (vc && !g.attributes.color) g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3).fill(1), 3));
    g.groups = []; return g;
  };
  // A plain, non-indexed copy of a geometry (interleaved attributes de-interleaved), optionally one draw group.
  const flat = (geo, grp) => {
    const src = geo.index ? geo.toNonIndexed() : geo, out = new THREE.BufferGeometry();
    const s0 = grp ? grp.start : 0, cnt = grp ? Math.min(grp.count, src.attributes.position.count - s0) : src.attributes.position.count;
    for (const k of Object.keys(src.attributes)) {
      const a = src.attributes[k], arr = new Float32Array(cnt * a.itemSize);
      for (let i = 0; i < cnt; i++) for (let c = 0; c < a.itemSize; c++) arr[i * a.itemSize + c] = a.getComponent(s0 + i, c);
      out.setAttribute(k, new THREE.BufferAttribute(arr, a.itemSize));
    }
    return out;
  };
  scene.updateMatrixWorld(true);
  const visibleChain = o => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true; };
  for (const r of roots) r.traverse(o => {
    if (!o.isMesh || skip.has(o) || !visibleChain(o)) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.some(m => !m || m.isMeshBasicMaterial || m.isShaderMaterial || m.isLineMaterial || (m.transparent && m.opacity < 0.05))) return;
    const inst = o.isInstancedMesh ? o.count : 1, M = new THREE.Matrix4(), I = new THREE.Matrix4();
    for (let i = 0; i < inst; i++) {
      if (o.isInstancedMesh) { o.getMatrixAt(i, I); M.multiplyMatrices(o.matrixWorld, I); } else M.copy(o.matrixWorld);
      if (Array.isArray(o.material) && o.geometry.groups.length) {
        for (const grp of o.geometry.groups) {
          const m = o.material[grp.materialIndex]; if (!m) continue;
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
  const texOf = async t => t && t.image ? { bmp: await createImageBitmap(t.image), repeat: t.repeat.toArray(), offset: t.offset.toArray(), wrap: [t.wrapS, t.wrapT], cs: t.colorSpace, rot: t.rotation } : null;
  const out = [], transfer = [];
  for (const { material: m, geometry: g } of parts) {
    const mp = { type: m.type, color: m.color && m.color.getHex(), roughness: m.roughness, metalness: m.metalness, emissive: m.emissive && m.emissive.getHex(), emissiveIntensity: m.emissiveIntensity,
      transparent: m.transparent, opacity: m.opacity, side: m.side, alphaTest: m.alphaTest, depthWrite: m.depthWrite, envMapIntensity: m.envMapIntensity, vertexColors: m.vertexColors,
      bumpScale: m.bumpScale, clearcoat: m.clearcoat, clearcoatRoughness: m.clearcoatRoughness, sheen: m.sheen, sheenRoughness: m.sheenRoughness, sheenColor: m.sheenColor && m.sheenColor.getHex(),
      map: await texOf(m.map), bumpMap: await texOf(m.bumpMap), normalMap: await texOf(m.normalMap), roughnessMap: await texOf(m.roughnessMap), alphaMap: await texOf(m.alphaMap) };
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
    const g = new THREE.BufferGeometry(); for (const k of Object.keys(attrs)) g.setAttribute(k, new THREE.BufferAttribute(attrs[k][0], attrs[k][1]));
    return { material: m, geometry: g };
  });
}
// The walked type is baked right here; the other type comes from a hidden copy of this page (?bake=1).
let walkedLOD = null;
function bakeForEstate() {
  if (!estate) return;
  warming = true;
  apply(0.8);                                       // everything standing, finished and lit
  try {
    const parts = bakeExterior();
    estate.setHouses(HOME, parts);
    walkedLOD = new THREE.Group(); walkedLOD.visible = false; scene.add(walkedLOD);
    for (const { material, geometry } of parts) { const m = new THREE.Mesh(geometry, material); m.castShadow = !material.transparent; m.receiveShadow = true; walkedLOD.add(m); }
  } catch (e) { console.warn('bake', e); }
  apply(progress >= 0 ? progress : 0); warming = false; needRender = true;
  const other = SEMID ? 'bungalow' : 'semid';
  const fr = document.createElement('iframe');
  fr.setAttribute('aria-hidden', 'true'); fr.tabIndex = -1;
  fr.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none;border:0';
  addEventListener('message', function onMsg(ev) {
    if (ev.source !== fr.contentWindow || !ev.data || ev.data.type !== 'panthera-bake') return;
    removeEventListener('message', onMsg);
    try { estate.setHouses(other, unpackParts(ev.data.parts)); needRender = true; refreshSkipAO(); } catch (e) { console.warn('bake other', e); }
    setTimeout(() => fr.remove(), 0);
  });
  fr.src = `./index.html?home=${other}&bake=1`;
  document.body.appendChild(fr);
}

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
  const mid = fr.map(f => { acc += f.t || 1; return { p: TOUR_A + (TOUR_B - TOUR_A) * acc / tot, pos: V(...f.pos), tgt: V(...f.tgt), fov: f.fov || 62, cap: f.cap, photo: f.photo, door: f.door }; });
  const tail = PATH_UP.filter(k => k.p > TOUR_B + 1e-6);
  PATH_UP.length = 0; PATH_UP.push({ p: TOUR_A, pos: V(...TOUR.start.pos), tgt: V(...TOUR.start.tgt), fov: TOUR.start.fov || 62 }, ...mid, ...tail);
}
// Scroll position -> walk progress. With the room tour the rooms get more of the scroll.
const S_KNOTS = TOUR ? [[0, 0], [0.40, 0.62], [0.86, 0.87], [1, 1]] : [[0, 0], [1, 1]];
const pw = (k, x, a, b) => { for (let i = 1; i < k.length; i++) if (x <= k[i][a]) { const t = (x - k[i - 1][a]) / ((k[i][a] - k[i - 1][a]) || 1); return k[i - 1][b] + t * (k[i][b] - k[i - 1][b]); } return k[k.length - 1][b]; };
const StoP = s => pw(S_KNOTS, s, 0, 1), PtoS = p => pw(S_KNOTS, p, 1, 0);
if (TOUR) { const sp = document.querySelector('.spacer'); if (sp) sp.style.height = '3000vh'; }
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

// ---------- the scroll timeline ----------
const capEl = $('caption'), capNum = $('cap-num'), capText = $('cap-text');
// Captions, in whole-scroll units (the house part runs 0..0.62).
const ESTATE_CAPS = ESTATE ? [
  [0.895, 0.95, '10 · The street', 'Down on the street: a 40 ft estate road with its own drains and LED street lights on 9 m poles.'],
  [0.95, 0.975, '11 · The estate', '19 homes on a 1.96-acre lot: 16 Semi-Ds and 3 bungalows around a central green.'],
] : [];
const CAPS_BASE = !SEMID ? [
  [0.05, 0.223, '02 · Walls', 'The walls go up exactly where the plan puts them. The bungalow is 46 ft wide and 28 ft deep.'],
  [0.223, 0.36, '03 · The house', 'Two pitched roofs with a flat roof between them, over five bedrooms on a 5,308 sq ft corner lot.'],
  [0.36, 0.484, '04 · Porch', 'An open car porch for two cars, 491 sq ft, beside the entrance.'],
  [0.484, 0.570, '05 · Entrance hall', 'Through the double door into a double-height entrance hall, 279 sq ft.'],
  [0.570, 0.64, '06 · Living', 'The living room, 276 sq ft, opens through sliding glass doors to the garden.'],
  [0.65, 0.735, '07 · Up', 'Up through the double-height hall. The stair turns around an open well.'],
  [0.745, 0.835, '08 · Master bedroom', 'The master bedroom is 344 sq ft, with its own bathroom.'],
  [0.84, 0.90, '09 · Balcony', 'Out onto the front balcony, 159 sq ft, over the porch.'],
  ...ESTATE_CAPS,
] : [
  [0.05, 0.223, '02 · Walls', 'The walls go up exactly where the plan puts them. Each home is 22 ft wide and 43.5 ft deep.'],
  [0.223, 0.36, '03 · The pair', 'Two homes share one party wall. Each has its own gate, car porch and side patio.'],
  [0.36, 0.484, '04 · Porch', 'The car porch, 415 sq ft, under the first-floor balcony.'],
  [0.484, 0.570, '05 · Living', 'Through the front door. The living room is 321 sq ft, with 3.5 m (11 ft 6 in) to the ceiling.'],
  [0.570, 0.64, '06 · Patio', 'Sliding glass doors open the living room onto your own side patio, 293 sq ft.'],
  [0.65, 0.735, '07 · Stair', 'Up the stair, 176 mm risers. A glass rooflight brings daylight down the double-height void.'],
  [0.745, 0.835, '08 · Master bedroom', 'The master bedroom is 337 sq ft, with its own bathroom and dressing area.'],
  [0.84, 0.90, '09 · Balcony', 'Out onto the front balcony, 105 sq ft, over the car porch.'],
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
const PHOTOS_BASE = !SEMID ? [
  [0.08, 0.20, '../assets/floor-plan-p1.webp', 'Brochure · furnished ground floor plan'],
  [0.38, 0.47, '../assets/hero-3.webp', "Artist's impression · the bungalow"],
  [0.70, 0.79, '../assets/floor-plan-p2.webp', 'Brochure · first floor plan'],
  [0.91, 0.975, '../assets/hero-aerial-dusk.webp', "Artist's impression · the estate at dusk"],
] : [
  [0.08, 0.20, '../assets/floor-plan-p3.webp', 'Brochure · furnished ground floor plan'],
  [0.38, 0.47, '../assets/hero-2.webp', "Artist's impression · the street at golden hour"],
  [0.70, 0.79, '../assets/floor-plan-p4.webp', 'Brochure · first floor plan'],
  [0.91, 0.975, '../assets/hero-aerial-dusk.webp', "Artist's impression · the estate at dusk"],
];
const PHOTOS = (() => {
  if (!TOUR) return PHOTOS_BASE;
  const out = PHOTOS_BASE.filter(ph => ph[0] < 0.6 || ph[0] > 0.88);
  const ff = PHOTOS_BASE.find(ph => ph[0] >= 0.6 && ph[0] <= 0.88);
  const k = PATH_UP.find(q => q.photo === 'ffplan');
  if (ff && k) out.push([k.p - 0.012, k.p + 0.03, ff[2], ff[3]]);
  return out.sort((x, y) => x[0] - y[0]);
})();
const BALC_DOOR = (() => {   // the balcony door opens over the approach to the frame marked door: 'balcony'
  const i = PATH_UP.findIndex(k => k.door === 'balcony');
  return i > 0 ? [PATH_UP[i - 1].p, PATH_UP[i].p] : [0.80, 0.826];
})();
const SLIDE = (() => {   // the balcony slider opens over the walk up to the door: the two frames before the balcony frame
  if (typeof TOUR_B === 'undefined' || !TOUR) return [0.842, 0.864];
  const i = PATH_UP.findIndex(k => Math.abs(k.p - TOUR_B) < 1e-6);
  return i > 1 ? [PATH_UP[i - 2].p, PATH_UP[i - 1].p] : [0.842, 0.864];
})();
const photoEl = $('photo'), photoImg = $('photo-img'), photoCap = $('photo-cap'), lightbox = $('lightbox'), lightboxImg = $('lightbox-img');
let lastPhoto = -1;
$('photo-open').addEventListener('click', () => { lightboxImg.src = photoImg.src; lightbox.hidden = false; });
lightbox.addEventListener('click', () => { lightbox.hidden = true; });
addEventListener('keydown', e => { if (e.key === 'Escape') lightbox.hidden = true; });
let lastCap = -1;
const ink = new THREE.Color(COL.ink), wallC = new THREE.Color(COL.wall), plaster = new THREE.Color(COL.plaster);
const paperC = new THREE.Color(COL.paper), skyC = new THREE.Color(0xE9E4DA), floorC = new THREE.Color(0xD2CABE);
// Every ink line in the scene except the render grooves and the sweep line: hidden once fully faded.
const inkLines = [];
scene.traverse(o => { if (o.isLineSegments2 && (o.material === mInk || o.material === mInkSoft)) inkLines.push(o); });
const hudLens = $('h-lens'), hudEye = $('h-eye'), hudCut = $('h-cut');
const chapterBtns = [...document.querySelectorAll('#chapters button')];

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
  if (estate) estate.update(real, ease(seg(P, 0.9, 1.0)) * 0.7);
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
    dir.multiplyScalar(1 / L).lerp(V(-1, 0.78, 0.95).normalize(), wide).normalize();
    sun.position.copy(sun.target.position).add(dir.multiplyScalar(lerp(L, 160, wide)));
  }
  const half = lerp(24, 82, wide), cam = sun.shadow.camera;
  if (Math.abs(cam.right - half) > 0.01) { Object.assign(cam, { left: -half, right: half, top: half, bottom: -half, far: lerp(90, 360, wide) }); cam.updateProjectionMatrix(); }
  mWall.color.copy(wallC).lerp(plaster, ease(seg(p, 0.32, 0.5)));   // drawing-white -> the house's cream once it stands
  mPlasterDS.color.copy(mWall.color);                          // roof gables, strip faces and parapet: the same cream white
  mInkFurn.opacity = lerp(0.9, 0.08, sw);
  const inside = seg(p, 0.78, 0.9);
  // Inside: less flat fill, more sun, so the light through the glass and the leaf shadows read.
  roomLight.intensity = 3.5 * inside;
  diningLight.intensity = 5 * inside;
  const lightsOn = inside * (1 - seg(P, 0.875, 0.9));          // on inside, off again once you're out on the street
  for (const d of downs) d.material.opacity = lightsOn * (d.material.map ? 0.75 : 1);
  {
    const at = (P <= HOUSE_END ? pose(p) : along(PATH_UP, P)).pos;
    const near = fixtures.filter(f => Math.abs(f.y - at.y) < 3.2).sort((a, b) => a.distanceToSquared(at) - b.distanceToSquared(at));
    LIGHT_POOL.forEach((l, i) => { const f = near[i]; l.intensity = f ? 9 * lightsOn : 0; if (f) l.position.copy(f); });
  }
  for (const d of outdoorGlow) d.material.opacity = real * 0.9;   // porch, patio and gate lights on at golden hour
  gate.visible = real > 0.02;
  const doorOpen = ease(seg(p, 0.755, 0.80));                 // the front door swings open as you reach it
  for (const sp of slidingPanes) sp.position.x = sp.userData.dx * ease(seg(P, SLIDE[0], SLIDE[1]));   // slider opens onto the balcony
  for (const d of swingDoors) d.rotation.y = d.userData.sg * (d.userData.late ? ease(seg(P, BALC_DOOR[0], BALC_DOOR[1])) : doorOpen) * Math.PI * 0.5;
  for (const b of pendants) b.material.opacity = inside;
  for (const l of skyLights) l.intensity = 1.8 * inside;
  hemi.intensity = lerp(0.55, 0.3, inside);
  sun.intensity = lerp(2.3, 3.4, inside);
  scene.environmentIntensity = lerp(0.5, 0.45, inside);
  renderer.toneMappingExposure = lerp(1.0, 1.05, inside);

  // camera
  const c = P <= HOUSE_END ? pose(p) : along(PATH_UP, P);
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
  useFX = HIFI && real > 0.98;

  // overlays
  $('intro').classList.toggle('is-hidden', p > 0.05);
  $('titleblock').classList.toggle('is-hidden', p > 0.12);
  $('endcard').classList.toggle('show', P > 0.975);
  toggleEl && toggleEl.classList.toggle('dim', P > 0.06 && P < 0.975);
  let ci = CAPS.findIndex(([a, b]) => P >= a && P < b);
  if (ci !== lastCap) {
    lastCap = ci;
    capEl.classList.toggle('show', ci >= 0);
    if (ci >= 0) { capNum.textContent = CAPS[ci][2]; capText.textContent = CAPS[ci][3]; }
  }
  const pi = PHOTOS.findIndex(([a, b]) => P >= a && P < b);
  if (pi !== lastPhoto) {
    lastPhoto = pi;
    photoEl.classList.toggle('show', pi >= 0);
    if (pi >= 0) { photoImg.src = PHOTOS[pi][2]; photoImg.alt = PHOTOS[pi][3]; photoCap.textContent = PHOTOS[pi][3]; }
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
  hudCut.textContent = p < 0.08 ? '+1.20 m' : 'none';
  const chap = [0, 0.112, 0.248, 0.384, 0.496, 0.63, 0.88].reduce((acc, v, i) => (P >= v ? i : acc), 0);
  chapterBtns.forEach((b, i) => b.classList.toggle('on', i === chap));
}

// ---------- resize, scroll, loop ----------
// HD path (desktop, once the drawing has become a photograph): MSAA render target,
// ground-truth ambient occlusion for soft contact shadows, then tone mapping + sRGB.
let useFX = false, composer = null, gtao = null, grade = null, refreshSkipAO = () => {};
const skipAO = [];
if (HIFI) {
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
  // Cinematic finish: a soft bloom on lamps, lit windows and sun glints, then a filmic grade (warm highlights,
  // slightly cool shadows, gentle contrast and richness), a soft vignette and a whisper of film grain.
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.2, 0.45, 0.93);
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
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  for (const m of lineMats) m.resolution.set(w, h);
  if (composer) composer.setSize(w, h);
}
addEventListener('resize', resize);
resize();

const lenis = new Lenis({ smoothWheel: !REDUCED, lerp: 0.065 });   // a slower, dolly-like glide
const maxScroll = () => document.documentElement.scrollHeight - innerHeight;
if (TOUR) { const up = chapterBtns.find(b => /Upstairs/.test(b.textContent)); if (up) { up.textContent = '06 Rooms'; up.dataset.p = String(TOUR_A + 0.004); } }
chapterBtns.forEach(b => b.addEventListener('click', () => lenis.scrollTo(PtoS(parseFloat(b.dataset.p)) * maxScroll() + 1)));

const toggleEl = document.querySelector('.hometoggle');
let progress = -1, needRender = true;
addEventListener('resize', () => { needRender = true; });
function frame(t) {
  lenis.raf(t);
  const p = StoP(clamp(window.scrollY / Math.max(1, maxScroll())));
  if (Math.abs(p - progress) > 1e-5) { progress = p; apply(p); needRender = true; }
  const spin = progress > 0.44 && progress < 0.9 && !REDUCED && fans.length;   // fans turn slowly once you're near
  if (spin) { for (const f of fans) f.userData.rotor.rotation.y += 0.035; needRender = true; }
  if (needRender && !document.hidden && !warming) {   // draw only when something moved
    if (grade) grade.uniforms.seed.value = (grade.uniforms.seed.value + 0.137) % 10;
    if (useFX) composer.render(); else renderer.render(scene, camera); needRender = false;
    adapt(t);
  } else lastDraw = 0;
  requestAnimationFrame(frame);
}
// Adaptive sharpness: start at the screen's own resolution; if frames keep running slow while you scroll,
// step the render resolution down a little (never below 1x) so the walk stays smooth.
let lastDraw = 0, slow = 0, okFrames = 0;
function adapt(t) {
  if (lastDraw) {
    const dt = t - lastDraw;
    if (dt > 36) slow++; else if (dt < 22) okFrames++;
    if (slow > 20 && slow > okFrames * 0.5) {
      const pr = renderer.getPixelRatio();
      if (pr > 1.01) { const np = Math.max(1, pr - 0.25); renderer.setPixelRatio(np); if (composer) composer.setPixelRatio(np); resize(); }
      slow = okFrames = 0;
    }
    if (okFrames > 400) slow = okFrames = 0;
  }
  lastDraw = t;
}
// Compile every material once, in the background, so nothing hitches when it first appears mid-scroll.
let warming = false;
async function prewarm() {
  if (!renderer.compileAsync) return;
  const hidden = []; scene.traverse(o => { if (!o.visible) { hidden.push(o); o.visible = true; } });
  warming = true;
  try { await renderer.compileAsync(scene, camera); } catch (e) { /* compile on first use instead */ }
  hidden.forEach(o => { o.visible = false; }); warming = false; needRender = true;
  if (progress >= 0) apply(progress);
}
performance.mark('walk-built');
if (BAKE) {   // helper page: build, stand everything up, bake the exterior and hand it to the page that opened us
  apply(0.8);
  const { out, transfer } = await packParts(bakeExterior());
  parent.postMessage({ type: 'panthera-bake', home: HOME, parts: out }, location.origin, transfer);
} else {
  apply(0); progress = 0;
  renderer.render(scene, camera);
  performance.mark('walk-ready');
  loader.classList.add('done');
  requestAnimationFrame(frame);
  (window.requestIdleCallback || ((f) => setTimeout(f, 60)))(() => { buildEstateNow(); setTimeout(() => { bakeForEstate(); prewarm(); }, 50); }, { timeout: 1200 });
}
window.__walk = { apply, scene, camera, renderer, doors: DOOR_LEAVES,
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
function isIn(o, root) { for (let q = o; q; q = q.parent) if (q === root) return true; return false; }
