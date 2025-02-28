import React, { useCallback } from 'react';
import '../../styles/global.css';
import Header from '../Layout/Header';

const JournalConfirmation = React.memo(({ navigate }) => {
  const handleReturnHome = useCallback(() => {
    navigate('home');
  }, [navigate]);

  const handleOpenJournal = useCallback(() => {
    navigate('journal-overview');
  }, [navigate]);

  return (
    <div className="journal-confirmation-page"> {/* Updated class name for page layout */}
      <Header variant="journalConfirmation" showBackArrow={true} navigate={navigate} /> {/* Add Header */}
      <div className="motivational-section"> {/* Reusing timer-quote class for styling */}
        Embrace the rhythm of your journey.
      </div>
      <div className="journal-confirmation-buttons sticky-button-container"> {/* Sticky buttons container */}
        <button onClick={handleReturnHome} className="journal-confirmation-button return-home-button">
          Return home
        </button>
        <button onClick={handleOpenJournal} className="journal-confirmation-button journal-overview-button">
          Open your journal
        </button>
      </div>
    </div>
  );
});

JournalConfirmation.displayName = 'JournalConfirmation';
export default JournalConfirmation;