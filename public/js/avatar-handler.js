// Avatar fallback management
(function() {
  'use strict';

  // Create inline SVG avatar as fallback
  const createDefaultAvatar = (size = 150) => {
    return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 150 150'%3E%3Crect width='150' height='150' fill='%23f0f0f0'/%3E%3Ccircle cx='75' cy='60' r='25' fill='%23ddd'/%3E%3Cpath d='M30 130 Q30 100 50 100 L100 100 Q120 100 120 130 Z' fill='%23ddd'/%3E%3C/svg%3E`;
  };

  // Handle avatar loading errors
  function handleAvatarError(img) {
    img.src = createDefaultAvatar();
    img.onerror = null; // Prevent infinite loop
  }

  // Initialize avatar error handling
  function initAvatarHandling() {
    // Find all avatar images
    const avatarImages = document.querySelectorAll('img[src*="profile-placeholder"], img[src*="/uploads/"], .user-avatar');
    
    avatarImages.forEach(img => {
      // Set error handler
      img.onerror = function() {
        handleAvatarError(this);
      };
      
      // Check if current src is already broken
      if (img.complete && img.naturalHeight === 0) {
        handleAvatarError(img);
      }
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAvatarHandling);
  } else {
    initAvatarHandling();
  }

  // Make available globally
  window.handleAvatarError = handleAvatarError;
  window.createDefaultAvatar = createDefaultAvatar;

})();