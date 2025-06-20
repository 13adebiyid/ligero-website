// Start loading animation immediately when script loads
(function() {
    // Check if this is a fresh page load
    const isInitialLoad = !window.performance || performance.navigation.type === 0;

    if (isInitialLoad) {
        // Create overlay immediately
        const overlay = document.createElement('div');
        overlay.className = 'page-transition active';
        overlay.innerHTML = '<div class="loading-text">LIGERO</div>';
        document.body.appendChild(overlay);
    }
})();

let currentSlide = 0;

function showPage(page) {
    // For multi-page website, we don't need to hide/show pages
    // Each page is a separate HTML file
    // This function is kept for compatibility but doesn't do page switching

    // If we're on the services page, make sure it's properly displayed
    const servicesPage = document.getElementById('services-page');
    if (servicesPage && page === 'services') {
        servicesPage.style.display = 'block';
        servicesPage.classList.add('active');
    }

    // If we're on the home page, make sure it's properly displayed
    const homePage = document.getElementById('home-page');
    if (homePage && page === 'home') {
        homePage.style.display = 'flex';
    }

    // If we're on the shop page, make sure it's properly displayed
    const shopPage = document.querySelector('.shop-page');
    if (shopPage && page === 'shop') {
        shopPage.style.display = 'block';
    }

    // If we're on the policies page, make sure it's properly displayed
    const policiesPage = document.getElementById('policies-page');
    if (policiesPage && page === 'policies') {
        policiesPage.style.display = 'block';
    }
}

function setTheme(theme) {
    if (theme === 'white') {
        document.body.classList.add('white-theme');
        // Only use localStorage if available (not in artifacts)
        try {
            localStorage.setItem('theme', 'white');
        } catch (e) {
            // localStorage not available, continue without saving
        }
    } else {
        document.body.classList.remove('white-theme');
        try {
            localStorage.setItem('theme', 'black');
        } catch (e) {
            // localStorage not available, continue without saving
        }
    }
}

// Mobile menu toggle functionality
function toggleMobileMenu() {
    const hamburger = document.querySelector('.hamburger-menu');
    const mobileMenuOverlay = document.querySelector('.mobile-menu-overlay');

    if (hamburger && mobileMenuOverlay) {
        hamburger.classList.toggle('active');
        mobileMenuOverlay.classList.toggle('active');

        // Prevent body scroll when menu is open
        if (mobileMenuOverlay.classList.contains('active')) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    }
}

// Close mobile menu when clicking on menu items
function closeMobileMenu() {
    const hamburger = document.querySelector('.hamburger-menu');
    const mobileMenuOverlay = document.querySelector('.mobile-menu-overlay');

    if (hamburger && mobileMenuOverlay) {
        hamburger.classList.remove('active');
        mobileMenuOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Check if we're on mobile
function isMobile() {
    return window.innerWidth <= 768;
}

// Get responsive carousel settings based on screen size
function getCarouselSettings() {
    const screenWidth = window.innerWidth;

    if (screenWidth <= 375) {
        return {
            cardWidth: 200,
            cardGap: 15,
            containerPadding: 100
        };
    } else if (screenWidth <= 480) {
        return {
            cardWidth: 220,
            cardGap: 20,
            containerPadding: 100
        };
    } else if (screenWidth <= 576) {
        return {
            cardWidth: 250,
            cardGap: 20,
            containerPadding: 100
        };
    } else if (screenWidth <= 768) {
        return {
            cardWidth: 280,
            cardGap: 20,
            containerPadding: 120
        };
    } else if (screenWidth <= 1024) {
        return {
            cardWidth: 600,
            cardGap: 40,
            containerPadding: 240
        };
    } else {
        return {
            cardWidth: 800,
            cardGap: 40,
            containerPadding: 240
        };
    }
}

function slideCarousel(direction) {
    // Don't slide on mobile - it's now a vertical scroll
    if (isMobile()) {
        return;
    }

    const carousel = document.getElementById('carousel');
    const cards = carousel.querySelectorAll('.service-card');
    const totalCards = cards.length;

    if (totalCards === 0) {
        console.error('No service cards found!');
        return;
    }

    const settings = getCarouselSettings();
    const { cardWidth, cardGap, containerPadding } = settings;

    const containerWidth = window.innerWidth - containerPadding;
    const cardsVisible = Math.max(1, Math.floor(containerWidth / (cardWidth + cardGap)));
    const maxSlide = Math.max(0, totalCards - cardsVisible);

    currentSlide += direction;

    // Keep within bounds
    if (currentSlide < 0) {
        currentSlide = 0;
    }
    if (currentSlide > maxSlide) {
        currentSlide = maxSlide;
    }

    // Calculate translation
    let translateX;
    if (currentSlide === maxSlide && maxSlide > 0) {
        // Position so last card is fully visible with proper spacing
        const totalCarouselWidth = (totalCards * cardWidth) + ((totalCards - 1) * cardGap);
        const availableWidth = containerWidth;
        translateX = Math.min(0, -(totalCarouselWidth - availableWidth));
    } else {
        translateX = -(currentSlide * (cardWidth + cardGap));
    }

    carousel.style.transform = `translateX(${translateX}px)`;

    console.log(`Direction: ${direction}, Current slide: ${currentSlide}, Max slide: ${maxSlide}, Cards visible: ${cardsVisible}, Translate: ${translateX}px`);
}

// Reset carousel when window is resized
function resetCarousel() {
    currentSlide = 0;
    const carousel = document.getElementById('carousel');
    if (carousel && !isMobile()) {
        carousel.style.transform = 'translateX(0px)';
    }
}

// Handle window resize
let resizeTimeout;
function handleResize() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        resetCarousel();

        // Close mobile menu if screen becomes large
        if (window.innerWidth > 768) {
            closeMobileMenu();
        }
    }, 250);
}

