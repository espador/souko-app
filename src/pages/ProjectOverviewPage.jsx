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
import { useNavigate } from 'react-router-dom';
import { formatTime } from '../utils/formatTime';
import Header from '../components/Layout/Header';
import '@fontsource/shippori-mincho';
import { TextGenerateEffect } from '../styles/components/text-generate-effect.tsx';
import '../styles/components/ProjectOverviewPage.css';
import { ReactComponent as SoukoLogoHeader } from '../styles/components/assets/Souko-logo-header.svg';
import { startOfWeek, endOfWeek } from 'date-fns';

const ProjectOverviewPage = () => {
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  // Only load sessions that are finished (status "stopped")
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortMode, setSortMode] = useState("tracked"); // "tracked" or "recent"
  const navigate = useNavigate();

  // Helper to parse timestamps (handle Firestore Timestamps)
  const parseTimestamp = (timestamp) => {
    if (!timestamp) return null;
    return typeof timestamp.toDate === 'function'
      ? timestamp.toDate()
      : new Date(timestamp);
  };

  const fetchData = useCallback(async (uid) => {
    setLoading(true);
    try {
      const [projectSnapshot, sessionSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'projects'), where('userId', '==', uid))),
        // Fetch only sessions with status "stopped" to show finished sessions
        getDocs(query(collection(db, 'sessions'), where('userId', '==', uid), where('status', '==', 'stopped')))
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

  // Total tracked time per project (by project name)
  const totalSessionTime = useMemo(() => {
    return sessions.reduce((acc, session) => {
      const project = session.project || 'Unknown Project';
      acc[project] = (acc[project] || 0) + (session.elapsedTime || 0);
      return acc;
    }, {});
  }, [sessions]);

  // Calculate total tracked time across all projects
  const totalTrackedTimeAcrossProjects = useMemo(() => {
    return sessions.reduce((sum, session) => sum + (session.elapsedTime || 0), 0);
  }, [sessions]);

  const formatTotalTimeForQuote = useCallback((totalTime) => {
    const formattedTime = formatTime(totalTime);
    const parts = formattedTime.split(' ');
    if (parts.length === 2) {
      return `${parts[0]} ${parts[1]}`; // e.g. "21h 30m" or "1d 2h"
    } else if (parts.length === 4 && parts[1] === 'days') {
      return `${parts[0]}d ${parts[2]}h`; // e.g. "2d 3h"
    }
    return formattedTime; // fallback
  }, []);

  const formattedTotalTime = useMemo(() => {
    return formatTotalTimeForQuote(totalTrackedTimeAcrossProjects);
  }, [totalTrackedTimeAcrossProjects, formatTotalTimeForQuote]);

  // Get initials from project name.
  const getInitials = (name) => {
    if (!name) return '';
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
    [getInitials]
  );

  // Define recentProjects: the 3 projects with the most recent finished sessions.
  const recentProjects = useMemo(() => {
    return projects
      .map(project => {
        const projectSessions = sessions.filter(
          session => session.project === project.name && session.startTime
        );
        const latestSessionTime =
          projectSessions.length > 0
            ? Math.max(...projectSessions.map(session => {
                const t = parseTimestamp(session.startTime);
                return t ? t.getTime() : 0;
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
        const aTime = totalSessionTime[a.name] || 0;
        const bTime = totalSessionTime[b.name] || 0;
        return bTime - aTime;
      });
    } else {
      return [...projects].sort((a, b) => {
        const aSessions = sessions.filter(
          session => session.project === a.name && session.startTime
        );
        const bSessions = sessions.filter(
          session => session.project === b.name && session.startTime
        );
        const aLatest = aSessions.length > 0
          ? Math.max(...aSessions.map(session => {
              const t = parseTimestamp(session.startTime);
              return t ? t.getTime() : 0;
            }))
          : 0;
        const bLatest = bSessions.length > 0
          ? Math.max(...bSessions.map(session => {
              const t = parseTimestamp(session.startTime);
              return t ? t.getTime() : 0;
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
    if (projects.length > 0) {
      if (recentProjects.length === 0) {
        return <p>No projects with tracked sessions found. Start tracking to see results here!</p>;
      }
      return (
        <ul className="projects-list">
          {recentProjects.map((project) => (
            <li
              key={project.id}
              className="project-item"
              onClick={() => navigate(`/project/${project.id}`)}
            >
              <div className="project-image-container">{renderProjectImage(project)}</div>
              <div className="project-name">{project.name}</div>
              <div className="project-total-time">
                {totalSessionTime && totalSessionTime[project.name] !== undefined
                  ? formatTime(totalSessionTime[project.name])
                  : formatTime(0)}
              </div>
            </li>
          ))}
        </ul>
      );
    } else {
      return <p>No projects found. Start tracking to see results here!</p>;
    }
  }, [projects, navigate, totalSessionTime, renderProjectImage, recentProjects]);

  console.log('ProjectOverviewPage rendered. Loading:', loading);

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
              <span 
                onClick={toggleSortMode} 
                className="projects-label sort-toggle-label"
              >
                {sortMode === "tracked" ? "Most recent" : "Most tracked"}
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
