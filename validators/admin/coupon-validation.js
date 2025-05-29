// Coupon validation for Admin Coupon Management
document.addEventListener("DOMContentLoaded", function() {
    // Constants for validation
    const VALIDATION_RULES = {
        CODE: {
            MIN_LENGTH: 3,
            MAX_LENGTH: 20,
            PATTERN: /^[A-Z0-9\-_]+$/
        },
        DESCRIPTION: {
            MAX_LENGTH: 500
        },
        DISCOUNT: {
            PERCENTAGE: {
                MIN: 1,
                MAX: 90  // Maximum 90% discount allowed
            },
            FIXED: {
                MIN: 1,
                MAX: 10000  // Maximum ₹10,000 fixed discount
            }
        },
        MIN_ORDER: {
            MIN: 1,  // Minimum order amount must be at least ₹1
            MAX: 1000000
        },
        USAGE_LIMIT: {
            MIN: 1,
            MAX: 10000
        },
        MAX_DISCOUNT: {
            MIN: 1,
            MAX: 10000  // Maximum cap for percentage discounts
        }
    };

    // Helper function to show error with both field feedback and optional alert
    function showError(input, message, showAlert = false) {
        const formControl = input.closest('.mb-3');
        input.classList.add('is-invalid');
        
        // Create or update error message div
        let errorDiv = formControl.querySelector('.invalid-feedback');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.className = 'invalid-feedback';
            formControl.appendChild(errorDiv);
        }
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';  // Ensure error is visible

        // Show alert if requested
        if (showAlert && typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'error',
                title: 'Validation Error',
                text: message,
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });
        }
    }

    // Helper function to clear error
    function clearError(input) {
        input.classList.remove('is-invalid');
        const formControl = input.closest('.mb-3');
        const errorDiv = formControl.querySelector('.invalid-feedback');
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }
    }

    // Validate coupon code
    function validateCode(input) {
        const value = input.value.trim().toUpperCase();
        
        if (!value) {
            showError(input, 'Coupon code is required');
            return false;
        }

        if (value.length < VALIDATION_RULES.CODE.MIN_LENGTH) {
            showError(input, `Code must be at least ${VALIDATION_RULES.CODE.MIN_LENGTH} characters`);
            return false;
        }

        if (value.length > VALIDATION_RULES.CODE.MAX_LENGTH) {
            showError(input, `Code cannot exceed ${VALIDATION_RULES.CODE.MAX_LENGTH} characters`);
            return false;
        }

        if (!VALIDATION_RULES.CODE.PATTERN.test(value)) {
            showError(input, 'Code can only contain uppercase letters, numbers, hyphens, and underscores');
            return false;
        }

        clearError(input);
        return true;
    }

    // Validate description
    function validateDescription(input) {
        const value = input.value.trim();
        
        if (value.length > VALIDATION_RULES.DESCRIPTION.MAX_LENGTH) {
            showError(input, `Description cannot exceed ${VALIDATION_RULES.DESCRIPTION.MAX_LENGTH} characters`);
            return false;
        }

        clearError(input);
        return true;
    }

    // Validate discount
    function validateDiscount(valueInput, typeSelect, maxDiscountInput) {
        const value = parseFloat(valueInput.value);
        const type = typeSelect.value;
        
        if (isNaN(value) || value <= 0) {
            showError(valueInput, 'Please enter a valid discount value');
            return false;
        }

        if (type === 'percentage') {
            if (value < VALIDATION_RULES.DISCOUNT.PERCENTAGE.MIN || 
                value > VALIDATION_RULES.DISCOUNT.PERCENTAGE.MAX) {
                showError(valueInput, `Percentage must be between ${VALIDATION_RULES.DISCOUNT.PERCENTAGE.MIN}% and ${VALIDATION_RULES.DISCOUNT.PERCENTAGE.MAX}%`);
                return false;
            }

            // Validate max discount for percentage type
            if (maxDiscountInput) {
                const maxValue = parseFloat(maxDiscountInput.value);
                if (!maxValue && value > 50) {
                    showError(maxDiscountInput, 'Maximum discount amount is required for discounts over 50%');
                    return false;
                }
                if (maxValue) {
                    if (isNaN(maxValue) || maxValue < VALIDATION_RULES.MAX_DISCOUNT.MIN) {
                        showError(maxDiscountInput, 'Maximum discount must be greater than 0');
                        return false;
                    }
                    if (maxValue > VALIDATION_RULES.MAX_DISCOUNT.MAX) {
                        showError(maxDiscountInput, `Maximum discount cannot exceed ₹${VALIDATION_RULES.MAX_DISCOUNT.MAX}`);
                        return false;
                    }
                }
                clearError(maxDiscountInput);
            }
        } else {
            if (value < VALIDATION_RULES.DISCOUNT.FIXED.MIN || 
                value > VALIDATION_RULES.DISCOUNT.FIXED.MAX) {
                showError(valueInput, `Fixed amount must be between ₹${VALIDATION_RULES.DISCOUNT.FIXED.MIN} and ₹${VALIDATION_RULES.DISCOUNT.FIXED.MAX}`);
                return false;
            }
        }

        clearError(valueInput);
        return true;
    }

    // Validate minimum order amount
    function validateMinOrderAmount(input, discountValueInput, discountTypeSelect) {
        const minOrderValue = parseFloat(input.value);
        const discountValue = parseFloat(discountValueInput.value);
        const discountType = discountTypeSelect.value;
        
        if (isNaN(minOrderValue) || minOrderValue < VALIDATION_RULES.MIN_ORDER.MIN) {
            showError(input, 'Minimum order amount must be at least ₹1');
            return false;
        }

        if (minOrderValue > VALIDATION_RULES.MIN_ORDER.MAX) {
            showError(input, `Minimum order amount cannot exceed ₹${VALIDATION_RULES.MIN_ORDER.MAX}`);
            return false;
        }

        // Fixed discount validation
        if (discountType === 'fixed' && discountValue >= minOrderValue) {
            showError(input, 'Minimum order amount must be greater than the discount amount');
            return false;
        }

        clearError(input);
        return true;
    }

    // Validate dates with additional checks
    function validateDates(startInput, endInput, isEdit = false) {
        const startDate = new Date(startInput.value);
        const endDate = new Date(endInput.value);
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        if (!startInput.value) {
            showError(startInput, 'Start date is required');
            return false;
        }

        if (!endInput.value) {
            showError(endInput, 'End date is required');
            return false;
        }

        if (!isEdit && startDate < now) {
            showError(startInput, 'Start date cannot be in the past');
            return false;
        }

        if (startDate >= endDate) {
            showError(endInput, 'End date must be after start date');
            return false;
        }

        // Maximum duration check - 1 year
        const oneYear = 365 * 24 * 60 * 60 * 1000;
        if (endDate - startDate > oneYear) {
            showError(endInput, 'Coupon duration cannot exceed 1 year');
            return false;
        }

        clearError(startInput);
        clearError(endInput);
        return true;
    }

    // Validate usage limits with additional checks
    function validateUsageLimits(globalInput, perUserInput) {
        let isValid = true;

        if (globalInput.value) {
            const globalLimit = parseInt(globalInput.value);
            if (isNaN(globalLimit) || globalLimit < VALIDATION_RULES.USAGE_LIMIT.MIN) {
                showError(globalInput, 'Global usage limit must be at least 1');
                isValid = false;
            } else if (globalLimit > VALIDATION_RULES.USAGE_LIMIT.MAX) {
                showError(globalInput, `Global usage limit cannot exceed ${VALIDATION_RULES.USAGE_LIMIT.MAX}`);
                isValid = false;
            } else {
                // Check if global limit is less than per user limit
                const perUserLimit = parseInt(perUserInput.value);
                if (globalLimit < perUserLimit) {
                    showError(globalInput, 'Global limit cannot be less than per user limit');
                    isValid = false;
                } else {
                    clearError(globalInput);
                }
            }
        } else {
            clearError(globalInput);
        }

        const perUserLimit = parseInt(perUserInput.value);
        if (isNaN(perUserLimit) || perUserLimit < VALIDATION_RULES.USAGE_LIMIT.MIN) {
            showError(perUserInput, 'Per user limit must be at least 1');
            isValid = false;
        } else if (perUserLimit > VALIDATION_RULES.USAGE_LIMIT.MAX) {
            showError(perUserInput, `Per user limit cannot exceed ${VALIDATION_RULES.USAGE_LIMIT.MAX}`);
            isValid = false;
        } else {
            clearError(perUserInput);
        }

        return isValid;
    }

    // Main validation function for coupon form
    function validateCouponForm(form, isEdit = false) {
        let isValid = true;

        // Get form elements
        const codeInput = form.querySelector('#' + (isEdit ? 'editCouponCode' : 'couponCode'));
        const descInput = form.querySelector('#' + (isEdit ? 'editCouponDescription' : 'couponDescription'));
        const discountTypeSelect = form.querySelector('#' + (isEdit ? 'editDiscountType' : 'discountType'));
        const discountValueInput = form.querySelector('#' + (isEdit ? 'editDiscountValue' : 'discountValue'));
        const maxDiscountInput = form.querySelector('#' + (isEdit ? 'editMaxDiscountValue' : 'maxDiscountValue'));
        const minOrderInput = form.querySelector('#' + (isEdit ? 'editMinOrderAmount' : 'minOrderAmount'));
        const startDateInput = form.querySelector('#' + (isEdit ? 'editStartDate' : 'startDate'));
        const endDateInput = form.querySelector('#' + (isEdit ? 'editExpiryDate' : 'expiryDate'));
        const globalLimitInput = form.querySelector('#' + (isEdit ? 'editUsageLimitGlobal' : 'usageLimitGlobal'));
        const perUserLimitInput = form.querySelector('#' + (isEdit ? 'editUsageLimitPerUser' : 'usageLimitPerUser'));

        // Validate each field
        isValid = validateCode(codeInput) && isValid;
        isValid = validateDescription(descInput) && isValid;
        isValid = validateDiscount(discountValueInput, discountTypeSelect, maxDiscountInput) && isValid;
        isValid = validateMinOrderAmount(minOrderInput, discountValueInput, discountTypeSelect) && isValid;
        isValid = validateDates(startDateInput, endDateInput, isEdit) && isValid;
        isValid = validateUsageLimits(globalLimitInput, perUserLimitInput) && isValid;

        return isValid;
    }

    // Add form submission handlers
    const addCouponBtn = document.getElementById('createCouponBtn');
    const updateCouponBtn = document.getElementById('updateCouponBtn');

    if (addCouponBtn) {
        addCouponBtn.addEventListener('click', function(e) {
            const form = document.getElementById('addCouponForm');
            const isValid = validateCouponForm(form, false);
            
            if (!isValid) {
                e.preventDefault();
                // Show a general validation error message
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'error',
                        title: 'Validation Error',
                        text: 'Please check the form for errors and try again.',
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 3000
                    });
                }
                return false;
            }
        });
    }

    if (updateCouponBtn) {
        updateCouponBtn.addEventListener('click', function(e) {
            const form = document.getElementById('editCouponForm');
            const isValid = validateCouponForm(form, true);
            
            if (!isValid) {
                e.preventDefault();
                // Show a general validation error message
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'error',
                        title: 'Validation Error',
                        text: 'Please check the form for errors and try again.',
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 3000
                    });
                }
                return false;
            }
        });
    }

    // Add CSS for better error message visibility
    const style = document.createElement('style');
    style.textContent = `
        .invalid-feedback {
            display: none;
            width: 100%;
            margin-top: 0.25rem;
            font-size: 0.875em;
            color: #dc3545;
        }
        .is-invalid ~ .invalid-feedback {
            display: block;
        }
        .is-invalid {
            border-color: #dc3545;
            padding-right: calc(1.5em + 0.75rem);
            background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' width='12' height='12' fill='none' stroke='%23dc3545'%3e%3ccircle cx='6' cy='6' r='4.5'/%3e%3cpath stroke-linejoin='round' d='M5.8 3.6h.4L6 6.5z'/%3e%3ccircle cx='6' cy='8.2' r='.6' fill='%23dc3545' stroke='none'/%3e%3c/svg%3e");
            background-repeat: no-repeat;
            background-position: right calc(0.375em + 0.1875rem) center;
            background-size: calc(0.75em + 0.375rem) calc(0.75em + 0.375rem);
        }
        .form-select.is-invalid {
            padding-right: 4.125rem;
            background-position: right 0.75rem center, center right 2.25rem;
            background-size: 16px 12px, calc(0.75em + 0.375rem) calc(0.75em + 0.375rem);
        }
    `;
    document.head.appendChild(style);

    // Add real-time validation event listeners
    function addRealTimeValidation() {
        // Coupon code validation
        ['couponCode', 'editCouponCode'].forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                // Validate as user types
                input.addEventListener('input', () => validateCode(input));
                // Validate when field loses focus
                input.addEventListener('blur', () => validateCode(input));
                // Convert to uppercase as user types
                input.addEventListener('input', function() {
                    this.value = this.value.toUpperCase();
                });
            }
        });

        // Description validation
        ['couponDescription', 'editCouponDescription'].forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('input', () => validateDescription(input));
                input.addEventListener('blur', () => validateDescription(input));
            }
        });

        // Discount validation
        ['discountType', 'editDiscountType'].forEach(id => {
            const select = document.getElementById(id);
            if (select) {
                select.addEventListener('change', function() {
                    const isEdit = id.startsWith('edit');
                    const prefix = isEdit ? 'edit' : '';
                    const valueInput = document.getElementById(prefix + 'DiscountValue');
                    const maxInput = document.getElementById(prefix + 'MaxDiscountValue');
                    const minOrderInput = document.getElementById(prefix + 'MinOrderAmount');

                    // Update symbol and max discount field visibility
                    const symbol = document.querySelector(isEdit ? '.edit-discount-symbol' : '.discount-symbol');
                    const percentageOptions = document.querySelector(isEdit ? '.edit-percentage-options' : '.percentage-options');
                    
                    if (this.value === 'percentage') {
                        symbol.textContent = '%';
                        percentageOptions.style.display = 'flex';
                    } else {
                        symbol.textContent = '₹';
                        percentageOptions.style.display = 'none';
                    }

                    // Revalidate related fields
                    if (valueInput.value) {
                        validateDiscount(valueInput, this, maxInput);
                        if (minOrderInput.value) {
                            validateMinOrderAmount(minOrderInput, valueInput, this);
                        }
                    }
                });
            }
        });

        // Discount value validation
        ['discountValue', 'editDiscountValue'].forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('input', function() {
                    const isEdit = id.startsWith('edit');
                    const prefix = isEdit ? 'edit' : '';
                    const typeSelect = document.getElementById(prefix + 'DiscountType');
                    const maxInput = document.getElementById(prefix + 'MaxDiscountValue');
                    const minOrderInput = document.getElementById(prefix + 'MinOrderAmount');

                    validateDiscount(this, typeSelect, maxInput);
                    if (minOrderInput.value) {
                        validateMinOrderAmount(minOrderInput, this, typeSelect);
                    }
                });
            }
        });

        // Maximum discount validation for percentage discounts
        ['maxDiscountValue', 'editMaxDiscountValue'].forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('input', function() {
                    const isEdit = id.startsWith('edit');
                    const prefix = isEdit ? 'edit' : '';
                    const valueInput = document.getElementById(prefix + 'DiscountValue');
                    const typeSelect = document.getElementById(prefix + 'DiscountType');
                    validateDiscount(valueInput, typeSelect, this);
                });
            }
        });

        // Minimum order amount validation
        ['minOrderAmount', 'editMinOrderAmount'].forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('input', function() {
                    const isEdit = id.startsWith('edit');
                    const prefix = isEdit ? 'edit' : '';
                    const discountValueInput = document.getElementById(prefix + 'DiscountValue');
                    const discountTypeSelect = document.getElementById(prefix + 'DiscountType');
                    validateMinOrderAmount(this, discountValueInput, discountTypeSelect);
                });
            }
        });

        // Date validation
        ['startDate', 'editStartDate', 'expiryDate', 'editExpiryDate'].forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('change', function() {
                    const isEdit = id.startsWith('edit');
                    const prefix = isEdit ? 'edit' : '';
                    const startInput = document.getElementById(prefix + 'StartDate');
                    const endInput = document.getElementById(prefix + (id.includes('expiry') ? 'ExpiryDate' : 'ExpiryDate'));
                    validateDates(startInput, endInput, isEdit);
                });
            }
        });

        // Usage limits validation
        ['usageLimitGlobal', 'editUsageLimitGlobal', 'usageLimitPerUser', 'editUsageLimitPerUser'].forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('input', function() {
                    const isEdit = id.startsWith('edit');
                    const prefix = isEdit ? 'edit' : '';
                    const globalInput = document.getElementById(prefix + 'UsageLimitGlobal');
                    const perUserInput = document.getElementById(prefix + 'UsageLimitPerUser');
                    validateUsageLimits(globalInput, perUserInput);
                });
            }
        });
    }

    // Initialize real-time validation
    addRealTimeValidation();

    // Add modal event listeners for validation reset
    const addModal = document.getElementById('addCouponModal');
    const editModal = document.getElementById('editCouponModal');

    if (addModal) {
        addModal.addEventListener('hidden.bs.modal', function() {
            const form = document.getElementById('addCouponForm');
            if (form) {
                form.reset();
                form.querySelectorAll('.is-invalid').forEach(input => clearError(input));
            }
        });
    }

    if (editModal) {
        editModal.addEventListener('hidden.bs.modal', function() {
            const form = document.getElementById('editCouponForm');
            if (form) {
                form.querySelectorAll('.is-invalid').forEach(input => clearError(input));
            }
        });
    }

    // Update form submission handlers
    if (addCouponBtn) {
        addCouponBtn.addEventListener('click', function(e) {
            const form = document.getElementById('addCouponForm');
            if (!validateCouponForm(form, false)) {
                e.preventDefault();
                // Focus the first invalid field
                const firstInvalid = form.querySelector('.is-invalid');
                if (firstInvalid) {
                    firstInvalid.focus();
                }
                return false;
            }
        });
    }

    if (updateCouponBtn) {
        updateCouponBtn.addEventListener('click', function(e) {
            const form = document.getElementById('editCouponForm');
            if (!validateCouponForm(form, true)) {
                e.preventDefault();
                // Focus the first invalid field
                const firstInvalid = form.querySelector('.is-invalid');
                if (firstInvalid) {
                    firstInvalid.focus();
                }
                return false;
            }
        });
    }
}); 