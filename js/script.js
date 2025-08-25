// =========================
// OPTIMIZED LIGERO SCRIPT - COMPLETE VERSION
// =========================

// ============= DOM CACHE & STATE =============
const DOM = {
    body: document.body,
    carousel: null,
    mobileMenuOverlay: null,
    hamburger: null,
    videoModal: null,
    imageModal: null,
    bgVideo: null,
    customCursor: null
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
let isModalInfoVisible = true;

// ============= UTILITIES =============
const utils = {
    isMobile: () => {
        return window.innerWidth <= 768 ||
            ('ontouchstart' in window) ||
            (navigator.maxTouchPoints > 0) ||
            (navigator.msMaxTouchPoints > 0);
    },

    isTouchDevice: () => {
        return ('ontouchstart' in window) ||
            (navigator.maxTouchPoints > 0) ||
            (navigator.msMaxTouchPoints > 0);
    },

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

// ============= MOBILE FEATURES MANAGEMENT =============
function initMobileFeatures() {
    if (utils.isMobile() || utils.isTouchDevice()) {
        // Hide all theme switchers on mobile
        const themeSwitchers = document.querySelectorAll('.theme-switcher');
        themeSwitchers.forEach(switcher => {
            switcher.style.display = 'none';
        });

        // Ensure custom cursor is hidden
        const customCursor = document.getElementById('customCursor');
        if (customCursor) {
            customCursor.style.display = 'none';
        }

        // Reset body cursor to auto
        document.body.style.cursor = 'auto';

        // Disable custom cursor initialization on photography page
        if (document.querySelector('.photography-page')) {
            DOM.customCursor = null;
        }
    } else {
        // Show theme switchers on desktop
        const themeSwitchers = document.querySelectorAll('.theme-switcher');
        themeSwitchers.forEach(switcher => {
            switcher.style.display = 'flex';
        });
    }
}

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

// Make setTheme globally accessible
window.setTheme = setTheme;

// ============= THEME SWITCHER POSITION FIX =============
function fixThemeSwitcherPosition() {
    const themeSwitchers = document.querySelectorAll('.theme-switcher');
    themeSwitchers.forEach(switcher => {
        // Force fixed positioning
        switcher.style.position = 'fixed';
        switcher.style.bottom = '30px';
        switcher.style.left = '30px';
        switcher.style.zIndex = '1000';
        switcher.style.transform = 'none';

        // Remove any animation that might affect positioning
        switcher.style.animation = 'none';
        switcher.style.opacity = '1';
    });
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

// Make slideCarousel globally accessible
window.slideCarousel = slideCarousel;

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
    let overlay = document.querySelector('.page-transition');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'page-transition';
        overlay.innerHTML = '<div class="loading-text">LIGERO</div>';
        document.body.appendChild(overlay);
    }
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
    if (state.isNavigating) return;
    state.isNavigating = true;

    DOM.body.classList.remove('page-loaded');

    setTimeout(() => {
        window.location.assign(url);
    }, 400);
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

// ============= PHOTOGRAPHY MODAL INFO TOGGLE =============
function toggleModalInfo() {
    const modalInfo = document.querySelector('.modal-info');
    if (!modalInfo) return;

    isModalInfoVisible = !isModalInfoVisible;

    if (isModalInfoVisible) {
        modalInfo.classList.remove('hidden');
        modalInfo.style.opacity = '1';
        modalInfo.style.transform = 'translateY(0)';
        modalInfo.style.pointerEvents = 'auto';
        modalInfo.style.display = 'block';
    } else {
        modalInfo.classList.add('hidden');
        modalInfo.style.opacity = '0';
        modalInfo.style.transform = 'translateY(100%)';
        modalInfo.style.pointerEvents = 'none';
    }
}

// Make toggleModalInfo globally accessible
window.toggleModalInfo = toggleModalInfo;

function setupModalInfoButton() {
    const modalInfoCloseBtn = document.querySelector('.modal-info-close');
    if (modalInfoCloseBtn) {
        // Remove any existing listeners by cloning
        const newBtn = modalInfoCloseBtn.cloneNode(true);
        modalInfoCloseBtn.parentNode.replaceChild(newBtn, modalInfoCloseBtn);

        // Add fresh listener
        newBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            toggleModalInfo();
        });
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
    DOM.body.classList.add('modal-open');

    DOM.body.style.cursor = 'auto';
    modal.style.cursor = 'auto';
}

function closeImageModal() {
    const modal = DOM.imageModal;
    if (!modal) return;

    modal.classList.remove('active');
    DOM.body.style.overflow = '';
    DOM.body.classList.remove('modal-open');

    DOM.body.style.cursor = '';
    modal.style.cursor = '';
}

// Make closeImageModal globally accessible
window.closeImageModal = closeImageModal;

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
    DOM.body.classList.add('modal-open');

    DOM.body.style.cursor = 'auto';
    modal.style.cursor = 'auto';

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
        DOM.body.classList.remove('modal-open');
    }

    if (modalVideo) {
        modalVideo.pause();
        modalVideo.currentTime = 0;
        modalVideo.src = '';
    }

    DOM.body.style.cursor = '';
    if (videoModal) videoModal.style.cursor = '';
}

