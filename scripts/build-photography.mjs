import {readFile, writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const root = new URL('../', import.meta.url);
export const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const detailURL = photo => `/services/photography/photo-${photo.id}.html`;
const header = `<header class="photo-header">
  <a href="/" class="logo" aria-label="Ligero home">LIGERO</a>
  <button class="menu-toggle" aria-label="Open menu" aria-controls="photo-menu" aria-expanded="false"><span class="menu-label">MENU</span><span class="menu-lines" aria-hidden="true"><i></i><i></i><i></i></span></button>
  <nav class="nav-menu" id="photo-menu" aria-label="Main navigation">
    <a class="nav-item nav-home" href="/">Home</a>
    <a class="nav-item" href="/shop/">Shop</a><span aria-hidden="true">|</span>
    <a class="nav-item" href="/services/">Services</a><span aria-hidden="true">|</span>
    <a class="nav-item" href="/contact/">Contact</a><span aria-hidden="true">|</span>
    <a class="nav-item" href="/policies/">Policies</a>
  </nav>
</header>`;
export function photoCard(photo, index) {
  return `<article class="photo-card" data-photo-id="${photo.id}">
    <a class="photo-link" href="${detailURL(photo)}" aria-label="View ${escapeHTML(photo.category)} photograph ${photo.id} by ${escapeHTML(photo.photographer)}">
      <div class="photo-image"><img src="${photo.preview || photo.image}" alt="${escapeHTML(photo.category)} photograph by ${escapeHTML(photo.photographer)}" width="900" height="1200" loading="${index < 6 ? 'eager' : 'lazy'}" decoding="async"${index === 0 ? ' fetchpriority="high"' : ''}></div>
      <div class="photo-caption"><div><h2>${escapeHTML(photo.photographer)}</h2></div><p>${escapeHTML(photo.category)}</p></div>
    </a>
  </article>`;
}
function documentHTML(title, body, detail = false) {
  return `<!doctype html>
<html lang="en">
<head>
  <script src="/js/theme.js"></script>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHTML(title)} — Ligero</title>
  <meta name="description" content="Photography by Ashleigh Cooper. Explore Ligero's selected photographic work.">
  <link rel="icon" href="/images/ligero-browser-icon.png">
  <link rel="preload" href="/fonts/suissnord.regular.woff" as="font" type="font/woff" crossorigin>
  <link rel="preload" href="/fonts/MadaniDEMO-Thin.woff" as="font" type="font/woff" crossorigin>
  <link rel="stylesheet" href="/css/page-transitions.css">
  <link rel="stylesheet" href="/services/photography/page.css">
  <script src="/js/page-transitions.js"></script>
${!detail ? `  <script>if (!matchMedia('(prefers-reduced-motion: reduce)').matches && performance.getEntriesByType('navigation')[0]?.type !== 'back_forward') document.documentElement.classList.add('photo-pending');</script>\n` : ''}
  <script type="module" src="/services/photography/page.mjs" onerror="document.documentElement.classList.remove('photo-pending')"></script>
  <link rel="stylesheet" href="/css/theme.css">
</head>
<body class="${detail ? 'photo-detail' : 'photo-gallery'}">
  ${header}
  ${body.trimStart()}
</body>
</html>
`;
}
export function buildPages(photos) {
  const pages = new Map();
  pages.set('services/photography.html', documentHTML('Photography', `
  <main id="photographs" aria-label="Photography portfolio">
    <h1 class="sr-only">Photography</h1>
    <div class="photo-grid">${photos.map(photoCard).join('\n')}</div>
  </main>`));
  for (const photo of photos) {
    const metadata = [['Photographer', `<a href="${photo.photographerUrl}">${escapeHTML(photo.photographer)} ↗</a>`], ['Client', escapeHTML(photo.client)], ['Camera', escapeHTML(photo.camera)], ['Year', escapeHTML(photo.year)]];
    pages.set(detailURL(photo).slice(1), documentHTML(`${photo.photographer} — ${photo.category}`, `
  <main class="photo-project">
    <section class="photo-information" aria-label="Photo information">
      <a class="back-link" href="/services/photography.html">← Photography</a>
      <p class="photo-category">${escapeHTML(photo.category)}</p>
      <h1>${escapeHTML(photo.photographer)}</h1>
      <dl>${metadata.map(([key, value]) => `<div><dt>${key}</dt><dd>${value}</dd></div>`).join('')}</dl>
    </section>
    <figure class="project-image"><img src="${photo.image}" alt="${escapeHTML(photo.category)} photograph by ${escapeHTML(photo.photographer)}" fetchpriority="high" decoding="async"></figure>
  </main>`, true));
  }
  return pages;
}
async function build() {
  const photos = JSON.parse(await readFile(new URL('services/photography/photos.json', root), 'utf8'));
  const pages = buildPages(photos);
  for (const [path, html] of pages) {
    const url = new URL(path, root);
    if (process.argv.includes('--check')) {
      if (await readFile(url, 'utf8') !== html) throw new Error(`Stale generated Photography page: ${path}`);
    } else await writeFile(url, html);
  }
  console.log(`${pages.size} Photography pages ${process.argv.includes('--check') ? 'verified' : 'built'}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await build();
