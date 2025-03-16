import React, { memo, useEffect, useState } from 'react';
import { db } from '../../services/firebase';
import { doc, getDoc } from 'firebase/firestore';

import { ReactComponent as HomeActiveIcon } from '../../styles/components/assets/home-active.svg';
import { ReactComponent as HomeInactiveIcon } from '../../styles/components/assets/home-inactive.svg';
import { ReactComponent as ProjectsActiveIcon } from '../../styles/components/assets/projects-active.svg';
import { ReactComponent as ProjectsInactiveIcon } from '../../styles/components/assets/projects-inactive.svg';
import { ReactComponent as JournalActiveIcon } from '../../styles/components/assets/journal-active.svg';
import { ReactComponent as JournalInactiveIcon } from '../../styles/components/assets/journal-inactive.svg';
import { ReactComponent as JournalActiveNotificationIcon } from '../../styles/components/assets/journal-active-notification.svg';
import { ReactComponent as JournalInactiveNotificationIcon } from '../../styles/components/assets/journal-inactive-notification.svg';

import { ReactComponent as StartTimerIcon } from '../../styles/components/assets/start-timer.svg';
import { ReactComponent as StopTimerIcon } from '../../styles/components/assets/stop-timer.svg';

const FloatingNavigation = memo(
  ({ currentPage, navigate, hasActiveSession, activeSession, currentUser }) => {
    const [needsJournalEntry, setNeedsJournalEntry] = useState(false);

    // Check if user has logged a journal entry today
    useEffect(() => {
      const checkJournalStatus = async () => {
        if (!currentUser) return;
        
        try {
          const profileRef = doc(db, 'profiles', currentUser.uid);
          const profileSnap = await getDoc(profileRef);
          
          if (profileSnap.exists()) {
            const profileData = profileSnap.data();
            const lastJournalDate = profileData.lastJournalDate;
            
            if (lastJournalDate) {
              // Convert Firestore timestamp to Date if needed
              const lastDate = lastJournalDate.toDate ? lastJournalDate.toDate() : new Date(lastJournalDate);
              
              // Get today's date (reset to midnight for comparison)
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              
              // Reset lastDate to midnight for comparison
              const lastDateMidnight = new Date(lastDate);
              lastDateMidnight.setHours(0, 0, 0, 0);
              
              // If lastJournalDate is not today, user needs to log a journal entry
              setNeedsJournalEntry(lastDateMidnight < today);
            } else {
              // No lastJournalDate means user has never logged a journal entry
              setNeedsJournalEntry(true);
            }
          } else {
            // No profile means user needs to log a journal entry
            setNeedsJournalEntry(true);
          }
        } catch (error) {
          console.error('Error checking journal status:', error);
          setNeedsJournalEntry(false);
        }
      };
      
      checkJournalStatus();
    }, [currentUser]);

    // Helper to check if a page is active for highlight
    const isActive = (pageName) => currentPage === pageName;

    // Timer click => open either time-tracker-setup or time-tracker (with sessionId)
    const handleTimerClick = () => {
      if (hasActiveSession && activeSession) {
        // Pass the running session's ID so TimeTrackerPage can load it
        navigate('time-tracker', { sessionId: activeSession.id });
      } else {
        navigate('time-tracker-setup');
      }
    };

    // Determine which journal icon to show based on active state and notification status
    const renderJournalIcon = () => {
      if (isActive('journal-overview')) {
        return needsJournalEntry ? <JournalActiveNotificationIcon /> : <JournalActiveIcon />;
      } else {
        return needsJournalEntry ? <JournalInactiveNotificationIcon /> : <JournalInactiveIcon />;
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
          {renderJournalIcon()}
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
