
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  startAfter,
  limit,
} from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { formatTime } from '../utils/formatTime';
import Header from '../components/Layout/Header';
import '../styles/global.css';
import { ReactComponent as DropdownIcon } from '../styles/components/assets/dropdown.svg';
import { ReactComponent as Spinner } from '../styles/components/assets/spinner.svg';
import { ReactComponent as TimerIcon } from '../styles/components/assets/timer.svg';
import { ReactComponent as BillableIcon } from '../styles/components/assets/billable.svg';
import { ReactComponent as EditIcon } from '../styles/components/assets/edit.svg';
import { TextGenerateEffect } from '../styles/components/text-generate-effect.tsx';

const CACHE_DURATION_MS = 30000; 
const SESSIONS_LIMIT = 30;

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
  if (
    session.startTime &&
    session.startTime.seconds != null &&
    session.startTime.nanoseconds != null
  ) {
    const seconds = Number(session.startTime.seconds);
    const nanoseconds = Number(session.startTime.nanoseconds);
    const date = new Date(seconds * 1000 + nanoseconds / 1000000);
    if (!isNaN(date.getTime())) return date;
  }
  if (session.startTime && typeof session.startTime === 'string') {
    let parsed = new Date(session.startTime);
    if (isNaN(parsed.getTime())) {
      parsed = new Date(session.startTime.replace(' at ', ' '));
    }
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return null;
};

// Cache
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
      console.error('Error parsing cached project detail data', e);
    }
  }
  return null;
};

const cacheProjectDetail = (uid, projectId, project, sessions, lastSessionDocCache) => {
  const cacheKey = `projectDetailData_${uid}_${projectId}`;
  const cache = {
    project,
    sessions,
    lastSessionDoc: lastSessionDocCache,
    timestamp: Date.now(),
  };
  localStorage.setItem(cacheKey, JSON.stringify(cache));
};

