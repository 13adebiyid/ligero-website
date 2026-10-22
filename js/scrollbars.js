(() => {
    let hideTimer;
    document.addEventListener('scroll', () => {
        document.documentElement.classList.add('scroll-active');
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => document.documentElement.classList.remove('scroll-active'), 900);
    }, {capture: true, passive: true});
    window.addEventListener('pagehide', () => clearTimeout(hideTimer));
    window.addEventListener('pageshow', () => document.documentElement.classList.remove('scroll-active'));
})();
