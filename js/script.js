let currentSlide = 0;
let isNavigating = false;
let navigationTimeout = null;
let lastNavigationTime = 0;

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

// ROBUST: Reset navigation state
function resetNavigationState() {
    isNavigating = false;
    lastNavigationTime = 0;

    if (navigationTimeout) {
        clearTimeout(navigationTimeout);
        navigationTimeout = null;
    }

    document.body.style.opacity = '';
    document.body.style.pointerEvents = '';

    console.log('Navigation state reset');
}

// Reset page state when navigating back/forward
function resetPageState() {
    resetNavigationState();

    // Remove any leftover transition overlays
    const existingOverlays = document.querySelectorAll('.page-transition');
    existingOverlays.forEach(overlay => {
        if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
    });

    document.body.classList.add('page-loaded');
    document.body.classList.add('content-loaded');
    document.body.style.overflow = '';

    closeMobileMenu();

    // IMPORTANT: Reset carousel positioning
    resetCarousel();

    console.log('Page state reset for back/forward navigation');
}

// Listen for browser back/forward navigation
window.addEventListener('pageshow', function(event) {
    // This fires when page is shown, including back/forward navigation
    if (event.persisted) {
        // Page was restored from cache (back/forward navigation)
        console.log('Page restored from cache - resetting state');
        resetPageState();

        // Reinitialize page-specific functionality
        setTimeout(() => {
            initPageSpecificFeatures();
        }, 50);
    }
});

// Also listen for popstate (back/forward button)
window.addEventListener('popstate', function(event) {
    console.log('Popstate event - resetting state');
    resetPageState();
});

// Function to reinitialize page-specific features after back navigation
function initPageSpecificFeatures() {
    // Reset carousel if on services page
    const carousel = document.getElementById('carousel');
    if (carousel && !isMobile()) {
        resetCarousel();
        // Re-test carousel reach
        setTimeout(() => {
            testCarouselReach();
        }, 100);
    }

    // Ensure theme is applied correctly
    try {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'white') {
            document.body.classList.add('white-theme');
        } else {
            document.body.classList.remove('white-theme');
        }
    } catch (e) {
        // localStorage not available
    }
}

// ROBUST: Emergency cleanup function
function emergencyCleanup() {
    console.log('Emergency cleanup triggered');
    resetNavigationState();

    // Remove all overlays
    const overlays = document.querySelectorAll('.page-transition');
    overlays.forEach(overlay => {
        if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
    });

    // Reset body state
    document.body.style.opacity = '1';
    document.body.style.pointerEvents = 'auto';
    document.body.classList.add('page-loaded');
    document.body.classList.add('content-loaded');
}

// Emergency cleanup if navigation gets stuck
setInterval(() => {
    if (isNavigating && Date.now() - lastNavigationTime > 5000) {
        console.warn('Navigation appears stuck, cleaning up...');
        emergencyCleanup();
    }
}, 1000);

// Add beforeunload listener to clean up state
window.addEventListener('beforeunload', function() {
    // Reset state before leaving page
    resetNavigationState();
});

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

// Check if we're currently on the home page
function isOnHomePage() {
    return window.location.pathname === '/' ||
        window.location.pathname.endsWith('index.html') ||
        window.location.pathname === '' ||
        document.getElementById('home-page') !== null;
}

// DYNAMIC: Get carousel settings - automatically calculates card dimensions
function getCarouselSettings() {
    // For mobile, return default values (not used since it's vertical scroll)
    if (isMobile()) {
        return {
            cardWidth: 280,
            cardGap: 20,
            containerPadding: 120
        };
    }

    // For desktop: get the actual rendered card width dynamically
    const carousel = document.getElementById('carousel');
    if (carousel) {
        const firstCard = carousel.querySelector('.service-card');
        if (firstCard) {
            // Get the actual computed width of the card
            const computedStyle = window.getComputedStyle(firstCard);
            const actualCardWidth = parseFloat(computedStyle.width);

            // Get the gap from CSS
            const carouselStyle = window.getComputedStyle(carousel);
            const gapProperty = carouselStyle.gap;
            let actualGap = 30; // default fallback

            if (gapProperty && gapProperty !== 'normal') {
                if (gapProperty.includes('vw')) {
                    // Convert vw to pixels
                    const vwValue = parseFloat(gapProperty);
                    actualGap = (vwValue / 100) * window.innerWidth;
                } else {
                    actualGap = parseFloat(gapProperty) || 30;
                }
            }

            return {
                cardWidth: actualCardWidth,
                cardGap: actualGap,
                containerPadding: 160  // Space for arrows
            };
        }
    }

    // Fallback calculation if carousel not found
    return {
        cardWidth: window.innerWidth * 0.28, // 28% of screen width (matches CSS)
        cardGap: window.innerWidth * 0.02,   // 2% of screen width (matches CSS)
        containerPadding: 160
    };
}

function setupCarouselKeyboardNavigation() {
    if (isMobile()) return;

    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
            slideCarousel(-1);
        } else if (e.key === 'ArrowRight') {
            slideCarousel(1);
        }
    });
}

// DYNAMIC: Improved carousel sliding logic - works with any card size
function slideCarousel(direction) {
    // Immediately return on mobile - no carousel sliding
    if (isMobile()) {
        console.log('Carousel sliding disabled on mobile');
        return;
    }

    const carousel = document.getElementById('carousel');
    if (!carousel) {
        console.error('Carousel element not found!');
        return;
    }

    // Rest of your existing slideCarousel logic...
    const cards = carousel.querySelectorAll('.service-card');
    const totalCards = cards.length;

    if (totalCards === 0) {
        console.error('No service cards found!');
        return;
    }

    const settings = getCarouselSettings();
    const { cardWidth, cardGap, containerPadding } = settings;
    const containerWidth = window.innerWidth - containerPadding;
    const cardWithGap = cardWidth + cardGap;
    const cardsVisible = Math.max(1, Math.floor(containerWidth / cardWithGap));
    const maxSlide = Math.max(0, totalCards - cardsVisible);

    currentSlide += direction;

    if (currentSlide < 0) {
        currentSlide = 0;
    }
    if (currentSlide > maxSlide) {
        currentSlide = maxSlide;
    }

    let translateX;

    if (currentSlide === 0) {
        translateX = 0;
    } else if (currentSlide >= maxSlide) {
        const totalContentWidth = (totalCards * cardWidth) + ((totalCards - 1) * cardGap);
        const availableContentWidth = containerWidth;

        if (totalContentWidth > availableContentWidth) {
            translateX = -(totalContentWidth - availableContentWidth);
        } else {
            translateX = 0;
        }
    } else {
        translateX = -(currentSlide * cardWithGap);
    }

    carousel.style.transform = `translateX(${translateX}px)`;
}