const ProjectDetailPage = React.memo(({ navigate, projectId }) => {
  const routeProjectId = projectId;
  const [project, setProject] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  const [lastSessionDoc, setLastSessionDoc] = useState(null);
  const [hasMoreSessions, setHasMoreSessions] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const [selectedTimeRange, setSelectedTimeRange] = useState('total');
  const [displayMode, setDisplayMode] = useState('time');
  const [effectTrigger, setEffectTrigger] = useState(0);

  const projectHeaderRef = useRef(null);

  const fetchProject = useCallback(async (uid, pid) => {
    const cachedData = loadCachedProjectDetail(uid, pid);
    if (cachedData) {
      setProject(cachedData.project || null);
      setSessions(cachedData.sessions || []);
      setLastSessionDoc(cachedData.lastSessionDoc || null);
      setHasMoreSessions(cachedData.sessions?.length >= SESSIONS_LIMIT);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const projectRef = doc(db, 'projects', pid);
      const projectSnap = await getDoc(projectRef);
      if (!projectSnap.exists() || projectSnap.data().userId !== uid) {
        console.error('Project not found or unauthorized.');
        setProject(null);
        return;
      }
      const projectData = { id: projectSnap.id, ...projectSnap.data() };
      setProject(projectData);
    } catch (err) {
      console.error('Error fetching project details:', err);
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchInitialSessions = useCallback(async (uid, pid) => {
    setSessionsLoading(true);
    try {
      const sessionsRef = collection(db, 'sessions');
      const sessionsQuery = query(
        sessionsRef,
        where('projectId', '==', pid),
        where('userId', '==', uid),
        where('status', '==', 'stopped'),
        orderBy('startTime', 'desc'),
        limit(SESSIONS_LIMIT)
      );
      const snapshot = await getDocs(sessionsQuery);
      const fetchedSessions = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setSessions(fetchedSessions);
      setHasMoreSessions(snapshot.docs.length >= SESSIONS_LIMIT);
      setLastSessionDoc(
        snapshot.docs.length > 0
          ? snapshot.docs[snapshot.docs.length - 1]
          : null
      );
      cacheProjectDetail(uid, pid, project, fetchedSessions, snapshot.docs[snapshot.docs.length - 1] || null);
    } catch (err) {
      console.error('Error fetching initial sessions:', err);
    } finally {
      setSessionsLoading(false);
    }
  }, [project]);

  const handleLoadMore = useCallback(async () => {
    if (!currentUser || !routeProjectId || !hasMoreSessions || sessionsLoading) return;
    setSessionsLoading(true);
    try {
      const sessionsRef = collection(db, 'sessions');
      const qMore = query(
        sessionsRef,
        where('projectId', '==', routeProjectId),
        where('userId', '==', currentUser.uid),
        where('status', '==', 'stopped'),
        orderBy('startTime', 'desc'),
        startAfter(lastSessionDoc || 0),
        limit(SESSIONS_LIMIT)
      );
      const snapshot = await getDocs(qMore);
      const more = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      setSessions((prev) => [...prev, ...more]);
      setHasMoreSessions(snapshot.docs.length >= SESSIONS_LIMIT);
      setLastSessionDoc(
        snapshot.docs.length > 0
          ? snapshot.docs[snapshot.docs.length - 1]
          : lastSessionDoc
      );
      cacheProjectDetail(
        currentUser.uid,
        routeProjectId,
        project,
        [...sessions, ...more],
        snapshot.docs.length > 0
          ? snapshot.docs[snapshot.docs.length - 1]
          : lastSessionDoc
      );
    } catch (err) {
      console.error('Error loading more sessions:', err);
    } finally {
      setSessionsLoading(false);
    }
  }, [
    currentUser,
    routeProjectId,
    lastSessionDoc,
    hasMoreSessions,
    sessions,
    project,
    sessionsLoading,
  ]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate('login');
      } else {
        setCurrentUser(user);
        await fetchProject(user.uid, routeProjectId);
      }
    });
    return () => unsub();
  }, [fetchProject, routeProjectId, navigate]);

  useEffect(() => {
    if (currentUser && routeProjectId) {
      fetchInitialSessions(currentUser.uid, routeProjectId);
    }
  }, [currentUser, routeProjectId, fetchInitialSessions]);

  const handleTimeRangeChange = useCallback((e) => {
    setSelectedTimeRange(e.target.value);
  }, []);

  const handleDisplayModeChange = useCallback((mode) => {
    setDisplayMode(mode);
    setEffectTrigger((prev) => prev + 1);
  }, []);

  const getSessionsForTimeRange = useCallback((list, timeRange) => {
    if (timeRange === 'total') return list;
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
    return list.filter((session) => {
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
      (sum, session) =>
        session.isBillable ? sum + (session.elapsedTime || 0) : sum,
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

  const formatEarnedAmount = useCallback(
    (amount) => {
      if (!project) return '';
      const isDollar = project.currencyId === 'dollar';
      const symbol = isDollar ? '$' : '€';
      const locale = isDollar ? 'en-US' : 'en-DE';
      return `${symbol}${amount.toLocaleString(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    },
    [project]
  );

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

  if (loading) {
    return (
      <div className="homepage-loading">
        <Spinner className="profile-pic souko-logo-header spinning-logo" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="project-container">
        <h1 className="error-title">Project not found</h1>
        <button className="button" onClick={() => navigate('home')}>
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
        navigate={navigate}
      />
      <div
        className="project-dropdown-container top-tile"
        onClick={() => navigate('update-project', { projectId: project.id })}
      >
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
            className={`display-mode-button ${
              displayMode === 'time' ? 'active' : 'muted'
            }`}
            onClick={() => handleDisplayModeChange('time')}
          >
            <TimerIcon className="display-mode-icon" />
          </button>
          <button
            className={`display-mode-button ${
              displayMode === 'earned' ? 'active' : 'muted'
            }`}
            onClick={() => handleDisplayModeChange('earned')}
          >
            <BillableIcon className="display-mode-icon" />
          </button>
        </div>
      </div>

      <div className="project-header-container" ref={projectHeaderRef}>
        <h1 className="timer project-time">
          {displayMode === 'time' ? (
            <TextGenerateEffect
              key={`time-value-${effectTrigger}`}
              words={formatTime(totalTime)}
            />
          ) : (
            <TextGenerateEffect
              key={`earned-value-${effectTrigger}`}
              words={formatEarnedAmount(totalEarned)}
            />
          )}
        </h1>
      </div>

      <div className="sessions-container">
        {Object.keys(sessionsByDate).length > 0 ? (
          <>
            {sortedDates.map((date) => (
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
                    <li
                      key={session.id}
                      className="session-item input-tile"
                      onClick={() =>
                        navigate('session-detail', { sessionId: session.id })
                      }
                    >
                      <span className="session-start-time">
                        {formatStartTime(session)}
                      </span>
                      <span
                        className="session-elapsed-time"
                        style={{
                          color: session.isBillable
                            ? 'var(--accent-pink)'
                            : 'var(--text-muted)',
                        }}
                      >
                        {formatTime(session.elapsedTime)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </>
        ) : (
          <p>No sessions tracked for this project yet.</p>
        )}
        {hasMoreSessions && (
          <div className="load-more-container">
            <button
              className={`load-more-button ${sessionsLoading ? 'loading' : ''}`}
              onClick={handleLoadMore}
              disabled={sessionsLoading}
            >
              {sessionsLoading ? 'Loading Moments...' : 'Load More Moments'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

ProjectDetailPage.displayName = 'ProjectDetailPage';
export default ProjectDetailPage;