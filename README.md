# Panthera Bertam, pantheraestate.com

Single-page brochure site for **Panthera Bertam**, a 1.96-acre development of 3 bungalows + 16 semi-detached homes around a 794 m² central park in Bertam, Seberang Perai, Penang.

Developed by **Panthera Development Sdn. Bhd.**

---

## What's here

```
index.html              Entry point, full single-page site
styles.css              All styles
app.js                  i18n, scroll-spy, mortgage calc, map filters, lightbox, accordion
image-slot.js           Drag-drop image custom element used on home cards
404.html                Branded "page not found" with WhatsApp + back-to-home CTAs
sitemap.xml             Anchor-based sitemap for major sections
robots.txt              Crawler directives + sitemap pointer
serve.pl                Tiny local Perl HTTP server for previews (not deployed)

assets/
  favicon + logo variants, site plan, streetscape SVG, floor plans, topo
  background, day-X-*.jpg (lifestyle photos), render-*.jpg (home renders)
```

Static HTML / CSS / JS, **no build step**, no framework, no dependencies beyond Google Fonts (loaded from CDN).

---

## Run locally

Any static-file server works. Simplest options:

```bash
# Python (if installed)
python -m http.server 8000

# Node.js (if installed)
npx serve .

# VS Code: install the "Live Server" extension and right-click index.html → Open with Live Server
```

Then open `http://localhost:8000` in a browser.

You can also just double-click `index.html`, file:// works for everything except the image-slot drag-drop state persistence.

---

## Deployment

### Bluehost (via GitHub)

1. Push this repo to GitHub.
2. In Bluehost cPanel, open **File Manager** and navigate to `public_html/` (or your subdomain's folder).
3. Either:
   - **Git Version Control** (cPanel feature): connect to the GitHub repo, set deployment to `public_html/`, and pull on each push, or
   - **Manually upload**: select all files in this folder and upload via SFTP / cPanel uploader.
4. Confirm the domain `pantheraestate.com` points to that Bluehost folder.
5. Test: open `https://www.pantheraestate.com`, should render the site.

### Any other static host (Vercel / Netlify / Cloudflare Pages)

Drag the folder onto the dashboard. No build command. Publish directory: root (`/`).

---

## Updating photos

The four home perspective slots (`<image-slot>` in the Homes section) currently show the existing bungalow and semi-D renders. When new perspective shots arrive:

1. Save the new photos to `assets/` (e.g. `assets/render-bungalow-side.jpg`).
2. Update the `src=` attribute on the corresponding `<image-slot>` tag in `index.html`:
   ```html
   <image-slot id="home-bung-side" src="assets/render-bungalow-side.jpg" ...></image-slot>
   ```
3. Commit and push.

Alternatively, **drag-and-drop** photos directly onto the empty slots in the browser, they persist to `.image-slots.state.json` in the project root (a sidecar that's `.gitignore`d by default).

---

## Editing copy

All user-facing strings are tagged with `data-i18n="key"`. The translations dictionary lives in `app.js`. To change a sentence, search the i18n key in `app.js` and update all three locales (`en`, `bm`, `zh`).

---

## Contact

**Sales:** +60 17-598 1858 · [WhatsApp](https://wa.me/60175981858)
**Email:** sales@pantheraestate.com
