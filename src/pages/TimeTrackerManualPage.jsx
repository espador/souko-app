// pages/TimeTrackerManualPage.jsx
import React, { useState, useCallback, useEffect } from 'react';
import { collection, doc, setDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';

import '../styles/global.css';
// Components
import Header from '../components/Layout/Header';

// Icons
import { ReactComponent as DropdownIcon } from '../styles/components/assets/dropdown.svg';
import { ReactComponent as LabelIcon } from '../styles/components/assets/label-dropdown.svg';
import { ReactComponent as HourRateIcon } from '../styles/components/assets/label-hourrate.svg';
import { ReactComponent as Spinner } from '../styles/components/assets/spinner.svg';



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

const TimeTrackerManualPage = ({ navigate }) => {
  // State
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [sessionDateTime, setSessionDateTime] = useState(dayjs());
  const [duration, setDuration] = useState('');
  const [sessionLabel, setSessionLabel] = useState(SESSION_LABELS[0]);
  const [hourRate, setHourRate] = useState('');
  const [currencyId, setCurrencyId] = useState('euro');

  // Fetch projects on component mount
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const projectsQuery = query(
          collection(db, 'projects'),
          where('userId', '==', auth.currentUser.uid)
        );
        const querySnapshot = await getDocs(projectsQuery);
        const projectsList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setProjects(projectsList);
        if (projectsList.length > 0) {
          setSelectedProject(projectsList[0]);
          if (projectsList[0].hourRate) setHourRate(projectsList[0].hourRate);
          if (projectsList[0].currencyId) setCurrencyId(projectsList[0].currencyId);
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching projects:', error);
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  // Derived state
  const isBillable = Number(hourRate || 0) > 0;
  
  // Convert HH:MM to seconds
  const durationToSeconds = (duration) => {
    const [hours, minutes] = duration.split(':').map(Number);
    return (hours * 3600) + (minutes * 60);
  };

  const handleSaveManualSession = useCallback(async () => {
    if (!selectedProject || !sessionDateTime || !duration) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const sessionRef = doc(collection(db, 'sessions'));
      const elapsedSeconds = durationToSeconds(duration);

      await setDoc(sessionRef, {
        userId: auth.currentUser.uid,
        project: selectedProject.name,
        projectId: selectedProject.id,
        startTime: sessionDateTime.toDate(),
        elapsedTime: elapsedSeconds,
        hourRate: Number(hourRate) || 0,
        currencyId: currencyId || 'euro',
        isBillable,
        sessionLabel,
        status: 'completed',
        isManual: true,
        manualCreatedAt: serverTimestamp(),
      });

      navigate('home');
    } catch (error) {
      console.error('Error saving manual session:', error);
    }
  }, [selectedProject, sessionDateTime, duration, hourRate, currencyId, sessionLabel, navigate, isBillable]);

  if (loading) {
    return (
      <div className="loading-container">
        <Spinner className="spinner" />
      </div>
    );
  }

  return (
    <div className="time-tracker-page">
      <Header
        variant="default"
        showBackArrow={true}
        onBack={() => navigate('time-tracker-setup')}
      />

      <div className="motivational-section">
        Missed tracking? Rewrite your moment.
      </div>

      <div className="divider"></div>

<h2 className="projects-label">Session date</h2>
<LocalizationProvider dateAdapter={AdapterDayjs}>
  <DateTimePicker
    value={sessionDateTime}
    onChange={setSessionDateTime}
    disablePortal={true}
    slotProps={{
      textField: {
        variant: 'outlined',
        fullWidth: true
      }
    }}
  />
</LocalizationProvider>


      {/* Duration Input (HH:MM) */}
      <h2 className="projects-label">Session duration</h2>
      <input
        type="time"
        value={duration}
        onChange={(e) => setDuration(e.target.value)}
        className="duration-input"
        required
      />

      {/* Project Selection */}
      {projects.length > 0 ? (
        <>
          <h2 className="projects-label">Session details</h2>
          <div className="project-dropdown-container">
            {selectedProject?.imageUrl ? (
              <img
                src={selectedProject.imageUrl}
                alt={selectedProject.name}
                className="dropdown-project-image"
              />
            ) : (
              <div className="dropdown-default-image">
                {selectedProject?.name?.charAt(0).toUpperCase()}
              </div>
            )}
            <select
              className="project-dropdown"
              value={selectedProject?.name || ''}
              onChange={(e) => {
                const project = projects.find(p => p.name === e.target.value);
                if (project) {
                  setSelectedProject(project);
                  if (project.hourRate) setHourRate(project.hourRate);
                  if (project.currencyId) setCurrencyId(project.currencyId);
                }
              }}
            >
              {projects.map((proj) => (
                <option key={proj.id} value={proj.name}>
                  {proj.name}
                </option>
              ))}
            </select>
            <DropdownIcon className="dropdown-arrow" />
          </div>
        </>
      ) : (
        <p>No projects found. Please create a project first.</p>
      )}

      {/* Session Label */}
      <div className="project-dropdown-container">
        <LabelIcon className="dropdown-icon-left" />
        <select
          className="session-label-dropdown"
          value={sessionLabel}
          onChange={(e) => setSessionLabel(e.target.value)}
        >
          {SESSION_LABELS.map((label) => (
            <option key={label} value={label}>{label}</option>
          ))}
        </select>
        <DropdownIcon className="dropdown-arrow" />
      </div>

      {/* Hour Rate */}
      <div className="project-dropdown-container">
        <HourRateIcon className="dropdown-icon-left" />
        <input
          type="number"
          min="0"
          className="hour-rate-input"
          placeholder="Hour Rate (0 = Non-billable)"
          value={hourRate}
          onChange={(e) => setHourRate(e.target.value)}
        />
        <select
          className="currency-select"
          value={currencyId}
          onChange={(e) => setCurrencyId(e.target.value)}
        >
          <option value="euro">€</option>
          <option value="usd">$</option>
          <option value="gbp">£</option>
        </select>
      </div>

      {/* Save Button */}
      <button
        className="save-button sticky-button"
        onClick={handleSaveManualSession}
        disabled={!selectedProject || !sessionDateTime || !duration}
      >
        Save Manual Session
      </button>
    </div>
  );
};

export default TimeTrackerManualPage;
