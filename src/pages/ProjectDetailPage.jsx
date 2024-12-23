import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { formatTime } from '../utils/formatTime';
import Header from '../components/Layout/Header'; // Correct import for Header
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
        console.log("User authenticated:", user);
        setCurrentUser(user);
      } else {
        console.error("User not logged in or session expired.");
        navigate('/'); // Redirect to the login page
      }
      setLoading(false); // Stop showing the loading spinner
    });

    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const fetchProjectDetails = async () => {
      if (!currentUser) {
        console.warn("No user is logged in, skipping project fetch.");
        return;
      }

      try {
        // Fetch project details
        const projectRef = doc(db, 'projects', projectId);
        const projectSnapshot = await getDoc(projectRef);

        if (!projectSnapshot.exists()) {
          console.error("Project not found in Firestore.");
        } else if (projectSnapshot.data().userId !== currentUser.uid) {
          console.error("Project belongs to a different user.");
        } else {
          console.log("Project successfully fetched:", projectSnapshot.data());
          const projectData = projectSnapshot.data();
          setProject(projectData);

          // Debugging: Log user ID and project name
          console.log("Current user ID:", currentUser.uid);
          console.log("Query for sessions where project =", projectData.name);

          // Fetch sessions for this project based on 'project' and 'userId' fields
          const sessionsRef = collection(db, 'sessions');
          console.log("Querying sessions collection:", sessionsRef.path);

          const q = query(
            sessionsRef,
            where('project', '==', projectData.name),
            where('userId', '==', currentUser.uid) // Ensure sessions are tied to the authenticated user
          );

          const sessionsSnapshot = await getDocs(q);

          if (sessionsSnapshot.empty) {
            console.log("No sessions found for the project:", projectData.name);
          } else {
            const fetchedSessions = sessionsSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
            }));

            console.log("Fetched sessions from Firestore:", fetchedSessions);
            setSessions(fetchedSessions);

            // Calculate total time
            const totalElapsedTime = fetchedSessions.reduce((sum, session) => sum + (session.elapsedTime || 0), 0);
            setTotalTime(totalElapsedTime);
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
        title={project.name}
        showBackArrow={true}
        onBack={() => navigate('/home')}
        hideProfile={true} // Hides the profile picture and logout option
      />
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
                  <p className="session-details">
                    <strong>
                      {session.startTime && session.startTime.toDate ? 
                        session.startTime.toDate().toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric',
                        }) : 
                        "Unknown Date"}
                    </strong>
                  </p>
                  <p className="session-time">Elapsed Time: {formatTime(session.elapsedTime)}</p>
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