// FIXED: Reset carousel when window is resized - don't reset during navigation
function resetCarousel() {
    // Don't reset carousel if we're currently navigating
    if (isNavigating) return;

    currentSlide = 0;
    const carousel = document.getElementById('carousel');
    if (carousel) {
        if (!isMobile()) {
            // Desktop: apply normal transform
            carousel.style.transform = 'translateX(0px)';
            carousel.style.transition = 'transform 0.3s ease';
            console.log('Carousel reset to initial position (desktop)');
        } else {
            // Mobile: completely remove all transforms and positioning
            carousel.style.transform = 'none';
            carousel.style.transition = 'none';
            carousel.style.position = 'static';
            carousel.style.top = 'auto';
            carousel.style.left = 'auto';
            carousel.style.right = 'auto';
            carousel.style.bottom = 'auto';

            // Also reset any positioning on individual cards
            const cards = carousel.querySelectorAll('.service-card');
            cards.forEach(card => {
                card.style.transform = 'none';
                card.style.position = 'relative';
                card.style.top = 'auto';
                card.style.left = 'auto';
                card.style.right = 'auto';
                card.style.bottom = 'auto';
            });

            console.log('Carousel reset for mobile (all transforms removed)');
        }
    }
}

// Handle window resize
let resizeTimeout;
function handleResize() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        // Always reset carousel when resizing (but not during navigation)
        resetCarousel();

        // Close mobile menu if screen becomes large
        if (window.innerWidth > 768) {
            closeMobileMenu();
        }

        // Re-test carousel after resize (desktop only)
        if (!isMobile()) {
            setTimeout(() => {
                testCarouselReach();
            }, 100);
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

function showInitialLoading() {
    // Create and show initial loading overlay
    const overlay = createTransitionOverlay();
    overlay.classList.add('active');

    // Hide after 1.8 seconds
    setTimeout(() => {
        overlay.classList.remove('active');
        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        }, 600);
    }, 1800);

    return overlay;
}

function showNavigationTransition() {
    // Create overlay for navigation to home page
    const overlay = createTransitionOverlay();
    overlay.classList.add('active');

    // Hide after shorter duration for navigation
    setTimeout(() => {
        overlay.classList.remove('active');
        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        }, 600);
    }, 800);

    return overlay;
}

// ROBUST: Navigation functions with proper error handling
function handleSimplePageTransition(url) {
    // ROBUST: Prevent rapid navigation and race conditions
    const now = Date.now();
    if (isNavigating || (now - lastNavigationTime < 300)) {
        console.log('Navigation blocked - too rapid or already navigating');
        return;
    }

    isNavigating = true;
    lastNavigationTime = now;

    console.log(`Simple transition to: ${url}`);

    try {
        // Just fade out and navigate - no overlay
        document.body.style.opacity = '0.3';
        document.body.style.pointerEvents = 'none';

        navigationTimeout = setTimeout(() => {
            window.location.href = url;
        }, 150);

    } catch (error) {
        console.error('Error during simple transition:', error);
        emergencyCleanup();
    }
}

function handleHomePageTransition(url) {
    // ROBUST: Prevent rapid navigation and race conditions
    const now = Date.now();
    if (isNavigating || (now - lastNavigationTime < 300)) {
        console.log('Home navigation blocked - too rapid or already navigating');
        return;
    }

    isNavigating = true;
    lastNavigationTime = now;

    console.log(`Home transition to: ${url}`);

    try {
        // Show navigation overlay for home page
        showNavigationTransition();
        document.body.style.pointerEvents = 'none';

        // Navigate with slight delay to show overlay
        navigationTimeout = setTimeout(() => {
            window.location.href = url;
        }, 200);

    } catch (error) {
        console.error('Error during home transition:', error);
        emergencyCleanup();
    }
}

// ROBUST: Navigation setup with comprehensive error handling
function setupPageTransitions() {
    // Handle ALL links with href attributes that start with "/"
    document.addEventListener('click', (e) => {
        try {
            const target = e.target.closest('a[href]');
            if (!target) return;

            const href = target.getAttribute('href');
            if (!href || !href.startsWith('/') || href.startsWith('//')) return;

            // FIXED: Don't prevent default for service cards initially - let us handle it
            const isServiceCard = target.classList.contains('service-card');

            // If it's a service card, don't reset carousel during navigation
            if (isServiceCard) {
                console.log('Service card clicked - preventing carousel reset');
            }

            // Prevent default navigation
            e.preventDefault();
            e.stopPropagation();

            // If navigating while already navigating, ignore
            if (isNavigating) {
                console.log('Already navigating - ignoring click');
                return;
            }

            // Check if it's a logo link
            const isLogo = target.classList.contains('logo');

            // Check if it's going to home page
            const isGoingHome = href === '/' || href.endsWith('index.html') || href === '';

            // Logo clicks - special handling
            if (isLogo) {
                // If we're already on the home page, do nothing
                if (isOnHomePage() && isGoingHome) {
                    console.log('Already on home page - no navigation needed');
                    return;
                }

                // If going to home page from another page, show transition
                if (isGoingHome) {
                    handleHomePageTransition(href);
                    return;
                }
            }

            // Mobile home menu links
            if (target.classList.contains('mobile-menu-item') && isGoingHome) {
                // If we're already on the home page, just close menu
                if (isOnHomePage()) {
                    closeMobileMenu();
                    return;
                }
                handleHomePageTransition(href);
                return;
            }

            // CHOOSE button - special handling for home navigation
            if (target.classList.contains('choose-button') && isGoingHome) {
                handleHomePageTransition(href);
                return;
            }

            // All other navigation - simple fade
            handleSimplePageTransition(href);

        } catch (error) {
            console.error('Error in navigation click handler:', error);
            emergencyCleanup();
        }
    });
}

function initPageLoad() {
    try {
        // Only show loading screen on the very first visit to the website
        // Check if user has visited before using sessionStorage
        const hasVisitedBefore = sessionStorage.getItem('hasVisited');
        const isHomePage = isOnHomePage();

        // Show loading screen only if:
        // 1. User hasn't visited before AND it's the home page, OR
        // 2. User is coming from external site to any page
        const shouldShowLoading = (!hasVisitedBefore && isHomePage) ||
            (!document.referrer || !document.referrer.includes(window.location.hostname));

        if (shouldShowLoading && !document.querySelector('.page-transition')) {
            // Mark that user has visited
            sessionStorage.setItem('hasVisited', 'true');

            // Show initial loading animation
            showInitialLoading();

            // Start page content animations after overlay begins to fade
            setTimeout(() => {
                document.body.classList.add('page-loaded');
            }, 1600);

            setTimeout(() => {
                document.body.classList.add('content-loaded');
            }, 1900);
        } else {
            // For all other navigation, just do quick animations
            setTimeout(() => {
                document.body.classList.add('page-loaded');
            }, 100);

            setTimeout(() => {
                document.body.classList.add('content-loaded');
            }, 300);
        }
    } catch (error) {
        console.error('Error in page load initialization:', error);
        // Fallback - just show the page
        document.body.classList.add('page-loaded');
        document.body.classList.add('content-loaded');
    }
}

