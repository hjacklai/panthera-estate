// pack.js · the baked estate (bake/estate.<ver>.json, .bin.gz, .tex512.bin / .tex1024.bin, made by tools/bake.html).
//
//   const pack = await fetchPack({ base: './bake/', ver: 'e1', tier: 1024 | 512 });
//   const estate = pack.forWalk('semid', { THREE, hifi, envMap, hd: hd.use, aniso });   // the buildEstate API
//
// Format PBE1-q: the manifest lists images, textures, materials (three's material JSON plus the hd photo sets) and
// meshes; the binary holds each mesh's attributes, quantised to 16 bits where that is exact enough (byte planes,
// delta coded, so gzip packs them well), plus instance matrices. Geometry is decoded once and shared. The tier file
// holds each distinct texture image once as webp (512 px set for phones, 1024 for desktop).

const gunzip = async ab => {
  const u = new Uint8Array(ab, 0, 2);
  if (u[0] !== 0x1f || u[1] !== 0x8b) return ab;   // already inflated (a server that sent Content-Encoding)
  return new Response(new Blob([ab]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
};
const loadImg = url => new Promise((ok, no) => {
  const img = new Image(); img.decoding = 'async'; img.fetchPriority = 'low';
  img.onload = () => Promise.race([img.decode ? img.decode().catch(() => {}) : null, new Promise(r => setTimeout(r, 800))]).then(() => ok(img));
  img.onerror = () => no(new Error(url)); img.src = url;
});

export async function fetchPack({ base = './bake/', ver, tier = 1024, priority = 'low' } = {}) {
  if (typeof DecompressionStream === 'undefined') throw new Error('no DecompressionStream');
  const get = (u, how) => fetch(base + u, { priority }).then(r => { if (!r.ok) throw new Error(u + ' ' + r.status); return r[how](); });
  const T = tier <= 512 ? 512 : 1024;
  const binP = get(`estate.${ver}.bin.gz`, 'arrayBuffer').then(gunzip), texP = get(`estate.${ver}.tex${T}.bin`, 'arrayBuffer');   // all three at once
  binP.catch(() => {}); texP.catch(() => {});
  const mf = await get(`estate.${ver}.json`, 'json');
  if (mf.ver !== ver || mf.format !== 'PBE1-q') throw new Error('pack version ' + mf.ver);
  const tex = await texP;
  // each webp out of the tier file, decoded off the main thread (bitmaps carry their own flip); plain images if not
  const flip = new Set(mf.textures.filter(t => t.flipY).map(t => t.img));
  const images = await Promise.all(mf.images.map((im, i) => {
    const [off, len] = im['t' + T], blob = new Blob([new Uint8Array(tex, off, len)], { type: 'image/webp' });
    const viaImg = () => { const url = URL.createObjectURL(blob); return loadImg(url).finally(() => URL.revokeObjectURL(url)); };
    if (typeof createImageBitmap === 'undefined') return viaImg();
    return createImageBitmap(blob, { imageOrientation: flip.has(i) ? 'flipY' : 'from-image', premultiplyAlpha: 'none', colorSpaceConversion: 'none' }).catch(viaImg);
  }));
  const buf = await binP;
  performance.mark('pack-loaded');
  return makePack(mf, buf, images);
}

const isBmp = x => typeof ImageBitmap !== 'undefined' && x instanceof ImageBitmap;
function makePack(mf, buf, images) {
  const geoCache = new Map();
  // ---- decoding ----
  const planes16 = (off, n, comps) => {   // per component: hi bytes then lo bytes of delta-coded uint16
    const b = new Uint8Array(buf, off, n * comps * 2), out = new Uint16Array(n * comps);
    for (let c = 0; c < comps; c++) {
      const hi = c * n * 2, lo = hi + n; let prev = 0;
      for (let i = 0; i < n; i++) { prev = (prev + ((b[hi + i] << 8) | b[lo + i])) & 0xffff; out[i * comps + c] = prev; }
    }
    return out;
  };
  const attr = (THREE, a, n) => {
    if (a.t === 'f32') return new THREE.BufferAttribute(new Float32Array(buf.slice(a.off, a.off + n * a.n * 4)), a.n);
    if (a.t === 'u8') {   // 0..1, planar bytes
      const b = new Uint8Array(buf, a.off, n * a.n), f = new Float32Array(n * a.n);
      for (let c = 0; c < a.n; c++) for (let i = 0; i < n; i++) f[i * a.n + c] = b[c * n + i] / 255;
      return new THREE.BufferAttribute(f, a.n);
    }
    const q = planes16(a.off, n, a.t === 'oct' ? 2 : a.n);
    if (a.t === 'oct') {   // octahedral unit normals
      const f = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        let x = q[i * 2] / 32767.5 - 1, y = q[i * 2 + 1] / 32767.5 - 1; const z = 1 - Math.abs(x) - Math.abs(y);
        if (z < 0) { const tx = x; x = (1 - Math.abs(y)) * Math.sign(tx || 1); y = (1 - Math.abs(tx)) * Math.sign(y || 1); }
        const L = Math.hypot(x, y, z) || 1; f[i * 3] = x / L; f[i * 3 + 1] = y / L; f[i * 3 + 2] = z / L;
      }
      return new THREE.BufferAttribute(f, 3);
    }
    const f = new Float32Array(n * a.n);   // q16: min + q / 65535 * (max - min)
    for (let c = 0; c < a.n; c++) { const lo = a.min[c], k = (a.max[c] - a.min[c]) / 65535; for (let i = 0; i < n; i++) f[i * a.n + c] = lo + q[i * a.n + c] * k; }
    return new THREE.BufferAttribute(f, a.n);
  };
  const geometry = (THREE, i) => {
    if (geoCache.has(i)) return geoCache.get(i);
    const m = mf.meshes[i], g = new THREE.BufferGeometry();
    for (const [k, a] of Object.entries(m.attrs)) g.setAttribute(k, attr(THREE, a, m.vtx));
    if (m.index) g.setIndex(new THREE.BufferAttribute(m.index.t === 'u16' ? new Uint16Array(buf.slice(m.index.off, m.index.off + m.idx * 2)) : new Uint32Array(buf.slice(m.index.off, m.index.off + m.idx * 4)), 1));
    g.computeBoundingSphere(); g.computeBoundingBox(); g.userData.pk = 1;   // shared by the hero and the walks: never disposed by a walk
    geoCache.set(i, g); return g;
  };
  const f32 = (off, n) => new Float32Array(buf, off, n);

  // ---- materials and textures (made per call: a walk owns its materials) ----
  function materials(THREE, { envMap = null, aniso = 8 } = {}) {
    const srcs = images.map(img => new THREE.Source(img));
    const texs = mf.textures.map(d => {
      const t = new THREE.Texture(); t.source = srcs[d.img];
      Object.assign(t, { mapping: d.mapping, channel: d.channel, wrapS: d.wrap[0], wrapT: d.wrap[1], magFilter: d.mag, minFilter: d.min, anisotropy: Math.min(d.aniso, aniso),
        flipY: d.flipY, colorSpace: d.cs, premultiplyAlpha: d.pma, generateMipmaps: d.mips, rotation: d.rot });
      if (isBmp(images[d.img])) { t.flipY = false; t.premultiplyAlpha = false; }   // a bitmap is decoded already turned (WebGL ignores both for it)
      t.repeat.fromArray(d.repeat); t.offset.fromArray(d.offset); t.center.fromArray(d.center); t.needsUpdate = true;
      return t;
    });
    const loader = new THREE.MaterialLoader(); loader.setTextures(Object.fromEntries(texs.map((t, i) => ['t' + i, t])));
    return mf.materials.map(r => { const m = loader.parse(r.json); if (r.env && envMap) m.envMap = envMap; return m; });
  }

  // The estate around one walked home: the buildEstate API (root, update, toModel, centre), plus parts for the
  // walked home's far copy. Everything sits in the estate frame under root, placed so the walked plot lands on
  // the model, as estate.js does.
  function forWalk(home, { THREE, hifi = true, envMap = null, hd = null, aniso = 8 } = {}) {
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const mats = materials(THREE, { envMap, aniso });
    const walkedId = mf.walked[home], W = mf.slots.find(s => s.id === walkedId);
    const slotM = s => new THREE.Matrix4().fromArray(s.M);
    const root = new THREE.Group(); root.matrixAutoUpdate = false; root.name = 'estate-pack';
    root.matrix.copy(slotM(W)).invert(); root.matrixWorldNeedsUpdate = true;
    const houses = new THREE.Group(); houses.name = 'houses'; root.add(houses);
    const parts = { semid: [], bungalow: [] };
    const used = new Set(), shadow = (o, m) => { o.castShadow = !!m.cast; o.receiveShadow = !!m.receive; };
    mf.meshes.forEach((m, i) => {
      const material = mats[m.mat];
      if (m.k === 'house') { parts[m.home].push({ material, geometry: geometry(THREE, i) }); return; }
      if (m.car && m.car.kind !== (hifi ? 'kit' : 'lite')) return;              // the detailed cars on desktop, the light ones on phones
      if (m.variant === 'closed' && m.slot === walkedId) return;                // the walked home draws its own
      if (m.variant === 'open' && m.slot !== walkedId) return;                  // only around the walked home
      const parent = m.grp === 'houses' ? houses : root, geo = geometry(THREE, i);
      used.add(material);
      if (!m.inst) { const o = new THREE.Mesh(geo, material); shadow(o, m); o.matrixAutoUpdate = false; parent.add(o); return; }
      let keep = [...Array(m.inst.n).keys()];
      if (m.car) keep = keep.filter(j => m.car.slots[j] !== walkedId);           // no estate cars in the walked porch
      if (!keep.length) return;
      const M = f32(m.inst.M, m.inst.n * 16), C = m.inst.C != null ? f32(m.inst.C, m.inst.n * 3) : null, M4 = new THREE.Matrix4(), col = new THREE.Color();
      const im = new THREE.InstancedMesh(geo, material, keep.length);
      keep.forEach((j, k) => {
        im.setMatrixAt(k, M4.fromArray(M, j * 16));
        if (m.car && m.car.paint) im.setColorAt(k, col.set(m.car.pal[(k * m.car.mul + m.car.add) % m.car.pal.length]));   // as estate.js: by order among the cars shown
        else if (C) im.setColorAt(k, col.fromArray(C, j * 3));
      });
      shadow(im, m); parent.add(im);
    });
    // Every other plot: the full house, one instanced draw per material part; a mirrored plot gets plain meshes
    // (three turns the faces for a negative-scale object).
    for (const kind of ['semid', 'bungalow']) {
      const sl = mf.slots.filter(s => s.kind === kind && s.id !== walkedId), straight = sl.filter(s => !s.mirror), mirrored = sl.filter(s => s.mirror);
      for (const { material, geometry: geo } of parts[kind]) {
        used.add(material);
        const sh = o => { o.castShadow = !material.transparent; o.receiveShadow = true; return o; };
        if (straight.length) { const im = new THREE.InstancedMesh(geo, material, straight.length); straight.forEach((s, k) => im.setMatrixAt(k, slotM(s))); houses.add(sh(im)); }
        for (const s of mirrored) { const o = sh(new THREE.Mesh(geo, material)); o.matrixAutoUpdate = false; o.matrix.copy(slotM(s)); houses.add(o); }
      }
    }
    for (const p of parts[home]) used.add(p.material);
    // photo maps, as the live estate registers them
    if (hd) mf.materials.forEach((r, i) => { if (used.has(mats[i])) for (const u of r.hd || []) hd(mats[i], u.set, u.o); });
    const fadeMats = mats.filter((m, i) => mf.materials[i].fade && used.has(m)), lamps = mats.filter((m, i) => mf.materials[i].lamp);
    const worldMats = mats.filter((m, i) => mf.materials[i].world && used.has(m));
    let wasOpaque = null;
    function update(real, dusk = 0) {   // as estate.js
      root.visible = real > 0.01; houses.visible = real > 0.5;
      const opaque = real > 0.995;
      for (const m of fadeMats) { m.opacity = real; if (opaque !== wasOpaque) { m.transparent = !opaque; m.needsUpdate = true; } }
      wasOpaque = opaque;
      for (const m of lamps) m.emissiveIntensity = 2.2 * dusk;
    }
    const toModel = (x, z) => V(x, 0, z).applyMatrix4(root.matrix);
    return { root, update, toModel, walked: W, setHouses() {}, centre: toModel(-42, 48), baked: true, parts, worldMats, houses, pois: mf.pois, entry: mf.entry };
  }
  // geometry and materials are also handed out raw, for the estate hero (hero-lod.js builds its own aerial copy)
  return { manifest: mf, forWalk, geometry, materials, f32 };
}
