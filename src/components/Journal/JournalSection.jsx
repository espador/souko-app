import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format, startOfWeek, addDays, parseISO } from 'date-fns';
import { auth, db } from '../../services/firebase';
import { doc, getDoc } from 'firebase/firestore';

import JournalUnfilledIcon from '../../styles/components/assets/journal-future.png';
import JournalLoadingIcon from '../../styles/components/assets/journal-loading.png';

const moodIcons = {
  neutral: require('../../styles/components/assets/mood-neutral.png'),
  inspired: require('../../styles/components/assets/mood-inspired.png'),
  focused: require('../../styles/components/assets/mood-focused.png'),
  unmotivated: require('../../styles/components/assets/mood-unmotivated.png'),
  frustrated: require('../../styles/components/assets/mood-frustrated.png'),
};

const JournalSection = React.memo(({ journalEntries = [], loading, navigate }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentStreak, setCurrentStreak] = useState(0);
  const [needsJournalEntry, setNeedsJournalEntry] = useState(true);

  // We no longer rely on 'isJournalAvailable' or time-of-day checks. 
  const today = useMemo(() => new Date(), []);
  const startOfCurrentWeek = useMemo(
    () => startOfWeek(today, { weekStartsOn: 1 }),
    [today]
  );

  // Update currentTime once per minute, so the UI can reflect the passage of time (if needed):
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch the user's currentStreak from Firestore once on mount:
  useEffect(() => {
    const fetchStreak = async () => {
      try {
        const user = auth.currentUser;
        if (user) {
          const profileSnap = await getDoc(doc(db, 'profiles', user.uid));
          if (profileSnap.exists()) {
            const profileData = profileSnap.data();
            // Make sure your Cloud Function writes 'currentStreak' to the same doc:
            setCurrentStreak(profileData.currentStreak || 0);
            
            // Check if user has logged a journal entry today
            const lastJournalDate = profileData.lastJournalDate;
            
            if (lastJournalDate) {
              // Convert Firestore timestamp to Date if needed
              const lastDate = lastJournalDate.toDate ? lastJournalDate.toDate() : new Date(lastJournalDate);
              
              // Get today's date (reset to midnight for comparison)
              const todayDate = new Date();
              todayDate.setHours(0, 0, 0, 0);
              
              // Reset lastDate to midnight for comparison
              const lastDateMidnight = new Date(lastDate);
              lastDateMidnight.setHours(0, 0, 0, 0);
              
              // If lastJournalDate is today, user has already logged a journal entry
              setNeedsJournalEntry(lastDateMidnight < todayDate);
            } else {
              // No lastJournalDate means user has never logged a journal entry
              setNeedsJournalEntry(true);
            }
          } else {
            setCurrentStreak(0);
            setNeedsJournalEntry(true);
          }
        }
      } catch (error) {
        console.error('Error fetching streak:', error);
        setCurrentStreak(0);
        setNeedsJournalEntry(true);
      }
    };
    fetchStreak();
  }, []);

  // Safely parse Firestore timestamps:
  const parseDateForJournal = useCallback((date) => {
    if (!date) return null;
    if (date instanceof Date) return date;
    if (typeof date === 'string') return parseISO(date);
    if (typeof date?.toDate === 'function') return date.toDate();
    return null;
  }, []);

  // Navigate to the appropriate journal page when a week-day button is clicked:
  const handleDayClick = useCallback(
    (index) => {
      const dayDate = addDays(startOfCurrentWeek, index);
      const dayDateFormatted = format(dayDate, 'yyyy-MM-dd');

      // Zero out hours for a consistent comparison
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      dayDate.setHours(0, 0, 0, 0);

      const isToday = dayDate.getTime() === todayDate.getTime();
      const isFutureDay = dayDate > todayDate;

      // Find an existing journal entry for that day (if any)
      const entryForDay = journalEntries.find((entry) => {
        const entryCreatedAtDate = parseDateForJournal(entry.createdAt);
        return (
          entryCreatedAtDate &&
          format(entryCreatedAtDate, 'yyyy-MM-dd') === dayDateFormatted
        );
      });

      // Only allow creating or editing for "today" or past days with an entry
      if (isToday) {
        // If we already have an entry for today, we can navigate to edit it
        // Otherwise, open a fresh form
        navigate('journal-form', { selectedDate: dayDateFormatted });
      } else if (!isToday && !isFutureDay) {
        // It's in the past => open if there's an entry
        if (entryForDay) {
          navigate('journal-form', { selectedDate: dayDateFormatted });
        }
      }
      // If it's a future day, do nothing (disabled).
    },
    [startOfCurrentWeek, navigate, journalEntries, parseDateForJournal]
  );

  // Handle click on "How did you feel today?" button
  const handleTodayJournalClick = useCallback(() => {
    const todayFormatted = format(today, 'yyyy-MM-dd');
    navigate('journal-form', { selectedDate: todayFormatted });
  }, [today, navigate]);

  // Generate an array of the 7 days in the current week
  const weekDays = useMemo(() => {
    return [...Array(7)].map((_, i) => addDays(startOfCurrentWeek, i));
  }, [startOfCurrentWeek]);

  // Build the UI for each day in the current week
  const renderDayButtons = useCallback(() => {
    return weekDays.map((dayDate, i) => {
      const dateKey = format(dayDate, 'yyyy-MM-dd');
      const entryForDay = journalEntries.find((entry) => {
        const entryCreatedAtDate = parseDateForJournal(entry.createdAt);
        return (
          entryCreatedAtDate &&
          format(entryCreatedAtDate, 'yyyy-MM-dd') === dateKey
        );
      });

      const isToday =
        format(dayDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
      const isFutureDay = dayDate > today;
      let MoodIconComponent;

      // Decide which icon to show
      if (isToday) {
        MoodIconComponent = entryForDay
          ? moodIcons[entryForDay.mood]
          : JournalLoadingIcon;
      } else if (isFutureDay) {
        MoodIconComponent = JournalUnfilledIcon;
      } else {
        MoodIconComponent = loading
          ? JournalLoadingIcon
          : entryForDay
          ? moodIcons[entryForDay.mood]
          : JournalUnfilledIcon;
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
        <div className="streak-container">
          <span className="your-streak-text">Streak</span>
          <div className="journal-badge">{currentStreak}</div>
        </div>
      </div>

      <div className="journal-days">{renderDayButtons()}</div>
      
      {needsJournalEntry && (
        <button 
          className="journal-today-button" 
          onClick={handleTodayJournalClick}
        >
          How did you feel today?
        </button>
      )}
    </section>
  );
});

JournalSection.displayName = 'JournalSection';

export default JournalSection;
