import React, { useEffect, useState } from 'react';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { formatTime } from '../utils/formatTime';
import '../styles/components/HomePage.css';

const HomePage = () => {
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [totalSessionTime, setTotalSessionTime] = useState({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        navigate('/');
      } else {
        setUser(currentUser);

        try {
          // Fetch projects belonging to the authenticated user
          const projectsRef = collection(db, 'projects');
          const projectQuery = query(
            projectsRef,
            where('userId', '==', currentUser.uid)
          );
          const projectSnapshot = await getDocs(projectQuery);
          const userProjects = projectSnapshot.docs
            .filter((doc) => doc.data().userId === currentUser.uid)
            .map((doc) => ({
              id: doc.id,
              name: doc.data().name,
            }));
          setProjects(userProjects);

          // Fetch user sessions and calculate total times
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

  const handleFABClick = () => {
    navigate('/time-tracker');
  };

  const handleCreateProjectClick = () => {
    navigate('/create-project');
  };

  const handleProjectClick = (projectId) => {
    navigate(`/project/${projectId}`);
  };

  return (
    <div className="homepage">
      <header className="homepage-header">
        <h1>Welcome, {user?.displayName || 'User'}!</h1>
        <button className="logout-button" onClick={handleLogout}>
          Log Out
        </button>
      </header>

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
                    onClick={() => handleProjectClick(project.id)}
                  >
                    <span className="project-link">{project.name}</span> - Total Time: {formatTime(totalSessionTime[project.name] || 0)}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No projects found. Start tracking to see results here!</p>
            )}
            <button className="track-project-button" onClick={handleCreateProjectClick}>
              + Track New Project
            </button>
          </section>
        )}
      </main>

      {projects.length > 0 && (
        <button className="fab" onClick={handleFABClick}>
          ▶
        </button>
      )}
    </div>
  );
};

export default HomePage;
