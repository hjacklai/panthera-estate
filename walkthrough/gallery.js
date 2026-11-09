// gallery.js · a home's pictures, full screen, one at a time (owner, Nov 2026: "a gallery button, people can click and
// got left right button ... same for bungalow"). The pictures are the page's own (the render, the watercolours, the
// floor plans of #homes or #bungalow), so the gallery always matches the page. No captions (as the tour's photos).
//
//   openGallery(home, { T, from })  ->  close()
export function openGallery(home, { T = k => k, from = null } = {}) {
  const sec = document.getElementById(home === 'bungalow' ? 'bungalow' : 'homes');
  if (!sec) return () => {};
  // the largest file each picture offers (its srcset's widest, else its src)
  const best = img => {
    const ss = (img.getAttribute('srcset') || '').split(',').map(x => x.trim().split(/\s+/)).filter(x => x[0]);
    if (ss.length) { ss.sort((a, b) => (parseInt(b[1]) || 0) - (parseInt(a[1]) || 0)); return new URL(ss[0][0], document.baseURI).href; }
    return img.currentSrc || img.src;
  };
  const pics = [...sec.querySelectorAll('.home-cover img, .product-img img, .sketch-img img, .plan-card img')]
    .map(img => ({ src: best(img), alt: img.alt || '' }))
    .filter((p, i, a) => p.src && a.findIndex(q => q.src === p.src) === i);
  if (!pics.length) return () => {};

  const el = (tag, cls, attrs = {}, text) => { const e = document.createElement(tag); if (cls) e.className = cls; for (const k in attrs) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; return e; };
  // labels in the current language (data-i18n-aria: app.js re-labels them if the language changes while open)
  const ov = el('div', 'pbg', { role: 'dialog', 'aria-modal': 'true', 'aria-label': T('hx.gallery'), 'data-i18n-aria': 'hx.gallery' });
  const fig = el('div', 'pbg-fig');
  const img = el('img', 'pbg-img', { alt: '' });
  const prev = el('button', 'pbg-prev', { type: 'button', 'aria-label': T('hx.prev'), 'data-i18n-aria': 'hx.prev' }, '‹');
  const next = el('button', 'pbg-next', { type: 'button', 'aria-label': T('hx.next'), 'data-i18n-aria': 'hx.next' }, '›');
  const count = el('div', 'pbg-count', { 'aria-live': 'polite' });
  const x = el('button', 'pbg-x', { type: 'button', 'aria-label': T('hx.close'), 'data-i18n-aria': 'hx.close' }, '×');
  fig.append(img); ov.append(fig, prev, next, count, x);
  // the page behind is out of reach while it is open (focus stays in the gallery)
  const sibs = [...document.body.children].filter(n => !n.inert); sibs.forEach(n => { n.inert = true; });
  document.body.append(ov);
  let i = 0;
  const show = k => {
    i = (k + pics.length) % pics.length;
    img.classList.remove('in'); img.src = pics[i].src; img.alt = pics[i].alt;
    const done = () => img.classList.add('in');
    if (img.complete) requestAnimationFrame(done); else img.onload = done;
    count.textContent = (i + 1) + ' / ' + pics.length;
    // the next one ahead of time
    const n = new Image(); n.src = pics[(i + 1) % pics.length].src;
  };
  prev.addEventListener('click', () => show(i - 1));
  next.addEventListener('click', () => show(i + 1));
  const key = e => {
    if (e.key === 'ArrowRight') { show(i + 1); e.preventDefault(); e.stopPropagation(); }
    else if (e.key === 'ArrowLeft') { show(i - 1); e.preventDefault(); e.stopPropagation(); }
    else if (e.key === 'Escape') { close(); e.preventDefault(); e.stopPropagation(); }
    else if (e.key === 'Tab') { const f = [prev, next, x], k = f.indexOf(document.activeElement); if (e.shiftKey ? k <= 0 : k === f.length - 1) { e.preventDefault(); f[e.shiftKey ? f.length - 1 : 0].focus(); } }
  };
  addEventListener('keydown', key, true);
  // swipe
  let sx = null;
  ov.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') sx = e.clientX; });
  ov.addEventListener('pointerup', e => { if (sx == null) return; const d = e.clientX - sx; sx = null; if (Math.abs(d) > 40) show(i + (d < 0 ? 1 : -1)); });
  ov.addEventListener('click', e => { if (e.target === ov || e.target === fig) close(); });
  x.addEventListener('click', () => close());
  function close() {
    removeEventListener('keydown', key, true);
    sibs.forEach(n => { n.inert = false; });
    ov.classList.remove('open');
    setTimeout(() => ov.remove(), 250);
    if (from && from.focus) from.focus({ preventScroll: true });
  }
  show(0);
  requestAnimationFrame(() => { ov.classList.add('open'); next.focus({ preventScroll: true }); });
  return close;
}
