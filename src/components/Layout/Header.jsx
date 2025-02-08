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
  onBack, // Keep the onBack prop for potential custom back actions
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
    // ... (your useEffect for live time - remains the same) ...
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
  // ... (right section logic - remains the same) ...
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

  const handleBackNavigation = () => {
    if (onBack) {
      onBack(); // Call the custom onBack function if provided
    } else {
      navigate('/home'); // Navigate to homepage if onBack is not provided
    }
  };


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
        {rightSection}
      </div>
    </div>
  );
});

Header.displayName = 'Header';

export default Header;