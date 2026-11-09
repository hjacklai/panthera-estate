// hero-life.js · a little life in the estate 3D, no people (owner, Nov 2026: "lively abit"; the no-people rule stays):
// a few cars driving the Persiaran both ways (on the left, as in Malaysia), white egrets crossing now and then, and
// the palm fronds stirring in the breeze.
//
//   const life = addLife({ THREE, scene, lite })  ->  { tick(now) -> true when it moved, nextIn(now), dispose() } | null
//
// Cheap on purpose: it steps at 30 fps on desktop and 24 on phones (the hero renders only then, not every frame), the
// cars reuse the estate's own light car (one instanced mesh per part), the birds are two triangles each, the sway is a
// few lines in the frond shader. It does nothing while the hero is off screen or the tour has the canvas.
// the Persiaran's centre line (estate.json persiaran.centre, and on past the model north and south, as hero-context.js
// draws it); cars keep left, as in Malaysia: northbound on the west half, southbound on the east half
const ROUTE = [[11.2, -640], [14.5, -340], [17.72, -49], [17.55, -33], [17.38, -17], [17.24, -1], [16.45, 15], [15.44, 31], [14.32, 47], [13.2, 63], [12.09, 79], [10.98, 95], [9.88, 111], [8.71, 127], [5.2, 178], [-3.2, 300]];
const LANE = 2.1;   // m from the centre line to a lane's middle
// the visitor's way: up the Persiaran from the south, left into the south gate (z 67), round the estate road's U past
// the green (estate.json road.centre), left out of the north gate (z 29) and on north
const VISIT_ROUTE = [[-3.2, 300], [5.2, 178], [8.71, 127], [10.98, 95], [12.1, 82], [10.6, 72], [5.5, 68.2], [-4.586, 67.218], [-54.678, 68.327],
  [-58.21, 62.42], [-56.602, 35.281], [-50.643, 29.783], [-1.958, 28.706], [6.5, 27.4], [13.6, 22.5], [16.45, 15], [17.24, -1], [17.55, -33],
  [17.72, -49], [14.5, -340]];
const SPEED = 8.5;   // m/s, about 30 km/h: calm, residential

