// pages/TimeTrackerSetupPage.jsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { v4 as uuidv4 } from 'uuid';

// Layout & UI components
import Header from '../components/Layout/Header';
import Sidebar from '../components/Layout/Sidebar';
import ConfirmModal from '../components/ConfirmModal';

// SVG assets
import { ReactComponent as DropdownIcon } from '../styles/components/assets/dropdown.svg';
import { ReactComponent as Spinner } from '../styles/components/assets/spinner.svg';
import { ReactComponent as EraseIcon } from '../styles/components/assets/erase.svg';

// Optional icons for each dropdown “tile” (if desired)
import { ReactComponent as LabelIcon } from '../styles/components/assets/label-dropdown.svg';
import { ReactComponent as HourRateIcon } from '../styles/components/assets/label-hourrate.svg';
import { ReactComponent as ObjectiveIcon } from '../styles/components/assets/label-objective.svg';

import '../styles/global.css';

// Predefined labels for the second dropdown
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

// Possible session objectives (hours), including a "no objective" option
const SESSION_OBJECTIVES = [
  'no objective',
  '1 hour',
  '2 hours',
  '3 hours',
  '4 hours',
  '6 hours',
  '8 hours',
];

const TimeTrackerSetupPage = React.memo(({ navigate }) => {
  const [loading, setLoading] = useState(true);

  // -- Projects --
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);

  // -- Session label (2nd dropdown) --
  const [sessionLabel, setSessionLabel] = useState(SESSION_LABELS[0]);

  // -- Combine “billable / non-billable” + hourRate in a single logic block --
  // If hourRate > 0 => billable, otherwise non-billable
  const [hourRate, setHourRate] = useState('');
  const [currencyId, setCurrencyId] = useState('euro'); // default

  const isBillable = useMemo(() => {
    const numeric = Number(hourRate || 0);
    return numeric > 0;
  }, [hourRate]);

  // -- 4th dropdown: session objective
  const [sessionObjective, setSessionObjective] = useState('no objective');

  // -- UI states for sidebar, etc. --
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // 1) Auth check -> load projects
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        navigate('login');
      } else {
        setLoading(true);
        try {
          const projectsRef = collection(db, 'projects');
          const projectQuery = query(
            projectsRef,
            where('userId', '==', currentUser.uid)
          );
          const projectSnapshot = await getDocs(projectQuery);

          const userProjects = projectSnapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          }));

          if (userProjects.length > 0) {
            // Sort by lastTrackedTime desc
            userProjects.sort((a, b) => {
              const aTime = a.lastTrackedTime
                ? a.lastTrackedTime.toMillis?.()
                : 0;
              const bTime = b.lastTrackedTime
                ? b.lastTrackedTime.toMillis?.()
                : 0;
              return bTime - aTime;
            });
            setProjects(userProjects);

            // Prefill with the most recent project
            const mostRecent = userProjects[0];
            setSelectedProject(mostRecent);

            // Prefill hourRate + currencyId from that project
            if (mostRecent.hourRate) setHourRate(mostRecent.hourRate);
            if (mostRecent.currencyId) setCurrencyId(mostRecent.currencyId);
          }
        } catch (error) {
          console.error('Error loading projects for time tracker setup:', error);
        } finally {
          setLoading(false);
        }
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  // 2) Handle project dropdown changes
  const handleProjectChange = useCallback(
    (e) => {
      const projectName = e.target.value;
      const found = projects.find((proj) => proj.name === projectName);
      if (found) {
        setSelectedProject(found);
        // Overwrite local states from that project’s doc
        if (found.hourRate) setHourRate(found.hourRate);
        if (found.currencyId) setCurrencyId(found.currencyId);
      }
    },
    [projects]
  );

  // 2b) Handle session label changes
  const handleLabelChange = useCallback((e) => {
    setSessionLabel(e.target.value);
  }, []);

  // 2c) Handle hourRate & currency changes
  const handleHourRateChange = useCallback((e) => {
    setHourRate(e.target.value);
  }, []);

  const handleCurrencyChange = useCallback((e) => {
    setCurrencyId(e.target.value);
  }, []);

  // 2d) Session objective changes
  const handleObjectiveChange = useCallback((e) => {
    setSessionObjective(e.target.value);
  }, []);

  // 3) Start session => create doc in Firestore’s "sessions"
  const handleStartSession = useCallback(async () => {
    if (!selectedProject) {
      alert('Please select a project first.');
      return;
    }
    try {
      const sessionRef = doc(collection(db, 'sessions'));
      const sessionToken = uuidv4();

      // Store locally so if the user navigates away, we still hold the token
      localStorage.setItem('sessionToken', sessionToken);

      // Create the new session document
      await setDoc(sessionRef, {
        userId: auth.currentUser.uid,
        project: selectedProject.name,
        projectId: selectedProject.id,
        hourRate: Number(hourRate) || 0,
        currencyId: currencyId || 'euro',
        isBillable, // derived from hourRate
        startTime: serverTimestamp(),
        startTimeMs: Date.now(),
        clientStartTime: Date.now(),
        endTime: null,
        elapsedTime: 0,
        paused: false,
        status: 'running',
        pauseEvents: [],
        activeToken: sessionToken,
        activeInstanceId: null,
        // Additional fields for your session
        sessionLabel,
        sessionObjective,
      });

      // Navigate to the TimeTrackerPage, passing the new sessionId
      navigate('time-tracker', { sessionId: sessionRef.id });
    } catch (error) {
      console.error('Error creating session:', error);
    }
  }, [
    selectedProject,
    hourRate,
    currencyId,
    isBillable,
    sessionLabel,
    sessionObjective,
    navigate,
  ]);

  if (loading) {
    return (
      <div className="homepage-loading">
        <Spinner className="profile-pic souko-logo-header spinning-logo" />
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

      {/* Motivational quote */}
      <div className="motivational-section">
        Every journey begins with one moment.
      </div>

      <div className="divider"></div>
      <h2 className="projects-label">Define your time session</h2>

      {/* 1) Project dropdown */}
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
          {projects.map((proj) => (
            <option key={proj.id} value={proj.name}>
              {proj.name}
            </option>
          ))}
        </select>
        <DropdownIcon className="dropdown-arrow" />
      </div>

      {/* 2) Session label dropdown (with optional left icon) */}
      <div className="project-dropdown-container session-label-container">
        <LabelIcon className="dropdown-icon-left" />
        <select
          className="session-label-dropdown"
          value={sessionLabel}
          onChange={handleLabelChange}
        >
          {SESSION_LABELS.map((labelOption) => (
            <option key={labelOption} value={labelOption}>
              {labelOption}
            </option>
          ))}
        </select>
        <DropdownIcon className="dropdown-arrow" />
      </div>

      {/* 3) Hour rate & currency (with optional left icon) */}
      <div className="project-dropdown-container hour-rate-container">
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
      <div className="project-dropdown-container objective-container">
        <ObjectiveIcon className="dropdown-icon-left" />
        <select
          className="objective-dropdown"
          value={sessionObjective}
          onChange={handleObjectiveChange}
        >
          {SESSION_OBJECTIVES.map((obj) => (
            <option
              key={obj}
              value={obj}
              className={obj === 'no objective' ? 'text-muted' : ''}
            >
              {obj}
            </option>
          ))}
        </select>
        <DropdownIcon className="dropdown-arrow" />
      </div>

      {/* Sticky buttons (replacing the FAB) */}
      <div className="sticky-buttons-container">
        {/* START SESSION BUTTON */}
        <button
          className="save-button sticky-button-top"
          onClick={handleStartSession}
        >
          Start Session
        </button>

        {/* CREATE MANUAL ENTRY BUTTON (disabled for now) */}
        <button
          className="erase-button sticky-button disabled"
          onClick={() => {}}
          disabled
        >
          Create manual entry
        </button>
      </div>

      {/* Sidebar & modal */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onLogout={() => setShowModal(true)}
      />
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />
      )}

      <ConfirmModal
        show={showModal}
        onHide={() => setShowModal(false)}
        title="Confirm Sign Out"
        body="Are you sure you want to sign out?"
        onConfirm={() => {
          // ...
        }}
      />
    </div>
  );
});

TimeTrackerSetupPage.displayName = 'TimeTrackerSetupPage';
export default TimeTrackerSetupPage;
