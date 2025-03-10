// SessionDetailPage.jsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';

// Reuse the existing Header with our new "sessionDetail" variant
import Header from '../components/Layout/Header';
import ConfirmModal from '../components/ConfirmModal';
import Spinner from '../styles/components/assets/spinner.svg'; // or as ReactComponent if you prefer

// Some example icons used in the input fields, etc.
import { ReactComponent as DropdownIcon } from '../styles/components/assets/dropdown.svg';
import { ReactComponent as EditIcon } from '../styles/components/assets/edit.svg';
import { ReactComponent as LabelIcon } from '../styles/components/assets/label-dropdown.svg';
import { ReactComponent as HourRateIcon } from '../styles/components/assets/label-hourrate.svg';
import { ReactComponent as ObjectiveIcon } from '../styles/components/assets/label-objective.svg';


// We'll define some arrays for session labels & objectives
const SESSION_LABELS = [
  'Designing',
  'Coding',
  'Strategy',
  'Research',
  'Meetings',
  'Writing',
  'Project Management',
  'Paperwork',
  'Learning',
];
const SESSION_OBJECTIVES = [
  'no objective',
  '1 hour',
  '2 hours',
  '3 hours',
  '4 hours',
  '6 hours',
  '8 hours',
];

export default function SessionDetailPage({ navigate, sessionId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Session data
  const [session, setSession] = useState(null);

  // All user's projects
  const [projects, setProjects] = useState([]);

  // Four fields from "TimeTrackerSetupPage"
  const [selectedProject, setSelectedProject] = useState(null);
  const [sessionLabel, setSessionLabel] = useState(SESSION_LABELS[0]);
  const [hourRate, setHourRate] = useState(0);
  const [currencyId, setCurrencyId] = useState('euro');
  const [sessionObjective, setSessionObjective] = useState('no objective');

  // For enabling "Save changes" button
  const [isChanged, setIsChanged] = useState(false);

  // For delete confirm modal
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Listen for auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
    });
    return () => unsub();
  }, []);

  // Load projects & session
  useEffect(() => {
    if (!user || !sessionId) return;

    let canceled = false;
    (async () => {
      setLoading(true);

      // 1) Fetch user’s projects
      const projectsSnap = await getDocs(
        query(collection(db, 'projects'), where('userId', '==', user.uid))
      );
      const fetchedProjects = projectsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      // 2) Fetch session doc
      const sessionRef = doc(db, 'sessions', sessionId);
      const snap = await getDoc(sessionRef);

      if (!snap.exists()) {
        console.error('Session not found', sessionId);
        if (!canceled) setSession(null);
        setLoading(false);
        return;
      }
      const sessionData = snap.data();

      if (!canceled) {
        setProjects(fetchedProjects);
        setSession(sessionData);

        // Pre-fill fields
        setHourRate(sessionData.hourRate ?? 0);
        setCurrencyId(sessionData.currencyId ?? 'euro');
        setSessionLabel(sessionData.sessionLabel ?? SESSION_LABELS[0]);
        setSessionObjective(sessionData.sessionObjective ?? 'no objective');

        // Attempt to match project by ID, fallback to name
        let prj = null;
        if (sessionData.projectId) {
          prj = fetchedProjects.find((p) => p.id === sessionData.projectId);
        }
        if (!prj && sessionData.project) {
          prj = fetchedProjects.find((p) => p.name === sessionData.project);
        }
        // final fallback: pick first project if available
        if (!prj && fetchedProjects.length > 0) {
          prj = fetchedProjects[0];
        }
        setSelectedProject(prj || null);

        setLoading(false);
      }
    })();

    return () => {
      canceled = true;
    };
  }, [user, sessionId]);

  // Whenever a field changes, set isChanged = true (if it differs from original)
  useEffect(() => {
    if (!session) return; // do nothing until session is loaded
    const somethingChanged =
      (selectedProject && selectedProject.name) !== session.project ||
      Number(hourRate) !== Number(session.hourRate ?? 0) ||
      currencyId !== (session.currencyId ?? 'euro') ||
      sessionLabel !== (session.sessionLabel ?? SESSION_LABELS[0]) ||
      sessionObjective !== (session.sessionObjective ?? 'no objective');
    setIsChanged(somethingChanged);
  }, [
    session,
    selectedProject,
    hourRate,
    currencyId,
    sessionLabel,
    sessionObjective,
  ]);

  // == Handlers ==

  const handleProjectChange = useCallback(
    (e) => {
      const projName = e.target.value;
      const found = projects.find((p) => p.name === projName);
      if (found) {
        setSelectedProject(found);
      }
    },
    [projects]
  );

  const handleLabelChange = (e) => {
    setSessionLabel(e.target.value);
  };

  const handleHourRateChange = (e) => {
    setHourRate(e.target.value);
  };

  const handleCurrencyChange = (e) => {
    setCurrencyId(e.target.value);
  };

  const handleObjectiveChange = (e) => {
    setSessionObjective(e.target.value);
  };

  const handleClickSave = async () => {
    if (!session) return;
    if (!isChanged) return;

    try {
      const ref = doc(db, 'sessions', sessionId);
      await updateDoc(ref, {
        project: selectedProject?.name ?? '',
        projectId: selectedProject?.id ?? '',
        hourRate: Number(hourRate) || 0,
        currencyId: currencyId || 'euro',
        sessionLabel,
        sessionObjective,
      });
      console.log('Session updated!');
      setIsChanged(false);

      // Return to previous page
      navigate(-1);
    } catch (err) {
      console.error('Error updating session:', err);
    }
  };

  const handleDeleteSession = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDeleteSession = async () => {
    if (!session) return;
    try {
      await deleteDoc(doc(db, 'sessions', sessionId));
      console.log('Session deleted!');

      setShowDeleteConfirm(false);
      navigate('home'); // navigate to homepage after delete
    } catch (err) {
      console.error('Error deleting session:', err);
    }
  };

  const cancelDeleteSession = () => {
    setShowDeleteConfirm(false);
  };

  // == Utility: format elapsedTime => "0h 00m"
  function formatElapsedTime(seconds) {
    if (!seconds || seconds <= 0) return '0h 00m';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hrs}h ${String(mins).padStart(2, '0')}m`;
  }

  // == Utility: parse objective => total objective in seconds
  // e.g. "6 hours" => 6 * 3600 = 21600
  function parseObjectiveToSeconds(objectiveStr) {
    if (!objectiveStr || objectiveStr === 'no objective') return 0;
    // quick example: split by space => ["6", "hours"]
    // parse the number, multiply by 3600
    const parts = objectiveStr.split(' ');
    const hrs = parseInt(parts[0] || '0', 10);
    if (hrs > 0) {
      return hrs * 3600;
    }
    return 0;
  }

  // 1) elapsedTime displayed
  let elapsedSeconds = session?.elapsedTime ?? 0;
  const elapsedFormatted = formatElapsedTime(elapsedSeconds);

  // 2) saved time => objective - elapsed, if objective is set
  const objSeconds = parseObjectiveToSeconds(sessionObjective);
  const savedSeconds = Math.max(objSeconds - elapsedSeconds, 0); // if negative, use 0
  const savedFormatted = formatElapsedTime(savedSeconds);

  // 3) Construct the motivational line
  let motivationalLine = `${elapsedFormatted} logged!`;
  if (objSeconds > 0 && savedSeconds > 0) {
    motivationalLine += ` You saved ${savedFormatted}.`;
  }
  motivationalLine += ' Efficiency in motion.';

  if (loading) {
    return (
      <div className="homepage-loading">
        <img
          src={Spinner}
          alt="Loading..."
          className="profile-pic souko-logo-header spinning-logo"
        />
      </div>
    );
  }

  if (!session) {
    return <p className="error">Session not found.</p>;
  }

  return (
    <div className="session-detail-page">
      {/* Use the new variant="sessionDetail" so we see the download icon (non-clickable) */}
      <Header variant="sessionDetail" showBackArrow={true} navigate={navigate} />

      {/* Motivational section */}
      <section className="motivational-section">
        <h1 className="motivational-section">
          {/* elapsedTime in green, savedTime in purple */}
          <span className="motivational-elapsed-time">
            {formatElapsedTime(elapsedSeconds)}
          </span>{' '}
          logged!{' '}
          {objSeconds > 0 && savedSeconds > 0 && (
            <>
              You saved{' '}
              <span className="motivational-saved-time">
                {formatElapsedTime(savedSeconds)}
              </span>
              .{' '}
            </>
          )}
          Efficiency in motion.
        </h1>
      </section>

      {/* The 4 input fields from TimeTrackerSetupPage:
          1) Project
          2) Session Label
          3) HourRate + currency (billable if > 0)
          4) Session Objective
       */}

      {/* 1) Project dropdown */}
      <div className="project-dropdown-container" style={{ marginBottom: '16px' }}>
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
          {projects.map((proj) => (
            <option key={proj.id} value={proj.name}>
              {proj.name}
            </option>
          ))}
        </select>
        <DropdownIcon className="dropdown-arrow" />
      </div>

      {/* 2) Session Label dropdown (with optional left icon) */}
      <div className="project-dropdown-container session-label-container" style={{ marginBottom: '16px' }}>
        <LabelIcon className="dropdown-icon-left" />
        <select
          className="session-label-dropdown"
          value={sessionLabel}
          onChange={handleLabelChange}
        >
          {SESSION_LABELS.map((label) => (
            <option key={label} value={label}>
              {label}
            </option>
          ))}
        </select>
        <DropdownIcon className="dropdown-arrow" />
      </div>

      {/* 3) Hour rate & currency (with optional left icon) */}
      <div className="project-dropdown-container hour-rate-container" style={{ marginBottom: '16px' }}>
        <HourRateIcon className="dropdown-icon-left" />
        <input
          type="number"
          min="0"
          className="hour-rate-input"
          placeholder="Hour Rate (0 = Non-billable)"
          value={hourRate}
          onChange={handleHourRateChange}
        />
        <select
          className="currency-select"
          value={currencyId}
          onChange={handleCurrencyChange}
        >
          <option value="euro">€</option>
          <option value="usd">$</option>
          <option value="gbp">£</option>
        </select>
      </div>

      {/* 4) Session objective dropdown (with optional left icon) */}
      <div className="project-dropdown-container objective-container" style={{ marginBottom: '16px' }}>
        <ObjectiveIcon className="dropdown-icon-left" />
        <select
          className="objective-dropdown"
          value={sessionObjective}
          onChange={handleObjectiveChange}
        >
          {SESSION_OBJECTIVES.map((obj) => (
            <option key={obj} value={obj}>
              {obj}
            </option>
          ))}
        </select>
        <DropdownIcon className="dropdown-arrow" />
      </div>

      {/* Sticky Buttons at bottom */}
      <button
        className={`save-button sticky-button-top ${isChanged ? 'active' : ''}`}
        onClick={handleClickSave}
        disabled={!isChanged}
      >
        Save changes
      </button>

      <button className="erase-button sticky-button" onClick={handleDeleteSession}>
        Erase session
      </button>

      {/* ConfirmModal for erasing */}
      <ConfirmModal
        show={showDeleteConfirm}
        onHide={cancelDeleteSession}
        title="Erase this session?"
        body="Are you sure you want to delete this session? This action cannot be undone."
        onConfirm={confirmDeleteSession}
        confirmText="Yes, erase"
        cancelText="Cancel"
      />
    </div>
  );
}