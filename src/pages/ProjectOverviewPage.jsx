import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { formatTime } from '../utils/formatTime';
import Header from '../components/Layout/Header';
import '@fontsource/shippori-mincho';
import { TextGenerateEffect } from '../styles/components/text-generate-effect.tsx';
import '../styles/components/ProjectOverviewPage.css';
import { ReactComponent as Spinner } from '../styles/components/assets/spinner.svg';

// Helper to convert timestamps
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
      // try removing " at "
      const modified = timestamp.replace(' at ', ' ');
      parsed = new Date(modified);
    }
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof timestamp.toDate === 'function') {
    // Firestore Timestamp objects
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
  // Last resort
  const date = new Date(timestamp);
  return isNaN(date.getTime()) ? null : date;
};

const CACHE_DURATION_MS = 30000; // 30s

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
    } catch (err) {
      console.error('Error parsing cached project overview data', err);
    }
  }
  return false;
};

const cacheData = (uid, projects, sessions) => {
  const cache = {
    projects,
    sessions,
    timestamp: Date.now(),
  };
  localStorage.setItem(`projectOverviewData_${uid}`, JSON.stringify(cache));
};

const ProjectOverviewPage = ({ navigate }) => {
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [sessions, setSessions] = useState([]);

  const [loading, setLoading] = useState(true);
  const [dataLoadCounter, setDataLoadCounter] = useState(0);

  // We only define sortMode once!
  const [sortMode, setSortMode] = useState('tracked');

  // 1) Auth + attempt cache + Firestore onSnapshot
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        navigate('login');
      } else {
        setUser(currentUser);

        // Try cache
        if (loadCachedData(currentUser.uid, setProjects, setSessions)) {
          setLoading(false);
        }

        // Real-time queries
        const projectsQuery = query(
          collection(db, 'projects'),
          where('userId', '==', currentUser.uid)
        );
        const sessionsQuery = query(
          collection(db, 'sessions'),
          where('userId', '==', currentUser.uid),
          where('status', '==', 'stopped')
        );

        let unsubProjects, unsubSessions;

        const handleProjectsSnapshot = (snapshot) => {
          const userProjects = snapshot.docs.map((doc) => ({
            id: doc.id,
            name: doc.data().name,
            imageUrl: doc.data().imageUrl,
          }));
          setProjects(userProjects);
          setDataLoadCounter((prev) => prev + 1);
        };

        const handleSessionsSnapshot = (snapshot) => {
          const userSessions = snapshot.docs.map((doc) => doc.data());
          setSessions(userSessions);
          setDataLoadCounter((prev) => prev + 1);
        };

        unsubProjects = onSnapshot(projectsQuery, handleProjectsSnapshot, (error) => {
          console.error('Projects onSnapshot Error:', error);
          setDataLoadCounter((prev) => prev + 1);
        });
        unsubSessions = onSnapshot(sessionsQuery, handleSessionsSnapshot, (error) => {
          console.error('Sessions onSnapshot Error:', error);
          setDataLoadCounter((prev) => prev + 1);
        });

        return () => {
          if (unsubProjects) unsubProjects();
          if (unsubSessions) unsubSessions();
        };
      }
    });

    return () => unsubscribeAuth();
  }, [navigate]);

  // 2) After both queries have loaded at least once, cache them
  useEffect(() => {
    if (dataLoadCounter >= 2 && user) {
      cacheData(user.uid, projects, sessions);
      setLoading(false);
      setDataLoadCounter(0);
    }
  }, [dataLoadCounter, user, projects, sessions]);

  // 3) Computed values
  const totalSessionTime = useMemo(() => {
    const projectTimes = {};
    projects.forEach((project) => {
      const projectSessions = sessions.filter(
        (session) => session.projectId === project.id
      );
      const sumTime = projectSessions.reduce((acc, s) => acc + (s.elapsedTime || 0), 0);
      projectTimes[project.id] = sumTime;
    });
    return projectTimes;
  }, [projects, sessions]);

  const totalTrackedTimeAcrossProjects = useMemo(() => {
    return sessions.reduce((sum, s) => sum + (s.elapsedTime || 0), 0);
  }, [sessions]);

  const formatTotalTimeForQuote = useCallback((totalTime) => {
    const formattedTime = formatTime(totalTime);
    const parts = formattedTime.split(' ');
    if (parts.length === 2) {
      return `${parts[0]} ${parts[1]}`;
    } else if (parts.length === 4 && parts[1] === 'days') {
      // Example: "2 days 3 hours"
      return `${parts[0]}d ${parts[2]}h`;
    }
    return formattedTime;
  }, []);

  const formattedTotalTime = useMemo(() => {
    return formatTotalTimeForQuote(totalTrackedTimeAcrossProjects);
  }, [totalTrackedTimeAcrossProjects, formatTotalTimeForQuote]);

  // Sorting logic for projects
  const toggleSortMode = useCallback(() => {
    setSortMode((prevMode) => (prevMode === 'tracked' ? 'recent' : 'tracked'));
  }, []);

  const sortedProjects = useMemo(() => {
    if (sortMode === 'tracked') {
      // Sort by total tracked time desc
      return [...projects].sort((a, b) => {
        const aTime = totalSessionTime[a.id] || 0;
        const bTime = totalSessionTime[b.id] || 0;
        return bTime - aTime;
      });
    } else {
      // "recent" => sort by latest session date
      return [...projects].sort((a, b) => {
        const aSessions = sessions.filter(
          (s) => s.projectId === a.id && s.startTime
        );
        const bSessions = sessions.filter(
          (s) => s.projectId === b.id && s.startTime
        );
        const aLatest = aSessions.length
          ? Math.max(
              ...aSessions.map((s) => {
                const date = parseTimestamp(s.startTime, s.startTimeMs);
                return date ? date.getTime() : 0;
              })
            )
          : 0;
        const bLatest = bSessions.length
          ? Math.max(
              ...bSessions.map((s) => {
                const date = parseTimestamp(s.startTime, s.startTimeMs);
                return date ? date.getTime() : 0;
              })
            )
          : 0;
        return bLatest - aLatest;
      });
    }
  }, [projects, sessions, sortMode, totalSessionTime]);

  const renderProjectImage = useCallback((project) => {
    if (project.imageUrl) {
      return (
        <img
          src={project.imageUrl}
          alt={project.name}
          className="project-image"
        />
      );
    }
    // Fallback: first letter
    return (
      <div className="default-project-image" style={{ backgroundColor: '#FE2F00' }}>
        <span>{(project.name || 'P').charAt(0).toUpperCase()}</span>
      </div>
    );
  }, []);

  const renderProjects = useMemo(() => {
    if (!projects.length) {
      return <p>No projects found. Start tracking to see results here!</p>;
    }
    return (
      <ul className="projects-list">
        {sortedProjects.map((project) => (
          <li
            key={project.id}
            className="project-item"
            onClick={() => navigate('project-detail', { projectId: project.id })}
          >
            <div className="project-image-container">
              {renderProjectImage(project)}
            </div>
            <div className="project-name">{project.name}</div>
            <div className="project-total-time">
              {totalSessionTime[project.id]
                ? formatTime(totalSessionTime[project.id])
                : formatTime(0)}
            </div>
          </li>
        ))}
      </ul>
    );
  }, [projects, sortedProjects, totalSessionTime, navigate, renderProjectImage]);

  // 4) Render
  if (loading) {
    return (
      <div className="homepage-loading">
        <Spinner className="profile-pic souko-logo-header spinning-logo" />
      </div>
    );
  }

  return (
    <div className="project-container">
      <Header
        variant="projectOverview"
        showBackArrow={true}
        onBack={() => navigate('home')}
        navigate={navigate}
        onActionClick={() => navigate('create-project')}
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
                {sortMode === 'tracked' ? 'Most recent' : 'Most tracked'}
              </span>
            </div>
          </div>
          {renderProjects}
        </section>
      </main>
    </div>
  );
};

export default ProjectOverviewPage;