// ENHANCED: Dynamic carousel testing function
function testCarouselReach() {
    if (isMobile()) {
        console.log('📱 Mobile mode - vertical scrolling enabled');
        return;
    }

    const carousel = document.getElementById('carousel');
    if (!carousel) {
        console.log('Carousel not found on this page');
        return;
    }

    const cards = carousel.querySelectorAll('.service-card');
    if (cards.length === 0) {
        console.log('No service cards found');
        return;
    }

    const settings = getCarouselSettings();
    const { cardWidth, cardGap, containerPadding } = settings;
    const containerWidth = window.innerWidth - containerPadding;
    const cardWithGap = cardWidth + cardGap;
    const cardsVisible = Math.max(1, Math.floor(containerWidth / cardWithGap));
    const maxSlides = Math.max(0, cards.length - cardsVisible);

    console.log('=== RESPONSIVE CAROUSEL TEST ===');
    console.log(`🖥️  Screen: ${window.innerWidth}px wide`);
    console.log(`📏 Card size: ${cardWidth.toFixed(1)}px (${((cardWidth/window.innerWidth)*100).toFixed(1)}% of screen)`);
    console.log(`📐 Gap: ${cardGap.toFixed(1)}px`);
    console.log(`🎯 Container: ${containerWidth}px available`);
    console.log(`👀 Visible cards: ${cardsVisible} out of ${cards.length} total`);

    if (maxSlides === 0) {
        console.log('✅ All cards fit on screen - no scrolling needed');
    } else {
        console.log(`➡️  Need ${maxSlides} scroll actions to see all cards`);
    }

    console.log('\n📋 All service cards:');
    cards.forEach((card, index) => {
        const title = card.querySelector('.service-card-title')?.textContent || `Card ${index + 1}`;
        console.log(`${index + 1}. ${title}`);
    });

    if (maxSlides > 0) {
        console.log('\n🎬 Preview of slide positions:');
        // Show what will be visible at each slide position
        for (let slide = 0; slide <= Math.min(maxSlides, 2); slide++) {
            const startCard = slide;
            const endCard = Math.min(startCard + cardsVisible - 1, cards.length - 1);
            const visibleTitles = [];

            for (let i = startCard; i <= endCard; i++) {
                const title = cards[i].querySelector('.service-card-title')?.textContent || `Card ${i + 1}`;
                visibleTitles.push(title);
            }

            console.log(`Slide ${slide}: Cards ${startCard + 1}-${endCard + 1} (${visibleTitles.join(', ')})`);
        }
        if (maxSlides > 2) {
            console.log(`... and ${maxSlides - 2} more slide positions`);
        }
    }

    console.log('\n🎮 Use arrow buttons or keyboard arrows to scroll');
    console.log('🔄 Cards resize automatically with screen size');
    console.log('================================');
}

// ORIGINAL: Service Card Hover Video Preview (for Set Designing card) - RESTORED
function setupServiceCardHoverPreviews() {
    const setDesignCard = document.querySelector('a[href="/services/set-designing"]');
    if (!setDesignCard) return;

    const video = setDesignCard.querySelector('.service-card-video');
    if (!video) return;

    const clips = [
        { src: '/videos/gift.mp4', start: 6, duration: 3 },
        { src: '/videos/fashion.mp4', start: 10, duration: 3 },
        { src: '/videos/brand.mp4', start: 3, duration: 3 }
    ];
    let currentClipIndex = 0;
    let hoverInterval;

    function playClip(index) {
        const clip = clips[index];
        video.src = clip.src;
        video.currentTime = clip.start;

        video.play().catch(err => {
            console.error('Autoplay prevented:', err);
        });

        hoverInterval = setTimeout(() => {
            currentClipIndex = (currentClipIndex + 1) % clips.length;
            playClip(currentClipIndex);
        }, clip.duration * 1000);
    }

    setDesignCard.addEventListener('mouseenter', () => {
        clearTimeout(hoverInterval);
        currentClipIndex = 0; // Reset to the first clip
        playClip(currentClipIndex);
    });

    setDesignCard.addEventListener('mouseleave', () => {
        clearTimeout(hoverInterval);
        video.pause();
        video.currentTime = 0;
        video.src = ''; // Clear the video source
    });
}

// NEW: Individual video looping functionality
function setupIndividualVideoLooping() {
    console.log('🎬 Setting up individual video looping...');

    // Video configurations by ID - INCLUDING ASHLEIGH'S VIDEOS
    const videoSettings = {
        // Ifeoluwa's videos (existing)
        'gift-video': { start: 6, duration: 8 },
        'fashion-video': { start: 10, duration: 8 },
        'brand-video': { start: 3, duration: 8 },

        // Ashleigh's videos (new)
        'gabzy-video': { start: 5, duration: 8 },
        'grime-video': { start: 3, duration: 8 },
        'note-video': { start: 2, duration: 8 },
        'reem-video': { start: 4, duration: 8 }
    };

    // Apply settings to each video
    Object.keys(videoSettings).forEach(videoId => {
        const video = document.getElementById(videoId);
        if (!video) {
            console.log(`❌ Video with ID '${videoId}' not found`);
            return;
        }

        const settings = videoSettings[videoId];
        console.log(`✅ Setting up ${videoId}: start=${settings.start}s, duration=${settings.duration}s`);

        // Set initial time when video loads
        video.addEventListener('loadedmetadata', () => {
            video.currentTime = settings.start;
            console.log(`📊 ${videoId} metadata loaded, set to ${settings.start}s`);
        });

        // Handle looping within the specified duration
        video.addEventListener('timeupdate', () => {
            if (video.currentTime >= settings.start + settings.duration) {
                video.currentTime = settings.start;
                console.log(`🔄 ${videoId} looped back to ${settings.start}s`);
            }
        });

        // Set initial time immediately if already loaded
        if (video.readyState >= 1) {
            video.currentTime = settings.start;
            console.log(`⚡ ${videoId} already loaded, set to ${settings.start}s immediately`);
        }
    });
}

// NEW: Image Loading Fix
function setupImageLoading() {
    const images = document.querySelectorAll('.feed-item img');
    console.log(`🖼️ Setting up loading for ${images.length} images`);

    images.forEach((img, index) => {
        // Check if image is already loaded
        if (img.complete && img.naturalHeight !== 0) {
            img.classList.add('loaded');
            console.log(`✅ Image ${index + 1} already loaded`);
        } else {
            // Add load event listener
            img.addEventListener('load', () => {
                img.classList.add('loaded');
                console.log(`✅ Image ${index + 1} loaded: ${img.src.split('/').pop()}`);
            });

            // Add error handling
            img.addEventListener('error', () => {
                console.error(`❌ Failed to load image ${index + 1}: ${img.src}`);
                // Still show the image container
                img.classList.add('loaded');
            });
        }
    });
}

