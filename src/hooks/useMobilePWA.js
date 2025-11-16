import { useEffect, useCallback } from 'react';

export const useMobilePWA = () => {
  const isStandalone = useCallback(() => {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
  }, []);

  const isIOS = useCallback(() => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }, []);

  const preventOverscroll = useCallback((e) => {
    // Don't prevent scroll events - they're read-only
    // Use CSS overscroll-behavior instead
    const target = e.target;
    if (target.scrollTop < 0) {
      target.scrollTop = 0;
    }
    const maxScroll = target.scrollHeight - target.clientHeight;
    if (target.scrollTop > maxScroll) {
      target.scrollTop = maxScroll;
    }
  }, []);

  const setupMobileScrolling = useCallback(() => {
    console.log('Setting up mobile PWA scrolling...');
    console.log('Is standalone:', isStandalone());
    console.log('Is iOS:', isIOS());
    
    if (!isStandalone() && !isIOS()) {
      console.log('Not standalone or iOS, skipping mobile setup');
      return;
    }

    const rootElement = document.getElementById('root');
    if (!rootElement) return;

    // Add touch event listeners for iOS
    if (isIOS()) {
      let startY = 0;
      let startScrollTop = 0;

      const handleTouchStart = (e) => {
        startY = e.touches[0].clientY;
        startScrollTop = rootElement.scrollTop;
      };

      const handleTouchMove = (e) => {
        const deltaY = e.touches[0].clientY - startY;
        const newScrollTop = startScrollTop - deltaY;
        const maxScroll = rootElement.scrollHeight - rootElement.clientHeight;

        // Only prevent overscroll at boundaries, allow normal scrolling
        if (newScrollTop < 0 && rootElement.scrollTop <= 0) {
          e.preventDefault();
          rootElement.scrollTop = 0;
        } else if (newScrollTop > maxScroll && rootElement.scrollTop >= maxScroll) {
          e.preventDefault();
          rootElement.scrollTop = maxScroll;
        }
        // Otherwise, let native scrolling handle it
      };

      rootElement.addEventListener('touchstart', handleTouchStart, { passive: false });
      rootElement.addEventListener('touchmove', handleTouchMove, { passive: false });

      return () => {
        rootElement.removeEventListener('touchstart', handleTouchStart);
        rootElement.removeEventListener('touchmove', handleTouchMove);
      };
    }

    // Add scroll event listener for overscroll prevention (passive for better performance)
    const handleScroll = (e) => {
      preventOverscroll(e);
    };

    rootElement.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      rootElement.removeEventListener('scroll', handleScroll);
    };
  }, [isStandalone, isIOS, preventOverscroll]);

  useEffect(() => {
    const cleanup = setupMobileScrolling();
    return cleanup;
  }, [setupMobileScrolling]);

  // Prevent body scrolling when PWA is active - but allow #root to scroll
  useEffect(() => {
    if (!isStandalone() && !isIOS()) return;

    // Only prevent body scroll if the touch is not on a scrollable element
    const preventBodyScroll = (e) => {
      const target = e.target;
      const rootElement = document.getElementById('root');
      
      // Allow scrolling if touch is on #root or its children
      if (rootElement && (target === rootElement || rootElement.contains(target))) {
        return; // Don't prevent, let it scroll
      }
      
      // Only prevent if it's a direct body touch (shouldn't happen in normal use)
      if (target === document.body || target === document.documentElement) {
        e.preventDefault();
      }
    };

    // Use passive: true for better performance, only prevent when necessary
    document.body.addEventListener('touchmove', preventBodyScroll, { passive: false });
    
    return () => {
      document.body.removeEventListener('touchmove', preventBodyScroll);
    };
  }, [isStandalone, isIOS]);

  return {
    isStandalone: isStandalone(),
    isIOS: isIOS(),
  };
};
