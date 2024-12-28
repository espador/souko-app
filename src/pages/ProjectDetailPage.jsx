// ProjectDetailPage.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { formatTime } from '../utils/formatTime';
import Header from '../components/Layout/Header';
import '../styles/global.css';
import '../styles/components/ProjectDetailPage.css';
import { Timestamp } from 'firebase/firestore';
import { ReactComponent as DropdownIcon } from '../styles/components/assets/dropdown.svg';

const ProjectDetailPage = () => {
  const { projectId: routeProjectId } = useParams();
  const [project, setProject] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [totalTime, setTotalTime] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(routeProjectId);

  useEffect(() => {
    document.body.classList.add('allow-scroll');
    return () => {
      document.body.classList.remove('allow-scroll');
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        navigate('/');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [navigate]);

  const fetchProjects = useCallback(async (uid) => {
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
    } catch (error) {
      console.error('Error fetching projects for dropdown:', error);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchProjects(currentUser.uid);
    }
  }, [currentUser, fetchProjects]);

  const fetchProjectDetails = useCallback(async (projectId) => {
    if (!currentUser || !projectId) return;

    setLoading(true);
    setProject(null);
    setSessions([]);
    setTotalTime(0);

    try {
      const projectRef = doc(db, 'projects', projectId);
      const projectSnapshot = await getDoc(projectRef);

      if (!projectSnapshot.exists()) {
        console.error("Project not found in Firestore.");
        setProject(null);
      } else if (projectSnapshot.data().userId !== currentUser.uid) {
        console.error("Project belongs to a different user.");
        setProject(null);
      } else {
        const projectData = projectSnapshot.data();
        setProject(projectData);

        const sessionsRef = collection(db, 'sessions');
        const q = query(
          sessionsRef,
          where('project', '==', projectData.name),
          where('userId', '==', currentUser.uid)
        );
        const sessionsSnapshot = await getDocs(q);

        const fetchedSessions = sessionsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setSessions(fetchedSessions);
        const totalElapsedTime = fetchedSessions.reduce((sum, session) => sum + (session.elapsedTime || 0), 0);
        setTotalTime(totalElapsedTime);
      }
    } catch (error) {
      console.error("Error fetching project or sessions:", error);
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [currentUser]); // Remove selectedProjectId dependency, rely on projectId argument

  useEffect(() => {
    // Fetch project details whenever routeProjectId changes
    if (currentUser && routeProjectId) {
      fetchProjectDetails(routeProjectId);
      setSelectedProjectId(routeProjectId); // Ensure selectedProjectId is in sync with route
    }
  }, [currentUser, routeProjectId, fetchProjectDetails]);

  const handleProjectChange = (e) => {
    const newProjectId = e.target.value;
    navigate(`/project/${newProjectId}`); // Only navigate, the route change will trigger data fetch
  };

  const sessionsByDate = sessions.reduce((acc, session) => {
    let date;
    if (session.startTime instanceof Timestamp) {
      try {
        date = session.startTime.toDate().toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        });
      } catch (error) {
        console.error("Error converting Timestamp to Date:", error, session.startTime);
        date = "Invalid Date";
      }
    } else {
      console.warn("Invalid startTime for session:", session.id, session.startTime);
      date = "Invalid Date";
    }

    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(session);
    return acc;
  }, {});

  const sortedDates = Object.keys(sessionsByDate).sort((a, b) => {
    if (a === "Invalid Date") return 1;
    if (b === "Invalid Date") return -1;
    try {
      return new Date(b) - new Date(a);
    } catch (error) {
      console.error("Error comparing dates:", error);
      return 0;
    }
  });

  const formatStartTime = (startTime) => {
    if (startTime instanceof Timestamp) {
      try {
        const date = startTime.toDate();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
      } catch (error) {
        console.error("Error formatting start time:", error, startTime);
        return "N/A";
      }
    }
    return "N/A";
  };

  if (loading) {
    return <p className="loading">Loading project details...</p>;
  }

  if (!project) {
    return (
      <div className="project-container">
        <h1 className="error-title">Project not found</h1>
        <button className="button" onClick={() => navigate('/home')}>
          Return to Homepage
        </button>
      </div>
    );
  }

  return (
    <div className="project-container">
      <Header
        showBackArrow={true}
        onBack={() => navigate('/home')}
        hideProfile={true}
      />
      <div className="project-dropdown-container top-tile">
        {project?.imageUrl ? (
          <img
            src={project.imageUrl}
            alt={project.name}
            className="dropdown-project-image"
          />
        ) : project?.name ? (
          <div className="dropdown-default-image">
            {project.name.charAt(0).toUpperCase()}
          </div>
        ) : null}
        <select
          className="project-dropdown"
          value={selectedProjectId}
          onChange={handleProjectChange}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <DropdownIcon className="dropdown-arrow" />
      </div>

      <div className="timer-quote project-total-time">Total time</div>
      <h1 className="timer project-time">{formatTime(totalTime)}</h1>

      <div className="sessions-container">
        {sortedDates.length > 0 ? (
          sortedDates.map(date => (
            <div key={date} className="sessions-by-day">
              <h2>
                {date === "Invalid Date"
                  ? "Invalid Date"
                  : new Date(date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                    })}
              </h2>
              <ul className="sessions-list">
                {sessionsByDate[date].map((session) => (
                  <Link key={session.id} to={`/session/${session.id}`} className="session-link">
                    <li className="session-item input-tile">
                      <span className="session-start-time">
                        {formatStartTime(session.startTime)}
                      </span>
                      <span
                        className="session-time"
                        style={{ color: session.isBillable ? 'var(--accent-color)' : 'var(--text-muted)' }}
                      >
                        {formatTime(session.elapsedTime)}
                      </span>
                    </li>
                  </Link>
                ))}
              </ul>
            </div>
          ))
        ) : (
          <p>No sessions tracked for this project yet.</p>
        )}
      </div>
    </div>
  );
};

export default ProjectDetailPage;