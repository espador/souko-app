// SessionOverviewPage.jsx
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { formatTime } from '../utils/formatTime';
import '../styles/global.css';
import '../styles/components/SessionOverviewPage.css';
import { TextGenerateEffect } from "../styles/components/text-generate-effect.tsx";

const SessionOverviewPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const totalTime = location.state?.totalTime || 0;
  const projectId = location.state?.projectId;

  const formattedTime = formatTime(totalTime);

  const handleStartNewSession = () => {
    navigate('/time-tracker');
  };

  const handleReturnHome = () => {
    navigate('/home');
  };

  const handleOpenProjectDetails = () => {
    if (projectId) {
      navigate(`/project/${projectId}`);
    } else {
      console.warn("Project ID not available to open details.");
    }
  };

  const handleShare = () => {
    // This button is currently disabled
  };

  return (
    <div className="session-overview-page">
      <section className="motivational-section">
        <TextGenerateEffect
          words={`For <span class="accent-text">${formattedTime}</span>, you lived the\n now! Honoring the simplicity\n of being.`}
        />
      </section>

      <div className="overview-actions">
        <button className="button secondary-button" onClick={handleStartNewSession}>
          Start a new session
        </button>
        <button className="button secondary-button" onClick={handleOpenProjectDetails} disabled={!projectId}>
          Open project details
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
};

export default SessionOverviewPage;