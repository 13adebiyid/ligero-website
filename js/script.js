// =========================
// OPTIMIZED LIGERO SCRIPT
// =========================

// ============= DOM CACHE & STATE =============
const DOM = {
    body: document.body,
    carousel: null, // Set after DOM load
    mobileMenuOverlay: null,
    hamburger: null,
    videoModal: null,
    imageModal: null,
    bgVideo: null
};

// State Management
const state = {
    currentSlide: 0,
    isNavigating: false,
    lastNavigationTime: 0,
    navigationTimeout: null,
    isModalOpen: false,
    currentModalIndex: 0,
    touchStartX: 0,
    touchEndX: 0,
    isSwiping: false
};

// Photography State
let filteredPhotos = [];
let currentFilter = 'all';

// ============= UTILITIES =============
const utils = {
    isMobile: () => window.innerWidth <= 768,

    isOnHomePage: () => {
        const path = window.location.pathname;
        return path === '/' || path.endsWith('index.html') || path === '' ||
            document.getElementById('home-page') !== null;
    },

    debounce: (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};

// ============= NAVIGATION STATE =============
function resetNavigationState() {
    state.isNavigating = false;
    state.lastNavigationTime = 0;
    if (state.navigationTimeout) {
        clearTimeout(state.navigationTimeout);
        state.navigationTimeout = null;
    }
    DOM.body.style.opacity = '';
    DOM.body.style.pointerEvents = '';
}

function emergencyCleanup() {
    console.log('Emergency cleanup triggered');
    resetNavigationState();
    document.querySelectorAll('.page-transition').forEach(el => el.remove());
    DOM.body.style.opacity = '1';
    DOM.body.style.pointerEvents = 'auto';
    DOM.body.classList.add('page-loaded', 'content-loaded');
}

function resetPageState() {
    resetNavigationState();
    document.querySelectorAll('.page-transition').forEach(overlay => {
        overlay.parentNode?.removeChild(overlay);
    });
    DOM.body.classList.add('page-loaded', 'content-loaded');
    DOM.body.style.overflow = '';
    closeMobileMenu();
    resetCarousel();
}

// ============= THEME MANAGEMENT =============
function setTheme(theme) {
    if (theme === 'white') {
        DOM.body.classList.add('white-theme');
        try {
            localStorage.setItem('theme', 'white');
        } catch (e) {}
    } else {
        DOM.body.classList.remove('white-theme');
        try {
            localStorage.setItem('theme', 'black');
        } catch (e) {}
    }
}

// ============= MOBILE MENU =============
function toggleMobileMenu() {
    DOM.hamburger?.classList.toggle('active');
    DOM.mobileMenuOverlay?.classList.toggle('active');
    DOM.body.style.overflow = DOM.mobileMenuOverlay?.classList.contains('active') ? 'hidden' : '';
}

function closeMobileMenu() {
    DOM.hamburger?.classList.remove('active');
    DOM.mobileMenuOverlay?.classList.remove('active');
    DOM.body.style.overflow = '';
}

// ============= CAROUSEL =============
function getCarouselSettings() {
    if (utils.isMobile()) {
        return { cardWidth: 280, cardGap: 20, containerPadding: 120 };
    }

    const carousel = DOM.carousel;
    if (carousel) {
        const firstCard = carousel.querySelector('.service-card');
        if (firstCard) {
            const computedStyle = window.getComputedStyle(firstCard);
            const actualCardWidth = parseFloat(computedStyle.width);
            const carouselStyle = window.getComputedStyle(carousel);
            const gapProperty = carouselStyle.gap;
            let actualGap = 30;

            if (gapProperty && gapProperty !== 'normal') {
                if (gapProperty.includes('vw')) {
                    const vwValue = parseFloat(gapProperty);
                    actualGap = (vwValue / 100) * window.innerWidth;
                } else {
                    actualGap = parseFloat(gapProperty) || 30;
                }
            }

            return {
                cardWidth: actualCardWidth,
                cardGap: actualGap,
                containerPadding: 160
            };
        }
    }

    return {
        cardWidth: window.innerWidth * 0.28,
        cardGap: window.innerWidth * 0.02,
        containerPadding: 160
    };
}

function slideCarousel(direction) {
    if (utils.isMobile() || !DOM.carousel) return;

    const cards = DOM.carousel.querySelectorAll('.service-card');
    const totalCards = cards.length;
    if (totalCards === 0) return;

    const settings = getCarouselSettings();
    const { cardWidth, cardGap, containerPadding } = settings;
    const containerWidth = window.innerWidth - containerPadding;
    const cardWithGap = cardWidth + cardGap;
    const cardsVisible = Math.max(1, Math.floor(containerWidth / cardWithGap));
    const maxSlide = Math.max(0, totalCards - cardsVisible);

    state.currentSlide = Math.max(0, Math.min(state.currentSlide + direction, maxSlide));

    let translateX;
    if (state.currentSlide === 0) {
        translateX = 0;
    } else if (state.currentSlide >= maxSlide) {
        const totalContentWidth = (totalCards * cardWidth) + ((totalCards - 1) * cardGap);
        const availableContentWidth = containerWidth;
        translateX = totalContentWidth > availableContentWidth ?
            -(totalContentWidth - availableContentWidth) : 0;
    } else {
        translateX = -(state.currentSlide * cardWithGap);
    }

    DOM.carousel.style.transform = `translateX(${translateX}px)`;
}

function resetCarousel() {
    if (state.isNavigating || !DOM.carousel) return;

    state.currentSlide = 0;
    if (!utils.isMobile()) {
        DOM.carousel.style.transform = 'translateX(0px)';
        DOM.carousel.style.transition = 'transform 0.3s ease';
    } else {
        DOM.carousel.style.transform = 'none';
        DOM.carousel.style.transition = 'none';
    }
}

// ============= PAGE TRANSITIONS =============
function createTransitionOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'page-transition';
    overlay.innerHTML = '<div class="loading-text">LIGERO</div>';
    document.body.appendChild(overlay);
    return overlay;
}

