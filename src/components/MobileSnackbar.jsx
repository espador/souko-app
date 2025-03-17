import React, { useState, useEffect } from 'react';

const MobileSnackbar = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if this snackbar has already been shown in this session
    const hasShownSnackbar = sessionStorage.getItem('snackbarShown');
    
    if (hasShownSnackbar) {
      // Already shown in this session, don't show again
      return;
    }

    // Check if user is on mobile
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
      setIsMobile(isMobileDevice);
      
      // Check if iOS
      const isIOSDevice = /iphone|ipad|ipod/i.test(userAgent.toLowerCase());
      setIsIOS(isIOSDevice);
      
      // Check if already installed as PWA
      const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || 
                                (window.navigator.standalone === true);
      setIsStandalone(isInStandaloneMode);
    };

    checkMobile();
    
    // Only show snackbar if on mobile and not already installed
    if (isMobile && !isStandalone) {
      // Show after a short delay
      const timer = setTimeout(() => {
        setIsVisible(true);
        
        // Mark as shown for this session
        sessionStorage.setItem('snackbarShown', 'true');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
          setIsVisible(false);
        }, 5000);
      }, 1000); // Show after 1 second delay
      
      return () => clearTimeout(timer);
    }
  }, [isMobile, isStandalone]);

  const handleClose = () => {
    setIsVisible(false);
  };

  // Don't render anything if not mobile or already installed or not visible
  if (!isMobile || isStandalone || !isVisible) {
    return null;
  }

  return (
    <div className={`mobile-snackbar ${isVisible ? 'visible' : ''}`}>
      <div className="snackbar-content">
        {isIOS ? (
          <span>Add Souko to your Home Screen for the optimal experience!</span>
        ) : (
          <span>Install Souko to your device for the optimal experience</span>
        )}
        <button className="snackbar-close" onClick={handleClose}>×</button>
      </div>
    </div>
  );
};

export default MobileSnackbar;