// ENHANCED: Video autoplay functionality with immediate start
function setupEnhancedFeedVideoAutoplay() {
    const feedVideos = document.querySelectorAll('.feed-video');
    console.log(`🎥 Setting up enhanced autoplay for ${feedVideos.length} videos`);

    // Videos with custom settings (skip enhanced autoplay for these) - UPDATED LIST
    const customVideoIds = [
        'gift-video', 'fashion-video', 'brand-video',  // Ifeoluwa's videos
        'gabzy-video', 'grime-video', 'note-video', 'reem-video'  // Ashleigh's videos
    ];

    // More aggressive intersection observer for immediate playback
    const videoObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const video = entry.target;

            if (entry.isIntersecting && entry.intersectionRatio > 0.1) {
                // Try to play immediately
                video.play().then(() => {
                    console.log(`▶️ Playing video: ${video.src?.split('/').pop()}`);
                }).catch(err => {
                    console.log(`⏸️ Autoplay prevented: ${err.message}`);
                });
            } else {
                video.pause();
                // Only reset to 0 if it's NOT a custom video
                if (!video.id || !customVideoIds.includes(video.id)) {
                    video.currentTime = 0;
                }
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '100px'
    });

    feedVideos.forEach((video, index) => {
        videoObserver.observe(video);

        // Enhanced loop handling - SKIP if this video has custom settings
        if (video.id && customVideoIds.includes(video.id)) {
            console.log(`⚠️ Skipping enhanced autoplay for ${video.id} (using custom settings)`);
            return; // Skip the rest of the setup for this video
        }

        video.addEventListener('loadedmetadata', () => {
            console.log(`📊 Video ${index + 1} metadata loaded (enhanced autoplay)`);

            video.addEventListener('timeupdate', () => {
                // Loop after 4 seconds or full duration if shorter
                const loopTime = Math.min(4, video.duration - 0.5);
                if (video.currentTime >= loopTime) {
                    video.currentTime = 0;
                }
            });
        });

        // Force load video immediately
        video.load();

        // Try immediate autoplay for visible videos
        setTimeout(() => {
            const rect = video.getBoundingClientRect();
            if (rect.top < window.innerHeight && rect.bottom > 0) {
                video.play().catch(() => {
                    console.log('Initial autoplay prevented, will play on scroll');
                });
            }
        }, 100);
    });
}

// for creative directing page

function setupElectraVideoGrid() {
    const electraItems = document.querySelectorAll('.electra-item');

    electraItems.forEach(item => {
        const video = item.querySelector('.electra-video');

        if (video) {
            // Video hover preview
            item.addEventListener('mouseenter', () => {
                video.play().catch(err => {
                    console.log('Preview autoplay prevented:', err);
                });
            });

            item.addEventListener('mouseleave', () => {
                video.pause();
                video.currentTime = 0;
            });

            // Click to open modal
            item.addEventListener('click', (e) => {
                e.preventDefault();

                const videoSrc = item.getAttribute('data-video');
                const title = item.getAttribute('data-title');
                const client = item.getAttribute('data-client');

                if (videoSrc) {
                    openVideoModal(videoSrc, title, client);
                }
            });
        }
    });
}

// =================== FIXED MODAL FUNCTIONS ===================

// Simple Modal Functions
function openVideoModal(videoSrc, title, client) {
    const modal = document.getElementById('videoModal');
    const modalVideo = document.getElementById('modalVideo');
    const modalTitle = document.getElementById('modalTitle');
    const modalClient = document.getElementById('modalClient');

    if (!modal || !modalVideo) {
        console.error('Video modal elements not found');
        return;
    }

    // Set content
    if (modalTitle) modalTitle.textContent = title || 'Video';
    if (modalClient) modalClient.textContent = client || 'Client';

    // Show modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Set video source and enable autoplay
    modalVideo.src = videoSrc;
    modalVideo.load();

    // NEW: Start playing automatically after a brief delay
    setTimeout(() => {
        modalVideo.play().then(() => {
            console.log('Modal video started playing automatically');
        }).catch(err => {
            console.log('Autoplay prevented:', err);
        });
    }, 200);
}

function openImageModal(imageSrc, title, client) {
    const modal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    const imageTitle = document.getElementById('imageTitle');
    const imageProject = document.getElementById('imageProject');

    if (!modal || !modalImage) {
        console.error('Image modal elements not found');
        return;
    }

    // Set image
    modalImage.src = imageSrc;
    modalImage.alt = title || 'Image';

    // Set metadata if elements exist
    if (imageTitle) imageTitle.textContent = title || 'Project Image';
    if (imageProject) imageProject.textContent = client || 'Ligero';

    // Show modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    const videoModal = document.getElementById('videoModal');
    const modalVideo = document.getElementById('modalVideo');

    if (videoModal) {
        videoModal.classList.remove('active');
        document.body.style.overflow = '';
    }

    if (modalVideo) {
        modalVideo.pause();
        modalVideo.currentTime = 0;
        modalVideo.src = '';
    }
}

function closeImageModal() {
    const imageModal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');

    if (imageModal) {
        imageModal.classList.remove('active');
        document.body.style.overflow = '';
    }

    if (modalImage) {
        modalImage.src = '';
    }
}

// Get project info from the page structure
function getProjectInfo(clickedElement) {
    // First check if we're in a dual video item (for Ashleigh's page)
    let dualVideoItem = clickedElement.closest('.dual-video-item');
    if (dualVideoItem) {
        const metadata = dualVideoItem.querySelector('.video-metadata');
        if (metadata) {
            const clientName = metadata.querySelector('.client-name')?.textContent || 'Client';
            const projectTitle = metadata.querySelector('.project-title')?.textContent || 'Project';
            console.log(`📋 Found dual video metadata: ${projectTitle} - ${clientName}`);
            return { title: projectTitle, client: clientName };
        }
    }

    // Check if we're clicking on an image in an images-grid
    let imagesGrid = clickedElement.closest('.images-grid');
    if (imagesGrid) {
        console.log(`📋 Clicked on image in images-grid, looking for preceding video section...`);

        // Find the video section that comes IMMEDIATELY BEFORE this images grid
        let previousElement = imagesGrid.previousElementSibling;
        while (previousElement) {
            if (previousElement.classList && previousElement.classList.contains('video-section')) {
                const metadata = previousElement.querySelector('.video-metadata');
                if (metadata) {
                    const clientName = metadata.querySelector('.client-name')?.textContent || 'Client';
                    const projectTitle = metadata.querySelector('.project-title')?.textContent || 'Project';
                    console.log(`📋 Found correct preceding video metadata for image: ${projectTitle} - ${clientName}`);
                    return { title: projectTitle, client: clientName };
                }
                break; // Stop at the first video section we find
            }
            previousElement = previousElement.previousElementSibling;
        }

        console.log(`📋 Warning: No video section found before images grid`);
    }

    // For video clicks - check if we're in a regular video-section
    let videoSection = clickedElement.closest('.video-section');
    if (videoSection) {
        const metadata = videoSection.querySelector('.video-metadata');
        if (metadata) {
            const clientName = metadata.querySelector('.client-name')?.textContent || 'Client';
            const projectTitle = metadata.querySelector('.project-title')?.textContent || 'Project';
            console.log(`📋 Found video section metadata: ${projectTitle} - ${clientName}`);
            return { title: projectTitle, client: clientName };
        }
    }

    // Fallback - try to get from data attributes on the video container itself
    const videoContainer = clickedElement.closest('.video-container-main');
    if (videoContainer) {
        const title = videoContainer.getAttribute('data-title');
        const client = videoContainer.getAttribute('data-client');
        if (title && client) {
            console.log(`📋 Found data attribute metadata: ${title} - ${client}`);
            return { title: title, client: client };
        }
    }

    console.log(`📋 No metadata found, using defaults`);
    return { title: 'Project Image', client: 'Ligero' };
}

