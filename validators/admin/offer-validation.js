// Offer validation for Admin Offer Management
document.addEventListener("DOMContentLoaded", function() {
    // Constants for validation
    const VALIDATION_RULES = {
        TITLE: {
            MIN_LENGTH: 3,
            MAX_LENGTH: 100,
            PATTERN: /^[a-zA-Z0-9\s\-:,.'&()]+$/
        },
        DESCRIPTION: {
            MAX_LENGTH: 500
        },
        DISCOUNT: {
            PERCENTAGE: {
                MIN: 1,
                MAX: 100
            },
            FIXED: {
                MIN: 1,
                MAX: 100000
            }
        }
    };

    // Error message display function
    function showError(input, message) {
        const formControl = input.closest('.mb-3');
        let errorElement = formControl.querySelector('.error-message');
        
        if (!errorElement) {
            errorElement = document.createElement('div');
            errorElement.className = 'error-message text-danger mt-1 small';
            formControl.appendChild(errorElement);
        }
        
        errorElement.textContent = message;
        input.classList.add('is-invalid');
        input.classList.remove('is-valid');
    }

    // Clear error messages
    function clearError(input) {
        const formControl = input.closest('.mb-3');
        const errorElement = formControl.querySelector('.error-message');
        
        if (errorElement) {
            errorElement.textContent = '';
        }
        
        input.classList.remove('is-invalid');
        input.classList.add('is-valid');
    }

    // Validate text field
    function validateTextField(input, rules, fieldName) {
        const value = input.value.trim();
        
        if (value === '' && input.hasAttribute('required')) {
            showError(input, `${fieldName} is required`);
            return false;
        }

        if (value !== '') {
            if (rules.MIN_LENGTH && value.length < rules.MIN_LENGTH) {
                showError(input, `${fieldName} must be at least ${rules.MIN_LENGTH} characters`);
                return false;
            }
            
            if (rules.MAX_LENGTH && value.length > rules.MAX_LENGTH) {
                showError(input, `${fieldName} must not exceed ${rules.MAX_LENGTH} characters`);
                return false;
            }
            
            if (rules.PATTERN && !rules.PATTERN.test(value)) {
                showError(input, `${fieldName} contains invalid characters`);
                return false;
            }
        }
        
        clearError(input);
        return true;
    }

    // Validate discount
    function validateDiscount(valueInput, typeSelect) {
        const value = parseFloat(valueInput.value);
        const type = typeSelect.value;
        
        if (isNaN(value) || value <= 0) {
            showError(valueInput, 'Please enter a valid discount value');
            return false;
        }
        
        if (type === 'percentage') {
            if (value < VALIDATION_RULES.DISCOUNT.PERCENTAGE.MIN || value > VALIDATION_RULES.DISCOUNT.PERCENTAGE.MAX) {
                showError(valueInput, `Percentage discount must be between ${VALIDATION_RULES.DISCOUNT.PERCENTAGE.MIN}% and ${VALIDATION_RULES.DISCOUNT.PERCENTAGE.MAX}%`);
                return false;
            }
        } else if (type === 'fixed') {
            if (value < VALIDATION_RULES.DISCOUNT.FIXED.MIN || value > VALIDATION_RULES.DISCOUNT.FIXED.MAX) {
                showError(valueInput, `Fixed discount must be between ₹${VALIDATION_RULES.DISCOUNT.FIXED.MIN} and ₹${VALIDATION_RULES.DISCOUNT.FIXED.MAX}`);
                return false;
            }
        }
        
        clearError(valueInput);
        return true;
    }

    // Validate dates
    function validateDates(startInput, endInput, isEdit = false) {
        const startDate = new Date(startInput.value);
        const endDate = new Date(endInput.value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (!startInput.value) {
            showError(startInput, 'Start date is required');
            return false;
        }
        
        if (!endInput.value) {
            showError(endInput, 'End date is required');
            return false;
        }
        
        if (!isEdit && startDate < today) {
            showError(startInput, 'Start date cannot be in the past');
            return false;
        }
        
        if (startDate >= endDate) {
            showError(endInput, 'End date must be after start date');
            return false;
        }
        
        clearError(startInput);
        clearError(endInput);
        return true;
    }

    // Validate applicable items selection
    function validateApplicableItems(appliesTo, form) {
        if (appliesTo === 'specific_products') {
            const selectedProducts = form.querySelectorAll('input[name="applicableProducts"]:checked');
            if (selectedProducts.length === 0) {
                showAlert('error', 'Please select at least one product');
                return false;
            }
        } else if (appliesTo === 'specific_categories') {
            const selectedCategories = form.querySelectorAll('input[name="applicableCategories"]:checked');
            if (selectedCategories.length === 0) {
                showAlert('error', 'Please select at least one category');
                return false;
            }
        }
        return true;
    }

    // Add real-time validation for both forms
    ['add', 'edit'].forEach(prefix => {
        const form = document.getElementById(`${prefix}OfferForm`);
        if (!form) return;

        const titleInput = document.getElementById(`${prefix}OfferTitle`);
        const descInput = document.getElementById(`${prefix}OfferDescription`);
        const discountTypeSelect = document.getElementById(`${prefix}DiscountType`);
        const discountValueInput = document.getElementById(`${prefix}DiscountValue`);
        const startDateInput = document.getElementById(`${prefix}StartDate`);
        const endDateInput = document.getElementById(`${prefix}EndDate`);
        const appliesToSelect = document.getElementById(`${prefix}AppliesTo`);

        // Real-time validation
        if (titleInput) {
            titleInput.addEventListener('input', () => validateTextField(titleInput, VALIDATION_RULES.TITLE, 'Title'));
        }
        
        if (descInput) {
            descInput.addEventListener('input', () => validateTextField(descInput, VALIDATION_RULES.DESCRIPTION, 'Description'));
        }
        
        if (discountValueInput && discountTypeSelect) {
            discountValueInput.addEventListener('input', () => validateDiscount(discountValueInput, discountTypeSelect));
            discountTypeSelect.addEventListener('change', () => validateDiscount(discountValueInput, discountTypeSelect));
        }
        
        if (startDateInput && endDateInput) {
            startDateInput.addEventListener('change', () => validateDates(startDateInput, endDateInput, prefix === 'edit'));
            endDateInput.addEventListener('change', () => validateDates(startDateInput, endDateInput, prefix === 'edit'));
        }
    });

    // Override form submission
    function validateOfferForm(form, isEdit = false) {
        const prefix = isEdit ? 'edit' : 'add';
        let isValid = true;

        // Get form elements
        const titleInput = document.getElementById(`${prefix}OfferTitle`);
        const descInput = document.getElementById(`${prefix}OfferDescription`);
        const discountTypeSelect = document.getElementById(`${prefix}DiscountType`);
        const discountValueInput = document.getElementById(`${prefix}DiscountValue`);
        const startDateInput = document.getElementById(`${prefix}StartDate`);
        const endDateInput = document.getElementById(`${prefix}EndDate`);
        const appliesToSelect = document.getElementById(`${prefix}AppliesTo`);

        // Validate all fields
        isValid = validateTextField(titleInput, VALIDATION_RULES.TITLE, 'Title') && isValid;
        if (descInput.value.trim()) {
            isValid = validateTextField(descInput, VALIDATION_RULES.DESCRIPTION, 'Description') && isValid;
        }
        isValid = validateDiscount(discountValueInput, discountTypeSelect) && isValid;
        isValid = validateDates(startDateInput, endDateInput, isEdit) && isValid;
        isValid = validateApplicableItems(appliesToSelect.value, form) && isValid;

        return isValid;
    }

    // Override the create offer button click
    const createOfferBtn = document.getElementById('createOfferBtn');
    if (createOfferBtn) {
        const originalClickHandler = createOfferBtn.onclick;
        createOfferBtn.onclick = function(e) {
            e.preventDefault();
            const form = document.getElementById('addOfferForm');
            if (validateOfferForm(form, false)) {
                originalClickHandler.call(this);
            }
        };
    }

    // Override the update offer button click
    const updateOfferBtn = document.getElementById('updateOfferBtn');
    if (updateOfferBtn) {
        const originalClickHandler = updateOfferBtn.onclick;
        updateOfferBtn.onclick = function(e) {
            e.preventDefault();
            const form = document.getElementById('editOfferForm');
            if (validateOfferForm(form, true)) {
                originalClickHandler.call(this);
            }
        };
    }

    // Add styles for validation UI
    const style = document.createElement('style');
    style.textContent = `
        .error-message {
            color: #dc3545;
            font-size: 0.875em;
            margin-top: 0.25rem;
        }
        .is-invalid {
            border-color: #dc3545 !important;
            padding-right: calc(1.5em + 0.75rem);
            background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' width='12' height='12' fill='none' stroke='%23dc3545'%3e%3ccircle cx='6' cy='6' r='4.5'/%3e%3cpath stroke-linejoin='round' d='M5.8 3.6h.4L6 6.5z'/%3e%3ccircle cx='6' cy='8.2' r='.6' fill='%23dc3545' stroke='none'/%3e%3c/svg%3e");
            background-repeat: no-repeat;
            background-position: right calc(0.375em + 0.1875rem) center;
            background-size: calc(0.75em + 0.375rem) calc(0.75em + 0.375rem);
        }
        .is-valid {
            border-color: #198754 !important;
            padding-right: calc(1.5em + 0.75rem);
            background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'%3e%3cpath fill='%23198754' d='M2.3 6.73L.6 4.53c-.4-1.04.46-1.4 1.1-.8l1.1 1.4 3.4-3.8c.6-.63 1.6-.27 1.2.7l-4 4.6c-.43.5-.8.4-1.1.1z'/%3e%3c/svg%3e");
            background-repeat: no-repeat;
            background-position: right calc(0.375em + 0.1875rem) center;
            background-size: calc(0.75em + 0.375rem) calc(0.75em + 0.375rem);
        }
    `;
    document.head.appendChild(style);
}); 