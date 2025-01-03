// Header.jsx
import React, { useState, useEffect, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/components/Header.css';
import { ReactComponent as ReturnIcon } from '../../styles/components/assets/return.svg';

const Header = memo(({ title, showBackArrow, onBack, user, hideProfile, children, showLiveTime = false }) => {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState('');

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
        {children ? (
          children
        ) : user?.photoURL ? (
          <img src={user.photoURL} alt="Profile" className="profile-pic" />
        ) : !hideProfile ? (
          <div className="profile-placeholder">
            {user?.displayName?.charAt(0) || 'U'}
          </div>
        ) : null}
      </div>
    </div>
  );
});

Header.displayName = 'Header';

export default Header;