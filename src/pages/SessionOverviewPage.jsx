// SessionOverviewPage.jsx
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { formatTime } from '../utils/formatTime'; // Assuming you have this utility
import '../styles/global.css';
import '../styles/components/SessionOverviewPage.css';

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
      // Handle the case where projectId is not available
      console.warn("Project ID not available to open details.");
    }
  };

  const handleShare = () => {
    // This button is currently disabled
  };

  return (
    <div className="session-overview-page">
      <div className="overview-container">
        <p className="overview-quote">For <span className="overview-time">{formattedTime}</span>, you lived the now, honoring the simplicity of being.</p>

        <div className="overview-actions">
          <button className="button primary-button" onClick={handleStartNewSession}>
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
    </div>
  );
};

export default SessionOverviewPage;