function showNavigationTransition() {
    const overlay = createTransitionOverlay();
    overlay.classList.add('active');
    setTimeout(() => {
        overlay.classList.remove('active');
        setTimeout(() => {
            overlay.parentNode?.removeChild(overlay);
        }, 600);
    }, 800);
    return overlay;
}

function handleSimplePageTransition(url) {
    const now = Date.now();
    if (state.isNavigating || (now - state.lastNavigationTime < 300)) return;

    state.isNavigating = true;
    state.lastNavigationTime = now;

    try {
        DOM.body.style.opacity = '0.3';
        DOM.body.style.pointerEvents = 'none';
        state.navigationTimeout = setTimeout(() => {
            window.location.href = url;
        }, 150);
    } catch (error) {
        console.error('Error during simple transition:', error);
        emergencyCleanup();
    }
}

function handleHomePageTransition(url) {
    const now = Date.now();
    if (state.isNavigating || (now - state.lastNavigationTime < 300)) return;

    state.isNavigating = true;
    state.lastNavigationTime = now;

    try {
        showNavigationTransition();
        DOM.body.style.pointerEvents = 'none';
        state.navigationTimeout = setTimeout(() => {
            window.location.href = url;
        }, 200);
    } catch (error) {
        console.error('Error during home transition:', error);
        emergencyCleanup();
    }
}

// ============= GENERIC MODAL (Default for most pages) =============
function openImageModal(imageSrc, title, client) {
    const modal = DOM.imageModal;
    const modalImage = document.getElementById('modalImage');
    const imageTitle = document.getElementById('imageTitle');
    const imageProject = document.getElementById('imageProject');

    if (!modal || !modalImage) {
        console.error('Image modal elements not found');
        return;
    }

    modalImage.src = imageSrc;
    modalImage.alt = title || 'Image';

    if (imageTitle) imageTitle.textContent = title || 'Project Image';
    if (imageProject) imageProject.textContent = client || 'Ligero';

    modal.classList.add('active');
    DOM.body.style.overflow = 'hidden';
}

function closeImageModal() {
    const modal = DOM.imageModal;
    if (!modal) return;

    modal.classList.remove('active');
    DOM.body.style.overflow = '';

    const cursor = document.getElementById('customCursor');
    if (cursor) cursor.style.display = 'block';
}

// ============= VIDEO MODAL =============
function openVideoModal(videoSrc, title, client) {
    const modal = DOM.videoModal;
    const modalVideo = document.getElementById('modalVideo');
    const modalTitle = document.getElementById('modalTitle');
    const modalClient = document.getElementById('modalClient');

    if (!modal || !modalVideo) {
        console.error('Video modal elements not found');
        return;
    }

    if (modalTitle) modalTitle.textContent = title || 'Video';
    if (modalClient) modalClient.textContent = client || 'Client';

    modal.classList.add('active');
    DOM.body.style.overflow = 'hidden';

    modalVideo.src = videoSrc;
    modalVideo.load();

    setTimeout(() => {
        modalVideo.play().catch(err => {
            console.log('Autoplay prevented:', err);
        });
    }, 200);
}