export function addLife({ THREE, scene, lite = false }) {
  const group = new THREE.Group(); group.name = 'hx-life'; scene.add(group);
  const STEP = 1000 / (lite ? 24 : 30);
  let last = 0, t = 0;

  // ---------- cars: the estate's light car, driven ----------
  const parts = [];
  scene.traverse(o => { if (o.isInstancedMesh && o.userData.car === 'lite') parts.push(o); });
  // a route as arc length: the centre line's point at any distance along it, and its heading smoothed over the
  // corners (looked at 2.5 m either side), so a car rounds a bend instead of snapping round it
  const route = pts => {
    const seg = [], cum = [0];
    for (let i = 0; i < pts.length - 1; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az); seg.push([ax, az, (bx - ax) / L, (bz - az) / L]); cum.push(cum[i] + L); }
    const len = cum[cum.length - 1];
    const pos = d => { d = Math.max(0, Math.min(len, d)); let i = 0; while (i < seg.length - 1 && cum[i + 1] < d) i++; const [ax, az, ux, uz] = seg[i], t = d - cum[i]; return [ax + ux * t, az + uz * t]; };
    return { len, at(d, out) { const p = pos(d), a = pos(d - 2.5), b = pos(d + 2.5), dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1; out[0] = p[0]; out[1] = p[1]; out[2] = dx / L; out[3] = dz / L; return out; } };
  };
  const THROUGH = route(ROUTE), VISIT = route(VISIT_ROUTE);
  const N = lite ? 4 : 6, cars = [];
  for (let i = 0; i < N; i++) cars.push({ r: THROUGH, dir: i % 2 ? 1 : -1, s: (i * 0.618 * THROUGH.len) % THROUGH.len, v: SPEED * (0.85 + ((i * 37) % 10) / 33), lane: LANE });
  // the visitor: one car comes up the Persiaran, turns into the estate, rounds the green and leaves by the other gate
  cars.push({ r: VISIT, dir: 1, s: 170, v: SPEED, lane: 1.5, visit: true });   // starts just short of the gate, so it turns in soon after the page opens
  const NC = cars.length;
  const pal = [0xE9E9E6, 0x3B4248, 0x8C9196, 0x2B3A4F, 0xB8B2A6, 0x7A1F24, 0xF2F2EF];
  const ims = parts.map(p => {
    const im = new THREE.InstancedMesh(p.geometry, p.material, NC);
    if (p.instanceColor) for (let i = 0; i < NC; i++) im.setColorAt(i, new THREE.Color(i === NC - 1 ? 0xF2F2EF : pal[(i * 5 + 2) % pal.length]));
    im.castShadow = false; im.receiveShadow = true; im.frustumCulled = false; group.add(im);
    return im;
  });
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1), Y = new THREE.Vector3(0, 1, 0);
  const pt = [0, 0, 0, 0];
  const inEstate = (x, z) => x < 2 && x > -92 && z > -2 && z < 98;
  const placeCars = dt => {
    cars.forEach((c, i) => {
      const L = c.r.len;
      // the visitor slows to a crawl inside the estate and on its turns
      const here = c.r.at(c.dir > 0 ? c.s : L - c.s, pt), slow = c.visit && (inEstate(here[0], here[1]) || Math.abs(here[2]) > 0.25 && Math.abs(here[3]) > 0.25);
      c.s = (c.s + (slow ? c.v * 0.55 : c.v) * dt) % L;
      // a car only appears past the junction and leaves into the haze: scaled in and out over its first and last 12 m
      const k = Math.min(1, c.s / 12, (L - c.s) / 12);
      c.r.at(c.dir > 0 ? c.s : L - c.s, pt);
      const fx = pt[2] * c.dir, fz = pt[3] * c.dir;   // its heading; it keeps left of the centre line
      P.set(pt[0] + fz * c.lane, -0.31, pt[1] - fx * c.lane); S.setScalar(Math.max(0.001, k));
      Q.setFromAxisAngle(Y, Math.atan2(fx, fz));
      M4.compose(P, Q, S);
      for (const im of ims) im.setMatrixAt(i, M4);
    });
    for (const im of ims) im.instanceMatrix.needsUpdate = true;
  };

  // ---------- egrets: a small flock now and then, crossing high over the estate ----------
  // an egret, modelled small: a tapered white body, neck and head with a yellow bill, dark legs trailing, and wings in
  // two panels each (inner and outer) that bend as they beat; local frame: forward +z, span along x, metres
  const NB = 7, bp = [], bc = [], wingK = [];
  const W = [0.96, 0.95, 0.92], B = [0.93, 0.78, 0.25], D = [0.18, 0.17, 0.16];
  const tri = (a, b, c, col, k = [0, 0, 0]) => { bp.push(...a, ...b, ...c); for (let n = 0; n < 3; n++) bc.push(...col); wingK.push(...k); };
  // body: a slim double-sided spindle (top and belly), tail at z -0.42, chest at z 0.22
  const T = [0, 0, -0.42], C = [0, 0.02, 0.22], L = [-0.07, 0, -0.05], R = [0.07, 0, -0.05], U = [0, 0.06, -0.05], Dn = [0, -0.05, -0.05];
  tri(T, U, L, W); tri(T, R, U, W); tri(C, L, U, W); tri(C, U, R, W); tri(T, L, Dn, W); tri(T, Dn, R, W); tri(C, Dn, L, W); tri(C, R, Dn, W);
  // neck tucked in an S (flight posture), head and bill
  tri(C, [0.025, 0.06, 0.34], [-0.025, 0.06, 0.34], W); tri([0.025, 0.06, 0.34], [0, 0.04, 0.46], [-0.025, 0.06, 0.34], W);
  tri([0.02, 0.045, 0.46], [0, 0.04, 0.66], [-0.02, 0.045, 0.46], B);
  // legs trailing past the tail
  tri([0.015, -0.01, -0.36], [0.006, -0.02, -0.72], [-0.006, -0.02, -0.72], D); tri([-0.015, -0.01, -0.36], [0.015, -0.01, -0.36], [0, -0.02, -0.7], D);
  // wings: inner panel (root to elbow, weight 0..0.45) and outer panel with a tapered tip (0.45..1); both sides
  for (const sg of [1, -1]) {
    const r0 = [0.05 * sg, 0.02, 0.12], r1 = [0.05 * sg, 0.02, -0.16], e0 = [0.42 * sg, 0.02, 0.1], e1 = [0.42 * sg, 0.02, -0.2], t0 = [0.82 * sg, 0.01, 0.0], t1 = [0.74 * sg, 0.01, -0.2];
    const k = x => Math.abs(x[0]) / 0.82;
    tri(r0, e0, e1, W, [k(r0), k(e0), k(e1)]); tri(r0, e1, r1, W, [k(r0), k(e1), k(r1)]);
    tri(e0, t0, t1, W, [k(e0), k(t0), k(t1)]); tri(e0, t1, e1, W, [k(e0), k(t1), k(e1)]);
  }
  const wing = new THREE.BufferGeometry();
  wing.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3));
  wing.setAttribute('color', new THREE.Float32BufferAttribute(bc, 3));
  wing.setAttribute('wk', new THREE.Float32BufferAttribute(wingK, 1));
  wing.computeVertexNormals();
  const flapT = { value: 0 };
  const birdMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide });
  // the wing beat in the shader: each bird's own phase; it beats for a while, then glides with wings held a little up
  birdMat.onBeforeCompile = sh => {
    sh.uniforms.uFlap = flapT;
    sh.vertexShader = 'uniform float uFlap;' + String.fromCharCode(10) + 'attribute float wk;' + String.fromCharCode(10) + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float hx_ph = instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.3;
      float hx_beat = smoothstep(-0.2, 0.5, sin(uFlap * 0.45 + hx_ph));
      float hx_a = mix(0.18, sin(uFlap * 6.2 + hx_ph * 3.0) * 0.75, hx_beat);
      float hx_in = min(wk, 0.45) / 0.45, hx_out = max(wk - 0.45, 0.0) / 0.55;
      transformed.y += sin(hx_a) * (0.42 * hx_in + 0.4 * hx_out) + sin(hx_a * 1.35) * 0.25 * hx_out;
      transformed.x *= 1.0 - 0.12 * abs(sin(hx_a)) * wk;`);
  };
  birdMat.customProgramCacheKey = () => 'hx-egret';
  const birds = new THREE.InstancedMesh(wing, birdMat, NB); birds.frustumCulled = false; birds.castShadow = false; group.add(birds);
  let flight = null, nextFlight = 3;
  const startFlight = () => {
    // straight over the development (owner: "shud fly by the development"): through the lot's middle, give or take
    // a few metres, low enough to read from the aerial view
    const a = (t * 1.7) % (Math.PI * 2), r = 260, cx = -44 + ((t * 13) % 20) - 10, cz = 48 + ((t * 7) % 20) - 10;
    const from = new THREE.Vector3(cx + Math.cos(a) * r, 24 + (t % 6), cz + Math.sin(a) * r);
    const to = new THREE.Vector3(cx - Math.cos(a) * r, 28 + (t % 5), cz - Math.sin(a) * r);
    flight = { from, to, u: 0, dur: from.distanceTo(to) / 9 };
  };
  const placeBirds = dt => {
    if (!flight) { nextFlight -= dt; if (nextFlight <= 0) startFlight(); else { birds.visible = false; return; } }
    birds.visible = true;
    flight.u += dt / flight.dur;
    if (flight.u >= 1) { flight = null; nextFlight = 12 + (t % 9); birds.visible = false; return; }
    const dir = flight.to.clone().sub(flight.from).normalize(), yaw = Math.atan2(dir.x, dir.z);
    for (let i = 0; i < NB; i++) {
      const row = Math.ceil(i / 2), side = i % 2 ? -1 : 1;   // a loose V
      P.copy(flight.from).lerp(flight.to, flight.u).addScaledVector(dir, -row * 2.2);
      P.x += Math.cos(yaw) * side * row * 1.8; P.z -= Math.sin(yaw) * side * row * 1.8; P.y += Math.sin(t * 1.3 + i) * 0.4;
      P.x += Math.sin(t * 0.8 + i * 2.1) * 0.6; P.z += Math.cos(t * 0.7 + i * 1.7) * 0.6;   // each keeps its own line, loosely
      Q.setFromAxisAngle(Y, yaw + Math.sin(t * 0.5 + i) * 0.08); S.setScalar(1.7); M4.compose(P, Q, S);
      birds.setMatrixAt(i, M4);
    }
    birds.instanceMatrix.needsUpdate = true;
  };

  // ---------- the breeze: palm fronds, and the estate's own trees and plants (owner: "the trees are suppose to sway
  // ... within the development"); each leafy part moves more toward its top, so trunks and roots stay put ----------
  const wind = { value: 0 }, swayed = new Set();
  scene.traverse(o => {
    const m = o.isInstancedMesh && o.material;
    if (!m || swayed.has(m) || !(m.alphaTest > 0) || !m.map || o.parent === group) return;   // leaf cards: alpha-tested maps
    if (m.color && m.color.getHexString() === '6f8048') return;   // the oil palm fronds: their own sway below
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox, y0 = bb.min.y.toFixed(2), h = Math.max(0.3, bb.max.y - bb.min.y).toFixed(2);
    const amp = Math.min(0.28, 0.05 + 0.035 * (bb.max.y - bb.min.y)).toFixed(3);   // a breeze you can see (owner: "do the trees sway by wind?")
    swayed.add(m);
    m.onBeforeCompile = sh => {
      sh.uniforms.uWind = wind;
      sh.vertexShader = 'uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        float hx_ph = instanceMatrix[3].x * 0.31 + instanceMatrix[3].z * 0.17;
        float hx_k = clamp((position.y - ${y0}) / ${h}, 0.0, 1.0);
        float hx_g = 0.7 + 0.45 * sin(uWind * 0.21 + hx_ph * 0.15);   // gusts that come and go across the estate
        transformed.x += (sin(uWind * 0.8 + hx_ph) + 0.4 * sin(uWind * 2.1 + hx_ph * 2.0)) * ${amp} * hx_k * hx_g;
        transformed.z += cos(uWind * 0.7 + hx_ph * 1.4) * ${amp} * 0.7 * hx_k * hx_g;`);
    };
    m.customProgramCacheKey = () => 'hx-leaf-' + y0 + '-' + h;
    m.needsUpdate = true;
  });
  scene.traverse(o => {
    const m = o.isInstancedMesh && o.material;
    if (!m || swayed.has(m) || !m.color || m.color.getHexString() !== '6f8048') return;   // the oil palm fronds (estate and neighbours)
    swayed.add(m);
    m.onBeforeCompile = sh => {
      sh.uniforms.uWind = wind;
      sh.vertexShader = 'uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        float hx_ph = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.23;
        float hx_k = clamp((position.y - 4.6) / 2.2, 0.0, 1.0);
        float hx_g = 0.7 + 0.45 * sin(uWind * 0.21 + hx_ph * 0.15);
        transformed.x += (sin(uWind * 1.1 + hx_ph) + 0.35 * sin(uWind * 2.6 + hx_ph * 1.7)) * 0.17 * hx_k * hx_g;
        transformed.z += cos(uWind * 0.9 + hx_ph * 1.3) * 0.13 * hx_k * hx_g;`);
    };
    m.customProgramCacheKey = () => 'hx-sway';
    m.needsUpdate = true;
  });

  placeCars(0); birds.visible = false;
  return {
    group,
    tick(now) {
      if (now - last < STEP) return false;
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now; t += dt;
      placeCars(dt); placeBirds(dt); wind.value = t; flapT.value = t;
      return true;
    },
    nextIn(now) { return Math.max(0, STEP - (now - last)); },
    pause() { last = 0; },
    dispose() { scene.remove(group); birds.geometry.dispose(); birdMat.dispose(); for (const im of ims) im.dispose(); },
  };
}
