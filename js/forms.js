// ================== FORMS.JS ==================
// Form handling and validation

const Forms = (() => {
    'use strict';

    // Configuration
    const config = {
        netlifyEndpoint: '/',
        submitDelay: 2000,
        errorDuration: 3000
    };

    // State
    const state = {
        isSubmitting: false,
        currentForm: null
    };

    // Form Validation Rules
    const validators = {
        required(value) {
            return value && value.trim().length > 0;
        },

        email(value) {
            return Core.utils.isValidEmail(value);
        },

        phone(value) {
            if (!value) return true; // Optional
            const phoneRegex = /^[\d\s\-\+\(\)]+$/;
            return phoneRegex.test(value) && value.replace(/\D/g, '').length >= 10;
        },

        minLength(value, length) {
            return value && value.length >= length;
        },

        maxLength(value, length) {
            return value && value.length <= length;
        }
    };

    // Floating Labels
    const floatingLabels = {
        init() {
            const fields = document.querySelectorAll('.form-field input, .form-field textarea, .form-field select');

            fields.forEach(field => {
                // Set initial state
                this.checkField(field);

                // Add event listeners
                field.addEventListener('focus', () => this.onFocus(field));
                field.addEventListener('blur', () => this.onBlur(field));
                field.addEventListener('input', () => this.onInput(field));
                field.addEventListener('change', () => this.checkField(field));
            });
        },

        onFocus(field) {
            field.parentElement.classList.add('focused');
        },

        onBlur(field) {
            field.parentElement.classList.remove('focused');
            this.checkField(field);
        },

        onInput(field) {
            this.checkField(field);
            this.clearError(field);
        },

        checkField(field) {
            if (field.value && field.value.trim() !== '') {
                field.parentElement.classList.add('has-value');
            } else {
                field.parentElement.classList.remove('has-value');
            }
        },

        clearError(field) {
            field.parentElement.classList.remove('error');
            const errorMsg = field.parentElement.querySelector('.error-message');
            if (errorMsg) {
                errorMsg.remove();
            }
        }
    };

    // Form Submission
    const submission = {
        init() {
            // Find all forms with data-form attribute
            document.querySelectorAll('form[data-form], form[netlify]').forEach(form => {
                form.addEventListener('submit', (e) => this.handleSubmit(e));
            });
        },

        async handleSubmit(event) {
            event.preventDefault();

            if (state.isSubmitting) return;

            const form = event.target;
            state.currentForm = form;

            // Validate
            if (!this.validateForm(form)) {
                this.showFormError('Please fill in all required fields correctly');
                return;
            }

            // Start loading
            this.setLoadingState(true, form);

            try {
                // Prepare data
                const formData = new FormData(form);

                // Submit to Netlify
                const response = await fetch(config.netlifyEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams(formData).toString()
                });

                if (response.ok) {
                    this.handleSuccess(form);
                } else {
                    throw new Error('Submission failed');
                }
            } catch (error) {
                console.error('Form submission error:', error);
                this.handleError(form, 'Something went wrong. Please try again.');
            } finally {
                this.setLoadingState(false, form);
            }
        },

        validateForm(form) {
            let isValid = true;

            // Validate required fields
            form.querySelectorAll('[required]').forEach(field => {
                if (!validators.required(field.value)) {
                    this.showFieldError(field, 'This field is required');
                    isValid = false;
                }
            });

            // Validate email fields
            form.querySelectorAll('input[type="email"]').forEach(field => {
                if (field.value && !validators.email(field.value)) {
                    this.showFieldError(field, 'Please enter a valid email');
                    isValid = false;
                }
            });

            // Validate phone fields
            form.querySelectorAll('input[type="tel"]').forEach(field => {
                if (field.value && !validators.phone(field.value)) {
                    this.showFieldError(field, 'Please enter a valid phone number');
                    isValid = false;
                }
            });

            return isValid;
        },

        showFieldError(field, message) {
            const parent = field.parentElement;
            parent.classList.add('error');

            // Remove existing error
            const existingError = parent.querySelector('.error-message');
            if (existingError) existingError.remove();

            // Add new error
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.textContent = message;
            parent.appendChild(errorDiv);
        },

        showFormError(message) {
            // Create toast notification
            const toast = document.createElement('div');
            toast.className = 'form-toast error';
            toast.textContent = message;
            document.body.appendChild(toast);

            // Animate in
            setTimeout(() => toast.classList.add('show'), 10);

            // Remove after duration
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }, config.errorDuration);
        },

        setLoadingState(loading, form) {
            state.isSubmitting = loading;
            const submitBtn = form.querySelector('[type="submit"]');

            if (!submitBtn) return;

            if (loading) {
                submitBtn.classList.add('loading');
                submitBtn.disabled = true;
            } else {
                submitBtn.classList.remove('loading');
                submitBtn.disabled = false;
            }
        },

        handleSuccess(form) {
            // Reset form
            form.reset();
            floatingLabels.init();

            // Show success modal or message
            if (window.Modals) {
                window.Modals.showSuccess({
                    title: 'Thank You!',
                    message: 'Your submission has been received. We\'ll be in touch soon.'
                });
            } else {
                this.showFormSuccess('Successfully submitted!');
            }

            // Trigger custom event
            window.dispatchEvent(new CustomEvent('formSubmitted', {
                detail: { form: form.getAttribute('name') || 'unknown' }
            }));
        },

        handleError(form, message) {
            this.showFormError(message);

            // Trigger custom event
            window.dispatchEvent(new CustomEvent('formError', {
                detail: {
                    form: form.getAttribute('name') || 'unknown',
                    error: message
                }
            }));
        },

        showFormSuccess(message) {
            const toast = document.createElement('div');
            toast.className = 'form-toast success';
            toast.textContent = message;
            document.body.appendChild(toast);

            setTimeout(() => toast.classList.add('show'), 10);

            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }
    };

    // Auto-resize textareas
    const autoResize = {
        init() {
            document.querySelectorAll('textarea[data-autoresize]').forEach(textarea => {
                textarea.addEventListener('input', () => this.resize(textarea));
                this.resize(textarea); // Initial resize
            });
        },

        resize(textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
        }
    };

    // Character counter
    const charCounter = {
        init() {
            document.querySelectorAll('[data-maxlength]').forEach(field => {
                const maxLength = parseInt(field.getAttribute('data-maxlength'));
                this.createCounter(field, maxLength);

                field.addEventListener('input', () => {
                    this.updateCounter(field, maxLength);
                });
            });
        },

        createCounter(field, maxLength) {
            const counter = document.createElement('div');
            counter.className = 'char-counter';
            counter.textContent = `0 / ${maxLength}`;
            field.parentElement.appendChild(counter);
        },

        updateCounter(field, maxLength) {
            const counter = field.parentElement.querySelector('.char-counter');
            const current = field.value.length;
            counter.textContent = `${current} / ${maxLength}`;

            if (current > maxLength) {
                counter.classList.add('exceeded');
            } else {
                counter.classList.remove('exceeded');
            }
        }
    };

    // Public API
    return {
        init() {
            floatingLabels.init();
            submission.init();
            autoResize.init();
            charCounter.init();

            console.log('Forms initialized');
        },

        // Expose methods
        validate: (form) => submission.validateForm(form),
        submit: (form) => submission.handleSubmit({ preventDefault: () => {}, target: form }),
        reset: (form) => {
            form.reset();
            floatingLabels.init();
        },

        // Validators
        validators,

        // Get state
        isSubmitting: () => state.isSubmitting
    };
})();

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Forms.init());
} else {
    Forms.init();
}

// Make globally available
window.Forms = Forms;