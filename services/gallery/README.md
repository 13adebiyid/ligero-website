# Ligero Services gallery

Local work on `feat/services-gallery`; not committed, pushed or deployed.
The gallery adapts the reference preview at port 4317. The separate reference and Butter previews are unchanged.

## 21 October 2026: entrance and photography update

- Services links bypass the shared 400ms outgoing-page delay. Other destinations retain their existing transition.
- Services does not start the old initial page-loading screen.
- The embedded gallery mounts its renderer before releasing page initialization, without the copied loader bars, progress tween or fixed intro waits.
- Only currently visible posters gate entrance. Existing asynchronous texture/video upgrades remain; off-screen media cannot block the first cards.
- The readable links no longer flash before the animated gallery. They remain available with reduced motion, missing JavaScript/WebGL, or failed data/module requests.
- The initial service order, carousel geometry, header/logo/menu and destinations are preserved.
- The original photography preview was a three-photo left swipe; the later requested mosaic below supersedes it.

## Build and checks

This is a static HTML site: no application build or lint command exists. JavaScript syntax checks and `git diff --check` pass.

Use Node 22, from the repository:

```sh
node --test tests/services-gallery.test.mjs tests/services-navigation.test.mjs tests/services-slideshow.test.mjs
```

Result: 9 tests pass. The immediate-navigation and modified-click tests failed before the fix.

With FFmpeg on PATH (or `FFMPEG` set to its executable):

```sh
node scripts/build-services-slideshow.mjs
```

Result: 302,445-byte MP4; all 279 frames decode, 9.3 seconds, 30fps. Each of the three transition windows has 14/14 changing frames. The first/last frame mean RGB difference is 0.574/255 after downscaling to 160x100.

Serve the repository locally on port 4325. With `@playwright/test` resolvable, or `PLAYWRIGHT_PACKAGE` pointing to a package.json whose dependencies include it, and Edge installed:

```sh
node tests/services-startup.browser.mjs
```

Latest isolated run (local Windows/Edge, not a production/network guarantee):

| Check | Desktop 1440px | Mobile viewport 390px |
|---|---:|---:|
| Click to Services document request | 59ms | 57ms |
| Click to textured entrance assertion | 1,116ms | 390ms |
| Optional media still held | 9 requests | 9 requests |
| Readable-grid flash / loader bars | None | None |

Before the fix, the normal desktop path took 443ms just to request Services and 2,199ms to the first visible-card assertion. Removing deliberate delays does not make downloading/parsing/GPU initialization take zero time. A concurrent GPU-browser run exceeded the 1,500ms assertion timeout; the isolated run above passed the same unchanged limit. Run timing checks serially.

Additional local Edge checks passed: six service destinations by keyboard, desktop wheel/mobile drag, desktop/mobile menus and click navigation, reduced-motion/no-WebGL links, no-JavaScript/data/module failure links, and the new slideshow decoded and playing in the carousel. Desktop/mobile screenshots were inspected for original service order and geometry. Safari and physical phones were not checked.

Source reuse/licensing and publication approval remain separate from these local functional checks.

## Follow-up: typography, shared transitions and efficiency

The later shared route transitions supersede the earlier destination-specific outgoing treatment above: navigation begins without the old arbitrary delay, then the old page fades through the destination colour before the new page/film entrance. Original logo/menu/capabilities typography remains. Creative Directing letter placement now uses the baked glyph-atlas advances, fixing the a/t gap without changing the word gap or centred alignment; its regression failed with the fix disabled and passed with it restored.

Off-screen service cards stay resident when nearby but their videos pause instead of continuing to decode. A real Edge scroll sample confirmed the off-screen Gift preview paused (previously playing); the unit regression exercises the production registry method with on/off-screen cards. Gabzy and Gift previews were losslessly remuxed for faststart, alongside the Creative Direction previews. Visible posters still gate entrance; full videos do not. See `../creative-direction/README.md` for the combined 36-test result, browser coverage, measured GPU savings and network limits.

## Minimal native scrollbars — 21 October 2026

`/css/scrollbars.css` is shared by the main stylesheet, Creative Direction and the embedded gallery. It replaces the browser's broad track with an 8px native control, a rounded grey thumb (4px visible within transparent borders), transparent track/corner and a brighter hover state. The old mobile-carousel-only rules were removed. Browsers without WebKit scrollbar selectors receive standard thin-scrollbar colours; forced-colour mode keeps OS defaults. At that stage no JavaScript, overflow, touch or scrolling behavior was changed; the later scroll-only controller below adds only a scroll event listener.

Verification: 38 Node tests passed (26 site + 12 player); ESLint, strict production CSS parsing and `git diff --check` passed. The new browser regression failed on the default scrollbar before the fix and passed afterward in Windows/Edge: dark/light long-page scrollbars, wheel and PageDown/Home scrolling, native high-contrast defaults, an overflowing film dialog with Escape dismissal, and a mobile-width readable gallery. All 16 styled HTML documents reach the shared stylesheet. Screenshots inspected with Playwright's default scrollbar-hiding flag disabled. Firefox/Safari and physical touch devices were not run.