function closeModal() {
    const videoModal = DOM.videoModal;
    const modalVideo = document.getElementById('modalVideo');

    if (videoModal) {
        videoModal.classList.remove('active');
        DOM.body.style.overflow = '';
    }

    if (modalVideo) {
        modalVideo.pause();
        modalVideo.currentTime = 0;
        modalVideo.src = '';
    }
}

// ============= PHOTOGRAPHY MODAL (Special case) =============
function openPhotographyModal(index) {
    state.currentModalIndex = index;
    state.isModalOpen = true;

    const modal = DOM.imageModal;
    if (!modal) return;

    const photo = filteredPhotos[index];
    updatePhotographyModalContent(photo);

    modal.classList.add('active');
    DOM.body.style.overflow = 'hidden';
}

function updatePhotographyModalContent(photo) {
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

function closePhotographyModal() {
    const modal = DOM.imageModal;
    if (!modal) return;

    modal.classList.remove('active');
    DOM.body.style.overflow = '';
    state.isModalOpen = false;

    const cursor = document.getElementById('customCursor');
    if (cursor) cursor.style.display = 'block';
}

function navigateModal(direction) {
    state.currentModalIndex += direction;

    if (state.currentModalIndex < 0) {
        state.currentModalIndex = filteredPhotos.length - 1;
    } else if (state.currentModalIndex >= filteredPhotos.length) {
        state.currentModalIndex = 0;
    }

    const photo = filteredPhotos[state.currentModalIndex];
    updatePhotographyModalContent(photo);
}

// ============= PROJECT INFO HELPER =============
function getProjectInfo(clickedElement) {
    // Check dual video item
    let dualVideoItem = clickedElement.closest('.dual-video-item');
    if (dualVideoItem) {
        const metadata = dualVideoItem.querySelector('.video-metadata');
        if (metadata) {
            const clientName = metadata.querySelector('.client-name')?.textContent || 'Client';
            const projectTitle = metadata.querySelector('.project-title')?.textContent || 'Project';
            return { title: projectTitle, client: clientName };
        }
    }

    // Check images grid
    let imagesGrid = clickedElement.closest('.images-grid');
    if (imagesGrid) {
        let previousElement = imagesGrid.previousElementSibling;
        while (previousElement) {
            if (previousElement.classList?.contains('video-section')) {
                const metadata = previousElement.querySelector('.video-metadata');
                if (metadata) {
                    const clientName = metadata.querySelector('.client-name')?.textContent || 'Client';
                    const projectTitle = metadata.querySelector('.project-title')?.textContent || 'Project';
                    return { title: projectTitle, client: clientName };
                }
                break;
            }
            previousElement = previousElement.previousElementSibling;
        }
    }

    // Check video section
    let videoSection = clickedElement.closest('.video-section');
    if (videoSection) {
        const metadata = videoSection.querySelector('.video-metadata');
        if (metadata) {
            const clientName = metadata.querySelector('.client-name')?.textContent || 'Client';
            const projectTitle = metadata.querySelector('.project-title')?.textContent || 'Project';
            return { title: projectTitle, client: clientName };
        }
    }

    // Check data attributes
    const videoContainer = clickedElement.closest('.video-container-main');
    if (videoContainer) {
        const title = videoContainer.getAttribute('data-title');
        const client = videoContainer.getAttribute('data-client');
        if (title && client) {
            return { title: title, client: client };
        }
    }

    return { title: 'Project Image', client: 'Ligero' };
}

// ============= MODAL CLICK HANDLERS =============
function setupModalClicks() {
    // Video clicks
    const videoContainers = document.querySelectorAll('.video-container-main');
    videoContainers.forEach(container => {
        container.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();

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

    // Check if we're on photography page
    const isPhotographyPage = document.querySelector('.photography-page') !== null;

    if (!isPhotographyPage) {
        // Generic image handling for all non-photography pages
        const feedItems = document.querySelectorAll('.feed-item[data-image]');
        feedItems.forEach(item => {
            item.style.cursor = 'pointer';
            item.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();

                const imageSrc = this.getAttribute('data-image');
                if (imageSrc) {
                    const projectInfo = getProjectInfo(this);
                    openImageModal(imageSrc, projectInfo.title, projectInfo.client);
                }
            });
        });

        // Handle direct image clicks
        const feedImages = document.querySelectorAll('.feed-item img');
        feedImages.forEach(img => {
            const parent = img.closest('.feed-item');
            if (parent && parent.hasAttribute('data-image')) {
                img.style.cursor = 'pointer';
                img.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();

                    const imageSrc = parent.getAttribute('data-image');
                    if (imageSrc) {
                        const projectInfo = getProjectInfo(parent);
                        openImageModal(imageSrc, projectInfo.title, projectInfo.client);
                    }
                });
            }
        });
    }
}

