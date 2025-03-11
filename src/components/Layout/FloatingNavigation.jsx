import React, { memo } from 'react';

import { ReactComponent as HomeActiveIcon } from '../../styles/components/assets/home-active.svg';
import { ReactComponent as HomeInactiveIcon } from '../../styles/components/assets/home-inactive.svg';
import { ReactComponent as ProjectsActiveIcon } from '../../styles/components/assets/projects-active.svg';
import { ReactComponent as ProjectsInactiveIcon } from '../../styles/components/assets/projects-inactive.svg';
import { ReactComponent as JournalActiveIcon } from '../../styles/components/assets/journal-active.svg';
import { ReactComponent as JournalInactiveIcon } from '../../styles/components/assets/journal-inactive.svg';

import { ReactComponent as StartTimerIcon } from '../../styles/components/assets/start-timer.svg';
import { ReactComponent as StopTimerIcon } from '../../styles/components/assets/stop-timer.svg';

const FloatingNavigation = memo(
  ({ currentPage, navigate, hasActiveSession, activeSession }) => {
    // Helper to check if a page is active for highlight
    const isActive = (pageName) => currentPage === pageName;

    // Timer click => open either time-tracker-setup or time-tracker (with sessionId)
    const handleTimerClick = () => {
      if (hasActiveSession && activeSession) {
        // Pass the running session’s ID so TimeTrackerPage can load it
        navigate('time-tracker', { sessionId: activeSession.id });
      } else {
        navigate('time-tracker-setup');
      }
    };

    return (
      <div className="floating-navigation-container">
        {/* Home icon */}
        <button
          className="floating-navigation-button"
          onClick={() => navigate('home')}
        >
          {isActive('home') ? <HomeActiveIcon /> : <HomeInactiveIcon />}
        </button>

        {/* Projects icon */}
        <button
          className="floating-navigation-button"
          onClick={() => navigate('projects')}
        >
          {isActive('projects') ? (
            <ProjectsActiveIcon />
          ) : (
            <ProjectsInactiveIcon />
          )}
        </button>

        {/* Journal icon */}
        <button
          className="floating-navigation-button"
          onClick={() => navigate('journal-overview')}
        >
          {isActive('journal-overview') ? (
            <JournalActiveIcon />
          ) : (
            <JournalInactiveIcon />
          )}
        </button>

        {/* Timer icon (Start / Stop) */}
        <button className="floating-navigation-button" onClick={handleTimerClick}>
          {hasActiveSession ? <StopTimerIcon /> : <StartTimerIcon />}
        </button>
      </div>
    );
  }
);

export default FloatingNavigation;
