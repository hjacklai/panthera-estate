// furniture.js - procedural, realistic furniture and sanitary ware for the walkthrough.
//
//   import { makeFurniture } from './furniture.js';
//   const g = makeFurniture(THREE, 'wc', { x0, z0, x1, z1, y0, h, back: '+x' }, { tex: { wood, weave, stone } });
//   scene.add(g);
//
// Every piece is built in a local frame: x across the piece, y up from the floor (y0), z from the wall
// side (-D/2, the "back") to the room side (+D/2, the front). The group is then turned so the back faces
// the side named in the spec. Geometry is merged per material, so a piece is only a few draw calls.
// No logos, no text, no people.
//
// Fit contract (checked by furniture_test.html, runCheck): every vertex stays inside the x/z footprint for every kind
// and orientation, except desk with chair: true (the task chair is pulled out in front, like walk.js's desk()).
// Nothing goes below y0 except the wall-hung basin's bottle trap (0.2) and sink bowls (0.21). Parts that rise above
// y0 + h on purpose: wc open lid (0.08), basin / vanity / bath taps (0.16-0.18), sink gooseneck (0.39), gas hob pan
// supports (0.04 over a 0.01 h), shower head (2.21 when h is 0), bed headboard and pillows (h is the duvet top),
// bedside / desk lamps, counter upper cabinets, floor_trap grate (3 mm when h is 0). task_chair is a fixed 1.12 m.
// JSON keys honoured: basin rim (world rim height; else h 0.1-0.3 = rim above y0), chair seat_h, tv_stand h = puck
// plus neck up to the screen bottom.
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

let T = null;
const PI = Math.PI;

// Palette, keyed to walk.js. Japandi (owner, Nov 2026: "japandi style"): light oak and pale ash, oatmeal boucle and
// linen, greige wardrobes, slim satin-black metal, cane, paper shades, muted sage and charcoal accents.
// RUST / OLIVE / LEATHER / WALNUT / BRASS stay defined for explicit specs but are no longer defaults.
export const PALETTE = {
  BOUCLE: 0xE6DDCF, OATMEAL: 0xE3D9C8, RUST: 0xA85C3B, OLIVE: 0x7B7D55, LEATHER: 0x9A5E3A, JUTE: 0xC9BBA2,
  TRAVERTINE: 0xDDD2C0, OAK: 0xD4BC98, WALNUT: 0x5E412F, CHARCOAL: 0x4A4744, BLACK: 0x1E1C1B, SAGE: 0x9FA592,
  QUARTZ: 0xECE7DE, CLAY: 0xC08C70, PORC: 0xF7F6F2, DUVET: 0xF2EDE4, BRASS: 0xB89463,
  ASH: 0xDCC9AA, LINEN: 0xD3C8B6, SAND: 0xCBBBA0, PULL: 0x1F1E1D, CANE: 0xC6A77A, PAPER: 0xF3ECE0, WARDROBE: 0xE3DBCC,
};
const P = PALETTE;

// ---------------------------------------------------------------- geometry helpers
function clean(g) {
  if (g.index) g = g.toNonIndexed();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  g.morphAttributes = {}; g.clearGroups();
  return g;
}
// Box-projected UVs in metres (u, v = position / s); `vert` turns the grain to run up the piece.
function boxUV(g, s, vert = false) {
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); }
    else if (ax >= az) { u = p.getZ(i); v = p.getY(i); }
    else { u = p.getX(i); v = p.getY(i); }
    if (vert && !(ay >= ax && ay >= az)) [u, v] = [v, u];
    uv.setXY(i, u / s, v / s);
  }
  uv.needsUpdate = true;
}
// Cylindrical UVs (metres) for turned pieces centred on the local y axis: the sides wrap round (u = arc length),
// flat tops and bottoms are planar. Fixes the seam a box projection leaves on a drum. Expects non-indexed triangles.
function cylUV(g, s) {
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let t = 0; t < p.count; t += 3) {
    let rr = 0, flatTri = true;
    for (let k = 0; k < 3; k++) { const i = t + k; rr = Math.max(rr, Math.hypot(p.getX(i), p.getZ(i))); if (Math.abs(n.getY(i)) < 0.75) flatTri = false; }
    const us = [];
    for (let k = 0; k < 3; k++) {
      const i = t + k;
      if (flatTri) { uv.setXY(i, p.getX(i) / s, p.getZ(i) / s); continue; }
      us.push(Math.atan2(p.getZ(i), p.getX(i)) * rr);
    }
    if (flatTri) continue;
    const C = 2 * PI * rr, mx = Math.max(...us);
    for (let k = 0; k < 3; k++) { let u = us[k]; if (mx - u > C / 2) u += C; uv.setXY(t + k, u / s, p.getY(t + k) / s); }
  }
  uv.needsUpdate = true;
}
// Collects geometry per material and merges it into one mesh per material.
class Kit {
  constructor() { this.parts = new Map(); }
  add(mat, g, uv) {
    g = clean(g);
    if (uv && uv.cyl) cylUV(g, uv.s);
    else if (uv) boxUV(g, typeof uv === 'number' ? uv : uv.s, typeof uv === 'object' && uv.vert);
    let a = this.parts.get(mat); if (!a) this.parts.set(mat, a = []); a.push(g); return g;
  }
  into(group, xf) {
    for (const [mat, list] of this.parts) {
      const geo = mergeGeometries(list); if (!geo) continue;
      if (xf) geo.applyMatrix4(xf);
      geo.computeBoundingBox(); geo.computeBoundingSphere();
      const m = new T.Mesh(geo, mat);
      m.castShadow = !mat.transparent && !mat.userData.noShadow; m.receiveShadow = !mat.transparent;
      group.add(m);
    }
    return group;
  }
}
const clampR = (r, w, h, d) => Math.max(0.0005, Math.min(r, w / 2.02, h / 2.02, d / 2.02));
// Rounded box from min / max corners.
function rbox(x0, y0, z0, x1, y1, z1, r = 0.01, seg = 2) {
  const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0), d = Math.abs(z1 - z0);
  const g = r < 0.0015 ? new T.BoxGeometry(w, h, d) : new RoundedBoxGeometry(w, h, d, seg, clampR(r, w, h, d));
  return g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
}
const box = (x0, y0, z0, x1, y1, z1) => new T.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
// Vertical cylinder standing on y0.
function cyl(rTop, rBot, h, seg, x, y0, z, open = false) {
  return new T.CylinderGeometry(rTop, rBot, h, seg, 1, open).translate(x, y0 + h / 2, z);
}
// Cylinder from point a to point b.
function rod(a, b, r, seg = 10, r2 = r) {
  const A = new T.Vector3(...a), B = new T.Vector3(...b), L = A.distanceTo(B);
  const g = new T.CylinderGeometry(r2, r, L, seg, 1);
  const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  g.applyQuaternion(q); g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2); return g;
}
function tube(points, r, tub = 24, rad = 10) {
  const c = new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p)), false, 'centripetal');
  return new T.TubeGeometry(c, tub, r, rad, false);
}
const flat = g => { g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('normal'); g.computeVertexNormals(); return g; };
// Smooth normals across faces (for deformed rounded boxes).
function smooth(g) {
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g, 1e-5); g.computeVertexNormals(); return g;
}

// Superellipse ring: half width w, front half-length f (+z), back half-length b (-z), centre (x, z),
// exponent n on the front half and m on the back half (2 = ellipse, higher = squarer).
const R = (y, w, f, b, z, n = 2.4, m = n, x = 0) => ({ y, w, f, b, z, n, m, x });
const rs = (r, k, y = r.y) => ({ ...r, w: r.w * k, f: r.f * k, b: r.b * k, y });
const circ = (y, rad, x = 0, z = 0) => R(y, rad, rad, rad, z, 2, 2, x);
function spt(t, r) {
  const c = Math.cos(t), s = Math.sin(t), front = s >= 0, e = 2 / (front ? r.n : r.m);
  return [r.x + r.w * Math.sign(c) * Math.abs(c) ** e, r.z + (front ? r.f : r.b) * Math.sign(s) * Math.abs(s) ** e];
}
// Loft through rings (same parameterisation round each ring). Traverse the profile counter-clockwise in
// (radius, y) for an outward-facing surface: underside outward, walls up, tops inward, bowls down.
function loft(rings, seg = 48, close = false) {
  const nr = rings.length, pos = new Float32Array(nr * seg * 3), idx = [];
  for (let j = 0; j < nr; j++) for (let i = 0; i < seg; i++) {
    const [x, z] = spt(i / seg * 2 * PI, rings[j]); pos.set([x, rings[j].y, z], (j * seg + i) * 3);
  }
  for (let j = 0; j < (close ? nr : nr - 1); j++) {
    const j1 = (j + 1) % nr;
    for (let i = 0; i < seg; i++) {
      const i1 = (i + 1) % seg, a = j * seg + i, b = j * seg + i1, c = j1 * seg + i, d = j1 * seg + i1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setIndex(idx);
  g.computeVertexNormals(); return g;
}
// Lathe from [radius, y] pairs around (x, z).
const lathe = (pts, seg = 32, x = 0, z = 0) => loft(pts.map(([r, y]) => circ(y, r, x, z)), seg);
// Superellipse outline as a THREE.Path in shape space (x, -z), for countertop cut-outs.
function outlinePath(r, seg = 48, Cls = T.Path) {
  const p = new Cls();
  for (let i = 0; i <= seg; i++) { const [x, z] = spt(i / seg * 2 * PI, r); i ? p.lineTo(x, -z) : p.moveTo(x, -z); }
  return p;
}
function roundRectShape(x0, z0, x1, z1, rad, Cls = T.Shape) {
  const s = new Cls(), r = Math.min(rad, (x1 - x0) / 2, (z1 - z0) / 2);
  // shape space: (x, -z)
  const a = x0, b = x1, c = -z1, d = -z0;
  s.moveTo(a + r, c); s.lineTo(b - r, c); s.quadraticCurveTo(b, c, b, c + r); s.lineTo(b, d - r); s.quadraticCurveTo(b, d, b - r, d);
  s.lineTo(a + r, d); s.quadraticCurveTo(a, d, a, d - r); s.lineTo(a, c + r); s.quadraticCurveTo(a, c, a + r, c);
  return s;
}
// Horizontal slab (y0..y1) from a shape with holes, edges eased.
function slab(shape, y0, y1, bevel = 0.002) {
  // bevelOffset pulls the bevel back inside the outline, so the slab never grows past its shape (footprint fit)
  const g = new T.ExtrudeGeometry(shape, { depth: y1 - y0 - 2 * bevel, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: 1, curveSegments: 10 });
  g.rotateX(-PI / 2); g.translate(0, y0 + bevel, 0); return g;
}
// A cushion: rounded box with a crowned top and softly bulging sides.
function cushion(w, h, d, r, crown = 0.015, bulge = 0.008, seg = 3) {
  let g = new RoundedBoxGeometry(w, h, d, seg, clampR(r, w, h, d)); g = smooth(g);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const nx = Math.min(1, Math.abs(x) / (w / 2)), ny = Math.max(-1, Math.min(1, y / (h / 2))), nz = Math.min(1, Math.abs(z) / (d / 2));
    const cx = (1 - nx * nx), cz = (1 - nz * nz), sy = 1 - ny * ny;
    p.setY(i, y + crown * cx * cz * Math.max(0, ny));
    p.setX(i, x + Math.sign(x) * bulge * sy * Math.sqrt(cz));
    p.setZ(i, z + Math.sign(z) * bulge * sy * Math.sqrt(cx));
  }
  g.computeVertexNormals(); return g;
}
// A pillow / scatter cushion: thick in the middle, pinched to a seam at the edges.
function pillow(w, t, d, seg = 4) {
  let g = new RoundedBoxGeometry(w, t, d, seg, t * 0.45); g = smooth(g);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const nx = Math.min(1, Math.abs(p.getX(i)) / (w / 2)), nz = Math.min(1, Math.abs(p.getZ(i)) / (d / 2));
    const k = Math.pow(Math.max(0, (1 - nx ** 2.2) * (1 - nz ** 2.2)), 0.6) * 0.88 + 0.12;
    p.setY(i, p.getY(i) * k);
    // edges pull in between the corners, so the corners read as points
    p.setX(i, p.getX(i) * (1 - 0.09 * (1 - nz * nz))); p.setZ(i, p.getZ(i) * (1 - 0.09 * (1 - nx * nx)));
  }
  g.computeVertexNormals(); return g;
}
// Bend a geometry around a vertical axis in front of it (radius rad), so its ends come forward (+z).
function bend(g, rad) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), a = x / rad, rho = rad - z;
    p.setX(i, rho * Math.sin(a)); p.setZ(i, rad - rho * Math.cos(a));
  }
  g.computeVertexNormals(); return g;
}
// Grid surface from a function (u, v in 0..1) -> [x, y, z].
function surface(nu, nv, fn) {
  const pos = new Float32Array((nu + 1) * (nv + 1) * 3), idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) pos.set(fn(i / nu, j / nv), (j * (nu + 1) + i) * 3);
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, b, c, b, d, c);
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setIndex(idx);
  g.computeVertexNormals(); return g;
}
function faceUp(g) {   // make sure a draped surface faces up (flip winding if needed)
  const n = g.attributes.normal; let s = 0; for (let i = 0; i < n.count; i++) s += n.getY(i);
  if (s < 0) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } g.computeVertexNormals(); }
  return g;
}

