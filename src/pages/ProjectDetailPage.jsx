// ProjectDetailPage.jsx
import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { formatTime } from '../utils/formatTime';
import Header from '../components/Layout/Header';
import '../styles/global.css';
import '../styles/components/ProjectDetailPage.css';
import { ReactComponent as DropdownIcon } from '../styles/components/assets/dropdown.svg';

const ProjectDetailPage = React.memo(() => {
  const { projectId: routeProjectId } = useParams();
  const [project, setProject] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(routeProjectId);

  // Memoize fetchProjects to prevent unnecessary recreation
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
  }, []); // Empty dependency array as it doesn't depend on component state

  // Memoize fetchProjectDetails to prevent unnecessary recreation
  const fetchProjectDetails = useCallback(
    async (projectId, uid) => {
      if (!uid || !projectId) return;

      setLoading(true);
      setProject(null);
      setSessions([]);

      try {
        const projectRef = doc(db, 'projects', projectId);
        const projectSnapshot = await getDoc(projectRef);

        if (!projectSnapshot.exists()) {
          console.error('Project not found in Firestore.');
          setProject(null);
        } else if (projectSnapshot.data().userId !== uid) {
          console.error('Project belongs to a different user.');
          setProject(null);
        } else {
          const projectData = projectSnapshot.data();
          setProject(projectData);

          const sessionsRef = collection(db, 'sessions');
          const q = query(
            sessionsRef,
            where('project', '==', projectData.name),
            where('userId', '==', uid)
          );
          const sessionsSnapshot = await getDocs(q);

          const fetchedSessions = sessionsSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setSessions(fetchedSessions);
        }
      } catch (error) {
        console.error('Error fetching project or sessions:', error);
        setProject(null);
      } finally {
        setLoading(false);
      }
    },
    [] // Empty dependency array as it now relies on arguments
  );

  // Fetch current user and initial data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        fetchProjects(user.uid);
      } else {
        navigate('/');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [navigate, fetchProjects]);

  // Fetch project details when routeProjectId or currentUser changes
  useEffect(() => {
    if (currentUser && routeProjectId) {
      fetchProjectDetails(routeProjectId, currentUser.uid);
      setSelectedProjectId(routeProjectId);
    }
  }, [currentUser, routeProjectId, fetchProjectDetails]);

  const handleProjectChange = useCallback(
    (e) => {
      const newProjectId = e.target.value;
      navigate(`/project/${newProjectId}`);
    },
    [navigate]
  );

  // Memoize the calculation of total time
  const totalTime = useMemo(() => {
    return sessions.reduce(
      (sum, session) => sum + (session.elapsedTime || 0),
      0
    );
  }, [sessions]);

  // Memoize sessions grouped by date
  const sessionsByDate = useMemo(() => {
    return sessions.reduce((acc, session) => {
      let date;
      if (session.startTime instanceof Timestamp) {
        try {
          date = session.startTime.toDate().toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          });
        } catch (error) {
          console.error(
            'Error converting Timestamp to Date:',
            error,
            session.startTime
          );
          date = 'Invalid Date';
        }
      } else {
        console.warn('Invalid startTime for session:', session.id, session.startTime);
        date = 'Invalid Date';
      }

      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(session);
      return acc;
    }, {});
  }, [sessions]);

  // Memoize sorted dates
  const sortedDates = useMemo(() => {
    return Object.keys(sessionsByDate).sort((a, b) => {
      if (a === 'Invalid Date') return 1;
      if (b === 'Invalid Date') return -1;
      try {
        return new Date(b) - new Date(a);
      } catch (error) {
        console.error('Error comparing dates:', error);
        return 0;
      }
    });
  }, [sessionsByDate]);

  const formatStartTime = useCallback((startTime) => {
    if (startTime instanceof Timestamp) {
      try {
        const date = startTime.toDate();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
      } catch (error) {
        console.error('Error formatting start time:', error, startTime);
        return 'N/A';
      }
    }
    return 'N/A';
  }, []); // Memoize formatStartTime

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

      <div className="timer-quote project-total-time">Total time</div>
      <h1 className="timer project-time">{formatTime(totalTime)}</h1>

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

      <div className="sessions-container">
        {sortedDates.length > 0 ? (
          sortedDates.map((date) => (
            <div key={date} className="sessions-by-day">
              <h2>
                {date === 'Invalid Date'
                  ? 'Invalid Date'
                  : new Date(date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                    })}
              </h2>
              <ul className="sessions-list">
                {sessionsByDate[date].map((session) => (
                  <Link
                    key={session.id}
                    to={`/session/${session.id}`}
                    className="session-link"
                  >
                    <li className="session-item input-tile">
                      <span className="session-start-time">
                        {formatStartTime(session.startTime)}
                      </span>
                      <span
                        className="session-time"
                        style={{
                          color: session.isBillable
                            ? 'var(--accent-color)'
                            : 'var(--text-muted)',
                        }}
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
});

ProjectDetailPage.displayName = 'ProjectDetailPage';

export default ProjectDetailPage;