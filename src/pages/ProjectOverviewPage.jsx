// ProjectOverviewPage.jsx
import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import { formatTime } from '../utils/formatTime';
import Header from '../components/Layout/Header'; // You might not need Header again, consider a simpler layout
import '../styles/global.css';
import '../styles/components/HomePage.css'; // Reuse HomePage styles for consistency
import '@fontsource/shippori-mincho';

const ProjectOverviewPage = () => {
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchData = useCallback(async (uid) => {
    setLoading(true);
    try {
      const [projectSnapshot, sessionSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'projects'), where('userId', '==', uid))),
        getDocs(query(collection(db, 'sessions'), where('userId', '==', uid))),
      ]);

      const userProjects = projectSnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name,
        imageUrl: doc.data().imageUrl,
      }));
      setProjects(userProjects);

      const userSessions = sessionSnapshot.docs.map((doc) => doc.data());
      setSessions(userSessions);


    } catch (error) {
      console.error('Error fetching data:', error.message);
    } finally {
      setLoading(false);
      console.log('Project Overview Data fetching complete.');
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
    }, [sessions]);
  }, [sessions]);

  // Define getInitials function here
  const getInitials = (name) => {
    if (!name) return ''; // Handle cases with no name
    return name.trim().charAt(0).toUpperCase();
  };

  const renderProjectImage = useMemo(
    () => (project) =>
      project.imageUrl ? (
        <img src={project.imageUrl} alt={project.name} className="project-image" />
      ) : (
        <div className="default-project-image" style={{ backgroundColor: '#FE2F00' }}>
          <span>{getInitials(project.name || 'P')}</span>
        </div>
      ),
    [getInitials] // Add getInitials to the dependency array as it's used inside
  );

  const renderProjects = useMemo(() => {
    if (loading) {
      return <p>Loading projects...</p>;
    } else if (projects.length > 0) {
      // Sort projects alphabetically by name (placeholder for "latest tracked" - same as HomePage)
      const sortedProjects = [...projects].sort((a, b) => a.name.localeCompare(b.name));

      return (
        <ul className="projects-list">
          {sortedProjects.map((project) => (
            <li
              key={project.id}
              className="project-item"
              onClick={() => navigate(`/project/${project.id}`)}
            >
              <div className="project-image-container">{renderProjectImage(project)}</div>
              <div className="project-name">{project.name}</div>
              <div className="project-total-time">
                {
                  totalSessionTime && totalSessionTime[project.name] !== undefined ?
                  formatTime(totalSessionTime[project.name]) : formatTime(0)
                }
              </div>
            </li>
          ))}
        </ul>
      );
    } else {
      return <p>No projects found.</p>;
    }
  }, [loading, projects, navigate, totalSessionTime, renderProjectImage]);


  return (
    <div className="homepage"> {/* Reusing homepage class for styling consistency */}
      <Header showLiveTime={false} /> {/* Consider a simpler header or no header if design requires */}
      <main className="homepage-content">
        <section className="projects-section">
          <div className="projects-header">
            <Link to="/home" className="projects-all-link"> {/* Back to Homepage link - using "All" class for styling */}
              ← Back
            </Link>
            <h2 className="projects-label">All Projects</h2>
          </div>
          {renderProjects}
        </section>
      </main>
    </div>
  );
};

export default ProjectOverviewPage;