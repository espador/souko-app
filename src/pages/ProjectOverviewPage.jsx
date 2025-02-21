import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { formatTime } from '../utils/formatTime';
import Header from '../components/Layout/Header';
import '@fontsource/shippori-mincho';
import { TextGenerateEffect } from '../styles/components/text-generate-effect.tsx';
import '../styles/components/ProjectOverviewPage.css';
import { ReactComponent as SoukoLogoHeader } from '../styles/components/assets/Souko-logo-header.svg';
import { ReactComponent as StartTimerIcon } from '../styles/components/assets/start-timer.svg';
import { ReactComponent as StopTimerIcon } from '../styles/components/assets/stop-timer.svg';

// Define parseTimestamp function to convert a timestamp to a Date object.
const parseTimestamp = (timestamp, fallbackTimestamp) => {
  if (!timestamp && !fallbackTimestamp) return null;
  if (fallbackTimestamp != null) {
    const num = Number(fallbackTimestamp);
    const date = new Date(num);
    return isNaN(date.getTime()) ? null : date;
  }
  if (typeof timestamp === 'string') {
    let parsed = new Date(timestamp);
    if (isNaN(parsed.getTime())) {
      const modified = timestamp.replace(" at ", " ");
      parsed = new Date(modified);
    }
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }
  if (timestamp.seconds != null && timestamp.nanoseconds != null) {
    const seconds = Number(timestamp.seconds);
    const nanoseconds = Number(timestamp.nanoseconds);
    if (!isNaN(seconds) && !isNaN(nanoseconds)) {
      const ms = seconds * 1000 + nanoseconds / 1000000;
      const date = new Date(ms);
      return isNaN(date.getTime()) ? null : date;
    }
  }
  const date = new Date(timestamp);
  return isNaN(date.getTime()) ? null : date;
};

const CACHE_DURATION_MS = 30000; // 30 seconds

const loadCachedData = (uid, setProjects, setSessions) => {
  const cachedStr = localStorage.getItem(`projectOverviewData_${uid}`);
  if (cachedStr) {
    try {
      const cached = JSON.parse(cachedStr);
      if (Date.now() - cached.timestamp < CACHE_DURATION_MS) {
        setProjects(cached.projects || []);
        setSessions(cached.sessions || []);
        return true;
      }
    } catch (e) {
      console.error("Error parsing cached project overview data", e);
    }
  }
  return false;
};

