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
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    
    // Prevent overscroll at the top
    if (scrollTop <= 0) {
      e.preventDefault();
      e.target.scrollTop = 0;
    }
    
    // Prevent overscroll at the bottom
    if (scrollTop + clientHeight >= scrollHeight) {
      e.preventDefault();
      e.target.scrollTop = scrollHeight - clientHeight;
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

        // Prevent overscroll
        if (newScrollTop < 0) {
          e.preventDefault();
          rootElement.scrollTop = 0;
        } else if (newScrollTop > rootElement.scrollHeight - rootElement.clientHeight) {
          e.preventDefault();
          rootElement.scrollTop = rootElement.scrollHeight - rootElement.clientHeight;
        }
      };

      rootElement.addEventListener('touchstart', handleTouchStart, { passive: false });
      rootElement.addEventListener('touchmove', handleTouchMove, { passive: false });

      return () => {
        rootElement.removeEventListener('touchstart', handleTouchStart);
        rootElement.removeEventListener('touchmove', handleTouchMove);
      };
    }

    // Add scroll event listener for overscroll prevention
    const handleScroll = (e) => {
      preventOverscroll(e);
    };

    rootElement.addEventListener('scroll', handleScroll, { passive: false });

    return () => {
      rootElement.removeEventListener('scroll', handleScroll);
    };
  }, [isStandalone, isIOS, preventOverscroll]);

  useEffect(() => {
    const cleanup = setupMobileScrolling();
    return cleanup;
  }, [setupMobileScrolling]);

  // Prevent body scrolling when PWA is active
  useEffect(() => {
    if (!isStandalone() && !isIOS()) return;

    const preventBodyScroll = (e) => {
      e.preventDefault();
    };

    // Prevent body scroll events
    document.body.addEventListener('touchmove', preventBodyScroll, { passive: false });
    document.body.addEventListener('scroll', preventBodyScroll, { passive: false });

    return () => {
      document.body.removeEventListener('touchmove', preventBodyScroll);
      document.body.removeEventListener('scroll', preventBodyScroll);
    };
  }, [isStandalone, isIOS]);

  return {
    isStandalone: isStandalone(),
    isIOS: isIOS(),
  };
};
