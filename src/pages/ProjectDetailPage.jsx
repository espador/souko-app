// ProjectDetailPage.jsx
import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
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
import { ReactComponent as SoukoLogoHeader } from '../styles/components/assets/Souko-logo-header.svg';
import { ReactComponent as TimerIcon } from '../styles/components/assets/timer.svg';
import { ReactComponent as BillableIcon } from '../styles/components/assets/billable.svg';
import { ReactComponent as EditIcon } from '../styles/components/assets/edit.svg';
import { TextGenerateEffect } from '../styles/components/text-generate-effect.tsx';

const ProjectDetailPage = React.memo(() => {
  const { projectId: routeProjectId } = useParams();
  const [project, setProject] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(routeProjectId);

  // NEW STATE VARIABLES FOR FILTERS
  const [selectedTimeRange, setSelectedTimeRange] = useState('total');
  const [displayMode, setDisplayMode] = useState('time');
  const [effectWords, setEffectWords] = useState('Total Time');
  const projectHeaderRef = useRef(null);

  // NEW STATE TO TRIGGER EFFECT ON EACH TOGGLE CLICK
  const [effectTrigger, setEffectTrigger] = useState(0);

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
          setProject({ id: projectSnapshot.id, ...projectData });
          console.log("ProjectDetailPage.jsx: Project state after setProject:", project);

          const sessionsRef = collection(db, 'sessions');
          const q = query(
            sessionsRef,
            where('project', '==', projectData.name),
            where('userId', '==', uid),
            where('status', '==', 'stopped'),
            orderBy('startTime', 'desc')
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
    []
  );

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

  const handleTimeRangeChange = useCallback((e) => {
    setSelectedTimeRange(e.target.value);
  }, []);

  const handleDisplayModeChange = useCallback((mode) => {
    setDisplayMode(mode);
    if (mode === 'time') {
      setEffectWords('Total Time');
    } else if (mode === 'earned') {
      setEffectWords('Total Earned');
    }
    // Trigger the effect every time by updating a separate state
    setEffectTrigger(prevTrigger => prevTrigger + 1);
  }, []);

  const getSessionsForTimeRange = useCallback((sessions, timeRange) => {
    if (timeRange === 'total') {
      return sessions;
    }

    const now = new Date();
    let startDate;

    if (timeRange === 'week') {
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      startDate = new Date(now);
      startDate.setDate(now.getDate() - mondayOffset);
      startDate.setHours(0, 0, 0, 0);
    } else if (timeRange === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate.setHours(0, 0, 0, 0);
    }

    return sessions.filter((session) => {
      if (session.startTime instanceof Timestamp) {
        const sessionDate = session.startTime.toDate();
        return sessionDate >= startDate && sessionDate <= now;
      }
      return false;
    });
  }, []);


  const filteredSessions = useMemo(() => {
    return getSessionsForTimeRange(sessions, selectedTimeRange);
  }, [sessions, selectedTimeRange, getSessionsForTimeRange]);

  const totalTime = useMemo(() => {
    return filteredSessions.reduce(
      (sum, session) => sum + (session.elapsedTime || 0),
      0
    );
  }, [filteredSessions]);

  // NEW: Calculate billable time only
  const billableTime = useMemo(() => {
    return filteredSessions.reduce(
      (sum, session) => {
        if (session.isBillable) { // Only add time if session.isBillable is true
          return sum + (session.elapsedTime || 0);
        }
        return sum;
      },
      0
    );
  }, [filteredSessions]);


  const totalEarned = useMemo(() => {
    if (displayMode === 'earned' && project?.hourRate) {
      const rate = parseFloat(project.hourRate);
      if (!isNaN(rate)) {
        // Use billableTime instead of totalTime for calculation
        return (billableTime / 3600) * rate;
      }
    }
    return 0;
  }, [displayMode, project?.hourRate, billableTime]); // Depend on billableTime


  const sessionsByDate = useMemo(() => {
    return filteredSessions.reduce((acc, session) => {
      let date;
      if (session.startTime instanceof Timestamp) {
        try {
          date = session.startTime.toDate().toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
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
  }, [filteredSessions]);

  const sortedDates = useMemo(() => {
    return Object.keys(sessionsByDate).sort((a, b) => {
      if (a === 'Invalid Date') return 1;
      if (b === 'Invalid Date') return -1;
      try {
        const dateA = new Date(a);
        const dateB = new Date(b);
        return dateB - dateA;
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
  }, []);

  const formatEarnedAmount = (amount) => {
    return `€${amount.toLocaleString('en-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };


  if (loading) {
    return (
      <div className="homepage-loading">
        <SoukoLogoHeader className="profile-pic souko-logo-header spinning-logo" />
      </div>
    );
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
              variant="journalOverview"
              showBackArrow={true}
            />
      <div className="project-dropdown-container top-tile" onClick={() => {
          console.log("ProjectDetailPage.jsx: Navigating to update project with projectId:", project.id);
          navigate(`/projects/${project.id}/update`);
        }}>
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
        <div className="project-name">{project.name}</div>
        <EditIcon className="edit-icon" />
      </div>

      <div className="filters-container">
        <div className="time-range-dropdown">
          <select
            className="time-range-select"
            value={selectedTimeRange}
            onChange={handleTimeRangeChange}
          >
            <option value="total">Total</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
          </select>
          <DropdownIcon className="dropdown-arrow" />
        </div>

        <div className="display-mode-toggle">
          <button
            className={`display-mode-button ${displayMode === 'time' ? 'active' : 'muted'}`}
            onClick={() => handleDisplayModeChange('time')}
          >
            <TimerIcon className="display-mode-icon" />
          </button>
          <button
            className={`display-mode-button ${displayMode === 'earned' ? 'active' : 'muted'}`}
            onClick={() => handleDisplayModeChange('earned')}
          >
            <BillableIcon className="display-mode-icon" />
          </button>
        </div>
      </div>

      <div className="project-header-container" ref={projectHeaderRef}>
        <h1 className="timer project-time">
          { displayMode === 'time' ? (
            <TextGenerateEffect key={`time-value-${effectTrigger}`} words={formatTime(totalTime)} />
          ) : (
            <TextGenerateEffect key={`earned-value-${effectTrigger}`} words={formatEarnedAmount(totalEarned)} />
          )}
        </h1>
        {/* REMOVED TextGenerateEffect FOR "Total Time" / "Total Earned" LABEL */}
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