// Make closeModal globally accessible
window.closeModal = closeModal;

// ============= PHOTOGRAPHY MODAL =============
function openPhotographyModal(index) {
    state.currentModalIndex = index;
    state.isModalOpen = true;
    isModalInfoVisible = true; // Always reset to visible when opening

    const modal = DOM.imageModal;
    if (!modal) return;

    const photo = filteredPhotos[index];
    updatePhotographyModalContent(photo);

    modal.classList.add('active');
    DOM.body.style.overflow = 'hidden';

    // Ensure info is visible when opening
    const modalInfo = modal.querySelector('.modal-info');
    if (modalInfo) {
        modalInfo.classList.remove('hidden');
        modalInfo.style.opacity = '1';
        modalInfo.style.transform = 'translateY(0)';
        modalInfo.style.pointerEvents = 'auto';
        modalInfo.style.display = 'block';
        modalInfo.style.transition = 'all 0.3s ease';
    }

    // Setup button after modal is rendered
    setTimeout(() => {
        setupModalInfoButton();
    }, 100);

    // Handle cursor visibility
    if (utils.isMobile() || utils.isTouchDevice()) {
        document.body.style.cursor = 'auto';
        if (DOM.customCursor) {
            DOM.customCursor.style.display = 'none';
        }
    } else if (DOM.customCursor) {
        DOM.customCursor.style.display = 'block';
        document.body.style.cursor = 'none';
    }
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

    if (!utils.isMobile() && !utils.isTouchDevice() && DOM.customCursor) {
        DOM.customCursor.style.display = 'block';
    }
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

    // Re-setup modal info button after content update
    setTimeout(() => {
        setupModalInfoButton();
    }, 100);
}

// Make navigateModal globally accessible
window.navigateModal = navigateModal;

