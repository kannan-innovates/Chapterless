// Enhanced Product Image Zoom Functionality
document.addEventListener('DOMContentLoaded', function() {
     // Initialize image magnifier functionality
     initImageMagnifier();
     
     // Handle thumbnail clicks
     initThumbnailGallery();
     
     // Initialize Bootstrap tabs
     initProductTabs();
   });
   
   /**
    * Professional Image Magnifier with lens effect
    */
   function initImageMagnifier() {
     const mainImage = document.getElementById('mainImage');
     const zoomContainer = document.getElementById('zoomContainer');
     
     if (!mainImage || !zoomContainer) return;
     
     // Create magnifier glass element
     const magnifierGlass = document.createElement('div');
     magnifierGlass.classList.add('img-magnifier-glass');
     zoomContainer.appendChild(magnifierGlass);
     
     // Create zoomed result container
     const zoomResult = document.createElement('div');
     zoomResult.classList.add('img-zoom-result');
     zoomContainer.appendChild(zoomResult);
     
     let isActive = false;
     const magnificationLevel = 3;
     
     // Show magnifier glass and zoom result on mouseenter
     zoomContainer.addEventListener('mouseenter', function() {
       magnifierGlass.style.display = 'block';
       zoomResult.style.display = 'block';
       isActive = true;
     });
     
     // Hide magnifier glass and zoom result on mouseleave
     zoomContainer.addEventListener('mouseleave', function() {
       magnifierGlass.style.display = 'none';
       zoomResult.style.display = 'none';
       isActive = false;
     });
     
     // Update magnifier position on mousemove
     zoomContainer.addEventListener('mousemove', function(e) {
       if (!isActive) return;
       
       // Get cursor position
       const rect = zoomContainer.getBoundingClientRect();
       const cursorX = e.clientX - rect.left;
       const cursorY = e.clientY - rect.top;
       
       // Calculate magnifier glass position
       const glassWidth = magnifierGlass.offsetWidth / 2;
       const glassHeight = magnifierGlass.offsetHeight / 2;
       
       let glassX = cursorX - glassWidth;
       let glassY = cursorY - glassHeight;
       
       // Constrain magnifier glass to image boundaries
       if (glassX < 0) glassX = 0;
       if (glassY < 0) glassY = 0;
       if (glassX > rect.width - magnifierGlass.offsetWidth) {
         glassX = rect.width - magnifierGlass.offsetWidth;
       }
       if (glassY > rect.height - magnifierGlass.offsetHeight) {
         glassY = rect.height - magnifierGlass.offsetHeight;
       }
       
       // Position magnifier glass
       magnifierGlass.style.left = glassX + 'px';
       magnifierGlass.style.top = glassY + 'px';
       
       // Calculate relative position for background image
       const percentX = (cursorX / rect.width) * 100;
       const percentY = (cursorY / rect.height) * 100;
       
       // Update magnifier glass background
       magnifierGlass.style.backgroundImage = `url('${mainImage.src}')`;
       magnifierGlass.style.backgroundSize = `${rect.width * magnificationLevel}px ${rect.height * magnificationLevel}px`;
       magnifierGlass.style.backgroundPosition = `${percentX}% ${percentY}%`;
       
       // Update zoom result display
       zoomResult.style.backgroundImage = `url('${mainImage.src}')`;
       zoomResult.style.backgroundSize = `${rect.width * magnificationLevel}px ${rect.height * magnificationLevel}px`;
       zoomResult.style.backgroundPosition = `${percentX}% ${percentY}%`;
     });
     
     // Handle touch devices
     zoomContainer.addEventListener('touchstart', function(e) {
       e.preventDefault();
       isActive = true;
       magnifierGlass.style.display = 'block';
       zoomResult.style.display = 'block';
       updateTouchZoom(e.touches[0]);
     });
     
     zoomContainer.addEventListener('touchmove', function(e) {
       e.preventDefault();
       if (isActive) {
         updateTouchZoom(e.touches[0]);
       }
     });
     
     zoomContainer.addEventListener('touchend', function() {
       isActive = false;
       magnifierGlass.style.display = 'none';
       zoomResult.style.display = 'none';
     });
     
     function updateTouchZoom(touch) {
       const rect = zoomContainer.getBoundingClientRect();
       const touchX = touch.clientX - rect.left;
       const touchY = touch.clientY - rect.top;
       
       // Simulate a mousemove event
       const simulatedMouseEvent = new MouseEvent('mousemove', {
         clientX: touch.clientX,
         clientY: touch.clientY
       });
       
       zoomContainer.dispatchEvent(simulatedMouseEvent);
     }
     
     // Add click to toggle zoom mode on mobile
     zoomContainer.addEventListener('click', function(e) {
       if (window.innerWidth < 768) {
         if (!isActive) {
           isActive = true;
           magnifierGlass.style.display = 'block';
           zoomResult.style.display = 'block';
           
           const rect = zoomContainer.getBoundingClientRect();
           const clickX = e.clientX - rect.left;
           const clickY = e.clientY - rect.top;
           
           const simulatedMouseEvent = new MouseEvent('mousemove', {
             clientX: e.clientX,
             clientY: e.clientY
           });
           
           zoomContainer.dispatchEvent(simulatedMouseEvent);
         } else {
           isActive = false;
           magnifierGlass.style.display = 'none';
           zoomResult.style.display = 'none';
         }
       }
     });
   }
   
   /**
    * Thumbnail Gallery Functionality
    */
   function initThumbnailGallery() {
     const thumbnails = document.querySelectorAll('.thumbnail');
     
     thumbnails.forEach(thumbnail => {
       thumbnail.addEventListener('click', function() {
         const imageSrc = this.getAttribute('onclick').match(/'([^']+)'/)[1];
         changeImage(this, imageSrc);
         
         // Reset zoom elements
         const zoomContainer = document.getElementById('zoomContainer');
         if (zoomContainer) {
           const magnifierGlass = zoomContainer.querySelector('.img-magnifier-glass');
           const zoomResult = zoomContainer.querySelector('.img-zoom-result');
           
           if (magnifierGlass) magnifierGlass.style.display = 'none';
           if (zoomResult) zoomResult.style.display = 'none';
         }
       });
     });
   }
   
   /**
    * Product Tabs Initialization
    */
   function initProductTabs() {
     const tabEls = document.querySelectorAll('button[data-bs-toggle="tab"]');
     
     if (tabEls.length > 0) {
       // If Bootstrap 5 is already loaded properly
       if (typeof bootstrap !== 'undefined' && bootstrap.Tab) {
         tabEls.forEach(tabEl => {
           new bootstrap.Tab(tabEl);
         });
       } else {
         // Fallback - manually add click handlers for tabs
         tabEls.forEach(tabEl => {
           tabEl.addEventListener('click', function(event) {
             event.preventDefault();
             
             // Remove active class from all tabs and tab panes
             document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
             document.querySelectorAll('.tab-pane').forEach(el => {
               el.classList.remove('show', 'active');
             });
             
             // Add active class to clicked tab
             this.classList.add('active');
             
             // Get the target tab pane and make it active
             const target = document.querySelector(this.getAttribute('data-bs-target'));
             if (target) {
               target.classList.add('show', 'active');
             }
           });
         });
       }
     }
   }
   
   /**
    * Image Change Function
    */
   function changeImage(thumbnail, imageSrc) {
     document.getElementById('mainImage').src = imageSrc;
     const thumbnails = document.querySelectorAll('.thumbnail');
     thumbnails.forEach(thumb => thumb.classList.remove('active'));
     thumbnail.classList.add('active');
   }
   
   /**
    * Quantity Selector Functions 
    */
   function incrementQuantity() {
     const quantityInput = document.getElementById('quantity');
     const currentValue = parseInt(quantityInput.value);
     const maxValue = parseInt(quantityInput.getAttribute('max'));
     if (currentValue < maxValue) {
       quantityInput.value = currentValue + 1;
     }
   }
   
   function decrementQuantity() {
     const quantityInput = document.getElementById('quantity');
     const currentValue = parseInt(quantityInput.value);
     if (currentValue > 1) {
       quantityInput.value = currentValue - 1;
     }
   }