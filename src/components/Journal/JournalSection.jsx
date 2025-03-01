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

  // REMOVED: isJournalAvailable
  // const [isJournalAvailable, setIsJournalAvailable] = useState(false);

  // CHANGED: We no longer rely on restricted hours; we just consider "today" once per day
  const today = useMemo(() => new Date(), []);
  const startOfCurrentWeek = useMemo(
    () => startOfWeek(today, { weekStartsOn: 1 }),
    [today]
  );

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  // REMOVED: We no longer set isJournalAvailable by hour
  // useEffect(() => {
  //   setIsJournalAvailable(currentTime.getHours() >= 18);
  // }, [currentTime]);

  useEffect(() => {
    const fetchStreak = async () => {
      try {
        const user = auth.currentUser;
        if (user) {
          const profileSnap = await getDoc(doc(db, 'profiles', user.uid));
          if (profileSnap.exists()) {
            const profileData = profileSnap.data();
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

  const parseDateForJournal = useCallback((date) => {
    if (!date) return null;
    if (date instanceof Date) return date;
    if (typeof date === 'string') return parseISO(date);
    if (typeof date?.toDate === 'function') return date.toDate();
    return null;
  }, []);

  const handleDayClick = useCallback(
    (index) => {
      const dayDate = addDays(startOfCurrentWeek, index);
      const dayDateFormatted = format(dayDate, 'yyyy-MM-dd');

      // Zero out hours/mins/seconds for a consistent comparison
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      dayDate.setHours(0, 0, 0, 0);

      const isToday = dayDate.getTime() === todayDate.getTime();
      const isFutureDay = dayDate > todayDate; // compare zeroed

      const entryForDay = journalEntries.find((entry) => {
        const entryCreatedAtDate = parseDateForJournal(entry.createdAt);
        return (
          entryCreatedAtDate &&
          format(entryCreatedAtDate, 'yyyy-MM-dd') === dayDateFormatted
        );
      });

      // CHANGED: We removed the hour-based restriction
      // Only allow navigating for "today" or for a day that has an existing entry
      if (isToday) {
        if (entryForDay) {
          // We already have an entry for today — maybe allow editing or direct to the same form
          navigate('journal-form', { selectedDate: dayDateFormatted });
        } else {
          // No entry for today => create it
          navigate('journal-form', { selectedDate: dayDateFormatted });
        }
      } else if (!isToday && !isFutureDay) {
        // It's in the past => only navigate if there's an entry (read-only or edit if you want)
        if (entryForDay) {
          navigate('journal-form', { selectedDate: dayDateFormatted });
        }
      }
      // If it's a future day, we do nothing (disabled)
    },
    [startOfCurrentWeek, navigate, journalEntries, parseDateForJournal]
  );

  const weekDays = useMemo(() => {
    return [...Array(7)].map((_, i) => addDays(startOfCurrentWeek, i));
  }, [startOfCurrentWeek]);

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
        <div className="journal-badge">{currentStreak}</div>
      </div>
      <div className="journal-days">{renderDayButtons()}</div>
    </section>
  );
});

JournalSection.displayName = 'JournalSection';

export default JournalSection;
