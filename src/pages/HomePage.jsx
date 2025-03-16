import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { auth, db } from '../services/firebase';
import { signOut } from 'firebase/auth';
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  orderBy,
  limit
} from 'firebase/firestore';
import { formatTime } from '../utils/formatTime';
import { format } from 'date-fns';
import Header from '../components/Layout/Header';
import '../styles/global.css';
import { ReactComponent as Spinner } from '../styles/components/assets/spinner.svg';
import '@fontsource/shippori-mincho';
import Sidebar from '../components/Layout/Sidebar';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { TextGenerateEffect } from '../styles/components/text-generate-effect.tsx';
import LevelProfile from '../components/Level/LevelProfile';

export const cn = (...inputs) => twMerge(clsx(inputs));

const CACHE_DURATION_MS = 30000;

const loadCachedHomePageData = (uid) => {
  const cacheKey = `homePageData_${uid}`;
  const cachedStr = localStorage.getItem(cacheKey);
  if (cachedStr) {
    try {
      const cached = JSON.parse(cachedStr);
      if (Date.now() - cached.timestamp < CACHE_DURATION_MS) {
        return cached;
      }
    } catch (e) {
      console.error('Error parsing cached home page data', e);
    }
  }
  return null;
};

const cacheHomePageData = (
  uid,
  projects,
  sessions,
  userProfile,
  levelConfig,
  hasTrackedEver
) => {
  const cache = {
    projects,
    sessions,
    userProfile,
    levelConfig,
    hasTrackedEver,
    timestamp: Date.now(),
  };
  localStorage.setItem(`homePageData_${uid}`, JSON.stringify(cache));
};