// Touch/swipe functionality - only for desktop carousel
let touchStartX = 0;
let touchEndX = 0;
let isSwiping = false;

function handleTouchStart(e) {
    if (isMobile()) return; // Don't handle touch events on mobile for carousel

    touchStartX = e.changedTouches[0].screenX;
    isSwiping = true;
}

function handleTouchMove(e) {
    if (!isSwiping || isMobile()) return;
    e.preventDefault(); // Prevent scrolling while swiping
}

function handleTouchEnd(e) {
    if (!isSwiping || isMobile()) return;

    touchEndX = e.changedTouches[0].screenX;
    const swipeDistance = touchStartX - touchEndX;
    const minSwipeDistance = 50;

    if (Math.abs(swipeDistance) > minSwipeDistance) {
        if (swipeDistance > 0) {
            // Swipe left - next slide
            slideCarousel(1);
        } else {
            // Swipe right - previous slide
            slideCarousel(-1);
        }
    }

    isSwiping = false;
}

// Page Transition Functions
function createTransitionOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'page-transition';
    overlay.innerHTML = '<div class="loading-text">LIGERO</div>';
    document.body.appendChild(overlay);
    return overlay;
}

function showPageTransition() {
    const overlay = document.querySelector('.page-transition') || createTransitionOverlay();
    overlay.classList.add('active');
    return overlay;
}

function hidePageTransition() {
    const overlay = document.querySelector('.page-transition');
    if (overlay) {
        overlay.classList.remove('active');
        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        }, 500);
    }
}

function handleHomePageTransition(url) {
    const overlay = showPageTransition();

    // Shorter delay for navigation to home page (not initial load)
    setTimeout(() => {
        window.location.href = url;
    }, 800);
}

function handleSimplePageTransition(url) {
    // Just fade out and navigate - no overlay
    document.body.style.opacity = '0.3';
    setTimeout(() => {
        window.location.href = url;
    }, 150);
}

function isHomePage(url) {
    // Check if the URL is for the home page
    return url === '/' || url === '/index.html' || url.includes('index.html');
}

function setupPageTransitions() {
    // Get all navigation links that should have transitions
    const logoLinks = document.querySelectorAll('.logo');
    const homeLinks = document.querySelectorAll('a[href="/"], a[href="/index.html"], a[href*="index.html"]');
    const otherLinks = document.querySelectorAll(`
        .nav-item:not([href="/"]):not([href="/index.html"]):not([href*="index.html"]),
        .mobile-menu-item:not([href="/"]):not([href="/index.html"]):not([href*="index.html"]),
        .service-card,
        .choose-button:not([href="/"]):not([href="/index.html"]):not([href*="index.html"]),
        .back-link
    `);

    // Home page transitions (with overlay)
    [...logoLinks, ...homeLinks].forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');

            if (href && href.startsWith('/') && !href.startsWith('//')) {
                e.preventDefault();
                handleHomePageTransition(href);
            }
        });
    });

    // Other page transitions (simple fade)
    otherLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');

            if (href && href.startsWith('/') && !href.startsWith('//')) {
                e.preventDefault();
                handleSimplePageTransition(href);
            }
        });
    });
}