// ============= VIDEO SETTINGS =============
const videoSettings = {
    'gift-video': { start: 6, duration: 8 },
    'fashion-video': { start: 10, duration: 8 },
    'brand-video': { start: 3, duration: 8 },
    'gabzy-video': { start: 5, duration: 8 },
    'grime-video': { start: 3, duration: 8 },
    'note-video': { start: 2, duration: 8 },
    'reem-video': { start: 6, duration: 8 }
};

function setupIndividualVideoLooping() {
    Object.keys(videoSettings).forEach(videoId => {
        const video = document.getElementById(videoId);
        if (!video) return;

        const settings = videoSettings[videoId];

        video.addEventListener('loadedmetadata', () => {
            video.currentTime = settings.start;
        });

        video.addEventListener('timeupdate', () => {
            if (video.currentTime >= settings.start + settings.duration) {
                video.currentTime = settings.start;
            }
        });

        if (video.readyState >= 1) {
            video.currentTime = settings.start;
        }
    });
}

// ============= SERVICE CARD PREVIEWS =============
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
        currentClipIndex = 0;
        playClip(currentClipIndex);
    });

    setDesignCard.addEventListener('mouseleave', () => {
        clearTimeout(hoverInterval);
        video.pause();
        video.currentTime = 0;
        video.src = '';
    });
}

// ============= LAZY LOADING =============
function setupEnhancedFeedVideoAutoplay() {
    const feedVideos = document.querySelectorAll('.feed-video');
    const customVideoIds = Object.keys(videoSettings);

    const videoObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const video = entry.target;

            if (entry.isIntersecting && entry.intersectionRatio > 0.1) {
                video.play().catch(err => {
                    console.log(`⏸️ Autoplay prevented: ${err.message}`);
                });
            } else {
                video.pause();
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

        if (video.id && customVideoIds.includes(video.id)) return;

        video.addEventListener('loadedmetadata', () => {
            video.addEventListener('timeupdate', () => {
                const loopTime = Math.min(4, video.duration - 0.5);
                if (video.currentTime >= loopTime) {
                    video.currentTime = 0;
                }
            });
        });

        video.load();

        setTimeout(() => {
            const rect = video.getBoundingClientRect();
            if (rect.top < window.innerHeight && rect.bottom > 0) {
                video.play().catch(() => {});
            }
        }, 100);
    });
}

// ============= PHOTOGRAPHY PORTFOLIO =============
const photographyData = [
    {
        id: 1,
        category: "commercial",
        photographer: "Ashleigh Cooper",
        photographerUrl: "/members/ashleigh-cooper-photography",
        client: "Harper's Bazaar",
        camera: "Canon EOS R5, 85mm f/1.4",
        year: "2024",
        image: "/images/ash-pic-1.webp"
    },
    {
        id: 2,
        category: "fashion",
        photographer: "Ashleigh Cooper",
        photographerUrl: "/members/ashleigh-cooper-photography",
        client: "Dezeen Magazine",
        camera: "Sony A7R IV, 24-70mm f/2.8",
        year: "2024",
        image: "/images/ash-pic-2.webp"
    },
    {
        id: 3,
        category: "fashion",
        photographer: "Ashleigh Cooper",
        photographerUrl: "/members/ashleigh-cooper-photography",
        client: "National Geographic",
        camera: "Nikon D850, 70-200mm f/2.8",
        year: "2023",
        image: "/images/ash-pic-3.webp"
    },
    {
        id: 4,
        category: "editorial",
        photographer: "Ashleigh Cooper",
        photographerUrl: "/members/ashleigh-cooper-photography",
        client: "Louis Vuitton",
        camera: "Canon EOS R6, 100mm f/2.8 Macro",
        year: "2024",
        image: "/images/ash-pic-4.webp"
    },
    {
        id: 5,
        category: "editorial",
        photographer: "Ashleigh Cooper",
        photographerUrl: "/members/ashleigh-cooper-photography",
        client: "Vogue Italia",
        camera: "Fujifilm GFX 100S, 63mm f/2.8",
        year: "2024",
        image: "/images/ash-pic-5.webp"
    },
    {
        id: 6,
        category: "editorial",
        photographer: "Ashleigh Cooper",
        photographerUrl: "/members/ashleigh-cooper-photography",
        client: "Glastonbury Festival",
        camera: "Sony A9 III, 24-105mm f/4",
        year: "2023",
        image: "/images/ash-pic-6.webp"
    },
    {
        id: 7,
        category: "commercial",
        photographer: "Ashleigh Cooper",
        photographerUrl: "/members/ashleigh-cooper-photography",
        client: "TIME Magazine",
        camera: "Leica Q2, 28mm f/1.7",
        year: "2023",
        image: "/images/ash-pic-7.webp"
    },
    {
        id: 8,
        category: "events",
        photographer: "Ashleigh Cooper",
        photographerUrl: "/members/ashleigh-cooper-photography",
        client: "Apple Inc.",
        camera: "Canon EOS R5, 50mm f/1.2",
        year: "2024",
        image: "/images/ash-pic-8.webp"
    },
    {
        id: 9,
        category: "portrait",
        photographer: "Ashleigh Cooper",
        photographerUrl: "/members/ashleigh-cooper-photography",
        client: "London Fashion Week",
        camera: "Canon EOS R6, 35mm f/1.4",
        year: "2024",
        image: "/images/ash-pic-9.webp"
    },
    {
        id: 10,
        category: "commercial",
        photographer: "Ashleigh Cooper",
        photographerUrl: "/members/ashleigh-cooper-photography",
        client: "London Fashion Week",
        camera: "Canon EOS R6, 35mm f/1.4",
        year: "2024",
        image: "/images/ash-pic-10.webp"
    }
];

