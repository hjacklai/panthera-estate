// hero-lod.js · the aerial copy of the baked estate for the hero (the walkthrough's own use of the pack is untouched).
//
//   const est = buildHeroEstate({ THREE, renderer, pack, mergeGeometries, lite, hdSets, aniso, masks });
//
// masks: the visibility result saved ahead (bake/hero-lod.<ver>.json, one set per tier): the pruning then skips
// its id render, which takes 2-3 s on a phone. Missing or stale (part sizes differ): it is worked out here.
//
// The hero camera never comes closer than about 30 m, so at load time each house type is cut down:
// - visibility: every part is split into connected pieces, drawn with an id colour from 61 directions over
//   the upper hemisphere (glass and cut-out materials do not hide anything), and pieces that are never seen, or
//   only as a few pixels, are dropped (rooms, interior walls, fittings, small hardware);
// - plain colour materials are merged into a few vertex-coloured materials, so a house is ~12 draws, not ~100.
// All 19 homes stay: one instanced draw per part over the slots, mirrored slots as plain meshes.

// photo sets worth their bytes from the air (desktop only, after the hero is interactive): about 0.6 MB.
// grass and concrete_paving (1.7 MB together) add little at this distance.
const HERO_HD = new Set(['roof_tile', 'asphalt']);

