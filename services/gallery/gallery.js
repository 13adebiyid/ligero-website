import '../../js/scrollbars.js';
const readable = document.getElementById('readable');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

async function startGallery() {
  try {
    if (new URLSearchParams(location.search).get('view') === 'readable' || reducedMotion.matches) return;
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return;
    gl.getExtension('WEBGL_lose_context')?.loseContext();

    const response = await fetch('./services.json');
    if (!response.ok) throw new Error('Services unavailable');
    const data = await response.json();
    if (!data?.featured?.length) return;

    await window.parent.ligeroRouteReady;
    await import('./_nuxt/DZyj3ghP.js');
    document.documentElement.classList.add('gallery-mode');
    readable.hidden = true;
  } catch (error) {
    console.error('Services gallery unavailable; service links remain available.', error);
  } finally {
    document.documentElement.classList.remove('gallery-loading');
  }
}

void startGallery();
reducedMotion.addEventListener('change', () => location.reload());
document.addEventListener('webglcontextlost', () => {
  location.assign('/services/gallery/?view=readable');
}, true);
