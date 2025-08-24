// =========================
// OPTIMIZED LIGERO SCRIPT
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

    if (DOM.customCursor) {
        DOM.customCursor.style.display = 'block';
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

    if (DOM.customCursor) {
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
}

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

    const videoObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const video = entry.target;

            if (entry.isIntersecting && entry.intersectionRatio > 0.1) {
                video.play().catch(err => {
                    console.log(`⸻️ Autoplay prevented: ${err.message}`);
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
    const cursor = document.getElementById('customCursor');
    if (!cursor || utils.isMobile()) return;

    DOM.customCursor = cursor;

    document.body.appendChild(cursor);
    cursor.style.zIndex = '999999';

    document.addEventListener('mousemove', (e) => {
        cursor.style.left = e.clientX + 'px';
        cursor.style.top = e.clientY + 'px';
    });

    setupPhotoHovers();

    document.querySelectorAll('a, button, .theme-circle, .filter-btn').forEach(item => {
        item.addEventListener('mouseenter', () => {
            cursor.classList.add('hover');
        });

        item.addEventListener('mouseleave', () => {
            cursor.classList.remove('hover');
        });
    });

    document.addEventListener('mouseover', (e) => {
        const target = e.target;
        if (target.matches('.photographer-link, .modal-photographer, .modal-meta-item a')) {
            cursor.classList.add('open-mode');
            const cursorText = cursor.querySelector('.cursor-text');
            if (cursorText) {
                cursorText.textContent = 'OPEN';
            }
        }
    });

    document.addEventListener('mouseout', (e) => {
        const target = e.target;
        if (target.matches('.photographer-link, .modal-photographer, .modal-meta-item a')) {
            cursor.classList.remove('open-mode');
            const cursorText = cursor.querySelector('.cursor-text');
            if (cursorText) {
                cursorText.textContent = 'VIEW';
            }
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
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const category = this.dataset.category;
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            filterPhotos(category);
        });
    });

    document.addEventListener('keydown', (e) => {
        if (state.isModalOpen) {
            if (e.key === 'ArrowRight') navigateModal(1);
            if (e.key === 'ArrowLeft') navigateModal(-1);
            if (e.key === 'Escape') closePhotographyModal();
        }
    });

    const imageModal = DOM.imageModal;
    if (imageModal) {
        imageModal.addEventListener('click', (e) => {
            if (e.target.id === 'imageModal' || e.target.classList.contains('modal-backdrop')) {
                closePhotographyModal();
            }
        });
    }
}

function initializePhotographyPortfolio() {
    if (document.getElementById('masonryGrid')) {
        DOM.body.classList.add('photography-page');
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

// ============= ENHANCED NOTIFY FORM =============
function initEnhancedComingSoonPage() {
    const form = document.getElementById('notifyForm');
    if (form) {
        form.addEventListener('submit', handleNotifyFormSubmission);
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
            hideNotifySuccess();
            hideContactSuccess();
        }
    });
}

function handleNotifyFormSubmission(e) {
    e.preventDefault();
    const form = e.target;
    const emailInput = form.querySelector('input[type="email"]');
    const email = emailInput.value;

    if (email && isValidEmail(email)) {
        showNotifyLoading();

        const formData = new FormData(form);
        if (!formData.has('form-name')) {
            formData.append('form-name', 'notify-signup');
        }

        fetch('/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(formData).toString()
        })
            .then(() => {
                console.log('Notify form submitted successfully');
                hideNotifyForm();
                setTimeout(() => {
                    showNotifySuccess();
                }, 400);
                form.reset();
            })
            .catch(error => {
                console.error('Notify form submission error:', error);
                hideNotifyForm();
                setTimeout(() => {
                    showNotifySuccess();
                }, 400);
                form.reset();
            })
            .finally(() => {
                hideNotifyLoading();
            });
    } else {
        emailInput.style.animation = 'shake 0.5s ease-in-out';
        setTimeout(() => {
            emailInput.style.animation = '';
        }, 500);
    }
}

function showNotifyLoading() {
    const submitBtn = document.querySelector('#notifyForm button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'SENDING...';
    }
}

function hideNotifyLoading() {
    const submitBtn = document.querySelector('#notifyForm button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'NOTIFY ME';
    }
}

function showNotifySuccess() {
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
}

function hideNotifySuccess() {
    const successModal = document.getElementById('notifySuccessModal');
    if (successModal) {
        successModal.classList.remove('active');

        setTimeout(() => {
            successModal.style.display = 'none';
            DOM.body.style.overflow = '';
        }, 300);
    }
}

function showNotifyForm() {
    const overlay = document.getElementById('notifyFormOverlay');
    if (overlay) {
        overlay.classList.add('active');
        DOM.body.style.overflow = 'hidden';
        resetNotifyForm();
    }
}

function hideNotifyForm() {
    const overlay = document.getElementById('notifyFormOverlay');
    if (overlay) {
        overlay.classList.remove('active');
        DOM.body.style.overflow = '';

        setTimeout(() => {
            resetNotifyForm();
        }, 400);
    }
}

function resetNotifyForm() {
    const form = document.getElementById('notifyForm');
    const submitBtn = form?.querySelector('button[type="submit"]');

    if (form) {
        form.reset();
    }

    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'NOTIFY ME';
    }
}

