// Script เพื่อเพิ่ม lazy loading และปรับปรุงประสิทธิภาพ
document.addEventListener('DOMContentLoaded', function() {
  // เพิ่ม lazy loading ให้กับรูปภาพทั้งหมด
  const images = document.querySelectorAll('img:not([loading])');
  images.forEach(img => {
    img.setAttribute('loading', 'lazy');
    img.setAttribute('decoding', 'async');
  });

  // ปรับปรุงการแสดงผลของ avatar
  const avatars = document.querySelectorAll('.user-avatar');
  avatars.forEach(avatar => {
    avatar.addEventListener('error', function() {
      this.src = '/images/profile-placeholder.png';
    });
  });

  // ลด reflow โดยการ cache DOM queries
  const header = document.querySelector('.site-header');
  if (header) {
    let lastScrollTop = 0;
    let ticking = false;

    function updateHeader() {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      
      if (scrollTop > lastScrollTop && scrollTop > 100) {
        // กำลังเลื่อนลง
        header.style.transform = 'translateY(-100%)';
      } else {
        // กำลังเลื่อนขึ้น
        header.style.transform = 'translateY(0)';
      }
      
      lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
      ticking = false;
    }

    // ใช้ requestAnimationFrame เพื่อ optimize scroll performance
    window.addEventListener('scroll', function() {
      if (!ticking) {
        requestAnimationFrame(updateHeader);
        ticking = true;
      }
    }, { passive: true });
  }

  // Preload critical resources
  const criticalImages = [
    '/images/profile-placeholder.png',
    '/images/placeholder.jpg'
  ];

  criticalImages.forEach(src => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = src;
    document.head.appendChild(link);
  });

  // ลบ transition ในมือถือเพื่อประหยัด battery
  if (window.innerWidth <= 768) {
    const style = document.createElement('style');
    style.textContent = `
      *, *::before, *::after {
        transition: none !important;
        animation: none !important;
      }
    `;
    document.head.appendChild(style);
  }
});