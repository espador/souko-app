// src/components/Sidebar.jsx
import React from 'react';
import '../../styles/components/Sidebar.css';
import { ReactComponent as ReturnIcon } from '../../styles/components/assets/return.svg';

const Sidebar = ({ isOpen, onClose, onLogout }) => {
  return (
    <div className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-content">
        <div className="close-button-container"> {/* New div for the close button */}
          <button className="close-button" onClick={onClose}>
            <ReturnIcon className="close-icon" /> {/* Renamed class to "close-icon" */}
          </button>
        </div>
        <h1>Every journey begins with one moment.</h1>
        <p>Build & designed by Bram</p>
        <button className="signout-button" onClick={onLogout}>
          <span className="signout-button-icon">✕</span> Sign Out
        </button>
      </div>
    </div>
  );
};

export default Sidebar;