import { v4 as uuidv4 } from 'uuid';
import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import {
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  Timestamp,
  arrayUnion,
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
import '@fontsource/shippori-mincho';
import ConfirmModal from '../components/ConfirmModal';
import { ReactComponent as Spinner } from '../styles/components/assets/spinner.svg';

// Helper: Monday-based week start
function getMondayOfCurrentWeek() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const day = (now.getDay() + 6) % 7;
  now.setDate(now.getDate() - day);
  return now.getTime();
}

// Helper: persist instance ID
const getInstanceId = () => {
  let id = localStorage.getItem('timeTrackerInstanceId');
  if (!id) {
    id = `${Date.now()}-${Math.random()}`;
    localStorage.setItem('timeTrackerInstanceId', id);
  }
  return id;
};

const TimeTrackerPage = React.memo(({ navigate, sessionId }) => {
  console.log('TimeTrackerPage component rendered');

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Session data
  const [currentSession, setCurrentSession] = useState(null);
  const [timer, setTimer] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [pauseEvents, setPauseEvents] = useState([]);

  // Timer sync
  const [baseElapsedTime, setBaseElapsedTime] = useState(0);
  const [sessionClientStartTime, setSessionClientStartTime] = useState(null);

  // Conflict handling
  const [activeInstanceId, setActiveInstanceId] = useState(null);
  const [conflictModalVisible, setConflictModalVisible] = useState(false);
  const instanceId = useMemo(() => getInstanceId(), []);

  // UI
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showStopConfirmModal, setShowStopConfirmModal] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const timerRef = useRef(null);

  // -----------------------------
  // 1) Auth check => load session
  // -----------------------------
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        navigate('login');
      } else {
        setUser(currentUser);
        if (!sessionId) {
          setLoading(false);
          return;
        }
        try {
          const sessionRef = doc(db, 'sessions', sessionId);
          const snap = await getDoc(sessionRef);
          if (snap.exists()) {
            setCurrentSession(snap.data());
          } else {
            console.log('Session not found in Firestore.');
          }
        } catch (error) {
          console.error('Error loading session doc:', error);
        }
        setLoading(false);
      }
    });
    return () => unsub();
  }, [navigate, sessionId]);

  // ----------------------------
  // 2) Real-time listener
  // ----------------------------
  useEffect(() => {
    let unsubscribe;
    if (sessionId) {
      const sessionRef = doc(db, 'sessions', sessionId);
      unsubscribe = onSnapshot(sessionRef, (sessionSnap) => {
        if (!sessionSnap.exists()) {
          setCurrentSession(null);
          return;
        }
        const sData = sessionSnap.data();
        setCurrentSession(sData);

        // Conflict checks
        const localSessionToken = localStorage.getItem('sessionToken');
        const firestoreSessionToken = sData.activeToken;
        if (
          firestoreSessionToken &&
          localSessionToken &&
          firestoreSessionToken !== localSessionToken
        ) {
          setConflictModalVisible(true);
        }
        if (sData.activeInstanceId && sData.activeInstanceId !== instanceId) {
          setConflictModalVisible(true);
        }

        // Mark paused/running
        setIsPaused(!!sData.paused);
        setIsRunning(sData.status === 'running' || sData.status === 'paused');

        // Pause events
        if (sData.pauseEvents) {
          setPauseEvents(sData.pauseEvents);
        }

        // If actively running, set up local ticking
        if (!sData.paused && sData.status === 'running') {
          const clientStart = sData.clientStartTime || sData.startTimeMs || Date.now();
          setSessionClientStartTime(clientStart);
          setBaseElapsedTime(sData.elapsedTime || 0);
        } else {
          // paused or stopped => freeze timer
          setSessionClientStartTime(null);
          setTimer(sData.elapsedTime || 0);
        }

        setActiveInstanceId(sData.activeInstanceId || null);
      });
    }
    return () => unsubscribe && unsubscribe();
  }, [sessionId, instanceId]);

  // ----------------------------
  // 3) Local ticking timer
  // ----------------------------
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

  // ----------------------------
  // 4) Pause
  // ----------------------------
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
          activeInstanceId: instanceId,
        });
      } catch (error) {
        console.error('Error pausing session:', error);
      }
    }
  }, [sessionId, timer, instanceId]);

  // ----------------------------
  // 5) Resume
  // ----------------------------
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
          activeInstanceId: instanceId,
        });
      } catch (error) {
        console.error('Error resuming session:', error);
      }
    }
    setIsRunning(true);
  }, [sessionId, instanceId]);

  // ----------------------------
  // 6) Stop flow
  // ----------------------------
  const handleStop = useCallback(() => {
    setShowStopConfirmModal(true);
  }, []);

  const confirmStopSession = useCallback(async () => {
    setShowStopConfirmModal(false);
    setIsRunning(false);
    setIsPaused(false);

    if (sessionId && currentSession) {
      try {
        const sessionRef = doc(db, 'sessions', sessionId);
        const sessionDurationSeconds = timer;
        const sessionDurationMinutes = Math.round(sessionDurationSeconds / 60);

        // Calculate total paused time
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

        // Mark session ended
        await updateDoc(sessionRef, {
          elapsedTime: timer,
          endTime: serverTimestamp(),
          status: 'stopped',
          pauseEvents,
          totalPausedTime: totalPausedTimeSeconds,
        });

        // Possibly update project’s lastTrackedTime
        await runTransaction(db, async (transaction) => {
          const projectRef = doc(db, 'projects', currentSession.projectId);
          const projectDoc = await transaction.get(projectRef);
          if (projectDoc.exists()) {
            const currentLastTracked = projectDoc.data().lastTrackedTime;
            const newEndTime = Date.now();
            if (
              !currentLastTracked ||
              newEndTime > currentLastTracked.toMillis?.()
            ) {
              transaction.update(projectRef, { lastTrackedTime: serverTimestamp() });
            }
          }
        });

        // Update user’s weekly/total tracked time
        await runTransaction(db, async (transaction) => {
          const profileRef = doc(db, 'profiles', user.uid);
          const profileSnap = await transaction.get(profileRef);
          if (!profileSnap.exists()) return;

          const profileData = profileSnap.data();
          let currentWeeklyTime = profileData.weeklyTrackedTime || 0;
          let storedWeekStart = profileData.weekStart || 0;
          const thisMonday = getMondayOfCurrentWeek();

          if (storedWeekStart < thisMonday) {
            currentWeeklyTime = 0;
            storedWeekStart = thisMonday;
          }

          const newWeeklyTime = currentWeeklyTime + timer;
          let currentTotalTrackedTime = profileData.totalTrackedTime || 0;
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

    localStorage.setItem('lastProjectId', currentSession?.projectId || '');
    navigate('session-overview', {
      totalTime: timer,
      projectId: currentSession?.projectId,
    });

    setTimer(0);
    setCurrentSession(null);
    setPauseEvents([]);
  }, [navigate, sessionId, currentSession, timer, pauseEvents, user]);

  // ----------------------------
  // 7) Reset Timer
  // ----------------------------
  const handleReset = useCallback(() => {
    // Only prompt confirm if there's something to reset
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
      } catch (error) {
        console.error('Error resetting session in database:', error);
      }
    }
  }, [sessionId]);

  // ----------------------------
  // 8) Take Over if conflict
  // ----------------------------
  const handleTakeOver = async () => {
    if (sessionId) {
      const sessionRef = doc(db, 'sessions', sessionId);
      try {
        await updateDoc(sessionRef, {
          activeToken: localStorage.getItem('sessionToken'),
          activeInstanceId: instanceId,
        });
        const sessionSnap = await getDoc(sessionRef);
        if (sessionSnap.exists()) {
          const sData = sessionSnap.data();
          setIsPaused(!!sData.paused);
          setIsRunning(sData.status === 'running' || sData.status === 'paused');
          if (!sData.paused && sData.status === 'running') {
            const clientStart = sData.clientStartTime || sData.startTimeMs || Date.now();
            setSessionClientStartTime(clientStart);
            setBaseElapsedTime(sData.elapsedTime || 0);
          } else {
            setSessionClientStartTime(null);
            setTimer(sData.elapsedTime || 0);
          }
        }
        setConflictModalVisible(false);
        setActiveInstanceId(instanceId);
      } catch (error) {
        console.error('Error taking over session:', error);
      }
    }
  };

  const handleCloseSession = () => {
    navigate('home');
  };

  // ----------------------------
  // 9) Sign Out
  // ----------------------------
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

  // -------------------------------------
  // Render & Conditionals
  // -------------------------------------
  if (loading) {
    return (
      <div className="homepage-loading">
        <Spinner className="profile-pic souko-logo-header spinning-logo" />
      </div>
    );
  }

  if (!currentSession) {
    return (
      <div className="time-tracker-page">
        <Header
          variant="journalOverview"
          showBackArrow={true}
          onBack={() => navigate('home', { skipAutoRedirect: true })}
          navigate={navigate}
        />
        <p style={{ textAlign: 'center', marginTop: '40px' }}>
          No session found.
        </p>
      </div>
    );
  }

  const { project, isBillable, hourRate, currencyId } = currentSession;

  return (
    <div className="time-tracker-page">
      <Header
        variant="journalOverview"
        showBackArrow={true}
        onBack={() => navigate('home', { skipAutoRedirect: true })}
        navigate={navigate}
        onProfileClick={() => setIsSidebarOpen(true)}
      />

      <div className="motivational-section">
        The song of your roots is the song of now.
      </div>

      <h2 className="projects-label">Session details</h2>
      <div className="input-tile-timer" style={{ marginTop: '16px' }}>
        <strong>Project: </strong>&nbsp;{project}
      </div>
      <div className="input-tile-timer" style={{ marginTop: '8px' }}>
        <strong>Billable: </strong>&nbsp;{isBillable ? 'Yes' : 'No'}
      </div>
      <div className="input-tile-timer" style={{ marginTop: '8px' }}>
        <strong>Rate: </strong>&nbsp;{hourRate} {currencyId}
      </div>

      {/* Bottom bar holding timer + controls */}
      <div className="bottom-sticky-bar">
        <div className={`timer ${isPaused ? 'paused' : ''}`}>
          {new Date(timer * 1000).toISOString().substr(11, 8)}
        </div>

        <div className="buttons-row">
          {/* Reset button */}
          <button
            className="control-button small"
            onClick={handleReset}
            /* Enabled if the session is running or has counted time */
            disabled={!(isRunning || timer > 0)}
          >
            {(isRunning || timer > 0) ? (
              <ResetActiveIcon style={{ width: '32px', height: '32px' }} />
            ) : (
              <ResetMuteIcon style={{ width: '32px', height: '32px' }} />
            )}
          </button>

          {/* Stop button - ALWAYS clickable to confirm stop */}
          <button
            className="control-button fab-like"
            onClick={handleStop}
          >
            <StopTimerIcon style={{ width: '64px', height: '64px' }} />
          </button>

          {/* Pause / Resume */}
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
              <PauseIcon
                style={{ width: '32px', height: '32px', opacity: 0.5 }}
              />
            ) : (
              <PlayIcon style={{ width: '32px', height: '32px' }} />
            )}
          </button>
        </div>
      </div>

      {/* Confirm modals, sidebar, conflict modal, etc. */}
      <ConfirmModal
        show={showStopConfirmModal}
        onHide={() => setShowStopConfirmModal(false)}
        title="Stop Timer Session?"
        body="Do you want to save this session?"
        onConfirm={confirmStopSession}
        confirmText="Yes, Stop & Save"
        cancelText="Cancel"
      />

      <ConfirmModal
        show={showResetConfirmModal}
        onHide={() => setShowResetConfirmModal(false)}
        title="Reset Timer?"
        body="Are you sure you want to reset the timer? Any unsaved progress will be lost."
        onConfirm={confirmResetTimer}
        confirmText="Yes, Reset"
        cancelText="Cancel"
      />

      <ConfirmModal
        show={conflictModalVisible}
        onHide={handleCloseSession}
        title="Session Open on Another Device"
        body="This session is currently open on another device. To prevent conflicts, please close the other instance or click 'Take Over' to use this device."
        onConfirm={handleTakeOver}
        confirmText="Take Over"
        cancelText="Return Home"
      />

      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onLogout={handleSignOut}
      />
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>
      )}
    </div>
  );
});

TimeTrackerPage.displayName = 'TimeTrackerPage';
export default TimeTrackerPage;
