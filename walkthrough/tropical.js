// tropical.js · Malaysian estate planting for estate.js (illustrative, owner request Nov 2026: "more tropical").
//
//   const T = makeTropical({ THREE, material: o => new THREE.MeshStandardMaterial(o) });
//   const P = T.planter();
//   P.add('rain', x, y, z, { s: 1, rot: 0, v: 0, sx: 1 });   // species below; v picks a variant, sx stretches along x
//   P.build(parent);                                         // one InstancedMesh per species variant and material
//
// Species, a short all-green list (owner, Nov 2026: "no need so much trees, no need the red plants, minimal, tropical"):
// rain tree (Samanea saman), foxtail palm (Wodyetia), white frangipani (Plumeria), spider lily (Crinum), lily-turf
// border (Ophiopogon), a plain clipped green hedge (low, or taller along fences), and the soft shade patch under a canopy.
//
// Everything is procedural with seeded randomness (never Math.random: every page must build the same estate, and
// the pack bake must match the live build). Seeds are kept positive (a negative one once gave a canopy of NaN).
// Foliage is cut-out cards on one atlas (alphaTest, both sides), trunks and branches are low tubes, flowers are
// cards on the same atlas, hedges are lumpy extrusions. Colour comes from vertex colours on near-white pictures,
// so one material serves every species.
//
// Why the canopies used to vanish: a cut-out card whose picture is mostly empty (a few thin leaves) mipmaps to an
// average alpha under alphaTest, so from more than a few tens of metres every fragment is discarded and only the
// trunks are left. Here each picture fills most of its cell, and the empty texels carry the leaf colour at low
// alpha, so the mipmapped alpha stays above alphaTest at any distance and the far colour does not darken.

const TAU = Math.PI * 2;

