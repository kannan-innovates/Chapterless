// Form validation for Admin Product Management
document.addEventListener("DOMContentLoaded", function() {
  // Get the form elements
  const addProductForm = document.getElementById("addProductForm");
  const editProductForm = document.getElementById("editProductForm");
  const productForm = addProductForm || editProductForm; // Use whichever form is present

  if (!productForm) return; // Exit if neither form exists

  const isEditForm = productForm.id === "editProductForm";

  // Constants for validation
  const VALIDATION_RULES = {
    TITLE: {
      MIN_LENGTH: 3,
      MAX_LENGTH: 100,
      PATTERN: /^[a-zA-Z0-9\s\-:,.'&()]+$/
    },
    AUTHOR: {
      MIN_LENGTH: 2,
      MAX_LENGTH: 50
      // Removed PATTERN to allow special characters like parentheses, translated names, etc.
    },
    DESCRIPTION: {
      MIN_LENGTH: 20,
      MAX_LENGTH: 2000
      // No pattern validation to allow all characters including special ones
    },
    PRICE: {
      MIN: 0,
      MAX: 100000,
      DECIMALS: 2
    },
    STOCK: {
      MIN: 0,
      MAX: 10000
    },
    PAGES: {
      MIN: 1,
      MAX: 10000
    },
    IMAGE: {
      ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'],
      MIN_DIMENSIONS: { width: 200, height: 200 },
      MAX_DIMENSIONS: { width: 4000, height: 4000 }
    }
  };

  // Error message display function with improved styling
  function showError(input, message) {
    const formControl = input.parentElement;
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
    const formControl = input.parentElement;
    const errorElement = formControl.querySelector('.error-message');

    if (errorElement) {
      errorElement.textContent = '';
    }

    input.classList.remove('is-invalid');
    input.classList.add('is-valid');
  }

  // Validate required field (for dropdowns and other elements)
  function validateRequired(input, message) {
    const value = input.value.trim();

    if (value === '' || value === null || value === undefined) {
      showError(input, message);
      return false;
    }

    clearError(input);
    return true;
  }

  // Validate text field with pattern and length
  function validateTextField(input, rules, fieldName) {
    const value = input.value.trim();

    if (value === '') {
      showError(input, `${fieldName} is required`);
      return false;
    }

    if (value.length < rules.MIN_LENGTH) {
      showError(input, `${fieldName} must be at least ${rules.MIN_LENGTH} characters`);
      return false;
    }

    if (value.length > rules.MAX_LENGTH) {
      showError(input, `${fieldName} must not exceed ${rules.MAX_LENGTH} characters`);
      return false;
    }

    if (rules.PATTERN && !rules.PATTERN.test(value)) {
      showError(input, `${fieldName} contains invalid characters`);
      return false;
    }

    clearError(input);
    return true;
  }

  // Validate number field with range
  function validateNumberField(input, rules, fieldName) {
    const value = parseFloat(input.value);

    if (isNaN(value)) {
      showError(input, `${fieldName} must be a valid number`);
      return false;
    }

    if (value < rules.MIN) {
      showError(input, `${fieldName} must be at least ${rules.MIN}`);
      return false;
    }

    if (value > rules.MAX) {
      showError(input, `${fieldName} must not exceed ${rules.MAX}`);
      return false;
    }

    if (rules.DECIMALS) {
      const decimals = value.toString().split('.')[1]?.length || 0;
      if (decimals > rules.DECIMALS) {
        showError(input, `${fieldName} must not have more than ${rules.DECIMALS} decimal places`);
        return false;
      }
    }

    clearError(input);
    return true;
  }

  // Validate price comparison
  function validatePriceComparison(regularPrice, salePrice) {
    const regularValue = parseFloat(regularPrice.value);
    const saleValue = parseFloat(salePrice.value);

    if (saleValue > regularValue) {
      showError(salePrice, 'Sale price cannot be greater than regular price');
      return false;
    }

    if (saleValue < regularValue * 0.1) {
      showError(salePrice, 'Sale price cannot be less than 10% of regular price');
      return false;
    }

    clearError(salePrice);
    return true;
  }

  // Validate ISBN format (comprehensive check)
  function validateISBN(input) {
    if (input.value.trim() === '') {
      return true; // ISBN is optional
    }

    const isbn = input.value.replace(/[-\s]/g, '').toUpperCase();

    // ISBN-10 validation
    if (isbn.length === 10) {
      if (!/^\d{9}[\dX]$/.test(isbn)) {
        showError(input, 'Invalid ISBN-10 format');
        return false;
      }

      let sum = 0;
      for (let i = 0; i < 9; i++) {
        sum += (10 - i) * parseInt(isbn.charAt(i));
      }

      const lastChar = isbn.charAt(9);
      sum += (lastChar === 'X') ? 10 : parseInt(lastChar);

      if (sum % 11 !== 0) {
        showError(input, 'Invalid ISBN-10 checksum');
        return false;
      }
    }
    // ISBN-13 validation
    else if (isbn.length === 13) {
      if (!/^\d{13}$/.test(isbn)) {
        showError(input, 'Invalid ISBN-13 format');
        return false;
      }

      let sum = 0;
      for (let i = 0; i < 12; i++) {
        sum += (i % 2 === 0 ? 1 : 3) * parseInt(isbn.charAt(i));
      }

      const checksum = (10 - (sum % 10)) % 10;
      if (checksum !== parseInt(isbn.charAt(12))) {
        showError(input, 'Invalid ISBN-13 checksum');
        return false;
      }
    } else {
      showError(input, 'ISBN must be either 10 or 13 digits');
      return false;
    }

    clearError(input);
    return true;
  }

  // Validate image upload with dimensions check
  async function validateImageUpload(input, isRequired = false) {
    if (isRequired && (!input.files || input.files.length === 0)) {
      showError(input, 'Please select an image');
      return false;
    }

    if (input.files && input.files.length > 0) {
      const file = input.files[0];

      // Check file type
      if (!VALIDATION_RULES.IMAGE.ALLOWED_TYPES.includes(file.type)) {
        showError(input, 'Please select a valid image file (JPEG, PNG, WebP)');
        return false;
      }

      // Check image dimensions
      try {
        const dimensions = await getImageDimensions(file);

        if (dimensions.width < VALIDATION_RULES.IMAGE.MIN_DIMENSIONS.width ||
            dimensions.height < VALIDATION_RULES.IMAGE.MIN_DIMENSIONS.height) {
          showError(input, `Image dimensions must be at least ${VALIDATION_RULES.IMAGE.MIN_DIMENSIONS.width}x${VALIDATION_RULES.IMAGE.MIN_DIMENSIONS.height}`);
          return false;
        }

        if (dimensions.width > VALIDATION_RULES.IMAGE.MAX_DIMENSIONS.width ||
            dimensions.height > VALIDATION_RULES.IMAGE.MAX_DIMENSIONS.height) {
          showError(input, `Image dimensions must not exceed ${VALIDATION_RULES.IMAGE.MAX_DIMENSIONS.width}x${VALIDATION_RULES.IMAGE.MAX_DIMENSIONS.height}`);
          return false;
        }
      } catch (error) {
        showError(input, 'Error validating image dimensions');
        return false;
      }

      clearError(input);
      return true;
    }

    return true;
  }

  // Helper function to get image dimensions
  function getImageDimensions(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }

  // Validate date field
  function validateDate(input) {
    if (input.value) {
      const selectedDate = new Date(input.value);
      const today = new Date();

      if (selectedDate > today) {
        showError(input, 'Published date cannot be in the future');
        return false;
      }

      const minDate = new Date('1800-01-01');
      if (selectedDate < minDate) {
        showError(input, 'Published date cannot be before 1800');
        return false;
      }

      clearError(input);
      return true;
    }
    return true; // Date is optional
  }

  // Real-time validation for important fields
  const title = document.getElementById('title');
  const author = document.getElementById('author');
  const description = document.getElementById('description');
  const regularPrice = document.getElementById('regularPrice');
  const salePrice = document.getElementById('salePrice');
  const stock = document.getElementById('stock');
  const pages = document.getElementById('pages');
  const category = document.getElementById('category');
  const isbn = document.getElementById('isbn');
  const publishedDate = document.getElementById('publishedDate');
  const language = document.getElementById('language');
  const publisher = document.getElementById('publisher');
  const mainImage = document.getElementById('mainImage');

  // Add event listeners for real-time validation
  title.addEventListener('input', () => validateTextField(title, VALIDATION_RULES.TITLE, 'Title'));
  author.addEventListener('input', () => validateTextField(author, VALIDATION_RULES.AUTHOR, 'Author'));
  description.addEventListener('input', () => validateTextField(description, VALIDATION_RULES.DESCRIPTION, 'Description'));

  regularPrice.addEventListener('input', () => {
    if (validateNumberField(regularPrice, VALIDATION_RULES.PRICE, 'Regular price') && salePrice.value) {
      validatePriceComparison(regularPrice, salePrice);
    }
  });

  salePrice.addEventListener('input', () => {
    if (validateNumberField(salePrice, VALIDATION_RULES.PRICE, 'Sale price') && regularPrice.value) {
      validatePriceComparison(regularPrice, salePrice);
    }
  });

  stock.addEventListener('input', () => validateNumberField(stock, VALIDATION_RULES.STOCK, 'Stock'));
  pages.addEventListener('input', () => validateNumberField(pages, VALIDATION_RULES.PAGES, 'Pages'));
  category.addEventListener('change', () => validateRequired(category, 'Please select a category'));
  isbn.addEventListener('input', () => validateISBN(isbn));
  publishedDate.addEventListener('change', () => validateDate(publishedDate));
  language.addEventListener('input', () => validateTextField(language, { MIN_LENGTH: 2, MAX_LENGTH: 30 }, 'Language'));
  publisher.addEventListener('input', () => validateTextField(publisher, { MIN_LENGTH: 2, MAX_LENGTH: 50 }, 'Publisher'));

  // Debounce function for image validation
  function debounce(func, wait) {
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

  // Add debounced image validation
  const debouncedImageValidation = debounce(async (input, isRequired) => {
    await validateImageUpload(input, isRequired);
  }, 300);

  mainImage.addEventListener('change', () => debouncedImageValidation(mainImage, true));

  const subImages = [
    document.getElementById('subImage1'),
    document.getElementById('subImage2'),
    document.getElementById('subImage3')
  ];

  subImages.forEach(img => {
    img.addEventListener('change', () => debouncedImageValidation(img, false));
  });

  // Form submission validation
  productForm.addEventListener('submit', async function(e) {
    e.preventDefault();

    // Disable submit button and show loading state
    const submitButton = document.getElementById(isEditForm ? "updateProductButton" : "addProductButton");
    const originalButtonText = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Validating...';

    try {
      // Validate all fields
      let isValid = true;

      // Text fields validation
      isValid = validateTextField(title, VALIDATION_RULES.TITLE, 'Title') && isValid;
      isValid = validateTextField(author, VALIDATION_RULES.AUTHOR, 'Author') && isValid;
      isValid = validateTextField(description, VALIDATION_RULES.DESCRIPTION, 'Description') && isValid;
      isValid = validateTextField(language, { MIN_LENGTH: 2, MAX_LENGTH: 30 }, 'Language') && isValid;
      isValid = validateTextField(publisher, { MIN_LENGTH: 2, MAX_LENGTH: 50 }, 'Publisher') && isValid;

      // Number fields validation
      isValid = validateNumberField(regularPrice, VALIDATION_RULES.PRICE, 'Regular price') && isValid;
      isValid = validateNumberField(salePrice, VALIDATION_RULES.PRICE, 'Sale price') && isValid;
      isValid = validateNumberField(stock, VALIDATION_RULES.STOCK, 'Stock') && isValid;
      isValid = validateNumberField(pages, VALIDATION_RULES.PAGES, 'Pages') && isValid;

      // Price comparison
      isValid = validatePriceComparison(regularPrice, salePrice) && isValid;

      // Category validation
      isValid = validateRequired(category, 'Please select a category') && isValid;

      // ISBN validation
      isValid = validateISBN(isbn) && isValid;

      // Date validation
      isValid = validateDate(publishedDate) && isValid;

      // Image validation - Only required for new images in edit mode
      if (!isEditForm) {
        isValid = await validateImageUpload(mainImage, true) && isValid;
      } else if (mainImage.files.length > 0) {
        isValid = await validateImageUpload(mainImage, false) && isValid;
      }

      for (const img of subImages) {
        if (img.files.length > 0) {
          isValid = await validateImageUpload(img, false) && isValid;
        }
      }

      // If all validations pass, submit the form
      if (isValid) {
        submitButton.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> ${isEditForm ? 'Updating' : 'Adding'} Product...`;

        const formData = new FormData(productForm);

        // Add method override for PUT requests
        if (isEditForm) {
          formData.append('_method', 'PUT');
        }

        // Submit to the appropriate endpoint
        const url = isEditForm
          ? `/admin/products/${productForm.getAttribute('data-product-id')}`
          : "/admin/products";

        const response = await fetch(url, {
          method: "POST", // Always use POST, let method-override handle PUT
          body: formData
          // Don't set Content-Type for FormData - let browser set it automatically
        });

        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        let data;

        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        } else {
          // If not JSON, get text to see what was returned
          const text = await response.text();
          console.error('Non-JSON response received:', text);
          throw new Error('Server returned an unexpected response format. Please check the console for details.');
        }

        if (response.ok) {
          Swal.fire({
            icon: 'success',
            title: 'Success!',
            text: data.message || `Product ${isEditForm ? 'updated' : 'added'} successfully`,
            showConfirmButton: false,
            timer: 2000
          }).then(() => {
            window.location.href = "/admin/getProducts";
          });
        } else {
          throw new Error(data.error || `Failed to ${isEditForm ? 'update' : 'add'} product`);
        }
      } else {
        // Scroll to the first error
        const firstError = document.querySelector('.is-invalid');
        if (firstError) {
          firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
          firstError.focus();
        }

        // Show error toast
        Swal.fire({
          icon: 'error',
          title: 'Validation Error',
          text: 'Please check the form for errors',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000
        });
      }
    } catch (error) {
      console.error('Validation error:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message || 'An error occurred during validation',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
      });
    } finally {
      // Reset button state
      submitButton.disabled = false;
      submitButton.innerHTML = originalButtonText;
    }
  });

  // Add styles for validation UI
  const style = document.createElement('style');
  style.textContent = `
    .error-message {
      font-size: 0.8rem;
      color: #dc3545;
      margin-top: 0.25rem;
    }
    .is-invalid {
      border-color: #dc3545 !important;
      padding-right: calc(1.5em + 0.75rem);
      background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' stroke='%23dc3545' viewBox='0 0 12 12'%3e%3ccircle cx='6' cy='6' r='4.5'/%3e%3cpath stroke-linejoin='round' d='M5.8 3.6h.4L6 6.5z'/%3e%3ccircle cx='6' cy='8.2' r='.6' fill='%23dc3545' stroke='none'/%3e%3c/svg%3e");
      background-repeat: no-repeat;
      background-position: right calc(0.375em + 0.1875rem) center;
      background-size: calc(0.75em + 0.375rem) calc(0.75em + 0.375rem);
    }
    .is-valid {
      border-color: #198754 !important;
      padding-right: calc(1.5em + 0.75rem);
      background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8'%3e%3cpath fill='%23198754' d='M2.3 6.73L.6 4.53c-.4-1.04.46-1.4 1.1-.8l1.1 1.4 3.4-3.8c.6-.63 1.6-.27 1.2.7l-4 4.6c-.43.5-.8.4-1.1.1z'/%3e%3c/svg%3e");
      background-repeat: no-repeat;
      background-position: right calc(0.375em + 0.1875rem) center;
      background-size: calc(0.75em + 0.375rem) calc(0.75em + 0.375rem);
    }
  `;
  document.head.appendChild(style);
});