function renderPhotos(photos) {
    const masonryGrid = document.getElementById('masonryGrid');
    if (!masonryGrid) return;

    masonryGrid.innerHTML = '';

    photos.forEach((photo) => {
        const masonryItem = createPhotoItem(photo);
        masonryGrid.appendChild(masonryItem);
    });

    filteredPhotos = photos;

    setTimeout(() => {
        setupPhotoHovers();
    }, 100);
}

function createPhotoItem(photo) {
    const masonryItem = document.createElement('div');
    masonryItem.className = `masonry-item`;
    masonryItem.dataset.category = photo.category;
    masonryItem.dataset.photoId = photo.id;

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

    masonryItem.addEventListener('click', () => {
        const photoId = parseInt(masonryItem.dataset.photoId);
        const indexInFiltered = filteredPhotos.findIndex(p => p.id === photoId);
        if (indexInFiltered !== -1) {
            openPhotographyModal(indexInFiltered);
        }
    });

    return masonryItem;
}

function filterPhotos(category) {
    currentFilter = category;

    if (category === 'all') {
        filteredPhotos = photographyData;
    } else {
        filteredPhotos = photographyData.filter(photo => photo.category === category);
    }

    renderPhotos(filteredPhotos);
}

// ============= PHOTOGRAPHY CURSOR =============
function setupCustomCursor() {
    const cursor = document.getElementById('customCursor');
    if (!cursor || utils.isMobile()) return;

    document.addEventListener('mousemove', (e) => {
        cursor.style.left = e.clientX + 'px';
        cursor.style.top = e.clientY + 'px';
    });

    setupPhotoHovers();

    // Hover effects
    document.querySelectorAll('a, button, .theme-circle, .filter-btn').forEach(item => {
        item.addEventListener('mouseenter', () => {
            cursor.classList.add('hover');
        });

        item.addEventListener('mouseleave', () => {
            cursor.classList.remove('hover');
        });
    });

    // "OPEN" text for photographer links
    document.addEventListener('mouseover', (e) => {
        if (e.target.matches('.photographer-link, .modal-meta-item a')) {
            cursor.classList.add('open-mode');
            const cursorText = cursor.querySelector('.cursor-text');
            if (cursorText) cursorText.textContent = 'OPEN';
        }
    });

    document.addEventListener('mouseout', (e) => {
        if (e.target.matches('.photographer-link, .modal-meta-item a')) {
            cursor.classList.remove('open-mode');
            const cursorText = cursor.querySelector('.cursor-text');
            if (cursorText) cursorText.textContent = 'VIEW';
        }
    });
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

function setupPhotographyEventListeners() {
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const category = this.dataset.category;
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            filterPhotos(category);
        });
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (state.isModalOpen) {
            if (e.key === 'ArrowRight') navigateModal(1);
            if (e.key === 'ArrowLeft') navigateModal(-1);
            if (e.key === 'Escape') closePhotographyModal();
        }
    });

    // Click outside to close
    const imageModal = DOM.imageModal;
    if (imageModal) {
        imageModal.addEventListener('click', (e) => {
            if (e.target.id === 'imageModal') {
                closePhotographyModal();
            }
        });
    }
}

function initializePhotographyPortfolio() {
    if (document.getElementById('masonryGrid')) {
        renderPhotos(photographyData);
        setupCustomCursor();
        setupPhotographyEventListeners();
    }
}

