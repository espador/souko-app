import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/components/Header.css';

const Header = ({ title, showBackArrow, onBack, user, hideProfile, children }) => {
  const navigate = useNavigate();

  // Helper function to format title if it's a date
const formattedTitle = (dateString) => {
  try {
    const date = new Date(dateString);
    return date.toLocaleString('en-GB', {
      weekday: 'long', // Full weekday name
      day: 'numeric', // Day of the month
      month: 'long', // Full month name
      timeZone: 'Europe/Brussels', // Explicitly set Brussels timezone
    });
  } catch (error) {
    console.error('Invalid date:', dateString);
    return dateString; // Fallback to original title if not a valid date
  }
};


  return (
    <div className="header">
      {showBackArrow ? (
        <button className="back-button" onClick={onBack || (() => navigate(-1))}>
          ⬅ Back
        </button>
      ) : (
        <h1 className="header-title">{formattedTitle(title)}</h1>
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
