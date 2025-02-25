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
} from 'firebase/firestore';
import { formatTime } from '../utils/formatTime';
import Header from '../components/Layout/Header';
import '../styles/global.css';
import '../styles/components/HomePage.css';
import { ReactComponent as StartTimerIcon } from '../styles/components/assets/start-timer.svg';
import { ReactComponent as StopTimerIcon } from '../styles/components/assets/stop-timer.svg';
import { ReactComponent as SoukoLogoHeader } from '../styles/components/assets/Souko-logo-header.svg';
import '@fontsource/shippori-mincho';
import Sidebar from '../components/Layout/Sidebar';
import '../styles/components/Sidebar.css';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { TextGenerateEffect } from '../styles/components/text-generate-effect.tsx';
import JournalSection from '../components/Journal/JournalSection';
import LevelProfile from '../components/Level/LevelProfile';

export const cn = (...inputs) => twMerge(clsx(inputs));

const CACHE_DURATION_MS = 30000; // 30 seconds

// --------------
// CACHE HELPERS
// --------------
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
  journalEntries,
  userProfile,
  levelConfig,
  hasTrackedEver
) => {
  const cache = {
    projects,
    sessions,
    journalEntries,
    userProfile,
    levelConfig,
    hasTrackedEver,
    timestamp: Date.now(),
  };
  localStorage.setItem(`homePageData_${uid}`, JSON.stringify(cache));
};

