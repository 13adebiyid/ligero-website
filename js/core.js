// ================== CORE.JS ==================
// Core utilities and functions used across all pages

const Core = (() => {
    'use strict';

    // State Management
    const state = {
        theme: 'black',
        isMobile: false,
        isLoading: false
    };

    // DOM Cache
    const DOM = {
        body: null,
        init() {
            this.body = document.body;
        }
    };

    // Utility Functions
    const utils = {
        // Check if mobile
        isMobile() {
            return window.innerWidth <= 768;
        },

        // Debounce function
        debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        },

        // Throttle function
        throttle(func, limit) {
            let inThrottle;
            return function(...args) {
                if (!inThrottle) {
                    func.apply(this, args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        },

        // Smooth scroll
        smoothScroll(target, duration = 800) {
            const targetElement = typeof target === 'string'
                ? document.querySelector(target)
                : target;

            if (!targetElement) return;

            const targetPosition = targetElement.getBoundingClientRect().top;
            const startPosition = window.pageYOffset;
            let startTime = null;

            function animation(currentTime) {
                if (startTime === null) startTime = currentTime;
                const timeElapsed = currentTime - startTime;
                const run = ease(timeElapsed, startPosition, targetPosition, duration);
                window.scrollTo(0, run);
                if (timeElapsed < duration) requestAnimationFrame(animation);
            }

            function ease(t, b, c, d) {
                t /= d / 2;
                if (t < 1) return c / 2 * t * t + b;
                t--;
                return -c / 2 * (t * (t - 2) - 1) + b;
            }

            requestAnimationFrame(animation);
        },

        // Check if element is in viewport
        isInViewport(element) {
            const rect = element.getBoundingClientRect();
            return (
                rect.top >= 0 &&
                rect.left >= 0 &&
                rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                rect.right <= (window.innerWidth || document.documentElement.clientWidth)
            );
        },

        // Email validation
        isValidEmail(email) {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        },

        // Format number with commas
        formatNumber(num) {
            return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        }
    };

    // Theme Management
    const theme = {
        init() {
            // Load saved theme
            try {
                const savedTheme = localStorage.getItem('theme');
                if (savedTheme) {
                    this.set(savedTheme);
                }
            } catch (e) {
                console.warn('LocalStorage not available');
            }

            // Setup theme switchers
            this.setupSwitchers();
        },

        set(themeName) {
            state.theme = themeName;

            if (themeName === 'white') {
                DOM.body.classList.add('white-theme');
            } else {
                DOM.body.classList.remove('white-theme');
            }

            // Save preference
            try {
                localStorage.setItem('theme', themeName);
            } catch (e) {}

            // Dispatch event for other components
            window.dispatchEvent(new CustomEvent('themeChanged', {
                detail: { theme: themeName }
            }));
        },

        get() {
            return state.theme;
        },

        toggle() {
            this.set(state.theme === 'black' ? 'white' : 'black');
        },

        setupSwitchers() {
            document.querySelectorAll('.theme-circle').forEach(circle => {
                circle.addEventListener('click', () => {
                    const newTheme = circle.classList.contains('white') ? 'white' : 'black';
                    this.set(newTheme);
                });
            });
        }
    };

    // Loading States
    const loading = {
        show(element = DOM.body) {
            element.classList.add('loading');
            state.isLoading = true;
        },

        hide(element = DOM.body) {
            element.classList.remove('loading');
            state.isLoading = false;
        },

        isLoading() {
            return state.isLoading;
        }
    };

    // Intersection Observer for animations
    const animations = {
        observer: null,

        init() {
            const options = {
                threshold: 0.1,
                rootMargin: '0px 0px -50px 0px'
            };

            this.observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('animate');
                        this.observer.unobserve(entry.target);
                    }
                });
            }, options);

            // Observe elements with data-animate
            this.observeElements();
        },

        observeElements() {
            document.querySelectorAll('[data-animate]').forEach(el => {
                this.observer.observe(el);
            });
        },

        destroy() {
            if (this.observer) {
                this.observer.disconnect();
            }
        }
    };

    // Performance monitoring
    const performance = {
        mark(name) {
            if (window.performance && window.performance.mark) {
                window.performance.mark(name);
            }
        },

        measure(name, startMark, endMark) {
            if (window.performance && window.performance.measure) {
                try {
                    window.performance.measure(name, startMark, endMark);
                    const measure = window.performance.getEntriesByName(name)[0];
                    console.log(`${name}: ${measure.duration}ms`);
                } catch (e) {}
            }
        }
    };

    // Public API
    return {
        init() {
            DOM.init();
            theme.init();
            animations.init();

            // Update mobile state
            state.isMobile = utils.isMobile();
            window.addEventListener('resize', utils.debounce(() => {
                state.isMobile = utils.isMobile();
            }, 250));

            console.log('Core initialized');
        },

        // Expose utilities
        utils,
        theme,
        loading,
        animations,
        performance,

        // Expose state (read-only)
        getState() {
            return { ...state };
        }
    };
})();

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Core.init());
} else {
    Core.init();
}

// Make Core globally available
window.Core = Core;