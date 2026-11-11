// hero-rig.js · the camera of the 3D site (app mode): free to look around, held to a centre.
//
//   const rig = createRig(THREE, el, { onChange });
//   rig.setGoal({ tgt: [x, y, z], az, el, dist, fov, off: [ox, oy] }, limits?, { instant? })
//   rig.tick(dt) -> true while it still moves; rig.pose() -> { pos, tgt, fov, off }
//   rig.fromPose(pos, tgt, fov, off) jumps to an existing camera pose (no glide)
//
// Orbit about a target: azimuth (any turn, or a limited arc), elevation and distance in limits, the target free to
// move only inside a circle round the area's centre (owner, Nov 2026: "allow user to freely pan around, but of course
// fix a centerpoint area"). Mouse: drag turns, right-drag or shift-drag moves, the wheel zooms. Touch: one finger
// turns, two fingers move, pinch to zoom and twist to turn. Keys on the stage: arrows turn, + and - zoom.
// Scripted moves (setGoal) glide slowly; the visitor's own moves follow the hand closely.
// reduced (prefers-reduced-motion): scripted moves and offsets jump straight to their goal; the visitor's own drags,
// pinches and keys still follow the hand as usual.
export function createRig(THREE, el, { onChange = () => {}, onUser = () => {}, reduced = false } = {}) {
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const TAU = Math.PI * 2;
  const cur = { x: 0, y: 0, z: 0, az: 0, el: 0.6, dist: 140, fov: 40, ox: 0, oy: 0 };
  const goal = { ...cur };
  let lim = { cx: 0, cz: 0, R: 25, dmin: 40, dmax: 260, emin: 0.18, emax: 1.35, arc: null, fmin: 20, fmax: 60 };
  let enabled = false, user = false, lastUser = 0, floorAt = null;
  const wrapAz = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
  const keep = () => {   // the goal inside the limits
    goal.el = clamp(goal.el, lim.emin, lim.emax);
    goal.dist = clamp(goal.dist, lim.dmin, lim.dmax);
    if (lim.arc) goal.az = clamp(goal.az, lim.arc[0], lim.arc[1]);
    const dx = goal.x - lim.cx, dz = goal.z - lim.cz, d = Math.hypot(dx, dz);
    if (d > lim.R) { goal.x = lim.cx + dx * lim.R / d; goal.z = lim.cz + dz * lim.R / d; }
    if (floorAt) {   // never down inside a neighbouring building: tilt up until the camera clears its roof
      const c = Math.cos(goal.el), f = floorAt(goal.x + goal.dist * c * Math.cos(goal.az), goal.z + goal.dist * c * Math.sin(goal.az));
      if (f > goal.y + goal.dist * Math.sin(goal.el)) goal.el = Math.min(lim.emax, Math.max(goal.el, Math.asin(Math.min(1, (f - goal.y) / goal.dist))));
    }
  };
  function setGoal(g, limits, { instant = false } = {}) {
    if (reduced) instant = true;   // no glide across the estate with reduced motion
    if (limits) lim = { ...lim, ...limits };
    if (g.tgt) { goal.x = g.tgt[0]; goal.y = g.tgt[1]; goal.z = g.tgt[2]; }
    for (const k of ['az', 'el', 'dist', 'fov']) if (g[k] != null) goal[k] = g[k];
    if (g.off) { goal.ox = g.off[0]; goal.oy = g.off[1]; }
    // turn the short way round
    if (!lim.arc) goal.az = cur.az + wrapAz(goal.az - cur.az);
    keep(); user = false;
    if (instant) Object.assign(cur, goal);
    onChange();
  }
  function setOff(ox, oy) { goal.ox = ox; goal.oy = oy; if (reduced) { cur.ox = ox; cur.oy = oy; } onChange(); }
  function fromPose(pos, tgt, fov, off = [0, 0]) {
    const dx = pos.x - tgt.x, dy = pos.y - tgt.y, dz = pos.z - tgt.z, h = Math.hypot(dx, dz);
    Object.assign(cur, { x: tgt.x, y: tgt.y, z: tgt.z, az: Math.atan2(dz, dx), el: Math.atan2(dy, h), dist: Math.hypot(dx, dy, dz), fov, ox: off[0], oy: off[1] });
    Object.assign(goal, cur);
  }
  function tick(dt) {
    const k = 1 - Math.exp(-dt / (user ? 0.09 : 0.75));   // the hand: close behind; a scripted move: a slow glide
    let moving = false;
    for (const key of ['x', 'y', 'z', 'az', 'el', 'dist', 'fov', 'ox', 'oy']) {
      const d = goal[key] - cur[key];
      if (Math.abs(d) > (key === 'dist' || key === 'x' || key === 'y' || key === 'z' ? 1e-3 : 1e-4)) { cur[key] += d * k; moving = true; } else cur[key] = goal[key];
    }
    if (!moving) user = false;
    return moving;
  }
  function pose() {
    const c = Math.cos(cur.el);
    const tgt = new THREE.Vector3(cur.x, cur.y, cur.z);
    const pos = new THREE.Vector3(cur.x + cur.dist * c * Math.cos(cur.az), cur.y + cur.dist * Math.sin(cur.el), cur.z + cur.dist * c * Math.sin(cur.az));
    return { pos, tgt, fov: cur.fov, off: [cur.ox, cur.oy] };
  }

  // ---------- input ----------
  const pts = new Map();
  let mode = null, last = null;
  const touched = () => { user = true; lastUser = performance.now(); onUser(); onChange(); };
  const turn = (dx, dy) => { goal.az += dx * 0.0055; goal.el += dy * 0.0042; keep(); touched(); };
  const move = (dx, dy) => {   // along the ground, in screen directions, faster when further out
    const s = goal.dist * 0.0016, ca = Math.cos(goal.az), sa = Math.sin(goal.az);
    // screen right = (-sin az, cos az) ... seen from the camera at angle az looking at the target
    goal.x += (sa * dx - ca * dy) * s; goal.z += (-ca * dx - sa * dy) * s; keep(); touched();
  };
  const zoom = f => { goal.dist *= f; keep(); touched(); };
  el.addEventListener('pointerdown', e => {
    if (!enabled) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* gone */ }
    if (e.pointerType === 'mouse') mode = (e.button === 2 || e.shiftKey) ? 'move' : e.button === 0 ? 'turn' : null;
    else mode = pts.size >= 2 ? 'two' : 'turn';
    last = null; el.classList.add('hx-dragging');
  });
  el.addEventListener('pointermove', e => {
    const p = pts.get(e.pointerId); if (!p || !mode) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (mode === 'two' && pts.size >= 2) {
      const [a, b] = [...pts.values()], mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, span = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
      if (last) {
        move(mid.x - last.mid.x, mid.y - last.mid.y); if (last.span > 10 && span > 10) zoom(last.span / span);
        // two-finger twist turns the estate with the fingers, as a map does (owner, Nov 2026: "can it facilitate 2 finger
        // rotate?"); a twist under 0.2 deg is the shake of a pinch and is ignored
        let da = ang - last.ang; da = Math.atan2(Math.sin(da), Math.cos(da));
        if (span > 40 && Math.abs(da) > 0.0035 && Math.abs(da) < 0.5) { goal.az -= da; keep(); touched(); }   // minus: the estate follows the fingers (owner: it turned the other way)
      }
      last = { mid, span, ang };
    } else if (mode === 'turn') turn(dx, dy);
    else if (mode === 'move') move(dx, dy);
  });
  const up = e => {
    pts.delete(e.pointerId);
    if (pts.size === 1 && mode === 'two') { mode = 'turn'; last = null; return; }
    if (!pts.size) { mode = null; last = null; el.classList.remove('hx-dragging'); }
  };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('contextmenu', e => { if (enabled) e.preventDefault(); });
  el.addEventListener('wheel', e => { if (!enabled) return; e.preventDefault(); zoom(Math.exp(clamp(e.deltaY, -120, 120) * 0.0016)); }, { passive: false });
  el.addEventListener('keydown', e => {
    if (!enabled) return;
    const k = { ArrowLeft: () => turn(-40, 0), ArrowRight: () => turn(40, 0), ArrowUp: () => turn(0, -30), ArrowDown: () => turn(0, 30), '+': () => zoom(0.85), '=': () => zoom(0.85), '-': () => zoom(1.18) }[e.key];
    if (k) { k(); e.preventDefault(); }
  });

  return {
    setGoal, setOff, fromPose, tick, pose,
    setFloor(fn) { floorAt = fn; keep(); },   // fn(x, z) -> the lowest camera height there
    enable(on) { enabled = on; el.classList.toggle('hx-rig', on); },
    get enabled() { return enabled; },
    get idle() { return performance.now() - lastUser; },
    get goal() { return { ...goal }; },
    get limits() { return { ...lim }; },
  };
}