// ============= MODERN CONTACT PAGE =============
let currentContactType = 'services';

function initModernContactPage() {
    const servicesForm = document.getElementById('servicesContactForm');
    const clothingForm = document.getElementById('clothingContactForm');

    if (servicesForm) {
        servicesForm.addEventListener('submit', handleContactFormSubmission);
    }

    if (clothingForm) {
        clothingForm.addEventListener('submit', handleContactFormSubmission);
    }

    setTimeout(() => {
        const servicesSection = document.getElementById('servicesForm');
        if (servicesSection) {
            servicesSection.classList.add('active');
        }
    }, 800);

    setupRealTimeValidation();
}

function handleContactFormSubmission(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('.submit-button');

    if (!validateContactForm(form)) return;

    showContactLoading(submitButton);

    const formData = new FormData(form);
    const formName = form.getAttribute('name');
    if (!formData.has('form-name') && formName) {
        formData.append('form-name', formName);
    }

    fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(formData).toString()
    })
        .then(response => {
            console.log('Contact form submitted successfully', response.status);
            showContactSuccess();
            form.reset();
        })
        .catch(error => {
            console.error('Contact form submission error:', error);
            showContactSuccess();
            form.reset();
        })
        .finally(() => {
            hideContactLoading(submitButton);
        });
}

function switchContactType(type) {
    if (currentContactType === type) return;

    const buttons = document.querySelectorAll('.type-selector-btn');
    const sections = document.querySelectorAll('.contact-form-section');

    buttons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.type === type) {
            btn.classList.add('active');
        }
    });

    sections.forEach(section => {
        if (section.classList.contains('active')) {
            section.style.opacity = '0';
            section.style.transform = 'translateY(20px)';

            setTimeout(() => {
                section.classList.remove('active');
                section.style.display = 'none';

                const newSection = document.getElementById(type + 'Form');
                if (newSection) {
                    newSection.style.display = 'block';
                    setTimeout(() => {
                        newSection.classList.add('active');
                    }, 50);
                }
            }, 200);
        }
    });

    currentContactType = type;
}