// ---------------------------------------------------------------- textures (own, made once)
const TEXC = new Map();
function canvasTex(key, size, draw, srgb = true) {
  if (TEXC.has(key)) return TEXC.get(key);
  const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size);
  const t = new T.CanvasTexture(c); if (srgb) t.colorSpace = T.SRGBColorSpace;
  t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 8; TEXC.set(key, t); return t;
}
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function tileTex() {   // 100 mm matt porcelain mosaic, 4 x 4 per tile of texture (0.4 m)
  return canvasTex('tile', 512, (g, s) => {
    const n = 4, st = s / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const v = Math.round((rnd() - 0.5) * 10); g.fillStyle = `rgb(${196 + v},${192 + v},${186 + v})`; g.fillRect(i * st, j * st, st, st); }
    for (let k = 0; k < 6000; k++) { g.fillStyle = `rgba(90,85,80,${rnd() * 0.08})`; g.fillRect(rnd() * s, rnd() * s, 1.5, 1.5); }
    g.strokeStyle = 'rgba(160,154,146,0.5)'; g.lineWidth = 2;   // soft grout (owner, Nov 2026: grout lines not so obvious)
    for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * st, 0); g.lineTo(i * st, s); g.stroke(); g.beginPath(); g.moveTo(0, i * st); g.lineTo(s, i * st); g.stroke(); }
  });
}
function quartzTex() {   // engineered quartz: fine speckle and a few faint soft veins
  return canvasTex('quartz', 512, (g, s) => {
    g.fillStyle = '#f6f4f0'; g.fillRect(0, 0, s, s);
    for (let k = 0; k < 14000; k++) { const v = 150 + Math.round(rnd() * 80); g.fillStyle = `rgba(${v},${v - 4},${v - 10},${0.15 + rnd() * 0.25})`; g.fillRect(rnd() * s, rnd() * s, 1 + rnd(), 1 + rnd()); }
    g.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      g.strokeStyle = `rgba(170,165,158,${0.12 + rnd() * 0.1})`; g.lineWidth = 1 + rnd() * 2.5; g.beginPath();
      let x = rnd() * s, y = 0; g.moveTo(x, y); while (y < s) { y += 20 + rnd() * 30; x += (rnd() - 0.5) * 50; g.lineTo(x, y); } g.stroke();
    }
  });
}
function travTex() {   // vein-cut travertine: long soft parallel bands, a little cloud, small elongated pores (tiles in x and y)
  return canvasTex('trav', 512, (g, s) => {
    g.fillStyle = '#f2ece2'; g.fillRect(0, 0, s, s);
    // only broad, soft bands (thin ones read as wood grain), then the pits and voids that make it stone
    for (let i = 0; i < 16; i++) {
      const y = rnd() * s, h = 18 + rnd() * 70, light = rnd() > 0.5, a = light ? 0.1 + rnd() * 0.12 : 0.025 + rnd() * 0.035;
      const gr = g.createLinearGradient(0, y, 0, y + h), c = light ? '255,252,246' : `${176 + rnd() * 20},${154 + rnd() * 16},${124}`;
      gr.addColorStop(0, `rgba(${c},0)`); gr.addColorStop(0.5, `rgba(${c},${a})`); gr.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = gr; for (const o of [-s, 0, s]) { g.save(); g.translate(0, o); g.fillRect(0, y, s, h); g.restore(); }
    }
    for (let i = 0; i < 60; i++) {   // faint cloud
      const x = rnd() * s, y = rnd() * s, r = 14 + rnd() * 40, gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, rnd() > 0.5 ? 'rgba(255,253,248,0.12)' : `rgba(${180 + rnd() * 20},${158 + rnd() * 16},128,0.035)`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    for (let k = 0; k < 700; k++) {  // pits: small, mostly round, a few stretched along the bedding
      const x = rnd() * s, y = rnd() * s, r = 0.4 + rnd() * rnd() * 2.6, st = rnd() > 0.7 ? 1.5 + rnd() * 2 : 1 + rnd() * 0.4;
      g.fillStyle = `rgba(${140 + rnd() * 30},${120 + rnd() * 20},96,${0.12 + rnd() * 0.2})`;
      g.beginPath(); g.ellipse(x, y, r * st, r, 0, 0, 7); g.fill();
      if (r > 1.6) { g.fillStyle = 'rgba(255,255,250,0.35)'; g.beginPath(); g.ellipse(x, y + r * 0.5, r * st * 0.8, r * 0.35, 0, 0, 7); g.fill(); }   // lit lip
    }
  });
}
function rugTex() {   // chunky jute / wool basket weave
  return canvasTex('rug', 256, (g, s) => {
    g.fillStyle = '#d8cbb4'; g.fillRect(0, 0, s, s);
    const n = 16, st = s / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const hz = (i + j) % 2 === 0, x = i * st, y = j * st;
      for (let k = 0; k < 4; k++) {
        const v = 0.78 + rnd() * 0.22, c = `rgb(${Math.round(205 * v)},${Math.round(188 * v)},${Math.round(160 * v)})`;
        g.fillStyle = c;
        if (hz) g.fillRect(x + 0.5, y + k * st / 4 + 0.5, st - 1, st / 4 - 1.2); else g.fillRect(x + k * st / 4 + 0.5, y + 0.5, st / 4 - 1.2, st - 1);
      }
    }
    for (let k = 0; k < 2500; k++) { g.fillStyle = `rgba(90,70,50,${rnd() * 0.12})`; g.fillRect(rnd() * s, rnd() * s, 1, 2); }
  });
}
function brushedTex() {   // brushed stainless: fine horizontal streaks (colour map, near white)
  return canvasTex('brushed', 256, (g, s) => {
    g.fillStyle = '#e9e9e9'; g.fillRect(0, 0, s, s);
    for (let k = 0; k < 900; k++) { const v = 200 + Math.round(rnd() * 55); g.fillStyle = `rgba(${v},${v},${v},0.22)`; g.fillRect(0, rnd() * s, s, 0.6 + rnd()); }
  });
}
function oakTex() {   // fine, low-contrast straight grain with soft figure (near white, tinted by the material colour)
  return canvasTex('oak', 1024, (g, s) => {
    g.fillStyle = '#f3efe9'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 26; i++) { const y = rnd() * s, h = 8 + rnd() * 40; g.fillStyle = `rgba(${150 + rnd() * 40},${110 + rnd() * 30},70,${0.03 + rnd() * 0.05})`; g.fillRect(0, y, s, h); }
    for (let i = 0; i < 420; i++) {
      const y0 = rnd() * s, amp = 1 + rnd() * 4, f = 0.002 + rnd() * 0.006, a = 0.03 + rnd() * 0.08;
      g.strokeStyle = `rgba(${90 + rnd() * 50},${60 + rnd() * 30},35,${a})`; g.lineWidth = 0.5 + rnd() * 1.4;
      g.beginPath(); for (let x = 0; x <= s; x += 16) g.lineTo(x, y0 + Math.sin(x * f + i) * amp); g.stroke();
    }
    for (let k = 0; k < 1600; k++) { g.fillStyle = `rgba(90,60,35,${0.05 + rnd() * 0.08})`; g.fillRect(rnd() * s, rnd() * s, 2 + rnd() * 5, 0.8); }   // pores
  });
}
function caneTex() {   // woven cane (rattan) webbing: open octagon holes between diagonal strands, 8 x 8 cells
  return canvasTex('cane', 512, (g, s) => {
    g.fillStyle = '#d9c29a'; g.fillRect(0, 0, s, s);
    const n = 8, st = s / n;
    g.lineWidth = st * 0.18; g.strokeStyle = 'rgba(120,90,55,0.35)';
    for (let i = -n; i <= 2 * n; i++) {
      g.beginPath(); g.moveTo(i * st, 0); g.lineTo(i * st + s, s); g.stroke();
      g.beginPath(); g.moveTo(i * st, 0); g.lineTo(i * st - s, s); g.stroke();
    }
    g.fillStyle = 'rgba(60,45,30,0.85)';
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const cx = (i + 0.5) * st, cy = (j + 0.5) * st, r = st * 0.32;
      g.beginPath();
      for (let k = 0; k < 8; k++) { const a = (k + 0.5) / 8 * 2 * PI; g[k ? 'lineTo' : 'moveTo'](cx + r * Math.cos(a), cy + r * Math.sin(a)); }
      g.closePath(); g.fill();
    }
  });
}
function fallbackWood() {
  return canvasTex('wood', 512, (g, s) => {
    g.fillStyle = '#f4f1ec'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 140; i++) {
      const y0 = rnd() * s, amp = 2 + rnd() * 7, f = 0.004 + rnd() * 0.01, a = 0.05 + rnd() * 0.13;
      g.strokeStyle = `rgba(${70 + rnd() * 40},${45 + rnd() * 25},25,${a})`; g.lineWidth = 0.6 + rnd() * 2.2;
      g.beginPath(); for (let x = 0; x <= s; x += 8) g.lineTo(x, y0 + Math.sin(x * f + i) * amp); g.stroke();
    }
  });
}
function fallbackWeave() {
  return canvasTex('weave', 256, (g, s) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, s, s);
    for (let k = 0; k < 5000; k++) { const v = Math.round(rnd() * 255); g.fillStyle = `rgba(${v},${v},${v},0.55)`; g.beginPath(); g.arc(rnd() * s, rnd() * s, 0.8 + rnd() * 1.8, 0, 7); g.fill(); }
  }, false);
}
function fallbackStone() {
  return canvasTex('stone', 512, (g, s) => {
    g.fillStyle = '#f3ede3'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(${150 + rnd() * 40},${125 + rnd() * 30},95,${0.04 + rnd() * 0.06})`; g.fillRect(0, rnd() * s, s, 2 + rnd() * 10); }
    for (let k = 0; k < 400; k++) { g.fillStyle = `rgba(120,100,80,${0.15 + rnd() * 0.2})`; g.beginPath(); g.ellipse(rnd() * s, rnd() * s, 1 + rnd() * 4, 0.6 + rnd() * 1.2, 0, 0, 7); g.fill(); }
  });
}
const rep = t => { const c = t.clone(); c.needsUpdate = true; c.wrapS = c.wrapT = T.RepeatWrapping; c.repeat.set(1, 1); c.offset.set(0, 0); return c; };

// ---------------------------------------------------------------- materials (shared per ctx)
const MCACHE = new WeakMap();
class Mats {
  constructor(ctx) {
    this.ctx = ctx; this.c = new Map();
    const t = ctx.tex || {};
    this.tWood = rep(ctx.useCtxWood && t.wood ? t.wood : oakTex()); this.tWeave = rep(t.weave || fallbackWeave()); this.tStone = rep(ctx.useCtxStone && t.stone ? t.stone : travTex());
  }
  get(key, make) {
    if (!this.c.has(key)) { const m = make(); if (this.ctx.envMap && this.ctx.useEnvMap) m.envMap = this.ctx.envMap; this.c.set(key, m); }
    return this.c.get(key);
  }
  ceramic() { return this.get('ceramic', () => new T.MeshPhysicalMaterial({ color: P.PORC, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.1 })); }
  seatPlastic() { return this.get('seat', () => new T.MeshPhysicalMaterial({ color: 0xF4F3EF, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.12 })); }
  chrome() { return this.get('chrome', () => new T.MeshStandardMaterial({ color: 0xF2F2F2, metalness: 1, roughness: 0.07, envMapIntensity: 1.2 })); }
  satin() { return this.get('satin', () => new T.MeshStandardMaterial({ color: 0xD6D6D6, metalness: 1, roughness: 0.28 })); }
  steel() { return this.get('steel', () => new T.MeshStandardMaterial({ color: 0xE6E7E9, map: rep(brushedTex()), metalness: 0.95, roughness: 0.27, envMapIntensity: 1.25 })); }
  steelDark() { return this.get('steelDark', () => new T.MeshStandardMaterial({ color: 0x8E9196, metalness: 0.7, roughness: 0.45 })); }
  blackGlass() { return this.get('blackGlass', () => new T.MeshPhysicalMaterial({ color: 0x08090A, roughness: 0.06, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.2 })); }
  screen() { return this.get('screen', () => new T.MeshPhysicalMaterial({ color: 0x0C0E12, roughness: 0.35, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.4 })); }
  glass() { return this.get('glass', () => new T.MeshPhysicalMaterial({ color: 0xE9F2EF, roughness: 0.02, metalness: 0, transparent: true, opacity: 0.16, envMapIntensity: 1.6, depthWrite: false, side: T.DoubleSide })); }
  glassEdge() { return this.get('glassEdge', () => new T.MeshStandardMaterial({ color: 0x9CC4B4, roughness: 0.1, transparent: true, opacity: 0.55, depthWrite: false })); }
  water() { return this.get('water', () => new T.MeshPhysicalMaterial({ color: 0xC3D8D6, roughness: 0.02, metalness: 0, transparent: true, opacity: 0.42, envMapIntensity: 1.8, depthWrite: false, userData: { noShadow: true } })); }
  cavity() { return this.get('cavity', () => new T.MeshStandardMaterial({ color: 0x2C2E2E, roughness: 0.6 })); }
  dark(c = 0x1C1B1A, r = 0.6) { return this.get('dark' + c + r, () => new T.MeshStandardMaterial({ color: c, roughness: r })); }
  metal(c, r = 0.35, m = 0.9) { return this.get('metal' + c + r + m, () => new T.MeshStandardMaterial({ color: c, roughness: r, metalness: m })); }
  paint(c, r = 0.55) { return this.get('paint' + c + r, () => new T.MeshStandardMaterial({ color: c, roughness: r })); }
  gloss(c, r = 0.25) { return this.get('gloss' + c + r, () => new T.MeshPhysicalMaterial({ color: c, roughness: r, clearcoat: 0.8, clearcoatRoughness: 0.1 })); }
  // Photo maps from walk.js (ctx.hd, see hd.js), optional. Piece uvs are metres / s (boxUV): s 0.6 for wood and stone,
  // 0.15 for upholstery. Dark woods take the walnut (turned so its grain runs along u, like oakTex), light ones the oak.
  hd(m, set, o) { if (this.ctx.hd) this.ctx.hd(m, set, { dispose: false, ...o }); return m; }
  hdFabric(m, bump) { return this.hd(m, 'fabric_boucle', { su: 0.15, sv: 0.15, color: 'keep', normalScale: Math.min(1.2, 0.35 + 0.35 * bump) }); }
  wood(c = P.OAK, r = 0.55) {
    return this.get('wood' + c + r, () => {
      const dark = new T.Color(c).getHSL({}, T.SRGBColorSpace).l < 0.45;
      return this.hd(new T.MeshStandardMaterial({ color: c, map: this.tWood, roughness: r }), dark ? 'walnut' : 'oak_veneer', { su: 0.6, sv: 0.6, rot: dark ? 90 : 0 });
    });
  }
  fabric(c = P.BOUCLE, bump = 1.2) {
    return this.get('fab' + c + bump, () => {
      const col = new T.Color(c);
      return this.hdFabric(new T.MeshPhysicalMaterial({ color: col, roughness: 0.92, sheen: 0.7, sheenRoughness: 0.75, sheenColor: col.clone().lerp(new T.Color(0xffffff), 0.5), bumpMap: this.tWeave, bumpScale: bump }), bump);
    });
  }
  leather(c = P.LEATHER) { return this.get('leather' + c, () => new T.MeshPhysicalMaterial({ color: c, roughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.4, bumpMap: this.tWeave, bumpScale: 0.25 })); }
  stone(c = P.QUARTZ, r = 0.3) { return this.get('stone' + c + r, () => this.hd(new T.MeshPhysicalMaterial({ color: c, map: this.tStone, roughness: r, clearcoat: 0.3, clearcoatRoughness: 0.2 }), 'stone_top', { su: 0.6, sv: 0.6 })); }
  quartz(c = P.QUARTZ) { return this.get('quartz' + c, () => new T.MeshPhysicalMaterial({ color: c, map: rep(quartzTex()), roughness: 0.22, clearcoat: 0.5, clearcoatRoughness: 0.12 })); }
  tile() { return this.get('tile', () => new T.MeshStandardMaterial({ map: rep(tileTex()), roughness: 0.6 })); }
  rug(c = P.JUTE) { return this.get('rug' + c, () => { const m = new T.MeshStandardMaterial({ color: new T.Color(c).lerp(new T.Color(0xffffff), 0.55), map: rep(rugTex()), bumpMap: this.tWeave, bumpScale: 2.2, roughness: 1 }); return m; }); }
  shade() { return this.get('shade', () => new T.MeshStandardMaterial({ color: P.PAPER, roughness: 0.9, side: T.DoubleSide, emissive: 0x7A5A2E, emissiveIntensity: 0.6, bumpMap: this.tWeave, bumpScale: 0.4 })); }   // paper / linen shade, always lit
  pull() { return this.metal(P.PULL, 0.32); }   // slim satin-black pulls, stems and footrests (metal 0.9, rough 0.32: furniture_test's handle probe)
  handle(c) { return this.metal(c ?? P.PULL, 0.32); }
  cane(c = 0xFFF6E6) {   // the map carries the cane colour (P.CANE family); c only tints it
    return this.get('cane' + c, () => { const t = rep(caneTex()); return new T.MeshStandardMaterial({ color: c, map: t, roughness: 0.75, side: T.DoubleSide }); });
  }
}
function mats(ctx) { let m = MCACHE.get(ctx); if (!m) MCACHE.set(ctx, m = new Mats(ctx)); return m; }

// ---------------------------------------------------------------- spec -> local frame
const BACK_ROT = { '-z': 0, '+z': PI, '+x': -PI / 2, '-x': PI / 2 };
const OPP = { '+x': '-x', '-x': '+x', '+z': '-z', '-z': '+z' };
function frame(spec, kind) {
  let cx, cz, fw, fd, rot = spec.rot || 0;
  if (spec.x0 != null) { cx = (spec.x0 + spec.x1) / 2; cz = (spec.z0 + spec.z1) / 2; fw = Math.abs(spec.x1 - spec.x0); fd = Math.abs(spec.z1 - spec.z0); }
  else { cx = spec.cx; cz = spec.cz; fw = spec.w; fd = spec.d; }
  let side = spec.back || (spec.head) || (spec.front && OPP[String(spec.front).replace('local', '').trim()]);
  if (!side) {   // default: back on a long side (beds and baths: on the short side for beds)
    if (kind === 'bed') side = fw >= fd ? '-x' : '-z';
    else side = fw >= fd ? '-z' : '-x';
  }
  side = String(side).replace('local', '').trim();
  if (!(side in BACK_ROT)) side = '-z';
  const alongX = side === '+x' || side === '-x';
  return { cx, cz, W: alongX ? fd : fw, D: alongX ? fw : fd, theta: rot + BACK_ROT[side], y0: spec.y0 ?? 0, h: spec.h ?? 0, side };
}
// World rect [x0, z0, x1, z1] (or {x0..}) into the local frame.
function toLocal(F, r) {
  const a = Array.isArray(r) ? r : [r.x0, r.z0, r.x1, r.z1];
  const pts = [[a[0], a[1]], [a[2], a[3]]].map(([x, z]) => new T.Vector3(x - F.cx, 0, z - F.cz).applyAxisAngle(new T.Vector3(0, 1, 0), -F.theta));
  return [Math.min(pts[0].x, pts[1].x), Math.min(pts[0].z, pts[1].z), Math.max(pts[0].x, pts[1].x), Math.max(pts[0].z, pts[1].z)];
}

// ================================================================= sanitary ware
// Basin mixer tap standing on a deck at (x, y, z), spout pointing +z.
function basinMixer(kit, M, x, y, z, tall = 0.13, reach = 0.12) {
  const ch = M.chrome();
  kit.add(ch, lathe([[0.0, y], [0.027, y], [0.027, y + 0.003], [0.023, y + 0.007], [0.022, y + 0.01], [0.022, y + tall - 0.006], [0.019, y + tall], [0.0, y + tall + 0.002]], 28, x, z));
  const sy = y + tall - 0.03;
  kit.add(ch, tube([[x, sy, z + 0.01], [x, sy + 0.002, z + reach * 0.5], [x, sy - 0.004, z + reach * 0.9], [x, sy - 0.016, z + reach]], 0.0085, 16, 12));
  kit.add(M.dark(0x3A3A3A, 0.5), cyl(0.0078, 0.0078, 0.006, 12, x, sy - 0.024, z + reach));
  kit.add(ch, cyl(0.0086, 0.0086, 0.006, 12, x, sy - 0.019, z + reach));
  // lever on top: short hub and a flat blade reaching forward, slightly raised
  kit.add(ch, cyl(0.014, 0.016, 0.014, 20, x, y + tall - 0.002, z));
  const lever = rbox(-0.007, -0.004, 0, 0.007, 0.004, 0.085, 0.003, 2); lever.rotateX(-0.22); lever.translate(x, y + tall + 0.009, z - 0.005);
  kit.add(ch, lever);
}
// Toilet: close-coupled, elongated bowl, seat down and lid up against the cistern.
function buildWC(F, s, M) {
  const kit = new Kit(), cer = M.ceramic(), L = 0.70, k = Math.min(1, F.D / L, F.W / 0.38);
  const Y = 0.373;   // rim top; the seat adds 25 mm (0.40)
  const outer = [
    R(0.000, 0.0, 0.0, 0.0, 0.40), R(0.000, 0.118, 0.170, 0.200, 0.40, 2.4, 3), R(0.008, 0.121, 0.174, 0.204, 0.40, 2.4, 3),
    R(0.060, 0.112, 0.166, 0.196, 0.40, 2.4, 3), R(0.160, 0.125, 0.192, 0.250, 0.41, 2.4, 3.5), R(0.250, 0.157, 0.226, 0.345, 0.43, 2.4, 4.5),
    R(0.315, 0.177, 0.244, 0.385, 0.44, 2.4, 5), R(0.350, 0.183, 0.251, 0.400, 0.44, 2.4, 5), R(0.364, 0.181, 0.249, 0.398, 0.44, 2.4, 5),
    R(Y, 0.173, 0.241, 0.390, 0.44, 2.4, 5),
  ];
  const inner = [
    R(Y - 0.001, 0.150, 0.214, 0.190, 0.445, 2.3), R(0.362, 0.144, 0.207, 0.184, 0.445, 2.3), R(0.345, 0.139, 0.203, 0.180, 0.445, 2.3),
    R(0.300, 0.128, 0.190, 0.165, 0.44, 2.3), R(0.240, 0.103, 0.155, 0.130, 0.425, 2.2), R(0.190, 0.072, 0.105, 0.090, 0.40, 2.1),
    R(0.150, 0.045, 0.062, 0.055, 0.38, 2), R(0.110, 0.022, 0.026, 0.026, 0.37, 2),
  ];
  kit.add(cer, loft([...outer, ...inner], 64));
  // standing water: the surface meets the bowl wall (its edge tucks just behind the glaze), and under it
  // the trapway opens as a funnel that darkens into the throat, instead of a flat disc
  const wl = R(0.215, 0.0875, 0.130, 0.110, 0.4125, 2.15);
  kit.add(M.water(), loft([rs(wl, 1.03), rs(wl, 0.5), rs(wl, 0)], 48));
  // (kept inside the glazed sump at every height, so no ceramic shows through the dark throat)
  const trap = R(0, 0.048, 0.054, 0.048, 0.385, 2.1);
  kit.add(M.dark(0x56605D, 0.35), loft([rs(trap, 1.0, 0.180), rs(trap, 0.82, 0.162), rs(trap, 0.64, 0.148)], 32));
  kit.add(M.dark(0x121615, 0.95), loft([rs(trap, 0.64, 0.148), rs(trap, 0.42, 0.140), rs(trap, 0.2, 0.136), rs(trap, 0, 0.135)], 32));
  // seat (closed ring) and lid
  const so = R(0, 0.177, 0.252, 0.228, 0.445, 2.4, 3.6), si = R(0, 0.118, 0.168, 0.128, 0.458, 2.2);
  const seat = M.seatPlastic();
  kit.add(seat, loft([rs(si, 1.0, Y + 0.003), rs(so, 0.965, Y + 0.001), rs(so, 1, Y + 0.008), rs(so, 0.99, Y + 0.019), rs(so, 0.955, Y + 0.025), rs(si, 1.07, Y + 0.024), rs(si, 1.0, Y + 0.015)], 64, true));
  const lo = { ...so, w: 0.173, f: 0.249, b: 0.224 };
  const lid = loft([rs(lo, 0, 0), rs(lo, 0.95, 0), rs(lo, 1, 0.007), rs(lo, 0.985, 0.02), rs(lo, 0.9, 0.028), rs(lo, 0, 0.032)], 64);
  const hz = 0.214, hy = Y + 0.026;
  if (s.lid === 'closed') lid.translate(0, Y + 0.026, 0);
  else { lid.translate(0, 0, -hz); lid.rotateX(-PI / 2 - 0.02); lid.translate(0, hy, hz); }
  kit.add(seat, lid);
  for (const sx of [-1, 1]) kit.add(M.chrome(), rbox(sx * 0.065 - 0.014, Y + 0.004, 0.196, sx * 0.065 + 0.014, Y + 0.03, 0.232, 0.008, 2));
  // cistern, lid and dual flush button
  kit.add(cer, rbox(-0.178, Y - 0.004, 0.012, 0.178, 0.758, 0.174, 0.024, 3));
  kit.add(cer, rbox(-0.185, 0.756, 0.006, 0.185, 0.779, 0.180, 0.01, 2));
  const bz = 0.093;
  kit.add(M.chrome(), lathe([[0.0275, 0.779], [0.032, 0.779], [0.032, 0.782], [0.029, 0.7835], [0.0275, 0.7825]], 32, 0, bz));
  kit.add(M.dark(0x55585A, 0.4), cyl(0.0276, 0.0276, 0.002, 32, 0, 0.779, bz));
  for (const [t0, sx] of [[0, 1], [PI, -1]]) kit.add(M.satin(), new T.CylinderGeometry(0.0262, 0.0262, 0.004, 20, 1, false, t0, PI).translate(sx * 0.0012, 0.783, bz));
  // angle valve and braided hose on the wall
  const vx = -0.12;
  kit.add(M.chrome(), rod([vx, 0.19, 0.0], [vx, 0.19, 0.045], 0.011, 14));
  kit.add(M.chrome(), rod([vx, 0.19, 0.03], [vx, 0.226, 0.03], 0.006, 10));
  kit.add(M.chrome(), cyl(0.026, 0.026, 0.006, 20, 0, 0, 0).rotateX(PI / 2).translate(vx, 0.19, 0.003));
  kit.add(M.satin(), tube([[vx, 0.19, 0.045], [vx + 0.005, 0.25, 0.05], [vx + 0.01, 0.33, 0.04], [vx + 0.01, Y - 0.006, 0.036]], 0.0065, 14, 8));
  const g = new T.Group();
  return kit.into(g, new T.Matrix4().makeTranslation(0, 0, -F.D / 2).multiply(new T.Matrix4().makeScale(k, 1, k)));
}
// Wall-hung basin: rectangular ceramic body, recessed bowl, rear tap deck, overflow, pop-up waste, bottle trap.
function buildBasin(F, s, M) {
  if (s.vanity) return buildVanity(F, { ...s, basins: 1 }, M);
  const kit = new Kit(), cer = M.ceramic();
  const W = Math.min(F.W, 0.62), D = Math.min(F.D, 0.48);
  // rim height above y0: spec.rim (world height, as in the JSON) wins; else h when it is a rim height (>= 0.3)
  // or the body depth of a wall-hung basin (0.1..0.3, as in the JSON); else 0.16
  const top = s.rim != null && s.rim - F.y0 > 0.05 ? s.rim - F.y0 : F.h >= 0.1 ? F.h : 0.16, yb = top - 0.16;
  const z0 = -F.D / 2;   // wall
  const O = R(0, W / 2 - 0.004, D / 2 - 0.004, D / 2 - 0.004, z0 + D / 2, 5, 5);
  const deck = Math.max(0.08, Math.min(0.13, D * 0.27)), zf = D - 0.032, zi = z0 + (deck + zf) / 2, Li = (zf - deck) / 2;
  const I = R(0, W / 2 - 0.042, Li, Li, zi, 2.7, 2.7);
  kit.add(cer, loft([
    circ(yb + 0.003, 0.021, 0, zi), rs(I, 0.5, yb + 0.006), rs(I, 1.04, yb + 0.03), rs(O, 0.955, top - 0.122), rs(O, 0.99, top - 0.112), rs(O, 1, top - 0.096),
    rs(O, 1, top - 0.011), rs(O, 0.994, top - 0.0025), rs(O, 0.982, top), rs(I, 1.075, top), rs(I, 1.0, top - 0.007), rs(I, 0.975, top - 0.028),
    rs(I, 0.875, top - 0.072), rs(I, 0.65, top - 0.106), rs(I, 0.34, top - 0.124), circ(top - 0.128, 0.025, 0, zi), circ(top - 0.134, 0.021, 0, zi), circ(yb + 0.003, 0.021, 0, zi),
  ], 64));
  // pop-up waste
  kit.add(M.chrome(), lathe([[0, top - 0.125], [0.012, top - 0.1255], [0.019, top - 0.1275], [0.0245, top - 0.1285], [0.0245, top - 0.131]].reverse(), 28, 0, zi));
  // overflow at the back of the bowl, under the tap
  const zo = zi - Li * 0.972 + 0.0015, oy = top - 0.034;
  const ov = lathe([[0.0125, 0], [0.0125, 0.0015], [0.0115, 0.004], [0.0065, 0.004]], 20); ov.rotateX(PI / 2); ov.translate(0, oy, zo);
  kit.add(M.chrome(), ov);
  kit.add(M.cavity(), new T.CircleGeometry(0.0068, 16).translate(0, oy, zo + 0.0005));
  basinMixer(kit, M, 0, top, z0 + deck * 0.5 + 0.005, 0.13, Math.min(0.13, Li * 0.95));
  if (s.trap !== false) {   // chrome bottle trap to the wall
    const ch = M.chrome();
    kit.add(ch, cyl(0.016, 0.016, 0.07, 16, 0, yb - 0.065, zi));
    kit.add(ch, lathe([[0, yb - 0.19], [0.022, yb - 0.188], [0.03, yb - 0.178], [0.031, yb - 0.1], [0.026, yb - 0.075], [0.016, yb - 0.066], [0, yb - 0.066]], 24, 0, zi));
    kit.add(ch, rod([0, yb - 0.125, zi - 0.02], [0, yb - 0.125, z0 + 0.004], 0.016, 16));
    kit.add(ch, cyl(0.036, 0.036, 0.008, 24, 0, 0, 0).rotateX(PI / 2).translate(0, yb - 0.125, z0 + 0.004));
  }
  return kit.into(new T.Group());
}
// Vanity: floating cabinet (1 or 2 basins), quartz top with undermount ceramic bowls and mixer taps.
function buildVanity(F, s, M) {
  const kit = new Kit(), n = s.basins === 2 || (s.basins == null && F.W > 1.3) ? 2 : 1;
  const W = F.W, D = F.D, top = F.h >= 0.6 ? F.h : 0.86, t = 0.022, z0 = -D / 2;
  const front = M[s.woodFront === false ? 'paint' : 'wood'](s.color ?? s.wood ?? P.OAK, 0.5);
  const cabBot = Math.max(0.12, top - t - 0.52);
  // carcass and drawer fronts (two per basin bay)
  // open carcass (sides, back, bottom) so the undermount bowls show through the cut-outs
  const cz1 = D / 2 - 0.051;
  kit.add(front, rbox(-W / 2 + 0.004, cabBot, z0, -W / 2 + 0.022, top - t, cz1, 0.003, 1), { s: 0.6 });
  kit.add(front, rbox(W / 2 - 0.022, cabBot, z0, W / 2 - 0.004, top - t, cz1, 0.003, 1), { s: 0.6 });
  kit.add(front, rbox(-W / 2 + 0.004, cabBot, z0, W / 2 - 0.004, cabBot + 0.018, cz1, 0.003, 1), { s: 0.6 });
  kit.add(M.paint(0x3A332D, 0.8), box(-W / 2 + 0.02, cabBot, z0, W / 2 - 0.02, top - t, z0 + 0.012));
  const bays = n, bw = (W - 0.008) / bays, g = 0.003, fz0 = D / 2 - 0.051, fz1 = D / 2 - 0.032;
  const handle = M.handle(s.handle);
  for (let b = 0; b < bays; b++) {
    const xa = -W / 2 + 0.004 + b * bw + g, xb = xa + bw - 2 * g;
    const hsplit = cabBot + (top - t - cabBot) * 0.42;
    for (const [ya, yb] of [[cabBot + g, hsplit - g], [hsplit + g, top - t - g]]) {
      kit.add(front, rbox(xa, ya, fz0, xb, yb, fz1, 0.003, 1), { s: 0.6 });
      const hy = yb - 0.045, hw = Math.min(0.18, (xb - xa) * 0.35), hx = (xa + xb) / 2;
      kit.add(handle, rod([hx - hw / 2, hy, fz1 + 0.024], [hx + hw / 2, hy, fz1 + 0.024], 0.006, 10));
      for (const ex of [hx - hw / 2 + 0.01, hx + hw / 2 - 0.01]) kit.add(handle, rod([ex, hy, fz1], [ex, hy, fz1 + 0.024], 0.004, 8));
    }
  }
  // undermount bowls
  const bowls = [];
  for (let b = 0; b < n; b++) {
    const bx = -W / 2 + (b + 0.5) * (W / n), bwid = Math.min(0.46, W / n - 0.14), bd = Math.min(0.34, D - 0.2);
    const bz = D / 2 - 0.07 - bd / 2;
    bowls.push(R(0, bwid / 2, bd / 2, bd / 2, bz, 3.2, 3.2, bx));
  }
  const shape = roundRectShape(-W / 2 + 0.002, z0, W / 2 - 0.002, D / 2 - 0.002, 0.006);
  for (const B of bowls) shape.holes.push(outlinePath(B, 48));
  kit.add(M.quartz(s.top ?? P.QUARTZ), slab(shape, top - t, top, 0.002), 0.5);
  const cer = M.ceramic(), yt = top - t;
  for (const B of bowls) {
    kit.add(cer, loft([rs(B, 1.12, yt + 0.001), rs(B, 1.0, yt + 0.0005), rs(B, 0.99, yt - 0.012), rs(B, 0.955, yt - 0.045), rs(B, 0.84, yt - 0.1), rs(B, 0.6, yt - 0.135),
      rs(B, 0.3, yt - 0.152), circ(yt - 0.156, 0.025, B.x, B.z), circ(yt - 0.165, 0.021, B.x, B.z), circ(yt - 0.2, 0.021, B.x, B.z)], 56));
    kit.add(M.chrome(), lathe([[0, yt - 0.153], [0.012, yt - 0.1535], [0.019, yt - 0.1555], [0.0245, yt - 0.1565], [0.0245, yt - 0.159]].reverse(), 28, B.x, B.z));
    basinMixer(kit, M, B.x, top, B.z - B.b - 0.055, 0.15, 0.135);
  }
  return kit.into(new T.Group());
}
// Shower: tiled tray, linear drain, wall mixer, rain head on an arm, slide rail with handset; frameless glass.
function buildShower(F, s, M) {
  const kit = new Kit(), W = F.W, D = F.D, z0 = -D / 2, ch = M.chrome();
  const tray = s.tray !== false;
  if (tray) kit.add(M.tile(), rbox(-W / 2, 0, z0, W / 2, 0.012, D / 2, 0.003, 1), 0.4);
  const fy = tray ? 0.012 : 0.002;
  // linear drain along the wall
  const dl = Math.max(0.3, W - 0.24), dz = z0 + 0.08;
  kit.add(M.steel(), rbox(-dl / 2, fy - 0.002, dz - 0.035, dl / 2, fy + 0.0015, dz + 0.035, 0.0015, 1), 0.3);
  for (let x = -dl / 2 + 0.02; x < dl / 2 - 0.015; x += 0.016) kit.add(M.dark(0x202020, 0.7), box(x, fy + 0.0015, dz - 0.022, x + 0.007, fy + 0.0022, dz + 0.022));
  // wall mixer (round plate, lever), elbow outlet
  const mx = s.mixerX ?? 0, my = 1.05;
  kit.add(ch, lathe([[0.075, 0], [0.075, 0.008], [0.07, 0.012], [0, 0.012]], 40).rotateX(PI / 2).translate(mx, my, z0));
  kit.add(ch, rod([mx, my, z0 + 0.01], [mx, my, z0 + 0.045], 0.018, 20));
  const lev = rbox(-0.007, -0.006, 0, 0.007, 0.006, 0.1, 0.004, 2); lev.rotateX(-0.12); lev.translate(mx, my + 0.004, z0 + 0.03); kit.add(ch, lev);
  kit.add(ch, rod([mx, my - 0.13, z0], [mx, my - 0.13, z0 + 0.04], 0.012, 12));
  kit.add(ch, cyl(0.024, 0.024, 0.006, 20, 0, 0, 0).rotateX(PI / 2).translate(mx, my - 0.13, z0 + 0.003));
  // rain shower: arm from the wall and a square head
  const hy = s.headY ?? 2.12, arm = Math.min(0.36, D * 0.45), hs = 0.25;
  kit.add(ch, cyl(0.03, 0.03, 0.008, 24, 0, 0, 0).rotateX(PI / 2).translate(mx, hy + 0.06, z0 + 0.004));
  kit.add(ch, tube([[mx, hy + 0.06, z0 + 0.005], [mx, hy + 0.06, z0 + arm * 0.6], [mx, hy + 0.045, z0 + arm]], 0.011, 14, 12));
  kit.add(ch, rbox(mx - hs / 2, hy + 0.028, z0 + arm - hs / 2 + 0.02, mx + hs / 2, hy + 0.04, z0 + arm + hs / 2 + 0.02, 0.005, 2));
  kit.add(M.dark(0x7A7D80, 0.45), rbox(mx - hs / 2 + 0.012, hy + 0.0275, z0 + arm - hs / 2 + 0.032, mx + hs / 2 - 0.012, hy + 0.029, z0 + arm + hs / 2 + 0.008, 0.004, 1));
  // slide rail with handset and hose
  const rx = Math.max(-W / 2 + 0.12, Math.min(W / 2 - 0.12, mx + Math.min(0.32, W * 0.3))) * (s.railSide === 'left' ? -1 : 1);
  kit.add(ch, rod([rx, 1.0, z0 + 0.035], [rx, 1.8, z0 + 0.035], 0.011, 14));
  for (const y of [1.0, 1.8]) { kit.add(ch, rod([rx, y, z0], [rx, y, z0 + 0.04], 0.012, 14)); }
  kit.add(ch, rbox(rx - 0.018, 1.47, z0 + 0.028, rx + 0.018, 1.53, z0 + 0.06, 0.006, 2));
  const hh = tube([[rx, 1.42, z0 + 0.07], [rx, 1.5, z0 + 0.078], [rx, 1.6, z0 + 0.09]], 0.014, 10, 12); kit.add(ch, hh);
  kit.add(ch, cyl(0.045, 0.04, 0.03, 28, 0, 0, 0).rotateX(-0.25).translate(rx, 1.62, z0 + 0.095));
  kit.add(M.satin(), tube([[rx, 1.42, z0 + 0.07], [rx - 0.01, 1.12, z0 + 0.12], [(rx + mx) / 2, 0.88, z0 + 0.13], [mx, 0.9, z0 + 0.06], [mx, my - 0.13, z0 + 0.045]], 0.0075, 40, 8));
  // glass
  if (s.enclosure) {
    const gh = F.h >= 1.6 ? F.h : 2.0, gt = 0.008, gz = D / 2 - 0.066, glass = M.glass(), edge = M.glassEdge();
    const sides = s.glass || ['front'];
    if (sides.includes('front')) {
      const door = W > 1.25 ? 0 : Math.min(0.62, W * 0.55), pw = W - door - (door ? 0.006 : 0);
      const xA = -W / 2 + 0.006, xB = -W / 2 + pw;
      kit.add(glass, box(xA, fy + 0.008, gz - gt / 2, xB, fy + gh, gz + gt / 2));
      kit.add(edge, box(xB - 0.001, fy + 0.008, gz - gt / 2, xB, fy + gh, gz + gt / 2));
      kit.add(ch, rbox(-W / 2, fy, gz - 0.012, -W / 2 + 0.018, fy + gh, gz + 0.012, 0.002, 1));   // wall U channel
      kit.add(ch, rbox(xA, fy, gz - 0.009, xB, fy + 0.02, gz + 0.009, 0.002, 1));                // floor channel
      kit.add(ch, rod([xB - 0.03, fy + gh - 0.05, gz - 0.005], [xB - 0.03, fy + gh - 0.05, z0], 0.009, 12));   // stabiliser bar
      kit.add(ch, rbox(xB - 0.045, fy + gh - 0.07, gz - 0.012, xB - 0.015, fy + gh - 0.03, gz + 0.012, 0.004, 1));
      if (door) {
        const dA = xB + 0.006, dB = W / 2 - 0.004;
        kit.add(glass, box(dA, fy + 0.012, gz - gt / 2, dB, fy + gh, gz + gt / 2));
        kit.add(edge, box(dB - 0.001, fy + 0.012, gz - gt / 2, dB, fy + gh, gz + gt / 2));
        for (const y of [0.25, gh - 0.3]) kit.add(ch, rbox(xB - 0.03, fy + y, gz - 0.014, dA + 0.03, fy + y + 0.075, gz + 0.014, 0.004, 2));   // glass-to-glass hinges
        const hx = dB - 0.06;
        kit.add(ch, rod([hx, fy + 0.85, gz + 0.004], [hx, fy + 0.85, gz + 0.05], 0.008, 10)); kit.add(ch, rod([hx, fy + 1.15, gz + 0.004], [hx, fy + 1.15, gz + 0.05], 0.008, 10));
        kit.add(ch, rod([hx, fy + 0.84, gz + 0.05], [hx, fy + 1.16, gz + 0.05], 0.011, 12));
        kit.add(ch, rod([hx, fy + 0.85, gz - 0.004], [hx, fy + 0.85, gz - 0.05], 0.008, 10)); kit.add(ch, rod([hx, fy + 1.15, gz - 0.004], [hx, fy + 1.15, gz - 0.05], 0.008, 10));
        kit.add(ch, rod([hx, fy + 0.84, gz - 0.05], [hx, fy + 1.16, gz - 0.05], 0.011, 12));
      }
    }
    for (const side of ['left', 'right']) if (sides.includes(side)) {
      const x = side === 'left' ? -W / 2 + 0.03 : W / 2 - 0.03;
      kit.add(glass, box(x - gt / 2, fy + 0.008, z0 + 0.006, x + gt / 2, fy + gh, gz - 0.01));
      kit.add(ch, rbox(x - 0.012, fy, z0, x + 0.012, fy + gh, z0 + 0.018, 0.002, 1));
    }
  }
  return kit.into(new T.Group());
}
// Bath: built-in acrylic tub with a deck all round, sloped back, rounded inner basin, deck spout and mixer.
function buildBath(F, s, M) {
  const kit = new Kit(), cer = M.ceramic();
  // the long axis runs along local x; swap if the footprint is deeper than wide
  let W = F.W, D = F.D, swap = false; if (D > W) { [W, D] = [D, W]; swap = true; }
  const H = F.h >= 0.35 ? F.h : 0.55, tapEnd = s.tapEnd === '+x' ? 1 : -1;
  const O = R(0, W / 2 - 0.003, D / 2 - 0.003, D / 2 - 0.003, 0, 9, 9);
  const ix = -tapEnd * 0.035, I = R(0, W / 2 - 0.115, D / 2 - 0.075, D / 2 - 0.075, 0, 4.2, 4.2, ix);
  const bot = H - 0.44;
  const Ib = { ...I, w: I.w - 0.18, f: I.f - 0.09, b: I.b - 0.09, n: 3.4, m: 3.4, x: ix - tapEnd * 0.03 };
  kit.add(cer, loft([
    rs(O, 0.985, 0), rs(O, 0.992, 0.004), rs(O, 0.993, 0.05), rs(O, 1, 0.065), rs(O, 1, H - 0.012), rs(O, 0.996, H - 0.003), rs(O, 0.988, H),
    rs(I, 1.04, H), rs(I, 1.0, H - 0.008), rs(I, 0.985, H - 0.035),
    { ...I, w: I.w - 0.03, f: I.f - 0.02, b: I.b - 0.02, y: H - 0.16 }, { ...I, w: I.w - 0.09, f: I.f - 0.05, b: I.b - 0.05, y: H - 0.32, n: 3.8, m: 3.8, x: ix - tapEnd * 0.015 },
    { ...Ib, w: Ib.w + 0.02, f: Ib.f + 0.015, b: Ib.b + 0.015, y: bot + 0.02 }, { ...Ib, y: bot }, rs(Ib, 0.6, bot - 0.001), rs(Ib, 0, bot - 0.001),
  ], 72));
  const tx = tapEnd * (W / 2 - 0.06), ch = M.chrome();
  // drain and overflow at the tap end
  const dx = ix + tapEnd * (I.w - 0.2);
  kit.add(ch, lathe([[0.035, bot], [0.03, bot + 0.002], [0, bot + 0.004]], 28, dx, 0));
  const ov = lathe([[0.028, 0], [0.028, 0.002], [0.022, 0.005], [0, 0.006]], 24); ov.rotateZ(tapEnd * PI / 2); ov.translate(ix + tapEnd * (I.w * 0.985 - 0.004), H - 0.075, 0); kit.add(ch, ov);
  // deck spout (gooseneck down into the tub) with two handles
  kit.add(ch, lathe([[0, H], [0.03, H], [0.03, H + 0.004], [0.022, H + 0.01], [0.02, H + 0.07], [0, H + 0.075]], 24, tx, 0));
  kit.add(ch, tube([[tx, H + 0.06, 0], [tx, H + 0.12, 0], [tx - tapEnd * 0.06, H + 0.15, 0], [tx - tapEnd * 0.13, H + 0.11, 0], [tx - tapEnd * 0.14, H + 0.08, 0]], 0.012, 24, 12));
  for (const sz of [-1, 1]) {
    const hz = sz * Math.min(0.13, D / 2 - 0.1);
    kit.add(ch, lathe([[0, H], [0.022, H], [0.022, H + 0.004], [0.014, H + 0.01], [0.014, H + 0.05], [0, H + 0.055]], 20, tx, hz));
    kit.add(ch, rbox(tx - 0.006, H + 0.045, hz - 0.035, tx + 0.006, H + 0.055, hz + 0.035, 0.004, 1));
  }
  const g = new T.Group(); kit.into(g, swap ? new T.Matrix4().makeRotationY(PI / 2) : null); return g;
}

// ================================================================= kitchen
// Gooseneck kitchen tap at (x, y, z), arc reaching +z.
function gooseneck(kit, M, x, y, z, reach = 0.22) {
  const ch = M.chrome();
  kit.add(ch, lathe([[0, y], [0.03, y], [0.03, y + 0.004], [0.024, y + 0.012], [0.022, y + 0.02], [0.022, y + 0.13], [0.016, y + 0.145], [0, y + 0.146]], 28, x, z));
  kit.add(ch, tube([[x, y + 0.13, z], [x, y + 0.3, z], [x, y + 0.385, z + reach * 0.32], [x, y + 0.36, z + reach * 0.85], [x, y + 0.29, z + reach], [x, y + 0.255, z + reach]], 0.0125, 36, 10));
  kit.add(M.dark(0x3A3A3A, 0.5), cyl(0.011, 0.011, 0.006, 12, x, y + 0.248, z + reach));
  kit.add(ch, rod([x + 0.02, y + 0.085, z], [x + 0.075, y + 0.105, z], 0.008, 10, 0.006));
  kit.add(ch, lathe([[0, 0], [0.012, 0], [0.012, 0.012], [0, 0.014]], 14).rotateZ(-PI / 2).translate(x + 0.012, y + 0.085, z));
}
function buildSink(F, s, M) {
  const kit = new Kit(), W = F.W, D = F.D, st = M.steel(), z0 = -D / 2;
  const n = s.bowls ?? (W > 0.75 ? 2 : 1), t = 0.008, deck = Math.min(0.11, D * 0.24), margin = 0.035, gap = 0.06;
  const bw = (W - 2 * margin - gap * (n - 1)) / n, bd = D - deck - margin, bz = z0 + deck + bd / 2;
  const bowls = []; for (let i = 0; i < n; i++) bowls.push(R(0, bw / 2, bd / 2, bd / 2, bz, 9, 9, -W / 2 + margin + bw / 2 + i * (bw + gap)));
  const shape = roundRectShape(-W / 2 + 0.002, z0 + 0.002, W / 2 - 0.002, D / 2 - 0.002, 0.012);
  for (const B of bowls) shape.holes.push(outlinePath(B, 48));
  kit.add(st, slab(shape, 0, t, 0.0025), 0.3);
  for (const B of bowls) {
    const dep = 0.2;
    kit.add(st, loft([rs(B, 1, t * 0.5), rs(B, 0.995, -0.01), rs(B, 0.975, -dep + 0.012), rs(B, 0.955, -dep), rs(B, 0.2, -dep - 0.002), rs(B, 0, -dep - 0.003)], 48), 0.3);
    kit.add(M.chrome(), lathe([[0.03, -dep - 0.001], [0.045, -dep], [0.045, -dep + 0.002], [0.04, -dep + 0.004]], 28, B.x, B.z));
    kit.add(M.dark(0x1E1E1E, 0.5), lathe([[0.03, -dep + 0.0005], [0.03, -dep - 0.01], [0.0, -dep - 0.01]], 24, B.x, B.z));
    kit.add(st, lathe([[0.026, -dep + 0.0015], [0.024, -dep + 0.0035], [0, -dep + 0.0045]], 24, B.x, B.z));
  }
  gooseneck(kit, M, n === 2 ? 0 : 0, t, z0 + deck * 0.5, Math.min(0.24, deck * 0.5 + bd * 0.5));
  return kit.into(new T.Group());
}
function buildHob(F, s, M) {
  const kit = new Kit(), W = Math.min(F.W, 0.86), D = Math.min(F.D, 0.52), gas = s.gas !== false;
  kit.add(M.blackGlass(), rbox(-W / 2, 0, -D / 2, W / 2, 0.008, D / 2, 0.004, 2));
  const n = s.burners ?? 2;
  const pos = n === 1 ? [[0, -0.02]] : n === 2 ? [[-W / 4, -0.02], [W / 4, -0.02]] : n === 3 ? [[-W / 3, -0.02], [0, -0.02], [W / 3, -0.02]]
    : [[-W / 4, -D / 4 + 0.01], [W / 4, -D / 4 + 0.01], [-W / 4, D / 4 - 0.04], [W / 4, D / 4 - 0.04]];
  const iron = M.dark(0x161515, 0.75), alu = M.metal(0x9A9A98, 0.5, 0.8), cap = M.dark(0x121212, 0.45);
  for (const [bx, bz] of pos) {
    if (gas) {
      const big = n <= 3 && Math.abs(bx) < 0.01 || n === 2;
      const rr = big ? 0.06 : 0.045;
      kit.add(M.satin(), lathe([[0, 0.008], [rr + 0.012, 0.008], [rr + 0.012, 0.011], [rr + 0.004, 0.014]], 32, bx, bz));
      kit.add(alu, lathe([[rr * 0.55, 0.012], [rr, 0.013], [rr, 0.026], [rr * 0.92, 0.03], [rr * 0.55, 0.03]], 32, bx, bz));
      kit.add(cap, lathe([[0, 0.04], [rr * 0.7, 0.037], [rr * 0.75, 0.032], [rr * 0.72, 0.028], [0, 0.028]].reverse(), 28, bx, bz));
      kit.add(cap, lathe([[rr * 0.35, 0.03], [rr * 0.5, 0.03], [rr * 0.5, 0.035], [rr * 0.35, 0.035]], 20, bx, bz));
      // cast-iron pan support: square frame, four fingers, feet
      const hs = Math.min(0.13, W / 4 - 0.01), y0 = 0.045, b = 0.011;
      for (const sx of [-1, 1]) {
        kit.add(iron, rbox(bx - hs, y0, bz + sx * hs - b / 2, bx + hs, y0 + b, bz + sx * hs + b / 2, 0.001, 1));
        kit.add(iron, rbox(bx + sx * hs - b / 2, y0, bz - hs, bx + sx * hs + b / 2, y0 + b, bz + hs, 0.001, 1));
      }
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a = [bx + dx * hs, y0 + b, bz + dz * hs], e = [bx + dx * (rr + 0.012), y0 + b + 0.008, bz + dz * (rr + 0.012)];
        kit.add(iron, rbox(Math.min(a[0], e[0]) - (dz ? b / 2 : 0), y0 + 0.004, Math.min(a[2], e[2]) - (dx ? b / 2 : 0), Math.max(a[0], e[0]) + (dz ? b / 2 : 0), y0 + b + 0.009, Math.max(a[2], e[2]) + (dx ? b / 2 : 0), 0.001, 1));
      }
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.add(M.dark(0x222222, 0.6), cyl(0.008, 0.009, y0 - 0.008, 10, bx + sx * hs, 0.008, bz + sz * hs));
      // knob on the glass, front edge
      const kx = bx, kz = D / 2 - 0.045;
      kit.add(M.satin(), cyl(0.026, 0.026, 0.003, 28, kx, 0.008, kz));
      kit.add(M.dark(0x1A1A1A, 0.35), lathe([[0, 0.011], [0.021, 0.011], [0.021, 0.03], [0.019, 0.034], [0, 0.035]], 28, kx, kz));
      kit.add(M.satin(), rbox(kx - 0.003, 0.034, kz - 0.016, kx + 0.003, 0.037, kz + 0.016, 0.0015, 1));
    } else {
      for (const [r0, r1] of [[0.085, 0.088], [0.06, 0.062]]) kit.add(M.dark(0x55585A, 0.4), new T.RingGeometry(r0, r1, 48).rotateX(-PI / 2).translate(bx, 0.0085, bz));
    }
  }
  if (!gas) for (let i = 0; i < 4; i++) kit.add(M.dark(0x66696B, 0.4), new T.CircleGeometry(0.008, 12).rotateX(-PI / 2).translate(-0.06 + i * 0.04, 0.0085, D / 2 - 0.04));
  return kit.into(new T.Group());
}
function buildFridge(F, s, M) {
  const kit = new Kit(), W = Math.min(F.W, 0.95), D = F.D, H = F.h >= 1.4 ? F.h : 1.8, st = M.steel(), body = M.steelDark(), z0 = -D / 2;
  const df = D / 2 - 0.045, dt = 0.05;   // door front face, door thickness (handles stand off in front)
  kit.add(body, rbox(-W / 2 + 0.004, 0.012, z0 + 0.02, W / 2 - 0.004, H - 0.005, df - dt, 0.012, 2));
  kit.add(M.dark(0x1A1A1A, 0.6), rbox(-W / 2 + 0.02, 0.012, df - dt - 0.01, W / 2 - 0.02, 0.085, df - dt + 0.004, 0.003, 1));
  for (let x = -W / 2 + 0.05; x < W / 2 - 0.05; x += 0.025) kit.add(M.dark(0x0E0E0E, 0.8), box(x, 0.025, df - dt + 0.004, x + 0.012, 0.072, df - dt + 0.005));
  const split = s.layout === 'top' ? null : 0.0;
  const g = 0.0035, ya = 0.092, yb = H - 0.004;
  const doors = split === null ? [[-W / 2 + 0.004, W / 2 - 0.004, ya, H * 0.68 - g], [-W / 2 + 0.004, W / 2 - 0.004, H * 0.68 + g, yb]]
    : [[-W / 2 + 0.004, -g, ya, yb], [g, W / 2 - 0.004, ya, yb]];
  const hy0 = 0.62, hy1 = Math.min(1.55, H - 0.2);
  doors.forEach(([xa, xb, y0, y1], i) => {
    kit.add(st, rbox(xa, y0, df - dt, xb, y1, df, 0.012, 2), { s: 0.4, vert: true });
    const hx = split === null ? xb - 0.06 : (i === 0 ? xb - 0.05 : xa + 0.05);
    const a = split === null ? (i === 0 ? y1 - 0.5 : y0 + 0.08) : hy0, b = split === null ? (i === 0 ? y1 - 0.08 : y0 + 0.45) : hy1;
    kit.add(st, rod([hx, a, df + 0.032], [hx, b, df + 0.032], 0.012, 14), { s: 0.4, vert: true });
    for (const y of [a + 0.03, b - 0.03]) kit.add(st, rod([hx, y, df], [hx, y, df + 0.032], 0.008, 10));
  });
  if (split !== null && s.dispenser !== false) {   // water dispenser recess on the left door
    const cx = (-W / 2 + 0.004 - g) / 2;
    kit.add(M.dark(0x161616, 0.25), rbox(cx - 0.085, 1.0, df - 0.004, cx + 0.085, 1.32, df + 0.001, 0.02, 2));
    kit.add(M.satin(), rbox(cx - 0.02, 1.13, df - 0.004, cx + 0.02, 1.2, df + 0.012, 0.006, 1));
    kit.add(M.dark(0x2A2A2A, 0.5), rbox(cx - 0.07, 1.005, df - 0.004, cx + 0.07, 1.02, df + 0.03, 0.004, 1));
  }
  return kit.into(new T.Group());
}
// Base cabinet run with a stone top (cut-outs for sinks), plinth recess, door / drawer fronts, bar handles.
function buildCounter(F, s, M) {
  const kit = new Kit(), W = F.W, D = F.D, H = F.h || 0.9, t = 0.03, z0 = -D / 2;
  const col = s.color ?? P.SAGE, fr = s.wood ? M.wood(s.wood, 0.5) : M.paint(col, 0.5), carc = fr, plinth = M.paint(s.plinth ?? 0x2E2B28, 0.7);
  const handle = M.handle(s.handle);
  const fz1 = D / 2 - 0.033, fz0 = fz1 - 0.019, ph = 0.1, top = H - t;
  kit.add(plinth, box(-W / 2 + 0.01, 0, z0 + 0.04, W / 2 - 0.01, ph, fz0 - 0.06));
  // open carcass: sides, back, bottom (no top panel, so sink bowls can drop through a cut-out)
  kit.add(carc, box(-W / 2, 0.0, z0 + 0.02, -W / 2 + 0.018, top, fz0));
  kit.add(carc, box(W / 2 - 0.018, 0.0, z0 + 0.02, W / 2, top, fz0));
  kit.add(carc, box(-W / 2, ph, z0 + 0.01, W / 2, top, z0 + 0.02));
  kit.add(carc, box(-W / 2, ph, z0 + 0.02, W / 2, ph + 0.018, fz0));
  const cuts = (s.cutouts || []).map(r => toLocal(F, r));
  const n = Math.max(1, Math.round(W / 0.6)), mw = W / n, g = 0.0025;
  for (let i = 0; i < n; i++) {
    const xa = -W / 2 + i * mw + g, xb = xa + mw - 2 * g, ya = ph + g, yb = top - g - 0.002;
    const underSink = cuts.some(c => c[0] < xb && c[2] > xa);
    if (!underSink && i % 3 === 1 && mw > 0.35) {   // drawer stack
      const hs = [0.22, 0.35, 0.43], tot = yb - ya; let y = ya;
      for (const f of hs) {
        const y1 = y + tot * f - g;
        kit.add(fr, rbox(xa, y, fz0, xb, y1, fz1, 0.003, 1), { s: 0.6 });
        const hy = y1 - Math.min(0.05, (y1 - y) * 0.3), hw = Math.min(0.2, (xb - xa) * 0.4), hx = (xa + xb) / 2;
        kit.add(handle, rod([hx - hw / 2, hy, fz1 + 0.025], [hx + hw / 2, hy, fz1 + 0.025], 0.006, 10));
        for (const ex of [hx - hw / 2 + 0.012, hx + hw / 2 - 0.012]) kit.add(handle, rod([ex, hy, fz1], [ex, hy, fz1 + 0.025], 0.004, 8));
        y = y1 + 2 * g;
      }
    } else {
      const two = mw > 0.7 || underSink && mw > 0.5;
      const leaves = two ? [[xa, (xa + xb) / 2 - g, 1], [(xa + xb) / 2 + g, xb, -1]] : [[xa, xb, i % 2 ? -1 : 1]];
      for (const [la, lb, hingeSide] of leaves) {
        kit.add(fr, rbox(la, ya, fz0, lb, yb, fz1, 0.003, 1), { s: 0.6, vert: true });
        const hx = hingeSide > 0 ? lb - 0.035 : la + 0.035, hl = 0.16;
        kit.add(handle, rod([hx, yb - 0.05 - hl, fz1 + 0.025], [hx, yb - 0.05, fz1 + 0.025], 0.006, 10));
        for (const ey of [yb - 0.05 - hl + 0.012, yb - 0.062]) kit.add(handle, rod([hx, ey, fz1], [hx, ey, fz1 + 0.025], 0.004, 8));
      }
    }
  }
  // stone top with cut-outs
  const shape = roundRectShape(-W / 2, z0, W / 2, D / 2, 0.004);
  for (const c of cuts) shape.holes.push(roundRectShape(c[0] + 0.03, c[1] + 0.03, c[2] - 0.03, c[3] - 0.03, 0.02, T.Path));
  kit.add(M.quartz(s.top ?? P.QUARTZ), slab(shape, top, H, 0.0025), 0.5);
  if (s.upper) {   // wall cabinets
    const u0 = H + (s.upperGap ?? 0.55), u1 = s.upperTop != null ? s.upperTop - F.y0 : H + 1.25, ud = 0.35, uz1 = z0 + ud;
    kit.add(carc, box(-W / 2, u0, z0, W / 2, u1, uz1 - 0.019));
    kit.add(M.paint(0xF2EBDD, 0.4), box(-W / 2 + 0.02, u0 - 0.0015, z0 + 0.02, W / 2 - 0.02, u0, uz1 - 0.04));
    for (let i = 0; i < n; i++) {
      const xa = -W / 2 + i * mw + g, xb = xa + mw - 2 * g;
      kit.add(fr, rbox(xa, u0 + g, uz1 - 0.019, xb, u1 - g, uz1, 0.003, 1), { s: 0.6, vert: true });
      const hx = i % 2 ? xa + 0.035 : xb - 0.035;
      kit.add(handle, rod([hx, u0 + 0.04, uz1 + 0.025], [hx, u0 + 0.2, uz1 + 0.025], 0.006, 10));
      for (const ey of [u0 + 0.052, u0 + 0.188]) kit.add(handle, rod([hx, ey, uz1], [hx, ey, uz1 + 0.025], 0.004, 8));
    }
  }
  return kit.into(new T.Group());
}

// ================================================================= living, dining, bedroom
function legs(kit, mat, pts, h, r0 = 0.022, r1 = 0.014, seg = 12, y0 = 0) { for (const [x, z] of pts) kit.add(mat, cyl(r1, r0, h, seg, x, y0, z), { s: 0.5, vert: true }); }
function buildSofa(F, s, M) {
  const kit = new Kit(), W = F.W, D = F.D, H = F.h >= 0.6 ? F.h : 0.82;
  const arm = s.armchair || W < 1.1, seats = arm && W < 1.1 ? 1 : (s.seats ?? Math.max(2, Math.min(4, Math.round(W / 0.66))));
  const base = s.armchair ? P.SAGE : P.BOUCLE;   // Japandi: oatmeal boucle sofa, a muted sage armchair
  const fab = s.leather ? M.leather(s.color ?? s.fabric ?? P.LEATHER) : M.fabric(s.fabric ?? s.color ?? base, 1.3);
  const cfab = s.leather ? fab : M.fabric(s.cushion ?? s.fabric ?? s.color ?? base, 1.3);
  const legW = M.wood(s.wood ?? P.ASH, 0.5), z0 = -D / 2, z1 = D / 2;
  const aw = Math.max(0.12, Math.min(0.2, W * (seats === 1 ? 0.17 : 0.08))), lh = 0.06, ah = 0.55, seatY = 0.41, backT = 0.17;   // low and grounded
  const uv = 0.15;
  kit.add(fab, rbox(-W / 2 + aw - 0.02, lh, z0 + 0.02, W / 2 - aw + 0.02, seatY - 0.15, z1 - 0.025, 0.03, 2), uv);   // seat deck
  for (const sx of [-1, 1]) kit.add(fab, cushion(aw - 0.012, ah - lh, D - 0.014, 0.08, 0.008, 0.006, 3).translate(sx * (W / 2 - aw / 2), lh + (ah - lh) / 2, 0), uv);   // track arms (the bulge brings them back to the footprint edge)
  kit.add(fab, cushion(W - 2 * aw + 0.04, 0.6, backT, 0.05, 0.01, 0.004, 3).translate(0, lh + 0.3, z0 + backT / 2 + 0.005), uv);   // back frame
  const inW = W - 2 * aw, cw = inW / seats, cd = D - backT - 0.03, cz = z0 + backT + cd / 2;
  for (let i = 0; i < seats; i++) {
    const x = -inW / 2 + cw * (i + 0.5);
    kit.add(cfab, cushion(cw - 0.008, 0.16, cd, 0.06, 0.022, 0.01, 3).translate(x, seatY - 0.08 + 0.005, cz + 0.005), uv);
    // back cushion height: the crown (30 mm) and the recline lift its top, so leave room for both under h
    const bh = Math.min(0.46, H - seatY - 0.078), bt = 0.17;
    const bc = cushion(cw - 0.012, bh, bt, 0.07, 0.03, 0.012, 3);
    bc.translate(0, bh / 2, 0); bc.rotateX(-0.17); bc.translate(x, seatY - 0.005, z0 + backT + bt / 2 - 0.02);
    kit.add(cfab, bc, uv);
  }
  // scatter cushions leaning in the corners
  const sc = s.cushions ?? (seats > 1 ? [P.SAGE, P.CHARCOAL] : []);
  sc.slice(0, 2).forEach((c, i) => {
    // 42 cm cushions leaning back; dropped (they squash into the seat a little) so they never rise past h
    const sx = i ? 1 : -1, p = pillow(0.42, 0.15, 0.42, 4);
    p.rotateX(PI / 2 - 0.5); p.rotateZ(sx * 0.12); p.rotateY(-sx * 0.3); p.computeBoundingBox();
    p.translate(sx * (inW / 2 - 0.24), Math.min(seatY + 0.2, H - 0.003 - p.boundingBox.max.y), z0 + backT + 0.2);
    kit.add(M.fabric(c, 1.6), p, uv);
  });
  const li = 0.07;
  legs(kit, legW, [[-W / 2 + li, z0 + li], [W / 2 - li, z0 + li], [-W / 2 + li, z1 - li], [W / 2 - li, z1 - li]], lh + 0.005, 0.022, 0.015, 12);
  return kit.into(new T.Group());
}
// Bed linen (owner, Nov 2026: hotel-style beds). clothMap lays a cloth over a box top (centre cx, half width hx, from
// z = zs for lenZ, and over the foot end too when foot is set), rolls it over the edges (radius r), lets it hang `hang`
// and turns it under by `lip` at the hem. It returns (su, sv) -> { p, n, tw }: su runs across from the centre, sv along
// from zs; n is the outward normal before the soft shaping (puff on top, a gentle rumple, folds toward the hem) and
// tw is 1 on the top, 0 on the sides.
const spread = (lo, hi, n) => Array.from({ length: n }, (_, i) => lo + (hi - lo) * i / n);
function clothMap(o) {
  const { cx, hx, zs, lenZ, top, r } = o, arc = PI * r / 2, foot = !!o.foot, ac = lenZ + arc + hx;
  const puff = o.puff ?? 0, rum = o.rumple ?? 0, fold = o.fold ?? 0, fh = o.hang;
  return (su, sv, hang = o.hang, lip = o.lip ?? 0) => {
    const wrap = e => {   // [offset out, drop, normal out, normal up] at distance e past the top edge
      if (e < arc) { const a = e / r; return [r * Math.sin(a), r * (1 - Math.cos(a)), Math.sin(a), Math.cos(a)]; }
      if (e < arc + hang) return [r, r + e - arc, 1, 0];
      return [r - Math.min(lip, e - arc - hang), r + hang, 1, 0];
    };
    const ax = Math.abs(su), sg = su < 0 ? -1 : 1, eX = ax - hx, eZ = foot ? sv - lenZ : -1;
    let x, z, w, dx = 0, dz = 0, along = 0;
    if (eX > 0 && eZ > 0) {   // rounded corner at the foot
      const d = Math.hypot(eX, eZ); w = wrap(d); dx = sg * eX / d; dz = eZ / d;
      x = cx + sg * hx + w[0] * dx; z = zs + lenZ + w[0] * dz; along = lenZ + Math.atan2(eZ, eX) * r;
    } else if (eX > 0) { w = wrap(eX); dx = sg; x = cx + sg * (hx + w[0]); z = zs + sv; along = sv; }
    else if (eZ > 0) { w = wrap(eZ); dz = 1; x = cx + su; z = zs + lenZ + w[0]; along = ac - ax; }
    else { w = [0, 0, 0, 1]; x = cx + su; z = zs + sv; }
    const drop = w[1], tw = Math.max(0, w[3]) ** 2;
    const fx = Math.min(1, Math.abs(x - cx) / hx), fz = foot ? Math.min(1, Math.max(0, (z - zs) / lenZ)) : 0;
    let y = top - drop + tw * (puff * (1 - fx ** 4) * (1 - fz ** 6) + rum * (Math.sin(x * 5.3 + 0.7) * Math.sin(z * 4.1 + 1.3) * 0.6 + Math.sin(x * 2.2 - z * 1.6 + 0.4) * 0.4));
    if (drop > 0 && fold) {   // soft folds growing toward the hem, mirrored about the middle of the foot so they meet smoothly
      const k = Math.min(1, Math.max(0, (drop - r * 0.5) / (fh + r * 0.5))) ** 1.1, q = along - ac;
      const f = fold * k * (Math.cos(q * 17) * 0.75 + Math.cos(q * 29) * 0.25);
      x += dx * f; z += dz * f; y += 0.0025 * k * Math.cos(q * 11);
    }
    return { p: [x, y, z], n: [dx * w[2], w[3], dz * w[2]], tw };
  };
}
// Sample distances past a cloth's top edge: dense round the roll, then down the hang and the turned-under hem.
function clothEdge(r, hang, lip, nA = 6, nH = 6) {
  const arc = PI * r / 2;
  return [...spread(0, arc, nA), ...spread(arc, arc + hang, nH), ...(lip > 0 ? spread(arc + hang, arc + hang + lip, 2) : []), arc + hang + lip];
}
// Samples right across a cloth (su): both hanging sides and nT steps over the top.
function clothU(hx, r, hang, lip, nT) {
  const e = clothEdge(r, hang, lip).map(v => hx + v);
  return [...e.slice().reverse().map(v => -v), ...spread(-hx, hx, nT).slice(1), ...e];
}
// Grid surface over sample lists us x vs (fn(su, sv) -> [x, y, z]), turned to face up / out.
const grid = (us, vs, fn) => faceUp(surface(us.length - 1, vs.length - 1, (u, v) => fn(us[Math.round(u * (us.length - 1))], vs[Math.round(v * (vs.length - 1))])));
// A layer lying on a cloth from sv a to b (tTop thick on top, tSide on the hanging sides, hanging `hang`). An end with a
// bead (ra at a, rb at b) rolls round and down onto the cloth, like a folded edge; its turned-under hem shrinks with it.
function clothLayer(map, us, a, b, tTop, tSide, hang, lip, ra, rb, nL = 10, nB = 6) {
  const rows = [];
  if (ra) for (let i = 0; i < nB; i++) rows.push([a, PI * (1 - i / nB), -1]);
  for (let i = 0; i <= nL; i++) rows.push([a + (b - a) * i / nL, 0, 0]);
  if (rb) for (let i = 1; i <= nB; i++) rows.push([b, PI * i / nB, 1]);
  return grid(us, rows, (su, [sv, ph, sz]) => {
    const q = map(su, sv, hang, lip * (1 + Math.cos(ph)) / 2), t = tSide + (tTop - tSide) * q.tw, k = t / 2 * (1 + Math.cos(ph)), dz = sz * t / 2 * Math.sin(ph);
    return [q.p[0] + q.n[0] * k, q.p[1] + q.n[1] * k, q.p[2] + q.n[2] * k + dz];
  });
}
// Upholstered headboard x0..x1, y0..y1, its back at zb, t deep, facing +z: a back board and a front of soft vertical
// channels (about chW wide) whose edge rolls round (radius rr) to the board. Sampled densely round the rim.
function tuftedHead(kit, mat, x0, x1, y0, y1, zb, t, chW = 0.15, uv = 0.15) {
  const rr = Math.min(0.032, t * 0.4), zf = zb + t, dep = Math.min(0.016, t * 0.2), per = 6, nr = 6;
  const n = Math.max(3, Math.round((x1 - x0) / chW)), cw = (x1 - x0) / n;
  const rim = Array.from({ length: nr }, (_, i) => rr * (1 - Math.cos(i / nr * PI / 2)));
  const axis = (a, b, inner) => [...rim.map(d => a + d), a + rr, ...inner.filter(v => v > a + rr + 0.004 && v < b - rr - 0.004), b - rr, ...rim.slice().reverse().map(d => b - d)];
  const X = axis(x0, x1, Array.from({ length: n * per + 1 }, (_, j) => x0 + j * cw / per));
  const ny = Math.max(8, Math.round((y1 - y0 - 2 * rr) / 0.045));
  const Y = axis(y0, y1, Array.from({ length: ny + 1 }, (_, j) => y0 + rr + j * (y1 - y0 - 2 * rr) / ny));
  kit.add(mat, rbox(x0 + 0.004, y0 + 0.004, zb, x1 - 0.004, y1 - 0.004, zf - rr + 0.002, 0.012, 2), uv);
  kit.add(mat, surface(X.length - 1, Y.length - 1, (u, v) => {
    const x = X[Math.round(u * (X.length - 1))], y = Y[Math.round(v * (Y.length - 1))];
    const q = Math.hypot(Math.max(0, rr - Math.min(x - x0, x1 - x)), Math.max(0, rr - Math.min(y - y0, y1 - y))), dd = Math.max(0, rr - q);
    const sa = Math.sqrt(Math.max(0, dd * (2 * rr - dd))) / rr, fr = ((x - x0) / cw) % 1, b = Math.pow(Math.max(0, Math.sin(PI * fr)), 0.5);
    return [x, y, zf - rr + rr * sa + sa * (0.005 * Math.sin(PI * (y - y0) / (y1 - y0)) - dep * (1 - b))];
  }), uv);   // surface() faces +z for x along u, y along v
}
// A plump pillow w wide, h tall and t thick in the middle, standing in the x-y plane facing +z: both faces domed,
// pinched to a seam round the edge, the sides drawn in a little between the corners, the ends curled back a touch.
function plump(w, h, t, edge = 0.14, nx = 16, ny = 12) {
  let g = new T.BoxGeometry(1, 1, 1, nx, ny, 2); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g, 1e-6);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) * 2, v = p.getY(i) * 2, s = p.getZ(i) * 2, au = Math.abs(u), av = Math.abs(v);
    const m = Math.max(au, av), k = Math.pow(au ** 5 + av ** 5, 0.2), sc = k > 1e-6 ? m / k : 1;   // square -> rounded outline
    const th = edge + (1 - edge) * Math.sqrt(Math.max(0, (1 - au ** 2.2) * (1 - av ** 2.2)));
    p.setXYZ(i, u * sc * (1 - 0.06 * (1 - v * v)) * w / 2, v * sc * (1 - 0.05 * (1 - u * u)) * h / 2, (s * th - 0.25 * u * u) * t / 2);
  }
  g.computeVertexNormals(); return g;
}
function buildBed(F, s, M) {
  // Hotel / showhouse bed (owner, Nov 2026; Japandi): a channel-tufted upholstered headboard, a light-oak platform on a
  // recessed plinth, a deep piped mattress, a flat sheet, a puffy duvet with its top turned down, a runner across the
  // foot, euro and sleeping pillows and an accent cushion. h is the duvet top.
  const kit = new Kit(), W = F.W, D = F.D, H = F.h >= 0.4 && F.h < 0.9 ? F.h : 0.55, z0 = -D / 2, z1 = D / 2;
  // headboard 0: the drawn wall headboard (a panel piece) stands behind the bed instead, so it has none of its own
  const hbH = s.headboard ?? (F.h >= 0.9 ? F.h : 1.1), hbT = hbH > 0 ? Math.min(0.09, Math.max(0.07, D * 0.042)) : 0.012;
  const fab = M.fabric(s.fabric ?? s.color ?? P.LINEN, 1.3), uv = 0.15, throwC = s.throw ?? P.SAND;   // headboard in a greige linen, so the white bedding reads apart from it
  const ds = (c, b) => M.get('fabDS' + c + b, () => { const m = M.fabric(c, b).clone(); m.side = T.DoubleSide; return M.hdFabric(m, b); });   // open cloth, seen from both sides
  let mx0 = -W / 2 + 0.03, mx1 = W / 2 - 0.03, mz0 = z0 + hbT + 0.01, mz1 = z1 - 0.03;
  if (s.mattress) { const m = toLocal(F, s.mattress); mx0 = m[0]; mx1 = m[2]; mz0 = Math.max(z0 + hbT + 0.008, m[1]); mz1 = m[3]; }
  const out = 0.03;   // the duvet, its turn-down and the runner sit up to 25 mm out from the mattress: keep that inside the footprint
  mx0 = Math.max(mx0, -W / 2 + out); mx1 = Math.min(mx1, W / 2 - out); mz1 = Math.min(mz1, z1 - out);
  const mThk = Math.min(0.28, Math.max(0.25, s.mattress_h ?? 0.26)), mTop = H - 0.035, baseTop = mTop - mThk, lh = Math.min(0.08, baseTop - 0.09);
  // headboard, then a light-oak platform set in under the mattress on a recessed dark plinth, so the bed reads as floating
  if (hbH > 0) tuftedHead(kit, fab, -W / 2 + 0.002, W / 2 - 0.002, 0.03, hbH, z0, hbT, 0.15, uv);
  const bx0 = mx0 + 0.02, bx1 = mx1 - 0.02, bz0 = z0 + Math.max(0.004, hbT - 0.03), bz1 = mz1 - 0.02, li = 0.13;
  kit.add(M.wood(s.wood ?? P.OAK, 0.5), rbox(bx0 - 0.03, lh, bz0, bx1 + 0.03, baseTop, bz1 + 0.02, 0.012, 2), 0.6);
  kit.add(M.paint(0x2E2B28, 0.8), box(bx0 + li - 0.05, 0, bz0 + li - 0.05, bx1 - li + 0.05, lh, bz1 - li + 0.05));
  // mattress, its bottom edge piped
  const rm = 0.035;
  kit.add(M.fabric(0xEEEAE3, 0.7), rbox(mx0, baseTop, mz0, mx1, mTop, mz1, rm, 3), uv);
  {
    const c = rm * 0.707, y = baseTop + rm * 0.293, pts = [], C = [[mx1 - rm, mz1 - rm], [mx0 + rm, mz1 - rm], [mx0 + rm, mz0 + rm], [mx1 - rm, mz0 + rm]];
    C.forEach(([qx, qz], i) => {
      for (let k = 0; k <= 4; k++) { const t = PI / 2 * (i + k / 4); pts.push(new T.Vector3(qx + c * Math.cos(t), y, qz + c * Math.sin(t))); }
      const [nx, nz] = C[(i + 1) % 4], t1 = PI / 2 * (i + 1), ax = qx + c * Math.cos(t1), az = qz + c * Math.sin(t1), bx = nx + c * Math.cos(t1), bz = nz + c * Math.sin(t1);
      for (let k = 1; k < 4; k++) pts.push(new T.Vector3(ax + (bx - ax) * k / 4, y, az + (bz - az) * k / 4));
    });
    kit.add(M.fabric(0xDCD5CA, 0.5), new T.TubeGeometry(new T.CatmullRomCurve3(pts, true, 'centripetal'), 120, 0.0032, 5, true), uv);
  }
  // flat sheet over the head end, tucked over the sides (4 mm off the mattress, round the same corner)
  const cx = (mx0 + mx1) / 2, hm = (mx1 - mx0) / 2, dz0 = mz0 + Math.min(0.7, (mz1 - mz0) * 0.37);   // dz0: the duvet's top edge
  const rS = rm + 0.004, hxS = hm + 0.004 - rS, lenS = dz0 - mz0 + 0.034;
  const sheet = clothMap({ cx, hx: hxS, zs: mz0 + 0.006, lenZ: lenS, top: mTop + 0.004, r: rS, hang: 0.055, rumple: 0.0015 });
  kit.add(ds(0xFBFAF7, 0.5), grid(clothU(hxS, rS, 0.055, 0, 20), [...spread(0, lenS, 10), lenS], (u, v) => sheet(u, v).p), uv);
  // duvet: soft and puffy on top, rolled over the sides and foot, hanging over the top of the base rail
  const rD = 0.034, tD = mTop + 0.018, hang = Math.max(0.12, tD - rD - (baseTop - 0.055)), lip = 0.016;
  const hxD = hm + 0.007 - rD, lenD = mz1 + 0.007 - rD - dz0;
  const duv = clothMap({ cx, hx: hxD, zs: dz0, lenZ: lenD, top: tD, r: rD, hang, lip, foot: true, puff: 0.016, rumple: 0.005, fold: 0.008 });
  const dMat = ds(s.duvet ?? P.DUVET, 0.7);
  kit.add(dMat, grid(clothU(hxD, rD, hang, lip, 30), [...spread(0, lenD, 24), ...clothEdge(rD, hang, lip).map(v => lenD + v)], (u, v) => duv(u, v).p), uv);
  // its top 0.3 m folded back over itself, the fold rolled round
  const hB = hang * 0.5;
  kit.add(dMat, clothLayer(duv, clothU(hxD, rD, hB, 0.011, 30), 0, Math.min(0.3, lenD * 0.3), 0.026, 0.009, hB, 0.011, true, false), uv);
  // folded runner across the foot, in the accent colour
  if (s.throw !== false) {
    const b = lenD - 0.12, a = Math.max(0.36, b - 0.46), hR = hang * 0.62;
    if (b > a + 0.1) kit.add(ds(throwC, 1.8), clothLayer(duv, clothU(hxD, rD, hR, 0.01, 30), a, b, 0.02, 0.008, hR, 0.01, true, true), uv);
  }
  // pillows: euro pillows standing against the headboard, sleeping pillows leaning on them, an accent cushion in front
  const pw = mx1 - mx0, np = pw > 1.25 ? 2 : 1, slot = (pw - 0.04) / np, yb = mTop - 0.008, zh = z0 + hbT + 0.008;
  const lim = (hbH > 0 ? hbH : s.backTop ?? H + 0.6) - 0.015;   // backTop: the top of the wall headboard behind
  const put = (g, x, z, tilt) => {   // lean back by tilt, stand on the sheet with the back at z; returns the depth
    g.rotateX(-tilt); g.computeBoundingBox(); const b = g.boundingBox;
    g.translate(x, Math.min(yb, lim - (b.max.y - b.min.y)) - b.min.y, z - b.min.z); return b.max.z - b.min.z;
  };
  const pEuro = M.fabric(s.pillow ?? P.OATMEAL, 0.8), pSleep = M.fabric(0xFAF8F4, 0.6);
  let zc = zh;
  for (let i = 0; i < np; i++) {
    const px = mx0 + 0.02 + slot * (i + 0.5);
    const e = plump(Math.min(0.62, slot - 0.04), Math.min(0.56, Math.max(0.36, lim - mTop - 0.06)), 0.17, 0.16), de = put(e, px, zh, 0.2);
    kit.add(pEuro, e, uv);
    const sp = plump(Math.min(0.7, slot - 0.01), 0.45, 0.15, 0.14), z2 = zh + de * 0.6, d2 = put(sp, px, z2, 0.62);
    kit.add(pSleep, sp, uv);
    zc = z2 + d2 * 0.6;
  }
  if (s.throw !== false) { const c = plump(0.46, 0.3, 0.12, 0.2, 12, 8); put(c, cx, zc, 0.55); kit.add(M.fabric(throwC, 1.8), c, uv); }
  return kit.into(new T.Group());
}
function drawerHandle(kit, mat, hx, hy, z, w = 0.12) {
  kit.add(mat, rod([hx - w / 2, hy, z + 0.022], [hx + w / 2, hy, z + 0.022], 0.0055, 10));
  for (const ex of [hx - w / 2 + 0.01, hx + w / 2 - 0.01]) kit.add(mat, rod([ex, hy, z], [ex, hy, z + 0.022], 0.0038, 8));
}
function buildBedside(F, s, M) {
  const kit = new Kit(), W = Math.min(F.W, 0.6), D = Math.min(F.D, 0.5), H = F.h >= 0.3 ? F.h : 0.5, z0 = -F.D / 2;
  const wd = M.wood(s.wood ?? s.color ?? P.OAK, 0.5), lh = 0.06, zf = z0 + D - 0.05;
  kit.add(wd, rbox(-W / 2, lh, z0, W / 2, H, zf, 0.006, 2), 0.6);
  kit.add(M.paint(0x2E2B28, 0.8), box(-W / 2 + 0.04, 0, z0 + 0.03, W / 2 - 0.04, lh, zf - 0.04));   // recessed plinth
  const g = 0.0025, mid = lh + (H - lh) * 0.5, handle = M.handle(s.handle);
  for (const [ya, yb] of [[lh + 0.012, mid - g], [mid + g, H - 0.02]]) {
    kit.add(wd, rbox(-W / 2 + 0.012, ya, zf, W / 2 - 0.012, yb, zf + 0.019, 0.003, 1), 0.6);
    drawerHandle(kit, handle, 0, (ya + yb) / 2 + 0.01, zf + 0.019, Math.min(0.12, W * 0.3));
  }
  const g2 = kit.into(new T.Group());
  if (s.lamp) { const l = buildLamp({ W: 0.3, D: 0.3, h: 0.42 }, { color: s.lampColor }, M); l.position.set(0, H, z0 + D / 2); g2.add(l); }
  return g2;
}
function buildLamp(F, s, M) {
  const kit = new Kit(), H = F.h >= 0.25 ? F.h : 0.42, Rm = Math.min(F.W ?? 0.3, F.D ?? 0.3) / 2;
  const sh = H * 0.42, base = H - sh - 0.03, br = Math.min(0.075, Rm * 0.5);
  // ceramic gourd base: the belly is a smooth spline (a few lathe rings showed as facets in the clearcoat)
  const belly = new T.SplineCurve([[br * 0.68, base * 0.04], [br * 0.95, base * 0.3], [br, base * 0.52], [br * 0.9, base * 0.75], [br * 0.5, base * 0.93], [br * 0.25, base]].map(([a, b]) => new T.Vector2(a, b)))
    .getPoints(22).map(v => [v.x, v.y]);
  const prof = [[0, 0], [br * 0.62, 0], ...belly, [br * 0.2, base + 0.001], [0, base + 0.002]];
  kit.add(M.paint(s.color ?? 0xE9E2D6, 0.8), lathe(prof, 40));   // matt stoneware
  kit.add(M.pull(), cyl(0.008, 0.012, H - sh * 0.6 - base, 12, 0, base, 0));
  kit.add(M.shade(), lathe([[Rm * 0.9, H - 0.002], [Rm * 0.99, H - sh]].reverse(), 40));
  kit.add(M.pull(), rod([-Rm * 0.8, H - sh * 0.2, 0], [Rm * 0.8, H - sh * 0.2, 0], 0.002, 6));
  return kit.into(new T.Group());
}
// A padded panel (w x h x d, centred): rounded-rectangle outline, its thickness easing to a soft edge (edge = how
// much of the thickness is kept at the rim). Finely divided, so it bends smoothly (see bend()).
function softPanel(w, h, d, edge = 0.4, nx = 24, ny = 10) {
  let g = new T.BoxGeometry(1, 1, 1, nx, ny, 2); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g, 1e-6);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) * 2, v = p.getY(i) * 2, t = p.getZ(i) * 2;
    const m = Math.max(Math.abs(u), Math.abs(v)), k = Math.pow(Math.abs(u) ** 6 + Math.abs(v) ** 6, 1 / 6), sc = k > 1e-6 ? m / k : 1;   // square -> rounded rectangle
    const pinch = edge + (1 - edge) * Math.sqrt(Math.max(0, 1 - Math.abs(u) ** 8)) * Math.sqrt(Math.max(0, 1 - Math.abs(v) ** 8));
    p.setXYZ(i, u * sc * w / 2, v * sc * h / 2, t * pinch * d / 2);
  }
  g.computeVertexNormals(); return g;
}
function buildChair(F, s, M) {
  // Premium dining chair and counter stool (owner, Nov 2026): a deep upholstered seat and a curved, upholstered back
  // in oatmeal boucle; Japandi: a woven cane back in a light-oak shell, on slim tapered light-oak legs.
  const kit = new Kit(), W = Math.min(F.W, 0.5), D = Math.min(F.D, 0.55), z0 = -D / 2, z1 = D / 2;
  const stool = !!s.stool, sh = s.seatH ?? s.seat_h ?? (stool ? 0.65 : 0.46), H = F.h >= 0.6 ? Math.min(F.h, stool ? sh + 0.3 : 0.86) : (stool ? sh + 0.3 : 0.84);
  const wd = M.wood(s.wood ?? P.OAK, 0.45), fab = s.leather ? M.leather(s.fabric ?? P.LEATHER) : M.fabric(s.fabric ?? s.color ?? P.BOUCLE, 1.4), uv = 0.15;
  // the back: a woven cane pad (upholstered when leather) bent round the sitter, a light-oak shell behind it, tilted back a little
  const back = (w, h, yc, zc, tilt, rad) => {
    const pad = bend(softPanel(w, h, 0.05, 0.4), rad); pad.rotateX(-tilt); pad.translate(0, yc, zc);
    kit.add(s.leather ? fab : M.cane(), pad, 0.1);   // woven cane back
    const shell = bend(softPanel(w + 0.012, h + 0.012, 0.016, 0.75).translate(0, 0, -0.03), rad); shell.rotateX(-tilt); shell.translate(0, yc, zc);
    kit.add(wd, shell, 0.5);
  };
  if (stool) {
    const sr = Math.min(W, D) / 2 - 0.02, lr = sr - 0.02;
    kit.add(fab, cushion(2 * sr, 0.07, 2 * sr, 0.03, 0.01, 0.005, 4).translate(0, sh - 0.035, 0.01), uv);
    kit.add(wd, rbox(-lr, sh - 0.1, -lr + 0.01, lr, sh - 0.07, lr + 0.01, 0.006, 2), 0.5);   // seat frame
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) kit.add(wd, rod([sx * (W / 2 - 0.02), 0.0035, sz * (D / 2 - 0.02)], [sx * lr * 0.85, sh - 0.08, sz * lr * 0.85 + 0.01], 0.011, 12, 0.016), { s: 0.5, vert: true });
    // slim black footrest, joined to the legs where they pass 24 cm up (each leg runs from the floor corner to under the seat;
    // the old blend ran the wrong way, so the frame floated off the legs: owner, Nov 2026 "this looks broken")
    const fy = 0.24, t = (fy - 0.0035) / (sh - 0.08 - 0.0035);
    const fx = (W / 2 - 0.02) * (1 - t) + lr * 0.85 * t, fz = (D / 2 - 0.02) * (1 - t) + lr * 0.85 * t, zo = 0.01 * t;
    const at = ([sx, sz]) => [sx * fx, fy, sz * fz + zo];
    for (const [a, b] of [[[-1, 1], [1, 1]], [[-1, -1], [1, -1]], [[-1, -1], [-1, 1]], [[1, -1], [1, 1]]]) kit.add(M.pull(), rod(at(a), at(b), 0.008, 8));
    if (H > sh + 0.12) {   // low curved back
      const bh = Math.min(0.17, H - sh - 0.1);
      back(2 * sr - 0.02, bh, H - bh / 2 - 0.01, z0 + 0.05, 0.12, 0.3);
      for (const sx of [-1, 1]) kit.add(wd, rod([sx * lr * 0.85, sh - 0.08, z0 + 0.05], [sx * (sr - 0.06), H - bh, z0 + 0.03], 0.011, 10));
    }
    return kit.into(new T.Group());
  }
  // dining chair
  const lx = W / 2 - 0.04, fz = z1 - 0.045, rz = z0 + 0.05;
  for (const sx of [-1, 1]) {
    kit.add(wd, rod([sx * (lx + 0.006), 0.004, fz + 0.006], [sx * lx, sh - 0.07, fz], 0.011, 12, 0.017), { s: 0.5, vert: true });       // front legs, tapering to the floor
    kit.add(wd, rod([sx * (lx + 0.01), 0.004, z0 + 0.022], [sx * lx, sh - 0.07, rz], 0.011, 12, 0.017), { s: 0.5, vert: true });        // rear legs, raked back
    kit.add(wd, rod([sx * (lx - 0.004), sh - 0.08, rz], [sx * (lx - 0.03), sh + 0.17, z0 + 0.036], 0.012, 10, 0.01));                    // posts up to the back
  }
  kit.add(wd, rbox(-lx - 0.014, sh - 0.105, rz - 0.014, lx + 0.014, sh - 0.065, fz + 0.014, 0.006, 2), 0.5);                            // seat frame
  kit.add(fab, cushion(W - 0.02, 0.08, D - 0.03, 0.032, 0.012, 0.006, 4).translate(0, sh - 0.032, (z0 + z1) / 2 + 0.006), uv);          // deep upholstered seat
  const bh = Math.min(0.32, H - sh - 0.08);
  back(W - 0.03, bh, H - bh / 2 - 0.01, z0 + 0.06, 0.14, 0.36);
  return kit.into(new T.Group());
}
function buildTaskChair(F, s, M, kit = new Kit(), at = [0, 0], rotY = 0) {
  const blk = M.dark(0x1D1D1D, 0.45), fab = M.fabric(s.fabric ?? P.OATMEAL, 1.2), ch = M.chrome(), parts = new Kit();
  const r = 0.3;
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * 2 * PI, ca = Math.cos(a), sa = Math.sin(a);
    parts.add(blk, rod([0, 0.1, 0], [ca * r, 0.075, sa * r], 0.018, 8, 0.012));
    parts.add(blk, cyl(0.022, 0.022, 0.03, 12, 0, 0, 0).rotateZ(PI / 2).rotateY(-a).translate(ca * (r - 0.01), 0.022, sa * (r - 0.01)));
    parts.add(blk, rod([ca * r, 0.075, sa * r], [ca * (r - 0.01), 0.04, sa * (r - 0.01)], 0.008, 6));
  }
  parts.add(blk, cyl(0.035, 0.04, 0.08, 16, 0, 0.07, 0));
  parts.add(ch, cyl(0.014, 0.014, 0.28, 12, 0, 0.14, 0));
  parts.add(blk, rbox(-0.12, 0.4, -0.12, 0.12, 0.43, 0.12, 0.01, 1));
  parts.add(fab, cushion(0.48, 0.075, 0.46, 0.035, 0.012, 0.006, 3).translate(0, 0.47, 0.01), 0.15);
  parts.add(blk, rbox(-0.03, 0.42, -0.26, 0.03, 0.6, -0.22, 0.01, 1));
  // shaped back: shoulders wider than the waist, rounded top, a forward lumbar bulge and a horizontal wrap
  // Built as an even grid (a subdivided box reshaped to the outline and pinched to a rounded seam), so the
  // lumbar curve and the wrap shade smoothly; an extruded shape showed its long cap triangles.
  const half = [[0, 0.17], [0.07, 0.2], [0.17, 0.192], [0.3, 0.205], [0.4, 0.222], [0.48, 0.218], [0.512, 0.204], [0.53, 0.18], [0.538, 0.15], [0.54, 0.11]];
  const hwAt = y => { for (let i = 1; i < half.length; i++) if (y <= half[i][0]) { const [y0, a] = half[i - 1], [y1, b] = half[i], t = (y - y0) / (y1 - y0); return a + (b - a) * (t * t * (3 - 2 * t)); } return half[half.length - 1][1]; };
  const BH = 0.54, BT = 0.05;
  let bk = new T.BoxGeometry(2, 1, BT, 18, 26, 2); bk.deleteAttribute('normal'); bk.deleteAttribute('uv'); bk = mergeVertices(bk, 1e-6);
  { const p = bk.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i), ny = Math.sin((p.getY(i) + 0.5) * PI / 2), y = ny * BH, z = p.getZ(i);   // rows bunch up toward the rounded top
      const pinch = 0.32 + 0.68 * Math.sqrt(Math.max(0, 1 - Math.abs(u) ** 5)) * Math.sqrt(Math.max(0, 1 - Math.abs(2 * ny - 1) ** 7));
      p.setXYZ(i, u * hwAt(y), y, z * pinch + 0.03 * Math.exp(-(((y - 0.16) / 0.11) ** 2)));   // lumbar bulge forward
    }
  }
  bk = bend(bk, 0.42); bk.computeVertexNormals();
  bk.rotateX(-0.1); bk.translate(0, 0.585, -0.244);
  parts.add(fab, bk, 0.15);
  for (const sx of [-1, 1]) {
    parts.add(blk, rod([sx * 0.2, 0.43, -0.04], [sx * 0.23, 0.64, -0.04], 0.012, 8));
    parts.add(blk, rbox(sx * 0.23 - 0.035, 0.64, -0.17, sx * 0.23 + 0.035, 0.665, 0.08, 0.01, 2));
  }
  for (const [mat, list] of parts.parts) for (const g of list) { g.rotateY(rotY); g.translate(at[0], 0, at[1]); (kit.parts.get(mat) || kit.parts.set(mat, []).get(mat)).push(g); }
  return kit;
}
function buildTable(F, s, M) {
  const kit = new Kit(), W = F.W, D = F.D, H = F.h >= 0.25 ? F.h : 0.76, round = s.round || F.kind === 'round';
  if (round) {
    const Rr = Math.min(W, D) / 2, stone = s.material === 'wood' ? M.wood(s.wood ?? P.OAK, 0.5) : M.stone(s.color ?? P.TRAVERTINE, 0.55), t = 0.035;
    const cu = { cyl: true, s: 0.6 };
    kit.add(stone, lathe([[0, H - t], [Rr - 0.012, H - t], [Rr - 0.002, H - t + 0.006], [Rr, H - t + 0.012], [Rr, H - 0.008], [Rr - 0.005, H - 0.001], [Rr - 0.012, H], [0, H]], 64), cu);
    const br = Rr * (s.pedestal ? 0.28 : 0.72);
    kit.add(stone, lathe([[br * 0.98, 0], [br, 0.006], [br * 0.97, (H - t) * 0.5], [br, H - t - 0.004], [br * 0.95, H - t]], 56), cu);
    if (s.pedestal) kit.add(stone, lathe([[0, 0], [Rr * 0.6, 0], [Rr * 0.6, 0.03], [br, 0.05]], 56), cu);
    return kit.into(new T.Group());
  }
  const wd = M.wood(s.wood ?? s.color ?? P.OAK, 0.5), t = 0.04, along = W >= D;
  const topM = s.stone ? M.stone(s.stoneColor ?? 0xE4DDD0, 0.28) : wd;   // stone top (sintered stone / travertine look) on the oak frame
  kit.add(topM, rbox(-W / 2, H - t, -D / 2, W / 2, H, D / 2, s.stone ? 0.004 : 0.008, 2), { s: 0.6, vert: !along });
  const li = Math.min(0.12, Math.min(W, D) * 0.1), lw = 0.06, legH = H - t;
  if (s.base === 'trestle') {
    for (const sx of [-1, 1]) {
      const x = sx * (W / 2 - 0.22);
      kit.add(wd, rbox(x - 0.04, 0, -D / 2 + 0.08, x + 0.04, 0.05, D / 2 - 0.08, 0.008, 1), 0.6);
      kit.add(wd, rbox(x - 0.03, 0.05, -0.05, x + 0.03, legH - 0.04, 0.05, 0.006, 1), { s: 0.6, vert: true });
      kit.add(wd, rbox(x - 0.035, legH - 0.04, -D / 2 + 0.1, x + 0.035, legH, D / 2 - 0.1, 0.006, 1), 0.6);
    }
    kit.add(wd, rbox(-W / 2 + 0.22, 0.2, -0.02, W / 2 - 0.22, 0.25, 0.02, 0.006, 1), 0.6);
  } else {
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const leg = flat(new T.CylinderGeometry(lw * 0.71, lw * 0.47, legH, 4, 1).rotateY(PI / 4)).translate(sx * (W / 2 - li), legH / 2, sz * (D / 2 - li));
      kit.add(wd, leg, { s: 0.6, vert: true });
    }
    const ah = 0.075, ai = li;
    kit.add(wd, rbox(-W / 2 + ai, legH - ah, -D / 2 + ai - 0.01, W / 2 - ai, legH, -D / 2 + ai + 0.01, 0.003, 1), 0.6);
    kit.add(wd, rbox(-W / 2 + ai, legH - ah, D / 2 - ai - 0.01, W / 2 - ai, legH, D / 2 - ai + 0.01, 0.003, 1), 0.6);
    kit.add(wd, rbox(-W / 2 + ai - 0.01, legH - ah, -D / 2 + ai, -W / 2 + ai + 0.01, legH, D / 2 - ai, 0.003, 1), 0.6);
    kit.add(wd, rbox(W / 2 - ai - 0.01, legH - ah, -D / 2 + ai, W / 2 - ai + 0.01, legH, D / 2 - ai, 0.003, 1), 0.6);
  }
  return kit.into(new T.Group());
}
function buildTVConsole(F, s, M) {
  const kit = new Kit(), W = F.W, D = Math.min(F.D, 0.5), H = F.h || 0.45, z0 = -F.D / 2, zf = z0 + D;
  const wd = M.wood(s.wood ?? s.color ?? P.OAK, 0.5), ph = 0.06;
  kit.add(M.paint(0x2A2725, 0.7), box(-W / 2 + 0.03, 0, z0 + 0.03, W / 2 - 0.03, ph, zf - 0.05));
  kit.add(wd, rbox(-W / 2, ph, z0, W / 2, H, zf - 0.02, 0.006, 2), 0.6);
  kit.add(M.dark(0x2A2420, 0.8), box(-W / 2 + 0.012, ph + 0.008, zf - 0.024, W / 2 - 0.012, H - 0.012, zf - 0.019));
  const doors = Math.max(2, Math.round(W / 0.6)), dw = (W - 0.024) / doors, sw = 0.026, gap = 0.006;
  for (let d = 0; d < doors; d++) {
    const xa = -W / 2 + 0.012 + d * dw + 0.002, xb = xa + dw - 0.004;
    const n = Math.max(3, Math.floor((xb - xa + gap) / (sw + gap))), w = (xb - xa - (n - 1) * gap) / n;
    for (let i = 0; i < n; i++) { const x = xa + i * (w + gap); kit.add(wd, box(x, ph + 0.012, zf - 0.02, x + w, H - 0.014, zf - 0.002), { s: 0.6, vert: true }); }
  }
  return kit.into(new T.Group());
}
function buildTV(F, s, M) {
  const kit = new Kit(), W = F.W, Dp = Math.min(F.D, 0.06), z0 = -F.D / 2;
  const standH = s.stand === 'pedestal' || s.stand === 'feet' ? 0.075 : 0, H = (F.h || 0.72) - standH, y0 = standH;
  const t = Math.min(0.028, Dp), zb = z0 + (F.D - t) / 2, zfr = zb + t;
  kit.add(M.metal(0x2B2C2E, 0.45, 0.6), rbox(-W / 2, y0, zb, W / 2, y0 + H, zfr, 0.004, 2));
  kit.add(M.screen(), new T.PlaneGeometry(W - 0.012, H - 0.012).translate(0, y0 + H / 2 + 0.002, zfr + 0.0006));
  kit.add(M.dark(0x161718, 0.5), rbox(-W / 2 + 0.003, y0 - 0.0015, zfr - 0.006, W / 2 - 0.003, y0 + 0.006, zfr + 0.0012, 0.0015, 1));
  if (standH) {
    const blk = M.metal(0x1F2022, 0.35, 0.7);
    if (s.stand === 'pedestal') {
      kit.add(blk, rbox(-0.03, 0.01, zb - 0.02, 0.03, y0 + H * 0.3, zb, 0.006, 1));
      kit.add(blk, rbox(-0.2, 0, Math.max(z0, zb - 0.1), 0.2, 0.012, Math.min(-z0, zb + 0.1), 0.006, 2));
    } else for (const sx of [-1, 1]) {
      kit.add(blk, rod([sx * (W / 2 - 0.1), y0 + 0.01, zb + t / 2], [sx * (W / 2 - 0.06), 0.005, zb + t / 2 - 0.08], 0.006, 8));
      kit.add(blk, rod([sx * (W / 2 - 0.1), y0 + 0.01, zb + t / 2], [sx * (W / 2 - 0.06), 0.005, zb + t / 2 + 0.06], 0.006, 8));
    }
  }
  return kit.into(new T.Group());
}
function buildTVStand(F, s, M) {
  // h is the whole stand (puck plus neck) up to the screen bottom, as in the JSON (console top to TV y0);
  // s.neck overrides the neck length and then h is the puck alone
  const kit = new Kit(), Rr = Math.min(F.W, F.D) / 2, blk = M.metal(0x1F2022, 0.35, 0.7);
  const tot = F.h || 0.08, puck = s.neck != null ? tot : Math.min(0.018, tot * 0.3), neck = s.neck ?? Math.max(0, tot - puck);
  kit.add(blk, lathe([[0, 0], [Rr, 0], [Rr, puck * 0.5], [Rr * 0.94, puck], [0, puck]], 40));
  if (neck > 0.002) kit.add(blk, rbox(-0.035, puck, -0.012, 0.035, puck + neck, 0.012, 0.008, 2));
  return kit.into(new T.Group());
}
function buildWardrobe(F, s, M) {
  const kit = new Kit(), W = F.W, D = F.D, H = F.h >= 1.5 ? F.h : 2.4, z0 = -D / 2, ph = 0.08;
  const wd = s.wood != null || s.color != null ? M.wood(s.wood ?? s.color, 0.5) : M.paint(s.paint ?? P.WARDROBE, 0.62), handle = M.handle(s.handle);
  const fz1 = D / 2 - 0.036, fz0 = fz1 - 0.019;
  kit.add(M.paint(0x2A2725, 0.7), box(-W / 2 + 0.01, 0, z0 + 0.02, W / 2 - 0.01, ph, fz0 - 0.03));
  kit.add(wd, box(-W / 2, ph, z0, W / 2, H, fz0), { s: 0.6, vert: true });
  const n = Math.max(2, Math.round(W / 0.5)), dw = W / n, g = 0.002, split = H > 2.25 ? 2.02 : null;
  for (let i = 0; i < n; i++) {
    const xa = -W / 2 + i * dw + g, xb = xa + dw - 2 * g;
    kit.add(wd, rbox(xa, ph + g, fz0, xb, (split ?? H) - g, fz1, 0.002, 1), { s: 0.6, vert: true });
    if (split) kit.add(wd, rbox(xa, split + g, fz0, xb, H - g, fz1, 0.002, 1), { s: 0.6, vert: true });
    const right = (i % 2 === 0) && i + 1 < n, hx = right ? xb - 0.04 : xa + 0.04;
    const a = 0.75, b = Math.min(1.65, (split ?? H) - 0.25);
    kit.add(handle, rod([hx, a, fz1 + 0.028], [hx, b, fz1 + 0.028], 0.0075, 12));
    for (const y of [a + 0.02, b - 0.02]) kit.add(handle, rod([hx, y, fz1], [hx, y, fz1 + 0.028], 0.0045, 8));
  }
  return kit.into(new T.Group());
}
function buildDesk(F, s, M) {
  const kit = new Kit(), W = F.W, D = F.D, H = F.h >= 0.6 ? F.h : 0.75, z0 = -D / 2, z1 = D / 2;
  const top = M.wood(s.wood ?? P.ASH, 0.5), body = M.wood(s.body ?? P.OAK, 0.5), handle = M.handle(s.handle), t = s.builtin ? 0.05 : 0.03;   // a built-in desk gets a thicker, solid-looking top
  kit.add(top, rbox(-W / 2, H - t, z0, W / 2, H, z1, 0.006, 2), 0.6);
  const pw = Math.min(0.42, W * 0.38);
  kit.add(body, rbox(-W / 2 + 0.01, 0, z0 + 0.01, -W / 2 + 0.035, H - t, z1 - 0.03, 0.004, 1), { s: 0.6, vert: true });   // side panel
  kit.add(body, rbox(W / 2 - pw, 0, z0 + 0.01, W / 2 - 0.01, H - t, z1 - 0.05, 0.004, 1), { s: 0.6, vert: true });       // drawer pedestal
  kit.add(body, box(-W / 2 + 0.035, H - t - 0.4, z0 + 0.02, W / 2 - pw, H - t, z0 + 0.038));                                 // modesty panel
  const g = 0.003, y1 = H - t - 0.01;
  const ds = [[0.0, 0.47], [0.47 + g, 0.74], [0.74 + g, 1]];   // deep file drawer at the bottom, shallow ones above
  for (const [a, b] of ds) {
    const ya = 0.02 + (y1 - 0.02) * a, yb = 0.02 + (y1 - 0.02) * b - g;
    kit.add(body, rbox(W / 2 - pw + 0.004, ya, z1 - 0.05, W / 2 - 0.014, yb, z1 - 0.031, 0.003, 1), 0.6);
    drawerHandle(kit, handle, W / 2 - pw / 2, yb - 0.04, z1 - 0.031, Math.min(0.12, pw * 0.35));
  }
  if (s.chair) buildTaskChair(F, s, M, kit, [-(pw / 2) * 0.5, z1 + 0.18], PI);
  const g2 = kit.into(new T.Group());
  if (s.lamp) { const l = buildLamp({ W: 0.24, D: 0.24, h: 0.36 }, { color: s.lampColor }, M); l.position.set(-W / 2 + 0.16, H, z0 + 0.16); g2.add(l); }
  return g2;
}
function buildRug(F, s, M) {
  const kit = new Kit(), W = F.W, D = F.D, H = Math.max(0.008, Math.min(0.03, F.h || 0.014));
  kit.add(M.rug(s.color ?? P.JUTE), rbox(-W / 2 + 0.05, 0, -D / 2 + 0.05, W / 2 - 0.05, H - 0.001, D / 2 - 0.05, H * 0.45, 1), 0.3);
  const b = M.rug(s.border ?? 0x6F6A62), bw = 0.05;
  for (const [x0, z0, x1, z1] of [[-W / 2, -D / 2, W / 2, -D / 2 + bw], [-W / 2, D / 2 - bw, W / 2, D / 2], [-W / 2, -D / 2 + bw, -W / 2 + bw, D / 2 - bw], [W / 2 - bw, -D / 2 + bw, W / 2, D / 2 - bw]])
    kit.add(b, rbox(x0, 0, z0, x1, H, z1, H * 0.48, 2), 0.3);
  return kit.into(new T.Group());
}
function buildPanel(F, s, M) {
  // the wall-mounted headboard behind a bed (the drawn one; the bed then has none of its own, owner, Nov 2026: "why got
  // double headboard"): the bed's rolled channel tufting in greige linen, its channels wide and calm (Japandi)
  const kit = new Kit(), W = F.W, D = F.D, H = F.h || 1.2;
  tuftedHead(kit, M.fabric(s.fabric ?? s.color ?? P.LINEN, 1.3), -W / 2 + 0.002, W / 2 - 0.002, 0.02, H, -D / 2, Math.min(D, 0.1) - 0.005, 0.3, 0.15);   // wider, calmer channels (the channel crown is 5 mm: kept inside D)
  return kit.into(new T.Group());
}
function buildDrain(F, s, M) {
  const kit = new Kit(), a = Math.min(0.14, F.W, F.D) / 2;
  // a 3 mm grate on the tile (proud enough not to z-fight with the floor); dark slots set into its face
  kit.add(M.steel(), rbox(-a, 0, -a, a, 0.003, a, 0.0012, 1), 0.3);
  for (let x = -a + 0.015; x < a - 0.012; x += 0.014) kit.add(M.dark(0x202020, 0.7), box(x, 0.0024, -a + 0.015, x + 0.006, 0.0032, a - 0.015));
  return kit.into(new T.Group());
}
function buildTank(F, s, M) {
  const kit = new Kit(), W = F.W, D = F.D, H = F.h || 0.8, m = M.paint(s.color ?? 0x8E989C, 0.6);
  const hb = Math.min(0.03, H * 0.1);   // inspection cap boss on top, kept inside h
  kit.add(m, rbox(-W / 2, 0, -D / 2, W / 2, H - hb, D / 2, 0.04, 3));
  for (let x = -W / 2 + 0.12; x < W / 2 - 0.08; x += 0.15) kit.add(m, rbox(x - 0.02, 0.06, D / 2 - 0.01, x + 0.02, H - hb - 0.06, D / 2 + 0.0, 0.01, 1));
  kit.add(M.dark(0x2A2A2A, 0.5), cyl(0.06, 0.06, hb, 24, W / 4, H - hb, 0));
  return kit.into(new T.Group());
}

const BUILDERS = {
  wc: buildWC, basin: buildBasin, vanity: buildVanity, shower: buildShower, bath: buildBath, sink: buildSink, hob: buildHob, fridge: buildFridge,
  counter: buildCounter, sofa: buildSofa, bed: buildBed, bedside: buildBedside, lamp: buildLamp, chair: buildChair, table: buildTable, round: buildTable,
  tv_console: buildTVConsole, tv: buildTV, tv_stand: buildTVStand, wardrobe: buildWardrobe, desk: buildDesk, rug: buildRug, panel: buildPanel,
  task_chair: (F, s, M) => buildTaskChair(F, s, M).into(new T.Group()), floor_trap: buildDrain, tank: buildTank,
};
export const KINDS = Object.keys(BUILDERS);

// Build a piece. Returns a THREE.Group placed at the footprint (position, rotation set), or null for unknown kinds.
// userData: { kind, triangles, drawCalls, W, D, side }.
export function makeFurniture(THREE, kind, spec = {}, ctx = {}) {
  T = THREE;
  const b = BUILDERS[kind]; if (!b) return null;
  const F = frame(spec, kind); F.kind = kind;
  const s = { ...spec };
  if (kind === 'chair' && spec.armchair) return makeFurniture(THREE, 'sofa', { ...spec, armchair: true }, ctx);
  const M = mats(ctx);
  const inner = b(F, s, M);
  const g = new T.Group(); g.add(inner);
  g.position.set(F.cx, F.y0, F.cz); g.rotation.y = F.theta;
  let tris = 0, calls = 0;
  g.traverse(o => { if (o.isMesh) { calls++; const geo = o.geometry; tris += (geo.index ? geo.index.count : geo.attributes.position.count) / 3; } });
  g.userData = { kind, triangles: tris, drawCalls: calls, W: F.W, D: F.D, side: F.side };
  g.name = 'furniture:' + kind;
  return g;
}
