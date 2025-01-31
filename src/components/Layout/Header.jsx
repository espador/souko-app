// Header.jsx
import React, { useState, useEffect, memo, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/components/Header.css';
import { ReactComponent as ReturnIcon } from '../../styles/components/assets/return.svg';
import { ReactComponent as SoukoLogoHeader } from '../../styles/components/assets/Souko-logo-header.svg'; // Import the logo

const Header = memo(({ title, showBackArrow, onBack, hideProfile, children, showLiveTime = false, onProfileClick }) => { // Added onProfileClick prop
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState('');
  const [isSpinning, setIsSpinning] = useState(true); // Assume spinning by default, or control with a prop if needed

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

  // Simplified useMemo to always return the SoukoLogoHeader
  const profileImageElement = useMemo(() => {
    if (children) {
      return children;
    } else if (!hideProfile) { // Keep hideProfile logic if you still want to conditionally hide the logo area
      return (
        <SoukoLogoHeader
          className={`profile-pic souko-logo-header ${isSpinning ? 'spinning-logo' : ''}`} // Added spinning-logo class conditionally
          onClick={onProfileClick}
          style={{ cursor: 'pointer' }}
        />
      ); // Render the SoukoLogoHeader component and added onClick
    } else {
      return null; // Still handle hideProfile if needed
    }
  }, [hideProfile, children, onProfileClick, isSpinning]); // Added isSpinning to dependency array

  return (
    <div className="header">
      <div className="header-left-section">
        {showBackArrow && (
          <button className="back-button" onClick={onBack || (() => navigate(-1))}>
            <ReturnIcon style={{ width: '40px', height: '40px' }} />
          </button>
        )}
        <h1 className="header-title">{title}</h1>
        {showLiveTime && <div className="header-live-time">{currentTime}</div>}
      </div>
      <div className="header-profile">
        {profileImageElement} {/* profileImageElement will now always be the SoukoLogoHeader (or null if hidden) */}
      </div>
    </div>
  );
});

Header.displayName = 'Header';

export default Header;