function validateContactForm(form) {
    const requiredFields = form.querySelectorAll('[required]');
    let isValid = true;
    const errors = [];

    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            isValid = false;
            addFieldError(field, 'This field is required');
            errors.push(field);
        } else {
            removeFieldError(field);
        }
    });

    const emailField = form.querySelector('input[type="email"]');
    if (emailField && emailField.value && !isValidEmail(emailField.value)) {
        isValid = false;
        addFieldError(emailField, 'Please enter a valid email address');
        errors.push(emailField);
    }

    const phoneField = form.querySelector('input[type="tel"]');
    if (phoneField && phoneField.value && !isValidPhone(phoneField.value)) {
        addFieldError(phoneField, 'Please enter a valid phone number');
    }

    if (errors.length > 0) {
        errors[0].focus();
        errors[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    return isValid;
}

function addFieldError(field, message) {
    removeFieldError(field);

    field.style.borderColor = '#ff6b6b';
    field.style.boxShadow = '0 0 0 3px rgba(255, 107, 107, 0.2)';

    const errorDiv = document.createElement('div');
    errorDiv.className = 'field-error';
    errorDiv.textContent = message;
    errorDiv.style.color = '#ff6b6b';
    errorDiv.style.fontSize = '0.85rem';
    errorDiv.style.marginTop = '5px';
    errorDiv.style.opacity = '0';
    errorDiv.style.animation = 'fadeInUp 0.3s ease forwards';

    field.parentNode.appendChild(errorDiv);

    field.addEventListener('input', () => removeFieldError(field), { once: true });
}

function removeFieldError(field) {
    field.style.borderColor = '';
    field.style.boxShadow = '';

    const existingError = field.parentNode.querySelector('.field-error');
    if (existingError) {
        existingError.remove();
    }
}

function isValidPhone(phone) {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
    return phoneRegex.test(cleaned) && cleaned.length >= 7;
}

function isValidEmail(email) {
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(email);
}

function showContactLoading(button) {
    if (button) {
        button.classList.add('loading');
        button.disabled = true;
        const buttonText = button.querySelector('.button-text');
        const buttonLoader = button.querySelector('.button-loader');

        if (buttonText) buttonText.style.display = 'none';
        if (buttonLoader) buttonLoader.style.display = 'block';
    }
}

function hideContactLoading(button) {
    if (button) {
        button.classList.remove('loading');
        button.disabled = false;
        const buttonText = button.querySelector('.button-text');
        const buttonLoader = button.querySelector('.button-loader');

        if (buttonText) buttonText.style.display = 'block';
        if (buttonLoader) buttonLoader.style.display = 'none';

        // Clear any lingering validation states
        const form = button.closest('form');
        if (form) {
            const phoneInput = form.querySelector('input[type="tel"]');
            if (phoneInput) {
                phoneInput.style.borderColor = '';
                phoneInput.style.boxShadow = '';
            }
        }
    }
}

function showContactSuccess() {
    const successElement = document.getElementById('contactSuccess');
    if (successElement) {
        successElement.style.display = 'flex';
        DOM.body.style.overflow = 'hidden';

        setTimeout(() => {
            successElement.classList.add('active');
        }, 50);
    }
}

function hideContactSuccess() {
    const successElement = document.getElementById('contactSuccess');
    if (successElement) {
        successElement.classList.remove('active');

        setTimeout(() => {
            successElement.style.display = 'none';
            DOM.body.style.overflow = '';
        }, 300);
    }
}

function resetContactForms() {
    hideContactSuccess();

    const forms = document.querySelectorAll('.modern-contact-form');
    forms.forEach(form => {
        form.reset();
        // Clear any validation errors
        const errorFields = form.querySelectorAll('.field-error');
        errorFields.forEach(error => error.remove());

        const inputsWithErrors = form.querySelectorAll('input.error, select.error, textarea.error');
        inputsWithErrors.forEach(input => {
            input.classList.remove('error');
            input.style.borderColor = '';
            input.style.boxShadow = '';
        });

        // Clear any red styling from all inputs
        const allInputs = form.querySelectorAll('input, select, textarea');
        allInputs.forEach(input => {
            input.style.borderColor = '';
            input.style.boxShadow = '';
        });
    });

    setTimeout(() => {
        switchContactType('services');
    }, 400);
}

function setupRealTimeValidation() {
    const formFields = document.querySelectorAll('.modern-contact-form input, .modern-contact-form select, .modern-contact-form textarea');

    formFields.forEach(field => {
        field.addEventListener('input', () => debouncedValidation(field));
        field.addEventListener('blur', () => {
            if (field.hasAttribute('required') && !field.value.trim()) {
                addFieldError(field, 'This field is required');
            }
        });
    });
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

// === PRODUCERS PAGE PLAYER ===
const tracks = [
    { id: 1, title: "Copy Cat", artist: "K1D", src: "/audio/track1.mp3" },
    { id: 2, title: "Electric Pulse", artist: "Sofia Rodriguez", src: "/audio/track2.mp3" },
    { id: 3, title: "Golden Hour", artist: "James Williams", src: "/audio/track3.mp3" },
    { id: 4, title: "Neon Nights", artist: "Luna Park", src: "/audio/track4.mp3" },
    { id: 5, title: "Urban Symphony", artist: "Alex Kim", src: "/audio/track5.mp3" }
];

let currentTrackId = null;
let isPlaying = false;
const audioPlayer = document.getElementById('audioPlayer');
const nowPlaying = document.getElementById('nowPlaying');
const progress = document.getElementById('progress');
const currentTimeEl = document.getElementById('currentTime');
const durationEl = document.getElementById('duration');

function playTrack(trackId) {
    const track = tracks.find(t => t.id === trackId);
    if (!track) return;

    document.querySelectorAll('.audio-track').forEach(el => {
        el.classList.remove('playing');
        el.querySelector('.play-btn').classList.remove('playing');
    });

    const trackElement = document.querySelector(`[data-track-id="${trackId}"]`);
    trackElement.classList.add('playing');
    trackElement.querySelector('.play-btn').classList.add('playing');

    document.getElementById('playingTitle').textContent = track.title;
    document.getElementById('playingArtist').textContent = track.artist;
    document.getElementById('miniPlayBtn').classList.remove('paused');
    nowPlaying.classList.add('active');
    currentTrackId = trackId;

    audioPlayer.src = track.src;

    audioPlayer.addEventListener('loadedmetadata', () => {
        const duration = audioPlayer.duration;
        const minutes = Math.floor(duration / 60);
        const seconds = Math.floor(duration % 60).toString().padStart(2, '0');
        durationEl.textContent = `${minutes}:${seconds}`;
    }, { once: true });

    audioPlayer.play();
    isPlaying = true;
}

function togglePlay() {
    if (!currentTrackId) return;

    if (isPlaying) {
        audioPlayer.pause();
        document.getElementById('miniPlayBtn').classList.add('paused');
    } else {
        audioPlayer.play();
        document.getElementById('miniPlayBtn').classList.remove('paused');
    }
    isPlaying = !isPlaying;
}

function previousTrack() {
    if (currentTrackId > 1) {
        playTrack(currentTrackId - 1);
    }
}

function nextTrack() {
    if (currentTrackId < tracks.length) {
        playTrack(currentTrackId + 1);
    }
}

let isDragging = false;
let progressBar = null;
let progressContainer = null;

audioPlayer?.addEventListener('timeupdate', () => {
    if (!isDragging && audioPlayer.duration) {
        const progressPercent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
        progress.style.width = `${progressPercent}%`;

        const minutes = Math.floor(audioPlayer.currentTime / 60);
        const seconds = Math.floor(audioPlayer.currentTime % 60).toString().padStart(2, '0');
        currentTimeEl.textContent = `${minutes}:${seconds}`;
    }
});

audioPlayer?.addEventListener('ended', () => {
    nextTrack();
});

function initProgressBar() {
    progressBar = document.getElementById('progressBar');
    progressContainer = document.querySelector('.progress-container');
    if (!progressBar || !progressContainer) return;

    const hoverIndicator = document.createElement('div');
    hoverIndicator.className = 'progress-hover';
    progressBar.appendChild(hoverIndicator);

    progressBar.addEventListener('mouseenter', handleProgressHover);
    progressBar.addEventListener('mousemove', handleProgressHover);
    progressBar.addEventListener('mouseleave', handleProgressLeave);
    progressBar.addEventListener('mousedown', startDragging);
    progressBar.addEventListener('click', seek);

    document.addEventListener('mousemove', handleDragging);
    document.addEventListener('mouseup', stopDragging);

    progressBar.addEventListener('touchstart', startDraggingTouch, { passive: false });
    document.addEventListener('touchmove', handleDraggingTouch, { passive: false });
    document.addEventListener('touchend', stopDraggingTouch);
}

function handleProgressHover(e) {
    if (!progressBar || !audioPlayer.duration) return;

    const rect = progressBar.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));

    const hoverIndicator = progressBar.querySelector('.progress-hover');
    if (hoverIndicator) {
        hoverIndicator.style.width = `${percentage}%`;
        hoverIndicator.style.opacity = '1';
    }

    const hoverTime = (percentage / 100) * audioPlayer.duration;
    const minutes = Math.floor(hoverTime / 60);
    const seconds = Math.floor(hoverTime % 60).toString().padStart(2, '0');

    let tooltip = progressBar.querySelector('.progress-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.className = 'progress-tooltip';
        progressBar.appendChild(tooltip);
    }

    tooltip.textContent = `${minutes}:${seconds}`;
    tooltip.style.left = `${percentage}%`;
    tooltip.style.opacity = '1';
}

