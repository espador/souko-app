// TimeTrackerPage.jsx
import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from 'react';
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
  Timestamp,
} from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import Header from '../components/Layout/Header'; // Assuming Header is the correct export
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
import ConfirmModal from '../components/ConfirmModal'; // Assuming ConfirmModal is the correct export

const TimeTrackerPage = React.memo(() => {
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [sessionNotes, setSessionNotes] = useState('');
  const [isBillable, setIsBillable] = useState(true);
  const [timer, setTimer] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const navigate = useNavigate();
  const timerRef = useRef(null);
  const [showStopConfirmModal, setShowStopConfirmModal] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);

  const timerQuote = useMemo(() => {
    if (timer === 0 && !isRunning) {
      return 'This moment is yours';
    } else if (isRunning && !isPaused) {
      return 'Moment in progress';
    } else if (isPaused) {
      return 'Taking a moment';
    }
    return 'This moment is yours ...'; // Default fallback
  }, [timer, isRunning, isPaused]);

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
        imageUrl: doc.data().imageUrl,
      }));
      setProjects(userProjects);
      setSelectedProject(userProjects[0] || null);

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
        setSelectedProject(
          userProjects.find((proj) => proj.name === sessionData.project) || null
        );
        setSessionNotes(sessionData.sessionNotes || '');
        setIsBillable(sessionData.isBillable || true);
        setStartTime(sessionData.startTime);
        const now = Date.now();
        const sessionStartTime =
          sessionData.startTime instanceof Timestamp
            ? sessionData.startTime.toDate().getTime()
            : 0;
        const elapsedSeconds = Math.floor((now - sessionStartTime) / 1000);
        setTimer(elapsedSeconds + (sessionData.elapsedTime || 0));
        setIsRunning(true);
        setIsPaused(false);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }, []);

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

  const handleStart = useCallback(async () => {
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
          startTime: serverTimestamp(),
          endTime: null,
          elapsedTime: 0,
        });
        setSessionId(sessionRef.id);
        setStartTime(new Date());
      } catch (error) {
        console.error('Error starting session:', error);
      }
    }
    setIsRunning(true);
    setIsPaused(false);
  }, [selectedProject, sessionId, user, sessionNotes, isBillable]);

  const handlePause = useCallback(async () => {
    setIsPaused(true);
    if (sessionId) {
      try {
        const sessionRef = doc(db, 'sessions', sessionId);
        await updateDoc(sessionRef, { elapsedTime: timer });
      } catch (error) {
        console.error('Error pausing session:', error);
      }
    }
  }, [sessionId, timer]);

  const handleResume = useCallback(() => {
    setIsPaused(false);
    setIsRunning(true);
  }, []);

  const handleStop = useCallback(() => {
    setShowStopConfirmModal(true);
  }, []);

  const confirmStopSession = useCallback(async () => {
    setShowStopConfirmModal(false);
    setIsRunning(false);
    setIsPaused(false);

    if (sessionId && selectedProject) {
      try {
        const sessionRef = doc(db, 'sessions', sessionId);
        await updateDoc(sessionRef, {
          elapsedTime: timer,
          endTime: serverTimestamp(),
          project: selectedProject.name,
        });
      } catch (error) {
        console.error('Error stopping session:', error);
      }
    } else {
      console.warn('Session ID or selected project not available during stop.');
    }
    localStorage.setItem('lastProjectId', selectedProject?.id || '');
    navigate('/session-overview', {
      state: { totalTime: timer, projectId: selectedProject?.id },
    });
    setTimer(0);
    setSelectedProject(null);
    setSessionNotes('');
    setIsBillable(true);
    setSessionId(null);
    setStartTime(null);
  }, [navigate, sessionId, selectedProject, timer]);

  const cancelStopSession = useCallback(() => {
    setShowStopConfirmModal(false);
  }, []);

  const handleReset = useCallback(() => {
    if (isRunning || timer > 0) {
      setShowResetConfirmModal(true);
    }
  }, [isRunning, timer]);

  const confirmResetTimer = useCallback(() => {
    setShowResetConfirmModal(false);
    setTimer(0);
    setIsRunning(false);
    setIsPaused(false);
    setSessionId(null);
    setStartTime(null);
  }, []);

  const cancelResetTimer = useCallback(() => {
    setShowResetConfirmModal(false);
  }, []);

  const handleBillableToggle = useCallback(async () => {
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
  }, [isBillable, sessionId]);

  const handleProjectChange = useCallback(
    (e) => {
      const projectName = e.target.value;
      const selectedProj = projects.find((proj) => proj.name === projectName);
      setSelectedProject(selectedProj);
    },
    [projects]
  );

  return (
    <div className="time-tracker-page">
      <Header showBackArrow={true} onBack={() => navigate('/home')} hideProfile={true} />
      <div className="timer-quote">{timerQuote}</div>
      <div ref={timerRef} className={`timer ${isPaused ? 'paused' : ''}`}>
        {new Date(timer * 1000).toISOString().substr(11, 8)}
      </div>
      <div className="controls">
        <button
          className="control-button small"
          onClick={handleReset}
          disabled={!(isRunning || timer > 0)}
        >
          {isRunning || timer > 0 ? (
            <ResetActiveIcon style={{ width: '32px', height: '32px', fill: 'var(--text-color)' }} />
          ) : (
            <ResetMuteIcon style={{ width: '32px', height: '32px', fill: 'var(--text-muted)' }} />
          )}
        </button>
        <button
          className="control-button fab-like"
          onClick={isRunning ? handleStop : handleStart}
        >
          {isRunning ? (
            <StopTimerIcon style={{ width: '64px', height: '64px' }} />
          ) : (
            <StartTimerIcon style={{ width: '64px', height: '64px' }} />
          )}
        </button>
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
          onChange={handleProjectChange}
        >
          {projects.map((project) => (
            <option key={project.id} value={project.name}>
              {project.name}
            </option>
          ))}
        </select>
        <DropdownIcon className="dropdown-arrow" />
      </div>
      <div className="input-tile billable-tile" onClick={handleBillableToggle}>
        <span className="input-label billable-label">
          {isBillable ? 'Billable' : 'Non-billable'}
        </span>
        <div className="billable-radio">
          {isBillable ? <RadioActiveIcon /> : <RadioMutedIcon />}
        </div>
      </div>
      <div className="input-tile notes-input-tile">
        <textarea
          id="session-notes"
          className="notes-textarea"
          placeholder="Take a moment to note"
          value={sessionNotes}
          onChange={(e) => setSessionNotes(e.target.value.slice(0, 140))}
          onBlur={() => {
            timerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        />
        <EditIcon className="notes-edit-icon" style={{ position: 'absolute', top: '16px', right: '16px' }} />
      </div>
      <ConfirmModal
        show={showStopConfirmModal}
        onHide={cancelStopSession}
        title="Stop Timer Session?"
        body="Do you want to save this session?"
        onConfirm={confirmStopSession}
        confirmText="Yes, Stop & Save"
        cancelText="Cancel"
      />
      <ConfirmModal
        show={showResetConfirmModal}
        onHide={cancelResetTimer}
        title="Reset Timer?"
        body="Are you sure you want to reset the timer? Any unsaved progress will be lost."
        onConfirm={confirmResetTimer}
        confirmText="Yes, Reset"
        cancelText="Cancel"
      />
    </div>
  );
});

TimeTrackerPage.displayName = 'TimeTrackerPage';

export default TimeTrackerPage;