const ProjectOverviewPage = () => {
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [sessions, setSessions] = useState([]);
  // Active session state for FAB optimization.
  const [activeSession, setActiveSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortMode, setSortMode] = useState("tracked");
  const navigate = useNavigate();

  // Refs for FAB scroll effect
  const fabRef = useRef(null);
  const scrollTimeout = useRef(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        navigate('/');
      } else {
        setUser(currentUser);
        loadCachedData(currentUser.uid, setProjects, setSessions);

        const projectsQuery = query(
          collection(db, 'projects'),
          where('userId', '==', currentUser.uid)
        );
        const sessionsQuery = query(
          collection(db, 'sessions'),
          where('userId', '==', currentUser.uid),
          where('status', '==', 'stopped')
        );

        const unsubProjects = onSnapshot(projectsQuery, (snapshot) => {
          const userProjects = snapshot.docs.map((doc) => ({
            id: doc.id,
            name: doc.data().name,
            imageUrl: doc.data().imageUrl,
          }));
          setProjects(userProjects);
          const cachedStr = localStorage.getItem(`projectOverviewData_${currentUser.uid}`);
          let cachedData = {};
          try {
            cachedData = cachedStr ? JSON.parse(cachedStr) : {};
          } catch (e) {
            console.error("Error parsing cached data:", e);
          }
          const newCache = {
            ...cachedData,
            projects: userProjects,
            timestamp: Date.now()
          };
          localStorage.setItem(`projectOverviewData_${currentUser.uid}`, JSON.stringify(newCache));
          setLoading(false);
        });

        const unsubSessions = onSnapshot(sessionsQuery, (snapshot) => {
          const userSessions = snapshot.docs.map((doc) => doc.data());
          setSessions(userSessions);
          const cachedStr = localStorage.getItem(`projectOverviewData_${currentUser.uid}`);
          let cachedData = {};
          try {
            cachedData = cachedStr ? JSON.parse(cachedStr) : {};
          } catch (e) {
            console.error("Error parsing cached data:", e);
          }
          const newCache = {
            ...cachedData,
            sessions: userSessions,
            timestamp: Date.now()
          };
          localStorage.setItem(`projectOverviewData_${currentUser.uid}`, JSON.stringify(newCache));
          setLoading(false);
        });

        return () => {
          unsubProjects();
          unsubSessions();
        };
      }
    });
    return () => unsubscribeAuth();
  }, [navigate]);

  // Optimized active session query for FAB.
  useEffect(() => {
    if (user) {
      const activeSessionQuery = query(
        collection(db, 'sessions'),
        where('userId', '==', user.uid),
        where('endTime', '==', null)
      );
      const unsubActiveSession = onSnapshot(activeSessionQuery, (snapshot) => {
        if (!snapshot.empty) {
          setActiveSession(snapshot.docs[0].data());
        } else {
          setActiveSession(null);
        }
      });
      return () => unsubActiveSession();
    }
  }, [user]);

  useEffect(() => {
    const handleScroll = () => {
      if (fabRef.current) {
        fabRef.current.classList.add('scrolling');
        clearTimeout(scrollTimeout.current);
        scrollTimeout.current = setTimeout(() => {
          fabRef.current && fabRef.current.classList.remove('scrolling');
        }, 300);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const hasActiveSession = Boolean(activeSession);

  const totalSessionTime = useMemo(() => {
    const projectTimes = {};
    projects.forEach(project => {
      const projectSessions = sessions.filter(session => session.projectId === project.id); // Use projectId here
      const totalTimeForProject = projectSessions.reduce((acc, session) => {
        return acc + (session.elapsedTime || 0);
      }, 0);
      projectTimes[project.id] = totalTimeForProject; // Use project.id as key
    });
    return projectTimes;
  }, [sessions, projects]); // Recalculate when sessions or projects change

  const totalTrackedTimeAcrossProjects = useMemo(() => {
    return sessions.reduce((sum, session) => sum + (session.elapsedTime || 0), 0);
  }, [sessions]);

  const formatTotalTimeForQuote = useCallback((totalTime) => {
    const formattedTime = formatTime(totalTime);
    const parts = formattedTime.split(' ');
    if (parts.length === 2) {
      return `${parts[0]} ${parts[1]}`;
    } else if (parts.length === 4 && parts[1] === 'days') {
      return `${parts[0]}d ${parts[2]}h`;
    }
    return formattedTime;
  }, []);

  const formattedTotalTime = useMemo(() => {
    return formatTotalTimeForQuote(totalTrackedTimeAcrossProjects);
  }, [totalTrackedTimeAcrossProjects, formatTotalTimeForQuote]);

  const getInitials = useCallback((name) => {
    if (!name) return '';
    return name.trim().charAt(0).toUpperCase();
  }, []);

  const renderProjectImage = useMemo(() => (project) =>
    project.imageUrl ? (
      <img src={project.imageUrl} alt={project.name} className="project-image" />
    ) : (
      <div className="default-project-image" style={{ backgroundColor: '#FE2F00' }}>
        <span>{getInitials(project.name || 'P')}</span>
      </div>
    ),
  [getInitials]);

  const recentProjects = useMemo(() => {
    return projects
      .map(project => {
        const projectSessions = sessions.filter(
          session => session.projectId === project.id && session.startTime // Use projectId here
        );
        const latestSessionTime =
          projectSessions.length > 0
            ? Math.max(...projectSessions.map(session => {
                const date = parseTimestamp(session.startTime, session.startTimeMs);
                return date ? date.getTime() : 0;
              }))
            : 0;
        return { ...project, latestSessionTime };
      })
      .filter(project => project.latestSessionTime > 0)
      .sort((a, b) => b.latestSessionTime - a.latestSessionTime)
      .slice(0, 3);
  }, [projects, sessions]);

  const sortedProjects = useMemo(() => {
    if (sortMode === "tracked") {
      return [...projects].sort((a, b) => {
        const aTime = totalSessionTime[a.id] || 0; // Use a.id here
        const bTime = totalSessionTime[b.id] || 0; // Use b.id here
        return bTime - aTime;
      });
    } else {
      return [...projects].sort((a, b) => {
        const aSessions = sessions.filter(
          session => session.projectId === a.id && session.startTime // Use a.id here
        );
        const bSessions = sessions.filter(
          session => session.projectId === b.id && session.startTime // Use b.id here
        );
        const aLatest = aSessions.length > 0
          ? Math.max(...aSessions.map(session => {
              const date = parseTimestamp(session.startTime, session.startTimeMs);
              return date ? date.getTime() : 0;
            }))
          : 0;
        const bLatest = bSessions.length > 0
          ? Math.max(...bSessions.map(session => {
              const date = parseTimestamp(session.startTime, session.startTimeMs);
              return date ? date.getTime() : 0;
            }))
          : 0;
        return bLatest - aLatest;
      });
    }
  }, [sortMode, projects, sessions, totalSessionTime]);

  const toggleSortMode = useCallback(() => {
    setSortMode((prevMode) => (prevMode === "tracked" ? "recent" : "tracked"));
  }, []);

  const renderProjects = useMemo(() => {
    const projectsToRender = sortMode === 'recent' ? recentProjects : sortedProjects;
    if (projects.length > 0) {
      if (projectsToRender.length === 0 && sortMode === 'recent') {
        return <p>No projects with recent sessions found.</p>;
      }
      if (projectsToRender.length === 0 && sortMode === 'tracked') {
        return <p>No projects with tracked time found.</p>;
      }
      return (
        <ul className="projects-list">
          {projectsToRender.map((project) => (
            <li
              key={project.id}
              className="project-item"
              onClick={() => navigate(`/project/${project.id}`)}
            >
              <div className="project-image-container">{renderProjectImage(project)}</div>
              <div className="project-name">{project.name}</div>
              <div className="project-total-time">
                {totalSessionTime && totalSessionTime[project.id] !== undefined // Use project.id here
                  ? formatTime(totalSessionTime[project.id])
                  : formatTime(0)}
              </div>
            </li>
          ))}
        </ul>
      );
    } else {
      return <p>No projects found. Start tracking to see results here!</p>;
    }
  }, [projects, navigate, totalSessionTime, renderProjectImage, recentProjects, sortMode, sortedProjects]);

  if (loading) {
    return (
      <div className="homepage-loading">
        <SoukoLogoHeader className="profile-pic souko-logo-header spinning-logo" />
      </div>
    );
  }

  return (
    <div className="project-container">
      <Header
        variant="projectOverview"
        showBackArrow={true}
        onBack={() => navigate('/home')}
        onActionClick={() => navigate('/create-project')}
      />
      <section className="motivational-section">
        <TextGenerateEffect
          words={`You tracked <span class="accent-text">${formattedTotalTime}</span> hours.\nTime flows where focus leads.`}
        />
      </section>
      <main className="homepage-content">
        <section className="projects-section">
          <div className="projects-header">
            <h2 className="projects-label">All Projects</h2>
            <div className="projects-actions">
              <span onClick={toggleSortMode} className="projects-label sort-toggle-label">
                {sortMode === "tracked" ? "Most recent" : "Most tracked"}
              </span>
            </div>
          </div>
          {renderProjects}
        </section>
      </main>
      <button ref={fabRef} className="fab" onClick={() => navigate('/time-tracker')}>
        {hasActiveSession ? (
          <StopTimerIcon className="fab-icon" />
        ) : (
          <StartTimerIcon className="fab-icon" />
        )}
      </button>
    </div>
  );
};

export default ProjectOverviewPage;