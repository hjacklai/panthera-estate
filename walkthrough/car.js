// car.js - an unbranded modern family car (C-segment sedan or compact SUV), built entirely in code.
// buildCar(THREE, opts) -> THREE.Group. Origin: centre of the footprint at ground level, front toward +z, y up, metres.
// The body is a loft through cross-sections (plan taper, tumblehome, raked screens), the greenhouse a second
// loft split into glass, pillars and trim. Everything is merged into one mesh per material.
// opts.lod = 'mid': the same shape sampled coarsely, without the interior, shut lines and small parts (about 2k
// triangles, for the cars in the other porches and in the estate hero; the full car is about 57k).
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
const PI = Math.PI;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lin = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => a + (b - a) * i / n);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const addS = (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
// Monotone cubic through [x, y] pairs (no overshoot), clamped at the ends.
function curve(pts) {
  const n = pts.length, xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return x => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}
// Reference designs (metres). The result is scaled to the requested length, width and height.
const STYLES = {
  sedan: {
    L: 4.55, W: 1.80, H: 1.47,
    tipF: 2.275, tipR: -2.275, zf: 1.375, zr: -1.345, track: 0.772,
    tyre: { r: 0.326, w: 0.205, rim: 0.216 }, archR: 0.385,
    hw: 0.90, tuck: 0.05, inset: 0.105, yClad: 0.205, yFloor: 0.36,
    noseLen: 0.58, noseN: 2.5, tailLen: 0.46, tailN: 3.0,
    yTop: [[-2.275, 0.975], [-2.2, 1.02], [-2.05, 1.045], [-1.6, 1.045], [-1.0, 1.03], [0.0, 1.01], [0.93, 0.99], [1.3, 0.92], [1.8, 0.838], [2.1, 0.80], [2.275, 0.79]],
    yS: [[-2.275, 0.86], [-2.0, 0.90], [-1.5, 0.905], [-0.5, 0.885], [0.5, 0.86], [1.375, 0.80], [1.9, 0.715], [2.275, 0.655]],
    yBot: [[-2.275, 0.29], [-2.05, 0.24], [-1.75, 0.185], [-1.0, 0.16], [1.0, 0.16], [1.75, 0.175], [2.05, 0.2], [2.275, 0.24]],
    nU: [[-2.275, 3.0], [-1.6, 3.0], [-1.2, 3.3], [0.8, 3.3], [1.2, 3.0], [2.275, 3.0]],
    rakeF: y => y > 0.45 ? 0.15 * ((y - 0.45) / 0.30) ** 2 : 0.07 * ((0.45 - y) / 0.23) ** 2,
    rakeR: y => y > 0.6 ? 0.03 * ((y - 0.6) / 0.4) ** 2 : 0.10 * ((0.6 - y) / 0.32) ** 2,
    gh: {
      zc: 0.93, zG1: -1.60, zWs: 0.08, zRs: -0.80, tumble: 0.30, tA: 0.13, tC: 0.20,
      yC: [[-1.60, 1.025], [-1.45, 1.115], [-1.25, 1.235], [-1.0, 1.36], [-0.75, 1.44], [-0.45, 1.468], [-0.2, 1.466], [0.08, 1.415], [0.4, 1.285], [0.7, 1.125], [0.93, 0.98]],
      crown: [[-1.6, 0.05], [-0.8, 0.06], [0.08, 0.06], [0.93, 0.075]],
      zRw: [-1.36, -1.13], pillars: [[-0.41, -0.30], [-1.115, -1.09]]
    },
    doors: { f: 0.95, b: -0.355, r: -1.10, sill: 0.275 },
    front: { hl: [0.34, 0.90, 0.12, 0.05], ug: 0.058, grille: [0.255, 0.55, 0.33, 0.43], plate: 0.39, vent: [0.64, 0.82, 0.275, 0.45], lip: 0.245 },
    rear: { lampTop: 0.935, bar: 0.032, cluster: 0.095, sBar: 0.46, s1: 1.06, plate: 0.555, bumper: 0.70, refl: 0.36, diff: 0.33 },
    mirror: [0.115, 0.063, 0.055], antenna: 0.12
  },
  suv: {
    L: 4.55, W: 1.84, H: 1.66,
    tipF: 2.275, tipR: -2.275, zf: 1.37, zr: -1.31, track: 0.79,
    tyre: { r: 0.362, w: 0.225, rim: 0.2286 }, archR: 0.43,
    hw: 0.92, tuck: 0.045, inset: 0.115, yClad: 0.36, yFloor: 0.47,
    noseLen: 0.56, noseN: 2.4, tailLen: 0.40, tailN: 3.4,
    yTop: [[-2.275, 1.03], [-2.2, 1.09], [-2.05, 1.12], [-1.0, 1.115], [0.0, 1.095], [0.88, 1.075], [1.3, 1.02], [1.8, 0.958], [2.1, 0.925], [2.275, 0.915]],
    yS: [[-2.275, 0.95], [-2.0, 0.99], [-1.0, 0.985], [0.5, 0.96], [1.37, 0.915], [1.9, 0.845], [2.275, 0.80]],
    yBot: [[-2.275, 0.35], [-2.05, 0.30], [-1.75, 0.245], [-1.0, 0.205], [1.0, 0.205], [1.75, 0.23], [2.05, 0.26], [2.275, 0.30]],
    nU: [[-2.275, 3.0], [-1.2, 3.4], [0.8, 3.4], [1.2, 2.6], [2.275, 2.5]],
    rakeF: y => y > 0.55 ? 0.12 * ((y - 0.55) / 0.32) ** 2 : 0.07 * ((0.55 - y) / 0.25) ** 2,
    rakeR: y => y > 0.7 ? 0 : 0.09 * ((0.7 - y) / 0.35) ** 2,
    gh: {
      zc: 0.88, zG1: -2.15, zWs: 0.02, zRs: -1.86, tumble: 0.26, tA: 0.12, tC: 0.05,
      yC: [[-2.15, 1.10], [-2.07, 1.28], [-1.97, 1.46], [-1.86, 1.59], [-1.65, 1.643], [-1.0, 1.66], [-0.3, 1.66], [0.02, 1.615], [0.35, 1.44], [0.65, 1.255], [0.88, 1.08]],
      crown: [[-2.15, 0.04], [-1.86, 0.05], [0.02, 0.05], [0.88, 0.07]],
      zRw: [-1.97, -1.80], pillars: [[-0.415, -0.305], [-1.265, -1.24]]
    },
    doors: { f: 0.90, b: -0.36, r: -1.25, sill: 0 },
    front: { hl: [0.38, 0.92, 0.10, 0.045], ug: 0.07, grille: [0.372, 0.68, 0.37, 0.46], plate: 0.51, vent: [0.66, 0.86, 0.38, 0.58], lip: 0.36, skid: [0.29, 0.345] },
    rear: { lampTop: 1.035, bar: 0.03, cluster: 0.11, sBar: 0.46, s1: 1.04, plate: 0.84, bumper: 0.72, refl: 0.47, diff: 0.40, skid: [0.345, 0.385] },
    mirror: [0.125, 0.07, 0.06], antenna: 0.13
  }
};
export function buildCar(THREE, opts = {}) {
  const style = opts.style === 'suv' ? 'suv' : 'sedan';
  const P = STYLES[style], G = P.gh;
  const Lm = opts.length ?? 4.55, Wm = opts.width ?? (style === 'suv' ? 1.84 : 1.80), Hm = opts.height ?? (style === 'suv' ? 1.66 : 1.47);
  const lights = !!opts.lights, MID = opts.lod === 'mid';
  const res = n => (MID ? Math.max(1, Math.round(n / 4)) : n);   // fewer samples along a patch at mid detail
  const cy = P.tyre.r - 0.006;   // a few mm of tyre squash at the contact patch
  // ---------- materials ----------
  const color = new THREE.Color(opts.color ?? 0xE9E9E6);
  const lum = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
  const metallic = opts.metallic ?? lum < 0.6;
  const Std = o => new THREE.MeshStandardMaterial(o), Phy = o => new THREE.MeshPhysicalMaterial(o);
  const mats = {
    paint: Phy({ color, metalness: metallic ? 0.6 : 0.0, roughness: metallic ? 0.3 : 0.3, clearcoat: 1, clearcoatRoughness: 0.05 }),
    // mid detail has no cabin inside: its glass is a solid dark tint
    glass: Phy({ color: 0x080b0e, metalness: 0, roughness: 0.02, transparent: !MID, opacity: MID ? 1 : 0.86, depthWrite: MID, envMapIntensity: 0.4 }),
    trim: Phy({ color: 0x0b0c0d, metalness: 0, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.35 }),
    plastic: Std({ color: 0x151617, roughness: 0.78 }),
    chrome: Std({ color: 0xe6e9ec, metalness: 1, roughness: 0.1 }),
    tyre: Std({ color: 0x1f1f21, roughness: 0.84 }),
    rim: Std({ color: 0xd2d5d8, metalness: 1, roughness: 0.2 }),
    rimDark: Std({ color: 0x2e3135, metalness: 0.7, roughness: 0.38 }),
    disc: Std({ color: 0x75777a, metalness: 0.9, roughness: 0.42 }),
    caliper: Std({ color: 0x8b8f94, metalness: 0.5, roughness: 0.35 }),
    lens: Phy({ color: 0xffffff, metalness: 0, roughness: 0.0, transparent: true, opacity: 0.22, depthWrite: false, clearcoat: 1, envMapIntensity: 1.6 }),
    drl: Std({ color: 0xf2f5f8, roughness: 0.25, emissive: 0xf4f8ff, emissiveIntensity: lights ? 3.0 : 0 }),
    tailLens: Phy({ color: 0x9a0c12, metalness: 0, roughness: 0.08, transparent: true, opacity: 0.82, depthWrite: false, clearcoat: 1, emissive: 0xff1018, emissiveIntensity: lights ? 0.9 : 0 }),
    tailLed: Std({ color: 0x6a0408, roughness: 0.3, emissive: 0xff1a1a, emissiveIntensity: lights ? 4.0 : 0.0 }),
    amber: Std({ color: 0xd9861c, roughness: 0.25, emissive: 0xff8a00, emissiveIntensity: 0 }),
    interior: Std({ color: 0x1a1b1d, roughness: 0.9 }),
    seat: Std({ color: 0x2b2c2f, roughness: 0.85 })
  };
  if (MID) {   // five plain materials at mid detail: paint, glass, dark trim (tyres too), silver (rims, lamps), red tail lamps
    Object.assign(mats, {
      glass: Std({ color: 0x0b0e11, metalness: 0.2, roughness: 0.08, envMapIntensity: 0.6 }),
      trim: Std({ color: 0x141516, roughness: 0.6 }),
      rim: Std({ color: 0xcfd2d5, metalness: 0.6, roughness: 0.3 }),
      tailLens: Std({ color: 0x8a0c12, roughness: 0.3 }),
    });
  }
  if (opts.envMap) for (const m of Object.values(mats)) m.envMap = opts.envMap;
  // ---------- geometry bins and helpers ----------
  const bins = {};
  const put = (k, g) => { (bins[k] ||= []).push(g); return g; };
  const indexed = g => { if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]); return g; };
  const mirror = g => {
    const m = indexed(g.clone()), p = m.attributes.position, n = m.attributes.normal, ix = m.index.array;
    for (let i = 0; i < p.count; i++) { p.setX(i, -p.getX(i)); n.setX(i, -n.getX(i)); }
    for (let t = 0; t < ix.length; t += 3) { const x = ix[t + 1]; ix[t + 1] = ix[t + 2]; ix[t + 2] = x; }
    return m;
  };
  const putSym = (k, g) => { put(k, g); put(k, mirror(g)); return g; };
  function gridGeo(U, V, fn) {   // U: column params, V: row params; fn(u, v) -> [x, y, z]
    const nu = U.length, nv = V.length, pos = new Float32Array(nu * nv * 3); let k = 0;
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const p = fn(U[i], V[j]); pos[k++] = p[0]; pos[k++] = p[1]; pos[k++] = p[2]; }
    const idx = [];
    for (let j = 0; j < nv - 1; j++) for (let i = 0; i < nu - 1; i++) { const a = j * nu + i, b = a + 1, c = a + nu, d = c + 1; idx.push(a, b, d, a, d, c); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  function orient(g, ref) {      // flip the winding when the area-weighted normal disagrees with ref(x, y, z)
    const p = g.attributes.position.array, ix = g.index.array; let s = 0;
    for (let t = 0; t < ix.length; t += 3) {
      const a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3;
      const n = cross([p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]], [p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]]);
      const r = ref((p[a] + p[b] + p[c]) / 3, (p[a + 1] + p[b + 1] + p[c + 1]) / 3, (p[a + 2] + p[b + 2] + p[c + 2]) / 3);
      s += n[0] * r[0] + n[1] * r[1] + n[2] * r[2];
    }
    if (s < 0) { for (let t = 0; t < ix.length; t += 3) { const x = ix[t + 1]; ix[t + 1] = ix[t + 2]; ix[t + 2] = x; } g.computeVertexNormals(); }
    return g;
  }
  const patch = (U, V, fn, ref) => orient(gridGeo(U, V, fn), ref);
  function innerCopy(g, d) {     // inward offset, reversed: the inside face of an opaque panel
    const m = g.clone(), p = m.attributes.position, n = m.attributes.normal, ix = m.index.array;
    for (let i = 0; i < p.count; i++) {
      p.setXYZ(i, p.getX(i) - n.getX(i) * d, p.getY(i) - n.getY(i) * d, p.getZ(i) - n.getZ(i) * d);
      n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
    }
    for (let t = 0; t < ix.length; t += 3) { const x = ix[t + 1]; ix[t + 1] = ix[t + 2]; ix[t + 2] = x; }
    return m;
  }
  const prim = (k, geo, mtx, sym = false) => { indexed(geo); if (mtx) geo.applyMatrix4(mtx); return sym ? putSym(k, geo) : put(k, geo); };
  const M4 = () => new THREE.Matrix4();
  const basisAt = (p, n, up = [0, 1, 0]) => {   // local x = surface normal, local y = up projected onto the surface
    const X = new THREE.Vector3(...n).normalize(), U = new THREE.Vector3(...up);
    const Y = U.sub(X.clone().multiplyScalar(U.dot(X))).normalize(), Z = new THREE.Vector3().crossVectors(X, Y);
    return M4().makeBasis(X, Y, Z).setPosition(p[0], p[1], p[2]);
  };
  const refBody = (x, y, z) => [x, y - 0.55, z * 0.5];
  // ---------- lower body: sections along z ----------
  const fTop = curve(P.yTop), fS = curve(P.yS), fBot = curve(P.yBot), fN = curve(P.nU);
  const zN0 = P.tipF - P.noseLen, zT0 = P.tipR + P.tailLen;
  const plan = zs => {
    let t, n;
    if (zs > zN0) { t = (zs - zN0) / P.noseLen; n = P.noseN; } else if (zs < zT0) { t = (zT0 - zs) / P.tailLen; n = P.tailN; } else return 1;
    t = clamp(t, 0, 1); return Math.pow(Math.max(0, 1 - Math.pow(t, n)), 1 / n);
  };
  const hwAt = zs => { let b = 0; for (const zw of [P.zf, P.zr]) b += Math.exp(-(((zs - zw) / 0.55) ** 2)); return P.hw * (0.982 + 0.018 * Math.min(1, b)) * plan(zs); };
  const sec = zs => ({ hw: hwAt(zs), yT: fTop(zs), yS: fS(zs), yB: fBot(zs), n: fN(zs) });
  const arches = [P.zf, P.zr];
  const yLow = zs => { let y = fBot(zs); for (const zw of arches) { const dz = zs - zw; if (Math.abs(dz) < P.archR) y = Math.max(y, cy + Math.sqrt(P.archR ** 2 - dz * dz)); } return y; };
  const zOff = (y, zs) => {
    let o = 0; const wf = sstep(P.tipF - 0.62, P.tipF, zs), wr = sstep(P.tipR + 0.52, P.tipR, zs);
    if (wf) o -= wf * P.rakeF(y); if (wr) o += wr * P.rakeR(y); return o;
  };
  const sideX = (y, S) => {
    if (y >= S.yS) {
      const q = clamp((y - S.yS) / (S.yT - S.yS), 0, 1), s = Math.pow(q, S.n / 2), c = Math.sqrt(Math.max(0, 1 - s * s));
      return S.hw * Math.pow(c, 2 / S.n);
    }
    const u = clamp((S.yS - y) / (S.yS - S.yB), 0, 1), r = Math.max(0, 1 - (y - S.yB) / 0.08);
    const ridge = 0.0045 * Math.exp(-(((y - (S.yS - 0.115)) / 0.018) ** 2));   // a soft feature line along the doors
    return S.hw * (1 - P.tuck * Math.pow(u, 2.2) - 0.05 * r * r + ridge);
  };
  const arcP = (th, S) => [S.hw * Math.pow(Math.max(0, Math.cos(th)), 2 / S.n), S.yS + (S.yT - S.yS) * Math.pow(Math.max(0, Math.sin(th)), 2 / S.n)];
  const topY = (x, S) => { if (x >= S.hw) return S.yS; const c = Math.pow(x / S.hw, S.n / 2), s = Math.sqrt(Math.max(0, 1 - c * c)); return S.yS + (S.yT - S.yS) * Math.pow(s, 2 / S.n); };
  const thetaOf = (x, S) => S.hw <= 1e-6 ? PI / 2 : Math.acos(clamp(Math.pow(clamp(x / S.hw, 0, 1), S.n / 2), 0, 1));
  const bodyP = (y, zs) => { const S = sec(zs); return [sideX(y, S), y, zs + zOff(y, zs)]; };
  const bodyN = (y, zs) => {
    const e = 0.003, z1 = Math.min(zs + e, P.tipF), z0 = Math.max(zs - e, P.tipR);
    return norm(cross(sub(bodyP(y + e, zs), bodyP(y - e, zs)), sub(bodyP(y, z1), bodyP(y, z0))));
  };
  const onBody = (y, zs, off = 0) => addS(bodyP(y, zs), bodyN(y, zs), off);
  const topP = (xf, zs) => { const S = sec(zs), x = xf * S.hw, y = topY(x, S); return [x, y, zs + zOff(y, zs)]; };
  const topN = (xf, zs) => { const e = 0.003; const n = norm(cross(sub(topP(xf, zs + e), topP(xf, zs - e)), sub(topP(xf + e, zs), topP(xf - e, zs)))); return n[1] < 0 ? [-n[0], -n[1], -n[2]] : n; };
  // z stations: superellipse spacing at the ends, dense around the wheel arches.
  const Z = (() => {
    const s = [];
    const nN = MID ? 4 : 30, nT = MID ? 3 : 22, nA = MID ? 4 : 18;
    for (let k = 0; k <= nN; k++) s.push(zN0 + P.noseLen * Math.pow(Math.sin(k / nN * PI / 2), 2 / P.noseN));
    for (let k = 0; k <= nT; k++) s.push(zT0 - P.tailLen * Math.pow(Math.sin(k / nT * PI / 2), 2 / P.tailN));
    for (let z = zT0; z < zN0; z += MID ? 0.55 : 0.095) s.push(z);
    for (const zw of arches) { for (let k = 0; k <= nA; k++) s.push(zw + P.archR * Math.cos(PI * k / nA)); for (const d of MID ? [0.03] : [-0.003, 0.003, 0.03]) { s.push(zw + P.archR + d); s.push(zw - P.archR - d); } }
    const keep = [G.zc, G.zG1, P.tipF, P.tipR];   // exact stations; never dropped by the de-duplication
    const r = s.filter(z => z > P.tipR && z < P.tipF && keep.every(k => Math.abs(z - k) > 0.0015)).concat(keep).sort((a, b) => a - b);
    return r.filter((z, i) => i === 0 || z - r[i - 1] > (MID ? 0.02 : 0.0004));
  })();
  const ZF = Z.filter(z => z >= G.zc - 1e-6), ZC = Z.filter(z => z <= G.zc + 1e-6 && z >= G.zG1 - 1e-6), ZR = Z.filter(z => z <= G.zG1 + 1e-6);
  const K1 = MID ? 2 : 7, K2 = MID ? 3 : 9, K3 = MID ? 4 : 12, K4 = MID ? 2 : 3;
  const th0 = S => thetaOf(Math.max(0, S.hw - P.inset), S);
  // bonnet / deck centre, then the shoulder band
  const t1 = (u, zs) => { const S = sec(zs), [x, y] = arcP(lerp(PI / 2, th0(S), u), S); return [x, y, zs + zOff(y, zs)]; };
  putSym('paint', patch(lin(0, 1, K1 - 1), ZF, t1, refBody));
  putSym('paint', patch(lin(0, 1, K1 - 1), ZR, t1, refBody));
  putSym('paint', patch(lin(0, 1, K2 - 1), Z, (u, zs) => { const S = sec(zs), [x, y] = arcP(th0(S) * (1 - u), S); return [x, y, zs + zOff(y, zs)]; }, refBody));
  // cabin tub inside the greenhouse: floor, door trims, dash and parcel shelf walls
  const tubD = zs => sstep(G.zc, G.zc - 0.10, zs) * sstep(G.zG1, G.zG1 + 0.10, zs);
  if (!MID) putSym('interior', patch(lin(0, 1, K1 - 1), ZC, (u, zs) => {
    const S = sec(zs), xs = Math.max(0, S.hw - P.inset), [ax, ay] = arcP(lerp(PI / 2, th0(S), u), S), ys = topY(xs, S), k = Math.round(u * (K1 - 1));
    let tx, ty;
    if (k <= K1 - 4) { tx = (xs - 0.15) * k / (K1 - 4); ty = P.yFloor; } else if (k === K1 - 3) { tx = xs - 0.13; ty = P.yFloor + 0.16; } else if (k === K1 - 2) { tx = xs - 0.09; ty = ys - 0.05; } else { tx = xs; ty = ys; }
    const d = tubD(zs); return [lerp(ax, tx, d), lerp(ay, ty, d), zs];
  }, (x, y) => [-x, 1, 0]));
  // body side, then the black lower edge
  putSym('paint', patch(lin(0, 1, K3 - 1), Z, (u, zs) => {
    const S = sec(zs), y1 = Math.min(Math.max(yLow(zs), P.yClad), S.yS - 0.005), y = lerp(S.yS, y1, Math.pow(u, 0.9));
    return [sideX(y, S), y, zs + zOff(y, zs)];
  }, refBody));
  putSym('plastic', patch(lin(0, 1, K4 - 1), Z, (u, zs) => {
    const S = sec(zs), yl = yLow(zs), y0 = Math.min(Math.max(yl, P.yClad), S.yS - 0.005), y = lerp(y0, Math.min(yl, y0), u);
    return [sideX(y, S), y, zs + zOff(y, zs)];
  }, refBody));
  // underbody (not at mid detail: never seen from above)
  const wIn = P.track - P.tyre.w / 2 - 0.035;
  if (!MID) put('plastic', patch([0, 1], Z, (u, zs) => {
    const S = sec(zs); let x = Math.max(0, sideX(S.yB + 0.002, S) - 0.004);
    for (const zw of arches) if (Math.abs(zs - zw) < P.archR + 0.03) x = Math.min(x, wIn);
    return [lerp(-x, x, u), S.yB + 0.003, zs + zOff(S.yB, zs)];
  }, () => [0, -1, 0]));
  // wheel arch liners
  if (!MID) for (const zw of arches) {
    const R = P.archR + 0.006, xE = (y, z) => sideX(clamp(y, fBot(z), fS(z) - 0.01), sec(z)) + 0.001;
    putSym('plastic', patch(lin(0, 1, MID ? 1 : 3), lin(-0.3, PI + 0.3, MID ? 8 : 24), (u, a) => { const y = cy + R * Math.sin(a), z = zw + R * Math.cos(a); return [lerp(wIn, xE(y, z), u), y, z]; }, (x, y, z) => [0, cy - y, zw - z]));
    putSym('plastic', patch(lin(0, R, MID ? 1 : 2), lin(-0.3, PI + 0.3, MID ? 8 : 20), (r, a) => [wIn, cy + r * Math.sin(a), zw + r * Math.cos(a)], () => [1, 0, 0]));
  }
  // ---------- greenhouse ----------
  const fC = curve(G.yC), fCr = curve(G.crown);
  const gh = z => {
    const S = sec(z), xB = Math.max(0.05, S.hw - P.inset), yB = topY(xB, S) - 0.004, yC = fC(z);
    const crown = Math.min(fCr(z), Math.max(0, yC - yB)), yR = yC - crown, h = Math.max(0, yR - yB);
    return { xB, yB, xR: xB - G.tumble * h - 0.035 * sstep(G.zc, G.zWs, z), yR, yC, crown, h };
  };
  const sideSeg = (s, z) => { const g = gh(z), bow = 0.012 * Math.sin(PI * s) * Math.min(1, g.h / 0.12); return [lerp(g.xB, g.xR, s) + bow, lerp(g.yB, g.yR, s), z]; };
  const topSeg = (t, z) => { const g = gh(z); return [g.xR * (1 - t), g.yR + g.crown * (1 - Math.pow(1 - t, 2.2)), z]; };
  const segN = (f, a, z) => {
    const e = 0.002, n = cross(sub(f(Math.min(1, a + e), z), f(Math.max(0, a - e), z)), sub(f(a, z + e), f(a, z - e)));
    if (Math.hypot(...n) < 1e-10) return f === sideSeg ? [1, 0, 0] : [0, 1, 0];
    const m = norm(n), p = f(a, z); return m[0] * p[0] + m[1] * (p[1] - 0.9) < 0 ? [-m[0], -m[1], -m[2]] : m;
  };
  const refGh = (x, y) => [x, y - 0.9, 0];
  // region of a greenhouse segment: a in [a0, a1], z between zA(a) and zB(a); off along the surface normal
  function ghRegion(k, f, a0, a1, zA, zB, off = 0, na = 6, inner = null) {
    const nz = Math.max(MID ? 1 : 2, Math.round(Math.abs(zB((a0 + a1) / 2) - zA((a0 + a1) / 2)) / (MID ? 0.3 : 0.045)) + 1);
    if (MID) { na = Math.min(na, 2); inner = null; }
    const g = patch(lin(0, 1, na), lin(0, 1, nz), (u, v) => {
      const a = lerp(a0, a1, u), z = lerp(zA(a), zB(a), v), p = f(a, z);
      return off ? addS(p, segN(f, a, z), off) : p;
    }, refGh);
    putSym(k, g); if (inner) putSym(inner, innerCopy(g, 0.012));
  }
  const C = v => () => v;
  const zRw = s => lerp(G.zRw[0], G.zRw[1], s), zf = s => G.zc - 0.05 - 0.22 * Math.pow(1 - s, 1.2);
  const sLo = 0.07, sHi = 0.90;
  if (!MID) ghRegion('chrome', sideSeg, 0, 0.022, s => zRw(s) - 0.025, C(G.zc), 0, 1);
  ghRegion('trim', sideSeg, 0.022, sLo, s => zRw(s) - 0.025, C(G.zc), 0, 1);
  ghRegion('trim', sideSeg, sHi, 1, s => zRw(s) - 0.025, C(G.zc), 0, 2);
  ghRegion('trim', sideSeg, sLo, sHi, zf, C(G.zc), 0, 6, 'interior');
  ghRegion('trim', sideSeg, sLo, sHi, s => zRw(s) - 0.025, zRw, 0, 6);
  const cuts = G.pillars.slice().sort((a, b) => b[0] - a[0]);
  for (const [p0, p1] of cuts) ghRegion('trim', sideSeg, sLo, sHi, s => Math.max(p0, zRw(s)), s => Math.max(p1, zRw(s)), 0, 6, 'interior');
  let front = zf;
  for (const [p0, p1] of cuts) { const f0 = front; ghRegion('glass', sideSeg, sLo, sHi, s => Math.max(p1, zRw(s)), s => Math.max(f0(s), zRw(s)), -0.004, 6); front = () => p0; }
  { const f0 = front; ghRegion('glass', sideSeg, sLo, sHi, zRw, s => Math.max(f0(s), zRw(s)), -0.004, 6); }
  ghRegion('paint', sideSeg, 0, 1, C(G.zG1), s => zRw(s) - 0.025, 0, 8, 'interior');
  // top: A-pillars, windscreen, roof, C-pillars, rear screen
  const tF = G.tA + 0.035, tR = G.tC + 0.03;
  ghRegion('paint', topSeg, 0, G.tA, C(G.zWs), C(G.zc), 0, 3, 'interior');
  ghRegion('trim', topSeg, G.tA, tF, C(G.zWs), C(G.zc), 0, 1);
  ghRegion('trim', topSeg, tF, 1, C(G.zWs), C(G.zWs + 0.065), 0, 12);
  ghRegion('trim', topSeg, tF, 1, C(G.zc - 0.05), C(G.zc), 0, 12);
  ghRegion('glass', topSeg, tF, 1, C(G.zWs + 0.065), C(G.zc - 0.05), -0.003, 14);
  ghRegion('paint', topSeg, 0, 1, C(G.zRs), C(G.zWs), 0, 14, 'seat');
  if (G.tC > 0.001) ghRegion('paint', topSeg, 0, G.tC, C(G.zG1), C(G.zRs), 0, 3, 'interior');
  ghRegion('trim', topSeg, G.tC, tR, C(G.zG1), C(G.zRs), 0, 1);
  ghRegion('trim', topSeg, tR, 1, C(G.zRs - 0.05), C(G.zRs), 0, 12);
  ghRegion('trim', topSeg, tR, 1, C(G.zG1), C(G.zG1 + 0.045), 0, 12);
  ghRegion('glass', topSeg, tR, 1, C(G.zG1 + 0.045), C(G.zRs - 0.05), -0.003, 14);
  // ---------- wrap coordinate: arc length around the nose or tail at a fixed height ----------
  const wrapCache = new Map();
  function wrapTable(y, end) {
    const key = end + ':' + y.toFixed(4); let t = wrapCache.get(key); if (t) return t;
    const tip = end > 0 ? P.tipF : P.tipR, len = end > 0 ? P.noseLen : P.tailLen, zsA = [];
    for (let k = 0; k <= 50; k++) zsA.push(tip - end * len * (k / 50) ** 2);
    for (let k = 1; k <= 30; k++) zsA.push(tip - end * (len + 1.2 * k / 30));
    const Ls = [0]; let prev = bodyP(y, zsA[0]);
    for (let k = 1; k < zsA.length; k++) { const p = bodyP(y, zsA[k]); Ls.push(Ls[k - 1] + Math.hypot(...sub(p, prev))); prev = p; }
    t = { L: Ls, Z: zsA }; wrapCache.set(key, t); return t;
  }
  const look = (X, Y, x) => { let i = 0; while (i < X.length - 2 && X[i + 1] < x) i++; const t = (x - X[i]) / (X[i + 1] - X[i] || 1); return lerp(Y[i], Y[i + 1], t); };
  const zsAtS = (y, s, end) => { const t = wrapTable(Math.round(y * 2000) / 2000, end); return look(t.L, t.Z, s); };
  const sAtZs = (y, zs, end) => { const t = wrapTable(Math.round(y * 2000) / 2000, end); const Zs = end > 0 ? t.Z.map(z => -z) : t.Z; return look(Zs, t.L, end > 0 ? -zs : zs); };
  const onEnd = (s, y, end, off) => onBody(y, zsAtS(y, s, end), off);
  // a patch on the nose (end 1) or tail (end -1) in (s, y): map(u, v) -> [s, y]
  function endPatch(k, end, map, off, nu, nv, sym = true) {
    const g = patch(lin(0, 1, res(nu)), lin(0, 1, res(nv)), (u, v) => { const [s, y] = map(u, v); return onEnd(s, y, end, off + 0.0025); }, refBody);
    return sym ? putSym(k, g) : put(k, g);
  }
  // thin ribbon along surface points (shut lines, LED strips); pts: [{p, n}]
  function ribbon(k, pts, w, off, sym = true) {
    const pos = [], idx = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)].p, b = pts[Math.min(pts.length - 1, i + 1)].p, n = pts[i].n, bn = norm(cross(sub(b, a), n)), c = addS(pts[i].p, n, off);
      pos.push(...addS(c, bn, w / 2), ...addS(c, bn, -w / 2));
      if (i) { const q = 2 * i; idx.push(q - 2, q, q + 1, q - 2, q + 1, q - 1); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const n0 = pts[pts.length >> 1].n; orient(g, () => n0);
    return sym ? putSym(k, g) : put(k, g);
  }
  const sideLine = (k, yz, w = 0.0045) => ribbon(k, yz.map(([y, zs]) => ({ p: bodyP(y, zs), n: bodyN(y, zs) })), w, 0.0012);
  const endLine = (k, end, sy, w = 0.0045) => ribbon(k, sy.map(([s, y]) => { const zs = zsAtS(y, s, end); return { p: bodyP(y, zs), n: bodyN(y, zs) }; }), w, 0.0012);
  // a rectangular tube on a surface (wipers, roof rails): pts [{p, n}]
  function tube(k, pts, w, h, lift, sym = true) {
    const rings = pts.map((q, i) => {
      const a = pts[Math.max(0, i - 1)].p, b = pts[Math.min(pts.length - 1, i + 1)].p, t = norm(sub(b, a)), bn = norm(cross(t, q.n)), up = cross(bn, t), c = addS(q.p, q.n, lift);
      return [addS(addS(c, bn, w / 2), up, h), addS(addS(c, bn, -w / 2), up, h), addS(c, bn, -w / 2), addS(c, bn, w / 2), c, up, bn];
    });
    for (let f = 0; f < 4; f++) {
      const g = gridGeo([0, 1], lin(0, rings.length - 1, rings.length - 1), (u, v) => rings[Math.round(v)][u ? (f + 1) % 4 : f]);
      const r = rings[rings.length >> 1], dir = [r[5], r[6].map(x => -x), r[5].map(x => -x), r[6]][f];
      orient(g, () => dir); sym ? putSym(k, g) : put(k, g);
    }
  }
  // ---------- shut lines ----------
  const D = P.doors, beltY = zs => gh(clamp(zs, G.zG1, G.zc)).yB - 0.004;
  const vline = (zs, y0, y1) => lin(y0, y1, 16).map(y => [y, zs]);
  if (!MID) {
  sideLine('plastic', vline(D.f, Math.max(D.sill, P.yClad) + 0.01, beltY(D.f)));
  sideLine('plastic', vline(D.b, Math.max(D.sill, P.yClad) + 0.01, beltY(D.b)));
  {
    const R2 = P.archR + 0.04, dz = D.r - P.zr, yA = cy + Math.sqrt(Math.max(0, R2 * R2 - dz * dz)), a0 = Math.atan2(yA - cy, dz), pts = [];
    for (const y of lin(beltY(D.r), yA, 10)) pts.push([y, D.r]);
    for (const a of lin(a0, 0, 14).slice(1)) pts.push([cy + R2 * Math.sin(a), P.zr + R2 * Math.cos(a)]);
    if (cy > Math.max(D.sill, P.yClad) + 0.02) pts.push([Math.max(D.sill, P.yClad) + 0.01, P.zr + R2]);
    sideLine('plastic', pts);
  }
  if (D.sill) sideLine('plastic', lin(P.zr + P.archR + 0.04, D.f, 30).map(zs => [D.sill, zs]));
  }
  // bonnet: a line along each wing that wraps across the nose above the lamps
  const BXF = 0.86, zBL = P.tipF - 0.30, yBL = topY(BXF * hwAt(zBL), sec(zBL));
  if (!MID) {
    const pts = lin(G.zc - 0.02, zBL, 24).map(zs => ({ p: topP(BXF, zs), n: topN(BXF, zs) }));
    const sEnd = sAtZs(yBL, zBL, 1);
    for (const s of lin(sEnd, 0, 22).slice(1)) { const zs = zsAtS(yBL, s, 1); pts.push({ p: bodyP(yBL, zs), n: bodyN(yBL, zs) }); }
    ribbon('plastic', pts, 0.0045, 0.0012);
  }
  // front bumper to wing
  if (!MID) { const a = 0.80, zs0 = P.tipF - 0.34; sideLine('plastic', lin(0, 1, 12).map(t => [lerp(yBL - 0.10, cy + (P.archR + 0.005) * Math.sin(a), t), lerp(zs0, P.zf + (P.archR + 0.005) * Math.cos(a), t)])); }
  // rear bumper: across the tail and forward to the rear arch
  if (!MID) {
    const yb = P.rear.bumper, zs1 = P.tipR + 0.30, s1 = sAtZs(yb, zs1, -1), pts = [];
    for (const s of lin(0, s1, 26)) { const zs = zsAtS(yb, s, -1); pts.push({ p: bodyP(yb, zs), n: bodyN(yb, zs) }); }
    const a = PI - 0.80, ye = cy + (P.archR + 0.005) * Math.sin(a), ze = P.zr + (P.archR + 0.005) * Math.cos(a);
    for (const t of lin(0, 1, 10).slice(1)) { const y = lerp(yb, ye, t), zs = lerp(zs1, ze, t); pts.push({ p: bodyP(y, zs), n: bodyN(y, zs) }); }
    ribbon('plastic', pts, 0.0045, 0.0012);
  }
  // boot lid (sedan) or tailgate (suv)
  if (MID) { /* no shut lines */ } else if (style === 'sedan') {
    const zEnd = P.tipR + 0.10, pts = lin(G.zG1 + 0.02, zEnd, 20).map(zs => ({ p: topP(BXF, zs), n: topN(BXF, zs) }));
    const pe = topP(BXF, zEnd), se = sAtZs(pe[1], zEnd, -1);
    for (const y of lin(pe[1], P.rear.bumper, 14).slice(1)) { const zs = zsAtS(y, se, -1); pts.push({ p: bodyP(y, zs), n: bodyN(y, zs) }); }
    ribbon('plastic', pts, 0.0045, 0.0012);
  } else {
    const yt = gh(G.zG1).yB, s0 = sAtZs(yt, G.zG1 - 0.03, -1) * 0.92;
    endLine('plastic', -1, lin(yt - 0.01, P.rear.bumper, 16).map(y => [s0, y]));
  }
  // fuel flap
  if (!MID) {
    const zc0 = P.zr - 0.24, yc0 = Math.min(beltY(zc0) - 0.13, cy + P.archR + 0.15), pts = [];   // above the rear wheel
    for (let k = 0; k <= 40; k++) { const a = 2 * PI * k / 40, q = Math.pow(Math.abs(Math.cos(a)), 0.4) * Math.sign(Math.cos(a)), r = Math.pow(Math.abs(Math.sin(a)), 0.4) * Math.sign(Math.sin(a)); pts.push([yc0 + 0.05 * r, zc0 + 0.055 * q]); }
    ribbon('plastic', pts.map(([y, zs]) => ({ p: bodyP(y, zs), n: bodyN(y, zs) })), 0.004, 0.0012, false);
  }
  // ---------- front ----------
  const FR = P.front, hlTop = yBL - 0.014;
  {
    const [s0, s1, h0, h1] = FR.hl;
    const hmap = (ins = 0) => (u, v) => {
      const s = lerp(s0 + ins + 0.035 * (1 - v), s1 - ins, u), q = clamp((s - s0) / (s1 - s0), 0, 1);   // slanted inner edge
      const top = hlTop - 0.006 * q - ins, bot = hlTop - lerp(h0, h1, Math.pow(q, 1.2)) + ins;
      return [s, lerp(bot, top, v)];
    };
    endPatch('rimDark', 1, hmap(0), 0.0015, 24, 4);
    endPatch('disc', 1, (u, v) => { const [s, yb] = hmap(0.012)(u, 0), [, yt] = hmap(0.012)(u, 1); return [s, lerp(yb, yt - 0.018, v)]; }, 0.0026, 20, 2);   // silver reflector
    endPatch('lens', 1, hmap(0), 0.0065, 24, 4);
    endPatch('drl', 1, (u, v) => { const [s] = hmap(0.012)(u, 1); const q = (s - s0) / (s1 - s0); return [s, hlTop - 0.024 - 0.006 * q + 0.011 * v]; }, 0.0035, 24, 1);
    // two projector modules
    if (!MID) for (const s of [s0 + 0.10, s0 + 0.22]) {
      const y = hlTop - 0.5 * lerp(h0, h1, Math.pow((s - s0) / (s1 - s0), 1.2)) - 0.006, zs = zsAtS(y, s, 1), p = bodyP(y, zs), n = bodyN(y, zs);
      prim('chrome', new THREE.CylinderGeometry(0.022, 0.026, 0.008, 24).rotateZ(-PI / 2), basisAt(addS(p, n, 0.004), n), true);
      prim('drl', new THREE.SphereGeometry(0.014, 10, 5, 0, PI).rotateY(PI / 2), basisAt(addS(p, n, 0.006), n), true);
    }
    // slim upper grille: a gloss-black band linking the lamps, fine dark slats
    endPatch('trim', 1, (u, v) => [lerp(0, s0 + 0.004, u), lerp(hlTop - FR.ug, hlTop - 0.004, v)], 0.0008, 10, 3);
    if (!MID) for (const f of [0.35, 0.65]) endPatch('plastic', 1, (u, v) => [lerp(0, s0 - 0.03, u), hlTop - 0.004 - FR.ug * f + 0.004 * v], 0.0022, 8, 1);
  }
  lowerGrille: {
    // lower grille: a wide trapezoid of dark mesh, the plate mounted on it
    const [y0, y1, sTop, sBot] = FR.grille, sAt = y => lerp(sBot, sTop, (y - y0) / (y1 - y0));
    endPatch('plastic', 1, (u, v) => { const y = lerp(y0, y1, v); return [u * sAt(y), y]; }, 0.001, 12, 6);
    if (!MID) for (let y = y0 + 0.016; y < y1 - 0.014; y += 0.024) endPatch('trim', 1, (u, v) => { const yy = y + 0.007 * v; return [u * (sAt(yy) - 0.01), yy]; }, 0.0035, 12, 1);
    if (!MID) for (let s = 0.027; s < Math.min(sTop, sBot) - 0.02; s += 0.054) endPatch('trim', 1, (u, v) => [s - 0.0035 + 0.007 * u, lerp(y0 + 0.01, y1 - 0.01, v)], 0.0042, 1, 6);
    if (MID) break lowerGrille;
    // surround
    const loop = [];
    for (const s of lin(0, sTop, 12)) loop.push([s, y1]);
    for (const t of lin(0, 1, 8).slice(1)) loop.push([lerp(sTop, sBot, t), lerp(y1, y0, t)]);
    for (const s of lin(sBot, 0, 12).slice(1)) loop.push([s, y0]);
    endLine('trim', 1, loop, 0.014);
    // corner intakes: tall dark slots with fine slats
    const [v0, v1, w0, w1] = FR.vent;
    endPatch('plastic', 1, (u, v) => [lerp(v0 + 0.03 * v, v1 - 0.03 * v, u), lerp(w0, w1, v)], 0.001, 8, 4);
    for (let w = w0 + 0.03; w < w1 - 0.02; w += 0.04) { const t = (w - w0) / (w1 - w0); endPatch('trim', 1, (u, v) => [lerp(v0 + 0.03 * t + 0.008, v1 - 0.03 * t - 0.008, u), w + 0.008 * v], 0.0035, 8, 1); }
    // black lower lip, silver skid plate on the suv
    endPatch('plastic', 1, (u, v) => [lerp(0, 0.95, u), lerp(fBot(P.tipF) + 0.004, FR.lip, v)], 0.0012, 18, 2);
    if (FR.skid) endPatch('rim', 1, (u, v) => [lerp(0, 0.42 - 0.04 * v, u), lerp(FR.skid[0], FR.skid[1], v)], 0.0025, 10, 1);
    // number plate, blank
    const zs = zsAtS(FR.plate, 0, 1), p = bodyP(FR.plate, zs), n = bodyN(FR.plate, zs);
    prim('trim', new RoundedBoxGeometry(0.014, 0.118, 0.524, 2, 0.004), basisAt(addS(p, n, 0.016), n));
    prim('plastic', new RoundedBoxGeometry(0.010, 0.13, 0.536, 2, 0.004), basisAt(addS(p, n, 0.008), n));
  }
  // ---------- rear ----------
  rearLamps: {
    const RR = P.rear;
    const lmap = (ins = 0) => (u, v) => {
      const s = lerp(0, RR.s1 - ins, u), q = s / RR.s1, top = RR.lampTop - 0.03 * Math.pow(q, 4) - ins;
      let hgt = lerp(RR.bar, RR.cluster, sstep(RR.sBar, RR.sBar + 0.16, s)) * (1 - 0.45 * sstep(RR.s1 - 0.22, RR.s1, s)) - 2 * ins;
      return [s, lerp(top - hgt, top, v)];
    };
    endPatch('trim', -1, lmap(0), 0.0015, 34, 4);
    endPatch('tailLens', -1, lmap(0), 0.0065, 34, 4);
    if (MID) break rearLamps;
    endPatch('tailLed', -1, (u, v) => { const [s, y] = lmap(0.008)(u, 1); return [s, y - 0.006 + 0.005 * v]; }, 0.003, 34, 1);
    endPatch('tailLed', -1, (u, v) => { const s = lerp(RR.sBar + 0.18, RR.s1 - 0.12, u), [, yb] = lmap(0.012)(s / (RR.s1 - 0.012), 0); return [s, yb + 0.005 * v]; }, 0.003, 14, 1);
    endPatch('chrome', -1, (u, v) => { const s = lerp(RR.sBar + 0.22, RR.sBar + 0.36, u), [, yb] = lmap(0.012)(s / (RR.s1 - 0.012), 0); return [s, yb + 0.018 + 0.022 * v]; }, 0.0025, 6, 1);
    // reflectors, diffuser, plate
    endPatch('tailLens', -1, (u, v) => [lerp(0.66, 0.84, u), lerp(RR.refl, RR.refl + 0.022, v)], 0.003, 6, 1);
    endPatch('plastic', -1, (u, v) => [lerp(0, 0.92, u), lerp(fBot(P.tipR) + 0.004, RR.diff, v)], 0.0012, 18, 2);
    if (RR.skid) endPatch('rim', -1, (u, v) => [lerp(0, 0.40, u), lerp(RR.skid[0], RR.skid[1], v)], 0.0025, 10, 1);
    const zs = zsAtS(RR.plate, 0, -1), p = bodyP(RR.plate, zs), n = bodyN(RR.plate, zs);
    prim('trim', new RoundedBoxGeometry(0.014, 0.118, 0.524, 2, 0.004), basisAt(addS(p, n, 0.016), n));
    prim('plastic', new RoundedBoxGeometry(0.010, 0.13, 0.536, 2, 0.004), basisAt(addS(p, n, 0.008), n));
    // exhaust tip under the bumper
    let za = P.tipR, zb = P.tipR + 0.5; const yE = fBot(P.tipR + 0.12) - 0.02;
    for (let i = 0; i < 30; i++) { const m = (za + zb) / 2; if (sideX(yE + 0.04, sec(m)) < 0.46) za = m; else zb = m; }
    const ze = za + zOff(yE + 0.04, za) + 0.02;
    prim('chrome', new THREE.CylinderGeometry(0.036, 0.036, 0.16, 24, 1, true).rotateX(PI / 2).translate(-0.46, yE, ze + 0.06));
    prim('plastic', new THREE.CircleGeometry(0.032, 20).rotateY(PI).translate(-0.46, yE, ze - 0.012));
    // high-level stop lamp
    if (style === 'sedan') ghRegion('tailLed', topSeg, 0.82, 1, C(G.zRs - 0.035), C(G.zRs - 0.02), 0.002, 3);
  }
  // suv: roof spoiler over the tailgate glass
  if (style === 'suv' && !MID) {
    const sp = (t, e) => { const p = topSeg(t, G.zRs + 0.02); return [p[0] * (1 - 0.05 * e), p[1] + 0.012 - 0.02 * e * e, p[2] - 0.16 * e]; };
    putSym('paint', patch(lin(0, 1, 10), lin(0, 1, 4), sp, () => [0, 1, -0.3]));
    putSym('trim', patch(lin(0, 1, 10), lin(0, 1, 4), (t, e) => { const p = sp(t, e); return [p[0], p[1] - 0.03 + 0.02 * e, p[2]]; }, () => [0, -1, 0]));
    putSym('tailLed', patch(lin(0.84, 1, 2), [0, 1], (t, e) => { const p = sp(t, 1); return [p[0], p[1] - 0.008 - 0.012 * e, p[2] - 0.001]; }, () => [0, 0, -1]));
    // roof rails
    const rail = lin(G.zWs - 0.12, G.zRs + 0.12, 24).map(z => { const g = gh(z), t = 1 - 0.50 / g.xR; return { p: topSeg(t, z), n: segN(topSeg, t, z) }; });
    tube('rimDark', rail, 0.028, 0.022, 0.04);
    for (const z of [G.zWs - 0.12, G.zRs + 0.14]) { const g = gh(z), t = 1 - 0.50 / g.xR, p = topSeg(t, z); prim('plastic', new RoundedBoxGeometry(0.032, 0.06, 0.09, 2, 0.01).translate(p[0], p[1] + 0.025, p[2]), null, true); }
    // black wheel-arch flares
    for (const zw of arches) {
      const R0 = P.archR, fl = (rr, a, off) => { const y = cy + rr * Math.sin(a), zs = zw + rr * Math.cos(a); return onBody(y, zs, off); };
      putSym('plastic', patch(lin(0, 1, 3), lin(-0.22, PI + 0.22, 28), (u, a) => fl(R0 + 0.07 * u, a, 0.013 * (1 - u * u) + 0.0015), refBody));
      putSym('plastic', patch([0, 1], lin(-0.22, PI + 0.22, 28), (u, a) => fl(R0 + 0.001, a, 0.0145 * u), (x, y, z) => [0, cy - y, zw - z]));
    }
  }
  // ---------- side details ----------
  // door handles, flush with a dark pocket
  if (!MID) for (const zs of [D.b + 0.17, D.r + 0.17]) {
    const y = fS(zs) - 0.035, p = bodyP(y, zs), n = bodyN(y, zs);
    putSym('plastic', patch(lin(0, 1, 8), lin(0, 1, 2), (u, v) => { const a = 2 * PI * u, r = v; return onBody(y + 0.022 * r * Math.sin(a), zs + 0.085 * r * Math.cos(a), 0.0012); }, refBody));
    prim('paint', new RoundedBoxGeometry(0.018, 0.03, 0.16, 3, 0.008), basisAt(addS(p, n, 0.008), n), true);
  }
  // mirrors
  {
    const [rx, ry, rz] = P.mirror, zm = G.zc - 0.20, g = gh(zm), base = sideSeg(0.2, zm);
    const hx = P.hw + 0.025, hy = g.yB + 0.095, hz = zm - 0.02;
    const deform = (x, y, z, k = 1) => {
      x = Math.sign(x) * Math.pow(Math.abs(x), 0.7); y = Math.sign(y) * Math.pow(Math.abs(y), 0.75); z = Math.sign(z) * Math.pow(Math.abs(z), 0.8);
      if (z < 0) z *= 0.35;                                       // flat back for the glass
      const taper = 1 - 0.18 * (x + 1) / 2;                       // slimmer toward the outer end
      return [x * rx * k, y * ry * taper * k, z * rz * taper * k];
    };
    const shell = MID ? new THREE.SphereGeometry(1, 8, 5) : new THREE.SphereGeometry(1, 20, 12), pa = shell.attributes.position;
    for (let i = 0; i < pa.count; i++) pa.setXYZ(i, ...deform(pa.getX(i), pa.getY(i), pa.getZ(i)));
    shell.deleteAttribute('uv'); shell.computeVertexNormals();
    const mM = M4().makeRotationY(-0.10).setPosition(hx, hy, hz);
    prim('paint', shell, mM, true);
    if (!MID) {
    prim('chrome', new RoundedBoxGeometry(rx * 1.72, ry * 1.45, 0.006, 2, 0.003), M4().makeRotationY(-0.10).setPosition(hx - 0.004, hy - 0.002, hz - rz * 0.36), true);
    // indicator strip following the shell along its lower outer front edge
    const amb = gridGeo(lin(0.35, 1.3, 8), lin(-0.66, -0.5, 1), (t, y) => { const r = Math.sqrt(1 - y * y); return deform(r * Math.cos(t), y, r * Math.sin(t), 1.012); });
    prim('amber', orient(amb, (x, y, z) => [x, y, z]), mM, true);
    prim('plastic', new RoundedBoxGeometry(0.11, 0.035, 0.09, 2, 0.012), M4().setPosition((base[0] + hx - rx) / 2 + 0.01, (base[1] + hy) / 2 - 0.02, zm + 0.02), true);
    }
  }
  // wipers parked at the base of the windscreen
  if (!MID) {
    const wsPt = (x, z) => { const g = gh(z), t = clamp(1 - Math.abs(x) / g.xR, 0, 1), p = topSeg(t, z), n = segN(topSeg, t, z); return x < 0 ? { p: [-p[0], p[1], p[2]], n: [-n[0], n[1], n[2]] } : { p, n }; };
    const zb = G.zc - 0.075;
    tube('plastic', lin(0, 1, 14).map(u => wsPt(lerp(0.08, 0.70, u), zb - 0.025 * u)), 0.016, 0.012, 0.004, false);
    tube('plastic', lin(0, 1, 14).map(u => wsPt(lerp(-0.56, 0.02, u), zb - 0.03 - 0.02 * u)), 0.016, 0.012, 0.004, false);
  }
  // shark-fin antenna
  if (!MID) {
    const z0 = G.zRs + P.antenna, base = topSeg(1, z0)[1] - 0.002;
    put('paint', patch(lin(0, PI, 10), lin(0, 1, 14), (a, b) => {
      const h = 0.064 * Math.pow(Math.sin(PI * Math.pow(b, 1.6)), 0.8), w = 0.032 * Math.pow(Math.sin(PI * Math.pow(b, 1.15)), 0.5) + 0.002;
      return [w * Math.cos(a), base + h * Math.sin(a), z0 + 0.09 - 0.18 * b];
    }, (x, y) => [x * 10, y - base, 0]));
  }
  // ---------- interior ----------
  if (!MID) {
    const f = P.yFloor - 0.36, zc = G.zc;
    const rb = (w, h, d, r) => { const g = new RoundedBoxGeometry(w, h, d, 1, r); g.deleteAttribute('uv'); return g; };
    const wsY = z => fC(z) - 0.06;
    prim('interior', rb(1.40, 0.18, 0.40, 0.06), M4().makeRotationX(0.1).setPosition(0, Math.min(wsY(zc - 0.36) - 0.10, 0.90 + f), zc - 0.36));
    prim('seat', rb(0.22, 0.24, 0.70, 0.05), M4().setPosition(0, 0.50 + f, zc - 0.85));
    const wheel = new THREE.TorusGeometry(0.18, 0.017, 10, 40); wheel.deleteAttribute('uv');
    prim('interior', wheel, M4().makeRotationX(0.42).setPosition(-0.37, 0.95 + f, zc - 0.55));
    prim('interior', new THREE.CylinderGeometry(0.05, 0.05, 0.06, 16).rotateX(PI / 2 + 0.42).translate(-0.37, 0.95 + f, zc - 0.54));
    const seat = (x, z, back) => {
      prim('seat', rb(0.50, 0.13, 0.50, 0.05), M4().makeRotationX(-0.08).setPosition(x, 0.52 + f, z));
      prim('seat', rb(0.50, back, 0.13, 0.05), M4().makeRotationX(-0.26).setPosition(x, 0.56 + f + back / 2, z - 0.30));
      prim('seat', rb(0.26, 0.17, 0.10, 0.04), M4().makeRotationX(-0.2).setPosition(x, 0.60 + f + back + 0.10, z - 0.38));
    };
    seat(0.37, zc - 1.08, 0.60); seat(-0.37, zc - 1.08, 0.60);
    const zrs = zc - 1.90;
    prim('seat', rb(1.30, 0.14, 0.48, 0.06), M4().makeRotationX(-0.06).setPosition(0, 0.55 + f, zrs));
    const rBack = style === 'sedan' ? 0.44 : 0.54;
    prim('seat', rb(1.30, rBack, 0.13, 0.06), M4().makeRotationX(-0.30).setPosition(0, 0.60 + f + rBack / 2, zrs - 0.27));
    for (const x of [-0.40, 0.40]) prim('seat', rb(0.24, 0.13, 0.09, 0.04), M4().makeRotationX(-0.3).setPosition(x, 0.62 + f + rBack + 0.02, zrs - 0.33));
  }
  // ---------- wheels ----------
  {
    const T = P.tyre, R = T.r, Rr = T.rim, Wh = T.w / 2, sw = R - Rr, parts = [];
    const add = (k, g, ref) => { g.deleteAttribute('uv'); indexed(g); if (!g.attributes.normal) g.computeVertexNormals(); if (ref) orient(g, ref); parts.push([k, g]); };
    const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(r, h)), seg).rotateZ(-PI / 2);
    const half = [[0.0, 0.86], [0.18, 0.97], [0.45, 1.035], [0.72, 1.0], [0.88, 0.93], [0.96, 0.80], [0.995, 0.62], [1.0, 0.42], [0.972, 0.39], [0.972, 0.31], [1.0, 0.28], [1.0, 0.04]];
    const prof = [...half.map(([a, b]) => [Rr + a * sw, -b * Wh]), ...half.slice().reverse().map(([a, b]) => [Rr + a * sw, b * Wh])];
    if (MID) {   // a tyre and a silver wheel face
      const pm = [[0.0, 0.9], [1.0, 0.6], [1.0, 0.0]], pr = [...pm.map(([a, b]) => [Rr + a * sw, -b * Wh]), ...pm.slice().reverse().map(([a, b]) => [Rr + a * sw, b * Wh])];
      add('tyre', lathe(pr, 8), (x, y, z) => [x * 0.5, y, z]);
      add('rim', new THREE.CircleGeometry(Rr, 10).rotateY(PI / 2).translate(0.72 * Wh, 0, 0), () => [1, 0, 0]);
      add('rimDark', new THREE.CircleGeometry(0.07, 8).rotateY(PI / 2).translate(0.72 * Wh + 0.004, 0, 0), () => [1, 0, 0]);
    } else {
    add('tyre', lathe(prof, 32), (x, y, z) => [x * 0.5, y, z]);
    add('rim', lathe([[Rr - 0.006, 0.86 * Wh], [Rr + 0.002, 0.93 * Wh], [Rr + 0.011, 0.92 * Wh], [Rr + 0.015, 0.86 * Wh], [Rr + 0.013, 0.70 * Wh]], 40), () => [1, 0, 0]);
    add('rimDark', lathe([[Rr - 0.006, 0.86 * Wh], [Rr - 0.014, 0.78 * Wh], [Rr - 0.018, 0.2 * Wh], [Rr - 0.02, -0.85 * Wh]], 40), (x, y, z) => [0.2, -y, -z]);
    add('plastic', new THREE.CircleGeometry(Rr - 0.015, 32).rotateY(PI / 2).translate(-0.55 * Wh, 0, 0), () => [1, 0, 0]);
    // ten spokes in five V pairs, machined faces, dark sides
    for (let k = 0; k < 5; k++) for (const pr of [-1, 1]) {
      const psi0 = 2 * PI * k / 5, rad = t => lerp(0.06, Rr - 0.006, t), hf = t => lerp(0.50 * Wh, 0.86 * Wh, Math.pow(t, 1.4)), wT = t => lerp(0.024, 0.015, t), dep = t => lerp(0.05, 0.022, t);
      const pt = (t, lat, d) => { const r = rad(t), ang = psi0 + pr * 0.13 * Math.pow(t, 0.75) + lat * wT(t) / r; return [hf(t) - d - 0.003 * (1 - lat * lat), r * Math.cos(ang), r * Math.sin(ang)]; };
      add('rim', gridGeo(lin(-1, 1, 2), lin(0, 1, 8), (lat, t) => pt(t, lat, 0)), () => [1, 0, 0]);
      for (const sd of [-1, 1]) add('rimDark', gridGeo(lin(0, 1, 1), lin(0, 1, 8), (d, t) => pt(t, sd, d * dep(t))), (x, y, z) => sd > 0 ? [0, -z, y] : [0, z, -y]);
    }
    add('rim', new THREE.CylinderGeometry(0.072, 0.08, 0.03, 32).rotateZ(-PI / 2).translate(0.50 * Wh, 0, 0));
    add('rimDark', new THREE.CylinderGeometry(0.036, 0.036, 0.008, 24).rotateZ(-PI / 2).translate(0.50 * Wh + 0.016, 0, 0));
    add('rim', new THREE.CylinderGeometry(0.029, 0.032, 0.012, 24).rotateZ(-PI / 2).translate(0.50 * Wh + 0.021, 0, 0));   // plain centre cap
    for (let k = 0; k < 5; k++) { const a = 2 * PI * (k + 0.5) / 5; add('chrome', new THREE.CylinderGeometry(0.0095, 0.0095, 0.016, 8).rotateZ(-PI / 2).translate(0.50 * Wh + 0.018, 0.049 * Math.cos(a), 0.049 * Math.sin(a))); }
    add('disc', new THREE.CylinderGeometry(0.168, 0.168, 0.026, 48).rotateZ(-PI / 2).translate(-0.15 * Wh, 0, 0));
    add('rimDark', new THREE.CylinderGeometry(0.088, 0.088, 0.05, 32).rotateZ(-PI / 2).translate(0, 0, 0));
    const psiC = -1.0, cal = new RoundedBoxGeometry(0.075, 0.08, 0.15, 1, 0.016); cal.deleteAttribute('uv');
    cal.applyMatrix4(M4().makeRotationX(psiC).setPosition(-0.15 * Wh + 0.012, 0.152 * Math.cos(psiC), 0.152 * Math.sin(psiC)));
    add('caliper', cal);
    }
    // the final footprint scale is non-uniform; pre-compensate so the wheels stay round
    const sy = Hm / P.H, sz = Lm / P.L, kw = Math.sqrt(sy * sz);
    for (const zw of arches) for (const sd of [1, -1]) for (const [k, g] of parts) {
      let c = g.clone(); if (sd < 0) c = mirror(c);
      c.scale(1, kw / sy, kw / sz); c.translate(sd * P.track, cy * kw / sy, zw); put(k, c);
    }
  }
  // ---------- merge per material, scale to the footprint ----------
  if (MID) {   // fold the small parts into the five mid materials (fewer draw calls for the instanced estate cars)
    const fold = { plastic: 'trim', tyre: 'trim', rimDark: 'trim', interior: 'trim', seat: 'trim', disc: 'rim', drl: 'rim', lens: 'rim', chrome: 'rim', caliper: 'rim', amber: 'rim', tailLed: 'tailLens' };
    for (const [k, to] of Object.entries(fold)) if (bins[k]) { (bins[to] ||= []).push(...bins[k]); delete bins[k]; }
  }
  const group = new THREE.Group(); group.name = 'car';
  const S = M4().makeScale(Wm / P.W, Hm / P.H, Lm / P.L);
  let tris = 0; const per = {};
  for (const [k, list] of Object.entries(bins)) {
    const geos = list.map(g => {
      for (const a of Object.keys(g.attributes)) if (a !== 'position' && a !== 'normal') g.deleteAttribute(a);
      if (!g.index) { const n = g.attributes.position.count; g.setIndex([...Array(n).keys()]); }
      return g;
    });
    const merged = mergeGeometries(geos, false); merged.applyMatrix4(S); merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, mats[k]); mesh.name = 'car-' + k;
    mesh.castShadow = !['glass', 'lens', 'tailLens', 'drl'].includes(k); mesh.receiveShadow = k !== 'glass';
    if (mats[k].transparent) mesh.renderOrder = 2;
    group.add(mesh); tris += merged.index.count / 3; per[k] = merged.index.count / 3;
  }
  group.userData = { triangles: tris, drawCalls: group.children.length, style, per };
  return group;
}