export function buildHeroEstate({ THREE, renderer, pack, mergeGeometries, lite = false, hdSets = HERO_HD, aniso = 8, prune: doPrune = true, masks = null }) {
  const t0 = performance.now();
  const mf = pack.manifest, recs = mf.materials;
  const mats = pack.materials(THREE, { envMap: null, aniso });
  const stats = { trisIn: 0, trisOut: 0, partsIn: 0, partsOut: 0, ms: 0 };
  const hdOf = i => (recs[i].hd || []).filter(u => hdSets && hdSets.has(u.set));
  // the estate as at the end of the walk: everything solid
  mats.forEach((m, i) => {
    const r = recs[i];
    if (r.fade) { m.opacity = 1; m.transparent = false; }
    if (r.world) m.opacity = 1;
  });
  const plain = i => {
    const m = mats[i];
    return m.isMeshStandardMaterial && !m.isMeshPhysicalMaterial && !m.map && !m.normalMap && !m.bumpMap && !m.roughnessMap &&
      !m.alphaMap && !m.emissiveMap && !m.aoMap && !m.transparent && m.opacity >= 1 && !m.alphaTest && !m.vertexColors &&
      !recs[i].lamp && m.emissive.getHex() === 0 && m.name !== 'glass' && !hdOf(i).length;
  };
  // small parts that only carry a drawn colour map (tiles seen through a window, trims): their map's mean colour is
  // enough from the air, so they can join the merged materials too
  const avgCache = new Map();
  const meanOf = img => {
    if (avgCache.has(img)) return avgCache.get(img);
    let c = null;
    try {
      const cv = document.createElement('canvas'); cv.width = cv.height = 8; const g = cv.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0, 8, 8); const d = g.getImageData(0, 0, 8, 8).data; let r = 0, gg = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
      c = new THREE.Color().setRGB(r / 64 / 255, gg / 64 / 255, b / 64 / 255, THREE.SRGBColorSpace);
    } catch (e) { c = null; }
    avgCache.set(img, c); return c;
  };
  const mapOnly = i => {
    const m = mats[i];
    return m.isMeshStandardMaterial && !m.isMeshPhysicalMaterial && m.map && m.map.image && !m.normalMap && !m.bumpMap && !m.roughnessMap &&
      !m.alphaMap && !m.emissiveMap && !m.aoMap && !m.transparent && m.opacity >= 1 && !m.alphaTest && !m.vertexColors &&
      !recs[i].lamp && m.emissive.getHex() === 0 && m.name !== 'glass' && !hdOf(i).length;
  };
  const flatColour = i => { const a = meanOf(mats[i].map.image); return a ? mats[i].color.clone().multiply(a) : null; };
  const root = new THREE.Group(); root.name = 'hero-estate';
  const houses = new THREE.Group(); houses.name = 'houses'; root.add(houses);
  const buckets = new Map();   // merged plain materials
  const bucketMat = (i, extra = '') => {
    const m = mats[i], key = [m.side, Math.round(m.roughness / 0.05), Math.round(m.metalness / 0.1), m.envMapIntensity.toFixed(2), m.flatShading ? 1 : 0, extra].join('|');
    let b = buckets.get(key);
    if (!b) {
      b = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: Math.round(m.roughness / 0.05) * 0.05, metalness: Math.round(m.metalness / 0.1) * 0.1,
        side: m.side, envMapIntensity: m.envMapIntensity, flatShading: m.flatShading });
      b.name = 'hx-bucket'; buckets.set(key, b);
    }
    return b;
  };
  // a plain part's geometry with its colour baked in (linear), uv dropped, ready to merge
  const coloured = (geo, color) => {
    const g = new THREE.BufferGeometry(), n = geo.attributes.position.count, c = new Float32Array(n * 3);
    for (let v = 0; v < n; v++) { c[v * 3] = color.r; c[v * 3 + 1] = color.g; c[v * 3 + 2] = color.b; }
    g.setAttribute('position', geo.attributes.position); g.setAttribute('normal', geo.attributes.normal);
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.setIndex(geo.index);
    return g;
  };
  const tris = g => (g.index ? g.index.count : g.attributes.position.count) / 3;

  // ---------- the house types ----------
  const slotM = s => new THREE.Matrix4().fromArray(s.M);
  const houseStats = {}, keepOut = {};
  for (const kind of ['semid', 'bungalow']) {
    const src = [];
    mf.meshes.forEach((m, i) => { if (m.k === 'house' && m.home === kind) src.push({ i, m, mat: m.mat, geo: pack.geometry(THREE, i) }); });
    stats.partsIn += src.length; const tIn = src.reduce((a, p) => a + tris(p.geo), 0);
    const tp = performance.now();
    const saved = doPrune && fromMasks(THREE, src, masks && masks[kind]);
    if (saved) stats.masks = 'saved';
    const kept = [];
    const cut = !doPrune ? src.map(p => p.geo) : saved || prune(THREE, renderer, src.map(p => ({ geo: p.geo, mat: mats[p.mat] })), { lite, kept });
    keepOut[kind] = kept;
    stats.pruneMs = (stats.pruneMs || 0) + Math.round(performance.now() - tp);
    const parts = [];
    src.forEach((p, k) => { if (cut[k]) parts.push({ ...p, geo: cut[k] }); });
    // merge the plain ones
    const groups = new Map(), out = [];
    for (const p of parts) {
      const flat = !plain(p.mat) && mapOnly(p.mat) && tris(p.geo) <= 400 ? flatColour(p.mat) : null;
      if (!plain(p.mat) && !flat) { out.push({ material: mats[p.mat], geometry: p.geo, cast: !mats[p.mat].transparent }); continue; }
      const b = bucketMat(p.mat);
      if (!groups.has(b)) groups.set(b, []);
      groups.get(b).push(coloured(p.geo, flat || mats[p.mat].color));
    }
    for (const [b, gs] of groups) out.push({ material: b, geometry: gs.length > 1 ? mergeGeometries(gs) : gs[0], cast: true });
    for (const o of out) { o.geometry.computeBoundingSphere(); o.geometry.computeBoundingBox(); }
    const tOut = out.reduce((a, p) => a + tris(p.geometry), 0);
    houseStats[kind] = { partsIn: src.length, partsOut: out.length, trisIn: tIn, trisOut: tOut,
      cut: src.map((p, k) => [mats[p.mat].color.getHexString(), tris(p.geo), cut[k] ? tris(cut[k]) : 0]).filter(x => x[1] > 40) };   // per part, for checking
    // place over every slot of this kind
    const sl = mf.slots.filter(s => s.kind === kind), straight = sl.filter(s => !s.mirror), mirrored = sl.filter(s => s.mirror);
    for (const { material, geometry, cast } of out) {
      if (straight.length) {
        const im = new THREE.InstancedMesh(geometry, material, straight.length);
        straight.forEach((s, k) => im.setMatrixAt(k, slotM(s)));
        im.castShadow = cast; im.receiveShadow = true; im.computeBoundingSphere(); houses.add(im);
      }
      for (const s of mirrored) {
        const o = new THREE.Mesh(geometry, material); o.matrixAutoUpdate = false; o.matrix.copy(slotM(s));
        o.castShadow = cast; o.receiveShadow = true; houses.add(o);
      }
    }
  }

  // ---------- grounds, trees, fences, cars ----------
  const rootPlain = new Map();
  const used = new Set();
  mf.meshes.forEach((m, i) => {
    if (m.k !== 'est') return;
    if (m.car && m.car.kind !== 'lite') return;     // the light cars everywhere: the detailed kit is 2 M triangles
    if (m.variant === 'open') return;               // every gate shut, every fence whole
    const geo = pack.geometry(THREE, i), parent = m.grp === 'houses' ? houses : root;
    stats.partsIn++;
    if (!m.inst && plain(m.mat)) {   // merged with the other plain grounds
      const b = bucketMat(m.mat, (m.cast ? 'c' : '') + (m.receive ? 'r' : ''));
      if (!rootPlain.has(b)) rootPlain.set(b, { list: [], cast: !!m.cast, receive: !!m.receive });
      rootPlain.get(b).list.push(coloured(geo, mats[m.mat].color));
      return;
    }
    const material = mats[m.mat]; used.add(m.mat);
    if (!m.inst) { const o = new THREE.Mesh(geo, material); o.castShadow = !!m.cast; o.receiveShadow = !!m.receive; o.matrixAutoUpdate = false; parent.add(o); return; }
    const n = m.inst.n;
    const im = new THREE.InstancedMesh(geo, material, n), M4 = new THREE.Matrix4(), col = new THREE.Color();
    const Ms = pack.f32(m.inst.M, n * 16), Cs = m.inst.C != null ? pack.f32(m.inst.C, n * 3) : null;
    for (let j = 0; j < n; j++) {
      im.setMatrixAt(j, M4.fromArray(Ms, j * 16));
      if (m.car && m.car.paint) im.setColorAt(j, col.set(m.car.pal[(j * m.car.mul + m.car.add) % m.car.pal.length]));
      else if (Cs) im.setColorAt(j, col.fromArray(Cs, j * 3));
    }
    im.castShadow = !!m.cast; im.receiveShadow = !!m.receive; im.computeBoundingSphere(); parent.add(im);
    if (m.car) im.userData.car = m.car.kind;   // hero-life.js drives copies of the light car
  });
  for (const [b, { list, cast, receive }] of rootPlain) {
    const o = new THREE.Mesh(list.length > 1 ? mergeGeometries(list) : list[0], b); o.castShadow = cast; o.receiveShadow = receive; o.matrixAutoUpdate = false; root.add(o);
  }
  root.updateMatrixWorld(true);
  root.traverse(o => { if (o.isMesh) { stats.partsOut++; stats.trisOut += tris(o.geometry) * (o.isInstancedMesh ? o.count : 1); } });
  mf.meshes.forEach(m => {
    if (m.k === 'house') stats.trisIn += m.idx / 3 * mf.slots.filter(s => s.kind === m.home).length;
    else if (!(m.car && m.car.kind !== 'lite') && m.variant !== 'open') stats.trisIn += m.idx / 3 * (m.inst ? m.inst.n : 1);
  });
  stats.houses = houseStats; stats.ms = Math.round(performance.now() - t0);

  // what the hero needs to drive: lamps, glass, photo-map uses
  const lamps = mats.filter((m, i) => recs[i].lamp);
  const glass = []; root.traverse(o => { if (o.isMesh && o.material.name === 'glass' && !glass.includes(o.material)) glass.push(o.material); });
  const hdUses = [];
  root.traverse(o => { if (o.isMesh) { const i = mats.indexOf(o.material); if (i >= 0) for (const u of hdOf(i)) hdUses.push({ mat: o.material, set: u.set, o: u.o }); } });
  return { root, houses, lamps, glass, hdUses, stats, pois: mf.pois, slots: mf.slots, keep: keepOut };   // keep: what the pruning kept (saved as bake/hero-lod.<ver>.json)
}

