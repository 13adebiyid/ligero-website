// ================== MODALS.JS ==================
// Modal system for videos, images, and notifications

const Modals = (() => {
    'use strict';

    // State
    const state = {
        activeModal: null,
        isOpen: false,
        modalStack: []
    };

    // Modal Types
    const types = {
        VIDEO: 'video',
        IMAGE: 'image',
        SUCCESS: 'success',
        ERROR: 'error',
        CONFIRM: 'confirm',
        CUSTOM: 'custom'
    };

    // Base Modal Class
    class Modal {
        constructor(options = {}) {
            this.id = options.id || `modal-${Date.now()}`;
            this.type = options.type || types.CUSTOM;
            this.content = options.content || '';
            this.closable = options.closable !== false;
            this.backdrop = options.backdrop !== false;
            this.onClose = options.onClose || null;
            this.onOpen = options.onOpen || null;
            this.element = null;

            this.create();
        }

        create() {
            // Create modal element
            this.element = document.createElement('div');
            this.element.className = `modal modal-${this.type}`;
            this.element.id = this.id;

            // Add backdrop
            if (this.backdrop) {
                const backdrop = document.createElement('div');
                backdrop.className = 'modal-backdrop';
                backdrop.addEventListener('click', () => {
                    if (this.closable) this.close();
                });
                this.element.appendChild(backdrop);
            }

            // Add content container
            const container = document.createElement('div');
            container.className = 'modal-container';

            // Add close button
            if (this.closable) {
                const closeBtn = document.createElement('button');
                closeBtn.className = 'modal-close';
                closeBtn.innerHTML = '×';
                closeBtn.addEventListener('click', () => this.close());
                container.appendChild(closeBtn);
            }

            // Add content
            const content = document.createElement('div');
            content.className = 'modal-content';
            content.innerHTML = this.content;
            container.appendChild(content);

            this.element.appendChild(container);
        }

        open() {
            if (!this.element) this.create();

            // Add to DOM
            document.body.appendChild(this.element);

            // Trigger reflow
            this.element.offsetHeight;

            // Add active class
            this.element.classList.add('active');
            document.body.style.overflow = 'hidden';

            // Update state
            state.activeModal = this;
            state.isOpen = true;
            state.modalStack.push(this);

            // Callback
            if (this.onOpen) this.onOpen(this);

            // Add escape listener
            this.escapeHandler = (e) => {
                if (e.key === 'Escape' && this.closable) {
                    this.close();
                }
            };
            document.addEventListener('keydown', this.escapeHandler);
        }

        close() {
            if (!this.element) return;

            // Remove active class
            this.element.classList.remove('active');

            // Remove from DOM after animation
            setTimeout(() => {
                if (this.element && this.element.parentNode) {
                    this.element.parentNode.removeChild(this.element);
                }
            }, 300);

            // Update state
            state.modalStack = state.modalStack.filter(m => m !== this);

            if (state.modalStack.length === 0) {
                state.activeModal = null;
                state.isOpen = false;
                document.body.style.overflow = '';
            } else {
                state.activeModal = state.modalStack[state.modalStack.length - 1];
            }

            // Remove escape listener
            if (this.escapeHandler) {
                document.removeEventListener('keydown', this.escapeHandler);
            }

            // Callback
            if (this.onClose) this.onClose(this);
        }

        destroy() {
            this.close();
            this.element = null;
        }
    }

    // Video Modal
    class VideoModal extends Modal {
        constructor(options) {
            super({
                ...options,
                type: types.VIDEO
            });

            this.videoSrc = options.src || '';
            this.title = options.title || '';
            this.client = options.client || '';
            this.autoplay = options.autoplay !== false;
        }

        create() {
            this.content = `
                <div class="modal-header">
                    <h2 class="modal-title">${this.title}</h2>
                    <div class="modal-client">${this.client}</div>
                </div>
                <div class="modal-video-wrap">
                    <video class="modal-video" controls ${this.autoplay ? 'autoplay' : ''}>
                        <source src="${this.videoSrc}" type="video/mp4">
                        Your browser does not support the video tag.
                    </video>
                </div>
            `;

            super.create();

            // Get video element
            this.video = this.element.querySelector('.modal-video');
        }

        open() {
            super.open();

            // Play video
            if (this.video && this.autoplay) {
                this.video.play().catch(err => {
                    console.log('Autoplay prevented:', err);
                });
            }
        }

        close() {
            // Pause video
            if (this.video) {
                this.video.pause();
                this.video.currentTime = 0;
            }

            super.close();
        }
    }

    // Image Modal
    class ImageModal extends Modal {
        constructor(options) {
            super({
                ...options,
                type: types.IMAGE
            });

            this.imageSrc = options.src || '';
            this.title = options.title || '';
            this.description = options.description || '';
            this.metadata = options.metadata || {};
        }

        create() {
            const metaHTML = Object.entries(this.metadata).map(([key, value]) => `
                <div class="modal-meta-item">
                    <span class="modal-meta-label">${key}</span>
                    <span class="modal-meta-value">${value}</span>
                </div>
            `).join('');

            this.content = `
                <div class="modal-image-container">
                    <img class="modal-image" src="${this.imageSrc}" alt="${this.title}">
                </div>
                ${this.title || this.description || metaHTML ? `
                    <div class="modal-info">
                        ${this.title ? `<h3 class="modal-title">${this.title}</h3>` : ''}
                        ${this.description ? `<p class="modal-description">${this.description}</p>` : ''}
                        ${metaHTML ? `<div class="modal-meta">${metaHTML}</div>` : ''}
                    </div>
                ` : ''}
            `;

            super.create();
        }
    }

    // Success Modal
    class SuccessModal extends Modal {
        constructor(options) {
            super({
                ...options,
                type: types.SUCCESS
            });

            this.title = options.title || 'Success';
            this.message = options.message || '';
            this.autoClose = options.autoClose !== false;
            this.autoCloseDelay = options.autoCloseDelay || 5000;
        }

        create() {
            this.content = `
                <div class="success-content">
                    <div class="checkmark-wrapper">
                        <svg class="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                            <circle class="checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
                            <path class="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
                        </svg>
                    </div>
                    <h3 class="success-title">${this.title}</h3>
                    ${this.message ? `<p class="success-message">${this.message}</p>` : ''}
                </div>
            `;

            super.create();
        }

        open() {
            super.open();

            // Auto close
            if (this.autoClose) {
                this.autoCloseTimer = setTimeout(() => {
                    this.close();
                }, this.autoCloseDelay);
            }
        }

        close() {
            if (this.autoCloseTimer) {
                clearTimeout(this.autoCloseTimer);
            }

            super.close();
        }
    }

    // Quick methods
    const quick = {
        video(src, title = '', client = '') {
            const modal = new VideoModal({ src, title, client });
            modal.open();
            return modal;
        },

        image(src, title = '', description = '') {
            const modal = new ImageModal({ src, title, description });
            modal.open();
            return modal;
        },

        success(title = 'Success', message = '') {
            const modal = new SuccessModal({ title, message });
            modal.open();
            return modal;
        },

        error(title = 'Error', message = '') {
            const modal = new Modal({
                type: types.ERROR,
                content: `
                    <div class="error-content">
                        <div class="error-icon">⚠</div>
                        <h3 class="error-title">${title}</h3>
                        <p class="error-message">${message}</p>
                    </div>
                `
            });
            modal.open();
            return modal;
        },

        confirm(message, onConfirm, onCancel) {
            const modal = new Modal({
                type: types.CONFIRM,
                closable: false,
                content: `
                    <div class="confirm-content">
                        <p class="confirm-message">${message}</p>
                        <div class="confirm-buttons">
                            <button class="btn-confirm">Confirm</button>
                            <button class="btn-cancel">Cancel</button>
                        </div>
                    </div>
                `
            });

            modal.open();

            // Add button handlers
            const confirmBtn = modal.element.querySelector('.btn-confirm');
            const cancelBtn = modal.element.querySelector('.btn-cancel');

            confirmBtn.addEventListener('click', () => {
                modal.close();
                if (onConfirm) onConfirm();
            });

            cancelBtn.addEventListener('click', () => {
                modal.close();
                if (onCancel) onCancel();
            });

            return modal;
        }
    };

    // Auto-init modal triggers
    const autoInit = {
        init() {
            // Video modals
            document.querySelectorAll('[data-modal-video]').forEach(trigger => {
                trigger.addEventListener('click', (e) => {
                    e.preventDefault();
                    const src = trigger.getAttribute('data-modal-video');
                    const title = trigger.getAttribute('data-modal-title') || '';
                    const client = trigger.getAttribute('data-modal-client') || '';
                    quick.video(src, title, client);
                });
            });

            // Image modals
            document.querySelectorAll('[data-modal-image]').forEach(trigger => {
                trigger.addEventListener('click', (e) => {
                    e.preventDefault();
                    const src = trigger.getAttribute('data-modal-image');
                    const title = trigger.getAttribute('data-modal-title') || '';
                    const description = trigger.getAttribute('data-modal-description') || '';
                    quick.image(src, title, description);
                });
            });
        }
    };

    // Public API
    return {
        init() {
            autoInit.init();
            console.log('Modals initialized');
        },

        // Classes
        Modal,
        VideoModal,
        ImageModal,
        SuccessModal,

        // Quick methods
        ...quick,
        showSuccess: (options) => {
            const modal = new SuccessModal(options);
            modal.open();
            return modal;
        },

        // Close all
        closeAll() {
            [...state.modalStack].forEach(modal => modal.close());
        },

        // Get state
        isOpen: () => state.isOpen,
        getActive: () => state.activeModal,
        types
    };
})();

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Modals.init());
} else {
    Modals.init();
}

// Make globally available
window.Modals = Modals;