// Setup click handlers
function setupModalClicks() {
    // Video clicks
    const videoContainers = document.querySelectorAll('.video-container-main');
    videoContainers.forEach(container => {
        container.addEventListener('click', function(e) {
            e.preventDefault();

            // Get video source from data attribute or video element
            let videoSrc = container.getAttribute('data-video');
            if (!videoSrc) {
                const videoElement = container.querySelector('video source');
                if (videoElement) {
                    videoSrc = videoElement.getAttribute('src');
                }
            }

            if (videoSrc) {
                const projectInfo = getProjectInfo(container);
                openVideoModal(videoSrc, projectInfo.title, projectInfo.client);
            }
        });
    });

    // Image clicks
    const imageItems = document.querySelectorAll('.feed-item img');
    imageItems.forEach(img => {
        img.parentElement.addEventListener('click', function(e) {
            e.preventDefault();

            const imageSrc = img.getAttribute('src');
            if (imageSrc) {
                const projectInfo = getProjectInfo(img);
                openImageModal(imageSrc, projectInfo.title, projectInfo.client);
            }
        });
    });

    // Alternative: if images have data-image attribute on parent
    const imageContainers = document.querySelectorAll('[data-image]');
    imageContainers.forEach(container => {
        container.addEventListener('click', function(e) {
            e.preventDefault();

            const imageSrc = container.getAttribute('data-image');
            if (imageSrc) {
                const projectInfo = getProjectInfo(container);
                openImageModal(imageSrc, projectInfo.title, projectInfo.client);
            }
        });
    });
}

// Setup modal close handlers
function setupModalCloseHandlers() {
    // Close buttons
    const videoCloseBtn = document.querySelector('#videoModal .modal-close');
    const imageCloseBtn = document.querySelector('#imageModal .modal-close');

    if (videoCloseBtn) {
        videoCloseBtn.addEventListener('click', closeModal);
    }

    if (imageCloseBtn) {
        imageCloseBtn.addEventListener('click', closeImageModal);
    }

    // Click outside to close
    const videoModal = document.getElementById('videoModal');
    const imageModal = document.getElementById('imageModal');

    if (videoModal) {
        const backdrop = videoModal.querySelector('.modal-backdrop');
        if (backdrop) {
            backdrop.addEventListener('click', closeModal);
        }
    }

    if (imageModal) {
        const backdrop = imageModal.querySelector('.modal-backdrop');
        if (backdrop) {
            backdrop.addEventListener('click', closeImageModal);
        }
    }

    // Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeModal();
            closeImageModal();
        }
    });
}

// Initialize modals when page loads
function initializeModals() {
    setupModalClicks();
    setupModalCloseHandlers();
    console.log('✅ Modals initialized');
}

// ================== YOUTUBE FALLBACK SYSTEM ==================

// Video fallback configurations
const videoFallbacks = {
    'gabzy-video': {
        youtubeUrl: 'https://www.youtube.com/embed/jUsE4hcoS2c?start=1',
        title: 'King Promise, GABZY / "PERFECT COMBI"',
        message: 'High-quality video not supported on this device. Playing YouTube version.'
    }
};

// Setup video fallback system
function setupVideoFallbacks() {
    Object.keys(videoFallbacks).forEach(videoId => {
        const video = document.getElementById(videoId);
        if (!video) return;

        const config = videoFallbacks[videoId];
        let fallbackTriggered = false;

        // Create fallback function
        function triggerFallback() {
            if (fallbackTriggered) return;
            fallbackTriggered = true;

            console.log(`🔄 Triggering YouTube fallback for ${videoId}`);

            // Get the video container
            const videoContainer = video.closest('.video-container-main');
            if (!videoContainer) return;

            // Create YouTube fallback HTML
            const fallbackHTML = `
                <div class="youtube-fallback-container">
                    <div class="compatibility-message">
                        <div class="compatibility-icon">⚠️</div>
                        <div class="compatibility-text">${config.message}</div>
                    </div>
                    <iframe 
                        class="youtube-fallback-iframe"
                        src="${config.youtubeUrl}&autoplay=0&mute=1&controls=1&rel=0"
                        title="${config.title}"
                        frameborder="0"
                        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowfullscreen>
                    </iframe>
                </div>
            `;

            // Replace video content with YouTube fallback
            videoContainer.innerHTML = fallbackHTML;

            // Remove video overlay since we're using YouTube now
            const overlay = videoContainer.querySelector('.video-overlay');
            if (overlay) overlay.remove();
        }

        // Listen for video errors
        video.addEventListener('error', () => {
            console.log(`❌ Video error detected for ${videoId}`);
            triggerFallback();
        });

        // Listen for load errors
        video.addEventListener('loadstart', () => {
            // Set a timeout to detect if video never loads
            setTimeout(() => {
                if (video.readyState === 0 || video.networkState === 3) {
                    console.log(`⏱️ Video timeout detected for ${videoId}`);
                    triggerFallback();
                }
            }, 5000); // 5 second timeout
        });

        // Check if video can play through
        video.addEventListener('canplay', () => {
            console.log(`✅ Video ${videoId} can play normally`);
        });

        // Detect if video fails to start playing
        const originalPlay = video.play;
        video.play = function() {
            const playPromise = originalPlay.call(this);
            if (playPromise && playPromise.catch) {
                playPromise.catch(error => {
                    console.log(`🚫 Video play failed for ${videoId}:`, error);
                    triggerFallback();
                });
            }
            return playPromise;
        };
    });
}

// Initialize fallback system when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Add a small delay to ensure videos are initialized
    setTimeout(() => {
        setupVideoFallbacks();
        console.log('🛡️ Video fallback system initialized');
    }, 1000);
});



