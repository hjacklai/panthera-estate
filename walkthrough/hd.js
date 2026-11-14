// hd.js · photo textures (CC0, hd/tex) and HDRI skies (hd/sky) for the walkthrough.
//
//   const hd = createHD({ THREE, renderer, res: '2k' | '1k' | null, lite, onChange, pace });   // pace: () => Promise, awaited before each upload
//   hd.use(material, 'spc_oak', { su, sv, ou, ov });   // register: the photo maps replace the drawn ones once loaded
//   hd.start();                                        // swaps may run from now on (call once the page is built)
//   hd.dispose();                                      // frees its photo maps and skies (an embedded walk closing)
//
// The house opens with its own drawn (canvas) textures. A set's files are fetched the first time a material asks for
// it, and its maps are swapped in when they arrive. A file that fails keeps the drawn texture (one console warning).
// res null (the bake page, or ?hd=0) records the uses but loads nothing.
//
// Mapping: uv * (su, sv) + (ou, ov) = metres on the surface (defaults 1, 1, 0, 0). world: true projects world metres
// in the shader instead (scaled boxes such as the walls). rot: 90 turns the texture a quarter turn.
// Colour: 'match' (default) tints the photo so its average equals what the drawn texture showed (map average times
// material colour), so each finish keeps its approved colour; 'keep' leaves the colour and adds relief only.
// Roughness maps keep the material's average roughness. normalScale sets the relief (default 1).

// tile: metres per texture repeat (manifest.json). size: largest file used (rough and ao always 1k, phones 1k).
const SETS = {
  spc_oak: { tile: 1.7, maps: ['color', 'normal', 'rough'], lift: [1.86, 1.77, 1.61] },  // planks along u; lifted to the owner's light brownish SPC
  porcelain_beige: { tile: 1.2, maps: ['color', 'normal', 'rough'], grout: true, lift: [1.07, 0.99, 0.86] },   // grout-less slab: 600 mm grout drawn here; warmed to beige (owner: GF tiles beige, matt)
  bath_wall_tile: { tile: 1.2, maps: ['color', 'normal', 'rough', 'ao'], size: '1k' },   // 300 x 600 cells, long side along v
  plaster_wall: { tile: 3.0, maps: ['normal', 'rough'] },                                 // relief only, the cream stays from the code
  walnut: { tile: 1.8, maps: ['color', 'normal', 'rough'] },                              // grain along v
  oak_veneer: { tile: 1.0, maps: ['color', 'normal', 'rough'] },                          // grain along u
  stone_top: { tile: 1.2, maps: ['color', 'normal', 'rough'] },                           // bands along u
  roof_tile: { tile: 3.2, maps: ['color', 'normal', 'rough', 'ao'], size: '1k' },        // courses along u, image top up the slope
  fabric_boucle: { tile: 0.4, maps: ['normal', 'rough'], size: '1k' },
  grass: { tile: 1.4, maps: ['color', 'normal'], size: '1k' },
  asphalt: { tile: 2.1, maps: ['color', 'normal', 'rough'], size: '1k' },
  concrete_paving: { tile: 2.5, maps: ['color', 'normal'], size: '1k' },
  render_ext: { tile: 1.998, maps: ['normal'], size: '1k' },
};
// Skies (sky/manifest.json): sun = unit vector to the sun in three.js equirect space; cap clips the sun disc (the
// directional light is the sun); sat keeps that much of the sky's colour.
export const SKIES = {
  day: { file: 'kloofendal_48d_partly_cloudy_puresky', sun: [0.5546, 0.742, 0.3767], cap: 6, sat: 0.75 },
  golden: { file: 'qwantani_sunset_puresky', sun: [0.805, 0.1056, 0.5838], cap: 6, sat: 0.35 },   // its clipped sky is bluish: keep the fill near neutral
  night: { file: 'qwantani_dusk_1_puresky', sun: [0.7765, 0.3499, 0.524], cap: 6, sat: 1 },
};
const SKY_SIZE = '1k';   // 1k gives a 256 PMREM, the same size as RoomEnvironment, so a swap recompiles no shaders
// File stamps (owner, Nov 2026: "optimize load time on all devices, without compromising quality"): the photo maps and
// the skies carry ?v=, so the site's service worker (/sw.js) keeps them between visits. Bump TEX_REV when any
// hd/tex file is replaced under the same name, SKY_REV when a sky file is (and hero-boot.js's golden-sky preload with it).
const TEX_REV = '1', SKY_REV = '1';

