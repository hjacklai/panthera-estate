# pantheraestate.com

Marketing site for **Panthera Bertam**: 19 freehold homes (3 bungalows, 16 semi-detached) around a shared central park in Bertam, Penang. Developed by Panthera Development Sdn. Bhd.

Static HTML / CSS / JS, no build step. three.js comes in through an importmap from jsDelivr. GitHub Pages serves `main` on the custom domain (`CNAME`), so a push to `main` is live.

## Structure

- `index.html`: the live page. A one-screen 3D app, with a scrolling-page fallback for bots, no WebGL, data saver and `?hero=scroll`.
- `app.js` (i18n EN / BM / ZH, page features, Leaflet map), `styles.css`, `home-toggle.js`, `topo-flow.js`.
- `sw.js`: service worker (keeps `?v=` URLs between visits). `version.txt`: the live build number.
- `404.html`, `robots.txt`, `sitemap.xml`, `llms.txt`, `llms-full.txt`, the Google site-verification file.
- `assets/`: images. `assets/fonts/`: the self-hosted Google fonts (`fonts.css`).
- `walkthrough/`: the 3D.
  - `hero-boot.js` (entry and preloads) and `hero*.js` (the landing estate), `explore.js`, `gallery.js`.
  - `walk.js` with `index.html`: the stand-alone walk page.
  - Builders: `estate.js`, `furniture.js`, `car.js`, `tropical.js`. Model data: `*.json`.
  - `pack.js` and `bake/`: the baked estate pack. `hd.js` and `hd/`: photo textures and skies (only the files `hd.js` loads are kept). `audio/`.
- `walkthrough/tools/` (gitignored, kept on Drive): bake page, bake server, previews, check scripts.

## Run locally

`python walkthrough/tools/bake_server.py` (or `python -m http.server 8766` from the repo root), then open http://127.0.0.1:8766/.

The service worker stays off on 127.0.0.1 unless the URL has `?sw=1`. Useful flags: `?hero=scroll`, `?nosw`, and on the walk page `?home=bungalow` and `?hd=0|1k|2k`. `walkthrough/hero-boot.js` lists the other `?hero=` test flags.

## Versions and caches

- Every changed file gets a new `?v=N` wherever it is referenced. `sw.js` keeps `?v=` URLs on the visitor's device, so a file changed without a bump is never seen again.
- A new build bumps three numbers together: `V` in `walkthrough/hero-boot.js`, `B` in `index.html` and `version.txt`. Open pages reload once when `version.txt` differs. `VER` in hero-boot.js holds the per-file hero module stamps.
- Rebake: bump `BAKE_REV` in `walkthrough/versions.js` and `BAKE_Q` in `hero-boot.js`. `BAKE_VER` renames the pack files.
- A texture or sky replaced under the same name: bump `TEX_REV` / `SKY_REV` in `walkthrough/hd.js` (and hero-boot.js's golden-sky preload with `SKY_REV`).
- `sw.js`: rename `CACHE` to drop every kept file; `OFF = true` is the kill switch.
- `sitemap.xml` `lastmod` is the push date.

## Bake workflow

1. `python walkthrough/tools/bake_server.py`
2. Open http://127.0.0.1:8766/walkthrough/tools/bake.html. It writes `walkthrough/bake/estate.<BAKE_VER>.*`.
3. `python -I walkthrough/tools/check_pack.py` checks that the inputs match and every pack file exists.
4. Bump `BAKE_REV` and `BAKE_Q`, then commit `bake/` together with the source change.

## House rules

- No em-dash characters anywhere.
- No people in any imagery.
- Preview locally and get the owner's OK before pushing.
- If two pushes jam GitHub Pages, request a fresh build (`POST /repos/{owner}/{repo}/pages/builds`).
