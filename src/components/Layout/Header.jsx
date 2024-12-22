import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/components/Header.css';

const Header = ({ title, showBackArrow, onBack, user, hideProfile, children }) => {
  const navigate = useNavigate();

  return (
    <div className="header">
      {showBackArrow ? (
        <button className="back-button" onClick={onBack || (() => navigate(-1))}>
          ⬅ Back
        </button>
      ) : (
        <h1 className="header-title">{title}</h1>
      )}
      {!hideProfile && (
        <div className="header-profile">
          {children ? (
            children // Render children if provided
          ) : user?.photoURL ? (
            <img
              src={user.photoURL}
              alt="Profile"
              className="profile-pic"
            />
          ) : (
            <div className="profile-placeholder">
              {user?.displayName?.charAt(0) || 'U'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Header;
