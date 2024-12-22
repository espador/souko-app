import React, { useEffect, useState } from 'react';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { formatTime } from '../utils/formatTime';

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
            .filter((doc) => doc.data().userId === currentUser.uid) // Validate userId
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
    <div style={styles.container}>
      <header style={styles.header}>
        <h1>Welcome, {user?.displayName || 'User'}!</h1>
        <button style={styles.logoutButton} onClick={handleLogout}>
          Log Out
        </button>
      </header>

      <main>
        {loading ? (
          <p>Loading your data...</p>
        ) : (
          <section style={styles.projects}>
            <h2>Your Projects</h2>
            {projects.length > 0 ? (
              <ul>
                {projects.map((project) => (
                  <li
                    key={project.id}
                    style={styles.projectItem}
                    onClick={() => handleProjectClick(project.id)}
                  >
                    <span style={styles.projectLink}>{project.name}</span> - Total Time: {formatTime(totalSessionTime[project.name] || 0)}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No projects found. Start tracking to see results here!</p>
            )}
            <button style={styles.createProjectButton} onClick={handleCreateProjectClick}>
              + Track New Project
            </button>
          </section>
        )}
      </main>

      {projects.length > 0 && (
        <button style={styles.fab} onClick={handleFABClick}>
          ▶
        </button>
      )}
    </div>
  );
};

const styles = {
  container: {
    fontFamily: 'Arial, sans-serif',
    padding: '20px',
    minHeight: '100vh',
    backgroundColor: '#f9f9f9',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoutButton: {
    backgroundColor: '#d9534f',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    padding: '10px',
    cursor: 'pointer',
  },
  projects: {
    marginTop: '20px',
  },
  projectItem: {
    padding: '10px 0',
    borderBottom: '1px solid #ddd',
    cursor: 'pointer',
  },
  projectLink: {
    color: '#007BFF',
    textDecoration: 'underline',
  },
  createProjectButton: {
    marginTop: '20px',
    padding: '10px 20px',
    backgroundColor: '#4285F4',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '16px',
  },
  fab: {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    backgroundColor: '#28a745',
    color: '#fff',
    fontSize: '24px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
  },
};

export default HomePage;
