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
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  arrayUnion,
} from 'firebase/firestore';
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
import ConfirmModal from '../components/ConfirmModal';
import { ReactComponent as SoukoLogoHeader } from '../styles/components/assets/Souko-logo-header.svg';

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
  const noteSaveTimeout = useRef(null);
  const [loading, setLoading] = useState(true);
  const [pauseEvents, setPauseEvents] = useState([]);

  // Display messages based on timer state.
  const timerQuote = useMemo(() => {
    if (timer === 0 && !isRunning) return 'This moment is yours';
    if (isRunning && !isPaused) return 'Moment in progress';
    if (isPaused) return 'Taking a moment';
    return 'This moment is yours...';
  }, [timer, isRunning, isPaused]);

  // Fetch projects and active session.
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
      if (userProjects.length > 0 && !selectedProject) {
        setSelectedProject(userProjects[0]);
      }

      const sessionsRef = collection(db, 'sessions');
      const activeSessionQuery = query(
        sessionsRef,
        where('userId', '==', uid),
        where('endTime', '==', null)
      );
      const activeSessionSnapshot = await getDocs(activeSessionQuery);
      if (!activeSessionSnapshot.empty) {
        const activeSessionDoc = activeSessionSnapshot.docs[0];
        const sessionData = activeSessionDoc.data();
        setSessionId(activeSessionDoc.id);
        const matchingProject = userProjects.find(
          (proj) => proj.name === sessionData.project
        );
        if (matchingProject) setSelectedProject(matchingProject);
        setSessionNotes(sessionData.sessionNotes || '');
        setIsBillable(
          sessionData.isBillable !== undefined ? sessionData.isBillable : true
        );
        setStartTime(sessionData.startTime);
        if (sessionData.paused) {
          setTimer(sessionData.elapsedTime || 0);
          setIsRunning(true);
          setIsPaused(true);
        } else {
          const now = Date.now();
          let sessionStartTime = sessionData.startTime?.toDate().getTime() || 0;
          const elapsedSeconds = Math.floor((now - sessionStartTime) / 1000);
          setTimer((sessionData.elapsedTime || 0) + elapsedSeconds);
          setIsRunning(true);
          setIsPaused(false);
        }
        if (sessionData.pauseEvents) setPauseEvents(sessionData.pauseEvents);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedProject]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        navigate('/');
      } else {
        setUser(currentUser);
        await fetchData(currentUser.uid);
      }
    });
    return () => unsubscribe();
  }, [navigate, fetchData]);

  // Update local timer every second.
  useEffect(() => {
    if (isRunning && !isPaused) {
      const interval = setInterval(() => setTimer((prev) => prev + 1), 1000);
      return () => clearInterval(interval);
    }
  }, [isRunning, isPaused]);

  // Sync timer with Firestore every 60 seconds using recursive setTimeout.
  useEffect(() => {
    let cancelled = false;

    const syncTimer = async () => {
      if (cancelled) return;
      if (isRunning && sessionId && !isPaused) {
        try {
          const sessionRef = doc(db, 'sessions', sessionId);
          const sessionSnap = await getDoc(sessionRef);
          if (sessionSnap.exists()) {
            const sessionData = sessionSnap.data();
            if (sessionData.startTime) {
              const serverStartTime = sessionData.startTime.toDate().getTime();
              const now = Date.now();
              const elapsedSeconds = Math.floor((now - serverStartTime) / 1000);
              setTimer(elapsedSeconds + (sessionData.elapsedTime || 0));
            }
          }
        } catch (error) {
          console.error('Timer sync error:', error);
        }
      }
      if (!cancelled) {
        setTimeout(syncTimer, 60000);
      }
    };

    syncTimer();
    return () => { cancelled = true; };
  }, [isRunning, sessionId, isPaused]);

  // Start session.
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
          projectId: selectedProject.id,
          sessionNotes,
          isBillable,
          startTime: serverTimestamp(),
          endTime: null,
          elapsedTime: 0,
          paused: false,
          status: 'running',
          pauseEvents: [],
        });
        setSessionId(sessionRef.id);
        const sessionSnap = await getDoc(sessionRef);
        setStartTime(sessionSnap.exists() ? sessionSnap.data().startTime : new Date());
      } catch (error) {
        console.error('Error starting session:', error);
      }
    }
    setTimer(0);
    setIsRunning(true);
    setIsPaused(false);
  }, [selectedProject, sessionId, user, sessionNotes, isBillable]);

  // Pause session.
  const handlePause = useCallback(async () => {
    setIsPaused(true);
    if (sessionId) {
      try {
        const sessionRef = doc(db, 'sessions', sessionId);
        const pauseEvent = { type: 'pause', timestamp: Timestamp.now() };
        await updateDoc(sessionRef, {
          elapsedTime: timer,
          paused: true,
          status: 'paused',
          pauseEvents: arrayUnion(pauseEvent),
        });
      } catch (error) {
        console.error('Error pausing session:', error);
      }
    }
  }, [sessionId, timer]);

  // Resume session.
  const handleResume = useCallback(async () => {
    setIsPaused(false);
    if (sessionId) {
      try {
        const sessionRef = doc(db, 'sessions', sessionId);
        const resumeEvent = { type: 'resume', timestamp: Timestamp.now() };
        await updateDoc(sessionRef, {
          paused: false,
          startTime: serverTimestamp(),
          status: 'running',
          pauseEvents: arrayUnion(resumeEvent),
        });
        setStartTime(new Date());
      } catch (error) {
        console.error('Error resuming session:', error);
      }
    }
    setIsRunning(true);
  }, [sessionId]);

  // Stop session.
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
        let totalPausedTimeMs = 0;
        let lastPauseTime = null;
        pauseEvents.sort((a, b) => a.timestamp.seconds - b.timestamp.seconds);
        for (const event of pauseEvents) {
          if (event.type === 'pause') {
            lastPauseTime = event.timestamp;
          } else if (event.type === 'resume' && lastPauseTime) {
            totalPausedTimeMs += event.timestamp.seconds * 1000 - lastPauseTime.seconds * 1000;
            lastPauseTime = null;
          }
        }
        const totalPausedTimeSeconds = Math.round(totalPausedTimeMs / 1000);
        await updateDoc(sessionRef, {
          elapsedTime: timer,
          endTime: serverTimestamp(),
          project: selectedProject.name,
          projectId: selectedProject.id,
          sessionNotes,
          status: 'stopped',
          pauseEvents: pauseEvents,
          totalPausedTime: totalPausedTimeSeconds,
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
    setPauseEvents([]);
  }, [navigate, sessionId, selectedProject, timer, sessionNotes, pauseEvents]);

  const cancelStopSession = useCallback(() => {
    setShowStopConfirmModal(false);
  }, []);

  // Reset session.
  const handleReset = useCallback(() => {
    if (isRunning || timer > 0) {
      setShowResetConfirmModal(true);
    }
  }, [isRunning, timer]);

  const confirmResetTimer = useCallback(async () => {
    setShowResetConfirmModal(false);
    setTimer(0);
    setIsRunning(false);
    setIsPaused(false);
    setStartTime(null);
    if (sessionId) {
      try {
        const sessionRef = doc(db, 'sessions', sessionId);
        await updateDoc(sessionRef, {
          elapsedTime: 0,
          endTime: serverTimestamp(),
        });
        setSessionId(null);
      } catch (error) {
        console.error('Error resetting session in database:', error);
      }
    } else {
      setSessionId(null);
    }
  }, [sessionId]);

  const cancelResetTimer = useCallback(() => {
    setShowResetConfirmModal(false);
  }, []);

  const handleBillableToggle = useCallback(() => {
    const newIsBillable = !isBillable;
    setIsBillable(newIsBillable);
    if (sessionId) {
      try {
        const sessionRef = doc(db, 'sessions', sessionId);
        updateDoc(sessionRef, { isBillable: newIsBillable });
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

  // Debounced note saving.
  useEffect(() => {
    if (sessionId) {
      if (noteSaveTimeout.current) clearTimeout(noteSaveTimeout.current);
      noteSaveTimeout.current = setTimeout(async () => {
        if (sessionNotes !== '') {
          try {
            const sessionRef = doc(db, 'sessions', sessionId);
            await updateDoc(sessionRef, { sessionNotes });
          } catch (error) {
            console.error('Error saving session notes:', error);
          }
        }
      }, 1000);
    }
    return () => clearTimeout(noteSaveTimeout.current);
  }, [sessionNotes, sessionId]);

  const handleNotesChange = useCallback((e) => {
    setSessionNotes(e.target.value.slice(0, 140));
  }, []);

  if (loading) {
    return (
      <div className="homepage-loading">
        <SoukoLogoHeader className="profile-pic souko-logo-header spinning-logo" />
      </div>
    );
  }

  return (
    <div className="time-tracker-page">
      <Header variant="journalOverview" showBackArrow={true} />
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
          {(isRunning || timer > 0) ? (
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
      <div className="input-tile billable-tile" onClick={handleBillableToggle} style={{ cursor: 'pointer' }}>
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
          onChange={handleNotesChange}
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