function handleProgressLeave() {
    const hoverIndicator = progressBar?.querySelector('.progress-hover');
    const tooltip = progressBar?.querySelector('.progress-tooltip');

    if (hoverIndicator) hoverIndicator.style.opacity = '0';
    if (tooltip) tooltip.style.opacity = '0';
}

function startDragging(e) {
    if (!audioPlayer.duration) return;
    isDragging = true;
    progressBar.classList.add('dragging');
    updateProgress(e.clientX);
}

function startDraggingTouch(e) {
    if (!audioPlayer.duration) return;
    e.preventDefault();
    isDragging = true;
    progressBar.classList.add('dragging');
    updateProgress(e.touches[0].clientX);
}

function handleDragging(e) {
    if (!isDragging) return;
    e.preventDefault();
    updateProgress(e.clientX);
}

function handleDraggingTouch(e) {
    if (!isDragging) return;
    e.preventDefault();
    updateProgress(e.touches[0].clientX);
}

function stopDragging() {
    if (!isDragging) return;
    isDragging = false;
    progressBar?.classList.remove('dragging');

    if (progressBar && audioPlayer.duration) {
        const progressWidth = parseFloat(progress.style.width);
        const newTime = (progressWidth / 100) * audioPlayer.duration;
        audioPlayer.currentTime = newTime;
    }
}

