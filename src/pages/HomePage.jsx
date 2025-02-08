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

const CACHE_DURATION_MS = 30000; // 30 seconds

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

  const hasActiveSession = useMemo(
    () => sessions.some(session => !session.endTime),
    [sessions]
  );

  // Caching: try to load cached homepage data from localStorage
  const loadCachedData = useCallback((uid) => {
    const cachedStr = localStorage.getItem(`homeData_${uid}`);
    if (cachedStr) {
      try {
        const cached = JSON.parse(cachedStr);
        if (Date.now() - cached.timestamp < CACHE_DURATION_MS) {
          setProjects(cached.projects || []);
          setSessions(cached.sessions || []);
          setJournalEntries(cached.journalEntries || []);
          setUserProfile(cached.userProfile || null);
          setHasTrackedEver((cached.sessions || []).length > 0);
          setLoading(false);
        }
      } catch (e) {
        console.error("Error parsing cached data", e);
      }
    }
  }, []);

  const fetchData = useCallback(async (uid) => {
    // Attempt to load cached data first
    loadCachedData(uid);
    setLoading(true);
    try {
      const [projectSnapshot, sessionSnapshot, journalSnapshot, profileSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'projects'), where('userId', '==', uid))),
        getDocs(query(collection(db, 'sessions'), where('userId', '==', uid))),
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
        setUserProfile(profileSnapshot.data());
      } else if (user) {
        setUserProfile({
          uid: user.uid,
          displayName: user.displayName,
          profileImageUrl: user.photoURL,
          featureAccessLevel: 'free'
        });
      }

      // Cache the data for faster future loads.
      const dataToCache = {
        projects: userProjects,
        sessions: userSessions,
        journalEntries: userJournalEntries,
        userProfile: profileSnapshot.exists() ? profileSnapshot.data() : null,
        timestamp: Date.now(),
      };
      localStorage.setItem(`homeData_${uid}`, JSON.stringify(dataToCache));
    } catch (error) {
      console.error('Error fetching data:', error.message);
    } finally {
      setLoading(false);
    }
  }, [loadCachedData, user]);

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
      const projectId = session.projectId || 'Unknown Project';
      acc[projectId] = (acc[projectId] || 0) + (session.elapsedTime || 0);
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
  }, [sessions, parseTimestamp]);

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

  const recentProjects = useMemo(() => {
    return projects
      .map(project => {
        const projectSessions = sessions.filter(
          session => session.projectId === project.id && session.startTime
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
  }, [projects, navigate, totalSessionTime, renderProjectImage, recentProjects]);

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
