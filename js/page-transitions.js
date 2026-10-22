(() => {
    if (window.LigeroNavigation) return;
    const root = document.documentElement;
    const scrollbarController = document.createElement('script');
    scrollbarController.src = '/js/scrollbars.js';
    document.head.appendChild(scrollbarController);
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const nativeTransitions = 'onpageswap' in window && 'onpagereveal' in window;
    const editedPage = path => ['/', '/index.html', '/services', '/services/', '/services/index.html', '/services/creative-directing', '/services/creative-directing.html', '/services/set-designing', '/services/set-designing.html'].includes(path) || /^\/services\/photography(?:\.html|\/|$)/.test(path);
    const pageColor = () => getComputedStyle(root).getPropertyValue('--site-background').trim() || '#000';
    let leaving = false, cover = null, finishArrival;
    window.ligeroRouteReady = new Promise(resolve => { finishArrival = resolve; });

    function handles(href) {
        const url = new URL(href, location.href);
        const extension = url.pathname.split('/').pop().split('.').slice(1).join('.');
        return url.origin === location.origin && (!extension || extension === 'html') &&
            (editedPage(location.pathname) || editedPage(url.pathname)) &&
            (url.pathname !== location.pathname || url.search !== location.search);
    }

    function removeCover() {
        cover?.remove();
        cover = null;
        leaving = false;
        root.classList.remove('route-leaving');
    }

    function makeCover(color, opacity) {
        cover?.remove();
        cover = document.createElement('div');
        cover.className = 'route-cover';
        cover.setAttribute('aria-hidden', 'true');
        cover.style.background = color;
        cover.style.opacity = opacity;
        root.appendChild(cover);
        return cover;
    }

    function navigate(href) {
        const url = new URL(href, location.href);
        if (leaving || url.origin !== location.origin) return;
        if (nativeTransitions || reducedMotion.matches) { location.assign(url.href); return; }
        leaving = true;
        root.classList.add('route-leaving');
        const color = pageColor(url.pathname);
        const layer = makeCover(color, '0');
        const animation = layer.animate([{opacity:0}, {opacity:1}], {duration:120, easing:'cubic-bezier(.4,0,.2,1)', fill:'forwards'});
        animation.finished.then(() => {
            try { sessionStorage.setItem('ligero:arrival', JSON.stringify({path:url.pathname, color, time:Date.now()})); }
            catch { /* Storage can be disabled independently of navigation. */ }
            location.assign(url.href);
        });
    }

    window.LigeroNavigation = {handles, navigate};
    document.addEventListener('click', event => {
        const link = event.target.closest('a[href]');
        if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
        if (!handles(link.href) || nativeTransitions || reducedMotion.matches) return;
        event.preventDefault();
        navigate(link.href);
    });

    window.addEventListener('pageswap', event => {
        if (!event.viewTransition) return;
        const destination = event.activation?.entry?.url;
        if (!destination || !handles(destination) || reducedMotion.matches) {
            event.viewTransition.ready.catch(() => {});
            event.viewTransition.skipTransition();
        }
    });
    window.addEventListener('pagereveal', event => {
        if (!event.viewTransition) { finishArrival(); return; }
        root.classList.add('route-arriving');
        const finish = () => {
            root.classList.remove('route-arriving');
            finishArrival();
        };
        event.viewTransition.finished.then(finish, finish);
    });
    if (!nativeTransitions) {
        try {
            const saved = JSON.parse(sessionStorage.getItem('ligero:arrival') || 'null');
            sessionStorage.removeItem('ligero:arrival');
            if (saved?.path === location.pathname && Date.now() - saved.time < 15000) makeCover(saved.color, '1');
        } catch { /* A missing handoff uses the ordinary page entrance. */ }
    }
    const arrive = () => {
        if (!cover) { if (!nativeTransitions) finishArrival(); return; }
        const animation = cover.animate([{opacity:1}, {opacity:0}], {duration:reducedMotion.matches ? 0 : 120, easing:'ease-out', fill:'forwards'});
        animation.finished.then(() => { removeCover(); finishArrival(); });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrive, {once:true});
    else arrive();
    window.addEventListener('pageshow', event => {
        if (event.persisted) { removeCover(); finishArrival(); }
        else if (!nativeTransitions && !cover) finishArrival();
    });
})();
