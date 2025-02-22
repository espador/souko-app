// src/components/Journal/JournalSection.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './JournalSection.css';
import { useNavigate, Link } from 'react-router-dom'; // Added Link here
import { format, startOfWeek, addDays, parseISO } from 'date-fns';

// PNG Imports
import MoodNeutral from '../../styles/components/assets/mood-neutral.png';
import MoodInspired from '../../styles/components/assets/mood-inspired.png';
import MoodFocused from '../../styles/components/assets/mood-focused.png';
import MoodUnmotivated from '../../styles/components/assets/mood-unmotivated.png';
import MoodFrustrated from '../../styles/components/assets/mood-frustrated.png';
import JournalUnfilledIcon from '../../styles/components/assets/journal-future.png';
import JournalLoadingIcon from '../../styles/components/assets/journal-loading.png';

const moodIcons = {
  neutral: MoodNeutral,
  inspired: MoodInspired,
  focused: MoodFocused,
  unmotivated: MoodUnmotivated,
  frustrated: MoodFrustrated,
};

const JournalSection = React.memo(({ journalEntries = [], loading }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isJournalAvailable, setIsJournalAvailable] = useState(false);
  const navigate = useNavigate();
  const today = new Date();
  const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 1 });

  // Update currentTime every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);


  useEffect(() => {
    const currentHour = currentTime.getHours();
    setIsJournalAvailable(currentHour >= 18);
  }, [currentTime]);

  const parseDateForJournal = useCallback((date) => {
    if (!date) return null;
    if (date instanceof Date) return date; // Already a Date object
    if (typeof date === 'string') {
      return parseISO(date); // Parse ISO string if it's a string
    }
    // If it's a Firebase Timestamp object
    if (typeof date?.toDate === 'function') {
      return date.toDate();
    }
    return null; // Return null if cannot parse
  }, []);


  const handleDayClick = useCallback(
    (index) => {
      const dayDate = addDays(startOfCurrentWeek, index);
      const dayDateFormatted = format(dayDate, 'yyyy-MM-dd');
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      dayDate.setHours(0, 0, 0, 0);

      const isToday = dayDate.getTime() === todayDate.getTime();
      const currentHour = new Date().getHours();
      const isFutureDay = dayDate > today;

      const entryForDay = journalEntries.find(
        (entry) => {
          const entryCreatedAtDate = parseDateForJournal(entry.createdAt);
          return entryCreatedAtDate && format(entryCreatedAtDate, 'yyyy-MM-dd') === dayDateFormatted;
        }
      );

      if (isToday) {
        if (currentHour < 18 && currentHour >= 2) {
          navigate('/journal-countdown');
        } else {
          navigate(`/journal-form?date=${dayDateFormatted}`);
        }
      } else if (!isToday && !isFutureDay) {
        if (entryForDay && entryForDay.createdAt) {
          const entryTimestamp = parseDateForJournal(entryForDay.createdAt);
          if (entryTimestamp) {
            const entryHour = entryTimestamp.getHours();
            const isWithinEditWindow =
              (entryHour >= 18 || entryHour < 2) &&
              format(entryTimestamp, 'yyyy-MM-dd') === dayDateFormatted;
            if (isWithinEditWindow) {
              navigate(`/journal-form?date=${dayDateFormatted}`);
            }
          }
        }
      }
    },
    [startOfCurrentWeek, navigate, journalEntries, today, parseDateForJournal]
  );

  // Precompute the days of the current week
  const weekDays = useMemo(() => {
    return [...Array(7)].map((_, i) => addDays(startOfCurrentWeek, i));
  }, [startOfCurrentWeek]);

  const renderDayButtons = useCallback(() => {
    return weekDays.map((dayDate, i) => {
      const dateKey = format(dayDate, 'yyyy-MM-dd');
      const entryForDay = journalEntries.find(
        (entry) => {
          const entryCreatedAtDate = parseDateForJournal(entry.createdAt);
          return entryCreatedAtDate && format(entryCreatedAtDate, 'yyyy-MM-dd') === dateKey;
        }
      );

      const isToday = format(dayDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
      const isFutureDay = dayDate > today;
      let MoodIconComponent;

      if (isToday) {
        // For current day: show mood icon if entry exists, otherwise show loading icon.
        MoodIconComponent = entryForDay ? moodIcons[entryForDay.mood] : JournalLoadingIcon;
      } else if (isFutureDay) {
        MoodIconComponent = JournalUnfilledIcon;
      } else {
        // For past days: if loading, show loading icon; otherwise, show mood icon if available.
        MoodIconComponent = loading
          ? JournalLoadingIcon
          : (entryForDay ? moodIcons[entryForDay.mood] : JournalUnfilledIcon);
      }

      return (
        <div key={i} className="day-container">
          <button
            className={`day-button ${isToday ? 'day-button-today' : ''}`}
            onClick={() => handleDayClick(i)}
            disabled={isFutureDay}
          >
            <img src={MoodIconComponent} alt="Mood Icon" className="mood-icon" />
          </button>
          <span
            className={`day-button-label ${
              isToday
                ? 'day-button-label-today'
                : isFutureDay
                ? 'day-button-label-future'
                : 'day-button-label-past'
            }`}
          >
            {format(dayDate, 'EEE').charAt(0).toLowerCase()}
          </span>
        </div>
      );
    });
  }, [weekDays, today, journalEntries, loading, handleDayClick, parseDateForJournal]);

  return (
    <section className="journal-section">
      <div className="journal-header">
        <h2 className="journal-label">Your journal</h2>
        <Link to="/journal-overview" className="journal-all-link">All</Link>
      </div>
      <div className="journal-days">{renderDayButtons()}</div>
    </section>
  );
});

JournalSection.displayName = 'JournalSection';

export default JournalSection;