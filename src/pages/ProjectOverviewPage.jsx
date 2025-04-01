import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  getDocs,
  doc,
  getDoc
} from 'firebase/firestore';
import { formatTime } from '../utils/formatTime';
import Header from '../components/Layout/Header';
import '@fontsource/shippori-mincho';
import '../styles/global.css';
import { ReactComponent as Spinner } from '../styles/components/assets/spinner.svg';
import { PieChart } from '@mui/x-charts/PieChart'; // Import PieChart

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

const loadCachedData = (uid, setProjects, setSessions, setProjectTotals) => {
  const cachedStr = localStorage.getItem(`projectOverviewData_${uid}`);
  if (cachedStr) {
    try {
      const cached = JSON.parse(cachedStr);
      if (Date.now() - cached.timestamp < CACHE_DURATION_MS) {
        setProjects(cached.projects || []);
        setSessions(cached.sessions || []);
        setProjectTotals(cached.projectTotals || {});
        return true;
      }
    } catch (err) {
      console.error('Error parsing cached project overview data', err);
    }
  }
  return false;
};

const cacheData = (uid, projects, sessions, projectTotals) => {
  const cache = {
    projects,
    sessions,
    projectTotals,
    timestamp: Date.now(),
  };
  localStorage.setItem(`projectOverviewData_${uid}`, JSON.stringify(cache));
};

