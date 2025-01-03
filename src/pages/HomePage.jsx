// HomePage.jsx
import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth'; // Ensure signOut is imported here
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
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

export const cn = (...inputs) => twMerge(clsx(inputs));

const HomePage = React.memo(() => {
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const fabRef = useRef(null);
  const scrollTimeout = useRef(null);
  const motivationalSectionRef = useRef(null);

  const fetchData = useCallback(async (uid) => {
    setLoading(true);
    try {
      const projectsRef = collection(db, 'projects');
      const projectQuery = query(projectsRef, where('userId', '==', uid));
      const projectSnapshot = await getDocs(projectQuery);
      const userProjects = projectSnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name,
        imageUrl: doc.data().imageUrl,
      }));
      setProjects(userProjects);

      const sessionRef = collection(db, 'sessions');
      const sessionQuery = query(sessionRef, where('userId', '==', uid));
      const sessionSnapshot = await getDocs(sessionQuery);
      const userSessions = sessionSnapshot.docs.map((doc) => doc.data());
      setSessions(userSessions);
    } catch (error) {
      console.error('Error fetching data:', error.message);
    } finally {
      setLoading(false);
      console.log('Data fetching complete.');
    }
  }, []);

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
    return sessions.reduce((sum, session) => sum + (session.elapsedTime || 0), 0);
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

  const renderProjectImage = useCallback(
    (project) =>
      project.imageUrl ? (
        <img src={project.imageUrl} alt={project.name} className="project-image" />
      ) : (
        <div className="default-project-image" style={{ backgroundColor: '#FE2F00' }}>
          <span>{getInitials(project.name || 'P')}</span>
        </div>
      ),
    [getInitials]
  );

  const renderProjects = useMemo(() => {
    if (loading) {
      return <p>Loading your projects...</p>;
    } else if (projects.length > 0) {
      return (
        <ul className="projects-list">
          {projects.map((project) => (
            <li
              key={project.id}
              className="project-item"
              onClick={() => navigate(`/project/${project.id}`)}
            >
              <div className="project-image-container">{renderProjectImage(project)}</div>
              <div className="project-name">{project.name}</div>
              <div className="project-total-time">
                {formatTime(totalSessionTime[project.name] || 0)}
              </div>
            </li>
          ))}
        </ul>
      );
    } else {
      return <p>No projects found. Start tracking to see results here!</p>;
    }
  }, [loading, projects, navigate, totalSessionTime, renderProjectImage]);

  console.log('HomePage rendered. Loading:', loading);

  return (
    <div className="homepage">
      <Header user={user} showLiveTime={true}>
        {user && (
          <div className="dropdown-wrapper">
            <img
              src={user?.photoURL || '/default-profile.png'}
              alt="Profile"
              className="profile-pic"
              onClick={openSidebar}
            />
          </div>
        )}
      </Header>

      <main className="homepage-content">
        <section className="motivational-section" ref={motivationalSectionRef}>
          {!loading && (
            <TextGenerateEffect
              words={
                weeklyTrackedTime > 0
                  ? `This moment is\n progress. You\n tracked <span class="accent-text">${formatTime(
                      weeklyTrackedTime
                    )}</span>\n this week.`
                  : `Every journey begins with one moment.\nTell me about your project ...`
              }
            />
          )}
        </section>

        <section className="projects-section">
          <h2 className="projects-label">Your projects</h2>
          {renderProjects}
          <button
            className="track-project-button"
            onClick={() => navigate('/create-project')}
          >
            <span className="button-icon">✛</span> Track new project
          </button>
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