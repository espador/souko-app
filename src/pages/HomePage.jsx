import React, { useEffect, useState } from 'react';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { formatTime } from '../utils/formatTime';
import Header from '../components/Layout/Header';
import '../styles/global.css';
import '../styles/components/HomePage.css';

const HomePage = () => {
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [totalSessionTime, setTotalSessionTime] = useState({});
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [weeklyTrackedTime, setWeeklyTrackedTime] = useState(0);
  const navigate = useNavigate();

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
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth); // Sign out the current user
      navigate('/'); // Redirect to the login page
    } catch (error) {
      console.error('Logout Error:', error.message);
    }
  };

  const toggleDropdown = () => setShowDropdown(!showDropdown);

  // Get today's date and format it with timezone handling
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Brussels',
  });

  return (
    <div className="homepage">
      <Header title={today} user={user}>
        {user && (
          <div className="dropdown-wrapper">
            <img
              src={user?.photoURL || '/default-profile.png'}
              alt="Profile"
              className="profile-pic"
              onClick={toggleDropdown}
            />
            {showDropdown && (
              <div className="dropdown-menu">
                <button className="dropdown-item" onClick={handleLogout}>
                  Log Out
                </button>
              </div>
            )}
          </div>
        )}
      </Header>

      <main className="homepage-content">
        <section className="motivational-section">
          {weeklyTrackedTime > 0 ? (
            <p>
              You have tracked <span className="tracked-time">{formatTime(weeklyTrackedTime)}</span> this week. This moment is progress.
            </p>
          ) : (
            <p>
              Every journey begins with <span className="tracked-time">one moment</span>. Tell me about your project ...
            </p>
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
            <span className="button-icon">+</span> Track new project
          </button>
        </section>
      </main>

      {projects.length >= 0 && ( // Ensure FAB is visible even with no projects initially
        <button className="fab" onClick={() => navigate('/time-tracker')}>
          <span className="fab-icon">▶</span>
        </button>
      )}
    </div>
  );
};

export default HomePage;
