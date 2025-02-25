import { v4 as uuidv4 } from 'uuid'; // Import UUID generator
import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from 'react';
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
  onSnapshot,
  runTransaction,
} from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import Header from '../components/Layout/Header';
import Sidebar from '../components/Layout/Sidebar';
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

// Helper: Monday-based week start
function getMondayOfCurrentWeek() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const day = (now.getDay() + 6) % 7;
  now.setDate(now.getDate() - day);
  return now.getTime();
}

// Helper: Persist Instance ID
const getInstanceId = () => {
  let id = localStorage.getItem('timeTrackerInstanceId');
  if (!id) {
    id = `${Date.now()}-${Math.random()}`;
    localStorage.setItem('timeTrackerInstanceId', id);
  }
  return id;
};

const TimeTrackerPage = React.memo(({ navigate }) => {
  console.log('TimeTrackerPage component rendered');

  // Component state
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [sessionNotes, setSessionNotes] = useState('');
  const [isBillable, setIsBillable] = useState(true);
  const [timer, setTimer] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [pauseEvents, setPauseEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Timer sync states
  const [baseElapsedTime, setBaseElapsedTime] = useState(0);
  const [sessionClientStartTime, setSessionClientStartTime] = useState(null);

  // Instance locking state
  const [activeInstanceId, setActiveInstanceId] = useState(null);
  const [conflictModalVisible, setConflictModalVisible] = useState(false);
  const instanceId = useMemo(() => getInstanceId(), []);

  // Sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const timerRef = useRef(null);
  const noteSaveTimeout = useRef(null);
  const [showStopConfirmModal, setShowStopConfirmModal] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);

  const timerQuote = useMemo(() => {
    if (timer === 0 && !isRunning) return 'This moment is yours';
    if (isRunning && !isPaused) return 'Moment in progress';
    if (isPaused) return 'Taking a moment';
    return 'This moment is yours...';
  }, [timer, isRunning, isPaused]);

  // --- Sign Out Handler ---
  const handleSignOut = useCallback(async () => {
    try {
      if (sessionId) {
        const sessionRef = doc(db, 'sessions', sessionId);
        await updateDoc(sessionRef, {
          activeInstanceId: null,
          endTime: serverTimestamp(),
          status: 'signedOut',
        });
      }
      await signOut(auth);
      navigate('login');
    } catch (error) {
      console.error('Error during sign out:', error);
    }
  }, [sessionId, navigate]);

  /**
   * fetchData: Fetch projects and check for an active session once on login
   */
  const fetchData = useCallback(async (uid) => {
    try {
      // 1) Get user projects
      const projectsRef = collection(db, 'projects');
      const projectQuery = query(projectsRef, where('userId', '==', uid));
      const projectSnapshot = await getDocs(projectQuery);

      const userProjects = projectSnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name,
        imageUrl: doc.data().imageUrl,
        lastTrackedTime: doc.data().lastTrackedTime,
      }));
      setProjects(userProjects);

      if (userProjects.length > 0 && !selectedProject) {
        setSelectedProject(userProjects[0]);
      }

      // 2) Check if there's an existing active session
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

        // Sync sessionNotes
        setSessionNotes(sessionData.sessionNotes || '');

        // Billable
        setIsBillable(
          sessionData.isBillable !== undefined ? sessionData.isBillable : true
        );

        // Running/paused states
        if (sessionData.paused) {
          // If paused, local timer is whatever Firestore had
          setTimer(sessionData.elapsedTime || 0);
          setIsRunning(true);
          setIsPaused(true);
        } else {
          // If not paused, we show "running"
          setIsRunning(true);
          setIsPaused(false);
        }
        if (sessionData.pauseEvents) {
          setPauseEvents(sessionData.pauseEvents);
        }

        // Project selection
        const matchingProject = userProjects.find(
          (proj) => proj.name === sessionData.project
        );
        if (matchingProject) {
          setSelectedProject(matchingProject);
        }

        // Token check on page load
        const localSessionToken = localStorage.getItem('sessionToken');
        const firestoreSessionToken = sessionData.activeToken;
        if (firestoreSessionToken) {
          if (!localSessionToken) {
            // First time on this device for this session
            localStorage.setItem('sessionToken', firestoreSessionToken);
          } else if (localSessionToken !== firestoreSessionToken) {
            // Conflict => another device is active
            setConflictModalVisible(true);
          }
        } else if (localSessionToken) {
          // Firestore missing a token, but local has one => mismatch
          console.warn(
            'Firestore session token missing but local token exists. Clearing local token.'
          );
          localStorage.removeItem('sessionToken');
        }
      } else {
        // No active session
        setSessionId(null);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedProject]);

  /**
   * On AuthStateChanged => fetch projects & active session once
   */
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        navigate('login');
      } else {
        setUser(currentUser);
        await fetchData(currentUser.uid);
      }
    });
    return () => unsubscribeAuth();
    // Removed fetchData from deps to avoid re-runs.
    // We only want to fetch once per login.
  }, [navigate]);

  /**
   * Local ticking timer (1 second intervals) if session is running
   */
  useEffect(() => {
    let interval;
    if (sessionClientStartTime) {
      interval = setInterval(() => {
        const now = Date.now();
        let elapsedSeconds = Math.floor((now - sessionClientStartTime) / 1000);
        elapsedSeconds = Math.max(0, elapsedSeconds);
        setTimer(baseElapsedTime + elapsedSeconds);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [sessionClientStartTime, baseElapsedTime]);

  /**
   * Real-time listener for session changes: conflict detection, pause/resume
   */
  useEffect(() => {
    let unsubscribe;
    if (sessionId) {
      const sessionRef = doc(db, 'sessions', sessionId);
      unsubscribe = onSnapshot(sessionRef, (sessionSnap) => {
        if (!sessionSnap.exists()) {
          console.log('Session doc no longer exists in Firestore.');
          return;
        }
        const sessionData = sessionSnap.data();

        // Token mismatch => conflict
        const localSessionToken = localStorage.getItem('sessionToken');
        const firestoreSessionToken = sessionData.activeToken;
        if (
          firestoreSessionToken &&
          localSessionToken &&
          firestoreSessionToken !== localSessionToken
        ) {
          setConflictModalVisible(true);
        }

        // Optionally check instanceId if you also want instance-based conflict
        // if (sessionData.activeInstanceId && sessionData.activeInstanceId !== instanceId) {
        //   setConflictModalVisible(true);
        // }

        // If no mismatch, sync pause & running states
        setIsPaused(!!sessionData.paused);
        setIsRunning(
          sessionData.status === 'running' || sessionData.status === 'paused'
        );

        if (sessionData.pauseEvents) {
          setPauseEvents(sessionData.pauseEvents);
        }

        if (!sessionData.paused) {
          // If running: update local start references
          const clientStart =
            sessionData.clientStartTime ||
            sessionData.startTimeMs ||
            (sessionData.startTime
              ? sessionData.startTime.toDate().getTime()
              : Date.now());
          setSessionClientStartTime(clientStart);
          setBaseElapsedTime(sessionData.elapsedTime || 0);
        } else {
          // If paused: freeze timer at whatever Firestore has
          setSessionClientStartTime(null);
          setTimer(sessionData.elapsedTime || 0);
        }
      });
    }
    return () => {
      if (unsubscribe) {
        console.log('Cleaning up session onSnapshot listener');
        unsubscribe();
      }
    };
  }, [sessionId, instanceId]);

  // Start a session
  const handleStart = useCallback(async () => {
    if (!selectedProject) {
      alert('Please select a project to start the timer.');
      return;
    }
    if (!sessionId) {
      try {
        const sessionRef = doc(collection(db, 'sessions'));
        const sessionToken = uuidv4();
        localStorage.setItem('sessionToken', sessionToken);
        await setDoc(sessionRef, {
          userId: user.uid,
          project: selectedProject.name,
          projectId: selectedProject.id,
          sessionNotes,
          isBillable,
          startTime: serverTimestamp(),
          startTimeMs: Date.now(),
          clientStartTime: Date.now(),
          endTime: null,
          elapsedTime: 0,
          paused: false,
          status: 'running',
          pauseEvents: [],
          activeToken: sessionToken,
          activeInstanceId: instanceId,
        });
        setSessionId(sessionRef.id);
      } catch (error) {
        console.error('Error starting session:', error);
      }
    }
    setTimer(0);
    setIsRunning(true);
    setIsPaused(false);
  }, [
    selectedProject,
    sessionId,
    user,
    sessionNotes,
    isBillable,
    instanceId,
  ]);

  // Pause
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

  // Resume
  const handleResume = useCallback(async () => {
    setIsPaused(false);
    if (sessionId) {
      try {
        const sessionRef = doc(db, 'sessions', sessionId);
        const resumeEvent = { type: 'resume', timestamp: Timestamp.now() };
        await updateDoc(sessionRef, {
          paused: false,
          startTime: serverTimestamp(),
          clientStartTime: Date.now(),
          startTimeMs: Date.now(),
          status: 'running',
          pauseEvents: arrayUnion(resumeEvent),
        });
      } catch (error) {
        console.error('Error resuming session:', error);
      }
    }
    setIsRunning(true);
  }, [sessionId]);

  // Stop flow
  const handleStop = useCallback(() => {
    setShowStopConfirmModal(true);
  }, []);

  // CONFIRM STOP => finalize session & update project info & user’s tracked times
  const confirmStopSession = useCallback(async () => {
    setShowStopConfirmModal(false);
    setIsRunning(false);
    setIsPaused(false);

    if (sessionId && selectedProject) {
      try {
        const sessionRef = doc(db, 'sessions', sessionId);
        const sessionDurationSeconds = timer;
        const sessionDurationMinutes = Math.round(sessionDurationSeconds / 60);

        // 1) Calculate total paused time
        let totalPausedTimeMs = 0;
        let lastPauseTime = null;
        const sortedPauseEvents = [...pauseEvents].sort(
          (a, b) => a.timestamp.seconds - b.timestamp.seconds
        );
        for (const event of sortedPauseEvents) {
          if (event.type === 'pause') {
            lastPauseTime = event.timestamp;
          } else if (event.type === 'resume' && lastPauseTime) {
            totalPausedTimeMs +=
              event.timestamp.seconds * 1000 - lastPauseTime.seconds * 1000;
            lastPauseTime = null;
          }
        }
        const totalPausedTimeSeconds = Math.round(totalPausedTimeMs / 1000);

        // 2) Mark session ended in Firestore
        await updateDoc(sessionRef, {
          elapsedTime: timer,
          endTime: serverTimestamp(),
          project: selectedProject.name,
          projectId: selectedProject.id,
          sessionNotes,
          status: 'stopped',
          pauseEvents,
          totalPausedTime: totalPausedTimeSeconds,
        });

        // 3) Update project’s lastTrackedTime if this is the latest
        await runTransaction(db, async (transaction) => {
          const projectRef = doc(db, 'projects', selectedProject.id);
          const projectDoc = await transaction.get(projectRef);
          const currentLastTracked = projectDoc.data().lastTrackedTime;
          const newEndTime = Date.now();
          if (
            !currentLastTracked ||
            newEndTime > currentLastTracked.toMillis?.()
          ) {
            transaction.update(projectRef, { lastTrackedTime: serverTimestamp() });
          }
        });

        // 4) Update weeklyTrackedTime and totalTrackedTime in user profile
        await runTransaction(db, async (transaction) => {
          const profileRef = doc(db, 'profiles', user.uid);
          const profileSnap = await transaction.get(profileRef);
          if (!profileSnap.exists()) return;

          const profileData = profileSnap.data();
          let currentWeeklyTime = profileData.weeklyTrackedTime || 0;
          let storedWeekStart = profileData.weekStart || 0;
          const thisMonday = getMondayOfCurrentWeek();

          // If new week started
          if (storedWeekStart < thisMonday) {
            currentWeeklyTime = 0;
            storedWeekStart = thisMonday;
          }

          const newWeeklyTime = currentWeeklyTime + timer;
          let currentTotalTrackedTime = profileData.totalTrackedTime || 0;
          // Add session minutes to totalTrackedTime
          const newTotalTrackedTime = currentTotalTrackedTime + sessionDurationMinutes;

          transaction.update(profileRef, {
            weeklyTrackedTime: newWeeklyTime,
            weekStart: storedWeekStart,
            totalTrackedTime: newTotalTrackedTime,
            lastUpdated: serverTimestamp(),
          });
        });
      } catch (error) {
        console.error('Error stopping session:', error);
      }
    }

    // 5) Navigate to session overview
    localStorage.setItem('lastProjectId', selectedProject?.id || '');
    navigate('session-overview', {
      totalTime: timer,
      projectId: selectedProject?.id,
    });

    // 6) Reset local states
    setTimer(0);
    setSelectedProject(null);
    setSessionNotes('');
    setIsBillable(true);
    setSessionId(null);
    setPauseEvents([]);
  }, [navigate, sessionId, selectedProject, timer, sessionNotes, pauseEvents, user]);

  // Reset Timer
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
    setSessionClientStartTime(null);
    setBaseElapsedTime(0);

    if (sessionId) {
      try {
        const sessionRef = doc(db, 'sessions', sessionId);
        await updateDoc(sessionRef, {
          elapsedTime: 0,
          endTime: serverTimestamp(),
          paused: true,
          status: 'reset',
        });
        setSessionId(null);
      } catch (error) {
        console.error('Error resetting session in database:', error);
      }
    } else {
      setSessionId(null);
    }
  }, [sessionId]);

  // Toggle Billable
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

  // Change Project
  const handleProjectChange = useCallback(
    async (e) => {
      const projectName = e.target.value;
      const selectedProj = projects.find((proj) => proj.name === projectName);
      setSelectedProject(selectedProj);

      if (isRunning && sessionId && selectedProj) {
        try {
          const sessionRef = doc(db, 'sessions', sessionId);
          await updateDoc(sessionRef, {
            project: selectedProj.name,
            projectId: selectedProj.id,
          });
        } catch (error) {
          console.error('Error updating project in session:', error);
        }
      }
    },
    [projects, isRunning, sessionId]
  );

  // Autosave notes
  useEffect(() => {
    // Only save if *this* instance is the active one
    if (sessionId && activeInstanceId === instanceId) {
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
  }, [sessionNotes, sessionId, activeInstanceId, instanceId]);

  const handleNotesChange = useCallback((e) => {
    // Limit length to 140
    setSessionNotes(e.target.value.slice(0, 140));
  }, []);

  // Take Over Session
  const handleTakeOver = async () => {
    if (sessionId) {
      const sessionRef = doc(db, 'sessions', sessionId);
      try {
        // Overwrite Firestore token and instance to match this device
        await updateDoc(sessionRef, {
          activeToken: localStorage.getItem('sessionToken'),
          activeInstanceId: instanceId,
        });

        const sessionSnap = await getDoc(sessionRef);
        if (sessionSnap.exists()) {
          const sessionData = sessionSnap.data();
          setIsPaused(!!sessionData.paused);
          setIsRunning(
            sessionData.status === 'running' || sessionData.status === 'paused'
          );
          if (!sessionData.paused) {
            const clientStart =
              sessionData.clientStartTime ||
              sessionData.startTimeMs ||
              (sessionData.startTime
                ? sessionData.startTime.toDate().getTime()
                : Date.now());
            setSessionClientStartTime(clientStart);
            setBaseElapsedTime(sessionData.elapsedTime || 0);
          } else {
            setSessionClientStartTime(null);
            setTimer(sessionData.elapsedTime || 0);
          }
        }
        setConflictModalVisible(false);
        setActiveInstanceId(instanceId);
      } catch (error) {
        console.error('Error taking over session:', error);
      }
    }
  };

  // Close session on conflict
  const handleCloseSession = () => {
    navigate('home');
  };

  if (loading) {
    return (
      <div className="homepage-loading">
        <SoukoLogoHeader className="profile-pic souko-logo-header spinning-logo" />
      </div>
    );
  }

  return (
    <div className="time-tracker-page">
      <Header
        variant="journalOverview"
        showBackArrow={true}
        onBack={() => navigate('home', { skipAutoRedirect: true })}
        navigate={navigate}
        onProfileClick={() => setIsSidebarOpen(true)}
      />
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
            <ResetActiveIcon style={{ width: '32px', height: '32px' }} />
          ) : (
            <ResetMuteIcon style={{ width: '32px', height: '32px' }} />
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
          onClick={
            isRunning && !isPaused
              ? handlePause
              : isPaused
              ? handleResume
              : undefined
          }
        >
          {isRunning && !isPaused ? (
            <PauseIcon style={{ width: '32px', height: '32px' }} />
          ) : timer === 0 ? (
            <PauseIcon style={{ width: '32px', height: '32px', opacity: 0.5 }} />
          ) : (
            <PlayIcon style={{ width: '32px', height: '32px' }} />
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

      <div
        className="input-tile billable-tile"
        onClick={handleBillableToggle}
        style={{ cursor: 'pointer' }}
      >
        <span className="input-label billable-label">
          {isBillable ? 'Billable' : 'Non-billable'}
        </span>
        <div className="billable-radio">
          {isBillable ? <RadioActiveIcon /> : <RadioMutedIcon />}
        </div>
      </div>

      <div className="input-tile notes-input-tile" style={{ position: 'relative' }}>
        <textarea
          id="session-notes"
          className="notes-textarea"
          placeholder="Take a moment to note"
          value={sessionNotes}
          onChange={handleNotesChange}
          disabled={activeInstanceId !== instanceId}
          onBlur={() => {
            timerRef.current?.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
            });
          }}
        />
        <EditIcon
          className="notes-edit-icon"
          style={{ position: 'absolute', top: '16px', right: '16px' }}
        />
      </div>

      {/* Stop Confirm Modal */}
      <ConfirmModal
        show={showStopConfirmModal}
        onHide={() => setShowStopConfirmModal(false)}
        title="Stop Timer Session?"
        body="Do you want to save this session?"
        onConfirm={confirmStopSession}
        confirmText="Yes, Stop & Save"
        cancelText="Cancel"
      />

      {/* Reset Confirm Modal */}
      <ConfirmModal
        show={showResetConfirmModal}
        onHide={() => setShowResetConfirmModal(false)}
        title="Reset Timer?"
        body="Are you sure you want to reset the timer? Any unsaved progress will be lost."
        onConfirm={confirmResetTimer}
        confirmText="Yes, Reset"
        cancelText="Cancel"
      />

      {/* Conflict Modal */}
      <ConfirmModal
        show={conflictModalVisible}
        onHide={handleCloseSession}
        title="Session Open on Another Device"
        body="This session is currently open on another device. To prevent conflicts, please close the other instance or click 'Take Over' to use this device."
        onConfirm={handleTakeOver}
        confirmText="Take Over"
        cancelText="Return Home"
      />

      {/* Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onLogout={handleSignOut}
      />
      {isSidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}
    </div>
  );
});

TimeTrackerPage.displayName = 'TimeTrackerPage';
export default TimeTrackerPage;
