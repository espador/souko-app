// HomePage.jsx
import React, { useEffect, useState, useRef } from 'react';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
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
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { TextGenerateEffect } from "../styles/components/text-generate-effect.tsx";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const HomePage = () => {
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [totalSessionTime, setTotalSessionTime] = useState({});
  const [loading, setLoading] = useState(true);
  const [weeklyTrackedTime, setWeeklyTrackedTime] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [startAnimation, setStartAnimation] = useState(false);
  const navigate = useNavigate();
  const fabRef = useRef(null);
  const scrollTimeout = useRef(null);

  useEffect(() => {
    console.log('HomePage mounted, adding allow-scroll');
    document.body.classList.add('allow-scroll');

    return () => {
      console.log('HomePage unmounted, removing allow-scroll');
      document.body.classList.remove('allow-scroll');
    };
  }, []);

  useEffect(() => {
    const h1 = document.querySelector('.motivational-section h1');
    if (h1) {
      h1.classList.add('loaded');
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
  }, [navigate]);



  const fetchData = async (uid) => {
    setLoading(true);
    try {
      // Fetch Projects
      const projectsRef = collection(db, 'projects');
      const projectQuery = query(projectsRef, where('userId', '==', uid));
      const projectSnapshot = await getDocs(projectQuery);
      const userProjects = projectSnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name,
        imageUrl: doc.data().imageUrl, // Include imageUrl
      }));
      setProjects(userProjects);

      // Fetch Sessions
      const sessionRef = collection(db, 'sessions');
      const sessionQuery = query(sessionRef, where('userId', '==', uid));
      const sessionSnapshot = await getDocs(sessionQuery);

      const sessions = sessionSnapshot.docs.map((doc) => doc.data());

      // Calculate total time per project
      const timeByProject = sessions.reduce((acc, session) => {
        const project = session.project || 'Unknown Project';
        acc[project] = (acc[project] || 0) + (session.elapsedTime || 0); // Add elapsedTime in seconds
        return acc;
      }, {});

      setTotalSessionTime(timeByProject);

      // Calculate total tracked time for all projects this week
      const totalWeeklyTime = sessions.reduce(
        (sum, session) => sum + (session.elapsedTime || 0),
        0
      );
      setWeeklyTrackedTime(totalWeeklyTime);
    } catch (error) {
      console.error('Error fetching data:', error.message);
    } finally {
      setLoading(false);
      setStartAnimation(true);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('Logout Error:', error.message);
    }
  };

  const openSidebar = () => setIsSidebarOpen(true);
  const closeSidebar = () => setIsSidebarOpen(false);

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Brussels',
  });

  useEffect(() => {
    const handleScroll = () => {
      if (fabRef.current) {
        fabRef.current.classList.add('scrolling');
        clearTimeout(scrollTimeout.current);
        scrollTimeout.current = setTimeout(() => {
          if (fabRef.current) {
            fabRef.current.classList.remove('scrolling');
          }
        }, 300); // Adjust the timeout to match the transition duration
      }
    };

    window.addEventListener('scroll', handleScroll);

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const getInitials = (name) => {
    return name.trim().charAt(0).toUpperCase();
  };

  return (
    <div className="homepage">
      <Header title={today} user={user}>
        {user && (
          <div className="dropdown-wrapper">
            <img
              src={user?.photoURL || '/default-profile.png'}
              alt="Profile"
              className="profile-pic"
              onClick={openSidebar} // Open the sidebar on profile pic click
            />
          </div>
        )}
      </Header>

      <main className="homepage-content">
        <section className="motivational-section">
          {startAnimation && ( // Conditionally render TextGenerateEffect
            weeklyTrackedTime > 0 ? (
              <TextGenerateEffect
                words={`This moment is progress.\nYou tracked <span class="accent-text">${formatTime(
                  weeklyTrackedTime
                )}</span> this week.`}
              />
            ) : (
              <TextGenerateEffect
                words={`Every journey begins with one moment.\nTell me about your project ...`}
              />
            )
          )}
        </section>

        <section className="projects-section">
          <h2 className="projects-label">Your projects</h2>
          {loading ? (
            <p>Loading your projects...</p>
          ) : projects.length > 0 ? (
            <ul className="projects-list">
              {projects.map((project) => (
                <li
                  key={project.id}
                  className="project-item"
                  onClick={() => navigate(`/project/${project.id}`)}
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
                        <span>{getInitials(project.name || 'P')}</span>
                      </div>
                    )}
                  </div>
                  <div className="project-name">{project.name}</div>
                  <div className="project-total-time">
                    {formatTime(totalSessionTime[project.name] || 0)}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p>No projects found. Start tracking to see results here!</p>
          )}
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
};

export default HomePage;