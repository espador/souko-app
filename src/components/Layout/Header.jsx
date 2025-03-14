// src/components/Layout/Header.jsx
import React, { useState, useEffect, memo } from 'react';
import { ReactComponent as ReturnIcon } from '../../styles/components/assets/return.svg';
import { ReactComponent as SoukoLogoHeader } from '../../styles/components/assets/Souko-logo-header.svg';
import { ReactComponent as DownloadIcon } from '../../styles/components/assets/download.svg';
import { ReactComponent as AddProjectIcon } from '../../styles/components/assets/add-project.svg';

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
  soukoNumber
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
        const timeString = `${hours}:${minutes}:${seconds}.${day}.${month}`;
        setCurrentTime(`S${soukoNumber ? soukoNumber + '.' : ''}${timeString}`);
      };
      tick();
      const intervalId = setInterval(tick, 1000);
      return () => clearInterval(intervalId);
    }
  }, [showLiveTime, soukoNumber]);

  const handleBackNavigation = () => {
    if (onBack) {
      onBack();
    } else {
      navigate('home');
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
          <DownloadIcon
            style={{ width: '40px', height: '40px', cursor: 'default' }}
          />
        </div>
      </div>
    );
  }

  let rightSection = null;
  if (variant === "projectOverview") {
    rightSection = (
      <button className="add-project" onClick={onActionClick}>
        <AddProjectIcon className="add-project-icon" />
      </button>
    );
  } else if (variant === "timeTrackerSetup") {
    rightSection = (
      <button className="add-project" onClick={onActionClick}>
        <AddProjectIcon className="add-project-icon" />
      </button>
    );
  } else {
    if (children) {
      rightSection = children;
    } else if (variant === "home") { // Show SoukoLogoHeader only on homepage
      if (!hideProfile) {
        rightSection = (
          <SoukoLogoHeader
            className="profile-pic souko-logo-header spinning-logo"
            onClick={onProfileClick}
            style={{ cursor: 'pointer' }}
          />
        );
      } else {
        rightSection = null; // Or <div />;
      }
    }
    else { // For all other variants other than "home", "projectOverview", "onboarding", "sessionDetail"
      rightSection = null; // Or <div />; if you need it to be rendered in the DOM but empty
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
