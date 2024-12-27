// src/components/Sidebar.jsx
import React from 'react';
import './Sidebar.css';

const Sidebar = ({ isOpen, onClose, onLogout }) => {
  return (
    <div className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-content">
        <button className="close-button" onClick={onClose}>
          close {/* Or use an icon */}
        </button>
        <h2>Every journey begins with one moment. Start tracking yours.</h2>
        <p>Build & designed by Bram</p>
        <button className="signout-button" onClick={onLogout}>
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default Sidebar;