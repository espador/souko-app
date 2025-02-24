import React, { useCallback } from 'react';
import './JournalConfirmation.css';

const JournalConfirmation = React.memo(({ navigate }) => { // <-- Receive navigate as prop
  const handleReturnHome = useCallback(() => {
    navigate('home'); // <-- Updated navigate call, page name as string
  }, [navigate]);

  const handleOpenJournal = useCallback(() => {
    navigate('journal-overview'); // <-- Updated navigate call, page name as string
  }, [navigate]);

  return (
    <div className="journal-confirmation-container">
      <p className="journal-confirmation-quote">
        Embrace the rhythm of your journey.
      </p>
      <div className="journal-confirmation-buttons">
        <button onClick={handleReturnHome} className="journal-confirmation-button">
          Return home
        </button>
        <button onClick={handleOpenJournal} className="journal-confirmation-button journal-overview-link">
          Open your journal
        </button>
      </div>
    </div>
  );
});

JournalConfirmation.displayName = 'JournalConfirmation'; // Recommended for React.memo
export default JournalConfirmation;