const ProjectOverviewPage = ({ navigate }) => {
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [projectTotals, setProjectTotals] = useState({});
  const [loading, setLoading] = useState(true);
  const [dataLoadCounter, setDataLoadCounter] = useState(0);

  // Function to fetch all project totals at once
  const fetchProjectTotals = useCallback(async (userId) => {
    if (!userId || !projects.length) return;
    
    try {
      // First try to get from userStats collection (aggregated stats per user)
      try {
        const userStatsRef = doc(db, 'userStats', userId);
        const userStatsSnap = await getDoc(userStatsRef);
        
        if (userStatsSnap.exists()) {
          const stats = userStatsSnap.data();
          if (stats.projectTotals) {
            const projectTotals = stats.projectTotals;
            let totals = {};
            
            // Initialize with zeros and then fill in any values from stats
            projects.forEach(project => {
              totals[project.id] = projectTotals[project.id]?.totalTime || 0;
            });
            
            // Only use these values if at least some projects have stats
            if (Object.values(totals).some(val => val > 0)) {
              setProjectTotals(totals);
              cacheData(userId, projects, sessions, totals);
              return;
            }
          }
        }
      } catch (statErr) {
        console.log('User stats not available, falling back to sessions query');
      }
      
      // If userStats not available, calculate project totals from sessions
      const sessionsRef = collection(db, 'sessions');
      const sessionsQuery = query(
        sessionsRef,
        where('userId', '==', userId),
        where('status', 'in', ['stopped', 'completed'])
      );
      
      const snapshot = await getDocs(sessionsQuery);
      let totals = {};
      
      // Initialize all projects with 0
      projects.forEach(project => {
        totals[project.id] = 0;
      });
      
      // Sum up times for each project
      snapshot.docs.forEach(doc => {
        const session = doc.data();
        if (session.projectId && session.elapsedTime) {
          totals[session.projectId] = (totals[session.projectId] || 0) + session.elapsedTime;
        }
      });
      
      setProjectTotals(totals);
      
      // Update cache with totals
      cacheData(userId, projects, sessions, totals);
    } catch (err) {
      console.error('Error fetching project totals:', err);
      // Fallback to computing from local sessions
      let totals = {};
      projects.forEach(project => {
        const projectSessions = sessions.filter(s => s.projectId === project.id);
        totals[project.id] = projectSessions.reduce(
          (sum, s) => sum + (s.elapsedTime || 0), 0
        );
      });
      setProjectTotals(totals);
    }
  }, [projects, sessions]);

  // 1) Auth + attempt cache + Firestore onSnapshot
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        navigate('login');
      } else {
        setUser(currentUser);

        // Try cache
        if (loadCachedData(currentUser.uid, setProjects, setSessions, setProjectTotals)) {
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
          where('status', 'in', ['stopped', 'completed'])
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
      setLoading(false);
      setDataLoadCounter(0);
      
      // Fetch project totals only once after initial data load
      if (!Object.keys(projectTotals).length) {
        fetchProjectTotals(user.uid);
      } else {
        cacheData(user.uid, projects, sessions, projectTotals);
      }
    }
  }, [dataLoadCounter, user, projects, sessions, projectTotals, fetchProjectTotals]);

  // 3) Computed values
  const totalSessionTime = useMemo(() => {
    // If we have the accurate project totals, use them
    if (Object.keys(projectTotals).length > 0) {
      return projectTotals;
    }
    
    // Otherwise fall back to calculating from loaded sessions
    const projectTimes = {};
    projects.forEach((project) => {
      const projectSessions = sessions.filter(
        (session) => session.projectId === project.id
      );
      const sumTime = projectSessions.reduce((acc, s) => acc + (s.elapsedTime || 0), 0);
      projectTimes[project.id] = sumTime;
    });
    return projectTimes;
   }, [projects, sessions, projectTotals]);

  const totalTrackedTimeAcrossProjects = useMemo(() => {
    // If we have accurate project totals from the server, use those
    if (Object.keys(projectTotals).length > 0) {
      return Object.values(projectTotals).reduce((sum, time) => sum + time, 0);
    }
    
    // Otherwise fall back to loaded sessions
    return sessions.reduce((sum, s) => sum + (s.elapsedTime || 0), 0);
  }, [sessions, projectTotals]);


  const sortedProjects = useMemo(() => {
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
  }, [projects, sessions]);

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

  const projectChartData = useMemo(() => {
    const colors = [
        'var(--accent-color)',     // Greenish accent
        'var(--accent-purple)',    // Purple accent
        'var(--accent-pink)',      // Pink accent
        'var(--accent-orange)',    // Orange accent
        '#18A2FD',                // Blue from gradient
        '#533FF5',                // Darker Blue/Purple from gradient
    ];
    
    // Filter out projects with zero time to avoid empty pie chart segments
    const projectsWithTime = sortedProjects.filter(project => totalSessionTime[project.id] > 0);
    
    return projectsWithTime.map((project, index) => ({
      id: project.id,
      value: totalSessionTime[project.id] || 0,
      label: project.name,
      color: colors[index % colors.length], // Assign colors cyclically
    }));
  }, [sortedProjects, totalSessionTime]);

  // Create a custom tooltip renderer to match your design
  const CustomTooltip = (props) => {
    const { itemData } = props;
    if (!itemData) return null;

    // Find the project with this ID to show the project name
    const project = projects.find(p => p.id === itemData.id);
    if (!project) return null;

    // Create a colored circle with the same color as the pie slice
    const colorIndicator = (
      <div style={{
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        backgroundColor: itemData.color,
        display: 'inline-block',
        marginRight: '8px',
        verticalAlign: 'middle'
      }}></div>
    );

    return (
      <div style={{
        backgroundColor: '#494750',
        color: 'white',
        padding: '10px 15px',
        border: 'none',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
        fontFamily: 'var(--font-commit-mono)',
        display: 'flex',
        alignItems: 'center'
      }}>
        {colorIndicator} {project.name}
      </div>
    );
  };

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
      <section className="motivational-section" style={{ marginTop: '24px', marginBottom: '24px' }}>
        <div className="chart-container" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          <PieChart
             series={[{
                data: projectChartData,
                valueFormatter: (value) => formatTime(value),
                arcLabelMinAngle: 45,
                arcLabelStyle: {
                  fontSize: 14,
                  fontFamily: 'var(--font-commit-mono)',
                  fill: 'var(--text-color)',
                },
                highlightScope: { fade: 'global', highlight: 'item' },
                faded: {
                  additionalRadius: -20,
                  color: 'var(--border-color)',
                },
                innerRadius: 64, // Add inner radius for donut effect
                cornerRadius: 0, // Straight corners (no rounding)
                paddingAngle: 1, // Add small padding between slices
                startAngle: -90, // Start from top
                endAngle: 270, // Full circle
              }]}
            height={220}
            width={220}
            margin={{ top: 10, bottom: 10, left: 0, right: 0 }}
            legend={{ hidden: true }}
            slots={{
              tooltip: CustomTooltip, // Use our custom tooltip component
            }}
            slotProps={{
              legend: {
                hidden: true,
                direction: 'column',
                position: { vertical: 'middle', horizontal: 'right' },
                padding: 0,
                itemMarkWidth: 10,
                itemMarkHeight: 10,
                markGap: 3,
                itemGap: 10,
              },
            }}
            sx={{
              color: 'var(--text-color)',
              '& .MuiChartsLegend-root': {
                display: 'none',
              },
              '& .MuiPieArc-series-0': {
                stroke: 'transparent', // Remove the white stroke
                strokeWidth: 0,
              },
              // Remove white strokes from all pie arcs
              '& .MuiPieArc-root': {
                stroke: 'transparent',
                strokeWidth: 0,
              },
              // Make sure highlighted items also don't have the white stroke
              '& .MuiPieArc-highlighted': {
                stroke: 'transparent',
                strokeWidth: 0,
              },
            }}
          />
        </div>

        </section>

      <main className="homepage-content">
        <section className="projects-section">
          <div className="projects-header">
            <h2 className="projects-label">All Projects</h2>
          </div>
          {renderProjects}
        </section>
      </main>
    </div>
  );
};

export default ProjectOverviewPage;