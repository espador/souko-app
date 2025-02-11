// HomePage.jsx
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, getDocs, query, where, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import { formatTime } from '../utils/formatTime';
import Header from '../components/Layout/Header';
import '../styles/global.css';
import '../styles/components/HomePage.css';
import { ReactComponent as StartTimerIcon } from '../styles/components/assets/start-timer.svg';
import { ReactComponent as StopTimerIcon } from '../styles/components/assets/stop-timer.svg';
import '@fontsource/shippori-mincho';
import Sidebar from '../components/Layout/Sidebar';
import '../styles/components/Sidebar.css';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { TextGenerateEffect } from '../styles/components/text-generate-effect.tsx';
import JournalSection from '../components/Journal/JournalSection';
import { ReactComponent as SoukoLogoHeader } from '../styles/components/assets/Souko-logo-header.svg';
import { startOfWeek, endOfWeek } from 'date-fns';

export const cn = (...inputs) => twMerge(clsx(inputs));

const HomePage = React.memo(() => {
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [journalEntries, setJournalEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [hasTrackedEver, setHasTrackedEver] = useState(false);
  const [sortMode, setSortMode] = useState("tracked");
  const [refreshing, setRefreshing] = useState(false);

  const navigate = useNavigate();
  const fabRef = useRef(null);
  const scrollTimeout = useRef(null);
  const motivationalSectionRef = useRef(null);

  // Improved parseTimestamp function
  const parseTimestamp = useCallback((timestamp) => {
    if (!timestamp) return null;
    if (typeof timestamp === 'string') {
      const parsed = new Date(timestamp);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    if (typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    if (typeof timestamp.seconds === 'number' && typeof timestamp.nanoseconds === 'number') {
      const ms = timestamp.seconds * 1000 + timestamp.nanoseconds / 1000000;
      const date = new Date(ms);
      return isNaN(date.getTime()) ? null : date;
    }
    const date = new Date(timestamp);
    return isNaN(date.getTime()) ? null : date;
  }, []);

  const hasActiveSession = useMemo(() => sessions.some(session => !session.endTime), [sessions]);

  // Fetch fresh data without caching.
  const fetchData = useCallback(async (uid) => {
    setLoading(true);
    setRefreshing(true);
    try {
      // Fetch projects
      const projectSnapshot = await getDocs(query(collection(db, 'projects'), where('userId', '==', uid)));
      const userProjects = projectSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setProjects(userProjects);

      // Fetch sessions (you may later replace this with aggregated data)
      const sessionSnapshot = await getDocs(query(collection(db, 'sessions'), where('userId', '==', uid)));
      const userSessions = sessionSnapshot.docs.map(doc => doc.data());
      setSessions(userSessions);
      setHasTrackedEver(userSessions.length > 0);

      // Fetch journal entries from the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const journalSnapshot = await getDocs(query(
        collection(db, 'journalEntries'),
        where('userId', '==', uid),
        where('createdAt', '>=', sevenDaysAgo)
      ));
      const userJournalEntries = journalSnapshot.docs.map(doc => {
        const data = doc.data();
        return { ...data, id: doc.id, createdAt: parseTimestamp(data.createdAt) };
      });
      setJournalEntries(userJournalEntries);

      // Fetch user profile (which now should include aggregated fields like weeklyTrackedTime)
      const profileSnapshot = await getDoc(doc(db, 'profiles', uid));
      if (profileSnapshot.exists()) {
        setUserProfile(profileSnapshot.data());
      } else if (user) {
        setUserProfile({
          uid: user.uid,
          displayName: user.displayName,
          profileImageUrl: user.photoURL,
          featureAccessLevel: 'free',
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [parseTimestamp]);

  // Authentication and initial data fetch.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        navigate('/');
      } else {
        setUser(currentUser);
        fetchData(currentUser.uid);
      }
    });
    return () => unsubscribe();
  }, [navigate, fetchData]);

  // Instead of real‑time onSnapshot listeners for every collection, you might
  // attach a listener only for critical aggregated fields (like profile) or rely on foreground events.
  // For simplicity, here we omit the extra onSnapshot listeners.

  // Compute total session time per project (if needed)
  const totalSessionTime = useMemo(() => {
    return sessions.reduce((acc, session) => {
      const projectId = session.projectId || 'Unknown Project';
      acc[projectId] = (acc[projectId] || 0) + (session.elapsedTime || 0);
      return acc;
    }, {});
  }, [sessions]);

  // Use the aggregated weeklyTrackedTime from the profile (if available)
  const weeklyTrackedTime = useMemo(() => {
    return userProfile && userProfile.weeklyTrackedTime ? userProfile.weeklyTrackedTime : 0;
  }, [userProfile]);

  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('Logout Error:', error.message);
    }
  }, [navigate]);

  const openSidebar = useCallback(() => setIsSidebarOpen(true), []);
  const closeSidebar = useCallback(() => setIsSidebarOpen(false), []);

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

  const getInitials = useCallback((name) => name.trim().charAt(0).toUpperCase(), []);

  const renderProjectImage = useMemo(() => (project) =>
    project.imageUrl ? (
      <img src={project.imageUrl} alt={project.name} className="project-image" />
    ) : (
      <div className="default-project-image" style={{ backgroundColor: '#FE2F00' }}>
        <span>{getInitials(project.name || 'P')}</span>
      </div>
    ),
  [getInitials]);

  // For recent projects, if the project document has lastTrackedTime (server‑aggregated), use it.
  const recentProjects = useMemo(() => {
    return projects
      .filter(project => project.lastTrackedTime)
      .sort((a, b) => b.lastTrackedTime - a.lastTrackedTime)
      .slice(0, 3);
  }, [projects]);

  // For sorted projects (tracked mode), you may keep your current logic.
  const sortedProjects = useMemo(() => {
    if (sortMode === "tracked") {
      return [...projects].sort((a, b) => {
        const aTime = totalSessionTime[a.id] || 0;
        const bTime = totalSessionTime[b.id] || 0;
        return bTime - aTime;
      });
    } else {
      return [...projects].sort((a, b) => {
        const aSessions = sessions.filter(
          session => session.projectId === a.id && session.startTime
        );
        const bSessions = sessions.filter(
          session => session.projectId === b.id && session.startTime
        );
        const aLatest = aSessions.length > 0
          ? Math.max(...aSessions.map(session => {
              const t = parseTimestamp(session.startTime);
              return t ? t.getTime() : 0;
            }))
          : 0;
        const bLatest = bSessions.length > 0
          ? Math.max(...bSessions.map(session => {
              const t = parseTimestamp(session.startTime);
              return t ? t.getTime() : 0;
            }))
          : 0;
        return bLatest - aLatest;
      });
    }
  }, [sortMode, projects, sessions, totalSessionTime, parseTimestamp]);

  const toggleSortMode = useCallback(() => {
    setSortMode((prevMode) => (prevMode === "tracked" ? "recent" : "tracked"));
  }, []);

  const renderProjects = useMemo(() => {
    if (projects.length > 0) {
      const projectsToRender = sortMode === 'recent' ? recentProjects : sortedProjects;
      if (projectsToRender.length === 0) {
        return <p>{sortMode === 'recent' ? "No projects with recent sessions found." : "No projects with tracked time found."}</p>;
      }
      return (
        <ul className="projects-list">
          {projectsToRender.map((project) => (
            <li
              key={project.id}
              className="project-item"
              onClick={() => navigate(`/project/${project.id}`)}
            >
              <div className="project-image-container">{renderProjectImage(project)}</div>
              <div className="project-name">{project.name}</div>
              <div className="project-total-time">
                {totalSessionTime && totalSessionTime[project.id] !== undefined
                  ? formatTime(totalSessionTime[project.id])
                  : formatTime(0)}
              </div>
            </li>
          ))}
        </ul>
      );
    } else {
      return <p>No projects found. Start tracking to see results here!</p>;
    }
  }, [projects, navigate, totalSessionTime, renderProjectImage, recentProjects, sortMode, sortedProjects]);

  if (loading) {
    return (
      <div className="homepage-loading">
        <SoukoLogoHeader className="profile-pic souko-logo-header spinning-logo" />
      </div>
    );
  }

  return (
    <div className="homepage">
      <Header user={userProfile} showLiveTime={true} onProfileClick={openSidebar} />
      <main className="homepage-content">
        <section className="motivational-section" ref={motivationalSectionRef}>
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
        <JournalSection journalEntries={journalEntries} loading={false} />
        <section className="projects-section">
          <div className="projects-header">
            <h2 className="projects-label">Your projects</h2>
            <div className="projects-actions">
              <Link to="/projects" className="projects-all-link">
                All
              </Link>
            </div>
          </div>
          {renderProjects}
        </section>
      </main>
      <Sidebar isOpen={isSidebarOpen} onClose={closeSidebar} onLogout={handleLogout} />
      {isSidebarOpen && <div className="sidebar-overlay" onClick={closeSidebar}></div>}
      {projects.length >= 0 && (
        <button ref={fabRef} className="fab" onClick={() => navigate('/time-tracker')}>
          {hasActiveSession ? (
            <StopTimerIcon className="fab-icon" />
          ) : (
            <StartTimerIcon className="fab-icon" />
          )}
        </button>
      )}
    </div>
  );
});

HomePage.displayName = 'HomePage';
export default HomePage;