// Park-Miller, seed forced into 1..2^31-2 (always positive, never 0)
export function rng(seed) {
  let s = (Math.abs(Math.floor(seed * 7919 + 13)) % 2147483646) + 1;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

// Atlas cells in pixels (1024 square): x, y, w, h
const ATLAS = 1024;
const CELLS = {
  leaf: [0, 0, 512, 512],       // fine bipinnate leaf mass (rain tree)
  rose: [512, 0, 256, 256],     // broad leaves radiating from a tip (frangipani, lily tops)
  bloom: [768, 0, 256, 256],    // flower cluster, white (tinted per species)
  strap: [512, 256, 512, 256],  // fan of strap leaves from the bottom middle (lilies)
  frond: [0, 512, 1024, 256],   // pinnate palm frond, base at the left
  paddle: [0, 768, 512, 256],   // stalk then banana-like blade, base at the left (spare)
  fox: [512, 768, 512, 256],    // plumose foxtail frond, base at the left
};
const uvOf = name => { const [x, y, w, h] = CELLS[name], p = 3;
  return { u0: (x + p) / ATLAS, u1: (x + w - p) / ATLAS, vT: 1 - (y + p) / ATLAS, vB: 1 - (y + h - p) / ATLAS }; };

// ---------- pictures ----------
const tone = (k, a = 1) => { k = Math.max(0, Math.min(1, k)); return `rgba(${(118 + k * 124) | 0},${(136 + k * 114) | 0},${(98 + k * 112) | 0},${a})`; };
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function leafShape(g, L, W) { g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(W, L * 0.45, 0, L); g.quadraticCurveTo(-W, L * 0.45, 0, 0); g.fill(); }

function drawAtlas() {
  const c = canvas(ATLAS, ATLAS), g = c.getContext('2d'), R = rng(5);
  const cell = (name, fn) => { const [x, y, w, h] = CELLS[name]; g.save(); g.beginPath(); g.rect(x + 3, y + 3, w - 6, h - 6); g.clip(); fn(x, y, w, h); g.restore(); };
  const disc = (x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
  // leaf mass: sprays of small paired leaflets over a few overlapping lobes (an irregular outline; one round mass
  // reads as a paper disc up close), dark ones first, lighter ones over them; no baked light direction
  cell('leaf', (x0, y0, S) => {
    const cx = x0 + S / 2, cy = y0 + S / 2, k = S / 512;
    g.fillStyle = tone(0.36, 0.12); g.fillRect(x0, y0, S, S);
    const lobes = [[cx, cy, S * 0.2]];
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + R() * 0.5, d = S * (0.2 + R() * 0.1); lobes.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d, S * (0.1 + R() * 0.07)]); }
    const inLobe = (x, y, f) => lobes.some(([lx, ly, lr]) => Math.hypot(x - lx, y - ly) < lr * f && Math.hypot(x - cx, y - cy) < S * 0.47);
    g.fillStyle = tone(0.16); for (const [lx, ly, lr] of lobes) disc(lx, ly, lr * 0.55);
    const spray = (n, rmax, lo, hi, sz) => { for (let t = 0; t < n; t++) {
      const a = R() * TAU, d = Math.pow(R(), 0.6) * S * rmax, px = cx + Math.cos(a) * d, py = cy + Math.sin(a) * d;
      if (!inLobe(px, py, 1)) { t -= 0.7; continue; }
      const dir = a + (R() - 0.5) * 1.6, len = S * (0.04 + R() * 0.07), light = lo + (hi - lo) * R();
      for (let s = 0; s < len; s += 4.4 * k * sz) {
        const qx = px + Math.cos(dir) * s, qy = py + Math.sin(dir) * s;
        if (!inLobe(qx, qy, 1.25 + R() * 0.2)) break;
        for (const side of [-1, 1]) {
          g.fillStyle = tone(light + (R() - 0.5) * 0.3);
          g.save(); g.translate(qx, qy); g.rotate(dir + side * 1.0); g.beginPath(); g.ellipse(3.8 * k * sz, 0, 4.8 * k * sz, 2.2 * k * sz, 0, 0, TAU); g.fill(); g.restore();
        }
      }
    } };
    spray(420, 0.36, 0.05, 0.3, 1.25);   // shadowed inner leaves
    spray(520, 0.44, 0.35, 0.8, 1.1);
    spray(220, 0.46, 0.6, 1.0, 1.0);     // sunlit tips
  });
  // radiating broad leaves (two rings) round a dense centre
  cell('rose', (x0, y0, S) => {
    const cx = x0 + S / 2, cy = y0 + S / 2;
    g.fillStyle = tone(0.4, 0.12); g.fillRect(x0, y0, S, S);
    g.fillStyle = tone(0.22); disc(cx, cy, S * 0.24);
    for (const [n, L, W, off, k0] of [[14, 0.47, 0.19, 0, 0.3], [11, 0.36, 0.15, 0.5, 0.5], [8, 0.24, 0.12, 0.25, 0.7]]) for (let i = 0; i < n; i++) {
      const a = (i + off) / n * TAU + (R() - 0.5) * 0.25;
      g.save(); g.translate(cx, cy); g.rotate(a - Math.PI / 2);
      g.fillStyle = tone(k0 + (R() - 0.5) * 0.3); leafShape(g, S * L * (0.85 + R() * 0.2), S * W);
      g.strokeStyle = tone(k0 + 0.35, 0.8); g.lineWidth = 1.6; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, S * L * 0.9); g.stroke();
      g.restore();
    }
  });
  // flower cluster: a pale mass covered with five-petal flowers, warm centres
  cell('bloom', (x0, y0, S) => {
    const cx = x0 + S / 2, cy = y0 + S / 2;
    g.fillStyle = 'rgba(236,230,220,0.12)'; g.fillRect(x0, y0, S, S);
    g.fillStyle = 'rgb(214,206,196)'; disc(cx, cy, S * 0.32);
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, d = S * 0.24; disc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, S * (0.11 + R() * 0.05)); }
    for (let f = 0; f < 44; f++) {
      const a = R() * TAU, d = Math.sqrt(R()) * S * 0.37, fx = cx + Math.cos(a) * d, fy = cy + Math.sin(a) * d, rot = R() * TAU, v = 228 + R() * 27;
      for (let p = 0; p < 5; p++) {
        g.fillStyle = `rgb(${v | 0},${(v - 4) | 0},${(v - 10) | 0})`;
        g.save(); g.translate(fx, fy); g.rotate(rot + p / 5 * TAU); g.beginPath(); g.ellipse(S * 0.045, 0, S * 0.05, S * 0.028, 0, 0, TAU); g.fill(); g.restore();
      }
      g.fillStyle = 'rgb(246,214,130)'; disc(fx, fy, S * 0.016);
    }
  });
  // strap fan: a dark dome underpaint, then arching straps from the base
  cell('strap', (x0, y0, W, H) => {
    const bx = x0 + W / 2, by = y0 + H - 4;
    g.fillStyle = tone(0.35, 0.12); g.fillRect(x0, y0, W, H);
    g.fillStyle = tone(0.18); g.beginPath(); g.ellipse(bx, by, W * 0.2, H * 0.5, 0, Math.PI, TAU); g.fill();   // a small core: a big one reads as a fan
    for (let i = 0; i < 110; i++) {
      const th = (R() * 2 - 1) * 1.38, L = H * (0.62 + R() * 0.36) * (1 - 0.2 * Math.abs(th)), w0 = W * (0.02 + R() * 0.014);
      const pt = t => { const s = Math.sin(th), cth = Math.cos(th); return [bx + s * t * L * 1.15 + s * t * t * L * 0.3, by - cth * t * L + t * t * L * 0.35 * Math.abs(s)]; };
      const left = [], right = [];
      for (let k = 0; k <= 12; k++) { const t = k / 12, [px, py] = pt(t), [qx, qy] = pt(Math.min(1, t + 0.01)), dx = qx - px, dy = qy - py, l = Math.hypot(dx, dy) || 1, w = w0 * Math.pow(1 - t, 0.6);
        left.push([px - dy / l * w, py + dx / l * w]); right.push([px + dy / l * w, py - dx / l * w]); }
      g.fillStyle = tone(0.3 + R() * 0.6); g.beginPath(); g.moveTo(...left[0]); for (const p of left) g.lineTo(...p); for (const p of right.reverse()) g.lineTo(...p); g.closePath(); g.fill();
    }
  });
  // a frond (pinnate, palm-like), a plumose one: rachis along x, leaflets swept toward the tip
  const frondCell = (name, dense) => cell(name, (x0, y0, W, H) => {
    const cy = y0 + H / 2, xa = x0 + 6, xb = x0 + W - 6, L = xb - xa;
    const hw = t => H * 0.46 * Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, t * 1.02))), dense ? 0.6 : 0.75);
    g.fillStyle = tone(0.35, 0.12); g.fillRect(x0, y0, W, H);
    g.fillStyle = tone(0.24); g.beginPath(); g.moveTo(xa, cy);
    for (let k = 0; k <= 40; k++) { const t = k / 40; g.lineTo(xa + t * L, cy - hw(t) * 0.62); }
    for (let k = 40; k >= 0; k--) { const t = k / 40; g.lineTo(xa + t * L, cy + hw(t) * 0.62); }
    g.fill();
    const step = dense ? 3.2 : 5.5;
    for (let x = 0; x < L; x += step) {
      const t = x / L, h = hw(t);
      for (const side of [-1, 1]) for (let r = 0; r < (dense ? 2 : 1); r++) {
        const ang = dense ? side * (0.4 + R() * 1.1) : side * (0.95 + R() * 0.2), len = h * (dense ? 0.55 + R() * 0.5 : 0.95 + R() * 0.15) / Math.max(0.35, Math.sin(Math.abs(ang)));
        g.fillStyle = tone(0.35 + R() * 0.55);
        g.save(); g.translate(xa + x, cy); g.rotate(-ang); g.beginPath(); g.ellipse(len / 2, 0, len / 2, dense ? 1.7 : 3.4, 0, 0, TAU); g.fill(); g.restore();
      }
    }
    g.strokeStyle = tone(0.8); g.lineWidth = 3; g.beginPath(); g.moveTo(xa, cy); g.lineTo(xb, cy); g.stroke();
  });
  frondCell('frond', false); frondCell('fox', true);
  // paddle: a narrow stalk, then a broad blade with a pale midrib, side veins and a few tears
  cell('paddle', (x0, y0, W, H) => {
    const cy = y0 + H / 2, xs = x0 + 140, xe = x0 + W - 6, L = xe - xs;
    g.fillStyle = tone(0.4, 0.12); g.fillRect(x0, y0, W, H);
    g.fillStyle = tone(0.55); g.fillRect(x0 + 4, cy - 4, 150, 8);
    const hw = t => H * 0.45 * Math.pow(Math.max(0, Math.sin(Math.PI * t)), 0.5);
    g.fillStyle = tone(0.42); g.beginPath(); g.moveTo(xs, cy);
    for (let k = 0; k <= 40; k++) { const t = k / 40; g.lineTo(xs + t * L, cy - hw(t)); }
    for (let k = 40; k >= 0; k--) { const t = k / 40; g.lineTo(xs + t * L, cy + hw(t) * 0.96); }
    g.fill();
    g.strokeStyle = tone(0.6, 0.55); g.lineWidth = 1.4;
    for (let x = 8; x < L - 6; x += 7) { const t = x / L, h = hw(t); for (const s of [-1, 1]) { g.beginPath(); g.moveTo(xs + x, cy); g.lineTo(xs + x + h * 0.35, cy + s * h * 0.95); g.stroke(); } }
    g.strokeStyle = tone(0.85); g.lineWidth = 4; g.beginPath(); g.moveTo(x0 + 4, cy); g.lineTo(xe - 10, cy); g.stroke();
    g.globalCompositeOperation = 'destination-out'; g.lineWidth = 2.2;   // tears from the edge toward the midrib
    for (let i = 0; i < 6; i++) { const x = xs + L * (0.2 + R() * 0.7), s = R() < 0.5 ? -1 : 1, h = hw((x - xs) / L); g.beginPath(); g.moveTo(x + h * 0.3, cy + s * h); g.lineTo(x + h * 0.08, cy + s * h * (0.25 + R() * 0.3)); g.stroke(); }
    g.globalCompositeOperation = 'source-over';
  });
  return c;
}
function drawBark() {   // left half: fissured bark; right half: smooth palm stem with leaf-scar rings
  const c = canvas(256, 256), g = c.getContext('2d'), R = rng(17);
  g.fillStyle = 'rgb(196,190,182)'; g.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 70; i++) { let x = R() * 128; g.strokeStyle = `rgba(80,74,68,${0.35 + R() * 0.4})`; g.lineWidth = 1 + R() * 2.5; g.beginPath(); g.moveTo(x, 0); for (let y = 0; y <= 256; y += 16) { x += (R() - 0.5) * 4; g.lineTo(x, y); } g.stroke(); }
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(235,230,222,${R() * 0.35})`; g.fillRect(R() * 128, R() * 256, 1 + R() * 3, 1 + R() * 5); }
  g.fillStyle = 'rgb(216,212,204)'; g.fillRect(128, 0, 128, 256);
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(160,154,146,${R() * 0.25})`; g.fillRect(128 + R() * 128, 0, 1 + R() * 2, 256); }
  for (let y = 0; y < 256; y += 16) { g.fillStyle = 'rgba(140,134,126,0.75)'; g.fillRect(128, y, 128, 2); g.fillStyle = 'rgba(236,232,224,0.8)'; g.fillRect(128, y + 2, 128, 1); }
  return c;
}
function drawHedge() {   // clipped small-leaved foliage, opaque
  const c = canvas(256, 256), g = c.getContext('2d'), R = rng(23);
  g.fillStyle = tone(0.3); g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const x = R() * 256, y = R() * 256; g.fillStyle = tone(0.15 + R() * 0.8);
    for (const ox of [0, -256, 256]) for (const oy of [0, -256, 256]) if (x + ox > -8 && x + ox < 264 && y + oy > -8 && y + oy < 264) {   // wraps, so the tile repeats seamlessly
      g.save(); g.translate(x + ox, y + oy); g.rotate(R() * TAU); g.beginPath(); g.ellipse(0, 0, 5.5, 2.6, 0, 0, TAU); g.fill(); g.restore();
    }
  }
  return c;
}
function drawShade() {   // alpha (green channel) for the shade patch: soft overlapping blots, read with alphaTest 0.5
  const c = canvas(256, 256), g = c.getContext('2d'), R = rng(29);
  g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 16; i++) {   // lobes of different sizes, so the edge is ragged, not an ellipse
    const a = R() * TAU, d = 20 + R() * 55, x = 128 + Math.cos(a) * d, y = 128 + Math.sin(a) * d, r = 26 + R() * 40;
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  }
  { const gr = g.createRadialGradient(128, 128, 0, 128, 128, 60); gr.addColorStop(0, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); }
  for (let i = 0; i < 900; i++) { const a = R() * TAU, d = 40 + R() * 80; g.fillStyle = `rgba(255,255,255,${R() * 0.35})`; g.fillRect(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, 1 + R() * 3, 1 + R() * 3); }
  g.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 700; i++) { const a = R() * TAU, d = R() * 110; g.fillStyle = `rgba(0,0,0,${R() * 0.3})`; g.fillRect(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, 1 + R() * 3, 1 + R() * 3); }   // grass tufts breaking it up
  g.globalCompositeOperation = 'source-over'; g.strokeStyle = '#000'; g.lineWidth = 6; g.strokeRect(0, 0, 256, 256);   // never reaches the edge
  return c;
}

