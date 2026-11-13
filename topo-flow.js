/* ───────────────────────────────────────────────────────────
   PANTHERA · topographic survey sheet (static ink, scroll parallax)
   The contours and pencil spot-marks are drawn ONCE into an
   offscreen buffer, fixed ink on paper, they never morph. On
   scroll the buffer is blitted with a small vertical offset so the
   sheet pans slower than the page, giving quiet depth. Re-rendered
   only on resize. Honours prefers-reduced-motion (static, no pan).
   ─────────────────────────────────────────────────────────── */
(function () {
  var canvas = document.getElementById('topo-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d', { alpha: true });

  var reduce = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var W = 0, H = 0, DPR = 1;
  var CELL = 10;             // grid spacing (CSS px); finer = smoother contours
  var PAN = 900;             // px of extra height the buffer carries for the pan
  var DRIFT_AMP = 26;        // px of gentle continuous vertical drift
  var DRIFT_MS = 16000;      // duration of one full drift cycle
  var GH = 0;                // buffer height in CSS px (H + PAN)
  var cols = 0, rows = 0;
  var field = null;

  // Offscreen buffer holding the finished drawing
  var buffer = document.createElement('canvas');
  var g = buffer.getContext('2d');

  // Active drawing context for the march/marks helpers (always the buffer)
  var d = g;

  // Fixed terrain, a handful of Gaussian hills. Seeded once at load so the
  // drawing is a single stable survey, not a re-randomising animation.
  var hills = [];
  function buildHills() {
    hills = [];
    var n = 7;
    for (var i = 0; i < n; i++) {
      hills.push({
        bx: Math.random(),
        by: Math.random(),
        amp: 0.7 + Math.random() * 0.9,
        sign: Math.random() < 0.32 ? -1 : 1,
        r: 0.20 + Math.random() * 0.22
      });
    }
  }

  // ── Organic terrain noise: value-noise fbm + domain warping ──
  // Seeded per load so each survey is unique but internally consistent.
  var SEED = Math.random() * 1000;
  function hash2(x, y) {
    var n = Math.sin(x * 127.1 + y * 311.7 + SEED) * 43758.5453;
    return n - Math.floor(n);
  }
  function vnoise(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y);
    var xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var a = hash2(xi, yi), b = hash2(xi + 1, yi);
    var c = hash2(xi, yi + 1), e = hash2(xi + 1, yi + 1);
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + e * u) * v;
  }
  function fbm(x, y) {
    var s = 0, amp = 0.5, f = 1;
    for (var o = 0; o < 4; o++) { s += amp * vnoise(x * f, y * f); f *= 2; amp *= 0.5; }
    return s;
  }

  function computeField() {
    var minDim = Math.min(W, GH);
    var wf = 2.4 / minDim;          // warp frequency (~2-3 cycles across)
    var warpAmp = 0.22 * minDim;    // how far the rings get pushed around
    var nf = 3.6 / minDim;          // fine organic-detail frequency; lower = broader, smoother
    var NAMP = 0.22;                // detail amplitude (field units); lower = smoother

    var hx = [], hy = [], ha = [], hk = [];
    for (var i = 0; i < hills.length; i++) {
      var hl = hills[i];
      var cx = hl.bx * W;
      var cy = hl.by * GH;
      var rad = hl.r * minDim;
      hx.push(cx); hy.push(cy);
      ha.push(hl.amp * hl.sign);
      hk.push(1 / (2 * rad * rad));
    }
    var idx = 0;
    for (var gy = 0; gy < rows; gy++) {
      var py = gy * CELL;
      for (var gx = 0; gx < cols; gx++) {
        var pxp = gx * CELL;
        // domain warp: sample the hills at a noise-displaced position so the
        // concentric rings wander instead of staying perfectly circular
        var wx = (fbm(pxp * wf, py * wf) - 0.5) * warpAmp;
        var wy = (fbm(pxp * wf + 5.2, py * wf + 8.3) - 0.5) * warpAmp;
        var sx = pxp + wx, sy = py + wy;
        var sum = 0;
        for (var h = 0; h < hills.length; h++) {
          var dx = sx - hx[h];
          var dy = sy - hy[h];
          sum += ha[h] * Math.exp(-(dx * dx + dy * dy) * hk[h]);
        }
        // ridged fine detail so individual contour lines aren't smooth arcs
        sum += (fbm(pxp * nf + 2.1, py * nf + 9.9) - 0.5) * NAMP;
        field[idx++] = sum;
      }
    }
  }

  function lerp(a, b, level) {
    var dd = b - a;
    if (Math.abs(dd) < 1e-6) return 0.5;
    return (level - a) / dd;
  }

  function seg(x1, y1, x2, y2) { d.moveTo(x1, y1); d.lineTo(x2, y2); }

  function marchLevel(level) {
    d.beginPath();
    for (var gy = 0; gy < rows - 1; gy++) {
      for (var gx = 0; gx < cols - 1; gx++) {
        var i0 = gy * cols + gx;
        var tl = field[i0], tr = field[i0 + 1];
        var br = field[i0 + 1 + cols], bl = field[i0 + cols];

        var sq = 0;
        if (tl > level) sq |= 8;
        if (tr > level) sq |= 4;
        if (br > level) sq |= 2;
        if (bl > level) sq |= 1;
        if (sq === 0 || sq === 15) continue;

        var x = gx * CELL, y = gy * CELL;
        var aT = x + CELL * lerp(tl, tr, level), aTy = y;
        var aR = y + CELL * lerp(tr, br, level), aRx = x + CELL;
        var aB = x + CELL * lerp(bl, br, level), aBy = y + CELL;
        var aL = y + CELL * lerp(tl, bl, level), aLx = x;

        switch (sq) {
          case 1:  seg(aLx, aL, aB, aBy); break;
          case 2:  seg(aB, aBy, aRx, aR); break;
          case 3:  seg(aLx, aL, aRx, aR); break;
          case 4:  seg(aT, aTy, aRx, aR); break;
          case 5:  seg(aLx, aL, aT, aTy); seg(aB, aBy, aRx, aR); break;
          case 6:  seg(aT, aTy, aB, aBy); break;
          case 7:  seg(aLx, aL, aT, aTy); break;
          case 8:  seg(aLx, aL, aT, aTy); break;
          case 9:  seg(aT, aTy, aB, aBy); break;
          case 10: seg(aT, aTy, aRx, aR); seg(aLx, aL, aB, aBy); break;
          case 11: seg(aT, aTy, aRx, aR); break;
          case 12: seg(aLx, aL, aRx, aR); break;
          case 13: seg(aB, aBy, aRx, aR); break;
          case 14: seg(aLx, aL, aB, aBy); break;
        }
      }
    }
    d.stroke();
  }

  var INK = '28,23,20';
  var TERRA = '138,70,56';   // index contours warmed to the brand terracotta
  var LEVELS = [];
  (function () {
    for (var v = -1.6; v <= 1.8; v += 0.22) LEVELS.push(+v.toFixed(2));
  })();

  // Draw the whole survey into the offscreen buffer, once.
  function renderBuffer() {
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.clearRect(0, 0, W, GH);
    g.lineJoin = 'round';
    g.lineCap = 'round';
    for (var i = 0; i < LEVELS.length; i++) {
      var lv = LEVELS[i];
      var emphasis = (i % 3 === 0);                 // every 3rd = index line
      g.lineWidth = emphasis ? 1.5 : 1.0;
      var near = 1 - Math.min(Math.abs(lv) / 1.9, 1);
      var col = emphasis ? TERRA : INK;
      var alpha = (emphasis ? 0.38 : 0.20) * (0.55 + 0.45 * near);
      g.strokeStyle = 'rgba(' + col + ',' + alpha.toFixed(3) + ')';
      marchLevel(lv);
    }
  }

  // Blit the buffer to the visible canvas with a scroll-driven offset.
  // Map the pan to overall scroll PROGRESS (0->1) so the survey keeps drifting
  // the entire way down the page instead of freezing once it hits a fixed cap.
  function blit(now) {
    var off = 0;
    if (!reduce) {
      var maxScroll = (document.documentElement.scrollHeight - window.innerHeight) || 1;
      var prog = window.scrollY / maxScroll;
      if (prog < 0) prog = 0; else if (prog > 1) prog = 1;
      // keep the scroll pan inside [DRIFT_AMP, PAN-DRIFT_AMP] so the added
      // continuous drift never pushes us past the buffer's edges
      var base = DRIFT_AMP + prog * (PAN - 2 * DRIFT_AMP);
      var t = (now || 0) / DRIFT_MS * Math.PI * 2;
      off = base + Math.sin(t) * DRIFT_AMP;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(buffer, 0, -Math.round(off * DPR));
  }

  // The contour field is drawn only when the canvas can be seen: in the 3D app (html.hx-app) it is hidden, and drawing
  // it there was main-thread time during the 3D's boot on phones (load-time pass, Nov 2026). It is drawn the moment
  // hx-app comes off (the observer below), so the scrolling page shows exactly what it did
  var stale = false;
  function resize() {
    if (document.documentElement.classList.contains('hx-app')) { stale = true; return; }
    stale = false;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    GH = H + PAN;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    buffer.width = Math.round(W * DPR);
    buffer.height = Math.round(GH * DPR);
    cols = Math.ceil(W / CELL) + 1;
    rows = Math.ceil(GH / CELL) + 1;
    field = new Float32Array(cols * rows);
    computeField();
    renderBuffer();
    blit();
  }

  // One rAF loop re-blits every frame: a gentle continuous drift keeps the
  // survey alive even when still, and scroll changes are picked up for free.
  // Parked while the page is the 3D app (html.hx-app: the canvas is hidden) or a house tour covers it (html.pbw-lock):
  // a full-screen redraw every frame there only took time from the 3D on phones (owner, Nov 2026: "walk through tour ...
  // laggy, mobile mode especially"). It picks up again as soon as either class comes off.
  var rafId = 0, html = document.documentElement;
  function parked() { return html.classList.contains('hx-app') || html.classList.contains('pbw-lock'); }
  function animate(now) {
    if (parked()) { rafId = 0; return; }
    blit(now);
    rafId = requestAnimationFrame(animate);
  }
  if (window.MutationObserver) new MutationObserver(function () {
    if (stale && !html.classList.contains('hx-app')) resize();
    if (!reduce && !rafId && !document.hidden && !parked()) rafId = requestAnimationFrame(animate);
  }).observe(html, { attributes: true, attributeFilter: ['class'] });

  var rT;
  window.addEventListener('resize', function () {
    clearTimeout(rT);
    rT = setTimeout(resize, 150);
  });
  if (!reduce) {
    // Pause the loop when the tab is hidden to save CPU, resume on return.
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { cancelAnimationFrame(rafId); rafId = 0; }
      else if (!rafId && !parked()) { rafId = requestAnimationFrame(animate); }
    });
  }

  buildHills();
  resize();
  if (reduce) { if (!stale) blit(0); } else { rafId = requestAnimationFrame(animate); }
})();
