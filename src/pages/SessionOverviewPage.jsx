// SessionOverviewPage.jsx
import React, { useCallback, useMemo } from 'react';
import { formatTime } from '../utils/formatTime';
import '../styles/global.css';
import { TextGenerateEffect } from "../styles/components/text-generate-effect.tsx";
import Header from '../components/Layout/Header';

const SessionOverviewPage = React.memo(({ navigate, totalTime, projectId }) => {
  const formattedTime = useMemo(() => formatTime(totalTime), [totalTime]);

  const handleStartNewSession = useCallback(() => {
    // Now that we have a setup page, you might want to go to "time-tracker-setup" again
    navigate('time-tracker-setup');
  }, [navigate]);

  const handleReturnHome = useCallback(() => {
    navigate('home');
  }, [navigate]);

  const handleOpenProjectDetails = useCallback(() => {
    if (projectId) {
      navigate('project-detail', { projectId });
    } else {
      console.warn("Project ID not available to open details.");
    }
  }, [navigate, projectId]);

  const handleShare = useCallback(() => {
    console.log("Share functionality is disabled.");
  }, []);

  return (
    <div className="session-overview-page">
      <Header
        variant="journalOverview"
        showBackArrow={true}
        navigate={navigate}
      />
      <section className="motivational-section">
        <TextGenerateEffect
          words={`For <span class="accent-text">${formattedTime}</span>, you lived the\n now! Honoring the simplicity\n of being.`}
        />
      </section>

      <div className="overview-actions sticky-button">
        <button className="button secondary-button" onClick={handleStartNewSession}>
          Start a new session
        </button>
        <button className="button secondary-button" onClick={handleReturnHome}>
          Return home
        </button>
        <button className="button secondary-button disabled" disabled onClick={handleShare}>
          Share
        </button>
      </div>
    </div>
  );
});

SessionOverviewPage.displayName = 'SessionOverviewPage';
export default SessionOverviewPage;
