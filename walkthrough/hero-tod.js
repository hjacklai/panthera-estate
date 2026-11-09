// hero-tod.js · Day / Golden hour / Night for the estate hero.
//
//   const tod = createTod({ THREE, renderer, scene, sun, hemi, sky, hd, roomEnv, lamps, glass, pools, onChange });
//   tod.set('night');            // 1.2 s tween (instant with reduced motion)
//   tod.tick(dt) -> true while tweening
//
// Levels follow walk.js (TODS, LIGHT) at the end of the walk, where the camera is over the estate, so the hero and
// the tour's bird's-eye match. HDRI skies come from hd.js; until one arrives the RoomEnvironment lights the scene.
import { SKIES } from './hd.js?v=7';

export function createTod({ THREE, renderer, scene, sun, hemi, sky, hd, roomEnv, lamps = [], glass = [], pools = null, reduced = false, onChange = () => {} }) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  // the golden HDRI is turned so its sun glow sits where the walk's street sun is (as walk.js ENV_YAW)
  const ENV_YAW = Math.atan2(SKIES.golden.sun[2], SKIES.golden.sun[0]) - Math.atan2(22, -20);
  const yawed = a => V(...a).applyAxisAngle(V(0, 1, 0), ENV_YAW).normalize();
  // env: scene.environmentIntensity with the HDRI before level matching (walk: 0.5 x L.env x L.out); env0 without it
  const P = {
    day: { sun: 0xFFF5E6, sunI: 2.53, dir: yawed(SKIES.day.sun), hemi: [0xF4F7FF, 0xC8C0B0], hemiI: 0.6, top: 0x7FA8D2, horizon: 0xE8EEF1,
      env: 0.86, env0: 0.58, expo: 1.0, lamp: 0, glow: 0 },
    // golden: a warmer sun about 19 deg up (it was 30), so the homes throw longer shadows across the plots
    // less fill and a touch less exposure (owner, Nov 2026: "too overexposed ... no shadow"): the cream walls keep their
    // tone and the sun's shade reads
    // more drama (owner, Nov 2026: "more dramatic, golden hour, shadow"): the sun lower (about 15 deg, so longer
    // shadows), warmer and a little stronger, the haze warmer, the fill lower so the shade reads deep
    // and from the side as the landing camera sees the estate (owner, Nov 2026: "not enough shadows ... super pale"): it was
    // nearly behind the estate (25 deg off the view), so every wall in sight stood in flat shade; now about 70 deg round,
    // each house has a lit and a shaded side and its shadow falls sideways across the plots
    golden: { sun: 0xFFC58C, sunI: 2.95, dir: V(0.55, 0.37, 0.85).normalize(), hemi: [0xFFE6CC, 0xC9A984], hemiI: 0.24, top: 0x93B2CC, horizon: 0xF4D9BC,
      // lights on at golden hour (owner, Nov 2026): street lamps lit, a warm glow in the windows
      env: 0.56, env0: 0.3, expo: 0.9, lamp: 0.9, glow: 0.45 },
    night: { sun: 0xA9BCE0, sunI: 0.32, dir: yawed(SKIES.night.sun), hemi: [0x56648A, 0x2A2724], hemiI: 0.22, top: 0x14203A, horizon: 0x4E5674,
      env: 0.16, env0: 0.12, expo: 1.15, lamp: 1, glow: 1 },
  };
  const GLOW = new THREE.Color(0xFFC98A);
  let roomLevel = 0;
  const cur = { sun: new THREE.Color(), hemiS: new THREE.Color(), hemiG: new THREE.Color(), top: new THREE.Color(), horizon: new THREE.Color(),
    dir: V(0, 1, 0), sunI: 0, hemiI: 0, envI: 0, expo: 1, lamp: 0, glow: 0 };
  let name = 'golden', from = null, to = null, k = 1, envNext = null, envSwapped = true;
  const skies = {};   // name -> { env, level } once loaded

  const envFor = n => {
    const s = skies[n];
    if (!s) return { tex: roomEnv, I: P[n].env0, rot: 0 };
    if (!roomLevel && roomEnv) roomLevel = hd.level(roomEnv);
    const ratio = roomLevel > 0 && s.level > 0 ? Math.min(4, Math.max(0.25, roomLevel / s.level)) : 1;
    return { tex: s.env, I: P[n].env * ratio, rot: ENV_YAW };
  };
  const snap = () => ({ sun: cur.sun.clone(), hemiS: cur.hemiS.clone(), hemiG: cur.hemiG.clone(), top: cur.top.clone(), horizon: cur.horizon.clone(),
    dir: cur.dir.clone(), sunI: cur.sunI, hemiI: cur.hemiI, envI: cur.envI, expo: cur.expo, lamp: cur.lamp, glow: cur.glow });
  const target = n => {
    const p = P[n], e = envFor(n);
    return { sun: new THREE.Color(p.sun), hemiS: new THREE.Color(p.hemi[0]), hemiG: new THREE.Color(p.hemi[1]), top: new THREE.Color(p.top), horizon: new THREE.Color(p.horizon),
      dir: p.dir.clone(), sunI: p.sunI, hemiI: p.hemiI, envI: e.I, expo: p.expo, lamp: p.lamp, glow: p.glow };
  };
  const lerp = (a, b, t) => a + (b - a) * t;
  function write() {
    sun.color.copy(cur.sun); sun.intensity = cur.sunI;
    sun.position.copy(sun.target.position).addScaledVector(cur.dir, 260);
    hemi.color.copy(cur.hemiS); hemi.groundColor.copy(cur.hemiG); hemi.intensity = cur.hemiI;
    sky.uniforms.top.value.copy(cur.top); sky.uniforms.horizon.value.copy(cur.horizon);
    if (scene.fog) scene.fog.color.copy(cur.horizon);
    scene.background.copy(cur.horizon);
    scene.environmentIntensity = cur.envI;
    renderer.toneMappingExposure = cur.expo;
    for (const m of lamps) m.emissiveIntensity = 2.2 * cur.lamp;
    for (const m of glass) { m.emissive.copy(GLOW); m.emissiveIntensity = 3.6 * cur.glow; }
    if (pools) { const k = Math.max(0, (cur.glow - 0.5) * 2); pools.material.opacity = k; pools.visible = k > 0.01; }   // light pools on the ground at night only
    renderer.shadowMap.needsUpdate = true;
  }
  function useEnv(n) {
    const e = envFor(n);
    if (e.tex) { scene.environment = e.tex; scene.environmentRotation.set(0, e.rot, 0); }
  }
  // apply now (no tween)
  function jump(n) { Object.assign(cur, target(n)); useEnv(n); envSwapped = true; write(); }

  function set(n, instant = reduced) {
    if (!P[n]) return;
    name = n;
    hd.sky(n).then(s => {   // the HDRI for this time of day (null if HD is off or the file failed)
      if (s && !skies[n]) { skies[n] = s; if (name === n) { if (k >= 1) jump(n); else { to = target(n); envSwapped = false; } onChange(); } }
    });
    if (instant || !from && k >= 1 && cur.sunI === 0) { k = 1; jump(n); onChange(); return; }
    from = snap(); to = target(n); k = 0; envSwapped = false; envNext = n; onChange();
  }
  let frames = 0;
  function tick(dt) {
    if (k >= 1) return false;
    k = Math.min(1, k + dt / 1.2);
    const t = k * k * (3 - 2 * k);
    for (const c of ['sun', 'hemiS', 'hemiG', 'top', 'horizon']) cur[c].lerpColors(from[c], to[c], t);
    cur.dir.lerpVectors(from.dir, to.dir, t).normalize();
    for (const c of ['sunI', 'hemiI', 'envI', 'expo', 'lamp', 'glow']) cur[c] = lerp(from[c], to[c], t);
    if (!envSwapped && t >= 0.5) { useEnv(envNext); envSwapped = true; }
    write();
    renderer.shadowMap.needsUpdate = (++frames % 4 === 0) || k >= 1;
    return k < 1;
  }
  return { set, tick, jump, get name() { return name; }, presets: P, load: n => hd.sky(n) };
}
