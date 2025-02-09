// ProjectDetailPage.jsx
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, orderBy, getDocs, Timestamp, onSnapshot, startAfter, limit } from 'firebase/firestore';
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

const CACHE_DURATION_MS = 30000; // 30 seconds
const SESSIONS_LIMIT = 30; // Load 30 sessions at a time

// Helper to convert session start time into a Date object.
const convertToDate = (session) => {
  if (session.startTimeMs != null) {
    const num = Number(session.startTimeMs);
    const date = new Date(num);
    if (!isNaN(date.getTime())) return date;
  }
  if (session.startTime && typeof session.startTime.toDate === 'function') {
    try {
      return session.startTime.toDate();
    } catch (error) {
      console.error('Error converting Timestamp:', error);
    }
  }
  if (session.startTime && session.startTime.seconds != null && session.startTime.nanoseconds != null) {
    const seconds = Number(session.startTime.seconds);
    const nanoseconds = Number(session.startTime.nanoseconds);
    const date = new Date(seconds * 1000 + nanoseconds / 1000000);
    if (!isNaN(date.getTime())) return date;
  }
  if (session.startTime && typeof session.startTime === 'string') {
    let parsed = new Date(session.startTime);
    if (isNaN(parsed.getTime())) {
      parsed = new Date(session.startTime.replace(" at ", " "));
    }
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return null;
};

const loadCachedProjectDetail = (uid, projectId) => {
  const cacheKey = `projectDetailData_${uid}_${projectId}`;
  const cachedStr = localStorage.getItem(cacheKey);
  if (cachedStr) {
    try {
      const cached = JSON.parse(cachedStr);
      if (Date.now() - cached.timestamp < CACHE_DURATION_MS) {
        return cached;
      }
    } catch (e) {
      console.error("Error parsing cached project detail data", e);
    }
  }
  return null;
};

const ProjectDetailPage = React.memo(() => {
  const { projectId: routeProjectId } = useParams();
  const [project, setProject] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(routeProjectId);
  
  // Pagination state:
  const [lastSessionDoc, setLastSessionDoc] = useState(null);
  const [hasMoreSessions, setHasMoreSessions] = useState(true);

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

  // Function to fetch sessions with pagination
  const fetchSessions = useCallback(
    async (projectId, uid, reset = false) => {
      const sessionsRef = collection(db, 'sessions');
      let q;
      if (reset) {
        q = query(
          sessionsRef,
          where('projectId', '==', projectId),
          where('userId', '==', uid),
          where('status', '==', 'stopped'),
          orderBy('startTime', 'desc'),
          // Limit initial query
          limit(SESSIONS_LIMIT)
        );
      } else {
        q = query(
          sessionsRef,
          where('projectId', '==', projectId),
          where('userId', '==', uid),
          where('status', '==', 'stopped'),
          orderBy('startTime', 'desc'),
          startAfter(lastSessionDoc),
          limit(SESSIONS_LIMIT)
        );
      }
      const sessionsSnapshot = await getDocs(q);
      const fetchedSessions = sessionsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      // Update pagination state.
      if (sessionsSnapshot.docs.length < SESSIONS_LIMIT) {
        setHasMoreSessions(false);
      } else {
        setLastSessionDoc(sessionsSnapshot.docs[sessionsSnapshot.docs.length - 1]);
      }
      return fetchedSessions;
    },
    [lastSessionDoc]
  );

  // Modified fetchProjectDetails: use initial sessions load with pagination.
  const fetchProjectDetails = useCallback(async (projectId, uid, forceRefresh = false) => {
    if (!uid || !projectId) return;
    const cacheKey = `projectDetailData_${uid}_${projectId}`;
    if (!forceRefresh) {
      const cached = loadCachedProjectDetail(uid, projectId);
      if (cached) {
        setProject(cached.project || null);
        setSessions(cached.sessions || []);
        // For cached data, assume we have more sessions if count is exactly the limit.
        setHasMoreSessions((cached.sessions || []).length >= SESSIONS_LIMIT);
        setLoading(false);
        return;
      }
    }
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
        // Reset pagination state on fresh load.
        setLastSessionDoc(null);
        setHasMoreSessions(true);
        const initialSessions = await fetchSessions(projectId, uid, true);
        setSessions(initialSessions);
        // Cache the data.
        const dataToCache = {
          project: { id: projectSnapshot.id, ...projectData },
          sessions: initialSessions,
          timestamp: Date.now(),
        };
        localStorage.setItem(cacheKey, JSON.stringify(dataToCache));
      }
    } catch (error) {
      console.error('Error fetching project or sessions:', error);
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [fetchSessions]);

  // Load more sessions handler.
  const handleLoadMore = useCallback(async () => {
    if (!currentUser || !routeProjectId || !hasMoreSessions) return;
    setLoading(true);
    try {
      const moreSessions = await fetchSessions(routeProjectId, currentUser.uid, false);
      setSessions(prev => [...prev, ...moreSessions]);
      // Optionally, update the cache here if desired.
    } catch (error) {
      console.error('Error loading more sessions:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUser, routeProjectId, fetchSessions, hasMoreSessions]);

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

  // Real-time listeners for project detail and sessions.
  useEffect(() => {
    if (!currentUser || !routeProjectId) return;
    let initialProject = true;
    let initialSessions = true;
    const projectDocRef = doc(db, 'projects', routeProjectId);
    const sessionsQuery = query(
      collection(db, 'sessions'),
      where('projectId', '==', routeProjectId),
      where('userId', '==', currentUser.uid),
      where('status', '==', 'stopped'),
      orderBy('startTime', 'desc'),
      limit(SESSIONS_LIMIT)
    );
    const unsubProject = onSnapshot(projectDocRef, (snapshot) => {
      if (initialProject) {
        initialProject = false;
        return;
      }
      fetchProjectDetails(routeProjectId, currentUser.uid, true);
    });
    const unsubSessions = onSnapshot(sessionsQuery, (snapshot) => {
      if (initialSessions) {
        initialSessions = false;
        return;
      }
      fetchProjectDetails(routeProjectId, currentUser.uid, true);
    });
    return () => {
      unsubProject();
      unsubSessions();
    };
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
    setEffectTrigger(prev => prev + 1);
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
      const sessionDate = convertToDate(session);
      return sessionDate && sessionDate >= startDate && sessionDate <= now;
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

  const billableTime = useMemo(() => {
    return filteredSessions.reduce(
      (sum, session) => (session.isBillable ? sum + (session.elapsedTime || 0) : sum),
      0
    );
  }, [filteredSessions]);

  const totalEarned = useMemo(() => {
    if (displayMode === 'earned' && project?.hourRate) {
      const rate = parseFloat(project.hourRate);
      if (!isNaN(rate)) {
        return (billableTime / 3600) * rate;
      }
    }
    return 0;
  }, [displayMode, project?.hourRate, billableTime]);

  // Group sessions by date.
  const sessionsByDate = useMemo(() => {
    return filteredSessions.reduce((acc, session) => {
      let dateStr = 'Invalid Date';
      const dateObj = convertToDate(session);
      if (dateObj) {
        try {
          dateStr = dateObj.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          });
        } catch (error) {
          console.error('Error converting date:', error, session.startTime);
        }
      } else {
        console.warn('Invalid startTime for session:', session.id, session.startTime);
      }
      if (!acc[dateStr]) {
        acc[dateStr] = [];
      }
      acc[dateStr].push(session);
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

  const formatStartTime = useCallback((session) => {
    const date = convertToDate(session);
    if (date) {
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
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
      <Header variant="journalOverview" showBackArrow={true} />
      <div className="project-dropdown-container top-tile" onClick={() => {
          console.log("Navigating to update project with projectId:", project.id);
          navigate(`/projects/${project.id}/update`);
        }}>
        {project?.imageUrl ? (
          <img src={project.imageUrl} alt={project.name} className="dropdown-project-image" />
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
          <select className="time-range-select" value={selectedTimeRange} onChange={handleTimeRangeChange}>
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
                  <Link key={session.id} to={`/session/${session.id}`} className="session-link">
                    <li className="session-item input-tile">
                      <span className="session-start-time">
                        {formatStartTime(session)}
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
        {hasMoreSessions && (
          <div className="load-more-container">
            <button className="load-more-button" onClick={handleLoadMore}>
              Load More Moments
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

ProjectDetailPage.displayName = 'ProjectDetailPage';
export default ProjectDetailPage;