function stopDraggingTouch() {
    if (!isDragging) return;
    isDragging = false;
    progressBar?.classList.remove('dragging');

    if (progressBar && audioPlayer.duration) {
        const progressWidth = parseFloat(progress.style.width);
        const newTime = (progressWidth / 100) * audioPlayer.duration;
        audioPlayer.currentTime = newTime;
    }
}

function updateProgress(clientX) {
    if (!progressBar || !audioPlayer.duration) return;

    const rect = progressBar.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));

    progress.style.width = `${percentage}%`;

    const newTime = (percentage / 100) * audioPlayer.duration;
    const minutes = Math.floor(newTime / 60);
    const seconds = Math.floor(newTime % 60).toString().padStart(2, '0');
    currentTimeEl.textContent = `${minutes}:${seconds}`;

    if (!isDragging) {
        audioPlayer.currentTime = newTime;
    }
}

function seek(e) {
    if (isDragging) return;
    if (!audioPlayer.duration) return;

    const rect = progressBar.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = (x / rect.width);
    audioPlayer.currentTime = audioPlayer.duration * percentage;
}

document.querySelectorAll('.audio-track').forEach(track => {
    track.addEventListener('click', (e) => {
        if (!e.target.closest('a') && !e.target.closest('.play-btn')) {
            const trackId = parseInt(track.dataset.trackId);
            playTrack(trackId);
        }
    });
});

function updateProducerControls() {
    const controlButtons = document.querySelectorAll('.control-btn');
    if (controlButtons.length >= 2) {
        controlButtons[0].innerHTML = '<img src="/images/next-icon.webp" alt="Previous" style="width: 20px; height: 20px;">';
        controlButtons[1].innerHTML = '<img src="/images/previous-icon.webp" alt="Next" style="width: 20px; height: 20px;">';
    }
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

            const isSamePage = href === window.location.pathname;
            if (isSamePage) return;

            e.preventDefault();
            e.stopPropagation();

            if (state.isNavigating) return;

            const isGoingHome = href === '/' || href.endsWith('index.html') || href === '';

            if (isGoingHome) {
                handleHomePageTransition(href);
            } else {
                handleSimplePageTransition(href);
            }

        } catch (error) {
            console.error('Error in navigation click handler:', error);
            emergencyCleanup();
        }
    });
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

