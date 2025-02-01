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
  const navigate = useNavigate();
  const fabRef = useRef(null);
  const scrollTimeout = useRef(null);
  const motivationalSectionRef = useRef(null);
  const [userProfile, setUserProfile] = useState(null);
  const [hasTrackedEver, setHasTrackedEver] = useState(false);

  const fetchData = useCallback(async (uid) => {
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
    const startOfWeek = new Date(now);
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(startOfWeek.getDate() - (now.getDay() === 0 ? 7 : now.getDay()) + 1);

    const endOfWeek = new Date(now);
    endOfWeek.setHours(23, 59, 59, 999);
    endOfWeek.setDate(endOfWeek.getDate() - (now.getDay() === 0 ? 7 : now.getDay()) + 7);

    return sessions.reduce((sum, session) => {
      const sessionStartTime = session.startTime ? new Date(session.startTime) : null;
      if (sessionStartTime && sessionStartTime >= startOfWeek && sessionStartTime <= endOfWeek) {
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

  const renderProjects = useMemo(() => {
    if (projects.length > 0) {
      const sortedProjects = [...projects].sort((a, b) => a.name.localeCompare(b.name));
      const limitedProjects = sortedProjects.slice(0, 3);
      return (
        <ul className="projects-list">
          {limitedProjects.map((project) => (
            <li
              key={project.id}
              className="project-item"
              onClick={() => navigate(`/project/${project.id}`)}
            >
              <div className="project-image-container">{renderProjectImage(project)}</div>
              <div className="project-name">{project.name}</div>
              <div className="project-total-time">
                {totalSessionTime && totalSessionTime[project.name] !== undefined ?
                  formatTime(totalSessionTime[project.name]) : formatTime(0)}
              </div>
            </li>
          ))}
        </ul>
      );
    } else {
      return <p>No projects found. Start tracking to see results here!</p>;
    }
  }, [projects, navigate, totalSessionTime, renderProjectImage]);

  console.log('HomePage rendered. Loading:', loading);

  // Single loading state: if loading, render the spinning logo as the loading spinner
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
              <Link to="/create-project" className="projects-add-link">
                <span className="button-icon">✛</span>
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
          <StartTimerIcon className="fab-icon" />
        </button>
      )}
    </div>
  );
});

HomePage.displayName = 'HomePage';

export default HomePage;
