// src/components/Journal/JournalConfirmation.jsx
import React from 'react';
import './JournalConfirmation.css';
import { Link } from 'react-router-dom';

const JournalConfirmation = () => {
  return (
    <div className="journal-confirmation-container">
      <p className="journal-confirmation-quote">
        Embrace the rhythm of your journey. 
      </p>
      <div className="journal-confirmation-buttons">
        <Link to="/home" className="journal-confirmation-button"> 
          Return home
        </Link>
        <Link to="/home" className="journal-confirmation-button journal-overview-link"> 
          Open your journal 
        </Link>
      </div>
    </div>
  );
};

export default JournalConfirmation;