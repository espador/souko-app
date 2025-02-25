// pages/TimeTrackerSetupPage.jsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { v4 as uuidv4 } from 'uuid';

import Header from '../components/Layout/Header';
import Sidebar from '../components/Layout/Sidebar';
import ConfirmModal from '../components/ConfirmModal';

import { ReactComponent as DropdownIcon } from '../styles/components/assets/dropdown.svg';
import { ReactComponent as RadioActiveIcon } from '../styles/components/assets/radio-active.svg';
import { ReactComponent as RadioMutedIcon } from '../styles/components/assets/radio-muted.svg';
import { ReactComponent as SoukoLogoHeader } from '../styles/components/assets/Souko-logo-header.svg';
import { ReactComponent as StartTimerIcon } from '../styles/components/assets/start-timer.svg';

import '../styles/global.css';
import '../styles/components/TimeTrackerPage.css'; // We can reuse some styles
// Or create a separate .css for the setup page if you like

const TimeTrackerSetupPage = React.memo(({ navigate }) => {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);

  // We want to store hourRate, currencyId, isBillable
  const [hourRate, setHourRate] = useState('');
  const [currencyId, setCurrencyId] = useState('euro'); // default
  const [isBillable, setIsBillable] = useState(true);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // If we need a modal for something, here it is
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
          const projectQuery = query(projectsRef, where('userId', '==', currentUser.uid));
          const projectSnapshot = await getDocs(projectQuery);

          const userProjects = projectSnapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          }));

          if (userProjects.length > 0) {
            // Sort by lastTrackedTime desc or something
            userProjects.sort((a, b) => {
              const aTime = a.lastTrackedTime ? a.lastTrackedTime.toMillis?.() : 0;
              const bTime = b.lastTrackedTime ? b.lastTrackedTime.toMillis?.() : 0;
              return bTime - aTime;
            });
            setProjects(userProjects);

            // Prefill with the *most recent project*
            const mostRecent = userProjects[0];
            setSelectedProject(mostRecent);

            // Prefill hourRate + currencyId
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

  // 2) Handle project dropdown changes: we also want to fetch hourRate/currency
  const handleProjectChange = useCallback((e) => {
    const projectName = e.target.value;
    const found = projects.find((proj) => proj.name === projectName);
    if (found) {
      setSelectedProject(found);
      // Overwrite local states from that project’s doc
      if (found.hourRate) setHourRate(found.hourRate);
      if (found.currencyId) setCurrencyId(found.currencyId);
    }
  }, [projects]);

  const handleHourRateChange = useCallback((e) => {
    setHourRate(e.target.value);
  }, []);

  const handleCurrencyChange = useCallback((e) => {
    setCurrencyId(e.target.value);
  }, []);

  const toggleBillable = useCallback(() => {
    setIsBillable((prev) => !prev);
  }, []);

  // 3) Start session => create doc in Firestore
  const handleStartSession = useCallback(async () => {
    if (!selectedProject) {
      alert('Please select a project first.');
      return;
    }
    try {
      const sessionRef = doc(collection(db, 'sessions'));
      const sessionToken = uuidv4();

      // Store locally so that if user navigates away, we still hold the token
      localStorage.setItem('sessionToken', sessionToken);

      await setDoc(sessionRef, {
        userId: auth.currentUser.uid,
        project: selectedProject.name,
        projectId: selectedProject.id,
        hourRate: Number(hourRate) || 0,
        currencyId: currencyId || 'euro',
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
        activeInstanceId: null, // will be set in TimeTrackerPage if needed
      });

      // Navigate to the TimeTrackerPage, passing the new sessionId
      navigate('time-tracker', { sessionId: sessionRef.id });
    } catch (error) {
      console.error('Error creating session:', error);
    }
  }, [selectedProject, hourRate, currencyId, isBillable, navigate]);

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
      
      {/* Motivational quote (like design #1: "Every journey begins with one moment.") */}
      <div className="motivational-section">
        Every journey begins with one moment.
      </div>

      {/* Project dropdown */}
      <h2 className="projects-label">Define your time session</h2>
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

      {/* Billable toggle */}
      <div
        className="project-dropdown-container"
        onClick={toggleBillable}
      >
        <span className="input-label billable-label">
          {isBillable ? 'Billable' : 'Non-billable'}
        </span>
        <div className="billable-radio">
          {isBillable ? <RadioActiveIcon /> : <RadioMutedIcon />}
        </div>
      </div>

      {/* Hour rate + currency */}
      <div className="hour-rate-currency-container">
        <input
          type="number"
          min="0"
          className="project-dropdown"
          placeholder="Hour Rate"
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

      {/* Big FAB button to start session */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '40px' }}>
        <button
          className="control-button fab-like"
          onClick={handleStartSession}
        >
          <StartTimerIcon style={{ width: '64px', height: '64px' }} />
        </button>
      </div>

      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onLogout={() => {
          setShowModal(true);
        }}
      />
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>
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