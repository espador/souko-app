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
  const [showDropdown, setShowDropdown] = useState(false); // Dropdown visibility state
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        navigate('/');
      } else {
        setUser(currentUser);

        try {
          const projectsRef = collection(db, 'projects');
          const projectQuery = query(
            projectsRef,
            where('userId', '==', currentUser.uid)
          );
          const projectSnapshot = await getDocs(projectQuery);
          const userProjects = projectSnapshot.docs.map((doc) => ({
            id: doc.id,
            name: doc.data().name,
          }));
          setProjects(userProjects);

          const sessionRef = collection(db, 'sessions');
          const sessionQuery = query(
            sessionRef,
            where('userId', '==', currentUser.uid),
            limit(50)
          );
          const sessionSnapshot = await getDocs(sessionQuery);

          const sessions = sessionSnapshot.docs.map((doc) => doc.data());
          const timeByProject = sessions.reduce((acc, session) => {
            if (session.userId === currentUser.uid) {
              const project = session.project || 'Unknown Project';
              acc[project] = (acc[project] || 0) + (session.elapsedTime || 0);
            }
            return acc;
          }, {});
          setTotalSessionTime(timeByProject);
        } catch (error) {
          console.error('Error fetching data:', error.message);
        } finally {
          setLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('Logout Error:', error.message);
    }
  };

  const toggleDropdown = () => setShowDropdown(!showDropdown);

  return (
    <div className="homepage">
      <Header title="Wed, 18 December" user={user}>
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
        {loading ? (
          <p>Loading your data...</p>
        ) : (
          <section>
            <h2>Your Projects</h2>
            {projects.length > 0 ? (
              <ul className="projects-list">
                {projects.map((project) => (
                  <li
                    key={project.id}
                    className="project-item"
                    onClick={() => navigate(`/project/${project.id}`)}
                  >
                    <span className="project-link">{project.name}</span> - Total Time: {formatTime(totalSessionTime[project.name] || 0)}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No projects found. Start tracking to see results here!</p>
            )}
            <button className="track-project-button" onClick={() => navigate('/create-project')}>
              + Track New Project
            </button>
          </section>
        )}
      </main>

      {projects.length > 0 && (
        <button className="fab" onClick={() => navigate('/time-tracker')}>
          ▶
        </button>
      )}
    </div>
  );
};

export default HomePage;
