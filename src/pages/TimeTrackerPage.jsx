import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { formatTime } from '../utils/formatTime';
import Header from '../components/Layout/Header'; // Corrected import
import '../styles/global.css';
import '../styles/components/TimeTrackerPage.css';

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

  // Fetch user and projects
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        navigate('/');
      } else {
        setUser(currentUser);

        try {
          const projectsRef = collection(db, 'projects');
          const projectQuery = query(projectsRef, where('userId', '==', currentUser.uid));
          const projectSnapshot = await getDocs(projectQuery);
          setProjects(
            projectSnapshot.docs.map((doc) => ({ id: doc.id, name: doc.data().name }))
          );

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

  // Timer logic
  useEffect(() => {
    let interval = null;
    if (isRunning && !isPaused) {
      interval = setInterval(() => {
        setTimer((prevTime) => prevTime + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isRunning, isPaused]);

  // Handlers
  const handleStart = async () => {
    if (!selectedProject) {
      alert('Please select a project to start the timer.');
      return;
    }

    if (!sessionId) {
      try {
        const sessionRef = doc(collection(db, 'sessions'));
        await setDoc(sessionRef, {
          userId: user.uid,
          project: selectedProject,
          sessionNotes,
          isBillable,
          startTime: serverTimestamp(),
          endTime: null,
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
    <div className="tracker-container">
      <Header
  showBackArrow={true}
  onBack={() => navigate('/home')}
  title="Time Tracker"
  hideProfile={true} // Hides the profile picture and logout option
/>
      <div className="timer">
        <h2>{formatTime(timer)}</h2>
      </div>
      <div className="controls">
        <button className="button" onClick={handleReset} disabled={!isRunning && timer === 0}>
          🔄 Reset
        </button>
        {isRunning ? (
          <button className="button" onClick={handleStop}>
            ■ Stop
          </button>
        ) : (
          <button className="button" onClick={handleStart}>
            ▶ Start
          </button>
        )}
        {isRunning && !isPaused ? (
          <button className="button" onClick={handlePause}>
            || Pause
          </button>
        ) : isPaused ? (
          <button className="button" onClick={handleResume}>
            ▶ Resume
          </button>
        ) : (
          <button className="button" disabled>
            || Pause
          </button>
        )}
      </div>
      <div className="dropdown">
        <label>
          Select Project:
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="select"
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
      <div className="billable">
        <label>
          <span>Billable:</span>
          <input
            type="checkbox"
            checked={isBillable}
            onChange={() => setIsBillable(!isBillable)}
            className="toggle"
          />
        </label>
      </div>
      <div className="notes">
        <label>
          Session Notes:
          <textarea
            value={sessionNotes}
            onChange={(e) => setSessionNotes(e.target.value)}
            className="textarea"
          />
        </label>
      </div>
    </div>
  );
};

export default TimeTrackerPage;
