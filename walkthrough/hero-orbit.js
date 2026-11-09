// hero-orbit.js · desktop drag-to-orbit for the estate hero, a gentle extra once the runway has ended.
//
//   const orbit = createOrbit(el, { enabled: () => bool, onChange, onStart, onEnd });
//   orbit.tick(dt, scrolling) -> true while it still moves; orbit.apply(pos, tgt) turns pos about tgt.
//
// Mouse only (touch keeps native scrolling), never listens to the wheel. Yaw and pitch are limited and spring back
// to the scripted pose as soon as the page scrolls again.
export function createOrbit(el, { enabled = () => true, onChange = () => {}, onStart = () => {}, onEnd = () => {} } = {}) {
  const YAW = 0.6, PITCH_UP = 0.22, PITCH_DOWN = 0.12;   // radians
  let yaw = 0, pitch = 0, tYaw = 0, tPitch = 0, drag = null, active = false, back = false;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  el.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || !enabled()) return;
    drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; back = false;
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
    el.classList.add('hx-dragging');
    if (!active) { active = true; onStart(); }
    onChange();
  });
  el.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    tYaw = clamp(tYaw - (e.clientX - drag.x) * 0.004, -YAW, YAW);
    tPitch = clamp(tPitch + (e.clientY - drag.y) * 0.003, -PITCH_DOWN, PITCH_UP);
    drag.x = e.clientX; drag.y = e.clientY; onChange();
  });
  const up = e => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null; el.classList.remove('hx-dragging'); onEnd(); onChange();
  };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  // keyboard on the stage: arrow keys turn the view
  el.addEventListener('keydown', e => {
    if (!enabled()) return;
    const k = { ArrowLeft: [-0.12, 0], ArrowRight: [0.12, 0], ArrowUp: [0, 0.06], ArrowDown: [0, -0.06] }[e.key];
    if (e.key === 'Home') { tYaw = tPitch = 0; onChange(); e.preventDefault(); return; }
    if (!k) return;
    tYaw = clamp(tYaw + k[0], -YAW, YAW); tPitch = clamp(tPitch + k[1], -PITCH_DOWN, PITCH_UP);
    if (!active) { active = true; onStart(); }
    onChange(); e.preventDefault();
  });

  function tick(dt, scrolling) {
    if (scrolling && !drag && (tYaw || tPitch)) back = true;   // once the page scrolls again, return to the scripted pose
    if (back) { tYaw *= Math.exp(-dt * 4); tPitch *= Math.exp(-dt * 4); if (Math.abs(tYaw) < 1e-3 && Math.abs(tPitch) < 1e-3) { tYaw = tPitch = 0; back = false; } }
    const a = 1 - Math.exp(-dt * 9);
    yaw += (tYaw - yaw) * a; pitch += (tPitch - pitch) * a;
    const moving = Math.abs(tYaw - yaw) > 1e-4 || Math.abs(tPitch - pitch) > 1e-4 || !!drag || back;
    if (!moving && active && tYaw === 0 && tPitch === 0 && Math.abs(yaw) < 1e-3) { yaw = pitch = 0; active = false; }
    return moving;
  }
  // turn pos about tgt: yaw round the vertical, pitch raises or lowers the view
  function apply(pos, tgt) {
    if (!yaw && !pitch) return;
    const dx = pos.x - tgt.x, dy = pos.y - tgt.y, dz = pos.z - tgt.z;
    const r = Math.hypot(dx, dy, dz), h = Math.hypot(dx, dz);
    let az = Math.atan2(dz, dx) + yaw, el2 = Math.atan2(dy, h) + pitch;
    el2 = clamp(el2, 0.12, 1.45);
    pos.set(tgt.x + r * Math.cos(el2) * Math.cos(az), tgt.y + r * Math.sin(el2), tgt.z + r * Math.cos(el2) * Math.sin(az));
  }
  return { tick, apply, get active() { return active || !!drag; }, get dragging() { return !!drag; }, reset() { yaw = pitch = tYaw = tPitch = 0; active = false; } };
}