// ---------- the module ----------
export function makeTropical({ THREE, material = o => new THREE.MeshStandardMaterial(o), aniso = 4 } = {}) {
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), UP = V(0, 1, 0);
  const tex = (cv, repeat) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
    t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping; return t; };
  const atlasTex = tex(drawAtlas(), false), barkTex = tex(drawBark(), false), hedgeTex = tex(drawHedge(), true);
  barkTex.wrapT = THREE.RepeatWrapping;
  const shadeTex = new THREE.CanvasTexture(drawShade()); shadeTex.wrapS = shadeTex.wrapT = THREE.ClampToEdgeWrapping;
  const mats = {
    bark: material({ map: barkTex, vertexColors: true, roughness: 0.92 }),
    fol: material({ map: atlasTex, vertexColors: true, roughness: 0.72, alphaTest: 0.42, side: THREE.DoubleSide }),
    hedge: material({ map: hedgeTex, vertexColors: true, roughness: 0.82 }),
  };
  const col = hex => new THREE.Color(hex);
  const jit = (c, R, h = 0.03, s = 0.12, l = 0.1) => c.clone().offsetHSL((R() - 0.5) * h, (R() - 0.5) * s, (R() - 0.5) * l);
  const mix = (a, b, t) => a.clone().lerp(b, Math.max(0, Math.min(1, t)));

  // geometry under construction: position, normal, uv, colour, index
  function Build() {
    const P = [], N = [], U = [], C = [], I = [];
    return {
      v(p, n, u, v, c) { P.push(p.x, p.y, p.z); N.push(n.x, n.y, n.z); U.push(u, v); C.push(c.r, c.g, c.b); return P.length / 3 - 1; },
      quad(a, b, c, d) { I.push(a, b, c, a, c, d); },
      tri(a, b, c) { I.push(a, b, c); },
      get n() { return P.length / 3; },
      geo() {
        if (!P.length) return null;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
        g.setIndex(P.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(I, 1) : new THREE.Uint16BufferAttribute(I, 1));
        g.computeBoundingSphere(); g.computeBoundingBox(); return g;
      },
    };
  }
  // a tube through pts (parallel-transported rings); half: 0 fissured bark, 1 ringed palm stem; vs: texture repeats per metre
  function tube(B, pts, radii, sides, colAt, { half = 0, vs = 0.8 } = {}) {
    const u0 = half ? 0.51 : 0.01, u1 = half ? 0.99 : 0.49;
    let nrm = null, s = 0; const rings = [];
    for (let i = 0; i < pts.length; i++) {
      const t = pts[Math.min(i + 1, pts.length - 1)].clone().sub(pts[Math.max(i - 1, 0)]).normalize();
      if (!nrm) { nrm = Math.abs(t.y) < 0.9 ? UP.clone().cross(t).normalize() : V(1, 0, 0).cross(t).normalize(); }
      nrm.sub(t.clone().multiplyScalar(nrm.dot(t))).normalize();
      const bn = t.clone().cross(nrm);
      if (i) s += pts[i].distanceTo(pts[i - 1]);
      const ring = [], c = colAt(i / (pts.length - 1), pts[i]);
      for (let k = 0; k <= sides; k++) {
        const a = k / sides * TAU, o = nrm.clone().multiplyScalar(Math.cos(a)).addScaledVector(bn, Math.sin(a));
        ring.push(B.v(pts[i].clone().addScaledVector(o, radii[i]), o, u0 + (u1 - u0) * k / sides, s * vs, c));
      }
      rings.push(ring);
    }
    for (let i = 0; i < rings.length - 1; i++) for (let k = 0; k < sides; k++) B.quad(rings[i][k], rings[i + 1][k], rings[i + 1][k + 1], rings[i][k + 1]);
  }
  // a card: centre c, half axes ux (across) and vy (up the picture), shading normal n; turned so its front faces n
  function card(B, c, ux, vy, n, cellName, colr, bottom = false) {
    const q = uvOf(cellName);
    if (ux.clone().cross(vy).dot(n) < 0) ux = ux.clone().negate();
    const o = bottom ? c.clone().add(vy) : c;   // bottom: c is the middle of the bottom edge
    const a = B.v(o.clone().sub(ux).sub(vy), n, q.u0, q.vB, colr), b = B.v(o.clone().add(ux).sub(vy), n, q.u1, q.vB, colr);
    const d = B.v(o.clone().add(ux).add(vy), n, q.u1, q.vT, colr), e = B.v(o.clone().sub(ux).add(vy), n, q.u0, q.vT, colr);
    B.quad(a, b, d, e);
  }
  // a basis for a card facing pn, turned by ang about it
  function basis(pn, ang) {
    const ref = Math.abs(pn.y) < 0.92 ? UP : V(1, 0, 0), u = ref.clone().cross(pn).normalize(), w = pn.clone().cross(u);
    const ux = u.clone().multiplyScalar(Math.cos(ang)).addScaledVector(w, Math.sin(ang));
    return [ux, pn.clone().cross(ux)];
  }
  const randDir = R => { const y = R() * 2 - 1, a = R() * TAU, h = Math.sqrt(1 - y * y); return V(h * Math.cos(a), y, h * Math.sin(a)); };
  // a strip along a path (frond, paddle leaf): widths per station, n per station (the face), fold lowers the edges
  function strip(B, pts, widths, ns, cellName, colAt, fold = 0) {
    const q = uvOf(cellName), m = pts.length - 1, vm = (q.vT + q.vB) / 2, rows = [];
    for (let i = 0; i <= m; i++) {
      const t = pts[Math.min(i + 1, m)].clone().sub(pts[Math.max(i - 1, 0)]).normalize(), n = ns[i], s = t.clone().cross(n).normalize(), w = widths[i] / 2;
      const sh = n.clone().add(UP.clone().multiplyScalar(0.45)).normalize(), c = colAt(i / m), u = q.u0 + (q.u1 - q.u0) * i / m;
      const L = pts[i].clone().addScaledVector(s, -w).addScaledVector(n, -fold * w), Rr = pts[i].clone().addScaledVector(s, w).addScaledVector(n, -fold * w);
      rows.push([B.v(L, sh, u, q.vT, c), B.v(pts[i], sh, u, vm, c), B.v(Rr, sh, u, q.vB, c)]);
    }
    for (let i = 0; i < m; i++) { B.quad(rows[i][0], rows[i][1], rows[i + 1][1], rows[i + 1][0]); B.quad(rows[i][1], rows[i][2], rows[i + 1][2], rows[i + 1][1]); }
  }
  // a frond path from p0, heading (azimuth, elevation), drooping as it goes
  function frondPath(p0, az, el, L, n, droop) {
    const pts = [p0.clone()], d = V(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
    for (let i = 0; i < n; i++) { d.y -= droop; d.normalize(); pts.push(pts[i].clone().addScaledVector(d, L / n)); }
    return pts;
  }
  const faceUp = pts => pts.map((p, i) => { const t = pts[Math.min(i + 1, pts.length - 1)].clone().sub(pts[Math.max(i - 1, 0)]).normalize(); return UP.clone().sub(t.clone().multiplyScalar(t.y)).normalize(); });

  // canopy: cards over a few ellipsoid clumps, shaded by height and outwardness; blooms on the sunny top
  function canopy(B, R, clumps, o) {
    const wsum = clumps.reduce((a, k) => a + k.r.x * k.r.z, 0), cen = o.centre;
    const pick = () => { let x = R() * wsum; for (const k of clumps) { x -= k.r.x * k.r.z; if (x <= 0) return k; } return clumps[0]; };
    const lay = (n, cellName, size, yLo, shell, colFn, upBias) => {
      for (let i = 0; i < n; i++) {
        const k = pick(), th = R() * TAU, y = yLo + (1 - yLo) * Math.pow(R(), 0.75), h = Math.sqrt(Math.max(0, 1 - y * y)), d = V(h * Math.cos(th), y, h * Math.sin(th));
        const p = k.c.clone().add(V(d.x * k.r.x, d.y * k.r.y, d.z * k.r.z).multiplyScalar(shell[0] + (shell[1] - shell[0]) * R()));
        const en = V(d.x / k.r.x, d.y / k.r.y, d.z / k.r.z).normalize(), out = p.clone().sub(cen).normalize();
        const n = en.multiplyScalar(0.55).addScaledVector(out, 0.45).addScaledVector(UP, 0.3).normalize();
        const pn = n.clone().addScaledVector(randDir(R), 0.7).addScaledVector(UP, upBias).normalize();
        const [ux, vy] = basis(pn, R() * TAU), hs = size * (0.8 + R() * 0.4) / 2;
        card(B, p, ux.multiplyScalar(hs), vy.multiplyScalar(hs), n, cellName, colFn(p, out, d));
      }
    };
    const shadeOf = (p, out) => 0.55 * Math.max(0, Math.min(1, (p.y - o.yMin) / (o.yMax - o.yMin))) + 0.45 * (out.y * 0.5 + 0.5);
    lay(o.n, 'leaf', o.size, o.yLo ?? -0.45, [0.72, 1.0], (p, out) => { const t = shadeOf(p, out); return jit(t < 0.5 ? mix(o.bot, o.mid, t * 2) : mix(o.mid, o.top, t * 2 - 1), R, 0.03, 0.14, 0.12); }, 0);
    if (o.bloom) lay(o.bloom.n, 'bloom', o.bloom.size, 0.15, [0.95, 1.08], () => jit(o.bloom.col[(R() * o.bloom.col.length) | 0], R, 0.02, 0.1, 0.1), 0.7);
  }
  const ring = (n, rad, y, R, jr = 0.5) => Array.from({ length: n }, (_, j) => { const a = j / n * TAU + R() * jr; return [Math.cos(a) * rad, y, Math.sin(a) * rad, a]; });

  // ---------- species (each returns { bark, fol, hedge } geometries, base at y 0, metres) ----------
  const S = {};
  // Rain tree: a short stout trunk, five limbs spreading wide, a broad umbrella of billowing clumps
  S.rain = v => {
    const R = rng(101 + v * 31), bark = Build(), fol = Build();
    const cb = col(0x4E443B), cb2 = col(0x6E6253), barkCol = t => mix(cb, cb2, t);
    tube(bark, [V(0, -0.15, 0), V(0.02, 0.6, 0.01), V(0.06, 1.6, 0.03), V(0.1, 2.5, 0.05)], [0.52, 0.4, 0.36, 0.33], 7, barkCol);
    for (const [x, , z, a] of ring(5, 1, 0, R, 0.6)) {
      const r1 = 3.8 + R() * 0.7, p0 = V(0.08, 2.3, 0.04), p1 = V(x * 1.4, 3.5 + R() * 0.4, z * 1.4), p2 = V(x * 2.8, 4.9 + R() * 0.5, z * 2.8), p3 = V(x * r1, 6.0 + R() * 0.4, z * r1);
      tube(bark, [p0, p1, p2, p3], [0.22, 0.17, 0.11, 0.06], 5, barkCol);
      const b = a + (R() < 0.5 ? -1 : 1) * (0.45 + R() * 0.3), q = V(Math.cos(b) * 4.5, 6.5, Math.sin(b) * 4.5);
      tube(bark, [p2, p2.clone().lerp(q, 0.5).add(V(0, 0.3, 0)), q], [0.09, 0.06, 0.035], 4, barkCol);
    }
    const clumps = [{ c: V(0, 7.6, 0), r: V(3.3, 1.9, 3.3) }, ...ring(7, 3.8, 0, R, 0.4).map(([x, , z]) => ({ c: V(x * (1 + R() * 0.15), 6.8 + R() * 0.6, z * (1 + R() * 0.15)), r: V(2.5 + R() * 0.5, 1.5 + R() * 0.35, 2.5 + R() * 0.5) }))];
    canopy(fol, R, clumps, { n: 150, size: 2.15, centre: V(0, 6.6, 0), yMin: 5.4, yMax: 9.6, top: col(0x8AAE4C), mid: col(0x587F2D), bot: col(0x2E481D) });
    return { bark: bark.geo(), fol: fol.geo() };
  };
  // palms: a stem, a green crownshaft, arching fronds; fox: plumose fronds as crossed strips
  const palm = (R, o) => {
    const bark = Build(), fol = Build(), lean = V((R() - 0.5) * o.lean, 0, (R() - 0.5) * o.lean);
    const pts = o.stem.map(([y, r], i) => V(lean.x * (y / o.top) ** 2, y, lean.z * (y / o.top) ** 2));
    tube(bark, pts, o.stem.map(([, r]) => r), 8, (t, p) => p.y < 0.7 ? mix(o.base, o.trunk, p.y / 0.7) : o.trunk, { half: 1, vs: o.rings });
    const top = pts[pts.length - 1], cs = [top, top.clone().add(V(0, o.shaft * 0.5, 0)), top.clone().add(V(0, o.shaft, 0))];
    tube(bark, cs, o.shaftR, 8, () => o.shaftCol, { half: 1, vs: 0.15 });
    for (let k = 0; k < o.n; k++) {
      const f = k / (o.n - 1), az = k * 2.39996 + R() * 0.25, el = o.el[0] + (o.el[1] - o.el[0]) * f + (R() - 0.5) * 0.15;
      const p0 = cs[2].clone().add(V(Math.cos(az) * 0.12, -f * o.shaft * 0.35, Math.sin(az) * 0.12)), L = o.L * (0.88 + R() * 0.22) * (1 - 0.15 * f);
      const path = frondPath(p0, az, el, L, 6, o.droop * (0.8 + R() * 0.4)), up = faceUp(path);
      const w = path.map((_, i) => o.W * Math.pow(Math.sin(Math.PI * (0.1 + 0.9 * i / 6)), 0.7) + 0.05);
      const cf = i => jit(mix(o.young, o.old, f * 0.8 + i * 0.2), R, 0.02, 0.08, 0.06);
      strip(fol, path, w, up, o.cell, cf, o.fold);
      if (o.cross) strip(fol, path, w.map(x => x * 0.8), path.map((p, i) => { const t = path[Math.min(i + 1, 6)].clone().sub(path[Math.max(i - 1, 0)]).normalize(); return t.clone().cross(up[i]).normalize(); }), o.cell, cf, 0.1);
    }
    return { bark: bark.geo(), fol: fol.geo() };
  };
  S.foxtail = v => palm(rng(503 + v * 47), { stem: [[-0.1, 0.3], [0.5, 0.24], [2.0, 0.21], [4.0, 0.19], [5.8, 0.18]], top: 5.8, lean: 0.3,
    base: col(0x86817A), trunk: col(0xADA89E), rings: 1.6, shaft: 1.2, shaftR: [0.19, 0.18, 0.14], shaftCol: col(0x9DB070),
    n: 9, el: [0.95, -0.1], L: 3.1, W: 1.15, droop: 0.22, fold: 0.18, cell: 'fox', young: col(0x6A9A3A), old: col(0x557F2F), cross: true });
  // Frangipani: candelabra branching, leaf rosettes and flower heads at the blunt tips
  S.frangipani = v => {
    const R = rng(601 + v * 53), bark = Build(), fol = Build(), barkCol = () => col(0x8C8878);
    const leaf = [col(0x4E7C2B), col(0x6C9A3C), col(0x5B8A33)], fl = [col(0xFFFBF2), col(0xFFF4DE)];   // white only (v: a second branching)
    const tip = (p, d) => {
      const c = p.clone().add(V(0, 0.1, 0));
      { const pn = UP.clone().addScaledVector(d, 0.35).addScaledVector(randDir(R), 0.2).normalize(), [ux, vy] = basis(pn, R() * TAU); card(fol, c, ux.multiplyScalar(0.6), vy.multiplyScalar(0.6), UP, 'rose', jit(leaf[(R() * 3) | 0], R)); }
      const a0 = R() * TAU;
      for (const a of [a0, a0 + Math.PI / 2]) { const pn = V(Math.cos(a) * 0.82, 0.57, Math.sin(a) * 0.82), [ux, vy] = basis(pn, R() * TAU); card(fol, c.clone().add(V(0, 0.12, 0)), ux.multiplyScalar(0.48), vy.multiplyScalar(0.48), UP, 'rose', jit(leaf[(R() * 3) | 0], R)); }
      for (let i = 0; i < 2; i++) { const pn = UP.clone().addScaledVector(randDir(R), 0.35).normalize(), [ux, vy] = basis(pn, R() * TAU);
        card(fol, c.clone().add(V((R() - 0.5) * 0.25, 0.3 + R() * 0.1, (R() - 0.5) * 0.25)), ux.multiplyScalar(0.22), vy.multiplyScalar(0.22), UP, 'bloom', jit(fl[i], R, 0.02, 0.05, 0.05)); }
    };
    const branch = (p, d, len, r, depth) => {
      const end = p.clone().addScaledVector(d, len), mid = p.clone().lerp(end, 0.5).add(V(0, 0.06 * len, 0));
      tube(bark, [p, mid, end], [r, r * 0.92, r * 0.86], 5, barkCol);
      if (!depth) return tip(end, d);
      const n = depth === 2 ? 3 : (R() < 0.4 ? 3 : 2), a0 = R() * TAU;
      for (let j = 0; j < n; j++) {
        const a = a0 + j / n * TAU + (R() - 0.5) * 0.5, tilt = (depth === 2 ? 0.6 : 0.45) + R() * 0.25;
        const nd = V(Math.sin(tilt) * Math.cos(a), Math.cos(tilt), Math.sin(tilt) * Math.sin(a)).addScaledVector(d, 0.35).normalize();
        branch(end, nd, len * (0.72 + R() * 0.15), r * 0.74, depth - 1);
      }
    };
    branch(V(0, -0.1, 0), UP.clone(), 1.25, 0.17, 2);
    return { bark: bark.geo(), fol: fol.geo() };
  };
  // a rosette of strap leaves: crossed fans plus a flat star; optional thin stems lift it
  const rosette = (R, o) => {
    const bark = Build(), fol = Build();
    for (const st of o.stems || [{ p: V(0, 0, 0), h: 0 }]) {
      const top = st.p.clone().add(V(st.lean ? st.lean.x : 0, st.h, st.lean ? st.lean.z : 0));
      if (st.h) tube(bark, [st.p, top], [0.035, 0.028], 4, () => col(0x5B4636));
      const base = top.clone().add(V(0, st.h ? -0.12 : 0, 0)), a0 = R() * TAU;
      for (let j = 0; j < o.fans; j++) { const a = a0 + j / o.fans * Math.PI, ux = V(Math.cos(a), 0, Math.sin(a)).multiplyScalar(o.w / 2), n = V(-Math.sin(a), 0.6, Math.cos(a)).normalize();
        card(fol, base, ux, V(0, o.h / 2, 0), n, 'strap', jit(o.col[(R() * o.col.length) | 0], R), true); }
      if (o.star) { const pn = UP.clone().addScaledVector(randDir(R), 0.25).normalize(), [ux, vy] = basis(pn, R() * TAU);
        card(fol, base.clone().add(V(0, o.starY, 0)), ux.multiplyScalar(o.star / 2), vy.multiplyScalar(o.star / 2), UP, 'rose', jit(o.col[0], R)); }
    }
    for (let i = 0; i < (o.bloom ? o.bloom.n : 0); i++) { const pn = UP.clone().addScaledVector(randDir(R), 0.5).normalize(), [ux, vy] = basis(pn, R() * TAU);
      card(fol, V((R() - 0.5) * 0.6, o.bloom.y + R() * 0.2, (R() - 0.5) * 0.6), ux.multiplyScalar(o.bloom.size / 2), vy.multiplyScalar(o.bloom.size / 2), pn, 'bloom', jit(o.bloom.col, R, 0.02, 0.05, 0.05)); }
    return { bark: bark.geo(), fol: fol.geo() };
  };
  S.crinum = v => rosette(rng(1001 + v * 71), { fans: 3, w: 1.8, h: 1.15, star: 1.5, starY: 0.32, col: [col(0x6E9A44), col(0x84AC56)], bloom: { n: 3, y: 0.9, size: 0.42, col: col(0xFFFFFF) } });
  // lily-turf border, a 1 m piece along x: plumose cards sunk to half height, so only the grassy upper half shows
  S.turf = v => { const R = rng(1201 + v * 79), fol = Build(), c = [col(0x2E5020), col(0x456B2E), col(0x3A5E27)];
    for (const z of [-0.08, 0.08]) { const tilt = z > 0 ? 0.25 : -0.25; card(fol, V((R() - 0.5) * 0.12, 0, z), V(0.62, 0, 0), V(0, Math.cos(tilt), Math.sin(tilt)).multiplyScalar(0.3), V(0, 0.7, Math.sign(z) * 0.7).normalize(), 'fox', jit(c[(R() * 3) | 0], R)); }
    card(fol, V(0, 0, 0), V(0.58, 0, 0), V(0, 0.32, 0), V(0, 1, 0), 'fox', jit(c[(R() * 3) | 0], R));
    return { fol: fol.geo() }; };
  // clipped hedge piece, 1.2 m along x (rows overlap a little); flowers as small cards on the top and shoulders
  const hedgePiece = (R, o) => {
    const B = Build(), fol = Build(), H = o.H, W = o.W, L = 1.24;
    const prof = [[-0.5, 0], [-0.5, 0.42], [-0.46, 0.76], [-0.34, 0.95], [-0.12, 1], [0.12, 1], [0.34, 0.95], [0.46, 0.76], [0.5, 0.42], [0.5, 0]];
    const pn = prof.map(([z, y], i) => { const a = prof[Math.max(i - 1, 0)], b = prof[Math.min(i + 1, prof.length - 1)]; return V(0, -(b[0] - a[0]) * W, (b[1] - a[1]) * H).normalize().negate(); });
    const st = 4, rows = [], noise = (i, k) => { const s = Math.sin(i * 12.9898 + k * 78.233 + o.seed * 3.1) * 43758.5453; return s - Math.floor(s) - 0.5; };
    let arc = 0; const arcs = prof.map((p, i) => (i ? (arc += Math.hypot((p[0] - prof[i - 1][0]) * W, (p[1] - prof[i - 1][1]) * H)) : 0));
    for (let i = 0; i <= st; i++) {
      const x = -L / 2 + L * i / st, end = i === 0 || i === st ? 0.94 : 1, row = [];
      prof.forEach(([z, y], k) => {
        const n = pn[k], d = (k && k < prof.length - 1 ? noise(i, k) * o.lump : 0);
        const p = V(x, y * H * end + n.y * d, z * W * end + n.z * d), t = y;
        row.push(B.v(p, V(n.x, n.y, n.z).add(V(0, 0.15, 0)).normalize(), x * 2, arcs[k] * 2, jit(mix(o.lo, o.hi, t), R, 0.02, 0.08, 0.08)));
      });
      rows.push(row);
    }
    for (let i = 0; i < st; i++) for (let k = 0; k < prof.length - 1; k++) B.quad(rows[i][k], rows[i][k + 1], rows[i + 1][k + 1], rows[i + 1][k]);
    for (const [i, sx] of [[0, -1], [st, 1]]) { const c = B.v(V((i ? L / 2 : -L / 2) * 0.99, H * 0.45, 0), V(sx, 0, 0), 0, 0, o.lo);
      for (let k = 0; k < prof.length - 1; k++) sx < 0 ? B.tri(c, rows[i][k + 1], rows[i][k]) : B.tri(c, rows[i][k], rows[i][k + 1]); }
    for (let f = 0; f < (o.fl ? o.fl.n : 0); f++) {
      const x = (R() - 0.5) * L * 0.9, side = R() < 0.6 ? 0 : (R() < 0.5 ? -1 : 1), p = side ? V(x, H * (0.62 + R() * 0.25), side * W * 0.47) : V(x, H * 1.01, (R() - 0.5) * W * 0.6);
      const pn = (side ? V(0, 0.6, side) : V((R() - 0.5) * 0.4, 1, (R() - 0.5) * 0.4)).normalize(), [ux, vy] = basis(pn, R() * TAU);
      card(fol, p, ux.multiplyScalar(o.fl.size / 2), vy.multiplyScalar(o.fl.size / 2), pn, 'bloom', jit(o.fl.col[(R() * o.fl.col.length) | 0], R, 0.02, 0.05, 0.08));
    }
    return { hedge: B.geo(), fol: fol.geo() };
  };
  // plain clipped green hedge, no flowers: v 0 low (0.8 m) round the green, v 1 taller (1.5 m) along the fences
  S.hedge = v => hedgePiece(rng(1301 + v * 83), v ? { seed: 11, H: 1.5, W: 0.85, lump: 0.08, lo: col(0x2A4A1D), hi: col(0x46702C) }
    : { seed: 1, H: 0.78, W: 0.78, lump: 0.05, lo: col(0x25471B), hi: col(0x3E6A28) });

  const INFO = {   // draw parts and shadows; r: canopy radius (for shade patches), h: height (scale 1)
    rain: { cast: true, r: 6.2, h: 9.5, variants: 2 }, foxtail: { cast: true, r: 2.8, h: 8.5, variants: 2 }, frangipani: { cast: true, r: 2.0, h: 4.6, variants: 2 },
    crinum: { cast: false, r: 0.9, h: 1.2, variants: 1 }, turf: { cast: false, r: 0.5, h: 0.3, variants: 1 }, hedge: { cast: true, r: 0.6, h: 1.5, variants: 2 },
  };
  const protos = new Map();
  const proto = (kind, v = 0) => { const key = kind + ':' + v; if (!protos.has(key)) protos.set(key, S[kind](v)); return protos.get(key); };

  function planter() {
    const lists = new Map();
    return {
      add(kind, x, y, z, { s = 1, rot = 0, v = 0, sx = 1, tint = true } = {}) {
        if (!S[kind]) throw new Error('tropical: no species ' + kind);
        const key = kind + ':' + (v % INFO[kind].variants);
        if (!lists.has(key)) lists.set(key, []);
        lists.get(key).push({ x, y, z, s, rot, sx, tint });
      },
      count(kind) { let n = 0; for (const [k, l] of lists) if (k.startsWith(kind + ':')) n += l.length; return n; },
      build(parent) {
        const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(), stats = { draws: 0, tris: 0, instances: 0, verts: 0, kinds: {} };
        for (const [key, list] of lists) {
          const [kind, v] = key.split(':'), parts = proto(kind, +v);
          for (const part of ['bark', 'fol', 'hedge']) {
            const geo = parts[part]; if (!geo) continue;
            const im = new THREE.InstancedMesh(geo, mats[part], list.length); im.name = 'tropical-' + kind + '-' + part;
            list.forEach((p, i) => {
              q.setFromAxisAngle(UP, p.rot); m4.compose(V(p.x, p.y, p.z), q, V(p.s * p.sx, p.s, p.s)); im.setMatrixAt(i, m4);
              const R = rng(Math.abs(Math.round(p.x * 73 + p.z * 151)) + i + 1), b = p.tint ? 0.9 + R() * 0.1 : 1;
              im.setColorAt(i, c.setRGB(b * (0.97 + R() * 0.03), b, b * (0.95 + R() * 0.05)));
            });
            im.castShadow = INFO[kind].cast; im.receiveShadow = true; im.computeBoundingSphere(); parent.add(im);
            const tri = geo.index.count / 3; stats.draws++; stats.tris += tri * list.length; stats.verts += geo.attributes.position.count;
            stats.kinds[kind] = (stats.kinds[kind] || 0) + tri * list.length;
          }
          stats.instances += list.length;
        }
        return stats;
      },
    };
  }
  // the shade patch: a 10 m square, uv in metres (for the lawn's own repeating map), alpha over the whole square
  function shadeGeometry() {
    const g = new THREE.PlaneGeometry(10, 10); g.rotateX(-Math.PI / 2);
    const uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) + 5, -p.getZ(i) + 5);
    return g;
  }
  const shadeAlpha = () => { const t = shadeTex.clone(); t.repeat.set(0.1, 0.1); t.needsUpdate = true; return t; };
  return { planter, proto, mats, INFO, species: Object.keys(S), textures: { atlas: atlasTex, bark: barkTex, hedge: hedgeTex, shade: shadeTex }, shadeGeometry, shadeAlpha };
}
