// Header.jsx
import React, { useState, useEffect, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/components/Header.css';
import { ReactComponent as ReturnIcon } from '../../styles/components/assets/return.svg';
import { ReactComponent as SoukoLogoHeader } from '../../styles/components/assets/Souko-logo-header.svg';

const Header = memo(({
  variant = "home", // "home" (default) or "projectOverview"
  title,
  showBackArrow,
  onBack,
  hideProfile,
  children,
  showLiveTime = false,
  onProfileClick,
  onActionClick = () => {}  // default no-op if not provided
}) => {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState('');
  const [isSpinning, setIsSpinning] = useState(true);

  useEffect(() => {
    let intervalId;
    if (showLiveTime) {
      const tick = () => {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        setCurrentTime(`${hours}:${minutes}:${seconds}.${day}.${month}`);
      };
      tick();
      intervalId = setInterval(tick, 1000);
    }
    return () => clearInterval(intervalId);
  }, [showLiveTime]);

  // Determine what to render on the right side of the header.
  // For the projectOverview variant, we want to show "Add project".
  // Otherwise, we show the profile logo (or any passed children) unless hidden.
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
      rightSection = (
        <SoukoLogoHeader
          className={`profile-pic souko-logo-header ${isSpinning ? 'spinning-logo' : ''}`}
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
          <button className="back-button" onClick={onBack || (() => navigate(-1))}>
            <ReturnIcon style={{ width: '40px', height: '40px' }} />
          </button>
        )}
        {title && <h1 className="header-title">{title}</h1>}
        {showLiveTime && <div className="header-live-time">{currentTime}</div>}
      </div>
      <div className="header-right-section">
        {rightSection}
      </div>
    </div>
  );
});

Header.displayName = 'Header';

export default Header;
