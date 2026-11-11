// The one place to bump: the baked estate pack version (file names carry it) and the shared constants.
export const BAKE_VER = 'e1';
// the bake files' ?v= stamp (owner, Nov 2026: "optimize load time on all devices, without compromising quality"): with it
// the site's service worker (/sw.js) keeps the 1.3 to 2.4 MB pack between visits. Bump it with every rebake under the same
// BAKE_VER, here and in hero-boot.js (BAKE_Q); tools/check_pack.py warns when the bake changed and this did not.
export const BAKE_REV = '1';
export const ENTRY_P = 0.41;   // walk state where the estate hands over to the tour (labels gone, real = 1)
export const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js';