// ============= PROJECT INFO HELPER =============
function getProjectInfo(clickedElement) {
    let dualVideoItem = clickedElement.closest('.dual-video-item');
    if (dualVideoItem) {
        const metadata = dualVideoItem.querySelector('.video-metadata');
        if (metadata) {
            const clientName = metadata.querySelector('.client-name')?.textContent || 'Client';
            const projectTitle = metadata.querySelector('.project-title')?.textContent || 'Project';
            return { title: projectTitle, client: clientName };
        }
    }

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

    let videoSection = clickedElement.closest('.video-section');
    if (videoSection) {
        const metadata = videoSection.querySelector('.video-metadata');
        if (metadata) {
            const clientName = metadata.querySelector('.client-name')?.textContent || 'Client';
            const projectTitle = metadata.querySelector('.project-title')?.textContent || 'Project';
            return { title: projectTitle, client: clientName };
        }
    }

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

    const isPhotographyPage = document.querySelector('.photography-page') !== null;

    if (!isPhotographyPage) {
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

// ============= LAZY LOADING & VIDEO AUTOPLAY =============
function setupEnhancedFeedVideoAutoplay() {
    const feedVideos = document.querySelectorAll('.feed-video');

    const videoObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const video = entry.target;

            if (entry.isIntersecting && entry.intersectionRatio > 0.1) {
                video.play().catch(err => {
                    console.log(`Autoplay prevented: ${err.message}`);
                });
            } else {
                video.pause();
                video.currentTime = 0;
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '100px'
    });

    feedVideos.forEach((video) => {
        videoObserver.observe(video);

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
    // Exit early if mobile or touch device
    if (utils.isMobile() || utils.isTouchDevice()) {
        document.body.style.cursor = 'auto';
        return;
    }

    // Only run on photography page
    if (!document.querySelector('.photography-page')) return;

    let cursor = document.getElementById('customCursor');

    // Create cursor if it doesn't exist
    if (!cursor) {
        cursor = document.createElement('div');
        cursor.id = 'customCursor';
        cursor.className = 'custom-cursor';
        cursor.innerHTML = '<span class="cursor-text">VIEW</span>';
        document.body.appendChild(cursor);
    }

    DOM.customCursor = cursor;

    // Force cursor to be visible and properly styled
    cursor.style.position = 'fixed';
    cursor.style.width = '20px';
    cursor.style.height = '20px';
    cursor.style.background = 'white';
    cursor.style.borderRadius = '50%';
    cursor.style.pointerEvents = 'none';
    cursor.style.zIndex = '999999';
    cursor.style.transition = 'width 0.1s ease, height 0.1s ease, background 0.1s ease';
    cursor.style.mixBlendMode = 'difference';
    cursor.style.transform = 'translate(-50%, -50%)';
    cursor.style.display = 'block';
    cursor.style.opacity = '1';
    cursor.style.visibility = 'visible';

    // Hide default cursor on photography page
    document.body.style.cursor = 'none';

    // Smooth cursor movement with better performance
    let mouseX = 0, mouseY = 0;
    let cursorX = 0, cursorY = 0;
    let isOverPhoto = false;
    let isOverSpecialLink = false;

    function updateCursor() {
        cursorX += (mouseX - cursorX) * 0.1;
        cursorY += (mouseY - cursorY) * 0.1;
        cursor.style.left = cursorX + 'px';
        cursor.style.top = cursorY + 'px';
        requestAnimationFrame(updateCursor);
    }

    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;

        // Check if we're over a photo
        const photoElement = e.target.closest('.masonry-item');
        const specialLink = e.target.closest('.photographer-link, .modal-photographer, .modal-meta-item a');

        isOverPhoto = !!photoElement;
        isOverSpecialLink = !!specialLink;

        const cursorText = cursor.querySelector('.cursor-text');

        if (isOverSpecialLink) {
            // Over a special link - show OPEN
            if (cursorText) {
                cursorText.textContent = 'OPEN';
                cursorText.style.opacity = '1';
            }
        } else if (isOverPhoto) {
            // Over a photo but not a special link - show VIEW
            if (cursorText) {
                cursorText.textContent = 'VIEW';
                cursorText.style.opacity = '1';
            }
        } else {
            // Not over a photo - hide text
            if (cursorText) {
                cursorText.style.opacity = '0';
            }
        }
    });

    // Start the cursor animation loop
    updateCursor();

    // Setup photo hovers
    setupPhotoHovers();

    // Handle other interactive elements (not photos)
    document.querySelectorAll('a:not(.photographer-link), button, .theme-circle, .filter-btn').forEach(item => {
        item.addEventListener('mouseenter', () => {
            cursor.classList.add('hover');
            cursor.style.width = '80px';
            cursor.style.height = '80px';
            cursor.style.background = 'rgba(255, 255, 255, 0.1)';
            cursor.style.border = '2px solid white';
            cursor.style.backdropFilter = 'blur(10px)';

            const cursorText = cursor.querySelector('.cursor-text');
            if (cursorText) {
                cursorText.style.opacity = '0';
            }
        });

        item.addEventListener('mouseleave', () => {
            cursor.classList.remove('hover');
            cursor.style.width = '20px';
            cursor.style.height = '20px';
            cursor.style.background = document.body.classList.contains('white-theme') ? 'black' : 'white';
            cursor.style.border = 'none';
            cursor.style.backdropFilter = 'none';
        });
    });

    // White theme handling
    function updateCursorForTheme() {
        const isWhiteTheme = document.body.classList.contains('white-theme');
        if (isWhiteTheme) {
            cursor.style.background = 'black';
            const cursorText = cursor.querySelector('.cursor-text');
            if (cursorText) {
                cursorText.style.color = 'black';
            }
        } else {
            cursor.style.background = 'white';
            const cursorText = cursor.querySelector('.cursor-text');
            if (cursorText) {
                cursorText.style.color = 'white';
            }
        }
    }

    // Initial theme check
    updateCursorForTheme();

    // Listen for theme changes
    const observer = new MutationObserver(updateCursorForTheme);
    observer.observe(document.body, {
        attributes: true,
        attributeFilter: ['class']
    });
}

function setupPhotoHovers() {
    // Clear any existing event listeners first
    document.querySelectorAll('.masonry-item').forEach(item => {
        // Clone node to remove all event listeners
        const newItem = item.cloneNode(true);
        item.parentNode.replaceChild(newItem, item);
    });

    // Setup fresh event listeners
    document.querySelectorAll('.masonry-item').forEach(item => {
        item.addEventListener('mouseenter', () => {
            const cursor = document.getElementById('customCursor');
            if (cursor && !utils.isMobile() && !utils.isTouchDevice()) {
                cursor.classList.add('view');
                cursor.style.width = '100px';
                cursor.style.height = '100px';
                cursor.style.background = 'rgba(255, 255, 255, 0.05)';
                cursor.style.border = '2px solid white';
                cursor.style.backdropFilter = 'blur(15px)';

                const cursorText = cursor.querySelector('.cursor-text');
                if (cursorText) {
                    cursorText.style.opacity = '1';
                    cursorText.textContent = 'VIEW';
                }
            }

            // Ensure body cursor is still hidden on desktop
            if (!utils.isMobile() && !utils.isTouchDevice()) {
                document.body.style.cursor = 'none';
            }
        });

        item.addEventListener('mouseleave', () => {
            const cursor = document.getElementById('customCursor');
            if (cursor && !utils.isMobile() && !utils.isTouchDevice()) {
                cursor.classList.remove('view');
                cursor.style.width = '20px';
                cursor.style.height = '20px';
                cursor.style.background = document.body.classList.contains('white-theme') ? 'black' : 'white';
                cursor.style.border = 'none';
                cursor.style.backdropFilter = 'none';

                const cursorText = cursor.querySelector('.cursor-text');
                if (cursorText) {
                    cursorText.style.opacity = '0';
                }
            }
        });

        // Re-add click handlers
        item.addEventListener('click', () => {
            const photoId = parseInt(item.dataset.photoId);
            const indexInFiltered = filteredPhotos.findIndex(p => p.id === photoId);
            if (indexInFiltered !== -1) {
                openPhotographyModal(indexInFiltered);
            }
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
            if (e.key === 'i' || e.key === 'I') {
                toggleModalInfo();
            }
        }
    });

    // Modal backdrop click
    const imageModal = DOM.imageModal;
    if (imageModal) {
        imageModal.addEventListener('click', (e) => {
            if (e.target.id === 'imageModal' || e.target.classList.contains('modal-backdrop')) {
                closePhotographyModal();
            }
        });
    }

    // Modal navigation arrows
    const prevBtn = document.querySelector('.modal-nav.prev');
    const nextBtn = document.querySelector('.modal-nav.next');

    if (prevBtn) {
        prevBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            navigateModal(-1);
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            navigateModal(1);
        });
    }

    // Setup modal info button on page load
    setupModalInfoButton();
}