// ============= CONTACT PAGE =============
function initContactPage() {
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', handleContactFormSubmission);
    }
    preSelectService();
}

function handleContactFormSubmission(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('.submit-button');

    if (!validateContactForm(form)) return;

    submitButton.disabled = true;
    submitButton.textContent = 'SENDING...';

    setTimeout(() => {
        showThankYouMessage();
        submitButton.disabled = false;
        submitButton.textContent = 'SEND MESSAGE';
        form.reset();
    }, 1000);
}

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

    const emailField = form.querySelector('#email');
    if (emailField && emailField.value && !isValidEmail(emailField.value)) {
        isValid = false;
        emailField.style.borderColor = '#ff6b6b';
    }

    if (!isValid) {
        alert('Please fill in all required fields with valid information.');
    }

    return isValid;
}

function showThankYouMessage() {
    const contactFormSection = document.getElementById('contactFormSection');
    const thankYouSection = document.getElementById('thankYouSection');

    if (contactFormSection && thankYouSection) {
        contactFormSection.style.opacity = '0';
        contactFormSection.style.transform = 'translateY(-30px)';

        setTimeout(() => {
            contactFormSection.style.display = 'none';
            thankYouSection.style.display = 'flex';
            setTimeout(() => {
                thankYouSection.classList.add('show');
            }, 50);
        }, 300);

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function preSelectService() {
    const serviceSelect = document.getElementById('service');
    if (!serviceSelect) return;

    const urlParams = new URLSearchParams(window.location.search);
    const serviceParam = urlParams.get('service');

    if (serviceParam) {
        serviceSelect.value = serviceParam;
        return;
    }

    const referrer = document.referrer;
    if (referrer) {
        const serviceMap = {
            '/services/styling': 'styling',
            '/services/creative-directing': 'creative-directing',
            '/services/shoots': 'shoots',
            '/services/set-designing': 'set-designing',
            '/services/models': 'models',
            '/services/music': 'music'
        };

        for (const [path, value] of Object.entries(serviceMap)) {
            if (referrer.includes(path)) {
                serviceSelect.value = value;
                break;
            }
        }
    }
}

// ============= COMING SOON PAGE =============
function initComingSoonPage() {
    const form = document.getElementById('notifyForm');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const emailInput = form.querySelector('input[type="email"]');
            const email = emailInput.value;

            if (email && isValidEmail(email)) {
                alert('Thank you! We\'ll notify you when our products launch.');
                hideNotifyForm();
                form.reset();
            } else {
                alert('Please enter a valid email address.');
            }
        });
    }

    const overlay = document.getElementById('notifyFormOverlay');
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                hideNotifyForm();
            }
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideNotifyForm();
        }
    });
}

function showNotifyForm() {
    const overlay = document.getElementById('notifyFormOverlay');
    if (overlay) {
        overlay.classList.add('active');
        DOM.body.style.overflow = 'hidden';
    }
}

function hideNotifyForm() {
    const overlay = document.getElementById('notifyFormOverlay');
    if (overlay) {
        overlay.classList.remove('active');
        DOM.body.style.overflow = '';
    }
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ============= VIDEO CONTROLS =============
function setupVideoControls() {
    const video = DOM.bgVideo;
    const playPauseBtn = document.getElementById('playPauseBtn');
    const muteBtn = document.getElementById('muteBtn');
    const playPauseIcon = document.getElementById('playPauseIcon');
    const muteIcon = document.getElementById('muteIcon');

    if (!video || !playPauseBtn || !muteBtn) return;

    function tryAutoplay() {
        video.play().then(() => {
            playPauseIcon.src = '/images/pause-icon.png';
        }).catch(() => {
            playPauseIcon.src = '/images/play-icon.png';
        });
    }

    setTimeout(tryAutoplay, 100);
    document.addEventListener('touchstart', tryAutoplay, { once: true });
    document.addEventListener('click', tryAutoplay, { once: true });

    playPauseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (video.paused) {
            video.play();
            playPauseIcon.src = '/images/pause-icon.png';
        } else {
            video.pause();
            playPauseIcon.src = '/images/play-icon.png';
        }
    });

    muteBtn.addEventListener('click', () => {
        video.muted = !video.muted;
        muteIcon.src = video.muted ? '/images/sound-off-icon.png' : '/images/sound-on-icon.png';
    });

    video.addEventListener('play', () => {
        playPauseIcon.src = '/images/pause-icon.png';
    });

    video.addEventListener('pause', () => {
        playPauseIcon.src = '/images/play-icon.png';
    });
}