Run `node tests/scrollbars.browser.mjs` with the same `PLAYWRIGHT_PACKAGE` and `LIGERO_PREVIEW` variables described above. Optional `LIGERO_EVIDENCE` stores four screenshots. Changes remain local, uncommitted and undeployed.

## Follow-up: black reflections, scroll-only controls and photography mosaic

The Services gallery floor now stays black instead of drawing its perspective grid or gradient. Its existing mirrored-camera capture still projects the service cards as subtle reflected light under the tiles. The original logo, menu, capabilities heading and six-card order are unchanged.

The site-wide 8px native scrollbar track is transparent and its thumb starts invisible. One event-driven controller, loaded by the shared navigation script and the embedded gallery, reveals it during actual page or nested-container scrolling and hides it 900ms after scrolling stops. The high-contrast OS scrollbar remains native; scrolling and layout are unchanged.

The photography preview is now a 4-column staggered mosaic of all ten `ash-pic-1..10.webp` images. The pre-rendered 960×600 H.264 loops downward at 30fps with a 14.33s exact mathematical wrap; its matching first-frame WebP is used in the GPU card and readable fallback. Video: 551,826 bytes; poster: 77,516 bytes. Rebuild with `FFMPEG=<ffmpeg path> node scripts/build-services-slideshow.mjs`. This is one looping video, not ten simultaneous image decoders.

Checks: the original behaviors, shader/poster integration, all 10 source images, direction, seam and media encode/decode were tested (full Node suite: 46 pass at integration). JS syntax, CSS production parse, ESLint, and whitespace checks passed. Browser check status and limitations are reported in the completion note. No push or deployment.


## Light-theme carousel — 21 October 2026

The owner’s light-theme correction supersedes the always-black floor described above. The existing saved theme now controls the WebGL sky, floor, edge fade, mirrored-camera clear colour and the iframe’s loading background. Dark remains black. Light is white, including the space behind the cards. Card colours and carousel geometry are unchanged.

The reflection blends the captured cards with the selected floor colour instead of adding light to an already-white surface. It keeps the same reflection camera, strength and falloff. The renderer checks the existing theme state during its normal environment update and wakes a draw only when the theme changes; it does not add a timer, listener or second theme store.

Regression: `node tests/services-theme.browser.mjs` (the same Edge/Playwright setup above). The pixel assertion failed before the fix: light theme rendered `[0,0,0]` instead of `[255,255,255]`. After the fix it passes at 1440 and 390 pixels, including white/black/white switching, saved-light reload, and desktop/mobile navigation. The desktop GPU comparison with reflection disabled confirms visibly coloured reflection pixels in both themes. Screenshots inspected. The existing small-screen layout still omits the floor reflection; this change does not add a new mobile effect.

Affected gallery, navigation, text-spacing and media-efficiency unit checks: 19 pass. Renderer syntax, changed-code ESLint, strict production CSS transform and whitespace checks pass. Local only; no push or deployment. Safari and physical phones not checked.


## Service title flash — 22 October 2026

The HTML labels briefly painted at their layout positions before the GPU titles faded in. Only those duplicate labels now use `filter: opacity(0)` inside `#__nuxt [data-gl="card"] [data-title]`. Unlike `opacity: 0`, this keeps the computed opacity and layout used by the text renderer intact. The GPU lettering, entrance timing, card interactions and separate readable links are unchanged; no renderer-bundle edits were needed.

Run `node tests/services-titles.browser.mjs` with the Edge/Playwright environment above. It holds actual glyph requests at 1440px and 390px in both themes, checks the HTML contributes no early title pixels, verifies the animated GPU titles remain visible, and activates the matching service with the keyboard. It also checks readable, reduced-motion, no-WebGL, no-JavaScript, data-failure and module-failure links at both widths. Optional `LIGERO_EVIDENCE` saves the four title screenshots.

All four delayed-glyph cases failed before the CSS fix on the duplicate HTML title paint assertion. The first post-fix run exposed a harness assumption: the card's href is its readable fallback, while keyboard selection uses the parent's service mapping. The test now asserts arrival at the corresponding service URL rather than the fallback href; production navigation was not changed.

Verification: all 16 new title/fallback cases pass in local Edge; the four title cases failed before the fix. Existing Services entrance, theme/reflection and visual-startup suites also pass (9 cases), including canvas-text/no-parallel-shader paths and visible home-film pixels. All 89 Node tests pass (77 root + 12 colocated player); all 11 static Photography pages build and match the generator. Syntax, recommended ESLint (zero warnings), strict production CSS and whitespace checks pass. Desktop dark/mobile light screenshots were inspected. Test browsers are closed; bounded logs and screenshots are in `~/.aki/tmp/ligero-titles`. Safari/physical phones are not checked. Local only, not committed, pushed or deployed.
