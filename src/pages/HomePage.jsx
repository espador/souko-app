// HomePage.jsx
import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import { formatTime } from '../utils/formatTime';
import Header from '../components/Layout/Header';
import '../styles/global.css';
import '../styles/components/HomePage.css';

// Updated Icon Imports: Import both start and stop timer icons.
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
// Import date-fns helpers for week boundaries
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
  // State for sort mode (remains in state if you wish to add toggling later)
  const [sortMode, setSortMode] = useState("tracked");

  const navigate = useNavigate();
  const fabRef = useRef(null);
  const scrollTimeout = useRef(null);
  const motivationalSectionRef = useRef(null);

  const parseTimestamp = useCallback((timestamp) => {
    if (!timestamp) return null;
    return typeof timestamp.toDate === 'function'
      ? timestamp.toDate()
      : new Date(timestamp);
  }, []);

  // Determine if there is an active time-tracking session.
  const hasActiveSession = useMemo(
    () => sessions.some(session => !session.endTime),
    [sessions]
  );

  const fetchData = useCallback(async (uid) => {
    setLoading(true);
    try {
      const [projectSnapshot, sessionSnapshot, journalSnapshot, profileSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'projects'), where('userId', '==', uid))),
        // Fetch only sessions with status "stopped"
        getDocs(query(collection(db, 'sessions'), where('userId', '==', uid), where('status', '==', 'stopped'))),
        getDocs(query(collection(db, 'journalEntries'), where('userId', '==', uid))),
        getDoc(doc(db, 'profiles', uid))
      ]);

      const userProjects = projectSnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name,
        imageUrl: doc.data().imageUrl,
      }));
      setProjects(userProjects);

      const userSessions = sessionSnapshot.docs.map((doc) => doc.data());
      setSessions(userSessions);
      setHasTrackedEver(userSessions.length > 0);

      const userJournalEntries = journalSnapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
      }));
      setJournalEntries(userJournalEntries);

      if (profileSnapshot.exists()) {
        const profileData = profileSnapshot.data();
        setUserProfile(profileData);
        console.log('Profile data fetched:', profileData);
      } else {
        console.log('No profile found for user:', uid);
        if (user) {
          setUserProfile({
            uid: user.uid,
            displayName: user.displayName,
            profileImageUrl: user.photoURL,
            featureAccessLevel: 'free'
          });
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error.message);
    } finally {
      setLoading(false);
      console.log('Data fetching complete.');
    }
  }, [user]);

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

  const totalSessionTime = useMemo(() => {
    return sessions.reduce((acc, session) => {
      const project = session.project || 'Unknown Project';
      acc[project] = (acc[project] || 0) + (session.elapsedTime || 0);
      return acc;
    }, {});
  }, [sessions]);

  const weeklyTrackedTime = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    return sessions.reduce((sum, session) => {
      const sessionStartTime = parseTimestamp(session.startTime);
      if (sessionStartTime && sessionStartTime >= weekStart && sessionStartTime <= weekEnd) {
        return sum + (session.elapsedTime || 0);
      }
      return sum;
    }, 0);
  }, [sessions]);

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
          if (fabRef.current) {
            fabRef.current.classList.remove('scrolling');
          }
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

  // Define recentProjects: the 3 projects with the most recent finished sessions.
  const recentProjects = useMemo(() => {
    return projects
      .map(project => {
        const projectSessions = sessions.filter(
          session => session.project === project.name && session.startTime
        );
        const latestSessionTime =
          projectSessions.length > 0
            ? Math.max(...projectSessions.map(session => {
                const t = parseTimestamp(session.startTime);
                return t ? t.getTime() : 0;
              }))
            : 0;
        return { ...project, latestSessionTime };
      })
      .filter(project => project.latestSessionTime > 0)
      .sort((a, b) => b.latestSessionTime - a.latestSessionTime)
      .slice(0, 3);
  }, [projects, sessions, parseTimestamp]);

  const sortedProjects = useMemo(() => {
    if (sortMode === "tracked") {
      return [...projects].sort((a, b) => {
        const aTime = totalSessionTime[a.name] || 0;
        const bTime = totalSessionTime[b.name] || 0;
        return bTime - aTime;
      });
    } else {
      return [...projects].sort((a, b) => {
        const aSessions = sessions.filter(
          session => session.project === a.name && session.startTime
        );
        const bSessions = sessions.filter(
          session => session.project === b.name && session.startTime
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
      if (recentProjects.length === 0) {
        return <p>No projects with tracked sessions found. Start tracking to see results here!</p>;
      }
      return (
        <ul className="projects-list">
          {recentProjects.map((project) => (
            <li
              key={project.id}
              className="project-item"
              onClick={() => navigate(`/project/${project.id}`)}
            >
              <div className="project-image-container">{renderProjectImage(project)}</div>
              <div className="project-name">{project.name}</div>
              <div className="project-total-time">
                {totalSessionTime && totalSessionTime[project.name] !== undefined
                  ? formatTime(totalSessionTime[project.name])
                  : formatTime(0)}
              </div>
            </li>
          ))}
        </ul>
      );
    } else {
      return <p>No projects found. Start tracking to see results here!</p>;
    }
  }, [projects, navigate, totalSessionTime, renderProjectImage, recentProjects]);

  console.log('HomePage rendered. Loading:', loading);

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