// --------------
// HOME PAGE
// --------------
const HomePage = React.memo(({ navigate, skipAutoRedirect, currentPage }) => {
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [journalEntries, setJournalEntries] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [levelConfig, setLevelConfig] = useState(null);
  const [hasTrackedEver, setHasTrackedEver] = useState(false);

  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState(null);
  const [totalTrackedTimeMinutes, setTotalTrackedTimeMinutes] = useState(0);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const fabRef = useRef(null);
  const scrollTimeout = useRef(null);

  const hasActiveSession = Boolean(activeSession);

  // -----------------------------------------------------
  // 1. On Auth - Load Cache Immediately, Then Fetch Fresh
  // -----------------------------------------------------
  const fetchHomeData = useCallback(async (uid) => {
    // 1) Attempt loading from cache first
    const cachedData = loadCachedHomePageData(uid);
    if (cachedData) {
      console.log('HomePage: Loaded data from cache');
      // Show cached data right away
      setProjects(cachedData.projects || []);
      setSessions(cachedData.sessions || []);
      setJournalEntries(cachedData.journalEntries || []);
      setUserProfile(cachedData.userProfile || null);
      setLevelConfig(cachedData.levelConfig || null);
      setHasTrackedEver(cachedData.hasTrackedEver || false);

      // We won't set loading to false yet if we also want a fresh fetch
      // so that we can show a spinner or partial UI update. 
      // If you'd rather hide the spinner now, you can do so:
      // setLoading(false);
    } else {
      // No cache or cache is outdated
      console.log('HomePage: No valid cache found, show spinner');
      setLoading(true);
    }

    // 2) Always fetch from Firestore in the background
    try {
      // Projects
      const projectsSnap = await getDocs(
        query(collection(db, 'projects'), where('userId', '==', uid))
      );
      const userProjects = projectsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Sessions
      const sessionsSnap = await getDocs(
        query(collection(db, 'sessions'), where('userId', '==', uid))
      );
      const userSessions = sessionsSnap.docs.map((doc) => doc.data());
      const userHasTrackedEver = userSessions.length > 0;

      // Journal (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const journalSnap = await getDocs(
        query(
          collection(db, 'journalEntries'),
          where('userId', '==', uid),
          where('createdAt', '>=', sevenDaysAgo)
        )
      );
      const userJournalEntries = journalSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // User profile
      const profileRef = doc(db, 'profiles', uid);
      const profileSnap = await getDoc(profileRef);

      let profileData = null;
      let totalMinutes = 0;
      if (profileSnap.exists()) {
        profileData = profileSnap.data();
        totalMinutes = profileData.totalTrackedTime || 0;
      }

      // Level config
      const levelConfigRef = doc(db, 'config', 'level_config');
      const levelConfigSnap = await getDoc(levelConfigRef);
      let lvlCfg = null;
      if (levelConfigSnap.exists()) {
        lvlCfg = levelConfigSnap.data();
      }

      // Set states with fresh data
      setProjects(userProjects);
      setSessions(userSessions);
      setJournalEntries(userJournalEntries);
      setUserProfile(profileData);
      setLevelConfig(lvlCfg);
      setHasTrackedEver(userHasTrackedEver);
      setTotalTrackedTimeMinutes(totalMinutes);

      // Cache the fresh data
      cacheHomePageData(
        uid,
        userProjects,
        userSessions,
        userJournalEntries,
        profileData,
        lvlCfg,
        userHasTrackedEver
      );
    } catch (err) {
      console.error('HomePage: Error fetching fresh data:', err);
    } finally {
      // Hide spinner once done
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
      fetchHomeData(currentUser.uid); // Load or refresh data
    });
    return unsubscribeAuth;
  }, [navigate, fetchHomeData]);

  // -------------------------------------------
  // 2. Real-time active session for FAB only
  // -------------------------------------------
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { onSnapshot } = await import('firebase/firestore');
      const activeSessionQuery = query(
        collection(db, 'sessions'),
        where('userId', '==', user.uid),
        where('endTime', '==', null)
      );
      const unsubActiveSession = onSnapshot(activeSessionQuery, (snap) => {
        if (!snap.empty) {
          setActiveSession(snap.docs[0].data());
        } else {
          setActiveSession(null);
        }
      });
      return () => unsubActiveSession && unsubActiveSession();
    })();
  }, [user]);

  // -------------------------------------------
  // 3. Onboarding Logic
  // -------------------------------------------
  useEffect(() => {
    if (!loading && userProfile !== undefined) {
      // If not on an onboarding route
      const isOnboardingRoute = currentPage.startsWith('onboarding');
      if (!isOnboardingRoute) {
        if (!userProfile || userProfile.onboardingComplete !== true) {
          navigate('onboarding-step1');
        }
      }
    }
  }, [loading, userProfile, navigate, currentPage]);

  // -------------------------------------------
  // 4. Sidebar & Logout
  // -------------------------------------------
  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth);
      navigate('login');
    } catch (error) {
      console.error('Logout Error:', error.message);
    }
  }, [navigate]);

  const openSidebar = useCallback(() => setIsSidebarOpen(true), []);
  const closeSidebar = useCallback(() => setIsSidebarOpen(false), []);

  // -------------------------------------------
  // 5. Hide FAB on scroll
  // -------------------------------------------
  useEffect(() => {
    const handleScroll = () => {
      if (fabRef.current) {
        fabRef.current.classList.add('scrolling');
        clearTimeout(scrollTimeout.current);
        scrollTimeout.current = setTimeout(() => {
          fabRef.current && fabRef.current.classList.remove('scrolling');
        }, 300);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // -------------------------------------------
  // 6. Computed Values
  // -------------------------------------------
  const projectsToRender = useMemo(() => {
    return [...projects]
      .sort((a, b) => (b.lastTrackedTime || 0) - (a.lastTrackedTime || 0))
      .slice(0, 3);
  }, [projects]);

  const totalSessionTime = useMemo(() => {
    return sessions.reduce((acc, session) => {
      const pid = session.projectId || 'Unknown Project';
      acc[pid] = (acc[pid] || 0) + (session.elapsedTime || 0);
      return acc;
    }, {});
  }, [sessions]);

  const weeklyTrackedTime = userProfile?.weeklyTrackedTime || 0;

  // -------------------------------------------
  // 7. Render
  // -------------------------------------------
  if (loading) {
    // Show loading spinner if data is not yet loaded from Firestore or cache
    return (
      <div className="homepage-loading">
        <SoukoLogoHeader className="profile-pic souko-logo-header spinning-logo" />
      </div>
    );
  }

  return (
    <div className="homepage">
      <Header
        navigate={navigate}
        user={userProfile}
        showLiveTime={true}
        onProfileClick={openSidebar}
      />
      <main className="homepage-content">
        <LevelProfile
          projectName="Souko"
          totalTrackedTimeMinutes={totalTrackedTimeMinutes}
          levelProgressionData={levelConfig}
        />

        <section className="motivational-section">
          <TextGenerateEffect
            words={
              !hasTrackedEver
                ? `Every journey begins with one moment.\nStart tracking yours.`
                : weeklyTrackedTime > 0
                ? `This moment is\n progress. You\n tracked <span class="accent-text">${formatTime(
                    weeklyTrackedTime
                  )}</span>\n this week.`
                : `Momentum begins with a single tracked hour. Let’s go.`
            }
          />
        </section>

        <JournalSection navigate={navigate} journalEntries={journalEntries} loading={false} />

        <section className="projects-section">
          <div className="projects-header">
            <h2 className="projects-label">Your projects</h2>
            <div className="projects-actions">
              <button
                onClick={() => navigate('projects')}
                className="projects-all-link"
              >
                All
              </button>
            </div>
          </div>
          {projectsToRender.length > 0 ? (
            <ul className="projects-list">
              {projectsToRender.map((project) => (
                <li
                  key={project.id}
                  className="project-item"
                  onClick={() =>
                    navigate('project-detail', { projectId: project.id })
                  }
                >
                  <div className="project-image-container">
                    {project.imageUrl ? (
                      <img
                        src={project.imageUrl}
                        alt={project.name}
                        className="project-image"
                      />
                    ) : (
                      <div
                        className="default-project-image"
                        style={{ backgroundColor: '#FE2F00' }}
                      >
                        <span>
                          {project.name?.charAt(0).toUpperCase() || 'P'}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="project-name">{project.name}</div>
                  <div className="project-total-time">
                    {totalSessionTime[project.id]
                      ? formatTime(totalSessionTime[project.id])
                      : formatTime(0)}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p>No projects found. Start tracking to see results here!</p>
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

      <button ref={fabRef} className="fab" onClick={() => navigate('time-tracker')}>
        {hasActiveSession ? (
          <StopTimerIcon className="fab-icon" />
        ) : (
          <StartTimerIcon className="fab-icon" />
        )}
      </button>
    </div>
  );
});

HomePage.displayName = 'HomePage';
export default HomePage;
