let currentSlide = 0;

function showPage(page) {
    // Hide all pages and remove active class
    document.getElementById('home-page').style.display = 'none';
    document.getElementById('shop-page').style.display = 'none';
    document.getElementById('services-page').style.display = 'none';
    document.getElementById('policies-page').style.display = 'none';

    // Remove active class from services page
    document.getElementById('services-page').classList.remove('active');

    // Show selected page
    if (page === 'home') {
        document.getElementById('home-page').style.display = 'flex';
    } else if (page === 'services') {
        document.getElementById('services-page').style.display = 'block';
        document.getElementById('services-page').classList.add('active');
    } else {
        document.getElementById(page + '-page').style.display = 'block';
    }
}

function setTheme(theme) {
    if (theme === 'white') {
        document.body.classList.add('white-theme');
    } else {
        document.body.classList.remove('white-theme');
    }
}

function slideCarousel(direction) {
    const carousel = document.getElementById('carousel');
    const cards = carousel.querySelectorAll('.service-card');
    const totalCards = cards.length;

    if (totalCards === 0) {
        console.error('No service cards found!');
        return;
    }

    const cardWidth = 750;
    const cardGap = 40;
    const containerWidth = window.innerWidth - 240; // Account for carousel padding
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
        translateX = Math.min(
             // Regular calculation
            -(totalCarouselWidth - containerWidth + 400) // Ensure last card is fully visible with 20px margin
        );
    } else {
        translateX = -(currentSlide * (cardWidth + cardGap));
    }

    carousel.style.transform = `translateX(${translateX}px)`;

    console.log(`Direction: ${direction}, Current slide: ${currentSlide}, Max slide: ${maxSlide}, Cards visible: ${cardsVisible}, Translate: ${translateX}px`);
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('Page loaded, initializing...');

    // Initialize carousel
    const carousel = document.getElementById('carousel');
    if (carousel) {
        carousel.style.transition = 'transform 0.3s ease';
        console.log('Carousel found and initialized');

        // Check if cards exist
        const cards = carousel.querySelectorAll('.service-card');
        console.log(`Found ${cards.length} service cards`);
        cards.forEach((card, index) => {
            console.log(`Card ${index}:`, card.textContent);
        });
    } else {
        console.error('Carousel not found!');
    }

    // Show home page by default
    showPage('home');

    // Reset carousel position
    currentSlide = 0;
    if (carousel) {
        carousel.style.transform = 'translateX(0px)';
    }
});