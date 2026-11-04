// Panthera Bertam estate: all 19 homes on their plots, the estate road, the central green with the dry pond and
// the TNB substation, boundary walls and gates, street lights, the Persiaran in front, from estate.json (verified
// against the amended CAD site plan, SL1 and TD-01). Estate frame: origin at the NE lot corner, x east, z south,
// y = RL - 5.800 (house floor = 0). The whole estate is placed so the walked home sits on its own plot.
//
// Houses other than the walked one are built as light shells (walls, glazing, roof, balconies, porch paving)
// from the same plan data the walkthrough uses, shared between plots.

export function buildEstate(ctx) {
  const { THREE, E, home, models, mats, tex, polyGeometry, mergeGeometries, makeTree, carSpots = {}, carKit = null } = ctx;
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
  const buckets = new Map();   // material -> geometries, merged at the end (few draw calls)
  const put = (mat, g) => { if (!buckets.has(mat)) buckets.set(mat, []); buckets.get(mat).push(clean(g)); };
  const flush = (parent, { cast = false, receive = true } = {}) => {
    for (const [mat, gs] of buckets) {
      const m = new THREE.Mesh(mergeGeometries(gs), mat); m.castShadow = cast; m.receiveShadow = receive; parent.add(m);
    }
    buckets.clear();
  };
  // flat polygon [[x,z]...] at height y, uv in metres
  const fill = (poly, y) => { const g = new THREE.ShapeGeometry(new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)))); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); return g; };
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
  const grass = (tint, m) => M({ map: repeatTex(tex.grass(), m), color: tint, roughness: 1 });
  const mLawn = grass(0xFFFFFF, 2.5), mVerge = grass(0xF2F5EA, 2.5), mScrub = grass(0xB9C2A0, 3.5), mGreen = grass(0xFFFFFF, 2.2), mPond = grass(0xD8E2C0, 2.2);
  const mAsphalt = M({ map: repeatTex(tex.asphalt(), 3), roughness: 0.95 });
  const mLine = M({ color: 0xF2EFE8, roughness: 0.6 });
  const mConc = M({ map: repeatTex(tex.paving(1, '170,166,158'), 2), roughness: 0.95 });
  const mDrain = M({ color: 0x3E3B37, roughness: 0.9 });
  const mPave = M({ map: repeatTex(tex.paving(4, '178,170,160'), 2.4), roughness: 0.9 });
  const mWallE = M({ color: mats.wall.color.getHex(), roughness: 0.95 });
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
  const walked = placements.find(p => p.kind === home && (home === 'semid' ? p.id === 'pair_002_001' : p.id === 'bungalow_001'));
  const walkedPolys = E.plots.filter(p => walked.plots.includes(p.id)).map(p => p.poly);
  const houses = new THREE.Group(); root.add(houses);
  const slots = { semid: [], bungalow: [] };
  for (const pl of placements) {
    if (pl === walked) continue;
    const g = new THREE.Group(); g.matrixAutoUpdate = false; g.matrix.copy(placeM(pl.o, pl.rot, pl.mirror)); houses.add(g); slots[pl.kind].push(g);
    const { D, X } = models[pl.kind];
    const pave = [];
    if (pl.kind === 'semid') pave.push(fill([[-6.87, 0.6], [6.87, 0.6], [6.87, 6.7], [-6.87, 6.7]], -0.295));
    else {   // bungalow: the car porch, then a driveway angled out to its gate on the corner splay
      const r = X.porch.r; pave.push(fill([[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]], -0.295));
      const gt = E.gates.find(q => pl.plots.includes(q.plot));
      if (gt) {
        const inv = g.matrix.clone().invert(), h = gt.h.map(([x, z]) => { const v = V(x, 0, z).applyMatrix4(inv); return [v.x, v.z]; }).sort((a, b) => a[0] - b[0]);
        pave.push(fill([[r[0] + 0.5, r[3]], [r[2], r[3]], h[1], h[0]], -0.2955));
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
    const spots = [];
    for (const kind of ['semid', 'bungalow']) for (const g of slots[kind]) for (const c of carSpots[kind] || []) {
      const cx = (c.x0 + c.x1) / 2, cz = (c.z0 + c.z1) / 2, along = Math.abs(c.z1 - c.z0) >= Math.abs(c.x1 - c.x0);
      const m = new THREE.Matrix4().compose(V(cx, -0.3, cz), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), along ? 0 : Math.PI / 2), V(1, 1, 1));
      spots.push(g.matrix.clone().multiply(m));
    }
    const cols = [0xE9E9E6, 0x3B4248, 0x8C9196, 0x2B3A4F, 0xB8B2A6, 0x7A1F24, 0x1E1F21, 0xD7D2C8];
    if (spots.length && carKit) {   // the detailed car, instanced per material; paint colour varies per car
      for (const { material, geometry, paint } of carKit) {
        const im = new THREE.InstancedMesh(geometry, material, spots.length);
        spots.forEach((M4, i) => { im.setMatrixAt(i, M4); if (paint) im.setColorAt(i, new THREE.Color(cols[(i * 5 + 1) % cols.length])); });
        im.castShadow = !material.transparent; im.receiveShadow = true; houses.add(im);
      }
    } else if (spots.length) {
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
        im.castShadow = true; im.receiveShadow = true; houses.add(im);
      }
    }
  }

  // ---------- ground ----------
  put(mScrub, fill([[-300, -230], [220, -230], [220, 320], [-300, 320]], -0.36));
  put(mLawn, fill(E.lot, -0.31));
  for (const p of E.plots) put(mLawn, fill(p.poly, -0.306));
  put(mVerge, fill(E.road.reserve, -0.304));
  put(mAsphalt, fill(E.road.carriageway, -0.299));
  for (const b of E.road.bellmouths) put(mAsphalt, fill(b, -0.2985));
  for (const s of E.slabs) put(mConc, fill(s, -0.297));
  for (const g of dashes(E.road.centre, 2.5, 1.25, 0.12, -0.292)) put(mLine, g);
  for (const d of E.drains) { put(mConc, ribbon(d.c, d.W, -0.296)); put(mDrain, ribbon(d.c, d.w, -0.294)); }
  // the Persiaran in front of the estate
  put(mVerge, fill(E.persiaran.reserve, -0.33));
  put(mAsphalt, fill(E.persiaran.carriageway, -0.31));
  for (const g of dashes(E.persiaran.centre, 3, 6, 0.12, -0.302)) put(mLine, g);
  put(mDrain, fill(E.persiaran.monsoon, -0.325)); put(mDrain, fill(E.persiaran.east_drain, -0.325));
  // central island: the green, the dry detention pond (a grassed basin), TNB substation, bin site, hydrants
  put(mGreen, fill(E.island.edge, -0.303));
  const top = E.island.pond_top, flo = E.island.pond_floor, py = E.island.pond_y;
  put(mPond, fill(flo, py));
  { const pos = [];
    for (let i = 0; i < top.length; i++) { const j = (i + 1) % top.length, a = [top[i][0], -0.302, top[i][1]], b = [top[j][0], -0.302, top[j][1]], c = [flo[j][0], py, flo[j][1]], d = [flo[i][0], py, flo[i][1]];
      pos.push(...a, ...c, ...b, ...a, ...d, ...c); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    const n = g.attributes.normal; if (n.getY(0) < 0) { for (let k = 0; k < pos.length; k += 9) { const t = pos.slice(k + 3, k + 6); pos.splice(k + 3, 3, ...pos.slice(k + 6, k + 9)); pos.splice(k + 6, 3, ...t); } g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); }
    const uv = []; for (let k = 0; k < pos.length; k += 3) uv.push(pos[k], pos[k + 2]); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    put(mPond, g); }
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
      const n = Math.max(1, Math.ceil(L / 0.25)); let run = null;
      const p = t => [a[0] + (b[0] - a[0]) * t / L, a[1] + (b[1] - a[1]) * t / L];
      const emit = (t0, t1) => { if (t1 - t0 < 0.05) return;
        if (isFront && t1 - t0 > 2.5) ventRun(p(t0), p(t1));
        else { put(mWallE, boxSeg(p(t0), p(t1), 0.15, -0.3, 1.15)); put(mCope, boxSeg(p(t0), p(t1), 0.2, 1.15, 1.2)); } };
      for (let k = 0; k <= n; k++) {
        const t = L * k / n, q = p(t);
        const skip = home === 'semid' && walkedPolys.some(poly => inPoly(q, poly) || distPoly(q, poly) < 0.3);   // the walked Semi-D draws its own fences
        if (!skip && run === null) run = t;
        if ((skip || k === n) && run !== null) { emit(run, skip ? Math.max(run, t - L / n) : t); run = null; }
      }
    }
  }
  // Gates: two swing leaves of black flat bars at 250 mm in a frame (1.40 m high), shut.
  const mGateM = M({ color: 0x1F1D1C, roughness: 0.5, metalness: 0.4 });
  const plotOf = id => E.plots.find(p => p.id === id);
  for (const g of E.gates) {
    const mine = walked.plots.includes(g.plot);
    if (mine && home === 'semid') continue;                       // the walked Semi-D draws its own gate
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
  }

  // ---------- street lights (SL1): 9 m concrete poles, single arm, LED head ----------
  for (const l of E.lights) {
    const H = l.t === 'A' || l.t === 'D' ? 9 : 8, [x, z] = l.xz;
    const pole = new THREE.CylinderGeometry(0.075, 0.13, H, 10); pole.translate(x, -0.3 + H / 2, z); put(mPole, pole);
    if (l.t === 'D' || (!l.dir[0] && !l.dir[1])) continue;
    const ex = x + l.dir[0] * 1.6, ez = z + l.dir[1] * 1.6, A = V(x, H - 0.55, z), B = V(ex, H - 0.2, ez);
    const arm = new THREE.CylinderGeometry(0.035, 0.035, A.distanceTo(B), 8); arm.applyMatrix4(new THREE.Matrix4().compose(A.clone().lerp(B, 0.5), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), B.clone().sub(A).normalize()), V(1, 1, 1))); put(mPole, arm);
    const head = new THREE.BoxGeometry(0.62, 0.09, 0.26); head.rotateY(-Math.atan2(l.dir[1], l.dir[0])); head.translate(ex + l.dir[0] * 0.2, H - 0.22, ez + l.dir[1] * 0.2); put(mMetal, head);
    const lens = new THREE.PlaneGeometry(0.5, 0.18); lens.rotateX(Math.PI / 2); lens.rotateY(-Math.atan2(l.dir[1], l.dir[0])); lens.translate(ex + l.dir[0] * 0.2, H - 0.27, ez + l.dir[1] * 0.2); put(mLamp, lens);
  }

  // ---------- the school across the Persiaran (massing only) ----------
  for (const s of E.school) {
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(s.poly.map(([x, z]) => new THREE.Vector2(x, z))), { depth: s.h, bevelEnabled: false }); g.rotateX(Math.PI / 2); g.translate(0, s.h - 0.3, 0); put(mSchool, g);
    put(mSchoolRoof, fill(s.poly, s.h - 0.29));
  }
  flush(root, { cast: true, receive: true });     // walls, gates, poles, substation, school: cast too

  // ---------- trees: existing street trees, and shade on the green ----------
  const trees = new THREE.Group(); root.add(trees);
  if (makeTree) {
    for (const [x, z] of E.trees) makeTree(x, z, 0.9, trees);
    for (const [x, z, s] of [[-26, 40, 1.1], [-38, 39.5, 1.0], [-47, 47, 1.2], [-47.5, 55, 1.05], [-30, 58.5, 1.15], [-40, 59, 1.0]]) makeTree(x, z, s, trees);
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
    for (let x = -92; x <= 2; x += 8.5) for (let z = 106; z <= 150; z += 8.5) spots.push([x + ((z / 8.5) % 2) * 4.2, z]);
    const it = new THREE.InstancedMesh(trunkG, mTrunk, spots.length), ifr = new THREE.InstancedMesh(frondG, mFrond, spots.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion();
    spots.forEach(([x, z], i) => { const s = 0.85 + ((i * 37) % 10) / 30; q.setFromAxisAngle(V(0, 1, 0), i * 2.4); m.compose(V(x, 0, z), q, V(s, s, s)); it.setMatrixAt(i, m); ifr.setMatrixAt(i, m); });
    it.castShadow = ifr.castShadow = true; root.add(it, ifr);
  }

  // Place the estate so the walked home's plot lands on the model.
  root.matrix.copy(placeM(walked.o, walked.rot, walked.mirror)).invert(); root.matrixWorldNeedsUpdate = true;
  const toModel = (x, z) => V(x, 0, z).applyMatrix4(root.matrix);

  let wasOpaque = null;
  function update(real, dusk = 0) {
    root.visible = real > 0.01; houses.visible = real > 0.5;
    const opaque = real > 0.995;
    for (const m of fadeMats) { m.opacity = real; if (opaque !== wasOpaque) { m.transparent = !opaque; m.needsUpdate = true; } }
    wasOpaque = opaque;
    mLamp.emissiveIntensity = 2.2 * dusk;
  }
  return { root, update, toModel, walked, setHouses, centre: toModel(-42, 48) };
}
