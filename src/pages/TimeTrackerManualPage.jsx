// pages/TimeTrackerManualPage.jsx
import React, { useState, useCallback, useEffect } from 'react';
import { 
  collection, 
  doc, 
  setDoc, 
  serverTimestamp, 
  query, 
  where, 
  getDocs,
  runTransaction 
} from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import dayjs from 'dayjs';

import '../styles/global.css';
// Components
import Header from '../components/Layout/Header';

// Icons
import { ReactComponent as DropdownIcon } from '../styles/components/assets/dropdown.svg';
import { ReactComponent as LabelIcon } from '../styles/components/assets/label-dropdown.svg';
import { ReactComponent as HourRateIcon } from '../styles/components/assets/label-hourrate.svg';
import { ReactComponent as Spinner } from '../styles/components/assets/spinner.svg';

// Helper: Monday-based week start
function getMondayOfCurrentWeek() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const day = (now.getDay() + 6) % 7;
  now.setDate(now.getDate() - day);
  return now.getTime();
}

// Helper: Format number as two digits
const formatTwoDigits = (num) => {
  return num.toString().padStart(2, '0');
};

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
  // Get current date and time for default values
  const now = new Date();
  const currentMonth = formatTwoDigits(now.getMonth() + 1);
  const currentDay = formatTwoDigits(now.getDate());
  const currentYear = now.getFullYear();
  const currentHour = formatTwoDigits(now.getHours());
  const currentMinute = formatTwoDigits(now.getMinutes());

  // State
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  
  // Date inputs
  const [month, setMonth] = useState(currentMonth);
  const [day, setDay] = useState(currentDay);
  const [year, setYear] = useState(currentYear.toString());
  
  // Time inputs
  const [hour, setHour] = useState(currentHour);
  const [minute, setMinute] = useState(currentMinute);
  
  // Duration inputs
  const [durationHour, setDurationHour] = useState('01');
  const [durationMinute, setDurationMinute] = useState('00');
  
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
        const projectsList = querySnapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
          .filter(project => !project.deletedAt); // Filter out deleted projects
        
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

  // Computed values
  const isBillable = Number(hourRate || 0) > 0;
  const sessionDateTime = dayjs(`${year}-${month}-${day}T${hour}:${minute}`);
  const duration = `${durationHour}:${durationMinute}`;
  
  // Input handlers with validation
  const handleMonthChange = (e) => {
    let value = e.target.value;
    if (value.length > 2) value = value.slice(0, 2);
    if (value && parseInt(value) > 12) value = '12';
    if (value && parseInt(value) < 1) value = '01';
    setMonth(value.padStart(2, '0'));
  };

  const handleDayChange = (e) => {
    let value = e.target.value;
    if (value.length > 2) value = value.slice(0, 2);
    if (value && parseInt(value) > 31) value = '31';
    if (value && parseInt(value) < 1) value = '01';
    setDay(value.padStart(2, '0'));
  };

  const handleYearChange = (e) => {
    let value = e.target.value;
    if (value.length > 4) value = value.slice(0, 4);
    setYear(value);
  };

  const handleHourChange = (e) => {
    let value = e.target.value;
    if (value.length > 2) value = value.slice(0, 2);
    if (value && parseInt(value) > 23) value = '23';
    if (value && parseInt(value) < 0) value = '00';
    setHour(value.padStart(2, '0'));
  };

  const handleMinuteChange = (e) => {
    let value = e.target.value;
    if (value.length > 2) value = value.slice(0, 2);
    if (value && parseInt(value) > 59) value = '59';
    if (value && parseInt(value) < 0) value = '00';
    setMinute(value.padStart(2, '0'));
  };

  const handleDurationHourChange = (e) => {
    let value = e.target.value;
    if (value.length > 2) value = value.slice(0, 2);
    if (value && parseInt(value) > 12) value = '12';
    if (value && parseInt(value) < 0) value = '00';
    setDurationHour(value.padStart(2, '0'));
  };

  const handleDurationMinuteChange = (e) => {
    let value = e.target.value;
    if (value.length > 2) value = value.slice(0, 2);
    if (value && parseInt(value) > 59) value = '59';
    if (value && parseInt(value) < 0) value = '00';
    setDurationMinute(value.padStart(2, '0'));
  };

  // Convert HH:MM to seconds
  const durationToSeconds = (duration) => {
    const [hours, minutes] = duration.split(':').map(Number);
    return (hours * 3600) + (minutes * 60);
  };

  const handleSaveManualSession = useCallback(async () => {
    if (!selectedProject || !sessionDateTime.isValid() || !duration) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const sessionRef = doc(collection(db, 'sessions'));
      const elapsedSeconds = durationToSeconds(duration);
      const sessionDurationMinutes = Math.round(elapsedSeconds / 60);

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

      // Update user's weekly/total tracked time
      await runTransaction(db, async (transaction) => {
        const profileRef = doc(db, 'profiles', auth.currentUser.uid);
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

        const newWeeklyTime = currentWeeklyTime + elapsedSeconds;
        const currentTotalTrackedTime = profileData.totalTrackedTime || 0;
        const newTotalTrackedTime = currentTotalTrackedTime + sessionDurationMinutes;

        transaction.update(profileRef, {
          weeklyTrackedTime: newWeeklyTime,
          weekStart: storedWeekStart,
          totalTrackedTime: newTotalTrackedTime,
          lastUpdated: serverTimestamp(),
        });
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
        <h1>Missed tracking? Rewrite your moment.</h1>
      </div>

      <div className="divider"></div>

      {/* Two column grid for Session date and Start time */}
      <div className="manual-time-grid">
        <div className="manual-time-column">
          <h2 className="projects-label">Session date</h2>
          <div className="manual-time-inputs">
            <input
              type="number"
              min="1"
              max="12"
              className="manual-time-input"
              value={month}
              onChange={handleMonthChange}
              placeholder="MM"
            />
            <span className="manual-time-separator">/</span>
            <input
              type="number"
              min="1"
              max="31"
              className="manual-time-input"
              value={day}
              onChange={handleDayChange}
              placeholder="DD"
            />
            <span className="manual-time-separator">/</span>
            <input
              type="number"
              min="2000"
              max="2100"
              className="manual-time-input manual-time-input-year"
              value={year}
              onChange={handleYearChange}
              placeholder="YYYY"
            />
          </div>
        </div>
        
        <div className="manual-time-column">
          <h2 className="projects-label">Start time</h2>
          <div className="manual-time-inputs">
            <input
              type="number"
              min="0"
              max="23"
              className="manual-time-input"
              value={hour}
              onChange={handleHourChange}
              placeholder="HH"
            />
            <span className="manual-time-separator">:</span>
            <input
              type="number"
              min="0"
              max="59"
              className="manual-time-input"
              value={minute}
              onChange={handleMinuteChange}
              placeholder="MM"
            />
          </div>
        </div>
      </div>

      {/* Duration Input */}
      <h2 className="projects-label">Session duration</h2>
      <div className="manual-time-inputs">
        <input
          type="number"
          min="0"
          max="12"
          className="manual-time-input"
          value={durationHour}
          onChange={handleDurationHourChange}
          placeholder="HH"
        />
        <span className="manual-time-separator">:</span>
        <input
          type="number"
          min="0"
          max="59"
          className="manual-time-input"
          value={durationMinute}
          onChange={handleDurationMinuteChange}
          placeholder="MM"
        />
      </div>

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
          <option value="dollar">$</option>
          <option value="gbp">£</option>
        </select>
      </div>

      {/* Save Button */}
      <button
        className="save-button sticky-button"
        onClick={handleSaveManualSession}
        disabled={!selectedProject || !sessionDateTime.isValid() || !duration}
      >
        Create moment
      </button>
    </div>
  );
};

export default TimeTrackerManualPage;