// ============= MAIN INITIALIZATION =============
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('🚀 Initializing Ligero website...');

        DOM.carousel = document.getElementById('carousel');
        DOM.mobileMenuOverlay = document.querySelector('.mobile-menu-overlay');
        DOM.hamburger = document.querySelector('.hamburger-menu');
        DOM.videoModal = document.getElementById('videoModal');
        DOM.imageModal = document.getElementById('imageModal');
        DOM.bgVideo = document.getElementById('bgVideo');
        DOM.customCursor = document.getElementById('customCursor');

        resetPageState();
        initPageLoad();
        setupPageTransitions();

        try {
            const savedTheme = localStorage.getItem('theme');
            if (savedTheme === 'white') {
                DOM.body.classList.add('white-theme');
            }
        } catch (e) {}

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

        setupVideoControls();
        setupModalClicks();
        setupEnhancedFeedVideoAutoplay();

        if (DOM.hamburger) {
            DOM.hamburger.addEventListener('click', toggleMobileMenu);
        }

        document.querySelectorAll('.mobile-menu-item').forEach(item => {
            item.addEventListener('click', () => {
                setTimeout(closeMobileMenu, 100);
            });
        });

        if (DOM.mobileMenuOverlay) {
            DOM.mobileMenuOverlay.addEventListener('click', (e) => {
                if (e.target === DOM.mobileMenuOverlay) {
                    closeMobileMenu();
                }
            });
        }

        const handleResize = utils.debounce(() => {
            resetCarousel();
            if (window.innerWidth > 768) {
                closeMobileMenu();
            }
        }, 250);

        window.addEventListener('resize', handleResize);

        document.querySelectorAll('.theme-circle.white').forEach(el => {
            el.onclick = () => setTheme('white');
        });

        document.querySelectorAll('.theme-circle.black').forEach(el => {
            el.onclick = () => setTheme('black');
        });

        if (document.querySelector('.set-design-feed') ||
            document.querySelector('.designer-profile-page') ||
            document.querySelector('.electra-style-page')) {

            if (window.location.pathname.includes('creative-directing')) {
                DOM.body.classList.add('creative-directing-page');
            }

            if (!DOM.customCursor) {
                const cursor = document.createElement('div');
                cursor.id = 'customCursor';
                cursor.className = 'custom-cursor';
                cursor.style.display = 'none';
                document.body.appendChild(cursor);
                DOM.customCursor = cursor;
            }

            setTimeout(() => {
                setupImageLoading();
                setupEnhancedFeedVideoAutoplay();
                initializeModals();
            }, 100);
        }

        if (document.querySelector('.contact-page')) {
            initContactPage();
        }

        if (document.querySelector('.modern-contact-page')) {
            console.log('Initializing modern contact page...');
            initModernContactPage();
        }

        if (document.querySelector('.coming-soon-page')) {
            console.log('Initializing coming soon page...');
            initEnhancedComingSoonPage();
        }

        initializePhotographyPortfolio();

        if (document.querySelector('.producers-page')) {
            updateProducerControls();
            initProgressBar();
        }

        console.log('✅ Ligero website initialized successfully');

    } catch (error) {
        console.error('Error during initialization:', error);
        emergencyCleanup();
    }
});

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
        setTimeout(() => {
            try {
                const savedTheme = localStorage.getItem('theme');
                if (savedTheme === 'white') {
                    DOM.body.classList.add('white-theme');
                }
            } catch (e) {}
        }, 50);
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

setInterval(() => {
    if (state.isNavigating && Date.now() - state.lastNavigationTime > 2000) {
        console.warn('Navigation appears stuck, forcing cleanup...');
        emergencyCleanup();
        if (window.location.pathname.includes('services') && state.isNavigating) {
            window.location.reload();
        }
    }
}, 500);