// ============= INITIALIZATION =============
function initPageLoad() {
    try {
        const hasVisited = sessionStorage.getItem('hasVisited');
        const isHomePage = utils.isOnHomePage();
        const shouldShowLoading = (!hasVisited && isHomePage) ||
            (!document.referrer || !document.referrer.includes(window.location.hostname));

        if (shouldShowLoading && !document.querySelector('.page-transition')) {
            sessionStorage.setItem('hasVisited', 'true');
            showInitialLoading();
            setTimeout(() => {
                DOM.body.classList.add('page-loaded');
            }, 1600);
            setTimeout(() => {
                DOM.body.classList.add('content-loaded');
            }, 1900);
        } else {
            setTimeout(() => {
                DOM.body.classList.add('page-loaded');
            }, 100);
            setTimeout(() => {
                DOM.body.classList.add('content-loaded');
            }, 300);
        }
    } catch (error) {
        DOM.body.classList.add('page-loaded', 'content-loaded');
    }
}

function showInitialLoading() {
    const overlay = createTransitionOverlay();
    overlay.classList.add('active');
    setTimeout(() => {
        overlay.classList.remove('active');
        setTimeout(() => {
            overlay.parentNode?.removeChild(overlay);
        }, 600);
    }, 1800);
    return overlay;
}

function setupPageTransitions() {
    document.addEventListener('click', (e) => {
        try {
            const target = e.target.closest('a[href]');
            if (!target) return;

            const href = target.getAttribute('href');
            if (!href || !href.startsWith('/') || href.startsWith('//')) return;

            e.preventDefault();
            e.stopPropagation();

            if (state.isNavigating) return;

            const isLogo = target.classList.contains('logo');
            const isGoingHome = href === '/' || href.endsWith('index.html') || href === '';

            if (isLogo && utils.isOnHomePage() && isGoingHome) return;

            if (target.classList.contains('mobile-menu-item') && isGoingHome && utils.isOnHomePage()) {
                closeMobileMenu();
                return;
            }

            if (isGoingHome && (isLogo || target.classList.contains('choose-button'))) {
                handleHomePageTransition(href);
                return;
            }

            handleSimplePageTransition(href);

        } catch (error) {
            console.error('Error in navigation click handler:', error);
            emergencyCleanup();
        }
    });
}

function initPageSpecificFeatures() {
    // Reset carousel if on services page
    if (DOM.carousel && !utils.isMobile()) {
        resetCarousel();
    }

    // Apply saved theme
    try {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'white') {
            DOM.body.classList.add('white-theme');
        } else {
            DOM.body.classList.remove('white-theme');
        }
    } catch (e) {}
}

