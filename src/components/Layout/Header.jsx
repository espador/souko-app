// src/components/Layout/Header.jsx
import React, { useState, useEffect, memo } from 'react';
import { ReactComponent as ReturnIcon } from '../../styles/components/assets/return.svg';
import { ReactComponent as SoukoLogoHeader } from '../../styles/components/assets/Souko-logo-header.svg';
// 1) Import the new download icon:
import { ReactComponent as DownloadIcon } from '../../styles/components/assets/download.svg';

import MobileStepper from '@mui/material/MobileStepper';
import '../../styles/global.css';

const Header = memo(({
  variant = "home",
  title,
  showBackArrow,
  onBack,
  hideProfile,
  children,
  showLiveTime = false,
  onProfileClick,
  onActionClick = () => {},
  currentStep = 0,
  navigate,
  soukoNumber // Add soukoNumber as a prop
}) => {
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    if (showLiveTime) {
      const tick = () => {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        // Update currentTime format to include Souko number
        const timeString = `${hours}:${minutes}:${seconds}.${day}.${month}`;
        setCurrentTime(`S${soukoNumber ? soukoNumber + '.' : ''}${timeString}`);
      };
      tick();
      const intervalId = setInterval(tick, 1000);
      return () => clearInterval(intervalId);
    }
  }, [showLiveTime, soukoNumber]); // Add soukoNumber to dependency array

  const handleBackNavigation = () => {
    if (onBack) {
      onBack();
    } else {
      navigate('home'); // fallback if no custom onBack
    }
  };

  if (variant === "onboarding") {
    return (
      <div className="header header-onboarding">
        {showBackArrow && (
          <button className="back-button" onClick={handleBackNavigation}>
            <ReturnIcon style={{ width: '40px', height: '40px' }} />
          </button>
        )}
        <MobileStepper
          className="onboarding-stepper"
          variant="progress"
          steps={5}
          activeStep={currentStep}
          position="static"
          nextButton={<div />}
          backButton={<div />}
        />
      </div>
    );
  }

  // 2) If the variant is "sessionDetail", show the new 40x40 download icon
  if (variant === "sessionDetail") {
    return (
      <div className="header">
        <div className="header-left-section">
          {showBackArrow && (
            <button className="back-button" onClick={handleBackNavigation}>
              <ReturnIcon style={{ width: '40px', height: '40px' }} />
            </button>
          )}
          {title && <h1 className="header-title">{title}</h1>}
          {showLiveTime && <div className="header-live-time">{currentTime}</div>}
        </div>
        <div className="header-right-section">
          {/* Non-clickable download icon for now */}
          <DownloadIcon
            style={{ width: '40px', height: '40px', cursor: 'default' }}
          />
        </div>
      </div>
    );
  }

  // "projectOverview", "home", "journalOverview", etc.
  let rightSection = null;
  if (variant === "projectOverview") {
    rightSection = (
      <span className="header-action" onClick={onActionClick}>
        Add project
      </span>
    );
  } else {
    if (children) {
      rightSection = children;
    } else if (!hideProfile) {
      // Show spinning Souko logo by default
      rightSection = (
        <SoukoLogoHeader
          className="profile-pic souko-logo-header spinning-logo"
          onClick={onProfileClick}
          style={{ cursor: 'pointer' }}
        />
      );
    }
  }

  return (
    <div className="header">
      <div className="header-left-section">
        {showBackArrow && (
          <button className="back-button" onClick={handleBackNavigation}>
            <ReturnIcon style={{ width: '40px', height: '40px' }} />
          </button>
        )}
        {title && <h1 className="header-title">{title}</h1>}
        {showLiveTime && <div className="header-live-time">{currentTime}</div>}
      </div>
      <div className="header-right-section">{rightSection}</div>
    </div>
  );
});

Header.displayName = 'Header';
export default Header;