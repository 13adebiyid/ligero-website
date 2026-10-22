const root = document.documentElement;
const menuButton = document.querySelector('.menu-toggle');
const menu = document.querySelector('#photo-menu');
const main = document.querySelector('main');
function setMenu(open) {
  root.classList.toggle('menu-open', open);
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  menuButton.querySelector('.menu-label').textContent = open ? 'CLOSE' : 'MENU';
  main.inert = open;
  document.dispatchEvent(new Event('photomenuchange'));
  if (open) menu.querySelector('a').focus();
}
menuButton.addEventListener('click', () => setMenu(!root.classList.contains('menu-open')));
menu.addEventListener('click', event => { if (event.target.closest('a')) setMenu(false); });
document.addEventListener('keydown', event => {
  if (!root.classList.contains('menu-open')) return;
  if (event.key === 'Escape') { setMenu(false); menuButton.focus(); }
  if (event.key === 'Tab') {
    const controls = [menuButton, ...menu.querySelectorAll('a')];
    const index = controls.indexOf(document.activeElement);
    if (event.shiftKey && index === 0) { event.preventDefault(); controls.at(-1).focus(); }
    if (!event.shiftKey && index === controls.length - 1) { event.preventDefault(); menuButton.focus(); }
  }
});
window.addEventListener('resize', () => { if (root.classList.contains('menu-open')) setMenu(false); });
root.classList.add('controls-ready');
if (document.querySelector('#photographs')) {
  import('./gallery.mjs').then(({startGallery}) => startGallery()).catch(error => {
    root.classList.remove('photo-pending', 'photo-entering');
    document.querySelector('.photo-grid').inert = false;
    document.querySelector('.intro-grid')?.remove();
    console.warn('Photography animation unavailable; showing the photo links.', error);
  });
} else if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const image = document.querySelector('.project-image');
  image.animate([{clipPath:'inset(100% 0 0)',transform:'translateY(24px)'},{clipPath:'inset(0)',transform:'none'}], {duration:1000,easing:'cubic-bezier(.215,.61,.355,1)'});
}