function setupModalCloseHandlers() {
    const videoCloseBtn = document.querySelector('#videoModal .modal-close');
    const imageCloseBtn = document.querySelector('#imageModal .modal-close');

    if (videoCloseBtn) {
        videoCloseBtn.addEventListener('click', closeModal);
    }

    if (imageCloseBtn) {
        const isPhotographyPage = document.querySelector('.photography-page') !== null;
        imageCloseBtn.addEventListener('click', isPhotographyPage ? closePhotographyModal : closeImageModal);
    }

    // Click outside to close
    if (DOM.videoModal) {
        const backdrop = DOM.videoModal.querySelector('.modal-backdrop');
        if (backdrop) {
            backdrop.addEventListener('click', closeModal);
        }
    }

    if (DOM.imageModal && !document.querySelector('.photography-page')) {
        const backdrop = DOM.imageModal.querySelector('.modal-backdrop');
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

function initializeModals() {
    setupModalClicks();
    setupModalCloseHandlers();
}

// ============= TOUCH EVENTS =============
function handleTouchStart(e) {
    if (utils.isMobile()) return;
    state.touchStartX = e.changedTouches[0].screenX;
    state.isSwiping = true;
}

function handleTouchMove(e) {
    if (!state.isSwiping || utils.isMobile()) return;
    e.preventDefault();
}

function handleTouchEnd(e) {
    if (!state.isSwiping || utils.isMobile()) return;

    state.touchEndX = e.changedTouches[0].screenX;
    const swipeDistance = state.touchStartX - state.touchEndX;

    if (Math.abs(swipeDistance) > 50) {
        slideCarousel(swipeDistance > 0 ? 1 : -1);
    }

    state.isSwiping = false;
}

// ============= MAIN INITIALIZATION =============
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('🚀 Initializing Ligero website...');

        // Cache DOM elements
        DOM.carousel = document.getElementById('carousel');
        DOM.mobileMenuOverlay = document.querySelector('.mobile-menu-overlay');
        DOM.hamburger = document.querySelector('.hamburger-menu');
        DOM.videoModal = document.getElementById('videoModal');
        DOM.imageModal = document.getElementById('imageModal');
        DOM.bgVideo = document.getElementById('bgVideo');

        // Reset states
        resetPageState();

        // Initialize core features
        initPageLoad();
        setupPageTransitions();

        // Apply theme
        try {
            const savedTheme = localStorage.getItem('theme');
            if (savedTheme === 'white') {
                DOM.body.classList.add('white-theme');
            }
        } catch (e) {}

        // Setup carousel
        if (DOM.carousel) {
            resetCarousel();

            if (!utils.isMobile()) {
                setupCarouselKeyboardNavigation();
                DOM.carousel.addEventListener('touchstart', handleTouchStart, { passive: true });
                DOM.carousel.addEventListener('touchmove', handleTouchMove, { passive: false });
                DOM.carousel.addEventListener('touchend', handleTouchEnd, { passive: true });
                setupServiceCardHoverPreviews();
            }
        }

        // Setup video features
        setupIndividualVideoLooping();
        setupVideoControls();

        // Setup mobile menu
        if (DOM.hamburger) {
            DOM.hamburger.addEventListener('click', toggleMobileMenu);
        }

        // Mobile menu items
        document.querySelectorAll('.mobile-menu-item').forEach(item => {
            item.addEventListener('click', () => {
                setTimeout(closeMobileMenu, 100);
            });
        });

        // Mobile menu overlay click
        if (DOM.mobileMenuOverlay) {
            DOM.mobileMenuOverlay.addEventListener('click', (e) => {
                if (e.target === DOM.mobileMenuOverlay) {
                    closeMobileMenu();
                }
            });
        }

        // Window resize handler
        const handleResize = utils.debounce(() => {
            resetCarousel();
            if (window.innerWidth > 768) {
                closeMobileMenu();
            }
        }, 250);

        window.addEventListener('resize', handleResize);

        // Theme switchers
        document.querySelectorAll('.theme-circle.white').forEach(el => {
            el.onclick = () => setTheme('white');
        });

        document.querySelectorAll('.theme-circle.black').forEach(el => {
            el.onclick = () => setTheme('black');
        });

        // Initialize page-specific features
        if (document.querySelector('.set-design-feed') ||
            document.querySelector('.designer-profile-page') ||
            document.querySelector('.electra-style-page')) {

            setTimeout(() => {
                setupImageLoading();
                setupEnhancedFeedVideoAutoplay();
                initializeModals();
            }, 100);
        }

        // Contact page
        if (document.querySelector('.contact-page')) {
            initContactPage();
        }

        // Coming soon page
        if (document.querySelector('.coming-soon-page')) {
            initComingSoonPage();
        }

        // Photography page
        initializePhotographyPortfolio();

        console.log('✅ Ligero website initialized successfully');

    } catch (error) {
        console.error('Error during initialization:', error);
        emergencyCleanup();
    }
});

// Setup keyboard navigation for carousel
function setupCarouselKeyboardNavigation() {
    if (utils.isMobile()) return;

    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
            slideCarousel(-1);
        } else if (e.key === 'ArrowRight') {
            slideCarousel(1);
        }
    });
}

// Setup image loading
function setupImageLoading() {
    const images = document.querySelectorAll('.feed-item img');

    images.forEach((img, index) => {
        if (img.complete && img.naturalHeight !== 0) {
            img.classList.add('loaded');
        } else {
            img.addEventListener('load', () => {
                img.classList.add('loaded');
            });

            img.addEventListener('error', () => {
                console.error(`Failed to load image ${index + 1}: ${img.src}`);
                img.classList.add('loaded');
            });
        }
    });
}

// Page visibility and state restoration
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        if (state.isNavigating && Date.now() - state.lastNavigationTime > 3000) {
            emergencyCleanup();
        }
    }
});

window.addEventListener('pageshow', function(event) {
    if (event.persisted) {
        resetPageState();
        setTimeout(initPageSpecificFeatures, 50);
    }
});

window.addEventListener('popstate', function() {
    resetPageState();
});

window.addEventListener('beforeunload', () => {
    const allVideos = document.querySelectorAll('video');
    allVideos.forEach(video => {
        video.pause();
        video.currentTime = 0;
    });
});

// Emergency cleanup interval
setInterval(() => {
    if (state.isNavigating && Date.now() - state.lastNavigationTime > 5000) {
        console.warn('Navigation appears stuck, cleaning up...');
        emergencyCleanup();
    }
}, 1000);