// ROBUST: Apply theme and initialize everything
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('🚀 Initializing Ligero website...');

        // FIRST: Reset any problematic states
        resetPageState();

        // Initialize page transitions
        initPageLoad();
        setupPageTransitions();

        // Apply theme
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

        // FIXED: Initialize carousel with proper mobile handling
        const carousel = document.getElementById('carousel');
        if (carousel) {
            // Always reset first
            resetCarousel();

            if (!isMobile()) {
                // Desktop setup
                console.log('🎠 Dynamic responsive carousel initialized for desktop');
                setupCarouselKeyboardNavigation();

                carousel.addEventListener('touchstart', handleTouchStart, { passive: true });
                carousel.addEventListener('touchmove', handleTouchMove, { passive: false });
                carousel.addEventListener('touchend', handleTouchEnd, { passive: true });

                // Setup hover previews for service cards (ORIGINAL FUNCTION)
                setupServiceCardHoverPreviews();

                setTimeout(() => {
                    testCarouselReach();
                }, 200);
            } else {
                // Mobile setup - ensure clean state
                console.log('📱 Mobile detected - ensuring clean carousel state');

                // Force clean mobile state
                setTimeout(() => {
                    resetCarousel();
                }, 100);
            }
        }

        // NEW: Setup individual video looping
        setupIndividualVideoLooping();

        // Setup hamburger menu functionality
        const hamburger = document.querySelector('.hamburger-menu');
        if (hamburger) {
            hamburger.addEventListener('click', toggleMobileMenu);
        }

        // Setup mobile menu item click handlers
        const mobileMenuItems = document.querySelectorAll('.mobile-menu-item');
        mobileMenuItems.forEach(item => {
            item.addEventListener('click', () => {
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

        // Initialize CMNPPL-style pages with modal
        if (document.querySelector('.set-design-feed') || document.querySelector('.designer-profile-page') || document.querySelector('.electra-style-page')) {
            console.log('🎯 CMNPPL/Electra page detected, initializing...');

            setTimeout(() => {
                setupImageLoading();

                setupEnhancedFeedVideoAutoplay();

                initializeModals();

                if (document.querySelector('.electra-style-page')) {
                    setupElectraVideoGrid();
                    console.log('✅ Electra video grid initialized');
                }
            }, 100);
        }

        // Initialize contact page if we're on that page
        if (document.querySelector('.contact-page')) {
            initContactPage();
        }

        // Initialize coming soon page if we're on that page
        if (document.querySelector('.coming-soon-page')) {
            initComingSoonPage();
        }

        console.log('✅ Ligero website initialized successfully');

    } catch (error) {
        console.error('Error during initialization:', error);
        emergencyCleanup();
    }
});

// ROBUST: Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        // Page became visible again, ensure clean state
        if (isNavigating && Date.now() - lastNavigationTime > 3000) {
            console.log('Page visible - cleaning up stuck navigation');
            emergencyCleanup();
        }
    }
});

window.addEventListener('pageshow', function(event) {
    if (event.persisted) {
        console.log('Page restored from cache - resetting state');
        resetPageState();

        setTimeout(() => {
            initPageSpecificFeatures();
        }, 50);
    }
});

window.addEventListener('popstate', function(event) {
    console.log('Popstate event - resetting state');
    resetPageState();
});

// Video controls functionality with mobile autoplay fix
document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('bgVideo');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const muteBtn = document.getElementById('muteBtn');
    const playPauseIcon = document.getElementById('playPauseIcon');
    const muteIcon = document.getElementById('muteIcon');

    if (video && playPauseBtn && muteBtn) {

        // Mobile autoplay fix - try to play on any user interaction
        function tryAutoplay() {
            video.play().then(() => {
                console.log('Video started playing');
                playPauseIcon.src = '/images/pause-icon.png';
            }).catch((error) => {
                console.log('Autoplay prevented:', error);
                playPauseIcon.src = '/images/play-icon.png';
            });
        }

        // Try autoplay on page load
        setTimeout(tryAutoplay, 100);

        // Also try on first user interaction
        document.addEventListener('touchstart', tryAutoplay, { once: true });
        document.addEventListener('click', tryAutoplay, { once: true });

        // Play/Pause functionality
        playPauseBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering the autoplay listener
            if (video.paused) {
                video.play();
                playPauseIcon.src = '/images/pause-icon.png';
                playPauseIcon.alt = 'Pause';
            } else {
                video.pause();
                playPauseIcon.src = '/images/play-icon.png';
                playPauseIcon.alt = 'Play';
            }
        });

        // Mute/Unmute functionality
        muteBtn.addEventListener('click', () => {
            if (video.muted) {
                video.muted = false;
                muteIcon.src = '/images/sound-on-icon.png';
                muteIcon.alt = 'Sound On';
            } else {
                video.muted = true;
                muteIcon.src = '/images/sound-off-icon.png';
                muteIcon.alt = 'Sound Off';
            }
        });

        // Handle video events
        video.addEventListener('play', () => {
            playPauseIcon.src = '/images/pause-icon.png';
        });

        video.addEventListener('pause', () => {
            playPauseIcon.src = '/images/play-icon.png';
        });

        // Handle when video can play
        video.addEventListener('canplaythrough', () => {
            tryAutoplay();
        });
    }
});

// ================== CONTACT PAGE FUNCTIONALITY ==================

// Initialize contact page functionality
function initContactPage() {
    const contactForm = document.getElementById('contactForm');
    const contactFormSection = document.getElementById('contactFormSection');
    const thankYouSection = document.getElementById('thankYouSection');

    if (contactForm) {
        contactForm.addEventListener('submit', handleContactFormSubmission);
    }

    // Pre-fill service field if coming from a specific service page
    preSelectService();
}

// Handle contact form submission
function handleContactFormSubmission(e) {
    e.preventDefault();

    const form = e.target;
    const submitButton = form.querySelector('.submit-button');
    const formData = new FormData(form);

    // Validate required fields
    if (!validateContactForm(form)) {
        return;
    }

    // Disable submit button and show loading state
    submitButton.disabled = true;
    submitButton.textContent = 'SENDING...';

    // Simulate form submission (replace with your actual form handling)
    setTimeout(() => {
        // Here you would typically send the form data to your server
        // For now, we'll just show the thank you message
        showThankYouMessage();

        // Reset form state
        submitButton.disabled = false;
        submitButton.textContent = 'SEND MESSAGE';
        form.reset();

        console.log('Contact form submitted:', Object.fromEntries(formData));
    }, 1000);
}

// Validate contact form
function validateContactForm(form) {
    const requiredFields = form.querySelectorAll('[required]');
    let isValid = true;

    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            isValid = false;
            field.style.borderColor = '#ff6b6b';
            field.addEventListener('input', () => {
                field.style.borderColor = '';
            }, { once: true });
        }
    });

    // Validate email format
    const emailField = form.querySelector('#email');
    if (emailField && emailField.value && !isValidEmail(emailField.value)) {
        isValid = false;
        emailField.style.borderColor = '#ff6b6b';
        emailField.addEventListener('input', () => {
            emailField.style.borderColor = '';
        }, { once: true });
    }

    if (!isValid) {
        alert('Please fill in all required fields with valid information.');
    }

    return isValid;
}

// Show thank you message
function showThankYouMessage() {
    const contactFormSection = document.getElementById('contactFormSection');
    const thankYouSection = document.getElementById('thankYouSection');

    if (contactFormSection && thankYouSection) {
        // Hide form section with fade out
        contactFormSection.style.opacity = '0';
        contactFormSection.style.transform = 'translateY(-30px)';

        setTimeout(() => {
            contactFormSection.style.display = 'none';
            thankYouSection.style.display = 'flex';

            // Show thank you section with fade in
            setTimeout(() => {
                thankYouSection.classList.add('show');
            }, 50);
        }, 300);

        // Scroll to top smoothly
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }
}

