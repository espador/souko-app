import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { formatTime } from '../utils/formatTime';

const TimeTrackerPage = () => {
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');
  const [isBillable, setIsBillable] = useState(true);
  const [timer, setTimer] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        navigate('/');
      } else {
        setUser(currentUser);

        try {
          // Fetch projects with only necessary fields
          const projectsRef = collection(db, 'projects');
          const projectQuery = query(projectsRef, where('userId', '==', currentUser.uid));
          const projectSnapshot = await getDocs(projectQuery);
          setProjects(
            projectSnapshot.docs.map((doc) => ({ id: doc.id, name: doc.data().name }))
          );

          // Check for an active session
          const sessionRef = collection(db, 'sessions');
          const activeSessionQuery = query(
            sessionRef,
            where('userId', '==', currentUser.uid),
            where('endTime', '==', null)
          );
          const activeSessionSnapshot = await getDocs(activeSessionQuery);

          if (!activeSessionSnapshot.empty) {
            const activeSession = activeSessionSnapshot.docs[0];
            const sessionData = activeSession.data();
            setSessionId(activeSession.id);
            setSelectedProject(sessionData.project || '');
            setSessionNotes(sessionData.sessionNotes || '');
            setIsBillable(sessionData.isBillable || true);

            // Calculate elapsed time
            const now = Date.now();
            const sessionStartTime = sessionData.startTime?.toDate().getTime() || 0;
            setStartTime(sessionStartTime);
            const elapsedSeconds = Math.floor((now - sessionStartTime) / 1000);
            setTimer(elapsedSeconds + (sessionData.elapsedTime || 0));
            setIsRunning(true);
            setIsPaused(false);
          }
        } catch (error) {
          console.error('Error fetching data:', error);
        }
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    let interval = null;
    if (isRunning && !isPaused) {
      interval = setInterval(() => {
        setTimer((prevTime) => prevTime + 1);
      }, 1000);
    } else if (!isRunning || isPaused) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isRunning, isPaused]);

  const handleStart = async () => {
    if (!selectedProject) {
      alert('Please select a project to start the timer.');
      return;
    }

    if (!sessionId) {
      try {
        // Create a new session
        const sessionRef = doc(collection(db, 'sessions')); // Auto-generate document ID
        await setDoc(sessionRef, {
          userId: user.uid, // Include authenticated user's UID
          project: selectedProject,
          sessionNotes,
          isBillable,
          startTime: serverTimestamp(),
          endTime: null, // Session is active
          elapsedTime: 0,
        });
        setSessionId(sessionRef.id);
        setStartTime(Date.now());
      } catch (error) {
        console.error('Error starting session:', error);
      }
    }

    setIsRunning(true);
    setIsPaused(false);
  };

  const handlePause = async () => {
    setIsPaused(true);

    if (sessionId) {
      try {
        const sessionRef = doc(db, 'sessions', sessionId);
        await updateDoc(sessionRef, { elapsedTime: timer });
      } catch (error) {
        console.error('Error pausing session:', error);
      }
    }
  };

  const handleResume = () => {
    setIsPaused(false);
    setIsRunning(true);
  };

  const handleStop = async () => {
    const confirmSave = window.confirm('Do you want to save this session?');
    if (!confirmSave) return;

    setIsRunning(false);
    setIsPaused(false);

    if (sessionId) {
      try {
        const sessionRef = doc(db, 'sessions', sessionId);
        await updateDoc(sessionRef, {
          elapsedTime: timer,
          endTime: Date.now(),
        });
      } catch (error) {
        console.error('Error stopping session:', error);
      }
    }

    alert('Session saved successfully!');
    setTimer(0);
    setSelectedProject('');
    setSessionNotes('');
    setIsBillable(true);
    setSessionId(null);
    navigate('/home');
  };

  const handleReset = () => {
    setTimer(0);
    setIsRunning(false);
    setIsPaused(false);
    setSessionId(null);
    setStartTime(null);
  };

  return (
    <div style={styles.container}>
      {/* Timer and functional buttons */}
      <div style={styles.timer}>
        <h2>{formatTime(timer)}</h2>
        <div style={styles.controls}>
          <button
            style={styles.button}
            onClick={handleReset}
            disabled={!isRunning && timer === 0}
          >
            🔄 Reset
          </button>

          {isRunning ? (
            <button style={styles.button} onClick={handleStop}>
              ■ Stop
            </button>
          ) : (
            <button style={styles.button} onClick={handleStart}>
              ▶ Start
            </button>
          )}

          {isRunning && !isPaused ? (
            <button style={styles.button} onClick={handlePause}>
              || Pause
            </button>
          ) : isPaused ? (
            <button style={styles.button} onClick={handleResume}>
              ▶ Resume
            </button>
          ) : (
            <button style={styles.button} disabled>
              || Pause
            </button>
          )}
        </div>
      </div>

      <div style={styles.dropdown}>
        <label>
          Select Project:
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            style={styles.select}
          >
            <option value="">-- Select a Project --</option>
            {projects.map((project) => (
              <option key={project.id} value={project.name}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={styles.billable}>
        <label>
          <span>Billable:</span>
          <input
            type="checkbox"
            checked={isBillable}
            onChange={() => setIsBillable(!isBillable)}
            style={styles.toggle}
          />
        </label>
      </div>

      <div style={styles.notes}>
        <label>
          Session Notes:
          <textarea
            value={sessionNotes}
            onChange={(e) => setSessionNotes(e.target.value)}
            style={styles.textarea}
          />
        </label>
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '20px',
    textAlign: 'center',
    backgroundColor: '#1E1E2C',
    color: '#fff',
    fontFamily: 'Arial, sans-serif',
  },
  timer: {
    fontSize: '3rem',
    marginBottom: '20px',
  },
  controls: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '20px',
  },
  button: {
    padding: '10px 20px',
    margin: '0 5px',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    backgroundColor: '#4CAF50',
  },
  dropdown: {
    margin: '20px 0',
  },
  select: {
    padding: '10px',
    fontSize: '16px',
  },
  billable: {
    margin: '20px 0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
  },
  toggle: {
    width: '20px',
    height: '20px',
  },
  notes: {
    margin: '20px 0',
  },
  textarea: {
    width: '100%',
    height: '60px',
    padding: '10px',
    fontSize: '16px',
  },
};

export default TimeTrackerPage;
