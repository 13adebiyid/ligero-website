// ================== CONTACT.JS (Page Specific) ==================
// Contact page specific functionality

const ContactPage = (() => {
    'use strict';

    // State
    const state = {
        currentView: 'selection',
        selectedType: null
    };

    // DOM Elements
    const DOM = {
        hero: null,
        selection: null,
        clothingForm: null,
        servicesForm: null,
        successModal: null,

        init() {
            this.hero = document.querySelector('.contact-hero');
            this.selection = document.querySelector('.enquiry-selection');
            this.clothingForm = document.getElementById('clothingForm');
            this.servicesForm = document.getElementById('servicesForm');
            this.successModal = document.getElementById('successModal');
        }
    };

    // Enquiry Selection
    const enquirySelection = {
        init() {
            // Check URL params for pre-selection
            const urlParams = new URLSearchParams(window.location.search);
            const preselect = urlParams.get('type');

            if (preselect === 'clothing' || preselect === 'services') {
                this.selectType(preselect);
            }

            // Setup card animations
            this.setupCardAnimations();
        },

        setupCardAnimations() {
            const cards = document.querySelectorAll('.enquiry-card');

            cards.forEach(card => {
                card.addEventListener('mouseenter', () => {
                    card.style.transform = 'translateY(-5px)';
                });

                card.addEventListener('mouseleave', () => {
                    card.style.transform = 'translateY(0)';
                });
            });
        },

        selectType(type) {
            state.selectedType = type;
            state.currentView = 'form';

            // Fade out selection
            DOM.selection.style.opacity = '0';
            DOM.selection.style.transform = 'translateY(-20px)';
            DOM.hero.style.opacity = '0';

            setTimeout(() => {
                DOM.selection.style.display = 'none';
                DOM.hero.style.display = 'none';

                // Show appropriate form
                const form = type === 'clothing' ? DOM.clothingForm : DOM.servicesForm;
                form.style.display = 'block';

                // Trigger form animations
                setTimeout(() => {
                    form.style.opacity = '1';
                    // Re-initialize form fields
                    if (window.Forms) {
                        window.Forms.init();
                    }
                }, 50);
            }, 300);
        },

        backToSelection() {
            state.currentView = 'selection';
            state.selectedType = null;

            // Hide forms
            DOM.clothingForm.style.display = 'none';
            DOM.servicesForm.style.display = 'none';

            // Show selection
            DOM.hero.style.display = 'flex';
            DOM.selection.style.display = 'flex';

            setTimeout(() => {
                DOM.hero.style.opacity = '1';
                DOM.selection.style.opacity = '1';
                DOM.selection.style.transform = 'translateY(0)';
            }, 50);
        }
    };

    // Form Enhancements
    const formEnhancements = {
        init() {
            // Add custom validation messages
            this.setupCustomValidation();

            // Setup form submission handlers
            this.setupFormHandlers();
        },

        setupCustomValidation() {
            // Phone number formatting
            document.querySelectorAll('input[type="tel"]').forEach(input => {
                input.addEventListener('input', (e) => {
                    let value = e.target.value.replace(/\D/g, '');
                    if (value.length > 0) {
                        if (value.length <= 3) {
                            value = value;
                        } else if (value.length <= 6) {
                            value = value.slice(0, 3) + '-' + value.slice(3);
                        } else {
                            value = value.slice(0, 3) + '-' + value.slice(3, 6) + '-' + value.slice(6, 10);
                        }
                    }
                    e.target.value = value;
                });
            });

            // Budget range validation
            document.querySelectorAll('select[name="budget"]').forEach(select => {
                select.addEventListener('change', (e) => {
                    const value = e.target.value;
                    if (value && value !== 'discuss') {
                        // Add visual feedback
                        e.target.parentElement.classList.add('budget-selected');
                    }
                });
            });
        },

        setupFormHandlers() {
            const forms = document.querySelectorAll('.enquiry-form');

            forms.forEach(form => {
                form.addEventListener('submit', async (e) => {
                    e.preventDefault();

                    // Let Forms.js handle the submission
                    if (window.Forms) {
                        // The Forms module will handle this
                        return;
                    }

                    // Fallback if Forms.js isn't loaded
                    this.handleFormSubmit(e);
                });
            });
        },

        async handleFormSubmit(event) {
            const form = event.target;
            const submitBtn = form.querySelector('.submit-btn');

            // Show loading
            submitBtn.classList.add('loading');
            submitBtn.disabled = true;

            try {
                const formData = new FormData(form);
                const response = await fetch('/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams(formData).toString()
                });

                if (response.ok) {
                    this.showSuccess();
                    form.reset();
                } else {
                    throw new Error('Submission failed');
                }
            } catch (error) {
                console.error('Form submission error:', error);
                alert('There was an error. Please try again.');
            } finally {
                submitBtn.classList.remove('loading');
                submitBtn.disabled = false;
            }
        },

        showSuccess() {
            DOM.successModal.classList.add('active');

            // Auto close after 5 seconds
            setTimeout(() => {
                this.closeSuccess();
            }, 5000);
        },

        closeSuccess() {
            DOM.successModal.classList.remove('active');

            // Return to selection after modal closes
            setTimeout(() => {
                enquirySelection.backToSelection();
            }, 400);
        }
    };

    // AOS-like Animations
    const animations = {
        init() {
            const observerOptions = {
                threshold: 0.1,
                rootMargin: '0px 0px -50px 0px'
            };

            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.style.opacity = '1';
                        entry.target.style.transform = 'translateY(0)';
                        observer.unobserve(entry.target);
                    }
                });
            }, observerOptions);

            // Observe elements with data-aos
            document.querySelectorAll('[data-aos]').forEach(el => {
                el.style.opacity = '0';
                el.style.transform = 'translateY(30px)';
                el.style.transition = 'all 0.6s ease';

                const delay = el.getAttribute('data-aos-delay');
                if (delay) {
                    el.style.transitionDelay = `${delay}ms`;
                }

                observer.observe(el);
            });
        }
    };

    // Public API
    return {
        init() {
            DOM.init();
            enquirySelection.init();
            formEnhancements.init();
            animations.init();

            console.log('Contact page initialized');
        },

        // Expose methods for global use
        selectEnquiryType: (type) => enquirySelection.selectType(type),
        backToSelection: () => enquirySelection.backToSelection(),
        closeSuccessModal: () => formEnhancements.closeSuccess()
    };
})();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ContactPage.init());
} else {
    ContactPage.init();
}

// Make methods globally available for onclick handlers
window.selectEnquiryType = ContactPage.selectEnquiryType;
window.backToSelection = ContactPage.backToSelection;
window.closeSuccessModal = ContactPage.closeSuccessModal;