function initializePhotographyPortfolio() {
    if (document.getElementById('masonryGrid')) {
        DOM.body.classList.add('photography-page');
        renderPhotos(photographyData);
        setupCustomCursor();
        setupPhotographyEventListeners();

        // Multiple attempts to setup the modal info button
        setTimeout(() => {
            setupModalInfoButton();
        }, 500);
    }
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
            playPauseIcon.src = '/images/pause-icon.webp';
        }).catch(() => {
            playPauseIcon.src = '/images/play-icon.webp';
        });
    }

    setTimeout(tryAutoplay, 100);
    document.addEventListener('touchstart', tryAutoplay, { once: true });
    document.addEventListener('click', tryAutoplay, { once: true });

    playPauseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (video.paused) {
            video.play();
            playPauseIcon.src = '/images/pause-icon.webp';
        } else {
            video.pause();
            playPauseIcon.src = '/images/play-icon.webp';
        }
    });

    muteBtn.addEventListener('click', () => {
        video.muted = !video.muted;
        muteIcon.src = video.muted ? '/images/sound-off-icon.webp' : '/images/sound-on-icon.webp';
    });

    video.addEventListener('play', () => {
        playPauseIcon.src = '/images/pause-icon.webp';
    });

    video.addEventListener('pause', () => {
        playPauseIcon.src = '/images/play-icon.webp';
    });
}

// ============= CONTACT & FORM FUNCTIONS (abbreviated for space) =============
// [Include all your existing contact form functions here]
// Including: switchContactType, showNotifyForm, hideNotifyForm, etc.

// Make functions globally accessible
window.switchContactType = function(type) {
    // Your existing switchContactType code
};

window.showNotifyForm = function() {
    const overlay = document.getElementById('notifyFormOverlay');
    if (overlay) {
        overlay.classList.add('active');
        DOM.body.style.overflow = 'hidden';
    }
};