// Sky files: the .hdr's own RGBE bytes as 4 planes (R, G, B, E), each row delta coded, then gzip -9
// (walkthrough/tools/sky_pack.py). 45% under the server's gzip of the .hdr (golden 593 -> 328 KB), lossless: this
// rebuilds a flat .hdr, header plus the same RGBE bytes, which RGBELoader reads as it is, so the pixels are identical.
async function skyFile(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + ' ' + r.status);
  let ab = await r.arrayBuffer();
  const g = new Uint8Array(ab, 0, 2);
  if (g[0] === 0x1f && g[1] === 0x8b) ab = await new Response(new Blob([ab]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  const dv = new DataView(ab);
  if (dv.getUint32(0, true) !== 0x31534250) throw new Error(url + ': not PBS1');
  const hl = dv.getUint32(4, true), W = dv.getUint32(8, true), H = dv.getUint32(12, true), N = W * H;
  const src = new Uint8Array(ab, 16 + hl, N * 4), out = new Uint8Array(hl + N * 4);
  out.set(new Uint8Array(ab, 16, hl));
  for (let c = 0; c < 4; c++) for (let y = 0; y < H; y++) {
    const s = c * N + y * W, d = hl + y * W * 4 + c; let v = 0;
    for (let x = 0; x < W; x++) { v = (v + src[s + x]) & 255; out[d + 4 * x] = v; }
  }
  return out;
}

// Shared by every createHD on the page (the hero's, the tour's, each walk's: one module instance, so every importer must
// keep the same './hd.js?v=' URL). Load-time pass, Nov 2026: two walks building at once asked for the same 2k photo
// at the same moment and both downloaded it, and the tour fetched and decoded again the sky the hero had just decoded.
// Photo files: the download in flight is shared and let go once it lands (a kept 2k file would sit in memory; later
// asks read the browser's cache). Sky files: the decoded bytes are kept for a minute after their last use, the gap
// between the hero's sky and the tour's build, then let go. The same bytes either way, so the same pixels.
const SKYF = new Map(), BLOBS = new Map();
const abs = url => new URL(url, location.href).href;
function skyFileShared(url) {
  const k = abs(url); let e = SKYF.get(k);
  const drop = x => () => { if (SKYF.get(k) === x) SKYF.delete(k); };
  if (!e) { e = { p: skyFile(url), t: 0 }; SKYF.set(k, e); e.p.catch(drop(e)); }
  clearTimeout(e.t); e.t = setTimeout(drop(e), 60000);
  return e.p;
}
function blobShared(url) {
  const k = abs(url); let p = BLOBS.get(k);
  if (!p) {
    p = fetch(url, { priority: 'low' }).then(r => { if (!r.ok) throw new Error(url); return r.blob(); });
    BLOBS.set(k, p); const off = () => BLOBS.delete(k); p.then(off, off);
  }
  return p;
}

// World-space box projection (metres) for map, normal and roughness maps.
const WORLD_UV = shader => {
  shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
	{
		vec4 hdP = vec4( transformed, 1.0 );
		#ifdef USE_INSTANCING
			hdP = instanceMatrix * hdP;
		#endif
		hdP = modelMatrix * hdP;
		vec3 hdN = abs( ( vec4( transformedNormal, 0.0 ) * viewMatrix ).xyz );
		vec2 hdUv = hdN.y >= max( hdN.x, hdN.z ) ? hdP.xz : ( hdN.x >= hdN.z ? hdP.zy : hdP.xy );
		#ifdef USE_MAP
			vMapUv = ( mapTransform * vec3( hdUv, 1.0 ) ).xy;
		#endif
		#ifdef USE_NORMALMAP
			vNormalMapUv = ( normalMapTransform * vec3( hdUv, 1.0 ) ).xy;
		#endif
		#ifdef USE_ROUGHNESSMAP
			vRoughnessMapUv = ( roughnessMapTransform * vec3( hdUv, 1.0 ) ).xy;
		#endif
	}`);
};
// Lawn: a second, larger and offset sample of the colour map plus a slow world-space variation, so the tiling breaks up.
const GRASS = shader => {
  shader.vertexShader = 'varying vec2 vHdW;\n' + shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n\tvHdW = ( modelMatrix * vec4( transformed, 1.0 ) ).xz;');
  shader.fragmentShader = 'varying vec2 vHdW;\n' + shader.fragmentShader
    .replace('#include <common>', `#include <common>
float hdHash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
float hdNoise( vec2 p ) {
	vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
	return mix( mix( hdHash( i ), hdHash( i + vec2( 1.0, 0.0 ) ), f.x ), mix( hdHash( i + vec2( 0.0, 1.0 ) ), hdHash( i + 1.0 ), f.x ), f.y );
}`)
    .replace('#include <map_fragment>', `#include <map_fragment>
	#ifdef USE_MAP
		diffuseColor.rgb = mix( diffuseColor.rgb, diffuse * texture2D( map, vMapUv * 0.37 + vec2( 0.31, 0.67 ) ).rgb, 0.4 );
	#endif
	diffuseColor.rgb *= mix( 0.84, 1.12, 0.6 * hdNoise( vHdW * 0.09 ) + 0.4 * hdNoise( vHdW * 0.027 + 5.3 ) );`);
};

export function createHD({ THREE, renderer, res = null, lite = false, base = './hd/', onChange = () => {}, pace = null }) {
  const aniso = lite ? 4 : Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const sets = new Map(), recs = new WeakMap(), clones = new Map(), AVG = new WeakMap();
  let live = false, warned = false, dead = false;
  const warn = what => { if (!warned) { warned = true; console.warn('hd: kept the drawn textures for', what); } };
  const frac = v => v - Math.floor(v);

  const loadImg = url => new Promise((ok, no) => {
    const img = new Image();
    img.decoding = 'async'; img.fetchPriority = 'low';   // after the page's own requests
    // decode off the main thread where we can; decode() can stall in a hidden tab, so never wait on it for long
    img.onload = () => Promise.race([img.decode ? img.decode().catch(() => {}) : null, new Promise(r => setTimeout(r, 800))]).then(() => ok(img));
    img.onerror = () => no(new Error(url));
    img.src = url;
  });
  // Chrome, Edge and Firefox 98+: each photo decoded off the main thread, already flipped and with no colour or alpha
  // conversion (as three's ImageBitmapLoader), so its upload is a plain copy. An <img> was decoded once more on the main
  // thread at upload time, 0.1-0.4 s for a 2k map (owner, Nov 2026: "if i load on like some laptop or mobile, its like
  // lagging in the transition screen and animation on 3d"). Safari keeps the <img> (its options are not reliable there).
  const UA = navigator.userAgent, ffv = /Firefox\/(\d+)/.exec(UA);
  const BITMAP = typeof createImageBitmap === 'function' && !/^((?!chrome|android).)*safari/i.test(UA) && !(ffv && +ffv[1] < 98);
  const isBmp = src => typeof ImageBitmap !== 'undefined' && src instanceof ImageBitmap;
  const loadBmp = url => blobShared(url)
    .then(b => createImageBitmap(b, { imageOrientation: 'flipY', premultiplyAlpha: 'none', colorSpaceConversion: 'none' }));
  // Mean of an image (0..1 per channel, as stored), from a 32 px copy. Cached per image.
  function avg(src) {
    if (!src || !(src.naturalWidth || src.width)) return null;
    if (AVG.has(src)) return AVG.get(src);
    let a = null;
    try {
      const c = document.createElement('canvas'); c.width = c.height = 32;
      const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, 32, 32);
      const d = g.getImageData(0, 0, 32, 32).data; let r = 0, gg = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 8) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; }
      if (n) a = [r / n / 255, gg / n / 255, b / n / 255];
    } catch (e) { a = null; }
    AVG.set(src, a); return a;
  }
  // the same, with the 32 px copy of a photo made off the main thread where the browser can (drawing a 2k <img> down to
  // 32 px here held a frame up); the mean of the copy is the same either way. A drawn (canvas) map is read here as before:
  // copying a canvas off the main thread measured slower
  async function avgA(src) {
    if (!src || AVG.has(src) || typeof createImageBitmap !== 'function' || !((src.naturalWidth || src.width) > 64) || src instanceof HTMLCanvasElement) return avg(src);
    try {
      const b = await createImageBitmap(src, { resizeWidth: 32, resizeHeight: 32, resizeQuality: 'high' });
      const a = avg(b); AVG.delete(b); if (b.close) b.close();
      if (a) { AVG.set(src, a); return a; }
    } catch (e) { /* the 32 px copy drawn here instead */ }
    return avg(src);
  }
  const lin = a => new THREE.Color().setRGB(a[0], a[1], a[2], THREE.SRGBColorSpace);   // sRGB average -> linear
  // The porcelain slab as 600 mm tiles: each quarter of the 1.2 m image turned differently (so the veining breaks at
  // the joints, as on real tiles) and a fine, soft grout line over the joints (owner: grout not so obvious).
  function grout(img, rough) {
    const s = img.naturalWidth || img.width, h = s / 2, c = document.createElement('canvas'); c.width = c.height = s;
    const g = c.getContext('2d'), turn = [0, Math.PI, Math.PI / 2, -Math.PI / 2];
    for (let k = 0; k < 4; k++) {
      const i = k & 1, j = k >> 1;
      g.save(); g.translate(i * h + h / 2, j * h + h / 2); g.rotate(turn[k]); g.drawImage(img, i * h, j * h, h, h, -h / 2, -h / 2, h, h); g.restore();
    }
    g.fillStyle = rough ? 'rgba(224,224,224,0.5)' : 'rgba(176,164,148,0.38)';
    const w = Math.max(1, Math.round(s / 700));
    for (const p of [0, h, s]) { g.fillRect(p - w / 2, 0, w, s); g.fillRect(0, p - w / 2, s, w); }
    return c;
  }
  function texOf(src, srgb) {
    const t = src instanceof HTMLCanvasElement ? new THREE.CanvasTexture(src) : new THREE.Texture(src);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; t.needsUpdate = true;
    if (isBmp(src)) t.flipY = false;   // flipped when decoded
    return t;
  }
  function load(name) {
    let S = sets.get(name);
    if (S) return S;
    const def = SETS[name];
    S = { name, def, tex: null, avg: null, rough: 0.5, wait: [], p: Promise.resolve() }; sets.set(name, S);
    if (!res) return S;
    const size = def.size === '1k' ? '1k' : res, maps = def.maps.filter(m => !lite || m === 'color' || m === 'normal');
    const url = m => `${base}tex/${name}/${name}_${m === 'rough' || m === 'ao' ? '1k' : size}_${m}.webp?v=${TEX_REV}`;
    // (the porcelain's grout is drawn over an <img>: its quarters are turned as the image stands)
    const get = BITMAP && !def.grout ? u => loadBmp(u).catch(() => loadImg(u)) : loadImg;
    S.p = Promise.all(maps.map(m => get(url(m)).then(img => [m, img]))).then(async list => {
      if (dead) return;   // disposed while loading: upload nothing
      const img = Object.fromEntries(list), tex = {}, drop = () => { for (const t of Object.values(tex)) t.dispose(); };
      if (def.grout) { img.color = grout(img.color, false); if (img.rough) img.rough = grout(img.rough, true); }
      // upload now, not mid-scroll; one map per break the caller gives (pace), so no frame carries several
      for (const m of maps) { if (pace) { await pace(); if (dead) return drop(); } tex[m] = texOf(img[m], m === 'color'); renderer.initTexture(tex[m]); }
      if (img.color) S.avg = lin((await avgA(img.color)) || [1, 1, 1]);
      if (img.rough) S.rough = Math.max(0.05, ((await avgA(img.rough)) || [0.5])[0]);
      if (dead) return drop();
      S.tex = tex;
      if (live) await flush(S);
    }).catch(() => warn(name));
    return S;
  }
  // A copy of a loaded map with its own repeat / offset. Clones share the image and the GPU texture; the source's
  // version is put back so a clone made after the upload doesn't upload the image again.
  function xf(S, m, o) {
    const T = S.def.tile, w = !!o.world, turn = o.rot === 90;
    const su = w ? 1 : o.su ?? 1, sv = w ? 1 : o.sv ?? 1, ou = w ? 0 : o.ou ?? 0, ov = w ? 0 : o.ov ?? 0;
    const rep = turn ? [sv / T, su / T] : [su / T, sv / T], off = turn ? [frac(ov / T), frac(-ou / T)] : [frac(ou / T), frac(ov / T)];
    const key = [S.name, m, ...rep, ...off, turn ? 1 : 0].map(v => typeof v === 'number' ? v.toFixed(5) : v).join('|');
    let c = clones.get(key);
    if (!c) {
      const src = S.tex[m], v = src.source.version;
      c = src.clone(); src.source.version = v; c.version = Math.max(c.version, 1);
      c.repeat.set(rep[0], rep[1]); c.offset.set(off[0], off[1]); c.rotation = turn ? Math.PI / 2 : 0; c.userData.hd = true;
      clones.set(key, c);
    }
    return c;
  }
  function apply(rec, S) {
    const { mat: m, o } = rec, t = S.tex, old = new Set();
    if (rec.done || !t) return;
    rec.done = true;
    if (m.userData.hd === S.name) return;   // a clone of a material that already has them
    if (t.color && o.color !== 'keep') {
      const P = (m.map && avg(m.map.image)) || [1, 1, 1], p = lin(P), A = S.avg;   // what the drawn map showed, and the photo
      const k = (c, a, b) => Math.min(6, c * a / Math.max(b, 1e-3));   // a dark photo (grass, asphalt) may need a strong lift
      const L = S.def.lift || [1, 1, 1];   // per-set adjustment after the match (owner's finish)
      m.color.setRGB(k(m.color.r, p.r, A.r) * L[0], k(m.color.g, p.g, A.g) * L[1], k(m.color.b, p.b, A.b) * L[2]);
      if (m.map) old.add(m.map);
      m.map = xf(S, 'color', o);
    }
    if (t.normal) {
      m.normalMap = xf(S, 'normal', o); m.normalMapType = THREE.TangentSpaceNormalMap;
      const n = o.normalScale ?? 1; m.normalScale.set(n, n);
      if (m.bumpMap) { old.add(m.bumpMap); m.bumpMap = null; }
    }
    if (t.rough && o.rough !== false) { m.roughnessMap = xf(S, 'rough', o); m.roughness = Math.min(4, m.roughness / S.rough); }
    if (t.ao && o.ao !== false) { m.aoMap = xf(S, 'ao', o); m.aoMapIntensity = o.aoIntensity ?? 1; }
    if (o.world) m.onBeforeCompile = WORLD_UV;
    else if (o.grass) m.onBeforeCompile = GRASS;
    m.userData.hd = S.name; m.needsUpdate = true;
    if (o.dispose !== false) for (const x of old) if (!x.userData.hd && x !== m.map) x.dispose();   // the drawn texture it replaced
  }
  async function flush(S) {
    const list = S.wait; S.wait = [];
    // the drawn maps' means first, off the main thread (apply's colour match reads them)
    for (const r of list) { const im = S.tex.color && r.o.color !== 'keep' && r.mat.map && r.mat.map.image; if (im && !AVG.has(im)) await avgA(im); }
    if (dead) return;
    for (const r of list) apply(r, S);
    if (list.length) onChange(S.name);
  }
  function use(mat, name, o = {}) {
    if (!mat || !SETS[name]) return;
    let list = recs.get(mat);
    if (!list) recs.set(mat, list = []);
    if (list.some(r => r.set === name)) return;
    const rec = { set: name, o, mat }; list.push(rec);
    const S = load(name);
    S.wait.push(rec);
    if (live && S.tex) flush(S);
  }
  function start() { live = true; for (const S of sets.values()) if (S.tex) flush(S); }
  // What a material asked for (plain data, for the bake page to send with its parts).
  const usesOf = mat => (recs.get(mat) || []).map(r => ({ set: r.set, o: r.o }));
  const settled = () => Promise.allSettled([...sets.values()].map(S => S.p));

  // ---- HDRI skies ----
  const skies = new Map();
  // Mean brightness of a white matt cube lit only by `env` (seen from both diagonals, so all six faces count).
  function level(env) {
    const sc = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 }));
    sc.add(box); sc.environment = env;
    const rt = new THREE.WebGLRenderTarget(16, 16), px = new Uint8Array(16 * 16 * 4);
    const prev = renderer.getRenderTarget(), cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha();
    let out = 0;
    try {
      for (let I = 0.6, k = 0; k < 3; k++, I /= 4) {
        sc.environmentIntensity = I; let sum = 0, n = 0, hi = 0;
        for (const s of [1, -1]) {
          cam.position.set(3 * s, 3 * s, 3 * s); cam.lookAt(0, 0, 0);
          renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(sc, cam);
          renderer.readRenderTargetPixels(rt, 0, 0, 16, 16, px);
          for (let i = 0; i < px.length; i += 4) if (px[i + 3] > 200) { sum += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]; n++; hi = Math.max(hi, px[i], px[i + 1], px[i + 2]); }
        }
        out = n ? sum / n / 255 / I : 0;
        if (hi < 250) break;
      }
    } catch (e) { out = 0; }
    finally { renderer.setRenderTarget(prev); renderer.setClearColor(cc, ca); rt.dispose(); box.geometry.dispose(); box.material.dispose(); }
    return out;
  }
  // Equirect HDR -> sun disc clipped, colour eased -> PMREM (the sky lights and reflects; the page keeps its own dome).
  function prep(src, cap, sat) {
    const w = src.image.width, h = src.image.height;
    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: false });
    const mat = new THREE.ShaderMaterial({
      uniforms: { t: { value: src }, cap: { value: cap }, sat: { value: sat } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }',
      fragmentShader: `uniform sampler2D t; uniform float cap; uniform float sat; varying vec2 vUv;
        void main() { vec3 c = texture2D( t, vUv ).rgb; float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
          if ( l > cap ) { c *= cap / l; l = cap; }
          c = mix( vec3( l ), c, sat );
          // 'pure sky' photos are black below the horizon: add the light bouncing off warm ground and walls, so
          // ceilings and undersides (lit from below) don't go dark grey
          vec3 hz = texture2D( t, vec2( vUv.x, 0.53 ) ).rgb; float hl = min( dot( hz, vec3( 0.2126, 0.7152, 0.0722 ) ), cap );
          vec3 ground = vec3( 0.95, 0.86, 0.72 ) * hl * 0.45;
          c = mix( c, ground, smoothstep( 0.5, 0.45, vUv.y ) );
          gl_FragColor = vec4( c, 1.0 ); }`,
      depthTest: false, depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat), sc = new THREE.Scene(); quad.frustumCulled = false; sc.add(quad);
    const prev = renderer.getRenderTarget(), gen = new THREE.PMREMGenerator(renderer);
    try {
      renderer.setRenderTarget(rt); renderer.render(sc, new THREE.OrthographicCamera()); renderer.setRenderTarget(prev);
      return gen.fromEquirectangular(rt.texture);   // the cube render target (its texture lights the scene)
    } finally { renderer.setRenderTarget(prev); gen.dispose(); rt.dispose(); mat.dispose(); quad.geometry.dispose(); }
  }
  function sky(name) {
    const def = SKIES[name];
    if (!def || !res) return Promise.resolve(null);
    if (!skies.has(name)) skies.set(name, (async () => {
      const stem = `${base}sky/${def.file}_${SKY_SIZE}`;
      const fileP = skyFileShared(`${stem}.rgbe.gz?v=${SKY_REV}`); fileP.catch(() => {});   // downloads while the loader's module does
      const { RGBELoader } = await import('three/addons/loaders/RGBELoader.js');
      let src;
      try {   // the packed file through three's own loader (same texture setup as before), the plain .hdr if it fails
        const u = URL.createObjectURL(new Blob([await fileP]));
        try { src = await new RGBELoader().loadAsync(u); } finally { URL.revokeObjectURL(u); }
      } catch (e) { src = await new RGBELoader().loadAsync(`${stem}.hdr`); }
      if (dead) { src.dispose(); return null; }
      const envRT = prep(src, def.cap, def.sat), env = envRT.texture; src.dispose();
      return { name, env, envRT, level: level(env), sun: new THREE.Vector3(...def.sun).normalize() };
    })().catch(() => { warn('sky ' + name); return null; }));
    return skies.get(name);
  }

  function dispose() {
    dead = true;
    for (const S of sets.values()) if (S.tex) for (const t of Object.values(S.tex)) t.dispose();
    for (const c of clones.values()) c.dispose();
    for (const p of skies.values()) p.then(s => { if (s) s.envRT.dispose(); });
  }

  // after a lost GPU context: the skies' cube targets are empty, so the next sky() builds them again
  function forgetSkies() {
    for (const p of skies.values()) p.then(s => { if (s) s.envRT.dispose(); });
    skies.clear();
  }

  return { res, use, start, usesOf, settled, sky, level, dispose, forgetSkies };
}
