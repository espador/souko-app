// src/components/Journal/JournalConfirmation.jsx
import React from 'react';
import './JournalConfirmation.css';
import { Link } from 'react-router-dom'; // Import Link

const JournalConfirmation = () => {
  return (
    <div className="journal-confirmation-container">
      <p className="journal-confirmation-quote">
        "Embrace the rhythm of your journey." {/* Placeholder quote */}
      </p>
      <div className="journal-confirmation-buttons">
        <button className="journal-confirmation-button">Return home</button> {/* Placeholder button - link to homepage later */}
        <Link to="/journal-overview" className="journal-confirmation-button journal-overview-link"> {/* Placeholder link to overview */}
          Open journal overview
        </Link>
      </div>
    </div>
  );
};

export default JournalConfirmation;