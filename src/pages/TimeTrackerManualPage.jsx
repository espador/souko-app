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
import { ReactComponent as CalendarIcon } from '../styles/components/assets/calendar.svg';
import { ReactComponent as ClockIcon } from '../styles/components/assets/clock.svg';

// Helper: Monday-based week start
function getMondayOfCurrentWeek() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const day = (now.getDay() + 6) % 7;
  now.setDate(now.getDate() - day);
  return now.getTime();
}

// Format date to YYYY-MM-DD for date input
function formatDateForInput(date) {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

// Format time to HH:MM for time input
function formatTimeForInput(date) {
  const d = new Date(date);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Convert a date string and time string to a Date object
function combineDateAndTime(dateStr, timeStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes);
}

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
  
  // Date and time state
  const now = new Date();
  const [sessionDate, setSessionDate] = useState(formatDateForInput(now));
  const [sessionTime, setSessionTime] = useState(formatTimeForInput(now));
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Duration state (default to 1 hour)
  const [durationHours, setDurationHours] = useState(1);
  const [durationMinutes, setDurationMinutes] = useState(0);
  
  const [sessionLabel, setSessionLabel] = useState(SESSION_LABELS[0]);
  const [hourRate, setHourRate] = useState('');
  const [currencyId, setCurrencyId] = useState('euro');
  const [submitting, setSubmitting] = useState(false);

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
  
  // Get formatted duration string (HH:MM)
  const getDurationString = () => {
    return `${String(durationHours).padStart(2, '0')}:${String(durationMinutes).padStart(2, '0')}`;
  };
  
  // Convert duration to seconds
  const getDurationInSeconds = () => {
    return (durationHours * 3600) + (durationMinutes * 60);
  };

  const handleIncrementHours = () => {
    setDurationHours(prev => prev < 12 ? prev + 1 : prev);
  };

  const handleDecrementHours = () => {
    setDurationHours(prev => prev > 0 ? prev - 1 : prev);
  };

  const handleIncrementMinutes = () => {
    if (durationMinutes === 59) {
      if (durationHours < 12) {
        setDurationHours(prev => prev + 1);
        setDurationMinutes(0);
      }
    } else {
      setDurationMinutes(prev => prev + 1);
    }
  };

  const handleDecrementMinutes = () => {
    if (durationMinutes === 0) {
      if (durationHours > 0) {
        setDurationHours(prev => prev - 1);
        setDurationMinutes(59);
      }
    } else {
      setDurationMinutes(prev => prev - 1);
    }
  };

  const handleSaveManualSession = useCallback(async () => {
    if (!selectedProject) {
      alert('Please select a project');
      return;
    }

    setSubmitting(true);
    
    try {
      // Create a Date object from the selected date and time
      const sessionDateTime = combineDateAndTime(sessionDate, sessionTime);
      const sessionRef = doc(collection(db, 'sessions'));
      const elapsedSeconds = getDurationInSeconds();
      const sessionDurationMinutes = Math.round(elapsedSeconds / 60);

      await setDoc(sessionRef, {
        userId: auth.currentUser.uid,
        project: selectedProject.name,
        projectId: selectedProject.id,
        startTime: sessionDateTime,
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
      setSubmitting(false);
      alert('Failed to save session. Please try again.');
    }
  }, [selectedProject, sessionDate, sessionTime, hourRate, currencyId, sessionLabel, navigate, isBillable, getDurationInSeconds]);

  if (loading) {
    return (
      <div className="loading-container">
        <Spinner className="spinning-logo" />
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

      {/* iOS-style Date & Time Picker */}
      <h2 className="projects-label">Session date</h2>
      
      <div className="ios-datetime-picker">
        <div className="ios-picker-container">
          {showDatePicker ? (
            <>
              <div className="ios-picker-header">
                <p className="ios-picker-title">SELECT DATE & TIME</p>
                <div className="ios-date-display">
                  <div className="ios-year">{new Date(sessionDate).getFullYear()}</div>
                  <div className="ios-date-time">
                    <div className="ios-date">{new Date(sessionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                    <div className="ios-time-separator">:</div>
                    <div className="ios-time">{sessionTime}</div>
                    <div className="ios-ampm">
                      <div className={`ios-am ${parseInt(sessionTime.split(':')[0]) < 12 ? 'active' : ''}`}>AM</div>
                      <div className={`ios-pm ${parseInt(sessionTime.split(':')[0]) >= 12 ? 'active' : ''}`}>PM</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="ios-picker-tabs">
                <div 
                  className={`ios-picker-tab ${showDatePicker ? 'active' : ''}`}
                  onClick={() => setShowDatePicker(true)}
                >
                  <CalendarIcon />
                </div>
                <div 
                  className={`ios-picker-tab ${!showDatePicker ? 'active' : ''}`}
                  onClick={() => setShowDatePicker(false)}
                >
                  <ClockIcon />
                </div>
              </div>

              <div className="ios-picker-body">
                <input 
                  type="date" 
                  className="ios-date-input" 
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                />
              </div>
            </>
          ) : (
            <>
              <div className="ios-picker-header">
                <p className="ios-picker-title">SELECT DATE & TIME</p>
                <div className="ios-date-display">
                  <div className="ios-year">{new Date(sessionDate).getFullYear()}</div>
                  <div className="ios-date-time">
                    <div className="ios-date">{new Date(sessionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                    <div className="ios-time-separator">:</div>
                    <div className="ios-time">{sessionTime}</div>
                    <div className="ios-ampm">
                      <div className={`ios-am ${parseInt(sessionTime.split(':')[0]) < 12 ? 'active' : ''}`}>AM</div>
                      <div className={`ios-pm ${parseInt(sessionTime.split(':')[0]) >= 12 ? 'active' : ''}`}>PM</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="ios-picker-tabs">
                <div 
                  className={`ios-picker-tab ${showDatePicker ? 'active' : ''}`}
                  onClick={() => setShowDatePicker(true)}
                >
                  <CalendarIcon />
                </div>
                <div 
                  className={`ios-picker-tab ${!showDatePicker ? 'active' : ''}`}
                  onClick={() => setShowDatePicker(false)}
                >
                  <ClockIcon />
                </div>
              </div>

              <div className="ios-picker-body">
                <input 
                  type="time" 
                  className="ios-time-input" 
                  value={sessionTime}
                  onChange={(e) => setSessionTime(e.target.value)}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Duration Spinner */}
      <h2 className="projects-label">Session duration</h2>
      <div className="ios-duration-picker">
        <div className="ios-duration-container">
          <div className="ios-duration-hours">
            <button 
              className="ios-duration-button ios-duration-up"
              onClick={handleIncrementHours}
              disabled={durationHours >= 12}
            >
              +
            </button>
            <div className="ios-duration-value">{String(durationHours).padStart(2, '0')}</div>
            <button 
              className="ios-duration-button ios-duration-down"
              onClick={handleDecrementHours}
              disabled={durationHours <= 0 && durationMinutes <= 0}
            >
              -
            </button>
          </div>
          <div className="ios-duration-separator">:</div>
          <div className="ios-duration-minutes">
            <button 
              className="ios-duration-button ios-duration-up"
              onClick={handleIncrementMinutes}
              disabled={durationHours >= 12 && durationMinutes >= 59}
            >
              +
            </button>
            <div className="ios-duration-value">{String(durationMinutes).padStart(2, '0')}</div>
            <button 
              className="ios-duration-button ios-duration-down"
              onClick={handleDecrementMinutes}
              disabled={durationHours <= 0 && durationMinutes <= 0}
            >
              -
            </button>
          </div>
        </div>
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
        disabled={!selectedProject || submitting}
      >
        {submitting ? (
          <div className="spinner"></div>
        ) : (
          "Create moment"
        )}
      </button>
    </div>
  );
};

export default TimeTrackerManualPage;
