# Photography — local Avagyan adaptation

## Plan and reference (21 October 2026)

Replace only the Photography destination, keeping Services and its mosaic unchanged. The Avagyan home reference was inspected live and through its delivered `468-ec5e03c315e6299e.js` and CSS. At 1440px: 24px page padding, 20px column / 28px row gaps, 3:4 images, three columns (two below 1024px). Its entrance uses a 3s compositor ease stagger (130/210/170% to -420%) over a simultaneous 85%-to-zero gallery rise; hover scales the selected link 1.025 by 1.04 and dims nearby cards. Idle drift starts after 20 seconds, at 0.5px per 60Hz frame. The original app grows an unbounded image list and runs perpetual animation frames.

Local patterns: `../creative-directing.html` header and navigation; `../../css/styles.css` original Suissnord/Madani typography; `../../js/script.js` existing ten-photo metadata; `../../js/page-transitions.js` route handoff; `../../tests/creative-direction.browser.mjs` Edge test harness.

Implementation: local images replace the reference photography. Keep the measured three-second grid entry, hover and idle drift, with bounded image rows, CSS compositor animations and native touch scroll. The large centered Ligero animation is removed; the header logo stays. Temporary entrance pictures fade out over the final 650ms before cleanup while the live gallery finishes its existing rise. Static detail documents use left-hand existing metadata / right-hand full photo, with a one-time entrance only; there is no scroll animation or auto drift on detail pages. Link to Ashleigh's actual existing profile without inventing a profile or changing her supplied credits. Non-branding text uses Madani, with the normal cursor and the shared light/dark controls.

Acceptance: generated pages and case-sensitive local resources; intro geometry and neighbor selection; desktop/mobile entry, scroll, bounded repetition, normal cursor, menu, photo open and back; direct detail links and artist link; no-JS/module failure and reduced motion; lint, CSS production parse, existing site regressions. This is a static site with no package-level application build. `node scripts/build-photography.mjs` builds all Photography HTML from one template and catalog; `--check` rejects stale generated output. `python scripts/build-photography-images.py` regenerates the lighter grid preview for the 7,508px tenth photograph while leaving its detail original unchanged. The client/camera/year strings are legacy site data, not independently verified photo credits; check these with Ashleigh before publishing.

No push or deployment authorized. Reference captures are in `~/.aki/tmp/avagyan/`.

## Entrance refinement verification — 21 October 2026

The new `tests/photography-entry.browser.mjs` regression failed before the fix: temporary pictures remained fully opaque at 2999ms and were removed at 3000ms. After the fix, Edge at 1440px and 390px measured opacity 1 at 2300ms, 0.448 at 2600ms, 0.038 at 2900ms and below 0.000005 at 2999ms; the gallery handoff moved less than one pixel. The large intro logo is absent and the header logo remains.

`node scripts/build-photography.mjs` built 11 pages; the full Node suite passed 71 tests. `tests/photography.browser.mjs` passed natural entrance completion, scrolling, hover, bounded recycling, desktop/mobile navigation and detail round trips, reduced motion, no-JS and failed-module fallbacks. Targeted ESLint and strict CSS production parsing cover the Photography files. Evidence is in `~/.aki/tmp/ligero-photo-entry/evidence`; natural-timing page captures are in `~/.aki/tmp/ligero-refine/evidence`. Safari and physical phones are not checked.
