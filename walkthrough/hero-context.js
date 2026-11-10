// hero-context.js · the neighbourhood round the estate, in low detail (owner, Nov 2026: "so that it does not look like
// the houses in the middle of nowhere"). The real streets and areas come from OpenStreetMap (ODbL, OpenStreetMap
// contributors); the building blocks were placed on the rows seen in satellite imagery (reference only, no pixels
// shipped): the terrace site behind the lot, the SK and SMK Bertam Perdana schools across the Persiaran, the terraces
// to the north-east, the shophouses and the housing south of the main road.
//
//   const ctx = await addContext({ THREE, scene, url })  ->  { group, floor(x, z), dispose() }
//
// Massing only (no windows, no textures), muted and fading into the haze with distance, so the estate stays the
// picture. Built at run time from a ~30 KB JSON (not in the pack, so the walkthrough never draws it), loaded after the
// first frame. Three draws: the ground (fills and roads), the buildings, the land plate under them.
const CX = -44, CZ = 48;                  // the estate's centre (estate frame: metres, x east, z south)
const SCRUB = [-300, 220, -230, 320];      // the baked scrub ground (x0, x1, z0, z1) at y -0.36
const PERSIARAN = [-12, 32, -49, 128];     // the modelled Persiaran (the pack draws it): context roads stay out
const MODELLED = [-16, 36, -60, 140];     // the Persiaran, its verges and the estate's bellmouths, with a margin: no fills
const Y_PLATE = -0.40, Y_FILL = -0.35, Y_ROAD = -0.34, Y_FOOT = -0.40;
const FILL = { plantation: [58, 76, 40], scrub: [96, 110, 60], park: [100, 128, 64], grass: [100, 128, 64], pitch: [92, 134, 66], bare: [172, 156, 124], paved: [160, 158, 152] };
const ROAD = { service: [128, 128, 124], track: [150, 138, 116], drain: [120, 132, 132] }, ASPHALT = [92, 94, 97];
const SCRUB_RGB = [87, 105, 48], LAND_RGB = [169, 174, 140], HAZE = [214, 206, 190];

const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const dist = (x, z) => Math.hypot(x - CX, z - CZ);
// quieter than the estate: a little less saturated, and further off, into the haze
function tone(rgb, x, z) {
  const g = rgb[0] * 0.3 + rgb[1] * 0.59 + rgb[2] * 0.11;
  let c = mix(rgb, [g, g, g], 0.22);
  const d = dist(x, z);
  c = mix(c, HAZE, smooth(140, 620, d) * 0.5);
  return mix(c, LAND_RGB, smooth(560, 650, d));   // the far edge melts into the land
}
const inBox = (x, z, b) => x > b[0] && x < b[1] && z > b[2] && z < b[3];