const HomePage = React.memo(({ navigate, skipAutoRedirect, currentPage }) => {
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [levelConfig, setLevelConfig] = useState(null);
  const [hasTrackedEver, setHasTrackedEver] = useState(false);
  const [loading, setLoading] = useState(true);
  const [totalTrackedTimeMinutes, setTotalTrackedTimeMinutes] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [needsJournalEntry, setNeedsJournalEntry] = useState(true);
  const today = useMemo(() => new Date(), []);

  const fetchHomeData = React.useCallback(async (uid) => {
    const cachedData = loadCachedHomePageData(uid);
    if (cachedData) {
      console.log('HomePage: Loaded data from cache');
      setProjects(cachedData.projects || []);
      setSessions(cachedData.sessions || []);
      setUserProfile(cachedData.userProfile || null);
      setLevelConfig(cachedData.levelConfig || null);
      setHasTrackedEver(cachedData.hasTrackedEver || false);
    } else {
      console.log('HomePage: No valid cache found, show spinner');
      setLoading(true);
    }

    try {
      const projectsSnap = await getDocs(
        query(collection(db, 'projects'), where('userId', '==', uid))
      );
      const userProjects = projectsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const sessionsQuery = query(
        collection(db, 'sessions'),
        where('userId', '==', uid),
        where('status', 'in', ['stopped', 'completed']), // Include both stopped and completed (manual) sessions
        orderBy('startTime', 'desc'),
        limit(3)
      );
      const sessionsSnap = await getDocs(sessionsQuery);
      const userSessions = sessionsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      const userHasTrackedEver = userSessions.length > 0;

      const profileRef = doc(db, 'profiles', uid);
      const profileSnap = await getDoc(profileRef);

      let profileData = null;
      let totalMinutes = 0;
      if (profileSnap.exists()) {
        profileData = profileSnap.data();
        totalMinutes = profileData.totalTrackedTime || 0;
        
        // Check if user has logged a journal entry today
        const lastJournalDate = profileData.lastJournalDate;
        
        if (lastJournalDate) {
          // Convert Firestore timestamp to Date if needed
          const lastDate = lastJournalDate.toDate ? lastJournalDate.toDate() : new Date(lastJournalDate);
          
          // Get today's date (reset to midnight for comparison)
          const todayDate = new Date();
          todayDate.setHours(0, 0, 0, 0);
          
          // Reset lastDate to midnight for comparison
          const lastDateMidnight = new Date(lastDate);
          lastDateMidnight.setHours(0, 0, 0, 0);
          
          // If lastJournalDate is today, user has already logged a journal entry
          setNeedsJournalEntry(lastDateMidnight < todayDate);
        } else {
          // No lastJournalDate means user has never logged a journal entry
          setNeedsJournalEntry(true);
        }
      } else {
        setNeedsJournalEntry(true);
      }

      const levelConfigRef = doc(db, 'config', 'level_config');
      const levelConfigSnap = await getDoc(levelConfigRef);
      let lvlCfg = null;
      if (levelConfigSnap.exists()) {
        lvlCfg = levelConfigSnap.data();
      }

      setProjects(userProjects);
      setSessions(userSessions);
      setUserProfile(profileData);
      setLevelConfig(lvlCfg);
      setHasTrackedEver(userHasTrackedEver);
      setTotalTrackedTimeMinutes(totalMinutes);

      cacheHomePageData(
        uid,
        userProjects,
        userSessions,
        profileData,
        lvlCfg,
        userHasTrackedEver
      );
    } catch (err) {
      console.error('HomePage: Error fetching fresh data:', err);
      setNeedsJournalEntry(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (currentUser) => {
      if (!currentUser) {
        navigate('login');
        return;
      }
      setUser(currentUser);
      fetchHomeData(currentUser.uid);
    });
    return unsubscribeAuth;
  }, [navigate, fetchHomeData]);

  useEffect(() => {
    if (!loading) {
      if (
        !currentPage.startsWith('onboarding') &&
        (!userProfile || userProfile.onboardingComplete !== true)
      ) {
        navigate('onboarding-step1');
      }
    }
  }, [loading, userProfile, currentPage, navigate]);

  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth);
      navigate('login');
    } catch (error) {
      console.error('Logout Error:', error.message);
    }
  }, [navigate]);

  // Handle click on "How did you feel today?" button
  const handleTodayJournalClick = useCallback(() => {
    const todayFormatted = format(today, 'yyyy-MM-dd');
    navigate('journal-form', { selectedDate: todayFormatted });
  }, [today, navigate]);

  const openSidebar = useCallback(() => setIsSidebarOpen(true), []);
  const closeSidebar = useCallback(() => setIsSidebarOpen(false), []);

  const sessionsToRender = useMemo(() => {
    return [...sessions];
  }, [sessions]);

  const projectMap = useMemo(() => {
    return projects.reduce((acc, project) => {
      acc[project.id] = project;
      return acc;
    }, {});
  }, [projects]);

  const weeklyTrackedTime = userProfile?.weeklyTrackedTime || 0;

  if (loading) {
    return (
      <div className="homepage-loading">
        <Spinner className="profile-pic souko-logo-header spinning-logo" />
      </div>
    );
  }

  const formatSessionStartTime = (startTime) => {
    if (!startTime) return 'N/A';
    
    // Handle both Firestore Timestamp and regular Date objects
    let date;
    if (startTime.toDate) {
      // It's a Firestore Timestamp
      date = startTime.toDate();
    } else {
      // It's already a Date object or timestamp
      date = new Date(startTime);
    }
  
    let hours = date.getHours();
    let minutes = date.getMinutes();
  
    hours = String(hours).padStart(2, '0');
    minutes = String(minutes).padStart(2, '0');
  
    return `${hours}:${minutes}`;
  };
  

  return (
    <div className="homepage">
      <Header
        navigate={navigate}
        user={userProfile}
        showLiveTime={true}
        onProfileClick={openSidebar}
        soukoNumber={userProfile?.soukoNumber}
      />
      <main className="homepage-content">
        <section className="motivational-section">
          <TextGenerateEffect
            words={
              !hasTrackedEver
                ? `Every journey begins with one moment.\nStart tracking yours.`
                : weeklyTrackedTime > 0
                ? `This moment is progress. You\n tracked <span class="accent-text">${formatTime(
                    weeklyTrackedTime
                  )}</span>\ this week.`
                : `Momentum begins with a single tracked hour. Let's go.`
            }
          />
        </section>

        <div className="divider"></div>

        <div className="level-journal-container">
          <LevelProfile
            projectName="Souko"
            totalTrackedTimeMinutes={totalTrackedTimeMinutes}
            levelProgressionData={levelConfig}
          />
        </div>
        
        {/* Add the journal button below the level-journal-container */}
        {needsJournalEntry && (
          <button 
            className="home-today-button" 
            onClick={handleTodayJournalClick}
          >
            How do you feel today?
          </button>
        )}

        <section className="sessions-section">
          <div className="sessions-header">
            <h2 className="sessions-label">Recent sessions</h2>
          </div>
          {sessionsToRender.length > 0 ? (
            <ul className="sessions-list">
              {sessionsToRender.map((session) => {
                const project = projectMap[session.projectId];
                const projectName = project?.name || 'Unknown Project';
                const projectImageUrl = project?.imageUrl;
                const startTimeFormatted = formatSessionStartTime(session.startTime);
                const elapsedTimeFormatted = formatTime(session.elapsedTime, 'xxh xxm');
                return (
                  <li
                    key={session.id}
                    className="session-item"
                    onClick={() =>
                      navigate('session-detail', { sessionId: session.id })
                    }
                  >
                    <div className="session-item-container">
                      <div className="session-left-content">
                        <div className="session-image-container">
                          {projectImageUrl ? (
                            <img
                              src={projectImageUrl}
                              alt={projectName}
                              className="session-image"
                            />
                          ) : (
                            <div
                              className="default-session-image"
                              style={{ backgroundColor: '#FE2F00' }}
                            >
                              <span>
                                {projectName?.charAt(0).toUpperCase() || 'P'}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="session-info">
                          <div className="session-project-name">{projectName}</div>
                          <div className="session-details-time-label">
                            <span className="session-start-time-homepage">{startTimeFormatted}</span>
                            {session.isManual && <span className="session-manual-label"> Manual</span>}
                            {session.sessionLabel && <span className="session-home-label"> {session.sessionLabel}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="session-right-content">
                        <div className="session-elapsed-time">
                          {elapsedTimeFormatted}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p>No sessions tracked yet. Start tracking to see results here!</p>
          )}
        </section>
      </main>

      <Sidebar
        isOpen={isSidebarOpen}
        onClose={closeSidebar}
        onLogout={handleLogout}
      />
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={closeSidebar}></div>
      )}
    </div>
  );
});

HomePage.displayName = 'HomePage';
export default HomePage;
