// Performance-optimized lazy loading for images
(function() {
  'use strict';

  // Check if browser supports IntersectionObserver
  if (!('IntersectionObserver' in window)) {
    // Fallback for older browsers - load all images immediately
    document.querySelectorAll('img[data-src]').forEach(img => {
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
    });
    return;
  }

  // Create intersection observer with optimized settings
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        
        // Load image
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
        
        // Remove loading placeholder class
        img.classList.remove('lazy-loading');
        img.classList.add('lazy-loaded');
        
        // Stop observing this image
        observer.unobserve(img);
      }
    });
  }, {
    // Load images when they're 50px away from viewport
    rootMargin: '50px 0px',
    // Only trigger when 10% of image is visible
    threshold: 0.1
  });

  // Observe all lazy images
  function initLazyLoading() {
    const lazyImages = document.querySelectorAll('img[data-src]');
    lazyImages.forEach(img => {
      // Add loading class for styling
      img.classList.add('lazy-loading');
      
      // Set placeholder while loading
      if (!img.src) {
        img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"%3E%3Crect width="300" height="200" fill="%23f0f0f0"/%3E%3Ctext x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%23999"%3ELoading...%3C/text%3E%3C/svg%3E';
      }
      
      imageObserver.observe(img);
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLazyLoading);
  } else {
    initLazyLoading();
  }

  // Re-initialize for dynamically added images
  window.reinitLazyLoading = initLazyLoading;

})();