function initPageLoad() {
    // Check if this is a fresh page load (not from navigation)
    const isInitialLoad = !window.performance || performance.navigation.type === 0;

    if (isInitialLoad) {
        // Overlay should already exist from immediate script
        const overlay = document.querySelector('.page-transition');

        // Keep overlay visible for 1.8 seconds total, then fade out
        setTimeout(() => {
            if (overlay) {
                hidePageTransition();
            }
        }, 1800);

        // Start page content animations after overlay begins to fade
        setTimeout(() => {
            document.body.classList.add('page-loaded');
        }, 1600);

        setTimeout(() => {
            document.body.classList.add('content-loaded');
        }, 1900);
    } else {
        // For navigation between pages, just do quick animations
        setTimeout(() => {
            document.body.classList.add('page-loaded');
        }, 100);

        setTimeout(() => {
            document.body.classList.add('content-loaded');
        }, 300);
    }
}

// Apply theme on page load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize page transitions first
    initPageLoad();
    setupPageTransitions();

    // Try to load saved theme
    try {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'white') {
            document.body.classList.add('white-theme');
        } else {
            document.body.classList.remove('white-theme');
        }
    } catch (e) {
        // localStorage not available, use default theme
    }

    // Initialize carousel only if it exists on this page and not on mobile
    const carousel = document.getElementById('carousel');
    if (carousel) {
        if (!isMobile()) {
            carousel.style.transition = 'transform 0.3s ease';
            console.log('Carousel found and initialized for desktop');

            // Add touch event listeners for desktop swiping
            carousel.addEventListener('touchstart', handleTouchStart, { passive: true });
            carousel.addEventListener('touchmove', handleTouchMove, { passive: false });
            carousel.addEventListener('touchend', handleTouchEnd, { passive: true });
        } else {
            // Reset any transform on mobile
            carousel.style.transform = 'none';
            carousel.style.transition = 'none';
            console.log('Mobile detected - carousel converted to vertical scroll');
        }

        // Check if cards exist
        const cards = carousel.querySelectorAll('.service-card');
        console.log(`Found ${cards.length} service cards`);
        cards.forEach((card, index) => {
            console.log(`Card ${index}:`, card.textContent);
        });
    }

    // Setup hamburger menu functionality
    const hamburger = document.querySelector('.hamburger-menu');
    if (hamburger) {
        hamburger.addEventListener('click', toggleMobileMenu);
    }

    // Setup mobile menu item click handlers (transitions handle the navigation)
    const mobileMenuItems = document.querySelectorAll('.mobile-menu-item');
    mobileMenuItems.forEach(item => {
        item.addEventListener('click', () => {
            // Close menu after transition starts
            setTimeout(() => {
                closeMobileMenu();
            }, 100);
        });
    });

    // Close mobile menu when clicking overlay
    const mobileMenuOverlay = document.querySelector('.mobile-menu-overlay');
    if (mobileMenuOverlay) {
        mobileMenuOverlay.addEventListener('click', (e) => {
            if (e.target === mobileMenuOverlay) {
                closeMobileMenu();
            }
        });
    }

    // Ensure the current page content is visible
    const homePage = document.getElementById('home-page');
    const servicesPage = document.getElementById('services-page');
    const shopPage = document.querySelector('.shop-page');
    const policiesPage = document.getElementById('policies-page');

    if (homePage) {
        homePage.style.display = 'flex';
    }
    if (servicesPage) {
        servicesPage.style.display = 'block';
        servicesPage.classList.add('active');
    }
    if (shopPage) {
        shopPage.style.display = 'block';
    }
    if (policiesPage) {
        policiesPage.style.display = 'block';
    }

    // Reset carousel position for desktop
    if (!isMobile()) {
        resetCarousel();
    }

    // Add window resize listener
    window.addEventListener('resize', handleResize);

    // Setup theme switcher event listeners
    const whiteThemeCircle = document.querySelector('.theme-circle.white');
    const blackThemeCircle = document.querySelector('.theme-circle.black');

    if (whiteThemeCircle) {
        whiteThemeCircle.onclick = () => setTheme('white');
    }

    if (blackThemeCircle) {
        blackThemeCircle.onclick = () => setTheme('black');
    }

    // Handle navigation clicks for mobile (transitions now handle this)
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            // Add a small delay to prevent rapid clicking on mobile
            e.target.style.pointerEvents = 'none';
            setTimeout(() => {
                e.target.style.pointerEvents = 'auto';
            }, 300);
        });
    });
});