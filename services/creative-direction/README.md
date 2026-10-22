# Creative Direction

Local implementation of the owner-requested milledollars.fr homepage treatment, using Ligero's existing films and navigation. Not committed, pushed or deployed.

## Implementation

- `../creative-directing.html`: real film titles, clients, Ashleigh Cooper credits, menu links and full-film dialog. Also the usable no-JavaScript film list.
- `page.css`: original Madani menu/title and Suissnord logo/mobile menu; ABC Diatype film metadata; responsive layout. No bottom-corner controls. The supplied Madani demo face repeats one mark for every digit, so only digits use the existing fallback face.
- `motion.mjs`: 760/1440 desktop and 338/390 mobile entry cards, 540/760 aspect, 20px stack gaps, 2s custom rise and overlapping 1.8s expansion. Scroll uses the reference 0.2s shrink / 1s slide / 0.2s expansion timing and staggered text movement.
- `video-renderer.mjs`: WebGL1 video/poster textures, cover fit, image parallax, reference derivative-based rounded mask, duotone and darkening. Only the active preview plays. Outgoing frames remain while their poster returns after a 1s delay over 0.4s.
- `page.mjs`: wheel, vertical swipe and arrow/page keys; menu; visibility/context-loss handling; reduced-motion and failure fallback.
- `player.mjs` / `player.css`: animated native dialog, real-poster cover, Madani controls, seek, volume, fullscreen, focus restoration, and media release.
- `../../js/page-transitions.js` / `../../css/page-transitions.css`: destination-colour departure/arrival for internal navigation; native cross-document transitions and a reduced-motion-aware fallback. The film entrance waits until the route fade completes.

The first selected film is Perfect Combi; surrounding introduction cards shuffle. Film changes are user-driven, without automatic six-second navigation. Clicking a film opens its existing full MP4 in a keyboard-accessible dialog. The reference's corner navigation and progress/autoplay controls are omitted as requested.

The owner confirmed on 21 October 2026 that the reference and fonts are licensed. ABC Diatype and Migra webfonts are served locally from `/fonts/`. Videos are the site's existing MP4s; WebP posters are frames from those previews (Grime and One More Note at 3s to avoid their black opening frames).

## Verification — Windows / Edge, 21 October 2026

This site publishes source files directly; it has no application build step. No new dependency, CI, or deployment setup was introduced.

```sh
node --test tests/*.test.mjs
node tests/creative-direction.browser.mjs
```

For the browser test, install/provide `@playwright/test` in your tooling environment and Edge. `PLAYWRIGHT_PACKAGE` may point to an existing package.json with that dependency; `LIGERO_PREVIEW` overrides `http://127.0.0.1:4325`; `LIGERO_EVIDENCE` optionally stores screenshots.

Results:
- 16 unit/regression tests passed (7 Creative Direction, 9 existing Services).
- Recommended ESLint rules passed for all five new JS/test modules. Strict Lightning CSS production parsing passed. `git diff --check` passed.
- Desktop 1440px and mobile 390px: textured entrance/expansion, local font loading, every preview decoded, forward/backward wrap, one active preview, metadata, modal playback and preview pause/resume passed. Mobile menu and synthetic vertical swipe passed.
- Reduced-motion, missing WebGL, failed renderer module, failed poster and disabled JavaScript: four-film readable list and navigation passed.
- Failed preview retained its poster; forced WebGL context loss released videos into the readable list.
- Desktop/mobile entrance, scroll and settled screenshots inspected. No page errors or HTTP failures in normal-path checks.
- Actual Services gallery card -> Creative Direction entrance -> ready film -> Services menu return passed without page errors.

Safari and a physical phone are not checked. Local verification is not a deployment or production-network guarantee.

## Follow-up: original typography, transitions and media efficiency

The original menu/title sizes and fonts are preserved on desktop and mobile. Route checks cover Services -> Creative Direction -> Services -> Home and back, both native and forced fallback transitions. Player checks cover animated open/close, poster cover, playback, seek, mute, desktop volume/fullscreen (including rejection), inert background, focus restoration, padding/backdrop clicks, close/reopen races, source release and reduced motion.

- Preview GPU uploads now occur only for fresh decoded frames, not every camera-animation frame. Pause, release and disposal cancel frame callbacks.
- Gabzy, Grime, Note, Reem and Gift previews have faststart metadata before their media data. Remux only: every decoded video frame and audio packet matched the original frame hashes; no resolution or quality reduction.
- Posters remain lightweight WebP assets, approximately 29–52 KB each. The film player loads its full video only when opened.
- The local preview now serves HTTP byte ranges; the old Python server ignored Range and prevented reliable seeking. This is a local tooling repair, not a production-host change.

Measured on this Windows host in headless Edge, 1440×900 (one serial before/after sample):

| Check | Before | After |
|---|---:|---:|
| Creative slide transition video uploads | 71 | 36 |
| Duplicate uploads during that transition | 35 | 0 |
| Settled Creative video uploads over 120 display frames | 65 | 59 |
| 95th-percentile display-frame interval, Creative transition | 16.8 ms | 16.8 ms |

The upload reduction is about 49%, not a claim of a 49% faster website. In a separate cold-cache simulation at 5 Mbps and 80 ms latency, the first 1920×1080 preview was playing 461 ms after its video request, with 234,750 bytes received of a 6,782,247-byte file; the response was unfinished and no video frames were dropped at that observation. This excludes the intentional entrance animation and is not a production, Safari or physical-phone guarantee.

Latest verification: 36 Node tests passed (24 site + 12 player); recommended ESLint, strict production CSS parse and whitespace checks passed. The surrounding desktop/mobile renderer suite passed again after the efficiency changes, including all four previews, wrap, pause/resume, failed media, readable fallbacks and context-loss release. The browser digit regression failed before the Unicode-range fix and passed afterward while confirming Madani letters remained unchanged. Browser-test selector/focus assumptions were repaired without weakening the actual modal or reduced-motion properties.

```sh
node --test tests/*.test.mjs services/creative-direction/player.test.mjs
node tests/creative-direction.browser.mjs
node tests/creative-direction-integration.browser.mjs
```

Local measurements and frame hashes are retained under `~/.aki/tmp/milledollars/perf/`; integration screenshots are under `~/.aki/tmp/milledollars/ligero-evidence/`. Still not committed, pushed or deployed.
