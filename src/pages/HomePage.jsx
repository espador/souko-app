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

  // Active session state (optimized query returns only the active session)
  const [activeSession, setActiveSession] = useState(null);

  const navigate = useNavigate();
  const fabRef = useRef(null);
  const scrollTimeout = useRef(null);

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

  const hasActiveSession = Boolean(activeSession);

  const fetchData = useCallback(async (uid) => {
    setLoading(true);
    try {
      // Fetch projects
      const projectSnapshot = await getDocs(query(collection(db, 'projects'), where('userId', '==', uid)));
      const userProjects = projectSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setProjects(userProjects);

      // Fetch all sessions for other UI parts
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

      // Fetch user profile
      const profileSnapshot = await getDoc(doc(db, 'profiles', uid));
      if (profileSnapshot.exists()) {
        setUserProfile(profileSnapshot.data());
      }
    } catch (error) {
      console.error('Error fetching data:', error.message);
    } finally {
      setLoading(false);
    }
  }, [parseTimestamp]);

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

  // Optimized: Listen only for the active session (where endTime == null)
  useEffect(() => {
    if (user) {
      const activeSessionQuery = query(
        collection(db, 'sessions'),
        where('userId', '==', user.uid),
        where('endTime', '==', null)
      );
      const unsubActiveSession = onSnapshot(activeSessionQuery, (snapshot) => {
        if (!snapshot.empty) {
          setActiveSession(snapshot.docs[0].data());
        } else {
          setActiveSession(null);
        }
      });
      return () => unsubActiveSession();
    }
  }, [user]);

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

  // Sort projects by most recent based on the aggregated lastTrackedTime
  const projectsToRender = useMemo(() => {
    return [...projects].sort((a, b) => (b.lastTrackedTime || 0) - (a.lastTrackedTime || 0));
  }, [projects]);

  const totalSessionTime = useMemo(() => {
    return sessions.reduce((acc, session) => {
      const projectId = session.projectId || 'Unknown Project';
      acc[projectId] = (acc[projectId] || 0) + (session.elapsedTime || 0);
      return acc;
    }, {});
  }, [sessions]);

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

  return (
    <div className="homepage">
      <Header user={userProfile} showLiveTime={true} onProfileClick={openSidebar} />
      <main className="homepage-content">
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
          {projectsToRender.length > 0 ? (
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
          ) : (
            <p>No projects found. Start tracking to see results here!</p>
          )}
        </section>
      </main>
      <Sidebar isOpen={isSidebarOpen} onClose={closeSidebar} onLogout={handleLogout} />
      {isSidebarOpen && <div className="sidebar-overlay" onClick={closeSidebar}></div>}
      <button ref={fabRef} className="fab" onClick={() => navigate('/time-tracker')}>
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
