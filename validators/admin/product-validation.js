// Form validation for Admin Product Management
document.addEventListener("DOMContentLoaded", function() {
     // Get the form element
     const productForm = document.getElementById("addProductForm");
     
     // Error message display function
     function showError(input, message) {
       const formControl = input.parentElement;
       let errorElement = formControl.querySelector('.error-message');
       
       // Create error element if it doesn't exist
       if (!errorElement) {
         errorElement = document.createElement('div');
         errorElement.className = 'error-message text-danger mt-1';
         formControl.appendChild(errorElement);
       }
       
       errorElement.textContent = message;
       input.classList.add('is-invalid');
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
     
     // Validate required field
     function validateRequired(input, message) {
       if (input.value.trim() === '') {
         showError(input, message || `${getFieldName(input)} is required`);
         return false;
       } else {
         clearError(input);
         return true;
       }
     }
     
     // Validate number field
     function validateNumber(input, message, min = 0) {
       if (isNaN(input.value) || parseFloat(input.value) < min) {
         showError(input, message || `${getFieldName(input)} must be a number greater than or equal to ${min}`);
         return false;
       } else {
         clearError(input);
         return true;
       }
     }
     
     // Validate price comparison (sale price <= regular price)
     function validatePriceComparison(regularPrice, salePrice) {
       if (parseFloat(salePrice.value) > parseFloat(regularPrice.value)) {
         showError(salePrice, 'Sale price cannot be greater than regular price');
         return false;
       } else {
         clearError(salePrice);
         return true;
       }
     }
     
     // Validate ISBN format (simple check)
     function validateISBN(input) {
       if (input.value.trim() !== '') {
         const isbnRegex = /^(?:\d[- ]?){9}[\dXx]$|^(?:\d[- ]?){13}$/;
         if (!isbnRegex.test(input.value.trim())) {
           showError(input, 'Please enter a valid 10 or 13 digit ISBN');
           return false;
         } else {
           clearError(input);
           return true;
         }
       }
       return true; // ISBN is optional
     }
     
     // Validate image upload
     function validateImageUpload(input, isRequired = false) {
       if (isRequired && (!input.files || input.files.length === 0)) {
         showError(input, 'Please select an image');
         return false;
       } else if (input.files && input.files.length > 0) {
         const file = input.files[0];
         const fileType = file.type;
         const validImageTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
         
         if (!validImageTypes.includes(fileType)) {
           showError(input, 'Please select a valid image file (JPEG, PNG, WebP)');
           return false;
         } else if (file.size > 5 * 1024 * 1024) {
           showError(input, 'Image size should be less than 5MB');
           return false;
         } else {
           clearError(input);
           return true;
         }
       }
       return true;
     }
     
     // Helper function to get field name
     function getFieldName(input) {
       return input.id.charAt(0).toUpperCase() + input.id.slice(1).replace(/([A-Z])/g, ' $1');
     }
     
     // Real-time validation for important fields
     const title = document.getElementById('title');
     const author = document.getElementById('author');
     const description = document.getElementById('description');
     const regularPrice = document.getElementById('regularPrice');
     const salePrice = document.getElementById('salePrice');
     const stock = document.getElementById('stock');
     const category = document.getElementById('category');
     const isbn = document.getElementById('isbn');
     const mainImage = document.getElementById('mainImage');
     
     // Add event listeners for real-time validation
     title.addEventListener('blur', () => validateRequired(title));
     author.addEventListener('blur', () => validateRequired(author));
     description.addEventListener('blur', () => validateRequired(description));
     regularPrice.addEventListener('blur', () => validateNumber(regularPrice, null, 0));
     
     salePrice.addEventListener('blur', () => {
       validateNumber(salePrice, null, 0);
       if (regularPrice.value) {
         validatePriceComparison(regularPrice, salePrice);
       }
     });
     
     regularPrice.addEventListener('change', () => {
       if (salePrice.value) {
         validatePriceComparison(regularPrice, salePrice);
       }
     });
     
     stock.addEventListener('blur', () => validateNumber(stock, null, 0));
     category.addEventListener('change', () => validateRequired(category, 'Please select a category'));
     isbn.addEventListener('blur', () => validateISBN(isbn));
     
     // Form submission validation
     productForm.addEventListener('submit', function(e) {
       e.preventDefault();
       
       // Validate all required fields
       let isValid = true;
       
       isValid = validateRequired(title) && isValid;
       isValid = validateRequired(author) && isValid;
       isValid = validateRequired(description) && isValid;
       isValid = validateRequired(category, 'Please select a category') && isValid;
       isValid = validateRequired(document.getElementById('language')) && isValid;
       isValid = validateRequired(document.getElementById('publisher')) && isValid;
       isValid = validateRequired(document.getElementById('pages')) && isValid;
       
       // Validate numbers
       isValid = validateNumber(regularPrice, null, 0) && isValid;
       isValid = validateNumber(salePrice, null, 0) && isValid;
       isValid = validateNumber(stock, null, 0) && isValid;
       isValid = validateNumber(document.getElementById('pages'), null, 1) && isValid;
       
       // Validate price comparison
       isValid = validatePriceComparison(regularPrice, salePrice) && isValid;
       
       // Validate ISBN if provided
       isValid = validateISBN(isbn) && isValid;
       
       // Validate main image (required)
       isValid = validateImageUpload(mainImage, true) && isValid;
       
       // Validate optional sub images
       const subImages = [
         document.getElementById('subImage1'),
         document.getElementById('subImage2'),
         document.getElementById('subImage3')
       ];
       
       subImages.forEach(img => {
         if (img.files && img.files.length > 0) {
           isValid = validateImageUpload(img) && isValid;
         }
       });
       
       // If all validations pass, submit the form
       if (isValid) {
         const formData = new FormData(productForm);
         submitProductForm(formData);
       } else {
         // Scroll to the first error
         const firstError = document.querySelector('.is-invalid');
         if (firstError) {
           firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
           firstError.focus();
         }
       }
     });
     
     // Form submission function
     async function submitProductForm(formData) {
       const addProductButton = document.getElementById("addProductButton");
       const btnText = addProductButton.querySelector(".btn-text");
       
       try {
         btnText.textContent = "Adding Product...";
         addProductButton.disabled = true;
         
         const response = await fetch("/admin/products", {
           method: "POST",
           body: formData,
           headers: {
             'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').getAttribute('content')
           }
         });
         
         const data = await response.json();
         
         if (response.ok) {
           Swal.fire({
             title: "Success!",
             text: data.message || "Product added successfully",
             icon: "success",
             timer: 2000,
             showConfirmButton: false
           }).then(() => {
             window.location.href = "/admin/getProducts";
           });
         } else {
           Swal.fire({
             title: "Error!",
             text: data.error || "Failed to add product",
             icon: "error"
           });
         }
       } catch (error) {
         Swal.fire({
           title: "Error!",
           text: "Server Error: " + error.message,
           icon: "error"
         });
       } finally {
         btnText.textContent = "Add Product";
         addProductButton.disabled = false;
       }
     }
     
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