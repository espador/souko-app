import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { formatTime } from '../utils/formatTime';

const ProjectDetailPage = () => {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [totalTime, setTotalTime] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Track the current authenticated user
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
        console.log(`Fetching project with ID: ${projectId}`);

        // Fetch the project with userId validation
        const projectRef = doc(db, 'projects', projectId);
        const projectSnapshot = await getDoc(projectRef);

        if (projectSnapshot.exists() && projectSnapshot.data().userId === currentUser.uid) {
          const projectData = projectSnapshot.data();
          console.log('Project found:', projectData);
          setProject({ id: projectSnapshot.id, name: projectData.name });

          // Add userId filter to session query
          const sessionQuery = query(
            collection(db, 'sessions'),
            where('project', '==', projectData.name),
            where('userId', '==', currentUser.uid), // Match user's sessions
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
          console.error('Project not found or user does not have access.');
          setProject(null);
        }
      } catch (error) {
        console.error('Error fetching project details:', error.message);
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
    return <p>Loading project details...</p>;
  }

  if (!project) {
    return (
      <div style={styles.container}>
        <h1>Project not found</h1>
        <button style={styles.button} onClick={() => navigate('/home')}>
          Return to Homepage
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header Section */}
      <button style={styles.backButton} onClick={() => navigate('/home')}>
        ⬅
      </button>
      <div style={styles.header}>
        <div style={styles.projectIcon}>
          <span>{project.name[0]}</span>
        </div>
        <h1 style={styles.projectTitle}>{project.name}</h1>
        <p style={styles.totalTime}>Total Time: {formatTime(totalTime)}</p>
      </div>

      {/* Session History */}
      <div style={styles.sessionsContainer}>
        <h2>Sessions</h2>
        {sessions.length > 0 ? (
          <ul style={styles.sessionsList}>
            {sessions.map((session) => (
              <li key={session.id} style={styles.sessionItem}>
                <div>
                  <p>
                    <strong>{new Date(session.startTime).toLocaleDateString()}</strong>
                  </p>
                  <p>Elapsed Time: {formatTime(session.elapsedTime)}</p>
                  {session.isBillable && <p style={styles.billable}>Billable</p>}
                  {session.sessionNotes && <p style={styles.notes}>Notes: {session.sessionNotes}</p>}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p>No sessions tracked for this project yet.</p>
        )}
      </div>
      <button style={styles.button} onClick={() => navigate('/home')}>
        Return to Homepage
      </button>
    </div>
  );
};

const styles = {
  container: {
    padding: '20px',
    backgroundColor: '#1E1E2C',
    color: '#FFFFFF',
    minHeight: '100vh',
    fontFamily: 'Arial, sans-serif',
  },
  backButton: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#FFFFFF',
    fontSize: '18px',
    cursor: 'pointer',
    marginBottom: '20px',
  },
  header: {
    textAlign: 'center',
    marginBottom: '30px',
  },
  projectIcon: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    backgroundColor: '#4285F4',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    margin: '0 auto',
    fontSize: '32px',
    color: '#FFFFFF',
  },
  projectTitle: {
    fontSize: '24px',
    marginTop: '10px',
  },
  totalTime: {
    fontSize: '20px',
    color: '#4CAF50',
  },
  sessionsContainer: {
    marginTop: '20px',
  },
  sessionsList: {
    listStyle: 'none',
    padding: 0,
  },
  sessionItem: {
    backgroundColor: '#292A33',
    padding: '10px',
    borderRadius: '5px',
    marginBottom: '10px',
  },
  billable: {
    color: '#FFD700',
    fontSize: '12px',
    fontStyle: 'italic',
  },
  notes: {
    color: '#FFFFFF',
    fontSize: '12px',
    fontStyle: 'italic',
    marginTop: '5px',
  },
  button: {
    marginTop: '20px',
    padding: '10px 20px',
    backgroundColor: '#4285F4',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
  },
};

export default ProjectDetailPage;
