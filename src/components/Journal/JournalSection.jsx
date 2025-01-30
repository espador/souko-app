// src/components/Journal/JournalSection.jsx
import React, { useState, useEffect, useCallback } from 'react';
import './JournalSection.css';
import { useNavigate } from 'react-router-dom';
import { format, startOfWeek, addDays } from 'date-fns';

// PNG Imports instead of ReactComponents from SVG
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

console.log("JournalSection - moodIcons object:", moodIcons);

const JournalSection = React.memo(({ journalEntries = [], loading }) => {
  console.log("JournalSection - journalEntries prop:", journalEntries);
  console.log("JournalSection - loading prop:", loading);

  const [currentTime, setCurrentTime] = useState(new Date());
  const [isJournalAvailable, setIsJournalAvailable] = useState(false);
  const navigate = useNavigate();
  const today = new Date();
  const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 1 });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const currentHour = currentTime.getHours();
    setIsJournalAvailable(currentHour >= 18 || currentHour < 2);
  }, [currentTime]);

  const handleDayClick = useCallback(
    (index) => {
      const dayDate = addDays(startOfCurrentWeek, index);
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      dayDate.setHours(0, 0, 0, 0);

      const isToday = dayDate.getTime() === todayDate.getTime();
      const currentHour = new Date().getHours();

      console.log("📌 Clicked Day Index:", index);
      console.log("📅 Day Date:", format(dayDate, 'yyyy-MM-dd'));
      console.log("📆 Today:", format(todayDate, 'yyyy-MM-dd'));
      console.log("⏰ Current Hour:", currentHour);
      console.log("⚡ isToday:", isToday);

      if (isToday) {
        if (currentHour < 18 && currentHour >= 2) {
          console.log("🟠 Navigating to: /journal-countdown");
          setTimeout(() => navigate('/journal-countdown'), 0);
        } else {
          console.log("🟢 Navigating to: /journal-form");
          navigate('/journal-form');
        }
      } else {
        console.log("❌ Not today, no navigation.");
      }
    },
    [startOfCurrentWeek, navigate]
  );

  const renderDayButtons = useCallback(() => {
    return [...Array(7)].map((_, i) => {
      const dayDate = addDays(startOfCurrentWeek, i);
      const dateKey = format(dayDate, 'yyyy-MM-dd');
      const entryForDay = journalEntries.find(
        (entry) => entry?.timestamp && format(entry.timestamp.toDate(), 'yyyy-MM-dd') === dateKey
      );

      console.log(`JournalSection - Day: ${format(dayDate, 'yyyy-MM-dd')}, entryForDay:`, entryForDay);

      const isToday = format(dayDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
      const isFutureDay = dayDate > today;

      let MoodIconComponent = JournalUnfilledIcon;

      if (isFutureDay) {
        MoodIconComponent = JournalUnfilledIcon;
      } else if (isToday) {
        if (!isJournalAvailable) {
          MoodIconComponent = JournalLoadingIcon;
        } else if (loading) {
          MoodIconComponent = JournalLoadingIcon;
        } else if (entryForDay) {
          console.log("JournalSection - entryForDay.mood (isToday):", entryForDay.mood);
          MoodIconComponent = moodIcons[entryForDay.mood];
          console.log("JournalSection - MoodIconComponent for", format(dayDate, 'yyyy-MM-dd'), ":", MoodIconComponent);
        } else {
          MoodIconComponent = JournalUnfilledIcon; // Use unfilled if no entry for today
          console.log("JournalSection - No entry for TODAY:", format(dayDate, 'yyyy-MM-dd')); // ADDED LOG
        }
      } else { // Past days
        if (loading) {
          MoodIconComponent = JournalLoadingIcon;
        } else if (entryForDay) {
          console.log("JournalSection - entryForDay.mood (past day):", entryForDay.mood);
          MoodIconComponent = moodIcons[entryForDay.mood];
          console.log("JournalSection - MoodIconComponent for", format(dayDate, 'yyyy-MM-dd'), ":", MoodIconComponent);
        } else {
          MoodIconComponent = JournalUnfilledIcon; // Use unfilled if no entry for past day
          console.log("JournalSection - No entry for PAST DAY:", format(dayDate, 'yyyy-MM-dd')); // ADDED LOG
        }
      }

      return (
        <div key={i} className="day-container">
          <button
            className={`day-button ${isToday ? 'day-button-today' : ''}`}
            onClick={() => handleDayClick(i)}
            disabled={isFutureDay}
          >
            {MoodIconComponent && <img src={MoodIconComponent} alt="Mood Icon" className="mood-icon" />}
          </button>
          <span className="day-label">{format(dayDate, 'EEE').charAt(0).toLowerCase()}</span>
        </div>
      );
    });
  }, [startOfCurrentWeek, today, journalEntries, isJournalAvailable, handleDayClick, loading, moodIcons]);

  return (
    <section className="journal-section">
      <div className="journal-header">
        <h2 className="journal-label">Your journal</h2>
        <div className="journal-all-link">All</div>
      </div>
      <div className="journal-days">{renderDayButtons()}</div>
    </section>
  );
});

JournalSection.displayName = 'JournalSection';

export default JournalSection;