// Pre-select service based on URL parameters or referrer
function preSelectService() {
    const serviceSelect = document.getElementById('service');
    if (!serviceSelect) return;

    // Check URL parameters first
    const urlParams = new URLSearchParams(window.location.search);
    const serviceParam = urlParams.get('service');

    if (serviceParam) {
        serviceSelect.value = serviceParam;
        return;
    }

    // Check referrer to auto-select service
    const referrer = document.referrer;
    if (referrer) {
        if (referrer.includes('/services/styling')) {
            serviceSelect.value = 'styling';
        } else if (referrer.includes('/services/creative-directing')) {
            serviceSelect.value = 'creative-directing';
        } else if (referrer.includes('/services/shoots')) {
            serviceSelect.value = 'shoots';
        } else if (referrer.includes('/services/set-designing')) {
            serviceSelect.value = 'set-designing';
        } else if (referrer.includes('/services/models')) {
            serviceSelect.value = 'models';
        } else if (referrer.includes('/services/music')) {
            serviceSelect.value = 'music';
        }
    }
}

// ================== COMING SOON PAGE FUNCTIONALITY ==================

// Notification form functions
function showNotifyForm() {
    const overlay = document.getElementById('notifyFormOverlay');
    if (overlay) {
        overlay.classList.add('active');
        // Prevent body scroll when form is open
        document.body.style.overflow = 'hidden';
    }
}

function hideNotifyForm() {
    const overlay = document.getElementById('notifyFormOverlay');
    if (overlay) {
        overlay.classList.remove('active');
        // Restore body scroll
        document.body.style.overflow = '';
    }
}

// Initialize coming soon page functionality
function initComingSoonPage() {
    const form = document.getElementById('notifyForm');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const emailInput = form.querySelector('input[type="email"]');
            const email = emailInput.value;

            // Basic email validation
            if (email && isValidEmail(email)) {
                // Here you would typically send the email to your backend
                // For now, we'll just show a success message
                alert('Thank you! We\'ll notify you when our products launch.');
                hideNotifyForm();
                form.reset();
            } else {
                alert('Please enter a valid email address.');
            }
        });
    }

    // Close overlay when clicking outside the form
    const overlay = document.getElementById('notifyFormOverlay');
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                hideNotifyForm();
            }
        });
    }

    // Close form with escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideNotifyForm();
        }
    });
}

// Simple email validation function
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    const allVideos = document.querySelectorAll('video');
    allVideos.forEach(video => {
        video.pause();
        video.currentTime = 0;
    });
});

// ================== PHOTOGRAPHY PORTFOLIO ==================

// Photography portfolio data
const photographyData = [
    {
        id: 1,
        category: "commercial",
        photographer: "Ashleigh Cooper",
        photographerUrl: "/members/ashleigh-cooper-photography",
        client: "Harper's Bazaar",
        camera: "Canon EOS R5, 85mm f/1.4",
        year: "2024",
        image: "/images/ash-pic-1.png"
    },
    {
        id: 2,
        category: "fashion",
        photographer: "Ashleigh Cooper",
        photographerUrl: "/members/ashleigh-cooper-photography",
        client: "Dezeen Magazine",
        camera: "Sony A7R IV, 24-70mm f/2.8",
        year: "2024",
        image: "/images/ash-pic-2.png"
    },
    {
        id: 3,
        category: "fashion",
        photographer: "Ashleigh Cooper",
        photographerUrl: "/members/ashleigh-cooper-photography",
        client: "National Geographic",
        camera: "Nikon D850, 70-200mm f/2.8",
        year: "2023",
        image: "/images/ash-pic-3.png"
    },
    {
        id: 4,
        category: "editorial",
        photographer: "Ashleigh Cooper",
        photographerUrl: "/members/ashleigh-cooper-photography",
        client: "Louis Vuitton",
        camera: "Canon EOS R6, 100mm f/2.8 Macro",
        year: "2024",
        image: "/images/ash-pic-4.png"
    },
    {
        id: 5,
        category: "editorial",
        photographer: "Ashleigh Cooper",
        photographerUrl: "/members/ashleigh-cooper-photography",
        client: "Vogue Italia",
        camera: "Fujifilm GFX 100S, 63mm f/2.8",
        year: "2024",
        image: "/images/ash-pic-5.png"
    },
    {
        id: 6,
        category: "editorial",
        photographer: "Ashleigh Cooper",
        photographerUrl: "/members/ashleigh-cooper-photography",
        client: "Glastonbury Festival",
        camera: "Sony A9 III, 24-105mm f/4",
        year: "2023",
        image: "/images/ash-pic-6.png"
    },
    {
        id: 7,
        category: "commercial",
        photographer: "Ashleigh Cooper",
        photographerUrl: "/members/ashleigh-cooper-photography",
        client: "TIME Magazine",
        camera: "Leica Q2, 28mm f/1.7",
        year: "2023",
        image: "/images/ash-pic-7.png"
    },
    {
        id: 8,
        category: "events",
        photographer: "Ashleigh Cooper",
        photographerUrl: "/members/ashleigh-cooper-photography",
        client: "Apple Inc.",
        camera: "Canon EOS R5, 50mm f/1.2",
        year: "2024",
        image: "/images/ash-pic-8.png"
    },
    {
        id: 9,
        category: "portrait",
        photographer: "Ashleigh Cooper",
        photographerUrl: "/members/ashleigh-cooper-photography",
        client: "London Fashion Week",
        camera: "Canon EOS R6, 35mm f/1.4",
        year: "2024",
        image: "/images/ash-pic-9.png"
    },
    {
        id: 9,
        category: "commercial",
        photographer: "Ashleigh Cooper",
        photographerUrl: "/members/ashleigh-cooper-photography",
        client: "London Fashion Week",
        camera: "Canon EOS R6, 35mm f/1.4",
        year: "2024",
        image: "/images/ash-pic-10.png"
    }
];

let currentModalIndex = 0;
let isModalOpen = false;
let filteredPhotos = photographyData;

// Initialize Photography Portfolio
function initializePhotographyPortfolio() {
    // Only initialize if we're on a page with photography elements
    if (document.getElementById('masonryGrid')) {
        initializeGallery();
        setupCustomCursor();
        setupPhotographyEventListeners();
        console.log('✅ Photography portfolio initialized');
    }
}

function initializeGallery() {
    renderPhotos(photographyData);
}

function renderPhotos(photos) {
    const masonryGrid = document.getElementById('masonryGrid');
    if (!masonryGrid) return;

    masonryGrid.innerHTML = '';

    photos.forEach((photo, index) => {
        const photoItem = createPhotoItem(photo, index);
        masonryGrid.appendChild(photoItem);
    });

    filteredPhotos = photos;

    // Re-setup photo hovers after rendering
    setTimeout(() => {
        setupPhotoHovers();
    }, 100);
}

