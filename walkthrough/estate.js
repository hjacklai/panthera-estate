// Panthera Bertam estate: all 19 homes on their plots, the estate road, the central green with the dry pond and
// the TNB substation, boundary walls and gates, street lights, the Persiaran in front, from estate.json (verified
// against the amended CAD site plan, SL1 and TD-01). Estate frame: origin at the NE lot corner, x east, z south,
// y = RL - 5.800 (house floor = 0). The whole estate is placed so the walked home sits on its own plot.
//
// Houses other than the walked one are built as light shells (walls, glazing, roof, balconies, porch paving)
// from the same plan data the walkthrough uses, shared between plots.
import { makeTropical, rng } from './tropical.js?v=2';

export function buildEstate(ctx) {
  const { THREE, E, home, models, mats, tex, polyGeometry, mergeGeometries, makeTree, carSpots = {}, carKit = null, carMid = null } = ctx;
  // all: every plot gets its house slot, nothing is skipped for a walked home, root stays in the estate frame, and the
  // fences and gates that differ per walked home go to extras (closed: shown unless that home is walked, open: only then).
  const ALL = !!ctx.all;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const root = new THREE.Group(); root.matrixAutoUpdate = false;
  const fadeMats = [];
  const M = (o) => { const m = new THREE.MeshStandardMaterial(o); fadeMats.push(m); return m; };
  const repeatTex = (t, metres) => { const c = t.clone(); c.needsUpdate = true; c.wrapS = c.wrapT = THREE.RepeatWrapping; c.repeat.set(1 / metres, 1 / metres); return c; };

  // ---------- geometry helpers ----------
  const clean = (g) => {
    g = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    return g;
  };
  let buckets = new Map();   // material -> geometries, merged at the end (few draw calls)
  const put = (mat, g) => { if (!buckets.has(mat)) buckets.set(mat, []); buckets.get(mat).push(clean(g)); };
  const flush = (parent, { cast = false, receive = true } = {}) => {
    for (const [mat, gs] of buckets) {
      const m = new THREE.Mesh(mergeGeometries(gs), mat); m.castShadow = cast; m.receiveShadow = receive; parent.add(m);
    }
    buckets.clear();
  };
  // flat polygon [[x,z]...] at height y, uv in metres
  const fill = (poly, y) => { const g = new THREE.ShapeGeometry(new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)))); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); return g; };
  // the same with holes cut out (each hole a polygon [[x,z]...])
  const fillH = (poly, holes, y) => { const sh = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)));
    for (const h of holes) sh.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z))));
    const g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); return g; };
  // box from plan rect [x0,z0,x1,z1], y0..y1
  const boxR = (r, y0, y1) => { const x0 = Math.min(r[0], r[2]), x1 = Math.max(r[0], r[2]), z0 = Math.min(r[1], r[3]), z1 = Math.max(r[1], r[3]);
    const g = new THREE.BoxGeometry(Math.max(x1 - x0, 0.005), Math.max(y1 - y0, 0.005), Math.max(z1 - z0, 0.005)); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); return g; };
  // box along a segment a->b ([x,z]), thickness t, y0..y1
  const boxSeg = (a, b, t, y0, y1) => { const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
    const g = new THREE.BoxGeometry(L, y1 - y0, t); g.rotateY(-Math.atan2(dz, dx)); g.translate((a[0] + b[0]) / 2, (y0 + y1) / 2, (a[1] + b[1]) / 2); return g; };
  // flat strip along a polyline, width w, at y (uv: u along, v across, metres)
  const ribbon = (pl, w, y) => {
    const pos = [], uv = []; let s = 0;
    for (let i = 0; i < pl.length - 1; i++) {
      const [ax, az] = pl[i], [bx, bz] = pl[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 1e-3) continue;
      const nx = -(bz - az) / L * w / 2, nz = (bx - ax) / L * w / 2;
      const q = [[ax - nx, az - nz, s, 0], [bx - nx, bz - nz, s + L, 0], [bx + nx, bz + nz, s + L, w], [ax + nx, az + nz, s, w]];
      for (const k of [0, 2, 1, 0, 3, 2]) { pos.push(q[k][0], y, q[k][1]); uv.push(q[k][2], q[k][3]); }
      s += L;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g;
  };
  // dashes along a polyline
  const dashes = (pl, dash, gap, w, y) => {
    const out = []; let carry = 0, on = true;
    for (let i = 0; i < pl.length - 1; i++) {
      const a = pl[i], b = pl[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); let t = -carry;
      while (t < L) {
        const len = on ? dash : gap, t0 = Math.max(t, 0), t1 = Math.min(t + len, L);
        if (on && t1 - t0 > 0.05) out.push(ribbon([[a[0] + (b[0] - a[0]) * t0 / L, a[1] + (b[1] - a[1]) * t0 / L], [a[0] + (b[0] - a[0]) * t1 / L, a[1] + (b[1] - a[1]) * t1 / L]], w, y));
        if (t + len > L) { carry = L - t; break; }
        t += len; on = !on;
      }
    }
    return out;
  };
  const inPoly = (p, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > p[1]) !== (zj > p[1]) && p[0] < (xj - xi) * (p[1] - zi) / (zj - zi) + xi) c = !c; } return c; };
  const distPoly = (p, poly) => { let d = Infinity; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2)); d = Math.min(d, Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz)); } return d; };
  const placeM = (o, rot, mirror) => new THREE.Matrix4().compose(V(o[0], 0, o[1]), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), rot * Math.PI / 180), V(mirror ? -1 : 1, 1, 1));

  // ---------- materials ----------
  // Photo maps (walk.js hd.use): ground uvs are metres (fill, quad), wallAt and band uvs half-metres (su 2).
  const hd = ctx.hd || (() => {});
  const grass = (tint, m) => { const g = M({ map: repeatTex(tex.grass(), m), color: tint, roughness: 1 }); hd(g, 'grass', { grass: true }); return g; };
  // lawns: Malaysian cow grass (Axonopus), a fresher, more saturated green than the photo's own (tints stay <= 1 so the pack keeps them)
  const LAWN = 0xE6FFD2;
  const mLawn = grass(LAWN, 2.5), mVerge = grass(0xE0F7CC, 2.5), mScrub = grass(0xB9C2A0, 3.5), mGreen = grass(LAWN, 2.2), mPond = grass(0xD2E6B8, 2.2);
  const mAsphalt = M({ map: repeatTex(tex.asphalt(), 3), roughness: 0.95 });
  hd(mAsphalt, 'asphalt');
  const mLine = M({ color: 0xF2EFE8, roughness: 0.6 });
  const mConc = M({ map: repeatTex(tex.paving(1, '170,166,158'), 2), roughness: 0.95 });
  hd(mConc, 'concrete_paving');
  const mDrain = M({ color: 0x3E3B37, roughness: 0.9 });
  // open drains (owner, Nov 2026: more realistic): concrete walls, a damp bed and a trickle of water
  const mDrainWall = M({ map: repeatTex(tex.paving(1, '150,146,138'), 2), roughness: 0.95, side: THREE.DoubleSide });
  hd(mDrainWall, 'concrete_paving', { su: 2, sv: 2 });
  const mDrainBed = M({ color: 0x5C5852, roughness: 0.85, side: THREE.DoubleSide });
  const mWater = M({ color: 0x3E4B47, roughness: 0.05, metalness: 0.35, side: THREE.DoubleSide });
  const segs = pl => { const out = []; for (let i = 0; i < pl.length - 1; i++) { const [ax, az] = pl[i], [bx, bz] = pl[i + 1], L = Math.hypot(bx - ax, bz - az); if (L > 1e-3) out.push([ax, az, bx, bz, -(bz - az) / L, (bx - ax) / L]); } return out; };
  const band = (pl, o0, o1, y) => {   // a flat strip between two side offsets of a polyline
    const pos = []; for (const [ax, az, bx, bz, nx, nz] of segs(pl)) { const q = [[ax + nx * o0, az + nz * o0], [bx + nx * o0, bz + nz * o0], [bx + nx * o1, bz + nz * o1], [ax + nx * o1, az + nz * o1]];
      for (const k of [0, 2, 1, 0, 3, 2]) pos.push(q[k][0], y, q[k][1]); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(pos.filter((_, i) => i % 3 !== 1).map(v => v / 2), 2)); g.computeVertexNormals(); return g; };
  const bandUV = (pl, o0, o1, y) => {   // like band, with u along the line (1 per metre) and v across it (0..1)
    const pos = [], uv = []; let sAcc = 0;
    for (const [ax, az, bx, bz, nx, nz] of segs(pl)) { const L = Math.hypot(bx - ax, bz - az);
      const q = [[ax + nx * o0, az + nz * o0, sAcc, 0], [bx + nx * o0, bz + nz * o0, sAcc + L, 0], [bx + nx * o1, bz + nz * o1, sAcc + L, 1], [ax + nx * o1, az + nz * o1, sAcc, 1]];
      for (const k of [0, 2, 1, 0, 3, 2]) { pos.push(q[k][0], y, q[k][1]); uv.push(q[k][2], q[k][3]); } sAcc += L; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g; };
  // the channel seen from above: shadowed inner walls at both edges, a damp concrete bed, silt marks
  const drainTex = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, '#2f2c28'); gr.addColorStop(0.16, '#5a5650'); gr.addColorStop(0.5, '#6b665e'); gr.addColorStop(0.84, '#5a5650'); gr.addColorStop(1, '#2f2c28');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 64);
    const rr = rng(31);   // repeatable (Math.random made the live build and the pack differ)
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${rr() > 0.5 ? '40,36,30' : '120,112,100'},${0.05 + rr() * 0.08})`; g.fillRect(rr() * 256, 12 + rr() * 40, 2 + rr() * 10, 1 + rr() * 3); }
    for (let x = 0; x < 256; x += 64) { g.fillStyle = 'rgba(30,28,25,0.5)'; g.fillRect(x, 0, 1.5, 64); }   // precast joints every 1.2 m
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.set(1 / 1.2, 1); return t; })();
  const mDrainDecal = M({ map: drainTex, roughness: 0.7 });
  const wallAt = (pl, o, y0, y1) => {   // a vertical strip at one side offset of a polyline
    const pos = [], uv = []; let sAcc = 0; for (const [ax, az, bx, bz, nx, nz] of segs(pl)) { const L = Math.hypot(bx - ax, bz - az), A = [ax + nx * o, az + nz * o], B = [bx + nx * o, bz + nz * o];
      const q = [[A[0], y0, A[1], sAcc, y0], [B[0], y0, B[1], sAcc + L, y0], [B[0], y1, B[1], sAcc + L, y1], [A[0], y1, A[1], sAcc, y1]];
      for (const k of [0, 1, 2, 0, 2, 3]) { pos.push(q[k][0], q[k][1], q[k][2]); uv.push(q[k][3] / 2, q[k][4] / 2); } sAcc += L; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g; };
  const mPave = M({ map: repeatTex(tex.paving(4, '178,170,160'), 2.4), roughness: 0.9 });
  hd(mPave, 'concrete_paving', { color: 'keep', normalScale: 0.6 });   // keeps the drawn paver joints
  const mWallE = M({ color: mats.wall.color.getHex(), roughness: 0.95 });
  hd(mWallE, 'render_ext', { world: true, normalScale: 0.35 });
  const mCope = M({ color: 0xE9E1D5, roughness: 0.9 });
  const mMetal = M({ color: 0x9EA3A6, roughness: 0.4, metalness: 0.7 });
  const mPole = M({ color: 0xB9B6AE, roughness: 0.85 });
  const mMesh = M({ map: tex.mesh(), color: 0x5E6A5A, roughness: 0.6, metalness: 0.3, alphaTest: 0.5, side: THREE.DoubleSide });
  const mTNB = M({ color: 0xCDD3C6, roughness: 0.8 });
  const mRed = M({ color: 0xB3302A, roughness: 0.5 });
  const mSchool = M({ color: 0xE6E0D6, roughness: 0.95 });
  const mSchoolRoof = M({ color: 0x9C5A3F, roughness: 0.85 });
  const mLamp = new THREE.MeshStandardMaterial({ color: 0xF6F1E4, emissive: 0xFFE2B0, emissiveIntensity: 0, roughness: 0.3 }); fadeMats.push(mLamp);

  // ---------- the homes ----------
  // Each plot gets the full model of its house type, baked by the walkthrough (setHouses), plus its porch paving.
  const placements = [
    ...E.pairs.map(p => ({ kind: 'semid', id: p.id, plots: p.plots, o: p.o, rot: p.rot, mirror: p.mirror })),
    ...E.bungalows.map(b => ({ kind: 'bungalow', id: b.id, plots: [b.plot], o: b.o, rot: b.rot, mirror: b.mirror })),
  ];
  const walked = ALL ? null : placements.find(p => p.kind === home && (home === 'semid' ? p.id === 'pair_002_001' : p.id === 'bungalow_001'));
  const walkedPolys = walked ? E.plots.filter(p => walked.plots.includes(p.id)).map(p => p.poly) : [];
  const SD0 = placements.find(p => p.id === 'pair_002_001'), BG0 = placements.find(p => p.id === 'bungalow_001');   // the two walked homes
  const sd0Polys = E.plots.filter(p => SD0.plots.includes(p.id)).map(p => p.poly);
  const houses = new THREE.Group(); houses.name = 'houses'; root.add(houses);
  // extras (all mode): bucket maps per 'slot|variant', flushed into their own groups
  const xb = new Map(), into = (key, fn) => { const keep = buckets; if (!xb.has(key)) xb.set(key, new Map()); buckets = xb.get(key); try { fn(); } finally { buckets = keep; } };
  const slots = { semid: [], bungalow: [] };
  for (const pl of placements) {
    if (pl === walked) continue;
    const g = new THREE.Group(); g.matrixAutoUpdate = false; g.matrix.copy(placeM(pl.o, pl.rot, pl.mirror)); houses.add(g); slots[pl.kind].push(g);
    g.userData.slot = pl.id;
    const { D, X } = models[pl.kind];
    const pave = [];
    if (pl.kind === 'semid') {
      // the porch paving, trimmed to each unit's own plot: on the angled corner plots (SD-006, SD-007, SD-011) a plain
      // rectangle ran past the boundary into the next plot's gate and garden (owner, Nov 2026: "please fix these")
      const R = [[-6.87, 0.6], [6.87, 0.6], [6.87, 6.7], [-6.87, 6.7]], inv = g.matrix.clone().invert(), ANGLED = ['SD-006', 'SD-007', 'SD-011'];
      const clip = (poly, edge) => {   // Sutherland-Hodgman against one edge (keep its left side)
        const [[ax, az], [bx, bz]] = edge, side = ([x, z]) => (bx - ax) * (z - az) - (bz - az) * (x - ax), out = [];
        for (let i = 0; i < poly.length; i++) {
          const P0 = poly[i], P1 = poly[(i + 1) % poly.length], s0 = side(P0), s1 = side(P1);
          if (s0 >= 0) out.push(P0);
          if ((s0 >= 0) !== (s1 >= 0)) { const t = s0 / (s0 - s1); out.push([P0[0] + (P1[0] - P0[0]) * t, P0[1] + (P1[1] - P0[1]) * t]); }
        }
        return out;
      };
      const pieces = E.plots.filter(q => pl.plots.includes(q.id)).map(q => {
        let loc = q.poly.map(([x, z]) => { const v = V(x, 0, z).applyMatrix4(inv); return [v.x, v.z]; });
        let a = 0; for (let i = 0; i < loc.length; i++) { const [x0, z0] = loc[i], [x1, z1] = loc[(i + 1) % loc.length]; a += x0 * z1 - x1 * z0; }
        if (a < 0) loc = loc.reverse();   // counter-clockwise, so 'left' is inside
        // the angled corner plots pave their whole front yard up to the angled boundary and gate (no grass slivers left
        // between the porch and the gate; owner, Nov 2026: "can fix these"); the others pave the porch rectangle
        if (ANGLED.includes(q.id)) return clip(loc, [[-100, 0.6], [100, 0.6]]);
        let poly = R; for (let i = 0; i < loc.length && poly.length; i++) poly = clip(poly, [loc[i], loc[(i + 1) % loc.length]]);
        return poly;
      }).filter(p => p.length >= 3);
      if (pieces.length) for (const pc of pieces) pave.push(fill(pc, -0.295)); else pave.push(fill(R, -0.295));
    }
    else {   // bungalow: the car porch, then a driveway angled out to its gate on the corner splay
      const r = X.porch.r; pave.push(fill([[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]], -0.295));
      const gt = E.gates.find(q => pl.plots.includes(q.plot));
      if (gt) {
        const inv = g.matrix.clone().invert(), loc = ([x, z]) => { const v = V(x, 0, z).applyMatrix4(inv); return [v.x, v.z]; };
        const h = gt.h.map(loc).sort((a, b) => a[0] - b[0]), drive = E.drives && E.drives[pl.plots[0]];
        if (drive) {   // a long access strip (BG-003): paved wall to wall along it, then across to the porch
          const d = drive.map(loc), hull = pts => {   // convex hull (monotone chain), so the link is one clean shape
            const P = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
            const lo = [], hi = []; for (const q of P) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
            for (const q of P.reverse()) { while (hi.length > 1 && cr(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
            return lo.slice(0, -1).concat(hi.slice(0, -1));
          };
          pave.push(fill(d, -0.2955));
          const pc = [(r[0] + r[2]) / 2, r[3]], near = d.slice().sort((a, b) => Math.hypot(a[0] - pc[0], a[1] - pc[1]) - Math.hypot(b[0] - pc[0], b[1] - pc[1]));   // the strip's two corners nearest the porch
          pave.push(fill(hull([[r[0] + 0.5, r[3]], [r[2], r[3]], near[0], near[1]]), -0.2955));
        } else pave.push(fill([[r[0] + 0.5, r[3]], [r[2], r[3]], h[1], h[0]], -0.2955));
      }
    }
    for (const pg of pave) { const pm = new THREE.Mesh(pg, mPave); pm.receiveShadow = true; g.add(pm); }
  }
  // All copies of one material, across every plot of a type, become a single mesh (one draw call each).
  function setHouses(kind, parts) {
    const Ms = slots[kind].map(g => g.matrix);
    for (const { material, geometry } of parts) {
      const copies = Ms.map(M => {
        const g = geometry.clone(); g.applyMatrix4(M);
        if (M.determinant() < 0) for (const k of Object.keys(g.attributes)) {   // mirrored plot: keep the faces facing out
          const a = g.attributes[k], n = a.itemSize, arr = a.array;
          for (let t = 0; t < a.count; t += 3) for (let c = 0; c < n; c++) { const i1 = (t + 1) * n + c, i2 = (t + 2) * n + c, tmp = arr[i1]; arr[i1] = arr[i2]; arr[i2] = tmp; }
        }
        return g;
      });
      const m = new THREE.Mesh(copies.length > 1 ? mergeGeometries(copies) : copies[0], material);
      m.castShadow = !material.transparent; m.receiveShadow = true; houses.add(m);
    }
  }
  // Light-weight cars in the other porches (the walked home has the detailed ones): body, glasshouse, wheels.
  {
    const spots = [], spotSlot = [];
    for (const kind of ['semid', 'bungalow']) for (const g of slots[kind]) {
      // a plot can park its cars its own way (estate.json carPark: [x, z, heading deg] in the estate frame), e.g. BG-003
      // side by side across its porch (owner, Nov 2026: "park the cars horizontally")
      const own = E.carPark && E.carPark[g.userData.slot];
      if (own) { for (const [x, z, deg] of own) { spots.push(new THREE.Matrix4().compose(V(x, -0.3, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), deg * Math.PI / 180), V(1, 1, 1))); spotSlot.push(g.userData.slot); } continue; }
      for (const c of carSpots[kind] || []) {
      const cx = (c.x0 + c.x1) / 2, cz = (c.z0 + c.z1) / 2, along = Math.abs(c.z1 - c.z0) >= Math.abs(c.x1 - c.x0);
      const m = new THREE.Matrix4().compose(V(cx, -0.3, cz), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), along ? 0 : Math.PI / 2), V(1, 1, 1));
      const M = g.matrix.clone().multiply(m);
      if (M.determinant() < 0) M.multiply(new THREE.Matrix4().makeScale(-1, 1, 1));   // a mirrored plot: the car itself not mirrored (it was drawn inside out)
      const sh = E.carShift && E.carShift[g.userData.slot]; if (sh) M.premultiply(new THREE.Matrix4().makeTranslation(sh[0], 0, sh[1]));   // parked to the side, clear of the way out
      spots.push(M); spotSlot.push(g.userData.slot);
      }
    }
    const cols = [0xE9E9E6, 0x3B4248, 0x8C9196, 0x2B3A4F, 0xB8B2A6, 0x7A1F24, 0x1E1F21, 0xD7D2C8];
    // all mode: both car sets are built and tagged (the pack uses the detailed one on desktop, the light one on phones)
    const tag = (im, kind, paint, pal, mul, add) => { if (ALL) im.userData.car = { kind, slots: spotSlot, paint, pal, mul, add }; };
    if (spots.length && carKit) {   // the detailed car, instanced per material; paint colour varies per car
      for (const { material, geometry, paint } of carKit) {
        const im = new THREE.InstancedMesh(geometry, material, spots.length);
        spots.forEach((M4, i) => { im.setMatrixAt(i, M4); if (paint) im.setColorAt(i, new THREE.Color(cols[(i * 5 + 1) % cols.length])); });
        im.castShadow = !material.transparent; im.receiveShadow = true; houses.add(im); tag(im, 'kit', !!paint, cols, 5, 1);
      }
    }
    if (spots.length && (!carKit || ALL) && carMid) {   // the light set: the same car at mid detail (owner, Nov 2026: the box cars looked cheap)
      const cols6 = [0xE9E9E6, 0x3B4248, 0x8C9196, 0x2B3A4F, 0xB8B2A6, 0x7A1F24];
      for (const { material, geometry, paint } of carMid) {
        const im = new THREE.InstancedMesh(geometry, material, spots.length);
        spots.forEach((M4, i) => { im.setMatrixAt(i, M4); if (paint) im.setColorAt(i, new THREE.Color(cols6[(i * 7) % cols6.length])); });
        im.castShadow = !material.transparent; im.receiveShadow = true; houses.add(im); tag(im, 'lite', !!paint, cols6, 7, 0);
      }
    } else if (spots.length && (!carKit || ALL)) {   // no car.js: plain boxes
      const body = [], glass = [], tyre = [];
      const bx = (w, h, d, x, y, z) => { const b = new THREE.BoxGeometry(w, h, d); b.translate(x, y, z); return clean(b); };
      body.push(bx(1.78, 0.5, 4.5, 0, 0.55, 0), bx(1.7, 0.12, 2.3, 0, 1.36, -0.15));
      glass.push(bx(1.6, 0.48, 2.5, 0, 1.06, -0.15));
      for (const sx of [-0.78, 0.78]) for (const sz of [-1.37, 1.37]) { const w = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 16); w.rotateZ(Math.PI / 2); w.translate(sx, 0.32, sz); tyre.push(clean(w)); }
      const paint = M({ color: 0xffffff, roughness: 0.3, metalness: 0.5 }), dark = M({ color: 0x1D2226, roughness: 0.1, metalness: 0.6 }), rub = M({ color: 0x161616, roughness: 0.85 });
      const cols = [0xE9E9E6, 0x3B4248, 0x8C9196, 0x2B3A4F, 0xB8B2A6, 0x7A1F24];
      for (const [gs, mat, tint] of [[body, paint, true], [glass, dark, false], [tyre, rub, false]]) {
        const im = new THREE.InstancedMesh(mergeGeometries(gs), mat, spots.length);
        spots.forEach((M4, i) => { im.setMatrixAt(i, M4); if (tint) im.setColorAt(i, new THREE.Color(cols[(i * 7) % cols.length])); });
        im.castShadow = true; im.receiveShadow = true; houses.add(im); tag(im, 'lite', tint, cols, 7, 0);
      }
    }
  }

  // ---------- ground ----------
  const pondHole = E.pond ? [E.pond.top] : [];   // the detention pond is cut out of every ground layer
  put(mScrub, fillH([[-300, -230], [220, -230], [220, 320], [-300, 320]], pondHole, -0.36));
  put(mLawn, fillH(E.lot, pondHole, -0.31));
  for (const p of E.plots) put(mLawn, fill(p.poly, -0.306));
  put(mVerge, fill(E.road.reserve, -0.304));
  put(mAsphalt, fill(E.road.carriageway, -0.299));
  for (const b of E.road.bellmouths) put(mAsphalt, fill(b, -0.2985));
  // the junctions with the Persiaran: each bellmouth's mouth runs on to the Persiaran's own edge, so no green crescent shows
  // between the curved kerb and the main road (owner, Nov 2026: "i said to fix this?")
  for (const bm of E.road.bellmouths || []) {
    const P = E.persiaran.carriageway, near = (v) => { let best = null, bd = Infinity;
      for (let i = 0; i < P.length; i++) { const a = P[i], c = P[(i + 1) % P.length], dx = c[0] - a[0], dz = c[1] - a[1], L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((v[0] - a[0]) * dx + (v[1] - a[1]) * dz) / L2)), px = a[0] + t * dx, pz = a[1] + t * dz, d = Math.hypot(v[0] - px, v[1] - pz); if (d < bd) { bd = d; best = [px, pz]; } }
      return { p: best, d: bd }; };
    const idx = bm.map((v, i) => i).filter(i => near(bm[i]).d < 4);
    if (idx.length < 2) continue;
    let k0 = 0; for (let j = 1; j < idx.length; j++) if (idx[j] - idx[j - 1] > 1) { k0 = j; break; }   // one run, even across the polygon's start
    const run = [...idx.slice(k0), ...idx.slice(0, k0)].map(i => bm[i]);
    const out = run.map(v => { const n = near(v), ux = (n.p[0] - v[0]) / (n.d || 1), uz = (n.p[1] - v[1]) / (n.d || 1); return [n.p[0] + ux * 0.6, n.p[1] + uz * 0.6]; });
    put(mAsphalt, fill([...run, ...out.reverse()], -0.2985));
  }
  // the two entrance crossings over the monsoon drain, in the road's asphalt (owner, Nov 2026: "make this also road color,
  // and match it with the road kerb"), cut to the entrance's own curve (owner: "did u fix these road kurbs, to match? a nice
  // curve"): the drawn slab is wider than the bellmouth where it crosses the drain, so its square corners stood out past the
  // curved kerb. The crossing is now the bellmouth inside the slab, and the road kerb runs on round the curve over the drain
  // (see the kerbs below); the slab's 200 mm edge still shows into the drain
  const clipConvex = (subj, clip) => {   // Sutherland-Hodgman: any polygon cut by a convex one
    const ar = clip.reduce((t, q, i) => { const r = clip[(i + 1) % clip.length]; return t + q[0] * r[1] - r[0] * q[1]; }, 0), sg = Math.sign(ar) || 1;
    let out = subj.slice();
    for (let i = 0; i < clip.length && out.length; i++) {
      const A = clip[i], B = clip[(i + 1) % clip.length];
      const inside = q => sg * ((B[0] - A[0]) * (q[1] - A[1]) - (B[1] - A[1]) * (q[0] - A[0])) >= 0;
      const cut = (P, Q) => { const a1 = B[1] - A[1], b1 = A[0] - B[0], c1 = a1 * A[0] + b1 * A[1], a2 = Q[1] - P[1], b2 = P[0] - Q[0], c2 = a2 * P[0] + b2 * P[1], d = a1 * b2 - a2 * b1 || 1e-9;
        return [(b2 * c1 - b1 * c2) / d, (a1 * c2 - a2 * c1) / d]; };
      const inp = out; out = [];
      for (let j = 0; j < inp.length; j++) { const P = inp[j], Q = inp[(j + 1) % inp.length], pi = inside(P), qi = inside(Q);
        if (qi) { if (!pi) out.push(cut(P, Q)); out.push(Q); } else if (pi) out.push(cut(P, Q)); }
    }
    return out;
  };
  const areaOf = q => Math.abs(q.reduce((t, a, i) => { const b = q[(i + 1) % q.length]; return t + a[0] * b[1] - b[0] * a[1]; }, 0)) / 2;
  const CROSSINGS = E.slabs.map(sl => {
    let best = null;
    for (const bm of E.road.bellmouths || []) { const c = clipConvex(bm, sl); if (c.length > 2 && (!best || areaOf(c) > areaOf(best))) best = c; }
    return best && areaOf(best) > 1 ? best : sl;
  });
  for (const c of CROSSINGS) { put(mAsphalt, fill(c, -0.297)); put(mDrainWall, wallAt([...c, c[0]], 0, -0.5, -0.297)); }
  for (const g of dashes(E.road.centre, 2.5, 1.25, 0.12, -0.292)) put(mLine, g);
  for (const d of [...E.drains, ...(E.pond ? [E.pond.inlet] : [])]) {   // precast U-drain (and the pond inlet): kerbs just proud of the verge, a shaded bed, a trickle
    put(mConc, band(d.c, -d.W / 2, -d.w / 2, -0.286)); put(mConc, band(d.c, d.w / 2, d.W / 2, -0.286));
    for (const o of [-d.W / 2, d.W / 2]) put(mDrainWall, wallAt(d.c, o, -0.306, -0.286));       // outer kerb faces
    for (const o of [-d.w / 2, d.w / 2]) put(mDrainWall, wallAt(d.c, o, -0.301, -0.286));       // inner faces
    put(mDrainDecal, bandUV(d.c, -d.w / 2, d.w / 2, -0.301)); put(mWater, band(d.c, -d.w * 0.12, d.w * 0.12, -0.3005));
  }
  // Every house's access: a 150 mm concrete slab over the drain at its gate, and a driveway apron across the verge
  // out to the road edge.
  const aprons = [];
  {
    const pipE = ([x, z], poly) => { let ins = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) ins = !ins; } return ins; };
    const roads = [E.road.carriageway, ...(E.road.bellmouths || [])].filter(q => Array.isArray(q) && q.length > 2);
    for (const g of E.gates) {
      const [h0, h1] = g.h, mx = (h0[0] + h1[0]) / 2, mz = (h0[1] + h1[1]) / 2, gw = Math.hypot(h1[0] - h0[0], h1[1] - h0[1]);
      let best = null;   // the drain segment in front of this gate
      for (const d of E.drains) for (const [ax, az, bx, bz, nx, nz] of segs(d.c)) {
        const L = Math.hypot(bx - ax, bz - az), t = Math.max(0, Math.min(1, ((mx - ax) * (bx - ax) + (mz - az) * (bz - az)) / (L * L))), px = ax + t * (bx - ax), pz = az + t * (bz - az), dd = Math.hypot(mx - px, mz - pz);
        if (!best || dd < best.dd) best = { dd, px, pz, ux: (bx - ax) / L, uz: (bz - az) / L, nx, nz, W: d.W };
      }
      if (!best || best.dd > 3) continue;
      const { px, pz, ux, uz, W } = best; let { nx, nz } = best;
      if ((mx - px) * nx + (mz - pz) * nz > 0) { nx = -nx; nz = -nz; }   // n points away from the house, toward the road
      const half = gw / 2 + 0.15, rect = (o0, o1) => [[px - ux * half + nx * o0, pz - uz * half + nz * o0], [px + ux * half + nx * o0, pz + uz * half + nz * o0], [px + ux * half + nx * o1, pz + uz * half + nz * o1], [px - ux * half + nx * o1, pz - uz * half + nz * o1]];
      const slab = rect(-W / 2 - 0.05, W / 2 + 0.05);
      put(mConc, fill(slab, -0.285)); put(mDrainWall, wallAt([...slab, slab[0]], 0, -0.435, -0.285));
      let reach = W / 2 + 0.05;   // apron out to the carriageway (stops if the road is not found within 6 m)
      for (let k = W / 2 + 0.1; k < 6; k += 0.1) { if (roads.some(q => pipE([px + nx * k, pz + nz * k], q))) { reach = k; break; } }
      if (reach > W / 2 + 0.2) {
        const ap = rect(W / 2 + 0.05, reach + 0.4); aprons.push(ap);
        // trimmed at the road's own edge: where the road edge runs at an angle to the gate (the corner plots), a plain
        // rectangle ran past the kerb onto the carriageway (owner, Nov 2026: "shudnt be portruding to the road")
        let pc = rect(W / 2 + 0.05, reach + 1.5);
        const hx = px + nx * reach, hz = pz + nz * reach;
        let edge = null, ed = Infinity;   // the road edge nearest the apron's end
        for (const q of roads) for (let i = 0; i < q.length; i++) {
          const [ax, az] = q[i], [bx, bz] = q[(i + 1) % q.length], L2 = (bx - ax) ** 2 + (bz - az) ** 2 || 1;
          const t = Math.max(0, Math.min(1, ((hx - ax) * (bx - ax) + (hz - az) * (bz - az)) / L2)), d = Math.hypot(hx - ax - t * (bx - ax), hz - az - t * (bz - az));
          if (d < ed) { ed = d; edge = [ax, az, bx, bz]; }
        }
        if (edge && ed < 2.5) {
          const [ax, az, bx, bz] = edge, side = ([x, z]) => (bx - ax) * (z - az) - (bz - az) * (x - ax), keep = Math.sign(side([px, pz])) || 1, out = [];
          for (let i = 0; i < pc.length; i++) {
            const P0 = pc[i], P1 = pc[(i + 1) % pc.length], s0 = side(P0) * keep, s1 = side(P1) * keep;
            if (s0 >= 0) out.push(P0);
            if ((s0 >= 0) !== (s1 >= 0)) { const t = s0 / (s0 - s1); out.push([P0[0] + (P1[0] - P0[0]) * t, P0[1] + (P1[1] - P0[1]) * t]); }
          }
          if (out.length >= 3) pc = out;
        } else pc = rect(W / 2 + 0.05, reach);
        put(mConc, fill(pc, -0.292));
      }
    }
    // Grass slivers (owner, Nov 2026: "just straight up cover up the green here", "i said to fix this?"): where a strip of verge
    // under about 1.2 m wide is pinched between paving (the road, a crossing, an apron or a drive) and a fence, the green's
    // edge, the pond or the substation, it is paved over: road asphalt next to the road (the road meets the kerb), apron
    // concrete next to a drive. Found on a 150 mm grid in a 1 m band round every paved edge; each cell is paved as it stands.
    {
      const C = 0.15, drivesL = Object.values(E.drives || {});
      const roadP = [...roads, ...CROSSINGS], driveP = [...aprons, ...drivesL, ...E.slabs];
      const hard = [...E.plots.map(q => q.poly), E.island.edge, E.island.tnb_lot, ...(E.pond ? [E.pond.lot] : []), E.persiaran.carriageway].filter(q => Array.isArray(q) && q.length > 2);
      const minD = (q, list) => { let d = Infinity; for (const P of list) d = Math.min(d, distPoly(q, P)); return d; };
      const inside = (q, list) => list.some(P => pipE(q, P));
      const nearDrain = q => E.drains.some(dr => segs(dr.c).some(([ax, az, bx, bz]) => { const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((q[0] - ax) * dx + (q[1] - az) * dz) / L2)); return Math.hypot(q[0] - ax - t * dx, q[1] - az - t * dz) < dr.W / 2 + 0.05; }));
      const seen = new Set(), asph = [], conc = [];
      for (const P of [...roadP, ...driveP]) for (let i = 0; i < P.length; i++) {
        const [ax, az] = P[i], [bx, bz] = P[(i + 1) % P.length], L = Math.hypot(bx - ax, bz - az); if (L < 0.05) continue;
        const ux = (bx - ax) / L, uz = (bz - az) / L;
        for (let t = 0; t <= L; t += C) for (const sgn of [1, -1]) for (let o = C / 2; o < 1.0; o += C) {
          const x = ax + ux * t - uz * o * sgn, z = az + uz * t + ux * o * sgn, kx = Math.round(x / C), kz = Math.round(z / C), k = kx + ',' + kz;
          if (seen.has(k)) continue; seen.add(k);
          const q = [kx * C, kz * C];
          if (!(pipE(q, E.road.reserve) || pipE(q, E.lot)) || inside(q, roadP) || inside(q, driveP) || inside(q, hard) || nearDrain(q)) continue;   // the estate's own leftover land too
          const dr = minD(q, roadP), dd = minD(q, driveP), dh = minD(q, hard), dp = Math.min(dr, dd);
          if (dp + dh > 1.2) continue;   // a proper verge: wider than a sliver
          const sq = [[q[0] - C / 2 - 0.01, q[1] - C / 2 - 0.01], [q[0] + C / 2 + 0.01, q[1] - C / 2 - 0.01], [q[0] + C / 2 + 0.01, q[1] + C / 2 + 0.01], [q[0] - C / 2 - 0.01, q[1] + C / 2 + 0.01]];
          (dr <= dd ? asph : conc).push(sq);
        }
      }
      for (const sq of asph) put(mAsphalt, fill(sq, -0.2994));
      for (const sq of conc) put(mConc, fill(sq, -0.2925));
    }
  }
  // Kerbs and footway (owner, Nov 2026: "detail a bit the road curb pavement"). Round every estate road edge: a 300 mm
  // concrete channel at road level, then a precast kerb 150 mm wide standing 110 mm proud, in 1 m units; dropped flush
  // across each driveway apron. Behind the kerb on the house side (not round the green, the pond or the substation):
  // a 1.2 m footway of grey concrete pavers, 200 x 100 in stretcher bond, stopping at the aprons and clear of the drains.
  {
    const roadPolys = [E.road.carriageway, ...(E.road.bellmouths || [])].filter(q => Array.isArray(q) && q.length > 2);
    const others = [...roadPolys, E.persiaran.carriageway, ...CROSSINGS].filter(q => Array.isArray(q) && q.length > 2);   // the crossings now sit inside the curve: the kerb runs round it
    const canvasT = (w, h, draw, rx, ry) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'));
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 4; return t; };
    const kr = rng(57);   // repeatable
    const mKerb = M({ roughness: 0.85, side: THREE.DoubleSide, map: canvasT(128, 16, g => {   // u: 1 per metre: one precast unit and its joint
      g.fillStyle = '#d9d5cc'; g.fillRect(0, 0, 128, 16);
      for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(${kr() > 0.5 ? '255,255,255' : '120,114,106'},${0.05 + kr() * 0.06})`; g.fillRect(kr() * 128, kr() * 16, 2 + kr() * 5, 1 + kr() * 2); }
      g.fillStyle = 'rgba(95,90,82,0.7)'; g.fillRect(0, 0, 2, 16); }, 1, 1) });
    const mChannel = M({ roughness: 0.9, map: canvasT(128, 16, g => {
      g.fillStyle = '#bdb8ae'; g.fillRect(0, 0, 128, 16);
      for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(${kr() > 0.5 ? '230,226,218' : '90,86,80'},${0.05 + kr() * 0.07})`; g.fillRect(kr() * 128, kr() * 16, 2 + kr() * 6, 1 + kr() * 2); }
      g.fillStyle = 'rgba(85,80,74,0.55)'; g.fillRect(0, 0, 2, 16); }, 1, 1) });
    const mFoot = M({ roughness: 0.9, map: canvasT(240, 240, g => {   // one tile: 1.2 m along x 1.2 m across; pavers 40 x 20 px
      g.fillStyle = '#8f8a82'; g.fillRect(0, 0, 240, 240);   // the sand joints
      for (let r = 0; r < 12; r++) for (let k = -1; k < 6; k++) {
        const x = k * 40 + (r % 2) * 20, v = Math.round((kr() - 0.5) * 16);
        g.fillStyle = `rgb(${188 + v},${183 + v},${175 + v})`; g.fillRect(x + 1, r * 20 + 1, 38, 18);
      } }, 1 / 1.2, 1) });
    // the road lies on one side of each ring: which way is out (segs' n is the left normal)
    const runsOf = (poly, test) => {
      const ring = [...poly, poly[0]], S = segs(ring); if (!S.length) return [];
      const [ax, az, bx, bz, nx, nz] = S.reduce((a, b) => (Math.hypot(b[2] - b[0], b[3] - b[1]) > Math.hypot(a[2] - a[0], a[3] - a[1]) ? b : a));
      const sg = inPoly([(ax + bx) / 2 + nx * 0.05, (az + bz) / 2 + nz * 0.05], poly) ? -1 : 1;   // out = sg * n
      const pts = [];
      for (const [ax, az, bx, bz, nx, nz] of S) { const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / 0.25));
        for (let i = 0; i <= n; i++) pts.push({ p: [ax + (bx - ax) * i / n, az + (bz - az) * i / n], o: [sg * nx, sg * nz], k: null }); }
      for (const q of pts) q.k = test(q.p, q.o, poly);
      const runs = []; let cur = null, last = null;
      for (const q of pts) {
        if (last && Math.hypot(q.p[0] - last.p[0], q.p[1] - last.p[1]) < 1e-4) continue;   // a ring vertex sampled twice
        if (q.k && cur && cur.k === q.k) cur.pl.push(q.p);
        else {
          if (cur && q.k) cur.pl.push(q.p);   // kind changes (kerb to drop): both runs meet on this point, no gap
          if (cur && cur.pl.length > 1) runs.push(cur);
          cur = q.k ? { k: q.k, pl: [q.p], o0: q.o } : null;
        }
        if (cur) cur.o1 = q.o;
        last = q;
      }
      if (cur && cur.pl.length > 1) runs.push(cur);
      return runs.map(r => ({ ...r, sg }));
    };
    const at = (p, o, d) => [p[0] + o[0] * d, p[1] + o[1] * d];
    const lo = (sg, a, b) => (sg > 0 ? [a, b] : [-b, -a]);   // band offsets along out, as band(min, max) so it faces up
    const nearDrain = q => E.drains.some(dr => { for (const [ax, az, bx, bz] of segs(dr.c)) { const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((q[0] - ax) * dx + (q[1] - az) * dz) / L2));
      if (Math.hypot(q[0] - ax - t * dx, q[1] - az - t * dz) < dr.W / 2 + 0.1) return true; } return false; });
    const mKerbFace = mKerb.clone(); mKerbFace.map = mKerb.map.clone(); mKerbFace.map.repeat.set(2, 2); mKerbFace.map.needsUpdate = true;   // wallAt uvs are half-metres: joints every 1 m as on the top
    const cap = (p, o, sg, top) => {   // the square end of a full kerb where it drops to a driveway
      const a = p, b = [p[0] + o[0] * 0.15, p[1] + o[1] * 0.15], y0 = -0.34, pos = [a[0], y0, a[1], b[0], y0, b[1], b[0], top, b[1], a[0], y0, a[1], b[0], top, b[1], a[0], top, a[1]];
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0.15, 0, 0.15, 0.15, 0, 0, 0.15, 0.15, 0, 0.15], 2)); g.computeVertexNormals(); return g;
    };
    for (const poly of roadPolys) {
      // kerb: only where the edge borders verge (not another road, the Persiaran or a crossing slab); dropped at aprons
      for (const r of runsOf(poly, (p, o) => { const q = at(p, o, 0.3); if (inPoly(q, poly) || others.some(x => x !== poly && inPoly(q, x)) || distPoly(q, E.persiaran.carriageway) < 0.8) return null;
        return aprons.some(a => inPoly(at(p, o, 0.08), a)) ? 'drop' : 'kerb'; })) {
        const [c0, c1] = lo(r.sg, -0.3, 0), [k0, k1] = lo(r.sg, 0, 0.15), top = r.k === 'drop' ? -0.289 : -0.19;
        put(mChannel, bandUV(r.pl, c0, c1, -0.2975));
        put(mKerb, bandUV(r.pl, k0, k1, top));
        if (r.k === 'kerb') {
          put(mKerbFace, wallAt(r.pl, 0, -0.34, top)); put(mKerbFace, wallAt(r.pl, r.sg * 0.15, -0.34, top));   // down past the lowest ground beside it
          put(mKerb, cap(r.pl[0], r.o0, r.sg, top)); put(mKerb, cap(r.pl[r.pl.length - 1], r.o1, r.sg, top));
        }
      }
      // footway: the house side only, where the whole 1.2 m width is verge clear of drains, aprons, pond and substation
      for (const r of runsOf(poly, (p, o) => {
        const q0 = at(p, o, 0.3), q1 = at(p, o, 0.8), q2 = at(p, o, 1.4);
        if (inPoly(q0, poly) || others.some(x => x !== poly && (inPoly(q0, x) || inPoly(q2, x)))) return null;
        if (!inPoly(q2, E.road.reserve) || inPoly(q1, E.island.edge) || inPoly(q2, E.island.edge) || distPoly(q2, E.island.edge) < 2.5 || inPoly(at(p, o, 3.0), E.island.edge)) return null;
        if ((E.pond && (inPoly(q2, E.pond.lot))) || inPoly(q2, E.island.tnb_lot) || E.plots.some(pl => inPoly(q2, pl.poly))) return null;
        if (nearDrain(q1) || nearDrain(q2) || aprons.some(a => inPoly(q1, a) || inPoly(q2, a))) return null;
        return 'foot';
      })) { const [f0, f1] = lo(r.sg, 0.15, 1.35); put(mFoot, bandUV(r.pl, f0, f1, -0.2925)); }
    }
    // left-over pockets of verge on the house side (owner, Nov 2026: "just straight up cover up the green here"): where a
    // plot meets the road at an angle, the road, the fence, a drive or apron and the footway box in a small patch of grass.
    // Every patch of verge beyond the footway, between the road and a plot fence, is found on a 200 mm grid; a patch under
    // 12 m2 (a pocket, not a verge strip along the fences) is paved in the footway's pavers. The green's own verge is left.
    {
      const C = 0.2, plotsP = E.plots.map(q => q.poly), drivesL = Object.values(E.drives || {});
      const solid = [...roadPolys, ...CROSSINGS, ...aprons, ...drivesL, ...E.slabs, ...plotsP, E.island.edge, E.island.tnb_lot, ...(E.pond ? [E.pond.lot] : [])].filter(q => Array.isArray(q) && q.length > 2);
      const otherHard = [E.island.edge, E.island.tnb_lot, ...(E.pond ? [E.pond.lot] : [])].filter(q => Array.isArray(q) && q.length > 2);
      const minD = (q, list) => { let d = Infinity; for (const P of list) d = Math.min(d, distPoly(q, P)); return d; };
      const R = E.road.reserve; let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const [x, z] of R) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
      const nx = Math.ceil((x1 - x0) / C), nz = Math.ceil((z1 - z0) / C), cand = new Uint8Array(nx * nz);
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        const q = [x0 + (i + 0.5) * C, z0 + (j + 0.5) * C];
        if (!inPoly(q, R) || solid.some(S => inPoly(q, S)) || nearDrain(q)) continue;
        const dRoad = minD(q, roadPolys); if (dRoad < 1.35) continue;   // the footway band
        const dPlot = minD(q, plotsP), dOther = otherHard.length ? minD(q, otherHard) : Infinity;
        if (dOther <= dPlot) continue;   // the green's side, the pond's, the substation's: left green
        cand[i * nz + j] = 1;
      }
      const seen = new Uint8Array(nx * nz);
      for (let s0 = 0; s0 < cand.length; s0++) {
        if (!cand[s0] || seen[s0]) continue;
        const comp = [s0], st = [s0]; seen[s0] = 1;
        while (st.length) { const c = st.pop(), i = (c / nz) | 0, j = c % nz;
          for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= nx || b >= nz) continue; const n = a * nz + b; if (cand[n] && !seen[n]) { seen[n] = 1; comp.push(n); st.push(n); } } }
        if (comp.length * C * C > 12) continue;   // a verge strip, not a pocket
        for (const c of comp) { const i = (c / nz) | 0, j = c % nz, x = x0 + i * C, z = z0 + j * C;
          put(mFoot, fill([[x - 0.01, z - 0.01], [x + C + 0.01, z - 0.01], [x + C + 0.01, z + C + 0.01], [x - 0.01, z + C + 0.01]], -0.2926)); }
      }
    }
  }
  // the Persiaran in front of the estate
  put(mVerge, fill(E.persiaran.reserve, -0.33));
  put(mAsphalt, fill(E.persiaran.carriageway, -0.31));
  for (const g of dashes(E.persiaran.centre, 3, 6, 0.12, -0.302)) put(mLine, g);
  for (const poly of [E.persiaran.monsoon, E.persiaran.east_drain]) {   // the big open drains along the main road: about 1 m deep
    put(mDrainBed, fill(poly, -0.327)); put(mDrainWall, wallAt([...poly, poly[0]], 0, -0.335, -0.318));   // damp concrete bed with a low kerb edge
  }
  // central island: the green, the dry detention pond, TNB substation, bin site, hydrants
  put(mGreen, fillH(E.island.edge, pondHole, -0.303));
  // Dry detention pond (KOLAM TADAHAN KERING detail sheet): cut 1.8 m into the green, turfed 1:1 banks on the west and
  // south, vertical concrete walls on the north and east with a 0.6 m low-flow channel at their foot, the drain inlet
  // falling onto a concrete apron, the outlet behind a trash screen, a 5 ft maintenance path and an anti-climb fence.
  const pond = E.pond;
  if (pond) {
    const yT = pond.y_top, yB = pond.y_base, yC = pond.y_channel;
    const quad = (p) => {   // four [x,y,z] corners; a sloped quad is turned to face up
      const a = [p[1][0] - p[0][0], p[1][2] - p[0][2]], b = [p[2][0] - p[0][0], p[2][2] - p[0][2]], up = a[1] * b[0] - a[0] * b[1] >= 0;
      const pos = [], uv = []; for (const k of up ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]) { pos.push(...p[k]); uv.push(p[k][0], p[k][2]); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g; };
    for (const q of pond.slopes) put(mPond, quad([[q[0][0], yT - 0.002, q[0][1]], [q[1][0], yT - 0.002, q[1][1]], [q[2][0], yB, q[2][1]], [q[3][0], yB, q[3][1]]]));   // turfed banks
    put(mPond, fill([...pond.channel, pond.base[1]], yB));                                      // turfed base
    put(mConc, fill([...pond.walls, ...[...pond.channel].reverse()], yC));                      // low-flow channel bed
    put(mDrainWall, wallAt([pond.walls[0], ...pond.channel, pond.walls[pond.walls.length - 1]], 0, yC, yB));   // its 150 mm step up to the turf
    put(mWater, band(pond.walls.map((p, i) => [(p[0] + pond.channel[i][0]) / 2, (p[1] + pond.channel[i][1]) / 2]), -0.08, 0.08, yC + 0.004));   // a trickle
    const wl = [pond.wall_ends[0][0], ...pond.walls, pond.wall_ends[1][1]];
    put(mDrainWall, wallAt(wl, 0, yC, yT + 0.02));      // vertical walls, tapering out behind the banks at each end
    put(mConc, band(wl, -0.2, 0, yT + 0.02));           // 200 mm coping along their top
    { const ap = pond.inlet.apron; put(mConc, fill(ap, yB + 0.01)); put(mDrainWall, wallAt([...ap, ap[0]], 0, yC, yB + 0.01)); }   // inlet apron
    { const [p, q] = pond.inlet.c, L = Math.hypot(q[0] - p[0], q[1] - p[1]), dx = (q[0] - p[0]) / L, dz = (q[1] - p[1]) / L, w = pond.inlet.w / 2;   // wet streak under the inlet
      const x = q[0] + dx * 0.01, z = q[1] + dz * 0.01;
      put(mDrainBed, quad([[x + dz * w, yB + 0.01, z - dx * w], [x - dz * w, yB + 0.01, z + dx * w], [x - dz * w, yT + 0.02, z + dx * w], [x + dz * w, yT + 0.02, z - dx * w]])); }
    { const [x, z] = pond.outlet.xz, [nx, nz] = pond.outlet.n, ux = -nz, uz = nx, w = pond.outlet.w / 2, h = pond.outlet.h, s = 0.15;   // outlet and trash screen
      const at = (k, o) => [x + ux * k + nx * o, z + uz * k + nz * o], mDark = M({ color: 0x1B1A18, roughness: 0.9, side: THREE.DoubleSide });
      const o0 = at(-w, 0.01), o1 = at(w, 0.01);
      put(mDark, quad([[o0[0], yC, o0[1]], [o1[0], yC, o1[1]], [o1[0], yC + h, o1[1]], [o0[0], yC + h, o0[1]]]));
      for (const yy of [yC + 0.03, yC + h + 0.1]) put(mMetal, boxSeg(at(-w - 0.08, s), at(w + 0.08, s), 0.04, yy - 0.02, yy + 0.02));
      for (const k of [-w - 0.08, w + 0.08]) put(mMetal, boxSeg(at(k, 0), at(k, s + 0.02), 0.04, yC, yC + h + 0.12));
      for (let k = -w - 0.04; k <= w + 0.05; k += 0.08) { const [bx, bz] = at(k, s); put(mMetal, boxR([bx - 0.01, bz - 0.01, bx + 0.01, bz + 0.01], yC, yC + h + 0.12)); } }
    // anti-climb safety fence: a 300 mm kerb (open where a drain passes), mesh to 2.1 m, posts at most 2.4 m apart
    const gaps = pond.fence_gaps || [], inGap = q => gaps.some(g => distPoly(q, g) < 0.55), fh = pond.fence_h || 2.1, fl = pond.fence;
    for (let i = 0; i < fl.length - 1; i++) {
      const a = fl[i], b = fl[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.05) continue;
      const p = t => [a[0] + (b[0] - a[0]) * t / L, a[1] + (b[1] - a[1]) * t / L], n = Math.max(1, Math.ceil(L / 0.1));
      let run = null;
      for (let k = 0; k <= n; k++) { const t = L * k / n, gap = inGap(p(t));
        if (!gap && run === null) run = t;
        if ((gap || k === n) && run !== null) { if (t - run > 0.05) put(mConc, boxSeg(p(run), p(t), 0.3, yT - 0.05, yT + 0.2)); run = null; } }
      const ph = fh - 0.2, pane = new THREE.PlaneGeometry(L, ph); pane.rotateY(-Math.atan2(b[1] - a[1], b[0] - a[0])); pane.translate((a[0] + b[0]) / 2, yT + 0.2 + ph / 2, (a[1] + b[1]) / 2);
      const uv = pane.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * L / 1.2, uv.getY(k) * ph / 1.2); put(mMesh, pane);
      const m = Math.max(1, Math.ceil(L / 2.4));
      for (let k = i ? 1 : 0; k <= m; k++) { const q = p(L * k / m); if (!inGap(q)) put(mMetal, boxR([q[0] - 0.03, q[1] - 0.03, q[0] + 0.03, q[1] + 0.03], yT + 0.2, yT + fh)); }
    }
  }
  put(mConc, fill(E.island.tnb_lot, -0.298));
  { const b = E.island.tnb, g = new THREE.ExtrudeGeometry(new THREE.Shape(b.map(([x, z]) => new THREE.Vector2(x, z))), { depth: 2.6, bevelEnabled: false }); g.rotateX(Math.PI / 2); g.translate(0, 2.6 - 0.3, 0); put(mTNB, g); }
  for (let i = 0; i < E.island.tnb_fence.length - 1; i++) {
    const a = E.island.tnb_fence[i], b = E.island.tnb_fence[i + 1];
    put(mConc, boxSeg(a, b, 0.15, -0.3, 0.15));
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), pane = new THREE.PlaneGeometry(L, 1.65); pane.rotateY(-Math.atan2(b[1] - a[1], b[0] - a[0])); pane.translate((a[0] + b[0]) / 2, 0.15 + 0.825, (a[1] + b[1]) / 2);
    const uv = pane.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * L / 1.2, uv.getY(k) * 1.65 / 1.2); put(mMesh, pane);
    for (let t = 0; t <= L; t += 2.4) { const p = [a[0] + (b[0] - a[0]) * t / L, a[1] + (b[1] - a[1]) * t / L]; put(mMetal, boxR([p[0] - 0.03, p[1] - 0.03, p[0] + 0.03, p[1] + 0.03], 0.15, 1.8)); }
  }
  put(mConc, fill(E.island.bins, -0.29));
  for (const [x, z] of E.island.hydrants) { const g = new THREE.CylinderGeometry(0.09, 0.11, 0.75, 12); g.translate(x, -0.3 + 0.375, z); put(mRed, g); }

  flush(root, { cast: false, receive: true });   // ground layers: receive only

  // ---------- boundary walls and gates (the walked home draws its own) ----------
  // Street-facing runs are the vent-block fence of the renders (600 plinth, 390 mm blocks between piers at most
  // 3 m apart, capping beam); walls between plots are plain rendered brick, 1.5 m.
  const mVent = M({ map: tex.vent(), color: 0xF3EEE5, roughness: 0.9, alphaTest: 0.5, side: THREE.DoubleSide });
  const roadEdge = E.road.reserve;
  const front = (a, b) => { const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; return distPoly(m, roadEdge) < 0.6; };
  const ventRun = (A, B) => {
    const L = Math.hypot(B[0] - A[0], B[1] - A[1]), at = t => [A[0] + (B[0] - A[0]) * t / L, A[1] + (B[1] - A[1]) * t / L];
    put(mWallE, boxSeg(A, B, 0.15, -0.3, 0.3));                          // plinth
    put(mWallE, boxSeg(A, B, 0.2, 1.08, 1.2));                           // capping beam
    const n = Math.max(1, Math.ceil((L - 0.23) / 3.0)), step = (L - 0.23) / n;
    for (let k = 0; k <= n; k++) { const c = 0.115 + k * step; put(mWallE, boxSeg(at(c - 0.115), at(c + 0.115), 0.21, -0.3, 1.25)); }   // piers
    for (let k = 0; k < n; k++) {
      const t0 = 0.23 + k * step, t1 = (k + 1) * step, len = t1 - t0; if (len < 0.1) continue;
      const p0 = at(t0), p1 = at(t1);
      const pane = new THREE.PlaneGeometry(len, 0.78); pane.rotateY(-Math.atan2(B[1] - A[1], B[0] - A[0])); pane.translate((p0[0] + p1[0]) / 2, 0.3 + 0.39, (p0[1] + p1[1]) / 2);
      const uv = pane.attributes.uv; for (let q = 0; q < uv.count; q++) uv.setXY(q, uv.getX(q) * len / 0.39, uv.getY(q) * 0.78 / 0.39); put(mVent, pane);
    }
  };
  for (const w of E.walls) {
    for (let i = 0; i < w.length - 1; i++) {
      const a = w[i], b = w[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.05) continue;
      const isFront = front(a, b) && L > 2.5;
      const n = Math.max(1, Math.ceil(L / 0.25));
      const p = t => [a[0] + (b[0] - a[0]) * t / L, a[1] + (b[1] - a[1]) * t / L];
      const emit = (t0, t1) => { if (t1 - t0 < 0.05) return;
        if (isFront && t1 - t0 > 2.5) ventRun(p(t0), p(t1));
        else { put(mWallE, boxSeg(p(t0), p(t1), 0.15, -0.3, 1.15)); put(mCope, boxSeg(p(t0), p(t1), 0.2, 1.15, 1.2)); } };
      const runs = skipAt => { let run = null;
        for (let k = 0; k <= n; k++) {
          const t = L * k / n, skip = skipAt(p(t));
          if (!skip && run === null) run = t;
          if ((skip || k === n) && run !== null) { emit(run, skip ? Math.max(run, t - L / n) : t); run = null; }
        } };
      const nearSD = polys => q => polys.some(poly => inPoly(q, poly) || distPoly(q, poly) < 0.3);   // the walked Semi-D draws its own fences
      if (!ALL) runs(home === 'semid' ? nearSD(walkedPolys) : () => false);
      else {   // a wall that touches pair_002_001: both versions, as its extras
        const sk = nearSD(sd0Polys); let hit = false;
        for (let k = 0; k <= n && !hit; k++) hit = sk(p(L * k / n));
        if (!hit) runs(() => false);
        else { into(SD0.id + '|closed', () => runs(() => false)); into(SD0.id + '|open', () => runs(sk)); }
      }
    }
  }
  // Gates: two swing leaves of black flat bars at 250 mm in a frame (1.40 m high), shut.
  const mGateM = M({ color: 0x1F1D1C, roughness: 0.5, metalness: 0.4 });
  const plotOf = id => E.plots.find(p => p.id === id);
  const gate = (g, mine) => {
    let [A, B] = g.h; const L0 = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const y0 = -0.25, H = 1.4;
    const leaves = [];
    if (mine) {   // the walked bungalow's gate stands open, both leaves swung into the plot
      const pl = plotOf(g.plot), c = pl.poly.reduce((a, q) => [a[0] + q[0] / pl.poly.length, a[1] + q[1] / pl.poly.length], [0, 0]);
      const ux = (B[0] - A[0]) / L0, uz = (B[1] - A[1]) / L0; let nx = -uz, nz = ux;
      const m = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2]; if ((c[0] - m[0]) * nx + (c[1] - m[1]) * nz < 0) { nx = -nx; nz = -nz; }
      const half = L0 / 2 - 0.02;
      leaves.push([A, [A[0] + nx * half, A[1] + nz * half]], [B, [B[0] + nx * half, B[1] + nz * half]]);
    } else leaves.push([A, [A[0] + (B[0] - A[0]) * (0.5 - 0.01 / L0), A[1] + (B[1] - A[1]) * (0.5 - 0.01 / L0)]], [[A[0] + (B[0] - A[0]) * (0.5 + 0.01 / L0), A[1] + (B[1] - A[1]) * (0.5 + 0.01 / L0)], B]);
    for (const [P0, P1] of leaves) {
      const L = Math.hypot(P1[0] - P0[0], P1[1] - P0[1]), at = t => [P0[0] + (P1[0] - P0[0]) * t / L, P0[1] + (P1[1] - P0[1]) * t / L], t0 = 0, t1 = L;
      put(mGateM, boxSeg(at(t0), at(t0 + 0.05), 0.05, y0, y0 + H)); put(mGateM, boxSeg(at(t1 - 0.05), at(t1), 0.05, y0, y0 + H));   // stiles
      for (const y of [0.05, 0.62, H - 0.03]) put(mGateM, boxSeg(at(t0), at(t1), 0.05, y0 + y - 0.025, y0 + y + 0.025));            // rails
      for (let t = t0 + 0.25; t < t1 - 0.1; t += 0.25) put(mGateM, boxSeg(at(t - 0.025), at(t + 0.025), 0.05, y0 + 0.05, y0 + H - 0.05));   // flat bars
    }
  };
  for (const g of E.gates) {
    if (!ALL) {
      const mine = walked.plots.includes(g.plot);
      if (mine && home === 'semid') continue;                     // the walked Semi-D draws its own gate
      gate(g, mine);
    } else if (SD0.plots.includes(g.plot)) into(SD0.id + '|closed', () => gate(g, false));
    else if (BG0.plots.includes(g.plot)) { into(BG0.id + '|closed', () => gate(g, false)); into(BG0.id + '|open', () => gate(g, true)); }
    else gate(g, false);
  }
  // extras: one group per slot and variant (cast and receive, like the walls they belong with)
  for (const [key, map] of xb) {
    const [slot, variant] = key.split('|'), grp = new THREE.Group(); grp.userData.slot = slot; grp.userData.variant = variant; root.add(grp);
    const keep = buckets; buckets = map; flush(grp, { cast: true, receive: true }); buckets = keep;
  }

  // ---------- street lights (SL1): 9 m concrete poles, single arm, LED head ----------
  const roadsLamp = [E.road.carriageway, ...(E.road.bellmouths || [])].filter(q => Array.isArray(q) && q.length > 2);
  for (const l of E.lights) {
    const park = l.t === 'D' || (!l.dir[0] && !l.dir[1]);   // the bare posts (no arm, no head on the plan): they read as broken lamps
    const H = park ? 4.5 : l.t === 'A' ? 9 : 8; let [x, z] = l.xz;
    if (l.dir[0] || l.dir[1]) for (let k = 0; k < 12 && roadsLamp.some(q => inPoly([x, z], q) || distPoly([x, z], q) < 0.45); k++) { x -= l.dir[0] * 0.1; z -= l.dir[1] * 0.1; }   // behind the kerb
    if (park) continue;   // the bare posts round the green and by the main road: removed (owner, Nov 2026: "these two lamp post here can remove ... same for here")
    const pole = new THREE.CylinderGeometry(0.075, 0.13, H, 10); pole.translate(x, -0.3 + H / 2, z); put(mPole, pole);
    const ex = x + l.dir[0] * 1.6, ez = z + l.dir[1] * 1.6, A = V(x, H - 0.55, z), B = V(ex, H - 0.2, ez);
    const arm = new THREE.CylinderGeometry(0.035, 0.035, A.distanceTo(B), 8); arm.applyMatrix4(new THREE.Matrix4().compose(A.clone().lerp(B, 0.5), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), B.clone().sub(A).normalize()), V(1, 1, 1))); put(mPole, arm);
    const head = new THREE.BoxGeometry(0.62, 0.09, 0.26); head.rotateY(-Math.atan2(l.dir[1], l.dir[0])); head.translate(ex + l.dir[0] * 0.2, H - 0.22, ez + l.dir[1] * 0.2); put(mMetal, head);
    const lens = new THREE.PlaneGeometry(0.5, 0.18); lens.rotateX(Math.PI / 2); lens.rotateY(-Math.atan2(l.dir[1], l.dir[0])); lens.translate(ex + l.dir[0] * 0.2, H - 0.27, ez + l.dir[1] * 0.2); put(mLamp, lens);
  }

  // ---------- the school across the Persiaran (massing only): off, owner Nov 2026 ("lets remove these") ----------
  for (const s of []) {
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(s.poly.map(([x, z]) => new THREE.Vector2(x, z))), { depth: s.h, bevelEnabled: false }); g.rotateX(Math.PI / 2); g.translate(0, s.h - 0.3, 0); put(mSchool, g);
    put(mSchoolRoof, fill(s.poly, s.h - 0.29));
  }
  flush(root, { cast: true, receive: true });     // walls, gates, poles, substation, school: cast too

  // ---------- children's playground on the central green (illustrative: owner request, not on the layout plan) ----------
  // A 10 x 8 m rubber safety surface in the open middle of the green, clear of the shade trees and the dry pond:
  // a roofed play tower with a slide, a two-seat swing, a see-saw, two spring riders and two benches.
  {
    const play = new THREE.Group(); root.add(play);
    const Y = -0.29, CX = -35.5, CZ = 48.5, W2 = 5.0, D2 = 4.0;
    const mRubber = M({ color: 0xB86A4B, roughness: 0.95 }), mRubber2 = M({ color: 0x8FA27A, roughness: 0.95 }), mKerb = M({ color: 0xDCD6CB, roughness: 0.85 });
    const mPost = M({ color: 0x8C9C7E, roughness: 0.55, metalness: 0.2 }), mDeck = M({ color: 0xB89064, roughness: 0.7 }), mRoof = M({ color: 0xB0563A, roughness: 0.6 });
    const mSlide = M({ color: 0xE9DFC9, roughness: 0.35 }), mSteel = M({ color: 0x9A9C9A, roughness: 0.35, metalness: 0.8 }), mSeat = M({ color: 0x2E2B28, roughness: 0.7 });
    const add = (g, m, x, y, z, ry = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.rotation.y = ry; o.castShadow = true; o.receiveShadow = true; play.add(o); return o; };
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d), cyl = (r, h, n = 12) => new THREE.CylinderGeometry(r, r, h, n);
    const rod = (A, B, r, m) => { const a = V(...A), b = V(...B), L = a.distanceTo(b), o = new THREE.Mesh(cyl(r, L, 10), m); o.position.copy(a).lerp(b, 0.5); o.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()); o.castShadow = true; play.add(o); return o; };
    // safety surface with a terracotta field and a sage band, inside a low kerb
    add(box(2 * W2, 0.04, 2 * D2), mRubber, CX, Y + 0.02, CZ);
    add(box(2 * W2 - 0.6, 0.042, 1.2), mRubber2, CX, Y + 0.021, CZ - D2 + 1.2);
    for (const [w, d, x, z] of [[2 * W2 + 0.2, 0.1, CX, CZ - D2 - 0.05], [2 * W2 + 0.2, 0.1, CX, CZ + D2 + 0.05], [0.1, 2 * D2, CX - W2 - 0.05, CZ], [0.1, 2 * D2, CX + W2 + 0.05, CZ]]) add(box(w, 0.14, d), mKerb, x, Y + 0.07, z);
    // play tower: 1.3 m square deck at 1.2 m, four posts, guard rails, a pitched roof, a ladder and a slide
    { const tx = CX + 2.2, tz = CZ - 0.6, h = 1.2, hw = 0.65;
      for (const [dx, dz] of [[-hw, -hw], [hw, -hw], [-hw, hw], [hw, hw]]) add(box(0.1, 2.6, 0.1), mPost, tx + dx, Y + 1.3, tz + dz);
      add(box(1.3, 0.06, 1.3), mDeck, tx, Y + h, tz);
      for (const [dx, dz, w, d] of [[0, -hw, 1.3, 0.05], [hw, 0, 0.05, 1.3]]) { add(box(w, 0.05, d), mPost, tx + dx, Y + h + 0.7, tz + dz); for (let k = -0.5; k <= 0.5; k += 0.125) add(box(0.03, 0.66, 0.03), mPost, tx + dx + (d > w ? 0 : k), Y + h + 0.36, tz + dz + (d > w ? k : 0)); }
      const roof = new THREE.ConeGeometry(1.05, 0.7, 4, 1); roof.rotateY(Math.PI / 4); add(roof, mRoof, tx, Y + 2.6 + 0.35, tz);
      // ladder down the -x side
      for (const dz of [-0.25, 0.25]) rod([tx - hw - 0.55, Y, tz + dz], [tx - hw, Y + h, tz + dz], 0.025, mSteel);
      for (let k = 1; k <= 4; k++) { const t = k / 5; rod([tx - hw - 0.55 + 0.55 * t, Y + h * t, tz - 0.25], [tx - hw - 0.55 + 0.55 * t, Y + h * t, tz + 0.25], 0.018, mSteel); }
      // slide off the +z side: a gently curved chute with side walls
      const n = 12, L = 2.6, pts = [];
      for (let i = 0; i <= n; i++) { const t = i / n; pts.push([t * L, h * (1 - t) * (1 - t * 0.35) + 0.25 * t * t * 0.0]); }
      for (let i = 0; i < n; i++) {
        const [z0, y0] = pts[i], [z1, y1] = pts[i + 1], len = Math.hypot(z1 - z0, y1 - y0), ang = Math.atan2(y0 - y1, z1 - z0);
        const seg = new THREE.Group(); seg.position.set(tx, Y + (y0 + y1) / 2 + 0.06, tz + hw + (z0 + z1) / 2); seg.rotation.x = ang; play.add(seg);
        const bed = new THREE.Mesh(box(0.5, 0.03, len + 0.01), mSlide); bed.castShadow = true; seg.add(bed);
        for (const sx of [-0.27, 0.27]) { const w = new THREE.Mesh(box(0.04, 0.16, len + 0.01), mSlide); w.position.set(sx, 0.07, 0); w.castShadow = true; seg.add(w); }
      }
    }
    // two-seat swing: A-frame posts at each end, a top beam, chains and flat seats
    { const sx = CX - 2.6, sz = CZ + 1.2, span = 3.2, H = 2.3;
      for (const e of [-span / 2, span / 2]) { rod([sx + e, Y, sz - 0.75], [sx + e, Y + H, sz], 0.045, mPost); rod([sx + e, Y, sz + 0.75], [sx + e, Y + H, sz], 0.045, mPost); }
      rod([sx - span / 2 - 0.05, Y + H, sz], [sx + span / 2 + 0.05, Y + H, sz], 0.05, mPost);
      for (const e of [-0.75, 0.75]) {
        for (const c of [-0.2, 0.2]) rod([sx + e + c, Y + H, sz], [sx + e + c, Y + 0.45, sz], 0.008, mSteel);
        add(box(0.45, 0.04, 0.18), mSeat, sx + e, Y + 0.44, sz);
      }
    }
    // see-saw: a centre pivot and a tilted beam with two seats and handles
    { const qx = CX - 2.4, qz = CZ - 2.4;
      add(cyl(0.08, 0.45), mPost, qx, Y + 0.225, qz);
      const beam = new THREE.Group(); beam.position.set(qx, Y + 0.5, qz); beam.rotation.z = 0.16; play.add(beam);
      const b = new THREE.Mesh(box(3.0, 0.08, 0.18), mDeck); b.castShadow = true; beam.add(b);
      for (const e of [-1.3, 1.3]) { const st = new THREE.Mesh(box(0.3, 0.05, 0.26), mSeat); st.position.set(e, 0.07, 0); beam.add(st); const hd = new THREE.Mesh(cyl(0.02, 0.3, 8), mSteel); hd.position.set(e * 0.8, 0.2, 0); beam.add(hd); }
    }
    // two spring riders
    for (const [rx, rz, col] of [[CX + 0.3, CZ + 1.4, 0x8FA27A], [CX + 0.3, CZ + 3.0, 0xB0563A]]) {   // clear of the slide's run-out and the swings
      const coil = new THREE.Mesh(new THREE.TorusKnotGeometry(0.09, 0.015, 48, 6, 1, 6), mSteel); coil.scale.set(1, 2.2, 1); coil.position.set(rx, Y + 0.25, rz); play.add(coil);
      add(new THREE.SphereGeometry(0.28, 16, 12), M({ color: col, roughness: 0.45 }), rx, Y + 0.62, rz).scale.set(1.3, 0.75, 0.6);
      rod([rx - 0.12, Y + 0.85, rz - 0.15], [rx - 0.12, Y + 0.85, rz + 0.15], 0.02, mSteel);
    }
    // two benches facing the play area
    for (const [bx, bz, ry] of [[CX - W2 - 1.2, CZ, Math.PI / 2], [CX + W2 + 1.2, CZ, -Math.PI / 2]]) {
      const g = new THREE.Group(); g.position.set(bx, Y, bz); g.rotation.y = ry; play.add(g);
      const seat = new THREE.Mesh(box(1.8, 0.05, 0.42), mDeck); seat.position.y = 0.45; seat.castShadow = true; g.add(seat);
      const back = new THREE.Mesh(box(1.8, 0.4, 0.04), mDeck); back.position.set(0, 0.72, -0.2); back.castShadow = true; g.add(back);
      for (const e of [-0.75, 0.75]) { const leg = new THREE.Mesh(box(0.06, 0.45, 0.4), mPost); leg.position.set(e, 0.225, 0); g.add(leg); }
    }
  }
  // ---------- landscape (owner request, Nov 2026: "more tropical please, this is Malaysia"; illustrative) ----------
  // Kept minimal and all green (owner, Nov 2026: "no need so much trees, no need the red plants, minimal list,
  // tropical"): two rain trees on the green, foxtail palms along the estate road, the surveyed Persiaran street trees
  // as rain trees, a white frangipani either side of each entrance, a plain clipped hedge round the green (taller along
  // the pond and substation fences), spider lilies, lily-turf along the footpath, a darker lawn under the big canopies.
  // The plants are built in tropical.js and drawn as one instanced mesh per species part.
  {
    const land = new THREE.Group(); land.name = 'landscape'; root.add(land);
    const T = makeTropical({ THREE, material: M });
    const pipL = ([x, z], poly) => { let ins = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) ins = !ins; } return ins; };
    const dLine = ([x, z], pl) => { let d = Infinity; for (const [ax, az, bx, bz] of segs(pl)) { const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)); d = Math.min(d, Math.hypot(x - ax - t * dx, z - az - t * dz)); } return d; };
    const roadsL = [E.road.carriageway, ...(E.road.bellmouths || [])].filter(q => Array.isArray(q) && q.length > 2);
    const gateMids = E.gates.map(g => [(g.h[0][0] + g.h[1][0]) / 2, (g.h[0][1] + g.h[1][1]) / 2]), lightPts = (E.lights || []).map(l => l.xz);
    const nearAny = (q, pts, r) => pts.some(([x, z]) => Math.hypot(q[0] - x, q[1] - z) < r);
    // footpath loop: a 1.4 m paved band 1.6 m inside the edge of the green
    const ring = [...E.island.green, E.island.green[0]];
    const mPath = M({ map: repeatTex(tex.paving(2, '204,196,184'), 1), roughness: 0.9 });
    hd(mPath, 'concrete_paving', { su: 2, sv: 2, color: 'keep', normalScale: 0.6 });
    put(mPath, band(ring, 1.6, 3.0, -0.299)); flush(land, { cast: false, receive: true });
    // ----- planting -----
    const P = T.planter(), TAU = Math.PI * 2;
    const rotOf = (x, z) => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return (s - Math.floor(s)) * TAU; };   // repeatable, no Math.random
    const edgeD = q => distPoly(q, E.island.green);
    const inGreen = q => pipL(q, E.island.green);
    const onPath = (q, r) => inGreen(q) && edgeD(q) > 1.6 - r && edgeD(q) < 3.0 + r;
    const inPlay = (q, r) => q[0] > -42.3 - r && q[0] < -28.7 + r && q[1] > 44.3 - r && q[1] < 52.7 + r;   // safety surface, kerb, benches
    const paved = [E.road.carriageway, E.persiaran.carriageway, ...(E.road.bellmouths || [])].filter(q => Array.isArray(q) && q.length > 2 && Array.isArray(q[0]) && typeof q[0][0] === 'number');
    const wet = [E.persiaran.monsoon, E.persiaran.east_drain].filter(Boolean);
    // clear of roads, drains, gates, lamps, the pond and its path, the substation, slabs, plots, playground and footpath
    const free = (q, r = 0.5, { road = 1.0, lamp = 2.0, gate = 3.0, path = true } = {}) =>
      !paved.some(p => pipL(q, p) || distPoly(q, p) < road) &&
      !E.drains.some(dr => dLine(q, dr.c) < dr.W / 2 + r) && !wet.some(p => pipL(q, p) || distPoly(q, p) < r) &&
      !(E.persiaran.railings || []).some(pl => dLine(q, pl) < r) &&
      !nearAny(q, gateMids, gate) && !nearAny(q, lightPts, lamp) &&
      !(E.pond && (pipL(q, E.pond.lot) || distPoly(q, E.pond.lot) < r)) &&
      !pipL(q, E.island.tnb_lot) && !E.slabs.some(s => pipL(q, s)) && !E.plots.some(p => pipL(q, p.poly)) &&
      !inPlay(q, r) && !(path && onPath(q, r));
    const trunks = [], shadeAt = [];
    const tree = (kind, x, z, s, v, y = -0.32, o = {}) => {
      if (!free([x, z], o.r ?? 0.6, o) || nearAny([x, z], trunks, o.gap ?? 2.5)) return false;
      P.add(kind, x, y, z, { s, rot: rotOf(x, z), v }); trunks.push([x, z]);
      if (o.shade) shadeAt.push([x, z, T.INFO[kind].r * s, o.shadeY ?? -0.3015]);   // just over the green (-0.303), under the path
      return true;
    };
    const along = (pl, off, step, fn) => {   // points along a polyline at a side offset, with the segment direction
      for (const [ax, az, bx, bz, nx, nz] of segs(pl)) { const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / step));
        for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; fn(ax + (bx - ax) * t + nx * off, az + (bz - az) * t + nz * off, -Math.atan2(bz - az, bx - ax), L / n, t * L, L); } }
    };
    // the green: two rain trees on opposite corners, so the playground stays open to view; spider lilies at their feet
    for (const [k, x, z, s, v] of [['rain', -45.4, 45.6, 1.0, 0], ['rain', -27.0, 57.4, 0.92, 1]]) {
      if (!tree(k, x, z, s, v, -0.32, { shade: true })) continue;
      for (let i = 0; i < 3; i++) { const a = rotOf(x, z) + i * TAU / 3, q = [x + Math.cos(a) * 1.7, z + Math.sin(a) * 1.7]; if (free(q, 0.5)) P.add('crinum', q[0], -0.31, q[1], { s: 0.8, rot: a }); }
    }
    // the hedge round the green: plain clipped green, low where it faces the road, taller over the pond and substation
    // fences and the bin store; entries with a white frangipani either side in the middle of the long sides
    for (const [ax, az, bx, bz] of segs(ring)) {
      const L = Math.hypot(bx - ax, bz - az); if (L < 1.5) continue;
      const road = distPoly([(ax + bx) / 2, (az + bz) / 2], E.island.edge) < 0.3, entry = road && L > 12;
      along([[ax, az], [bx, bz]], road ? 0.7 : 0.6, road ? 1.15 : 1.35, (x, z, rot, step, s) => {
        if (entry && Math.abs(s - L / 2) < 1.6) return;
        if (nearAny([x, z], lightPts, 1.2) || nearAny([x, z], trunks, 0.8)) return;
        P.add('hedge', x, -0.31, z, { rot, sx: step / 1.15, v: road ? 0 : 1 });
      });
      if (entry) { const ux = (bx - ax) / L, uz = (bz - az) / L, nx = -uz, nz = ux;
        for (const sg of [-1, 1]) { const t = L / 2 + sg * 2.6; tree('frangipani', ax + ux * t + nx * 1.1, az + uz * t + nz * 1.1, 0.9, sg > 0 ? 1 : 0, -0.32, { path: false, gap: 2 }); } }
    }
    // spider lilies: a group of three every 16 m or so along the inside of the footpath, clear of trunks
    const bed = (x, z, n) => { for (let i = 0; i < n; i++) { const a = rotOf(x, z) + i * 2.4, d = i ? 0.75 : 0, q = [x + Math.cos(a) * d, z + Math.sin(a) * d];
      if (free(q, 0.45) && !nearAny(q, trunks, 1.3)) P.add('crinum', q[0], -0.31, q[1], { rot: a, s: 0.85 + (i % 3) * 0.08 }); } };
    along(ring, 4.0, 16, (x, z) => { if (inGreen([x, z]) && free([x, z], 0.8) && !nearAny([x, z], trunks, 2.4)) bed(x, z, 3); });
    // lily-turf along both edges of the footpath
    for (const off of [1.42, 3.18]) along(ring, off, 1.0, (x, z, rot, step) => {
      if (Math.abs(edgeD([x, z]) - off) > 0.2) return;   // only along the path's edge: at a corner the offset line runs on across the lawn (owner: "jogging path looking weird")
      if (!inGreen([x, z]) || nearAny([x, z], lightPts, 0.8) || nearAny([x, z], trunks, 0.7) || (E.pond && distPoly([x, z], E.pond.lot) < 0.6)) return;
      P.add('turf', x, -0.305, z, { rot, sx: step, tint: true });
    });
    // the estate road: foxtail palms every ~14 m on both verges, clear of the carriageway, drains, gates and lamp posts
    for (const [ax, az, bx, bz, nx, nz] of segs(E.road.centre)) {
      const L = Math.hypot(bx - ax, bz - az);
      for (let t = 4; t < L - 3; t += 14) {
        const px = ax + (bx - ax) * t / L, pz = az + (bz - az) * t / L;
        for (const sg of [1, -1]) for (let d = 3; d < 9; d += 0.25) {
          const q = [px + sg * nx * d, pz + sg * nz * d];
          if (roadsL.some(r => pipL(q, r) || distPoly(q, r) < 1.7)) continue;   // clear of the kerb and footway
          if (!pipL(q, E.road.reserve) && !pipL(q, E.island.edge)) break;
          if (E.drains.some(dr => dLine(q, dr.c) < dr.W / 2 + 0.7) || nearAny(q, gateMids, 3.0) || nearAny(q, lightPts, 2.6)) continue;
          if (E.gates.some(g => dLine(q, g.h) < 4.6)) continue;   // never in front of a driveway (owner: "shouldnt be a tree here infront of drive way")
          if (E.pond && (pipL(q, E.pond.lot) || distPoly(q, E.pond.lot) < 1.0)) continue;   // none in the pond or on its path
          if (pipL(q, E.island.tnb_lot) || distPoly(q, E.island.tnb_lot) < 1.6) continue;   // nor over the substation
          if (!nearAny(q, trunks, 3.5)) { P.add('foxtail', q[0], -0.32, q[1], { s: 0.92 + ((Math.abs(q[0] * 7 + q[1] * 3) | 0) % 5) * 0.03, rot: rotOf(q[0], q[1]), v: (t / 14) | 0 }); trunks.push(q); }
          break;
        }
      }
    }
    // the Persiaran: the surveyed street trees as rain trees; a white frangipani just outside each entrance
    const Y0 = -0.34;   // Persiaran verge level
    for (const [x, z] of E.trees) tree('rain', x, z, 0.82, (Math.abs(Math.round(z)) % 2), Y0, { shade: true, shadeY: -0.3285, lamp: 2.5, gap: 4 });   // patch between the verge and the drain beds
    const vergeMid = (z, xa = -3, xb = 16) => {   // the middle of the widest clear stretch of Persiaran verge at this z
      let run = null, best = null;
      for (let x = xa; x <= xb; x += 0.2) { const ok = pipL([x, z], E.persiaran.reserve) && free([x, z], 0.9, { lamp: 2.5, gate: 0 });
        if (ok && run === null) run = x; if ((!ok || x > xb - 0.1) && run !== null) { if (!best || x - run > best[1] - best[0]) best = [run, x]; run = null; } }
      return best && best[1] - best[0] > 1.8 ? (best[0] + best[1]) / 2 : null;
    };
    // entrances: just outside each drain crossing, a white frangipani either side
    for (const s of E.slabs) {
      const z0 = Math.min(...s.map(p => p[1])), z1 = Math.max(...s.map(p => p[1]));
      for (const [z, sg] of [[z0, -1], [z1, 1]]) {
        const near = d => { for (let k = 0; k < 6; k++) { const zz = z + sg * (d + k * 1.2), x = vergeMid(zz, -3, 12); if (x != null) return [x, zz]; } return null; };
        const f = near(1.8); if (f) tree('frangipani', f[0], f[1], 1.05, sg > 0 ? 1 : 0, Y0, { lamp: 2.5, gap: 2, r: 0.5 });
      }
    }
    // ----- house gardens (owner, Nov 2026: tropical planting inside every plot, Semi-D and bungalow alike) -----
    // One layout per house type in the house's own frame (placeM; mirrored BG-003 by moving points only, never a
    // mirrored instance), then a rule per plot edge: lily-turf 0.35 m inside street and Persiaran fences, a clipped
    // hedge 0.5 m inside neighbour fences beside the house (clear of the 150 mm wall), cut 0.45 m short of the other
    // edges. Every spot must sit inside its own plot, clear of paving, aprons, drains, cars, gates (and their swing)
    // and other trees (3.5 m); a spot that fails tries the next one in its list or is dropped. Every placement is
    // planted, the walked homes too, so the walk, the live build and the pack show the same garden.
    const garden = {};
    {
      const KINDS = ['frangipani', 'foxtail', 'crinum', 'turf', 'hedge'], g0 = {}; for (const k of KINDS) g0[k] = P.count(k);
      const rect = (q, r, m) => q[0] > r[0] - m && q[0] < r[2] + m && q[1] > r[1] - m && q[1] < r[3] + m;
      const hit = (q, polys, m) => polys.some(p => inPoly(q, p) || distPoly(q, p) < m);
      // Semi-D no-plant rectangles, left unit (x < 0; the right unit mirrors), as walk.js draws them: house, porch,
      // side patio, rear aprons, perimeter drains, and a clear way out of the back door
      const SD_NO = [[-6.72, -13.255, 0, 0], [-6.87, 0.6, 0, 6.7], [-7.985, -8.59, -6.72, 0.6], [-7.32, -13.855, -0.075, -13.255], [-7.32, -13.255, -6.72, -8.59],
        [-8.285, -8.891, -7.985, 0.9], [-7.62, -14.155, -7.32, -8.891], [-7.62, -14.155, -0.075, -13.855], [-5.9, -15.9, -4.3, -14.155]];
      const BX = models.bungalow && models.bungalow.X, BR = BX ? BX.porch.r : [-0.53, 0, 7.62, 5.6], BAP = BX && BX.porch.apron_polygon;
      const hull = pts => { const Q = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
        const lo = [], hi = []; for (const q of Q) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
        for (const q of Q.reverse()) { while (hi.length > 1 && cr(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
        return lo.slice(0, -1).concat(hi.slice(0, -1)); };
      const LAY = {   // [kind, scale, spots in the house frame (Semi-D: left unit), tried in order, lilies at its foot]
        semid: [['frangipani', 0.75, [[-7.95, 4.3], [-7.85, 2.2]]], ['crinum', 0.8, [[-7.4, 5.95], [-7.35, 1.5]]], ['crinum', 0.8, [[-8.55, 5.9], [-8.45, 1.6]]], ['foxtail', 0.75, [[-11.6, -9.0]]],
          // the two corner plots' side gardens only (no other plot reaches this far out): a white frangipani at each end,
          // spider lilies at its feet (owner, Nov 2026: "the corner lots can put more landscape")
          ['frangipani', 0.8, [[-12.0, 1.4], [-11.7, 2.4], [-11.6, 0.2]], 3], ['frangipani', 0.75, [[-12.3, -13.0], [-11.9, -12.3], [-12.6, -11.6]], 3]],
        bungalow: [['foxtail', 0.85, [[-9.2, 6.9], [-8.0, 4.4]]], ['frangipani', 0.9, [[-5.0, 4.6], [-2.5, 3.9]], 3], ['frangipani', 0.8, [[9.5, -6.6], [0, -10.75]]]],   // palm first: BG-003's frangipani steps aside for it
      };
      const CLR = { frangipani: 0.8, foxtail: 0.9, crinum: 0.74, turf: 0.3, hedge: 0.4 };    // least distance from the plot's own fences
      const NOM = { frangipani: 0.6, foxtail: 0.8, crinum: 0.45, turf: 0.15, hedge: 0.4 };   // ... from paving, aprons, drains and cars
      const SWING = { frangipani: 1.3, foxtail: 1.3, crinum: 1.2, turf: 0.3, hedge: 0.6 };   // ... from a gate and its leaves swung open
      const lilies = [], turfAt = []; let nf = 0;
      // corner side gardens (owner, Nov 2026: "the corner lots can put more landscape? maybe swing? or like a walk path"):
      // stepping stones from the porch round the side garden to the back, and a timber A-frame garden swing facing the house
      const extra = [];   // their footprints (world): the planting below keeps off them
      const mStone = M({ color: 0xC9C1B4, roughness: 0.92 }), mTimber = M({ color: 0x8E6444, roughness: 0.72 });
      const mRope = M({ color: 0xD9CCB4, roughness: 0.85 }), mCushion = M({ color: 0xE9DFCF, roughness: 0.95 });
      const xtra = new Map();   // material -> geometries (world), merged once at the end
      const xput = (mat, g) => { if (!xtra.has(mat)) xtra.set(mat, []); xtra.get(mat).push(clean(g)); };
      const beam = (A, B, w, d, mat, Mx) => {   // a timber (or rope) of w x d section from A to B, in a swing's own frame
        const a = V(...A), b = V(...B), g = new THREE.BoxGeometry(w, a.distanceTo(b), d);
        const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
        g.applyMatrix4(new THREE.Matrix4().compose(a.clone().lerp(b, 0.5), q, V(1, 1, 1))); g.applyMatrix4(Mx); xput(mat, g);
      };
      const slab = (cx, cy, cz, w, h, d, mat, Mx) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(cx, cy, cz); g.applyMatrix4(Mx); xput(mat, g); };
      for (const pl of placements) {
        const Mp = placeM(pl.o, pl.rot, pl.mirror), Mi = Mp.clone().invert(), sd = pl.kind === 'semid';
        const W = ([x, z]) => { const v = V(x, 0, z).applyMatrix4(Mp); return [v.x, v.z]; };
        const Lc = ([x, z]) => { const v = V(x, 0, z).applyMatrix4(Mi); return [v.x, v.z]; };
        // the cars as parked when the estate is built (estate.json carPark, or the type's car spots and carShift)
        const cars = [], own = E.carPark && E.carPark[pl.id], sh = E.carShift && E.carShift[pl.id];
        if (own) for (const [x, z, deg] of own) { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
          cars.push([[-0.9, -2.275], [0.9, -2.275], [0.9, 2.275], [-0.9, 2.275]].map(([lx, lz]) => [x + lx * c + lz * s, z - lx * s + lz * c])); }
        else for (const c of carSpots[pl.kind] || []) cars.push([[c.x0, c.z0], [c.x1, c.z0], [c.x1, c.z1], [c.x0, c.z1]].map(q => { const w = W(q); return sh ? [w[0] + sh[0], w[1] + sh[1]] : w; }));
        // bungalow: porch, apron round the house and the drive out to the gate (as the slot loop paves them)
        const pave = [];
        if (!sd) {
          pave.push([[BR[0], BR[1]], [BR[2], BR[1]], [BR[2], BR[3]], [BR[0], BR[3]]]); if (BAP) pave.push(BAP);
          const gt = E.gates.find(q => pl.plots.includes(q.plot)), dr = E.drives && E.drives[pl.plots[0]];
          if (gt) { const h = gt.h.map(Lc).sort((a, b) => a[0] - b[0]);
            if (dr) { const d = dr.map(Lc), pc = [(BR[0] + BR[2]) / 2, BR[3]], near = d.slice().sort((a, b) => Math.hypot(a[0] - pc[0], a[1] - pc[1]) - Math.hypot(b[0] - pc[0], b[1] - pc[1]));   // the strip's two corners nearest the porch, as the slot loop paves it
              pave.push(d, hull([[BR[0] + 0.5, BR[3]], [BR[2], BR[3]], near[0], near[1]])); }
            else pave.push([[BR[0] + 0.5, BR[3]], [BR[2], BR[3]], h[1], h[0]]); }
        }
        const noL = (q, m) => sd ? SD_NO.some(r => rect([-Math.abs(q[0]), q[1]], r, m)) : (rect(q, [-7.37, -8.55, 7.37, 0], m) || hit(q, pave, m));
        for (const id of pl.plots) {
          const plot = E.plots.find(p => p.id === id); if (!plot) continue;
          const poly = plot.poly, polyL = poly.map(Lc), mate = pl.plots.filter(p => p !== id);
          const S = sd ? (Math.sign(polyL.reduce((a, q) => a + q[0], 0)) || -1) : -1;   // Semi-D: -1 the left unit, +1 the right
          const fx = ([x, z]) => [-S * x, z];                                              // a layout spot in this unit's frame
          const others = E.plots.filter(p => p.id !== id && !mate.includes(p.id)).map(p => p.poly);
          const cen = poly.reduce((a, q) => [a[0] + q[0] / poly.length, a[1] + q[1] / poly.length], [0, 0]);
          const gates = E.gates.filter(g => g.plot === id).map(({ h: [A, B] }) => {   // the gate line and both leaves swung into the plot
            const L0 = Math.hypot(B[0] - A[0], B[1] - A[1]), ux = (B[0] - A[0]) / L0, uz = (B[1] - A[1]) / L0, m = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
            let nx = -uz, nz = ux; if ((cen[0] - m[0]) * nx + (cen[1] - m[1]) * nz < 0) { nx = -nx; nz = -nz; }
            const half = L0 / 2; return { A, B, ux, uz, nx, nz, L0, segs: [[A, B], [A, [A[0] + nx * half, A[1] + nz * half]], [B, [B[0] + nx * half, B[1] + nz * half]]] };
          });
          const swept = (q, g) => { const rx = q[0] - g.A[0], rz = q[1] - g.A[1], t = rx * g.ux + rz * g.uz, n = rx * g.nx + rz * g.nz; return t > -0.1 && t < g.L0 + 0.1 && n > -0.1 && n < g.L0 / 2 + 0.1; };
          const ok = (q, k, clr = CLR[k], swing = SWING[k]) => {
            if (!inPoly(q, poly) || distPoly(q, poly) < clr) return false;
            if (noL(Lc(q), NOM[k]) || hit(q, cars, NOM[k]) || hit(q, extra, Math.min(NOM[k], 0.3))) return false;
            return !gates.some(g => swept(q, g) || g.segs.some(s => dLine(q, s) < swing));
          };
          // a corner plot (its side garden reaches past x -11.5, left-unit frame): the path and the swing first
          if (sd && Math.min(...polyL.map(q => -S * q[0])) < -11.5) {
            const G0 = -0.3;   // the lawn
            // stepping stones, about 0.72 m apart: off the porch edge, out round the side garden past the swing, to the back
            const curve = new THREE.CatmullRomCurve3([[-7.95, 4.5], [-9.1, 3.3], [-9.9, 0.9], [-9.8, -2.3], [-9.5, -4.4], [-9.8, -6.9], [-10.0, -9.6], [-9.7, -12.1], [-8.9, -14.7]]
              .map(([x, z]) => V(x, 0, z)), false, 'centripetal');
            const n = Math.round(curve.getLength() / 0.72);
            for (let i = 0; i <= n; i++) {
              const u = i / n, c = curve.getPointAt(u), t = curve.getTangentAt(u), q = W(fx([c.x, c.z])), q2 = W(fx([c.x + t.x, c.z + t.z]));
              if (!inPoly(q, poly) || distPoly(q, poly) < 0.6 || hit(q, cars, 0.4)) continue;
              const yaw = Math.atan2(-(q2[1] - q[1]), q2[0] - q[0]) + Math.PI / 2 + (rotOf(q[0], q[1]) - Math.PI) * 0.06;
              const g = new THREE.CylinderGeometry(0.3, 0.31, 0.05, 14); g.scale(1 + (rotOf(q[1], q[0]) / TAU - 0.5) * 0.12, 1, 0.66);
              g.applyMatrix4(new THREE.Matrix4().compose(V(q[0], G0 + 0.013, q[1]), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), V(1, 1, 1)));
              xput(mStone, g);
              extra.push([[q[0] - 0.34, q[1] - 0.34], [q[0] + 0.34, q[1] - 0.34], [q[0] + 0.34, q[1] + 0.34], [q[0] - 0.34, q[1] + 0.34]]);
            }
            // the swing: a two-seat bench on ropes under an A-frame, facing the house across the path
            { const c = W(fx([-11.3, -4.4])), f = W(fx([-10.3, -4.4])), yaw = Math.atan2(-(f[1] - c[1]), f[0] - c[0]);
              const Mx = new THREE.Matrix4().compose(V(c[0], G0, c[1]), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), V(1, 1, 1));
              const H = 2.15, Z = 1.15, L = 0.8;   // top beam height, half span, leg splay
              for (const z of [-Z, Z]) {
                beam([-L, 0, z], [0, H, z], 0.085, 0.085, mTimber, Mx); beam([L, 0, z], [0, H, z], 0.085, 0.085, mTimber, Mx);
                beam([-L * 0.72, 0.6, z], [L * 0.72, 0.6, z], 0.06, 0.05, mTimber, Mx);   // tie at knee height
              }
              slab(0, H + 0.03, 0, 0.11, 0.13, 2 * Z + 0.3, mTimber, Mx);   // top beam
              const ys = 0.46, hw = 0.68;   // seat height, the bench's half length
              slab(0.03, ys, 0, 0.5, 0.05, 2 * hw, mTimber, Mx);   // seat
              beam([-0.22, ys + 0.02, 0], [-0.3, ys + 0.48, 0], 0.04, 2 * hw, mTimber, Mx);   // backrest, leaning back
              for (const z of [-hw, hw]) { slab(0.03, ys + 0.24, z, 0.46, 0.04, 0.05, mTimber, Mx); slab(0.24, ys + 0.12, z, 0.04, 0.24, 0.05, mTimber, Mx); }   // arms
              slab(0.04, ys + 0.055, 0, 0.42, 0.06, 2 * hw - 0.1, mCushion, Mx);   // seat cushion
              for (const z of [-hw + 0.05, hw - 0.05]) { beam([0.2, ys, z], [0.02, H - 0.04, z], 0.018, 0.018, mRope, Mx); beam([-0.25, ys + 0.45, z], [-0.02, H - 0.04, z], 0.018, 0.018, mRope, Mx); }
              const fp = [[-L - 0.2, -Z - 0.2], [L + 0.2, -Z - 0.2], [L + 0.2, Z + 0.2], [-L - 0.2, Z + 0.2]].map(([x, z]) => { const v = V(x, 0, z).applyMatrix4(Mx); return [v.x, v.z]; });
              extra.push(fp); trunks.push(c);   // nothing planted under it, no tree crowding it
            }
          }
          // trees and lilies from the layout
          for (const [k, s, spots, foot] of LAY[pl.kind]) for (const sp of spots) {
            const q = W(fx(sp));
            if (!ok(q, k) || nearAny(q, trunks, k === 'crinum' ? 0.8 : 3.5)) continue;   // a lily may stand at a tree's foot
            if (k === 'crinum') { P.add(k, q[0], -0.31, q[1], { s, rot: rotOf(q[0], q[1]) }); lilies.push(q); break; }
            P.add(k, q[0], -0.32, q[1], { s, rot: rotOf(q[0], q[1]), v: k === 'frangipani' ? nf++ % 2 : 0 }); trunks.push(q);
            for (let i = 0; i < (foot || 0); i++) { const a = rotOf(q[0], q[1]) + i * TAU / 3, p = [q[0] + Math.cos(a) * 1.7, q[1] + Math.sin(a) * 1.7];
              if (ok(p, 'crinum')) { P.add('crinum', p[0], -0.31, p[1], { s: 0.8, rot: a }); lilies.push(p); } }
            break;
          }
          // bungalow: a smaller spider lily just past each gate pier, clear of the leaf when it swings open
          if (!sd) for (const g of gates) for (const [p0, dir] of [[g.A, -1], [g.B, 1]]) for (const d of [1.5, 1.3, 1.15, 0.9]) {
            const q = [p0[0] + g.ux * dir * d + g.nx * 0.75, p0[1] + g.uz * dir * d + g.nz * 0.75];
            if (!ok(q, 'crinum', 0.6, 0.85) || nearAny(q, trunks, 0.8) || nearAny(q, lilies, 1.0)) continue;
            P.add('crinum', q[0], -0.31, q[1], { s: 0.55, rot: rotOf(q[0], q[1]) }); lilies.push(q); break;
          }
          // along each fence: turf inside street and Persiaran fences, hedge inside neighbour fences beside the house
          const zb = sd ? [-8.9, 0.9] : [-9.75, 1.2], OFF = { turf: 0.35, hedge: 0.5 }, PITCH = { turf: 1.0, hedge: 1.1 };
          for (let e = 0; e < poly.length; e++) {
            const a = poly[e], b = poly[(e + 1) % poly.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < 1) continue;
            const ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len, m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
            let nx = -uz, nz = ux; if (!inPoly([m[0] + nx * 0.2, m[1] + nz * 0.2], poly)) { nx = -nx; nz = -nz; }
            const rest = poly.map((p, j) => [p, poly[(j + 1) % poly.length]]).filter((_, j) => j !== e);
            const at = (t, k) => [a[0] + ux * t + nx * OFF[k], a[1] + uz * t + nz * OFF[k]];
            const kindAt = t => { const f = [a[0] + ux * t, a[1] + uz * t];
              if (distPoly(f, E.road.reserve) < 0.6 || distPoly(f, E.persiaran.reserve) < 0.8) return 'turf';
              return others.some(p => distPoly(f, p) < 0.3) ? 'hedge' : null; };
            const valid = (t, k) => { const q = at(t, k);
              if (rest.some(s => dLine(q, s) < (k === 'hedge' ? 0.45 : 0.3)) || !ok(q, k)) return false;
              if (k === 'hedge') { const z = Lc(q)[1]; if (z < zb[0] || z > zb[1]) return false; }
              return !nearAny(q, trunks, k === 'hedge' ? 0.8 : 0.7) && !(k === 'turf' && nearAny(q, lilies, 0.35)); };
            const runs = []; let cur = null;
            for (let t = 0; t <= len + 1e-6; t += 0.05) { let k = kindAt(t); if (k && !valid(t, k)) k = null;
              if (cur && cur.k === k) cur.t1 = t; else { if (cur && cur.k) runs.push(cur); cur = { k, t0: t, t1: t }; } }
            if (cur && cur.k) runs.push(cur);
            for (const { k, t0, t1 } of runs) {
              const Lr = t1 - t0; if (Lr < (k === 'hedge' ? 1.6 : 0.6)) continue;   // no lone hedge stubs in corners
              const n = Math.max(1, Math.round(Lr / PITCH[k])), step = Lr / n, rot = -Math.atan2(uz, ux);
              for (let i = 0; i < n; i++) { const q = at(t0 + (i + 0.5) * step, k);
                if (k === 'hedge') P.add('hedge', q[0], -0.31, q[1], { rot, s: 0.9, sx: step / (1.15 * 0.9), v: 1 });
                else { P.add('turf', q[0], -0.305, q[1], { rot, sx: step, tint: true }); turfAt.push(q); } }
            }
          }
          // lily-turf inside the garden: along the porch edge (Semi-D) and the rear fence, clear of the back door
          const zr = Math.min(...polyL.map(q => q[1])) + (sd ? 0.4 : 0.39);
          const lines = sd ? [[[-7.15, 1.1], [-7.15, 5.3]], [[-9.0, zr], [-6.0, zr]], [[-4.2, zr], [-0.4, zr]]] : [[[-9.3, zr], [-6.3, zr]], [[-4.6, zr], [10.9, zr]]];
          for (const [p0, p1] of lines) along([W(fx(p0)), W(fx(p1))], 0, 1.0, (x, z, rot, step) => {
            const q = [x, z]; if (!ok(q, 'turf') || nearAny(q, trunks, 0.7) || nearAny(q, lilies, 0.35) || nearAny(q, turfAt, 0.6)) return;
            P.add('turf', x, -0.305, z, { rot, sx: step, tint: true }); turfAt.push(q);
          });
        }
      }
      for (const k of KINDS) garden[k] = P.count(k) - g0[k];
      for (const [mat, gs] of xtra) { const m = new THREE.Mesh(mergeGeometries(gs), mat); m.name = 'corner-garden'; m.castShadow = mat !== mStone; m.receiveShadow = true; land.add(m); }
      garden.stones = (xtra.get(mStone) || []).length;
    }
    const pstats = P.build(land);
    // darker lawn under the big canopies: the lawn's own photo map, a shade darker, in soft-edged patches
    if (shadeAt.length) {
      const mShade = grass(0xBCD6A6, 2.5); mShade.alphaMap = T.shadeAlpha(); mShade.alphaTest = 0.5;   // the lawn tint, about 15% darker
      const im = new THREE.InstancedMesh(T.shadeGeometry(), mShade, shadeAt.length), m4 = new THREE.Matrix4(), qq = new THREE.Quaternion();
      shadeAt.forEach(([x, z, r, y], i) => { const s = r * 1.7 / 10; qq.setFromAxisAngle(V(0, 1, 0), rotOf(z, x)); m4.compose(V(x + 0.6 * s, y, z - 0.5 * s), qq, V(s, 1, s)); im.setMatrixAt(i, m4); });
      im.receiveShadow = true; im.name = 'tropical-shade'; land.add(im);
    }
    land.userData.stats = pstats; land.userData.garden = garden;
  }
  // Oil palm estate to the west and south (survey: Ladang Kelapa Sawit, lots 936 and 24481).
  {
    const trunkG = new THREE.CylinderGeometry(0.25, 0.32, 6, 8); trunkG.translate(0, 3 - 0.3, 0);
    const frond = [];
    for (let i = 0; i < 16; i++) {
      const g = new THREE.PlaneGeometry(1.5, 4.2, 1, 6); const p = g.attributes.position;
      for (let k = 0; k < p.count; k++) { const v = (p.getY(k) + 2.1) / 4.2; p.setXYZ(k, p.getX(k) * (1 - v * 0.7), v * 4.2, -Math.pow(v, 2) * 1.6); }
      g.rotateX(-0.9 - (i % 2) * 0.35); g.rotateY(i / 16 * Math.PI * 2); g.translate(0, 5.6, 0); frond.push(clean(g));
    }
    const frondG = mergeGeometries(frond); frondG.computeVertexNormals();
    const mTrunk = M({ color: 0x5E5040, roughness: 0.95 }), mFrond = M({ map: tex.frond(), color: 0x6F8048, roughness: 0.85, alphaTest: 0.5, side: THREE.DoubleSide });
    const spots = [];
    for (let x = -135; x <= -97; x += 8.5) for (let z = -20; z <= 150; z += 8.5) spots.push([x + ((z / 8.5) % 2) * 4.2, z]);
    for (let x = -92; x <= 2; x += 8.5) for (let z = 106; z <= 150; z += 8.5) { const px = x + ((z / 8.5) % 2) * 4.2; if (px < -10.5) spots.push([px, z]); }   // stop short of the Persiaran reserve (x -8.7 on), owner: "trees on road"
    const it = new THREE.InstancedMesh(trunkG, mTrunk, spots.length), ifr = new THREE.InstancedMesh(frondG, mFrond, spots.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion();
    spots.forEach(([x, z], i) => { const s = 0.85 + ((i * 37) % 10) / 30; q.setFromAxisAngle(V(0, 1, 0), i * 2.4); m.compose(V(x, 0, z), q, V(s, s, s)); it.setMatrixAt(i, m); ifr.setMatrixAt(i, m); });
    it.castShadow = ifr.castShadow = true; root.add(it, ifr);
  }

  // Place the estate so the walked home's plot lands on the model.
  if (!ALL) root.matrix.copy(placeM(walked.o, walked.rot, walked.mirror)).invert();
  root.matrixWorldNeedsUpdate = true;
  const toModel = (x, z) => V(x, 0, z).applyMatrix4(root.matrix);

  let wasOpaque = null;
  function update(real, dusk = 0) {
    root.visible = real > 0.01; houses.visible = real > 0.5;
    const opaque = real > 0.995;
    for (const m of fadeMats) { m.opacity = real; if (opaque !== wasOpaque) { m.transparent = !opaque; m.needsUpdate = true; } }
    wasOpaque = opaque;
    mLamp.emissiveIntensity = 2.2 * dusk;
  }
  return { root, update, toModel, walked, setHouses, centre: toModel(-42, 48), houses, placements, placeM, fadeMats, mLamp };
}
