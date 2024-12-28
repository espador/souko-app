// TimeTrackingPage.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore'; // Import Timestamp
import { db, auth } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import Header from '../components/Layout/Header';
import '../styles/global.css';
import '../styles/components/TimeTrackerPage.css';
import { ReactComponent as ResetMuteIcon } from '../styles/components/assets/reset-mute.svg';
import { ReactComponent as ResetActiveIcon } from '../styles/components/assets/reset-active.svg';
import { ReactComponent as PauseIcon } from '../styles/components/assets/pause.svg';
import { ReactComponent as PlayIcon } from '../styles/components/assets/play.svg';
import { ReactComponent as StopTimerIcon } from '../styles/components/assets/stop-timer.svg';
import { ReactComponent as StartTimerIcon } from '../styles/components/assets/start-timer.svg';
import { ReactComponent as EditIcon } from '../styles/components/assets/edit.svg';
import { ReactComponent as DropdownIcon } from '../styles/components/assets/dropdown.svg';
import { ReactComponent as RadioActiveIcon } from '../styles/components/assets/radio-active.svg';
import { ReactComponent as RadioMutedIcon } from '../styles/components/assets/radio-muted.svg';
import '@fontsource/shippori-mincho';

const TimeTrackerPage = () => {
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null); // Initialize as null
  const [sessionNotes, setSessionNotes] = useState('');
  const [isBillable, setIsBillable] = useState(true);
  const [timer, setTimer] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const navigate = useNavigate();

  // Dynamic quote state
  const [timerQuote, setTimerQuote] = useState('This moment is yours ...');

  // Make the page unscrollable
  useEffect(() => {
    document.body.classList.add('no-scroll');
    document.documentElement.classList.add('no-scroll');

    return () => {
      document.body.classList.remove('no-scroll');
      document.documentElement.classList.remove('no-scroll');
    };
  }, []);

  useEffect(() => {
    if (timer === 0 && !isRunning) {
      setTimerQuote('This moment is yours');
    } else if (isRunning && !isPaused) {
      setTimerQuote('Moment in progress');
    } else if (isPaused) {
      setTimerQuote('Taking a moment');
    }
  }, [timer, isRunning, isPaused]);

  // Fetch user and projects
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
  }, [navigate]);

  const fetchData = useCallback(async (uid) => {
    try {
      const projectsRef = collection(db, 'projects');
      const projectQuery = query(projectsRef, where('userId', '==', uid));
      const projectSnapshot = await getDocs(projectQuery);
      const userProjects = projectSnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name,
        imageUrl: doc.data().imageUrl, // Fetch imageUrl
      }));
      setProjects(userProjects);

      // Prefill with the most recent project object
      if (userProjects.length > 0) {
        setSelectedProject(userProjects[0]);
      }

      const sessionRef = collection(db, 'sessions');
      const activeSessionQuery = query(
        sessionRef,
        where('userId', '==', uid),
        where('endTime', '==', null)
      );
      const activeSessionSnapshot = await getDocs(activeSessionQuery);

      if (!activeSessionSnapshot.empty) {
        const activeSession = activeSessionSnapshot.docs[0];
        const sessionData = activeSession.data();
        setSessionId(activeSession.id);
        setSelectedProject(userProjects.find(proj => proj.name === sessionData.project) || null);
        setSessionNotes(sessionData.sessionNotes || '');
        setIsBillable(sessionData.isBillable || true);

        // Keep startTime as a Timestamp object
        setStartTime(sessionData.startTime);
        const now = Date.now();
        // Ensure sessionData.startTime is a Timestamp before calling toDate()
        const sessionStartTime = sessionData.startTime instanceof Timestamp ? sessionData.startTime.toDate().getTime() : 0;
        const elapsedSeconds = Math.floor((now - sessionStartTime) / 1000);
        setTimer(elapsedSeconds + (sessionData.elapsedTime || 0));
        setIsRunning(true);
        setIsPaused(false);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }, []);

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
          project: selectedProject.name,
          sessionNotes,
          isBillable,
          startTime: serverTimestamp(), // Use serverTimestamp() here
          endTime: null,
          elapsedTime: 0,
        });
        setSessionId(sessionRef.id);
        setStartTime(new Date()); // Keep track of start time locally as a Date object
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
          endTime: serverTimestamp(),
        });
      } catch (error) {
        console.error('Error stopping session:', error);
      }
    }

    setTimer(0);
    setSelectedProject(null);
    setSessionNotes('');
    setIsBillable(true);
    setSessionId(null);
    setStartTime(null); // Reset local start time
    navigate('/home');
  };

  const handleReset = () => {
    if (isRunning || timer > 0) {
      const confirmReset = window.confirm('Are you sure you want to reset the timer? Any unsaved progress will be lost.');
      if (confirmReset) {
        setTimer(0);
        setIsRunning(false);
        setIsPaused(false);
        setSessionId(null);
        setStartTime(null);
      }
    }
  };

  const handleBillableToggle = async () => {
    const newIsBillable = !isBillable;
    setIsBillable(newIsBillable);
    if (sessionId) {
      try {
        const sessionRef = doc(db, 'sessions', sessionId);
        await updateDoc(sessionRef, { isBillable: newIsBillable });
      } catch (error) {
        console.error('Error updating billable status:', error);
      }
    }
  };

  return (
    <div className="time-tracker-page">
      <Header
        showBackArrow={true}
        onBack={() => navigate('/home')}
        hideProfile={true} // You can remove this, or set it to false
      />

      <div className="timer-quote">{timerQuote}</div>

      <div className={`timer ${isPaused ? 'paused' : ''}`}>{
        new Date(timer * 1000).toISOString().substr(11, 8) /* Display time in HH:MM:SS format */
      }</div>

      <div className="controls">
        {/* Reset Button */}
        <button className="control-button small" onClick={handleReset} disabled={!(isRunning || timer > 0)}>
          {isRunning || timer > 0 ? (
            <ResetActiveIcon style={{ width: '32px', height: '32px', fill: 'var(--text-color)' }} />
          ) : (
            <ResetMuteIcon style={{ width: '32px', height: '32px', fill: 'var(--text-muted)' }} />
          )}
        </button>

        {/* Start/Stop Button */}
        <button className="control-button fab-like" onClick={isRunning ? handleStop : handleStart}>
          {isRunning ? (
            <StopTimerIcon style={{ width: '64px', height: '64px' }} />
          ) : (
            <StartTimerIcon style={{ width: '64px', height: '64px' }} />
          )}
        </button>

        {/* Pause/Play Button */}
        <button
          className="control-button small"
          onClick={isRunning && !isPaused ? handlePause : isPaused ? handleResume : undefined}
        >
          {isRunning && !isPaused ? (
            <PauseIcon style={{ width: '32px', height: '32px', fill: 'var(--text-muted)' }} />
          ) : timer === 0 ? (
            <PauseIcon style={{ width: '32px', height: '32px', fill: 'var(--text-muted)' }} />
          ) : (
            <PlayIcon style={{ width: '32px', height: '32px', fill: 'var(--text-color)' }} />
          )}
        </button>
      </div>
      <h2 className="projects-label">Details</h2>
      <div className="project-dropdown-container">
        {selectedProject?.imageUrl ? (
          <img
            src={selectedProject.imageUrl}
            alt={selectedProject.name}
            className="dropdown-project-image"
          />
        ) : selectedProject?.name ? (
          <div className="dropdown-default-image">
            {selectedProject.name.charAt(0).toUpperCase()}
          </div>
        ) : null}
        <select
          className="project-dropdown"
          value={selectedProject?.name || ''}
          onChange={(e) => {
            const projectName = e.target.value;
            const selectedProj = projects.find(proj => proj.name === projectName);
            setSelectedProject(selectedProj);
          }}
        >
          {projects.map((project) => (
            <option key={project.id} value={project.name}>
              {project.name}
            </option>
          ))}
        </select>
        <DropdownIcon className="dropdown-arrow" />
      </div>

      <div className="input-tile billable-tile" onClick={handleBillableToggle} style={{ cursor: 'pointer' }}>
        <span className="input-label billable-label">
          {isBillable ? 'Billable' : 'Non-billable'}
        </span>
        <div className="billable-radio">
          {isBillable ? (
            <RadioActiveIcon />
          ) : (
            <RadioMutedIcon />
          )}
        </div>
      </div>

      <div className="input-tile notes-input-tile">
        <textarea
          id="session-notes"
          className="notes-textarea"
          placeholder="Take a moment to note"
          value={sessionNotes}
          onChange={(e) => setSessionNotes(e.target.value.slice(0, 140))}
        />
        <EditIcon className="notes-edit-icon" style={{ position: 'absolute', top: '16px', right: '16px' }} />
      </div>
    </div>
  );
};

export default TimeTrackerPage;