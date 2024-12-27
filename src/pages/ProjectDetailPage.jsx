import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { formatTime } from '../utils/formatTime';
import Header from '../components/Layout/Header';
import '../styles/global.css';
import '../styles/components/ProjectDetailPage.css';
import { Timestamp } from 'firebase/firestore'; // Import Timestamp

const ProjectDetailPage = () => {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [totalTime, setTotalTime] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Add the 'allow-scroll' class to the body when the component mounts
    document.body.classList.add('allow-scroll');

    // Remove the 'allow-scroll' class when the component unmounts
    return () => {
      document.body.classList.remove('allow-scroll');
    };
  }, []); // Empty dependency array ensures this runs only on mount and unmount

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

  useEffect(() => {
    const fetchProjectDetails = async () => {
      if (!currentUser) return;

      try {
        const projectRef = doc(db, 'projects', projectId);
        const projectSnapshot = await getDoc(projectRef);

        if (!projectSnapshot.exists()) {
          console.error("Project not found in Firestore.");
        } else if (projectSnapshot.data().userId !== currentUser.uid) {
          console.error("Project belongs to a different user.");
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

          if (!sessionsSnapshot.empty) {
            const fetchedSessions = sessionsSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
            }));
            setSessions(fetchedSessions);
            const totalElapsedTime = fetchedSessions.reduce((sum, session) => sum + (session.elapsedTime || 0), 0);
            setTotalTime(totalElapsedTime);
          } else {
            console.log("No sessions found for the project:", projectData.name);
          }
        }
      } catch (error) {
        console.error("Error fetching project or sessions:", error);
      } finally {
        setLoading(false);
      }
    };

    if (projectId && currentUser) {
      fetchProjectDetails();
    }
  }, [projectId, currentUser]);

  // Group sessions by date, most recent first
  const sessionsByDate = sessions.reduce((acc, session) => {
    let date;
    console.log(`Session ID: ${session.id}, startTime type: ${typeof session.startTime}, startTime value:`, session.startTime);
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
      return new Date(b) - new Date(a); // Sort dates in descending order (most recent first)
    } catch (error) {
      console.error("Error comparing dates:", error);
      return 0;
    }
  });

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
      <div className="project-header">
        <div className="project-icon">
          <span>{project.name[0]}</span>
        </div>
        <h1 className="project-title">{project.name}</h1>
        <p className="total-time">Total Time: {formatTime(totalTime)}</p>
      </div>

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
                  <li key={session.id} className="session-item">
                    <div className="session-details">
                      <p className="session-time">Elapsed Time: {formatTime(session.elapsedTime)}</p>
                      {session.isBillable && <p className="billable">Billable</p>}
                      {session.sessionNotes && <p className="notes">Notes: {session.sessionNotes}</p>}
                    </div>
                  </li>
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