function createPhotoItem(photo, index) {
    const masonryItem = document.createElement('div');
    masonryItem.className = `masonry-item`;
    masonryItem.dataset.category = photo.category;
    masonryItem.onclick = () => openImageModal(index);

    masonryItem.innerHTML = `
        <img class="photo-image" src="${photo.image}" alt="${photo.title}" loading="lazy">
        <div class="photo-overlay">
            <div class="photo-category">${photo.category}</div>
            <div class="photo-content">
                <div class="photo-meta">
                    <a href="${photo.photographerUrl}" class="photographer-link">${photo.photographer}</a>
                    <span>${photo.client} • ${photo.year}</span>
                </div>
            </div>
        </div>
    `;

    return masonryItem;
}

// Custom Cursor for Photography
function setupCustomCursor() {
    const cursor = document.getElementById('customCursor');
    if (!cursor) return;

    // Only setup cursor on non-mobile devices
    if (window.innerWidth > 768) {
        document.addEventListener('mousemove', (e) => {
            cursor.style.left = e.clientX + 'px';
            cursor.style.top = e.clientY + 'px';
        });

        setupPhotoHovers();

        // General hover effects
        document.querySelectorAll('a, button, .theme-circle, .filter-btn').forEach(item => {
            item.addEventListener('mouseenter', () => {
                cursor.classList.add('hover');
            });

            item.addEventListener('mouseleave', () => {
                cursor.classList.remove('hover');
            });
        });
    }
}

function setupPhotoHovers() {
    document.querySelectorAll('.masonry-item').forEach(item => {
        item.addEventListener('mouseenter', () => {
            const cursor = document.getElementById('customCursor');
            if (cursor) cursor.classList.add('view');
        });

        item.addEventListener('mouseleave', () => {
            const cursor = document.getElementById('customCursor');
            if (cursor) cursor.classList.remove('view');
        });
    });
}

// Photography Event Listeners
function setupPhotographyEventListeners() {
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const category = this.dataset.category;

            // Update active button
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            // Filter photos
            filterPhotos(category);
        });
    });

    // Photography-specific keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (isModalOpen) {
            if (e.key === 'ArrowRight') navigateModal(1);
            if (e.key === 'ArrowLeft') navigateModal(-1);
            if (e.key === 'Escape') closeImageModal();
        }
    });

    // Close modal when clicking outside
    const imageModal = document.getElementById('imageModal');
    if (imageModal) {
        imageModal.addEventListener('click', (e) => {
            if (e.target.id === 'imageModal') {
                closeImageModal();
            }
        });
    }
}

function filterPhotos(category) {
    const allItems = document.querySelectorAll('.masonry-item');

    allItems.forEach(item => {
        if (category === 'all' || item.dataset.category === category) {
            item.classList.remove('hidden');
        } else {
            item.classList.add('hidden');
        }
    });

    // Update filtered photos array for modal navigation
    if (category === 'all') {
        filteredPhotos = photographyData;
    } else {
        filteredPhotos = photographyData.filter(photo => photo.category === category);
    }
}

// Photography Modal Functions
function openImageModal(index) {
    currentModalIndex = index;
    isModalOpen = true;

    const modal = document.getElementById('imageModal');
    if (!modal) return;

    const photo = filteredPhotos[index];
    updateModalContent(photo);

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function updateModalContent(photo) {
    const elements = {
        modalImage: document.getElementById('modalImage'),
        modalPhotographer: document.getElementById('modalPhotographer'),
        modalClient: document.getElementById('modalClient'),
        modalCamera: document.getElementById('modalCamera'),
        modalYear: document.getElementById('modalYear')
    };

    if (elements.modalImage) elements.modalImage.src = photo.image;
    if (elements.modalPhotographer) {
        elements.modalPhotographer.textContent = photo.photographer;
        elements.modalPhotographer.href = photo.photographerUrl;
    }
    if (elements.modalClient) elements.modalClient.textContent = photo.client;
    if (elements.modalCamera) elements.modalCamera.textContent = photo.camera;
    if (elements.modalYear) elements.modalYear.textContent = photo.year;
}

function closeImageModal() {
    const modal = document.getElementById('imageModal');
    if (!modal) return;

    modal.classList.remove('active');
    document.body.style.overflow = '';
    isModalOpen = false;
}

function navigateModal(direction) {
    currentModalIndex += direction;

    if (currentModalIndex < 0) {
        currentModalIndex = filteredPhotos.length - 1;
    } else if (currentModalIndex >= filteredPhotos.length) {
        currentModalIndex = 0;
    }

    const photo = filteredPhotos[currentModalIndex];
    updateModalContent(photo);
}

// Photography Window Resize Handler
function handlePhotographyResize() {
    const cursor = document.getElementById('customCursor');
    if (!cursor) return;

    if (window.innerWidth <= 768) {
        cursor.style.display = 'none';
    } else {
        cursor.style.display = 'block';
        setupCustomCursor();
    }
}

// Add this function to your script.js
function generateCategoryFilters() {
    const categoryFilter = document.getElementById('categoryFilter');
    if (!categoryFilter) return;

    // Get unique categories from the data
    const categories = [...new Set(photographyData.map(photo => photo.category))];

    // Clear existing filters
    categoryFilter.innerHTML = '';

    // Add "All Work" button
    const allButton = document.createElement('button');
    allButton.className = 'filter-btn active';
    allButton.dataset.category = 'all';
    allButton.textContent = 'All Work';
    categoryFilter.appendChild(allButton);

    // Add category buttons
    categories.forEach(category => {
        const button = document.createElement('button');
        button.className = 'filter-btn';
        button.dataset.category = category;
        button.textContent = category.charAt(0).toUpperCase() + category.slice(1);
        categoryFilter.appendChild(button);
    });

    // Re-setup event listeners for the new buttons
    setupFilterEventListeners();
}

// Update your filter event listener setup
function setupFilterEventListeners() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const category = this.dataset.category;

            // Update active button
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            // Filter photos
            filterPhotos(category);
        });
    });
}

// Update your initialization function
function initializeGallery() {
    generateCategoryFilters(); // Generate filters first
    renderPhotos(photographyData);
}

// Add photography initialization to your existing DOMContentLoaded event
document.addEventListener('DOMContentLoaded', () => {
    // Your existing initialization code...

    // Add photography portfolio initialization
    initializePhotographyPortfolio();
});

// Add photography resize handler to your existing window resize event
window.addEventListener('resize', () => {
    // Your existing resize handling...

    // Add photography resize handling
    handlePhotographyResize();
});

// The smoothest scrolling you'll ever see
const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smooth: true,
    smoothTouch: false, // Keep normal touch scrolling on mobile
})

function raf(time) {
    lenis.raf(time)
    requestAnimationFrame(raf)
}

requestAnimationFrame(raf)

