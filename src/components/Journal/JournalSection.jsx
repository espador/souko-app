import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format, startOfWeek, addDays, parseISO } from 'date-fns';
import { auth, db } from '../../services/firebase';
import { doc, getDoc } from 'firebase/firestore';

import JournalUnfilledIcon from '../../styles/components/assets/journal-future.png';
import JournalLoadingIcon from '../../styles/components/assets/journal-loading.png';

// If you have actual import paths for these mood icons, keep them. 
// Otherwise, the require statements are fine:
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
          } else {
            setCurrentStreak(0);
          }
        }
      } catch (error) {
        console.error('Error fetching streak:', error);
        setCurrentStreak(0);
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
        <h2 className="journal-label">Journal streak</h2>
        {/* We display the user’s currentStreak in a “badge” */}
        <div className="journal-badge">{currentStreak}</div>
      </div>
      <div className="journal-days">{renderDayButtons()}</div>
    </section>
  );
});

JournalSection.displayName = 'JournalSection';

export default JournalSection;
