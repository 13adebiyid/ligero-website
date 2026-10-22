(() => {
    const root = document.documentElement;
    const valid = value => value === 'white' || value === 'black';
    let current = 'black';
    function restore() {
        try { const saved = localStorage.getItem('theme'); current = valid(saved) ? saved : 'black'; }
        catch { /* A blocked store must not prevent switching this page. */ }
        apply();
    }
    function apply() {
        root.dataset.theme = current;
        root.style.colorScheme = current === 'white' ? 'light' : 'dark';
        document.body?.classList.toggle('white-theme', current === 'white');
        for (const button of document.querySelectorAll('[data-theme-choice]')) button.setAttribute('aria-pressed', String(button.dataset.themeChoice === current));
        for (const icon of document.querySelectorAll('.instagram-icon')) {
            const source = icon.getAttribute(`data-icon-${current}`);
            if (source) icon.src = source;
        }
        document.dispatchEvent(new CustomEvent('ligero:themechange', {detail:{theme:current}}));
    }
    function setTheme(theme) {
        if (!valid(theme)) return;
        current = theme;
        try { localStorage.setItem('theme', theme); }
        catch { /* The selected theme still works when persistence is unavailable. */ }
        apply();
    }
    window.setTheme = setTheme;
    restore();
    document.addEventListener('DOMContentLoaded', () => {
        if (window !== window.parent) { apply(); return; }
        const existing = [...document.querySelectorAll('.theme-switcher')];
        const control = existing.shift() || document.createElement('div');
        existing.forEach(node => node.remove());
        control.className = 'theme-switcher';
        control.setAttribute('role', 'group');
        control.setAttribute('aria-label', 'Colour theme');
        control.replaceChildren(...['black','white'].map(theme => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `theme-circle ${theme}`;
            button.dataset.themeChoice = theme;
            button.setAttribute('aria-label', `${theme === 'white' ? 'Light' : 'Dark'} theme`);
            button.title = `${theme === 'white' ? 'Light' : 'Dark'} theme`;
            button.addEventListener('click', () => setTheme(theme));
            return button;
        }));
        document.body.append(control);
        apply();
    }, {once:true});
    window.addEventListener('storage', event => {
        if (event.key === 'theme' && valid(event.newValue)) { current = event.newValue; apply(); }
    });
    window.addEventListener('pageshow', event => { if (event.persisted) restore(); });
})();
