import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { formatTime } from '../utils/formatTime';
import '../styles/global.css'; // Global styles
import '../styles/components/ProjectDetailPage.css'; // Specific styles for ProjectDetailPage

const ProjectDetailPage = () => {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [totalTime, setTotalTime] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        navigate('/'); // Redirect to the homepage if the user is not authenticated
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const fetchProjectDetails = async () => {
      if (!currentUser) return;

      try {
        const projectRef = doc(db, 'projects', projectId);
        const projectSnapshot = await getDoc(projectRef);

        if (projectSnapshot.exists() && projectSnapshot.data().userId === currentUser.uid) {
          const projectData = projectSnapshot.data();
          setProject({ id: projectSnapshot.id, name: projectData.name });

          const sessionQuery = query(
            collection(db, 'sessions'),
            where('project', '==', projectData.name),
            where('userId', '==', currentUser.uid),
            limit(20)
          );
          const sessionSnapshot = await getDocs(sessionQuery);
          const fetchedSessions = sessionSnapshot.docs.map((doc) => ({
            id: doc.id,
            elapsedTime: doc.data().elapsedTime || 0,
            startTime: doc.data().startTime,
            isBillable: doc.data().isBillable || false,
            sessionNotes: doc.data().sessionNotes || '',
          }));
          setSessions(fetchedSessions);

          const totalElapsedTime = fetchedSessions.reduce(
            (total, session) => total + (session.elapsedTime || 0),
            0
          );
          setTotalTime(totalElapsedTime);
        } else {
          setProject(null);
        }
      } catch (error) {
        setProject(null);
      } finally {
        setLoading(false);
      }
    };

    if (projectId) {
      fetchProjectDetails();
    }
  }, [projectId, currentUser]);

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
      <button className="back-button" onClick={() => navigate('/home')}>
        ⬅
      </button>
      <div className="project-header">
        <div className="project-icon">
          <span>{project.name[0]}</span>
        </div>
        <h1 className="project-title">{project.name}</h1>
        <p className="total-time">Total Time: {formatTime(totalTime)}</p>
      </div>

      <div className="sessions-container">
        <h2>Sessions</h2>
        {sessions.length > 0 ? (
          <ul className="sessions-list">
            {sessions.map((session) => (
              <li key={session.id} className="session-item">
                <div>
                  <p>
                    <strong>{new Date(session.startTime).toLocaleDateString()}</strong>
                  </p>
                  <p>Elapsed Time: {formatTime(session.elapsedTime)}</p>
                  {session.isBillable && <p className="billable">Billable</p>}
                  {session.sessionNotes && <p className="notes">Notes: {session.sessionNotes}</p>}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p>No sessions tracked for this project yet.</p>
        )}
      </div>
      <button className="button" onClick={() => navigate('/home')}>
        Return to Homepage
      </button>
    </div>
  );
};

export default ProjectDetailPage;