window.hideNotifyForm = function() {
    const overlay = document.getElementById('notifyFormOverlay');
    if (overlay) {
        overlay.classList.remove('active');
        DOM.body.style.overflow = '';
    }
};

window.showNotifySuccess = function() {
    const successModal = document.getElementById('notifySuccessModal');
    if (successModal) {
        successModal.style.display = 'flex';
        DOM.body.style.overflow = 'hidden';

        setTimeout(() => {
            successModal.classList.add('active');
        }, 50);

        setTimeout(() => {
            hideNotifySuccess();
        }, 4000);
    }
};

window.hideNotifySuccess = function() {
    const successModal = document.getElementById('notifySuccessModal');
    if (successModal) {
        successModal.classList.remove('active');

        setTimeout(() => {
            successModal.style.display = 'none';
            DOM.body.style.overflow = '';
        }, 300);
    }
};

// ============= MAIN INITIALIZATION =============
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('🚀 Initializing Ligero website...');

        // Initialize DOM cache
        DOM.carousel = document.getElementById('carousel');
        DOM.mobileMenuOverlay = document.querySelector('.mobile-menu-overlay');
        DOM.hamburger = document.querySelector('.hamburger-menu');
        DOM.videoModal = document.getElementById('videoModal');
        DOM.imageModal = document.getElementById('imageModal');
        DOM.bgVideo = document.getElementById('bgVideo');
        DOM.customCursor = document.getElementById('customCursor');

        // Reset states
        resetPageState();

        // Initialize mobile features FIRST
        initMobileFeatures();

        // Fix theme switcher positioning
        fixThemeSwitcherPosition();

        // Apply saved theme
        try {
            const savedTheme = localStorage.getItem('theme');
            if (savedTheme === 'white') {
                DOM.body.classList.add('white-theme');
            }
        } catch (e) {}

        // Setup carousel if present
        if (DOM.carousel) {
            resetCarousel();
            if (!utils.isMobile()) {
                // Carousel keyboard navigation and touch events
                document.addEventListener('keydown', (e) => {
                    if (e.key === 'ArrowLeft') slideCarousel(-1);
                    if (e.key === 'ArrowRight') slideCarousel(1);
                });
            }
        }

        // Setup video controls
        setupVideoControls();

        // Setup modals
        setupModalClicks();

        // Setup video autoplay
        setupEnhancedFeedVideoAutoplay();

        // Mobile menu
        if (DOM.hamburger) {
            DOM.hamburger.addEventListener('click', toggleMobileMenu);
        }

        // Handle window resize
        const handleResize = utils.debounce(() => {
            initMobileFeatures();
            fixThemeSwitcherPosition();
            resetCarousel();
            if (window.innerWidth > 768) {
                closeMobileMenu();
            }
        }, 250);

        window.addEventListener('resize', handleResize);

        // Initialize photography portfolio if on that page
        initializePhotographyPortfolio();

        // Handle modal close buttons
        const videoCloseBtn = document.querySelector('#videoModal .modal-close');
        const imageCloseBtn = document.querySelector('#imageModal .modal-close');

        if (videoCloseBtn) {
            videoCloseBtn.addEventListener('click', closeModal);
        }

        if (imageCloseBtn) {
            const isPhotographyPage = document.querySelector('.photography-page') !== null;
            imageCloseBtn.addEventListener('click', isPhotographyPage ? closePhotographyModal : closeImageModal);
        }

        // Escape key handler
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closeModal();
                if (document.querySelector('.photography-page')) {
                    closePhotographyModal();
                } else {
                    closeImageModal();
                }
            }
        });

        console.log('✅ Ligero website initialized successfully');

    } catch (error) {
        console.error('Error during initialization:', error);
        emergencyCleanup();
    }
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        if (state.isNavigating && Date.now() - state.lastNavigationTime > 3000) {
            emergencyCleanup();
        }
    }
});

// Handle browser back/forward
window.addEventListener('pageshow', function(event) {
    if (event.persisted) {
        resetPageState();
        initMobileFeatures();
        fixThemeSwitcherPosition();
    }
});

window.addEventListener('popstate', function() {
    resetPageState();
    initMobileFeatures();
    fixThemeSwitcherPosition();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    const allVideos = document.querySelectorAll('video');
    allVideos.forEach(video => {
        video.pause();
        video.currentTime = 0;
    });
});