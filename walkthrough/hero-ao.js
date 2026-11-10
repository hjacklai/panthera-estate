// hero-ao.js · contact shadows for the estate hero: screen-space ambient occlusion (three's GTAOPass), laid over the
// hero's own antialiased draw. The darkening under eaves, at wall bases, round kerbs and under cars that a photo has
// and a plain 3D render lacks (owner, Nov 2026: "must not look fake", phones too).
//
//   const ao = await createAO({ THREE, renderer, scene, camera, lite, reduced })   (null where it cannot run)
//   ao.render()            after each hero draw: works the AO out again only when it must, then multiplies it on
//   ao.tick(now, moving)   once per hero frame: passive frame-time sampling (no readPixels, no stalls)
//   ao.lost(), ao.restored(), ao.invalidate(), ao.bytes(), ao.report(), ao.set({...}), ao.bench(n), ao.dispose()
//
// How it works
// - The hero keeps its direct MSAA draw to the canvas. This module then draws its own G-buffer (depth only)
//   into small targets sized in CSS pixels: opaque meshes with one MeshNormalMaterial (per side), alpha-tested cards
//   (foliage, vents, mesh fence, lawn tint, palms) with the same cut-out, so no square halos and no AO printed across
//   leaves; glass, MeshBasic, the light pools, the sky, lines and the birds are left out. The neighbourhood
//   ('hx-context') and the driving cars ('hx-life') are in it too, so they occlude and are not shaded by what lies
//   behind them. A clip box round the lot keeps the AO itself to the estate.
// - GTAOPass (output Off) works out AO and its denoise from that G-buffer; the pass's own blendMaterial (DstColor x
//   Zero) then multiplies the result onto the canvas, about 0.6 strong.
// - Cached: the AO is worked out again only when the camera, the drawing buffer or the AO size changes, or a driving
//   car inside the box has moved. Otherwise a frame costs just the blend (about 0.1 ms).
// - Cost: measured from the GPU timer when the browser has one, else from the frame times of alternate frames with and
//   without AO; a ladder (samples 12 -> 8, size 1 -> 0.7 -> 0.5 of CSS pixels, then off) only ever steps down.
//   Phones (lite) start at 8 samples and half size and switch off above 2.5 ms; desktop allows 3.5 ms.
// - It fades in only while the camera moves (never on a still frame), and is gated by the lens: smoothstep(6, 14, fov),
//   so the tour's lens dolly to its plan view and the hand-off to the drawing have none.
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const LAYER = 7;   // the G-buffer camera sees only this layer (nothing else in the hero uses layers)
const AO = { radius: 2.4, distanceExponent: 1.8, thickness: 2.0, distanceFallOff: 0.8, scale: 1.0, screenSpaceRadius: false };
const PD = { lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2 };
const BLEND = 0.6;
// phones (lite): the AO is worked out at half size and stretched up, where a 2.4 m reach at 0.6 read as dark smudges
// across lawns, roads and walls (owner, Nov 2026: "the shadows ... look staining"). Tighter and lighter there: the
// dark line in corners, under eaves and round kerbs stays, the wide blotches go. Desktop unchanged.
const AO_LITE = { ...AO, radius: 1.0 };
const BLEND_LITE = 0.4;
// the lot (x -89..0, z 0..98) plus a margin; y from below the dry pond to above the roofs. East it stops short of the
// Persiaran, so the through traffic there never needs the AO worked out again
const BOX = { min: [-100, -3, -12], max: [10, 18, 110] };
const FADE_S = 0.8;   // seconds of camera motion to fade in
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const median = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
// a low percentile of a window of costs: other work on the GPU (other tabs, uploads) only ever adds to a sample, so
// the lower end is the AO's own cost, while a truly slow GPU raises every sample
const low = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length * 0.3)] : 0; };

