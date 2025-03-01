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
  const [isJournalAvailable, setIsJournalAvailable] = useState(false);
  const [currentStreak, setCurrentStreak] = useState(0);

  const today = useMemo(() => new Date(), []);
  const startOfCurrentWeek = useMemo(
    () => startOfWeek(today, { weekStartsOn: 1 }),
    [today]
  );

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setIsJournalAvailable(currentTime.getHours() >= 18);
  }, [currentTime]);

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
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      dayDate.setHours(0, 0, 0, 0);

      const isToday = dayDate.getTime() === todayDate.getTime();
      const currentHour = new Date().getHours();
      const isFutureDay = dayDate > today;

      const entryForDay = journalEntries.find((entry) => {
        const entryCreatedAtDate = parseDateForJournal(entry.createdAt);
        return (
          entryCreatedAtDate &&
          format(entryCreatedAtDate, 'yyyy-MM-dd') === dayDateFormatted
        );
      });

      if (isToday) {
        if (currentHour < 18 && currentHour >= 2) {
          navigate('journal-countdown');
        } else {
          navigate('journal-form', { selectedDate: dayDateFormatted });
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
              navigate('journal-form', { selectedDate: dayDateFormatted });
            }
          }
        }
      }
    },
    [startOfCurrentWeek, navigate, journalEntries, parseDateForJournal, today]
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

      const isToday = format(dayDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
      const isFutureDay = dayDate > today;
      let MoodIconComponent;

      if (isToday) {
        MoodIconComponent = entryForDay ? moodIcons[entryForDay.mood] : JournalLoadingIcon;
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
