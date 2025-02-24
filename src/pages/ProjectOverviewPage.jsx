import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
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

const cacheData = (uid, projects, sessions) => {
  const cache = {
    projects: projects,
    sessions: sessions,
    timestamp: Date.now()
  };
  localStorage.setItem(`projectOverviewData_${uid}`, JSON.stringify(cache));
};


const ProjectOverviewPage = ({ navigate }) => { // <-- Receive navigate prop
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [sessions, setSessions] = useState([]);
  // Active session state for FAB optimization.
  const [activeSession, setActiveSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortMode, setSortMode] = useState("tracked");
  const [dataLoadCounter, setDataLoadCounter] = useState(0); // Counter to track data loads


  // Refs for FAB scroll effect
  const fabRef = useRef(null);
  const scrollTimeout = useRef(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        navigate('login'); // <-- Use navigate prop, page name as string
      } else {
        setUser(currentUser);
        if (loadCachedData(currentUser.uid, setProjects, setSessions)) {
          setLoading(false); // If loaded from cache, no need to wait for firebase
        }

        const projectsQuery = query(
          collection(db, 'projects'),
          where('userId', '==', currentUser.uid)
        );
        const sessionsQuery = query(
          collection(db, 'sessions'),
          where('userId', '==', currentUser.uid),
          where('status', '==', 'stopped')
        );

        let unsubProjects, unsubSessions; // Declare outside to be accessible in return

        const handleProjectsSnapshot = (snapshot) => {
          const userProjects = snapshot.docs.map((doc) => ({
            id: doc.id,
            name: doc.data().name,
            imageUrl: doc.data().imageUrl,
          }));
          setProjects(userProjects);
          setDataLoadCounter(prevCounter => prevCounter + 1); // Increment counter when projects loaded
        };

        const handleSessionsSnapshot = (snapshot) => {
          const userSessions = snapshot.docs.map((doc) => doc.data());
          setSessions(userSessions);
          setDataLoadCounter(prevCounter => prevCounter + 1); // Increment counter when sessions loaded
        };


        unsubProjects = onSnapshot(projectsQuery, handleProjectsSnapshot, (error) => {
          console.error("Projects onSnapshot Error:", error);
          setDataLoadCounter(prevCounter => prevCounter + 1); // Ensure counter is incremented even on error
        });

        unsubSessions = onSnapshot(sessionsQuery, handleSessionsSnapshot, (error) => {
          console.error("Sessions onSnapshot Error:", error);
          setDataLoadCounter(prevCounter => prevCounter + 1); // Ensure counter is incremented even on error
        });


        return () => {
          if (unsubProjects) unsubProjects();
          if (unsubSessions) unsubSessions();
        };
      }
    });
    return () => unsubscribeAuth();
  }, [navigate]);

  // Cache data and set loading to false after both datasets are loaded
  useEffect(() => {
    if (dataLoadCounter >= 2 && user) {
      cacheData(user.uid, projects, sessions);
      setLoading(false);
      setDataLoadCounter(0); // Reset counter for potential future re-fetches if needed (currently not triggered in this component, but good practice)
    }
  }, [dataLoadCounter, user, projects, sessions]);


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
          session => session.projectId === project.id && session.startTime
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
        const aTime = totalSessionTime[a.id] || 0;
        const bTime = totalSessionTime[b.id] || 0;
        return bTime - aTime;
      });
    } else {
      return [...projects].sort((a, b) => {
        const aSessions = sessions.filter(
          session => session.projectId === a.id && session.startTime
        );
        const bSessions = sessions.filter(
          session => session.projectId === b.id && session.startTime
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
            // ✅ Replace <Link> with button and navigate to 'project-detail' with params
            <li
              key={project.id}
              className="project-item"
              onClick={() => navigate('project-detail', { projectId: project.id })}
            >
              <div className="project-image-container">{renderProjectImage(project)}</div>
              <div className="project-name">{project.name}</div>
              <div className="project-total-time">
                {totalSessionTime && totalSessionTime[project.id] !== undefined
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
        onBack={() => navigate('home')} // <-- Use navigate prop, page name as string
        navigate={navigate} // <-- Pass navigate prop to Header
        onActionClick={() => navigate('create-project')} // <-- Use navigate prop, page name as string
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
      <button ref={fabRef} className="fab" onClick={() => navigate('time-tracker')}> {/* ✅ navigate to 'time-tracker' */}
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