export async function createAO({ THREE, renderer, scene, camera, lite = false, reduced = false }) {
  const gl = renderer.getContext(), X = renderer.extensions;
  if (!(X.has('EXT_color_buffer_float') || X.has('EXT_color_buffer_half_float'))) return null;   // the AO targets are half float

  const LADDER = lite ? [[8, 0.5]] : [[12, 1], [8, 1], [8, 0.7], [8, 0.5]];   // [samples, AO size in CSS pixels]
  const LIMIT = lite ? 2.5 : 3.5;   // ms of extra frame cost allowed
  let rung = 0, state = 'probe', forced = null, blendK = lite ? BLEND_LITE : BLEND, view = null, disposed = false;

  // ---------- targets and the pass ----------
  const depthTex = new THREE.DepthTexture(1, 1);
  depthTex.format = THREE.DepthFormat; depthTex.type = THREE.UnsignedIntType;
  const gRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.UnsignedByteType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthTexture: depthTex });
  const aoCam = new THREE.PerspectiveCamera();
  const gtao = new GTAOPass(scene, aoCam, 1, 1);
  // our own G-buffer (the pass's own would ignore the cut-outs). Depth only: the normals are worked out from it, which
  // keeps the thin board-and-batten ribs from printing a dotted pattern on the walls and ignores flipped normals on
  // some tree trunks (both seen with a normal buffer)
  gtao.setGBuffer(depthTex, undefined);
  const AOP = lite ? AO_LITE : AO;
  gtao.updateGtaoMaterial({ ...AOP, samples: LADDER[0][0] });
  gtao.updatePdMaterial({ ...PD, samples: lite ? 8 : 12 });
  gtao.output = GTAOPass.OUTPUT.Off;
  gtao.setSceneClipBox(new THREE.Box3(new THREE.Vector3(...BOX.min), new THREE.Vector3(...BOX.max)));
  gtao.blendMaterial.uniforms.tDiffuse.value = gtao.pdRenderTarget.texture;
  const quad = new FullScreenQuad(gtao.blendMaterial), dbg = new FullScreenQuad(null);

  // ---------- what goes into the G-buffer ----------
  const nm = new Map(), entries = [], cars = [], lights = [];
  let builtN = -1;
  const cutout = sh => {   // the source card's map / alphaMap and alphaTest, so leaves are leaves
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <normal_pars_fragment>', '#include <map_pars_fragment>\n#include <alphamap_pars_fragment>\n#include <alphatest_pars_fragment>\n#include <normal_pars_fragment>')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n#include <map_fragment>\n#include <alphamap_fragment>\n#include <alphatest_fragment>');
  };
  const normalFor = m => {
    const cut = m.alphaTest > 0 && !!(m.map || m.alphaMap);
    const key = m.side + '/' + (m.polygonOffset ? m.polygonOffsetFactor + ',' + m.polygonOffsetUnits : '') + '/' +
      (cut ? m.alphaTest + '|' + (m.map ? m.map.uuid : '') + '|' + (m.alphaMap ? m.alphaMap.uuid : '') : '');
    let g = nm.get(key);
    if (!g) {
      g = new THREE.MeshNormalMaterial({ side: m.side });
      g.blending = THREE.NoBlending; g.toneMapped = false; g.colorWrite = false;   // depth is all that is read
      if (m.polygonOffset) Object.assign(g, { polygonOffset: true, polygonOffsetFactor: m.polygonOffsetFactor, polygonOffsetUnits: m.polygonOffsetUnits });
      if (cut) { g.map = m.map || null; g.alphaMap = m.alphaMap || null; g.alphaTest = m.alphaTest; g.onBeforeCompile = cutout; g.customProgramCacheKey = () => 'hx-ao-cut'; }
      nm.set(key, g);
    }
    return g;
  };
  const skip = m => !m || m.isShaderMaterial || m.isMeshBasicMaterial || m.transparent || m.opacity < 1 || m.depthWrite === false ||
    m.colorWrite === false || m.visible === false || m.name === 'glass' || m.blending !== THREE.NormalBlending;
  function build() {
    for (const e of entries) e.o.layers.disable(LAYER);
    for (const l of lights) l.layers.disable(LAYER);
    entries.length = 0; cars.length = 0; lights.length = 0;
    scene.traverse(o => {
      // the lights are seen by the G-buffer camera too: they draw nothing there, but the scene's light state then keeps
      // the same light count as the hero's own draw. Without them each AO pass bumped three's light-state version and
      // every lit material re-resolved its program on the next hero draw (about 0.5 ms CPU per frame on desktop)
      if (o.isLight) { o.layers.enable(LAYER); lights.push(o); return; }
      if (!o.isMesh || o.isSkinnedMesh) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (skip(m)) return;
      if (o.geometry && o.geometry.attributes.wk) return;   // the egrets (hero-life.js): small, high, always moving
      const g = normalFor(m);
      entries.push({ o, src: o.material, m, g, cur: null });
      o.layers.enable(LAYER);
      if (o.isInstancedMesh && o.parent && o.parent.name === 'hx-life' && !cars.length) cars.push(o);   // one part is enough: they share matrices
    });
    builtN = scene.children.length; stale = true;
  }
  function drawG() {
    const bg = scene.background, ov = scene.overrideMaterial, smu = renderer.shadowMap.needsUpdate, ac = renderer.autoClear;
    renderer.getClearColor(cc); const ca = renderer.getClearAlpha();
    for (const e of entries) {
      if (e.o.material !== e.src || (e.g.alphaTest > 0 && e.g.map !== (e.m.map || null))) rebuild = true;   // swapped or re-mapped: sorted out next time
      e.cur = e.o.material; e.o.material = e.g;
    }
    try {
      scene.background = null; scene.overrideMaterial = null; renderer.shadowMap.needsUpdate = false;
      renderer.setRenderTarget(gRT); renderer.setClearColor(0x7777ff, 1); renderer.clear(true, true, false);
      renderer.autoClear = false;
      renderer.render(scene, aoCam);
    } finally {
      for (const e of entries) if (e.o.material === e.g) e.o.material = e.cur;
      scene.background = bg; scene.overrideMaterial = ov; renderer.shadowMap.needsUpdate = smu;
      renderer.autoClear = ac; renderer.setClearColor(cc, ca);
    }
  }
  const cc = new THREE.Color();
  let rebuild = false, stale = true;

  // ---------- sizes ----------
  const sz = new THREE.Vector2(), db = new THREE.Vector2();
  let aoW = 0, aoH = 0;
  function size() {
    renderer.getSize(sz);
    const r = LADDER[Math.min(rung, LADDER.length - 1)][1], w = Math.max(1, Math.round(sz.x * r)), h = Math.max(1, Math.round(sz.y * r));
    if (w === aoW && h === aoH) return;
    aoW = w; aoH = h; gRT.setSize(w, h); gtao.setSize(w, h); stale = true;
  }

  // ---------- the cache key: camera, projection, drawing buffer, AO size and level ----------
  const key = new Float64Array(37), k2 = new Float64Array(37), prevCam = new Float64Array(37);
  function camKey(out) {
    out.set(camera.matrixWorld.elements, 0); out.set(camera.projectionMatrix.elements, 16);
    renderer.getDrawingBufferSize(db); out[32] = db.x; out[33] = db.y; out[34] = aoW; out[35] = aoH; out[36] = rung;
  }
  const same = (a, b, n = a.length) => { for (let i = 0; i < n; i++) if (a[i] !== b[i]) return false; return true; };
  // a car whose middle is this near the box can print on it (the AO fades out over AO.radius past the box, and a car
  // is about 1.8 m wide): the visitor turning in at the gates counts, the Persiaran's through traffic does not
  const R = Math.max(0, AOP.radius - 0.9);
  function carKey() {   // the cars inside the box, where they are (0 when none)
    if (!cars.length) return 0;
    const im = cars[0], a = im.instanceMatrix.array; let h = 0;
    for (let i = 0; i < im.count; i++) {
      const j = i * 16, x = a[j + 12], z = a[j + 14];
      if (a[j] * a[j] + a[j + 2] * a[j + 2] < 1e-4) continue;   // scaled away (off the ends of its route)
      if (x > BOX.min[0] - R && x < BOX.max[0] + R && z > BOX.min[2] - R && z < BOX.max[2] + R) h += 1 + i * 1000 + x * 1.37 + z * 2.71;
    }
    return h;
  }

  // ---------- cost: GPU timer when there is one, else frame times ----------
  let tq = gl.getExtension('EXT_disjoint_timer_query_webgl2'), qOpen = null, zeros = 0;
  const pend = [], costs = [], dC = [], dS = [];
  let warm = 4, lastCost = null, lastGpu = null, lastCpu = null, alt = 0, kind = null, prevKind = null, lastTick = 0, slow = 0, okF = 0;
  function qPoll() {
    if (!tq) return;
    const disjoint = gl.getParameter(tq.GPU_DISJOINT_EXT);
    while (pend.length) {
      const p = pend[0];
      if (!gl.getQueryParameter(p.q, gl.QUERY_RESULT_AVAILABLE)) break;
      const ns = gl.getQueryParameter(p.q, gl.QUERY_RESULT); gl.deleteQuery(p.q); pend.shift();
      if (disjoint) continue;
      if (ns === 0 && ++zeros >= 5) { tq = null; return; }   // a timer that always says 0: use frame times instead
      lastGpu = ns / 1e6; lastCpu = p.cpu;
      judge(Math.max(lastGpu, p.cpu));
    }
  }
  function judge(ms) {
    if (warm > 0) { warm--; return; }   // the first draws after a change pay for uploads
    costs.push(ms);
    const need = state === 'probe' ? (reduced ? 1 : 8) : 20;
    if (costs.length < need) return;
    lastCost = low(costs); costs.length = 0;
    log.push([rung, +lastCost.toFixed(2)]); if (log.length > 12) log.shift();
    // two windows in a row before stepping down: other work on the GPU (the page's photo maps uploading, the
    // neighbourhood compiling) can crowd the GPU for a moment
    if (lastCost > LIMIT) { if (++strikes >= 2) { strikes = 0; stepDown(); } }
    else { strikes = 0; if (state === 'probe') state = 'on'; }
  }
  let strikes = 0;
  const log = [];   // [level, ms] per judged window (checking only)
  let tmpMat = null;
  function stepDown() {
    rung++; warm = 3; costs.length = dC.length = dS.length = 0; slow = okF = 0;
    if (rung >= LADDER.length) { off(); return; }
    const s = LADDER[rung][0];
    if (s !== gtao.gtaoMaterial.defines.SAMPLES) {   // compile the new variant off the main thread first, then switch
      const u = gtao.gtaoMaterial.uniforms, tn = u.tNormal.value, td = u.tDepth.value;
      u.tNormal.value = u.tDepth.value = null;   // (render-target textures cannot be cloned: put back after)
      const t = gtao.gtaoMaterial.clone(); t.defines = { ...gtao.gtaoMaterial.defines, SAMPLES: s };
      u.tNormal.value = t.uniforms.tNormal.value = tn; u.tDepth.value = t.uniforms.tDepth.value = td;
      const prev = renderer.getRenderTarget();
      renderer.setRenderTarget(gtao.gtaoRenderTarget);
      const p = renderer.compileAsync(new THREE.Mesh(quadGeo, t), ortho);
      renderer.setRenderTarget(prev);
      busy = true;
      p.catch(() => {}).then(() => { if (disposed) return; gtao.updateGtaoMaterial({ samples: s }); tmpMat = t; busy = false; stale = true; });
    }
    // (the level is in the cache key, so the AO is worked out again at the new level on the next draw)
  }
  let busy = false;
  function off() {
    state = 'off'; kAO = 0;
    for (const e of entries) e.o.layers.disable(LAYER);
    for (const l of lights) l.layers.disable(LAYER);
    gRT.dispose(); gtao.gtaoRenderTarget.dispose(); gtao.pdRenderTarget.dispose(); aoW = aoH = 0;
  }

  // ---------- compile everything ahead, off the main thread ----------
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), quadGeo = new THREE.PlaneGeometry(2, 2);
  async function compileAll() {
    const px = new THREE.Scene(), made = new Set(), pg = new THREE.PlaneGeometry(1, 1);
    for (const e of entries) {
      const inst = !!e.o.isInstancedMesh, ic = inst && !!e.o.instanceColor, k = e.g.uuid + (inst ? (ic ? 'c' : 'i') : '');
      if (made.has(k)) continue; made.add(k);
      let p;
      if (inst) { p = new THREE.InstancedMesh(pg, e.g, 1); if (ic) p.setColorAt(0, cc.set(1, 1, 1)); } else p = new THREE.Mesh(pg, e.g);
      p.layers.set(LAYER); p.frustumCulled = false; px.add(p);
    }
    aoCam.layers.set(LAYER);
    const prev = renderer.getRenderTarget(), jobs = [];
    // each against the target it will draw into (the program depends on it: colour space, tone mapping). The G-buffer
    // programs with the hero scene's lights (the light count is part of three's program key, see build())
    renderer.setRenderTarget(gRT); jobs.push(renderer.compileAsync(px, aoCam, scene));
    renderer.setRenderTarget(gtao.gtaoRenderTarget); jobs.push(renderer.compileAsync(new THREE.Mesh(quadGeo, gtao.gtaoMaterial), ortho));
    renderer.setRenderTarget(gtao.pdRenderTarget); jobs.push(renderer.compileAsync(new THREE.Mesh(quadGeo, gtao.pdMaterial), ortho));
    renderer.setRenderTarget(null); jobs.push(renderer.compileAsync(new THREE.Mesh(quadGeo, gtao.blendMaterial), ortho));
    renderer.setRenderTarget(prev);
    try { await Promise.all(jobs); } catch (e) { /* compiles on first use instead */ }
    pg.dispose();
  }

  // ---------- one AO pass, and the blend ----------
  let computes = 0, cached = 0;
  function compute() {
    const t0 = performance.now();
    let q = null;
    if (tq && !qOpen && pend.length < 4) { q = gl.createQuery(); gl.beginQuery(tq.TIME_ELAPSED_EXT, q); qOpen = q; }
    aoCam.copy(camera); aoCam.layers.set(LAYER); aoCam.updateMatrixWorld();
    drawG();
    gtao.render(renderer, null, null);
    renderer.setRenderTarget(null);
    if (q) { gl.endQuery(tq.TIME_ELAPSED_EXT); qOpen = null; pend.push({ q, cpu: performance.now() - t0 }); }
    computes++;
    if (tmpMat) { tmpMat.dispose(); tmpMat = null; }   // the real material has its program now
  }
  function blend(k) {
    renderer.setRenderTarget(null);
    const ac = renderer.autoClear; renderer.autoClear = false;
    if (view) {   // checking only: one of the buffers instead of the picture
      const m = view === 'depth' ? gtao.depthRenderMaterial : gtao.copyMaterial;
      if (view === 'depth') { m.uniforms.tDepth.value = depthTex; m.uniforms.cameraNear.value = aoCam.near; m.uniforms.cameraFar.value = aoCam.far; }
      else { m.blending = THREE.NoBlending; m.uniforms.tDiffuse.value = view === 'ao' ? gtao.gtaoRenderTarget.texture : gtao.pdRenderTarget.texture; }
      dbg.material = m; dbg.render(renderer);
    } else {
      gtao.blendMaterial.uniforms.intensity.value = k; quad.render(renderer);
    }
    renderer.autoClear = ac;
  }

  // ---------- per frame ----------
  let kAO = 0, gate = 0, lastT = 0, lastCars = 0;
  // held (api.hold): no AO pass and no probing, so the hero draws the scene once a frame. The estate hero holds it
  // through its intro glide on phones and slow GPUs (owner, Nov 2026: "if i load on like some laptop or mobile, its like
  // lagging in the transition screen and animation on 3d"); it fades in from the settle glide on, as it does on a drag
  let held = false;
  function render() {
    kind = null;
    if (disposed || held || state === 'off' || state === 'lost') return;
    const now = performance.now(), dt = lastT && now - lastT < 100 ? (now - lastT) / 1000 : 1 / 60; lastT = now;
    if (rebuild || scene.children.length !== builtN) { rebuild = false; build(); }
    qPoll();
    gate = smooth(6, 14, camera.fov);   // 0 for the tour's long-lens plan views
    if (gate <= 0.001 && !view) { stale = true; return; }
    const ai = renderer.info.autoReset; renderer.info.autoReset = false;   // the hero's own counts plus ours
    try {
      size();
      camKey(k2);
      const moved = !same(k2, prevCam, 32), changed = !same(k2, key), ck = carKey(), carMoved = ck !== lastCars;
      prevCam.set(k2);
      if (moved && state === 'on') kAO = reduced ? 1 : Math.min(1, kAO + dt / FADE_S);   // only while the camera moves
      let work = (stale || changed || carMoved) && !busy;   // busy: a new level compiling; the last AO meanwhile
      // no GPU timer: while probing, every other moving frame skips the AO, so the frame times can be compared
      if (work && !tq && state === 'probe' && moved && (alt++ & 1)) work = false;
      if (work) { compute(); key.set(k2); lastCars = ck; stale = false; kind = 'c'; } else { cached++; if (moved) kind = 's'; }
      const k = forced != null ? forced : blendK * kAO * gate * (state === 'on' ? 1 : 0);
      // only an AO worked out for this camera pose: while a new level compiles (busy) and the camera moves, the last AO
      // would slide against the picture
      const fits = work || same(k2, key, 32);
      if (k > 0.004 || view) { if ((!stale && fits) || view) blend(k); }
    } finally { renderer.info.autoReset = ai; }
  }
  // passive frame-time sampling: the interval after a frame belongs to that frame's work
  function tick(now, moving) {
    if (state === 'off' || state === 'lost' || disposed) return false;
    if (held) { lastTick = 0; prevKind = null; return false; }
    if (!moving) { lastTick = 0; prevKind = null; return false; }
    if (lastTick && prevKind && now - lastTick < 100) {
      const d = now - lastTick;
      if (!tq && state === 'probe') {
        (prevKind === 'c' ? dC : dS).push(d);
        if (dC.length >= 20 && dS.length >= 20) { const x = Math.max(0, median(dC) - median(dS)); dC.length = dS.length = 0; lastCost = x; if (x > LIMIT) stepDown(); else state = 'on'; }
      } else if (!tq && state === 'on' && prevKind === 'c') {   // no timer: missed frames while the AO is worked out
        if (d > 26) slow++; else if (d < 20) okF++;
        if (slow > 20 && slow > okF * 0.5) stepDown();
        if (okF > 400) slow = okF = 0;
      }
    }
    lastTick = now; prevKind = kind; kind = null;   // a frame that draws nothing (photo only) is not counted
    return false;
  }

  build();
  await compileAll();
  if (disposed) return null;

  const api = {
    render, tick,
    get on() { return state === 'on'; },
    lost() { if (state === 'off') return; state = 'lost'; qOpen = null; pend.length = 0; },
    restored() {
      if (state !== 'lost') return;   // switched off before the loss: stays off
      if (rung >= LADDER.length) { state = 'off'; return; }
      tq = gl.getExtension('EXT_disjoint_timer_query_webgl2'); zeros = 0;
      state = 'probe'; kAO = 0; warm = 4; costs.length = dC.length = dS.length = 0; aoW = aoH = 0; stale = true; rebuild = true;
    },
    invalidate() { stale = true; },
    hold(on) { held = !!on; lastT = 0; if (!on) stale = true; },
    bytes() { return state === 'off' ? 0 : aoW * aoH * (4 + 4 + 8 + 8); },   // normal, depth, AO, denoise
    report() {
      return { on: state === 'on', state, level: rung, samples: gtao.gtaoMaterial.defines.SAMPLES, res: LADDER[Math.min(rung, LADDER.length - 1)][1], size: [aoW, aoH],
        fade: +kAO.toFixed(3), gate: +gate.toFixed(3), costMs: lastCost == null ? null : +lastCost.toFixed(2), gpuMs: lastGpu == null ? null : +lastGpu.toFixed(2),
        cpuMs: lastCpu == null ? null : +lastCpu.toFixed(2), limitMs: LIMIT, timer: !!tq, computes, cached, meshes: entries.length, log: log.slice(), cutouts: [...nm.values()].filter(m => m.alphaTest > 0).length, lite };
    },
    // checking only: { on: false } switches it off, { level } steps down to that rung, { k } forces the strength
    // (null hands it back), { blend } the full strength, { view: 'ao' | 'denoise' | 'depth' | null }
    set(o = {}) {
      if (o.on === false && state !== 'off') off();
      if (o.level != null) while (rung < o.level && state !== 'off') stepDown();
      if ('k' in o) { forced = o.k; if (o.k != null && state === 'probe') state = 'on'; }
      if (o.blend != null) blendK = o.blend;
      if ('view' in o) view = o.view || null;
      if (o.ao) gtao.updateGtaoMaterial(o.ao);
      if (o.pd) gtao.updatePdMaterial(o.pd);
      stale = true;
      return api.report();
    },
    // checking only: hero draw alone vs hero draw + AO, each waited for (a 1 px read); n draws each
    bench(n = 30) {
      const px = new Uint8Array(4), a = [], b = [], rd = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      for (let i = 0; i < n; i++) {
        let t0 = performance.now(); renderer.render(scene, camera); rd(); a.push(performance.now() - t0);
        t0 = performance.now(); renderer.render(scene, camera); if (state !== 'off') { size(); compute(); blend(0.6); } rd(); b.push(performance.now() - t0);
      }
      stale = true;
      return { heroMs: +median(a).toFixed(2), withAoMs: +median(b).toFixed(2), extraMs: +(median(b) - median(a)).toFixed(2), size: [aoW, aoH] };
    },
    dispose() {
      disposed = true;
      for (const e of entries) e.o.layers.disable(LAYER);
      for (const l of lights) l.layers.disable(LAYER);
      gRT.dispose(); depthTex.dispose(); gtao.dispose(); gtao.gtaoMaterial.dispose(); gtao.blendMaterial.dispose(); quad.dispose(); quadGeo.dispose();
      for (const m of nm.values()) m.dispose();
    },
  };
  return api;
}