// ---------- saved masks ----------
// per part: 'all', 'none' or a base64 bit mask over its triangles; used only if every part's triangle count matches
function fromMasks(THREE, src, m) {
  if (!m || m.length !== src.length) return null;
  const tri = g => g.index.count / 3;
  if (m.some((x, k) => x.n !== tri(src[k].geo))) return null;
  return src.map((p, k) => {
    const x = m[k];
    if (x.k === 'all') return p.geo;
    if (x.k === 'none') return null;
    const bits = Uint8Array.from(atob(x.k), c => c.charCodeAt(0)), keep = [];
    for (let t = 0; t < x.n; t++) if (bits[t >> 3] & (1 << (t & 7))) keep.push(t);
    return keep.length ? compact(THREE, p.geo, keep) : null;
  });
}
const maskOf = (keep, nT) => {
  if (keep.length === nT) return { n: nT, k: 'all' };
  if (!keep.length) return { n: nT, k: 'none' };
  const bits = new Uint8Array((nT + 7) >> 3); for (const t of keep) bits[t >> 3] |= 1 << (t & 7);
  let s = ''; for (const b of bits) s += String.fromCharCode(b);
  return { n: nT, k: btoa(s) };
};

// ---------- pruning one house type ----------
// parts: [{ geo (indexed), mat }] in the model frame. Returns per part a new compact geometry, or null if nothing is left.
// kept (optional) receives each part's mask, for saving.
function prune(THREE, renderer, parts, { lite, kept = null }) {
  // 1. connected pieces, welding by position (1 mm), within each part
  let nComp = 0;
  const triComp = parts.map(({ geo }) => {
    const pos = geo.attributes.position.array, idx = geo.index.array, nV = pos.length / 3, nT = idx.length / 3;
    const key = new Map(), canon = new Int32Array(nV);
    for (let v = 0; v < nV; v++) {
      // millimetres, 16 bits each (+-32 m round the house), packed into one exact integer
      const k = (Math.round(pos[v * 3] * 1000) + 32768) * 4294967296 + (Math.round(pos[v * 3 + 1] * 1000) + 32768) * 65536 + (Math.round(pos[v * 3 + 2] * 1000) + 32768);
      let c = key.get(k); if (c === undefined) { c = key.size; key.set(k, c); } canon[v] = c;
    }
    const par = new Int32Array(key.size); for (let i = 0; i < par.length; i++) par[i] = i;
    const find = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
    const join = (a, b) => { a = find(a); b = find(b); if (a !== b) par[b] = a; };
    for (let t = 0; t < nT; t++) { join(canon[idx[t * 3]], canon[idx[t * 3 + 1]]); join(canon[idx[t * 3]], canon[idx[t * 3 + 2]]); }
    const local = new Map(), tc = new Int32Array(nT);
    for (let t = 0; t < nT; t++) { const r = find(canon[idx[t * 3]]); let c = local.get(r); if (c === undefined) { c = nComp++; local.set(r, c); } tc[t] = c; }
    return tc;
  });
  const seeThrough = m => m.transparent || m.opacity < 1 || m.alphaTest > 0 || !!m.alphaMap;

  // 2. id render from the upper hemisphere into one atlas, one read back
  const hits = new Uint32Array(nComp);
  const box = new THREE.Box3(); parts.forEach(p => { p.geo.computeBoundingBox(); box.union(p.geo.boundingBox); });
  const C = box.getCenter(new THREE.Vector3()), R = box.getSize(new THREE.Vector3()).length() / 2;
  const TILE = 256, GRID = 8, W = TILE * GRID;
  const scene = new THREE.Scene(), made = [];
  const vs = 'attribute vec3 cid; varying vec3 vC; void main() { vC = cid; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }';
  const fs = 'varying vec3 vC; void main() { gl_FragColor = vec4( vC, 1.0 ); }';
  parts.forEach(({ geo, mat }, k) => {
    if (seeThrough(mat)) return;   // glass, cut-outs: never hide anything (and are kept whole)
    const idx = geo.index.array, pos = geo.attributes.position.array, nT = idx.length / 3, tc = triComp[k];
    const P = new Float32Array(nT * 9), I = new Uint8Array(nT * 9);
    for (let t = 0; t < nT; t++) {
      const id = tc[t] + 1, r = id & 255, g = (id >> 8) & 255, b = (id >> 16) & 255;
      for (let j = 0; j < 3; j++) {
        const v = idx[t * 3 + j], o = t * 9 + j * 3;
        P[o] = pos[v * 3]; P[o + 1] = pos[v * 3 + 1]; P[o + 2] = pos[v * 3 + 2]; I[o] = r; I[o + 1] = g; I[o + 2] = b;
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('cid', new THREE.BufferAttribute(I, 3, true));
    const m = new THREE.ShaderMaterial({ vertexShader: vs, fragmentShader: fs, side: mat.side });
    const o = new THREE.Mesh(g, m); o.frustumCulled = false; scene.add(o); made.push(g, m);
  });
  const rt = new THREE.WebGLRenderTarget(W, W, { depthBuffer: true, magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter, generateMipmaps: false });
  const cam = new THREE.OrthographicCamera(-R, R, R, -R, 0.1, R * 8);
  const prev = { rt: renderer.getRenderTarget(), cc: renderer.getClearColor(new THREE.Color()), ca: renderer.getClearAlpha(), sh: renderer.shadowMap.enabled, ac: renderer.autoClear };
  const dirs = [new THREE.Vector3(0, 1, 0)];
  for (const el of [10, 24, 38, 52, 66, 80]) for (let a = 0; a < 10; a++) {
    const e = el * Math.PI / 180, az = (a + (el / 14) % 1) * Math.PI * 2 / 10;
    dirs.push(new THREE.Vector3(Math.cos(e) * Math.cos(az), Math.sin(e), Math.cos(e) * Math.sin(az)));
  }
  try {
    renderer.shadowMap.enabled = false; renderer.autoClear = false;   // one clear for the whole atlas, then each tile in its viewport
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(true, true, false);
    dirs.forEach((d, k) => {
      const x = (k % GRID) * TILE, y = Math.floor(k / GRID) * TILE;
      cam.position.copy(C).addScaledVector(d, R * 4); cam.up.set(Math.abs(d.y) > 0.99 ? 1 : 0, Math.abs(d.y) > 0.99 ? 0 : 1, 0); cam.lookAt(C); cam.updateMatrixWorld();
      rt.viewport.set(x, y, TILE, TILE);
      renderer.setRenderTarget(rt);
      renderer.render(scene, cam);
    });
    const px = new Uint8Array(W * W * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, W, W, px);
    for (let i = 0; i < px.length; i += 4) { const id = px[i] | (px[i + 1] << 8) | (px[i + 2] << 16); if (id) hits[id - 1]++; }
    if (globalThis.__hxAtlas) {   // checking only
      const ct = new Uint32Array(nComp); triComp.forEach(tc => tc.forEach(c => ct[c]++));
      globalThis.__hxAtlas.push({ W, nComp, hits: hits.slice(), compTris: ct });
    }
  } finally {
    rt.viewport.set(0, 0, W, W);
    renderer.setRenderTarget(prev.rt); renderer.setClearColor(prev.cc, prev.ca); renderer.shadowMap.enabled = prev.sh; renderer.autoClear = prev.ac;
    rt.dispose(); for (const x of made) x.dispose();
  }
  // a piece is kept if it covers this many id pixels over all 61 views (about 9 cm a pixel): under ~1 px a view
  // on average it is hidden or too small to read from the air
  const minHits = globalThis.__hxMinHits || (lite ? 50 : 20);

  // 3. keep the seen pieces (faces pointing down stay: the shadow pass draws back faces, so soffits and ceilings
  // are what cast the eave and roof shadows); compact each part
  return parts.map(({ geo, mat }, k) => {
    const idx = geo.index.array, nT = idx.length / 3, tc = triComp[k], whole = seeThrough(mat);
    const keep = [];
    for (let t = 0; t < nT; t++) {
      if (!whole && hits[tc[t]] < minHits) continue;
      keep.push(t);
    }
    if (kept) kept[k] = maskOf(keep, nT);
    if (!keep.length) return null;
    if (keep.length === nT) return geo;
    return compact(THREE, geo, keep);
  });
}

// a geometry with only the given triangles (and only the vertices they use)
function compact(THREE, geo, keep) {
  const idx = geo.index.array, map = new Map(), order = [];
  const ni = new Uint32Array(keep.length * 3);
  keep.forEach((t, k) => { for (let j = 0; j < 3; j++) { const v = idx[t * 3 + j]; let n = map.get(v); if (n === undefined) { n = order.length; map.set(v, n); order.push(v); } ni[k * 3 + j] = n; } });
  const g = new THREE.BufferGeometry();
  for (const [name, at] of Object.entries(geo.attributes)) {
    const s = at.itemSize, out = new at.array.constructor(order.length * s);
    order.forEach((v, n) => { for (let j = 0; j < s; j++) out[n * s + j] = at.array[v * s + j]; });
    g.setAttribute(name, new THREE.BufferAttribute(out, s, at.normalized));
  }
  g.setIndex(new THREE.BufferAttribute(order.length < 65536 ? Uint16Array.from(ni) : ni, 1));
  return g;
}
