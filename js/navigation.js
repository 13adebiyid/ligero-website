// ================== NAVIGATION.JS ==================
// Navigation and page transition functionality

const Navigation = (() => {
    'use strict';

    // State
    const state = {
        isMenuOpen: false,
        isNavigating: false,
        lastNavigationTime: 0
    };

    // DOM Elements
    const DOM = {
        nav: null,
        hamburger: null,
        mobileOverlay: null,
        menuItems: null,

        init() {
            this.nav = document.querySelector('nav');
            this.hamburger = document.querySelector('.hamburger-menu');
            this.mobileOverlay = document.querySelector('.mobile-menu-overlay');
            this.menuItems = document.querySelectorAll('.mobile-menu-item');
        }
    };

    // Mobile Menu
    const mobileMenu = {
        init() {
            if (!DOM.hamburger || !DOM.mobileOverlay) return;

            // Hamburger click
            DOM.hamburger.addEventListener('click', () => {
                this.toggle();
            });

            // Menu item clicks
            DOM.menuItems.forEach(item => {
                item.addEventListener('click', () => {
                    setTimeout(() => this.close(), 100);
                });
            });

            // Close on overlay click
            DOM.mobileOverlay.addEventListener('click', (e) => {
                if (e.target === DOM.mobileOverlay) {
                    this.close();
                }
            });

            // Close on escape
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && state.isMenuOpen) {
                    this.close();
                }
            });
        },

        toggle() {
            if (state.isMenuOpen) {
                this.close();
            } else {
                this.open();
            }
        },

        open() {
            state.isMenuOpen = true;
            DOM.hamburger.classList.add('active');
            DOM.mobileOverlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        },

        close() {
            state.isMenuOpen = false;
            DOM.hamburger.classList.remove('active');
            DOM.mobileOverlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    };

    // Page Transitions
    const transitions = {
        init() {
            // Intercept internal links
            document.addEventListener('click', (e) => {
                const target = e.target.closest('a[href]');
                if (!target) return;

                const href = target.getAttribute('href');
                if (!href || !href.startsWith('/') || href.startsWith('//')) return;

                // Check if same page
                const isSamePage = href === window.location.pathname;
                if (isSamePage) return;

                // Prevent default and handle transition
                e.preventDefault();
                this.navigateTo(href);
            });

            // Handle browser back/forward
            window.addEventListener('popstate', () => {
                this.resetState();
            });
        },

        navigateTo(url) {
            if (state.isNavigating) return;

            state.isNavigating = true;
            state.lastNavigationTime = Date.now();

            // Create transition overlay
            const overlay = this.createOverlay();

            // Start transition
            document.body.classList.remove('page-loaded');
            overlay.classList.add('active');

            // Navigate after animation
            setTimeout(() => {
                window.location.href = url;
            }, 400);
        },

        createOverlay() {
            let overlay = document.querySelector('.page-transition');

            if (!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'page-transition';
                overlay.innerHTML = '<div class="loading-text">LIGERO</div>';
                document.body.appendChild(overlay);
            }

            return overlay;
        },

        resetState() {
            state.isNavigating = false;
            state.lastNavigationTime = 0;

            // Remove any lingering overlays
            document.querySelectorAll('.page-transition').forEach(el => {
                el.remove();
            });

            // Restore page state
            document.body.classList.add('page-loaded');
            document.body.style.opacity = '1';
            document.body.style.pointerEvents = 'auto';
        }
    };

    // Scroll Effects
    const scrollEffects = {
        lastScroll: 0,

        init() {
            if (!DOM.nav) return;

            window.addEventListener('scroll', Core.utils.throttle(() => {
                this.handleScroll();
            }, 100));
        },

        handleScroll() {
            const currentScroll = window.pageYOffset;

            // Add/remove nav background on scroll
            if (currentScroll > 50) {
                DOM.nav.classList.add('scrolled');
            } else {
                DOM.nav.classList.remove('scrolled');
            }

            // Hide/show nav on scroll direction
            if (currentScroll > this.lastScroll && currentScroll > 100) {
                DOM.nav.classList.add('hidden');
            } else {
                DOM.nav.classList.remove('hidden');
            }

            this.lastScroll = currentScroll;
        }
    };

    // Smooth scroll to anchors
    const smoothScroll = {
        init() {
            document.querySelectorAll('a[href^="#"]').forEach(anchor => {
                anchor.addEventListener('click', (e) => {
                    e.preventDefault();
                    const targetId = anchor.getAttribute('href');
                    if (targetId === '#') return;

                    const target = document.querySelector(targetId);
                    if (target) {
                        Core.utils.smoothScroll(target);
                    }
                });
            });
        }
    };

    // Public API
    return {
        init() {
            DOM.init();
            mobileMenu.init();
            transitions.init();
            scrollEffects.init();
            smoothScroll.init();

            // Mark page as loaded
            setTimeout(() => {
                document.body.classList.add('page-loaded');
            }, 100);

            console.log('Navigation initialized');
        },

        // Expose methods
        openMenu: () => mobileMenu.open(),
        closeMenu: () => mobileMenu.close(),
        toggleMenu: () => mobileMenu.toggle(),
        navigateTo: (url) => transitions.navigateTo(url),

        // Get state
        isMenuOpen: () => state.isMenuOpen,
        isNavigating: () => state.isNavigating
    };
})();

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Navigation.init());
} else {
    Navigation.init();
}

// Make globally available
window.Navigation = Navigation;