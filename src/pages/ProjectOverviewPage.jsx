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
import Header from '../components/Layout/Header';
import '../styles/global.css';
import '../styles/components/HomePage.css';
import '@fontsource/shippori-mincho';
import { TextGenerateEffect } from '../styles/components/text-generate-effect.tsx';

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

  // Calculate total tracked time across all projects
  const totalTrackedTimeAcrossProjects = useMemo(() => {
    return sessions.reduce((sum, session) => sum + (session.elapsedTime || 0), 0);
  }, [sessions]);

  const formatTotalTimeForQuote = useCallback((totalTime) => {
    const formattedTime = formatTime(totalTime);
    const parts = formattedTime.split(' ');
    if (parts.length === 2) {
      return `${parts[0]} ${parts[1]}`; // e.g., "21h 30m" or "1d 2h"
    } else if (parts.length === 4 && parts[1] === 'days') {
      return `${parts[0]}d ${parts[2]}h`; // e.g., "2d 3h"
    }
    return formattedTime; // Fallback to full format if needed
  }, []);

  const formattedTotalTime = useMemo(() => {
    return formatTotalTimeForQuote(totalTrackedTimeAcrossProjects);
  }, [totalTrackedTimeAcrossProjects, formatTotalTimeForQuote]);


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
    <div className="project-container">
      <Header
        showBackArrow={true}
        onBack={() => navigate('/home')}
        hideProfile={true}
      />
       <section className="motivational-section">
          {!loading && (
            <TextGenerateEffect
              words={`You tracked <span class="accent-text">${formattedTotalTime}</span> hours.\nTime flows where focus leads.`}
            />
          )}
        </section>
      <main className="homepage-content">
        <section className="projects-section">
          <div className="projects-header">
            <h2 className="projects-label">All Projects</h2>
             <div className="projects-actions"> {/* Added projects-actions container for alignment */}
                <Link to="/create-project" className="projects-add-link">
                  <span className="button-icon">✛</span>
                </Link>
              </div>
          </div>
          {renderProjects}
        </section>
      </main>
    </div>
  );
};

export default ProjectOverviewPage;