export async function addContext({ THREE, scene, url, lite = false }) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('context ' + res.status);
  const data = await res.json();
  const col = new THREE.Color();
  const lin = rgb => { col.setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace); return [col.r, col.g, col.b]; };

  // triangle soup with one colour per triangle; faces turned to point up (ground) or away from a centre (walls)
  function soup() {
    const P = [], C = [];
    return {
      P, C,
      tri(a, b, c, rgb, up = null) {
        if (up) {   // up: [x, y, z] the face should look towards, or 'up'
          const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
          const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
          const dot = up === 'up' ? n[1] : n[0] * (a[0] - up[0]) + n[1] * (a[1] - up[1]) + n[2] * (a[2] - up[2]);
          if (dot < 0) { const t = b; b = c; c = t; }
        }
        P.push(...a, ...b, ...c); const l = lin(rgb); C.push(...l, ...l, ...l);
      },
      geo() {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
        g.computeVertexNormals(); g.computeBoundingSphere();
        return g;
      },
    };
  }
  const flat = (poly, y, rgb, s, skip) => {   // a filled polygon at height y
    const pts = poly.map(([x, z]) => new THREE.Vector2(x, z));
    if (THREE.ShapeUtils.isClockWise(pts)) pts.reverse();
    for (const [i, j, k] of THREE.ShapeUtils.triangulateShape(pts, [])) {
      const a = pts[i], b = pts[j], c = pts[k], mx = (a.x + b.x + c.x) / 3, mz = (a.y + b.y + c.y) / 3;
      if (skip && skip(mx, mz)) continue;
      s.tri([a.x, y, a.y], [b.x, y, b.y], [c.x, y, c.y], typeof rgb === 'function' ? rgb(mx, mz) : rgb, 'up');
    }
  };
  const inLot = (x, z) => x > -92 && x < 2 && z > -2 && z < 98;   // the estate lot, with a margin

  // ---------- the land plate: the scrub's colour near the estate, the far land's at the edge, then down to the disc ----
  const plate = soup();
  {
    const R = 700, SEG = 96, rings = [0, 120, 240, 360, 460, 560, 640, R];
    const at = (r, a) => [CX + r * Math.cos(a), CZ + r * Math.sin(a)];
    const c = r => mix(SCRUB_RGB, LAND_RGB, smooth(380, 680, r));
    for (let i = 0; i < rings.length - 1; i++) for (let k = 0; k < SEG; k++) {
      const a0 = k / SEG * Math.PI * 2, a1 = (k + 1) / SEG * Math.PI * 2, r0 = rings[i], r1 = rings[i + 1];
      const q = [at(r0, a0), at(r0, a1), at(r1, a1), at(r1, a0)];
      if (q.every(([x, z]) => inBox(x, z, [SCRUB[0] + 1, SCRUB[1] - 1, SCRUB[2] + 1, SCRUB[3] - 1]))) continue;   // the baked scrub covers it
      const v = q.map(([x, z]) => [x, Y_PLATE, z]);
      const rgb = c((r0 + r1) / 2);
      if (r0 > 0) plate.tri(v[0], v[1], v[2], rgb, 'up'); else plate.tri(v[0], v[2], v[3], rgb, 'up');
      if (r0 > 0) plate.tri(v[0], v[2], v[3], rgb, 'up');
    }
    for (let k = 0; k < SEG; k++) {   // a skirt down to the land disc (y -2.6), so the plate has no lip
      const a0 = k / SEG * Math.PI * 2, a1 = (k + 1) / SEG * Math.PI * 2;
      const p = (r, a, y) => [CX + r * Math.cos(a), y, CZ + r * Math.sin(a)];
      plate.tri(p(R, a0, Y_PLATE), p(R, a1, Y_PLATE), p(R + 60, a1, -2.62), LAND_RGB, 'up');
      plate.tri(p(R, a0, Y_PLATE), p(R + 60, a1, -2.62), p(R + 60, a0, -2.62), LAND_RGB, 'up');
    }
  }

  // ---------- ground: area fills, then road ribbons a centimetre above ----------
  const ground = soup();
  for (const a of data.areas || []) {
    const rgb = FILL[a.kind]; if (!rgb || !a.poly || a.poly.length < 3) continue;
    // never over the modelled ground: the lot and the Persiaran with its verges, drains and bellmouths (a fill there
    // won over the real road and kerbs; owner, Nov 2026: "fix this bit of the road curb, the grass")
    flat(a.poly, Y_FILL + 0.002 * Math.min(3, a.layer || 0), (x, z) => tone(rgb, x, z), ground, (x, z) => inLot(x, z) || inBox(x, z, MODELLED));
  }
  const ribbon = (pts, w, y, rgb) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, z0] = pts[i], [x1, z1] = pts[i + 1], dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz); if (L < 0.05) continue;
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      if (inBox(mx, mz, PERSIARAN) || inLot(mx, mz)) continue;
      const nx = -dz / L * w / 2, nz = dx / L * w / 2, c = tone(rgb, mx, mz);
      const A = [x0 + nx, y, z0 + nz], B = [x1 + nx, y, z1 + nz], Cc = [x1 - nx, y, z1 - nz], D = [x0 - nx, y, z0 - nz];
      ground.tri(A, B, Cc, c, 'up'); ground.tri(A, Cc, D, c, 'up');
    }
    for (const [x, z] of pts) {   // round the joints (an octagon), so bends have no notch
      if (inBox(x, z, PERSIARAN) || inLot(x, z)) continue;
      const c = tone(rgb, x, z), r = w / 2;
      for (let k = 0; k < 8; k++) { const a0 = k / 8 * Math.PI * 2, a1 = (k + 1) / 8 * Math.PI * 2; ground.tri([x, y, z], [x + r * Math.cos(a0), y, z + r * Math.sin(a0)], [x + r * Math.cos(a1), y, z + r * Math.sin(a1)], c, 'up'); }
    }
  };
  // the Persiaran beyond the modelled stretch: one carriageway, as wide as the model's (x 4.8..22.8), north and south
  const persiaranRun = (pts) => pts.every(([x]) => x > PERSIARAN[0] && x < PERSIARAN[1]);
  for (const r of data.roads || []) {
    if (!r.pts || r.pts.length < 2 || r.cls === 'footway') continue;
    if (persiaranRun(r.pts)) continue;
    ribbon(r.pts, r.width_m || 6, Y_ROAD + (r.cls === 'service' ? 0 : 0.002), ROAD[r.cls] || ASPHALT);
  }
  for (const w of data.waterways || []) if (w.pts && w.pts.length > 1) ribbon(w.pts, w.width_m || 2, Y_ROAD - 0.004, ROAD.drain);
  // the Persiaran beyond the modelled stretch, on its own line: 10 m wide at the north end, 7.6 m at the south, as the
  // model's carriageway is at each end (estate.json persiaran)
  ribbon([[11.2, -640], [14.5, -340], [17.72, -49]], 10.05, -0.31, ASPHALT);
  ribbon([[8.63, 128], [5.2, 178], [-3.2, 300]], 7.62, -0.31, ASPHALT);

  // ---------- buildings: walls and a hip, gable or flat roof; heights taper away at the far edge ----------
  const blds = soup(), floorCells = new Map(), CELL = 10;
  const markFloor = (poly, top) => {   // the camera keeps above anything near the estate
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const [x, z] of poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    if (dist((x0 + x1) / 2, (z0 + z1) / 2) > 360) return;
    for (let i = Math.floor((x0 - 6) / CELL); i <= Math.floor((x1 + 6) / CELL); i++) for (let k = Math.floor((z0 - 6) / CELL); k <= Math.floor((z1 + 6) / CELL); k++) {
      const key = i + ',' + k; floorCells.set(key, Math.max(floorCells.get(key) || 0, top + 3));
    }
  };
  const footprints = [];
  for (const b of data.buildings || []) {
    const poly = b.poly; if (!poly || poly.length < 3) continue;
    let cx = 0, cz = 0; for (const [x, z] of poly) { cx += x; cz += z; } cx /= poly.length; cz /= poly.length;
    if (inLot(cx, cz)) continue;
    const d = dist(cx, cz), k = Math.max(0.12, 1 - smooth(540, 650, d));
    // sheds and factories stay low and quiet: lower, and toned into the greens round them, so they read as background
    // roofs, not a factory behind the houses (owner, Nov 2026: "can make this abit subtle")
    const shed = b.kind === 'industrial', hush = c3 => shed ? mix(c3, [108, 120, 90], 0.68) : c3;
    // homes a little lower than life too, so the rows round the lot sit back (owner: "maybe shorter abit")
    const homeK = b.kind === 'terrace' || b.kind === 'house' ? 0.78 : 1;
    const eave = (shed ? Math.min(3, b.h_eave_m || 3) : (b.h_eave_m || 6) * homeK) * k, rise = (shed ? Math.min(0.7, b.h_roof_m || 0.7) : (b.h_roof_m || 1.5) * homeK) * k;
    const wall = tone(hush(b.wall_rgb || [228, 222, 208]), cx, cz), roof = tone(hush(b.roof_rgb || [170, 100, 80]), cx, cz);
    const y0 = Y_FOOT, ye = Y_FOOT + eave, c = [cx, ye / 2, cz];
    footprints.push(poly);
    for (let i = 0; i < poly.length; i++) {
      const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length];
      blds.tri([ax, y0, az], [bx, y0, bz], [bx, ye, bz], wall, c); blds.tri([ax, y0, az], [bx, ye, bz], [ax, ye, az], wall, c);
    }
    let top = ye;
    if (poly.length === 4 && b.roof !== 'flat') {
      let [A, B, C, D] = poly;
      if (Math.hypot(B[0] - A[0], B[1] - A[1]) < Math.hypot(C[0] - B[0], C[1] - B[1])) [A, B, C, D] = [B, C, D, A];   // AB, CD the long sides
      const L = Math.hypot(B[0] - A[0], B[1] - A[1]), S = Math.hypot(C[0] - B[0], C[1] - B[1]);
      // a row of homes reads as homes, not a shed: its roof broken into house-sized hipped sections, each a shade apart
      const homes = b.kind === 'terrace' || b.kind === 'house';
      const n = homes ? Math.max(1, Math.round(L / 13)) : 1;   // about two homes a section
      const lerp2 = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
      for (let s = 0; s < n; s++) {
        const a = lerp2(A, B, s / n), bq = lerp2(A, B, (s + 1) / n), cq = lerp2(D, C, (s + 1) / n), dq = lerp2(D, C, s / n);
        const l = L / n, yE = ye + (homes && n > 1 ? ((s * 7) % 3 - 1) * 0.12 : 0), yr = yE + rise;
        const shade = homes && n > 1 ? 1 + ((s * 5) % 3 - 1) * 0.045 : 1, rc = roof.map(v => Math.min(255, v * shade));
        const m1 = [(dq[0] + a[0]) / 2, (dq[1] + a[1]) / 2], m2 = [(bq[0] + cq[0]) / 2, (bq[1] + cq[1]) / 2];
        const t = b.roof === 'hip' || n > 1 ? Math.min(0.45, (S / 2) / l) : 0;
        const r1 = [m1[0] + (m2[0] - m1[0]) * t, yr, m1[1] + (m2[1] - m1[1]) * t], r2 = [m2[0] - (m2[0] - m1[0]) * t, yr, m2[1] - (m2[1] - m1[1]) * t];
        const P3 = q => [q[0], yE, q[1]], up = [cx, ye - 50, cz];   // roof faces look away from a point well below
        blds.tri(P3(a), P3(bq), r2, rc, up); blds.tri(P3(a), r2, r1, rc, up);
        blds.tri(P3(cq), P3(dq), r1, rc, up); blds.tri(P3(cq), r1, r2, rc, up);
        const end = t > 0 ? rc : wall;
        blds.tri(P3(dq), P3(a), r1, end, up); blds.tri(P3(bq), P3(cq), r2, end, up);
        top = Math.max(top, yr);
      }
    } else flat(poly, ye, roof, blds);
    markFloor(poly, top);
  }

  // ---------- meshes: one vertex-coloured material (the same program as the hero's merged buckets), no shadows cast ----
  const mat = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, envMapIntensity: 0.4, ...o });
  const group = new THREE.Group(); group.name = 'hx-context';
  const mPlate = new THREE.Mesh(plate.geo(), mat()); mPlate.receiveShadow = true;
  const mGround = new THREE.Mesh(ground.geo(), mat({ polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 })); mGround.receiveShadow = true;
  const mBlds = new THREE.Mesh(blds.geo(), mat());
  for (const m of [mPlate, mGround, mBlds]) { m.matrixAutoUpdate = false; m.updateMatrix(); group.add(m); }
  group.matrixAutoUpdate = false;
  scene.add(group);

  // ---------- trees standing where the real buildings are (the old plantation rows behind the lot): taken out ----------
  const inside = (x, z, poly, m) => {   // point in polygon, grown by m metres (bounding test first)
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [px, pz] of poly) { x0 = Math.min(x0, px); x1 = Math.max(x1, px); z0 = Math.min(z0, pz); z1 = Math.max(z1, pz); }
    if (x < x0 - m || x > x1 + m || z < z0 - m || z > z1 + m) return false;
    let inn = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inn = !inn; }
    if (inn) return true;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {   // within m of an edge
      const [ax, az] = poly[j], [bx, bz] = poly[i], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
      if (Math.hypot(x - ax - dx * t, z - az - dz * t) < m) return true;
    }
    return false;
  };
  const near = footprints.filter(p => p.some(([x, z]) => dist(x, z) < 260));
  const M4 = new THREE.Matrix4(), Z = new THREE.Matrix4().makeScale(0, 0, 0), v = new THREE.Vector3();
  let hidden = 0;
  // also handed out (hideIn): the house tour lays a copy of this neighbourhood round its own estate and clears its trees
  // the same way, instead of building it all again (owner, Nov 2026: the tour's opening "abit laging")
  // Positions are taken in root's own frame (the frame this neighbourhood is laid in), not the world: the tour's estate
  // root is moved so the walked plot lands on the model, and which frame its matrices held depended on whether a frame
  // had been drawn yet (in the world frame the estate's own homes, cars and hedges were taken out instead of the trees)
  const toRoot = new THREE.Matrix4();
  const hideIn = (root, skip = null) => { root.updateMatrixWorld(true); toRoot.copy(root.matrixWorld).invert(); root.traverse(o => {
    if (!o.isInstancedMesh || o.parent === group || (skip && o.parent === skip)) return;
    let touched = false;
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, M4); v.setFromMatrixPosition(M4).applyMatrix4(o.matrixWorld).applyMatrix4(toRoot);
      if (inLot(v.x, v.z)) continue;
      if (near.some(p => inside(v.x, v.z, p, 2.5))) { o.setMatrixAt(i, Z); touched = true; hidden++; }
    }
    if (touched) { o.instanceMatrix.needsUpdate = true; o.computeBoundingSphere(); }
  }); };
  hideIn(scene);

  // ---------- the oil palm land: simple palms (about 20 triangles each), so it reads as plantation, not lawn ----------
  {
    const OWN = [[-140, -90, -25, 155], [-95, 5, 100, 155]];   // the estate's own palm rows (baked) stay as they are
    const segs = [];
    for (const r of data.roads || []) for (let i = 0; i < (r.pts || []).length - 1; i++) segs.push([...r.pts[i], ...r.pts[i + 1], (r.width_m || 6) / 2 + 2.5]);
    const offRoad = (x, z) => segs.every(([ax, az, bx, bz, w]) => {
      if (x < Math.min(ax, bx) - w || x > Math.max(ax, bx) + w || z < Math.min(az, bz) - w || z > Math.max(az, bz) + w) return true;
      const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
      return Math.hypot(x - ax - dx * t, z - az - dz * t) > w;
    });
    const spots = [], STEP = 9;
    for (const a of data.areas || []) {
      if (a.kind !== 'plantation' || !a.poly) continue;
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [x, z] of a.poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
      for (let z = Math.ceil(z0 / STEP) * STEP; z < z1; z += STEP) for (let x = Math.ceil(x0 / STEP) * STEP + ((z / STEP) % 2 ? STEP / 2 : 0); x < x1; x += STEP) {
        const h = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453, j = h - Math.floor(h);   // a steady jitter
        const px = x + (j - 0.5) * 2.4, pz = z + ((j * 7) % 1 - 0.5) * 2.4;
        if (dist(px, pz) > 430 || inLot(px, pz) || OWN.some(b => inBox(px, pz, b)) || !inside(px, pz, a.poly, 0)) continue;
        if (px > -12 && px < 31 && pz > -650 && pz < 310) continue;   // the Persiaran's reserve, its modelled stretch and the run on north and south
        if (!offRoad(px, pz) || footprints.some(p => inside(px, pz, p, 3))) continue;
        spots.push([px, pz, j]);
      }
    }
    // near the lot the estate's own palm (the baked one, textured fronds); further out the 20-triangle one
    const NEAR = lite ? 110 : 175, nearSpots = spots.filter(([x, z]) => dist(x, z) < NEAR), farSpots = spots.filter(([x, z]) => dist(x, z) >= NEAR);
    const own = [];
    scene.traverse(o => { if (o.isInstancedMesh && o.parent !== group && o.material && o.material.color && /^(5e5040|6f8048)$/.test(o.material.color.getHexString())) own.push(o); });
    if (own.length === 2 && nearSpots.length) {
      const q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
      for (const o of own) {
        const im = new THREE.InstancedMesh(o.geometry, o.material, nearSpots.length);
        nearSpots.forEach(([x, z, j], i) => { const sc = 0.85 + j * 0.3; q.setFromAxisAngle(Y, j * 6.283); M4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(sc, sc, sc)); im.setMatrixAt(i, M4); });
        im.castShadow = false; im.computeBoundingSphere(); im.matrixAutoUpdate = false; im.updateMatrix(); group.add(im);
      }
    } else farSpots.push(...nearSpots);
    spots.length = 0; spots.push(...farSpots);
    if (spots.length) {
      const s = soup();
      const T = [0.0, -0.4, 0.0], top = 5.6, trunk = tone([94, 80, 64], CX, CZ), frond = tone([88, 108, 58], CX, CZ);
      for (let k = 0; k < 4; k++) {   // a square trunk
        const a0 = k / 4 * Math.PI * 2, a1 = (k + 1) / 4 * Math.PI * 2, r0 = 0.32, r1 = 0.22;
        const p = (r, a, y) => [T[0] + r * Math.cos(a), y, T[2] + r * Math.sin(a)];
        s.tri(p(r0, a0, T[1]), p(r0, a1, T[1]), p(r1, a1, top), trunk, [0, top / 2, 0]); s.tri(p(r0, a0, T[1]), p(r1, a1, top), p(r1, a0, top), trunk, [0, top / 2, 0]);
      }
      for (let k = 0; k < 7; k++) {   // seven drooping fronds, two triangles each
        const a = k / 7 * Math.PI * 2 + 0.3, c = Math.cos(a), sn = Math.sin(a), L = 3.6, wd = 0.75;
        const base = [0, top, 0], mid = [c * L * 0.55 - sn * wd, top + 0.6, sn * L * 0.55 + c * wd], mid2 = [c * L * 0.55 + sn * wd, top + 0.6, sn * L * 0.55 - c * wd], tip = [c * L, top - 1.1, sn * L];
        s.tri(base, mid, tip, frond, 'up'); s.tri(base, tip, mid2, frond, 'up');
      }
      const geo = s.geo(), im = new THREE.InstancedMesh(geo, mat({ side: THREE.DoubleSide }), spots.length), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
      spots.forEach(([x, z, j], i) => { const sc = 0.85 + j * 0.35; q.setFromAxisAngle(Y, j * 6.283); M4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(sc, sc, sc)); im.setMatrixAt(i, M4); });
      im.computeBoundingSphere(); im.matrixAutoUpdate = false; im.updateMatrix(); group.add(im);
    }
  }

  const floor = (x, z) => floorCells.get(Math.floor(x / CELL) + ',' + Math.floor(z / CELL)) || 0;
  return {
    group, floor, hidden, hideIn,
    stats: { tris: (plate.P.length + ground.P.length + blds.P.length) / 9, buildings: footprints.length },
    dispose() { scene.remove(group); group.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); },
  };
}
