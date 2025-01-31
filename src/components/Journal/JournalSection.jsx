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
    setIsJournalAvailable(currentHour >= 18 || currentHour < 2); // Journal available from 6 PM to 2 AM
  }, [currentTime]);

  const handleDayClick = useCallback(
    (index) => {
        console.log("handleDayClick FUNCTION IS BEING CALLED!");
        const dayDate = addDays(startOfCurrentWeek, index);
        const dayDateFormatted = format(dayDate, 'yyyy-MM-dd');
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);
        dayDate.setHours(0, 0, 0, 0);

        const isToday = dayDate.getTime() === todayDate.getTime();
        const currentHour = new Date().getHours();


        const isFutureDay = dayDate > today;
        const entryForDay = journalEntries.find(
            (entry) => entry?.createdAt && format(entry.createdAt.toDate(), 'yyyy-MM-dd') === dayDateFormatted
        );


        console.log("📌 Clicked Day Index:", index);
        console.log("📅 Day Date:", dayDateFormatted);
        console.log("📆 Today:", format(todayDate, 'yyyy-MM-dd'));
        console.log("⏰ Current Hour:", currentHour);
        console.log("⚡ isToday:", isToday);
        console.log("🔮 isFutureDay:", isFutureDay);
        console.log("📝 entryForDay:", !!entryForDay);


        if (isToday) {
            if (currentHour < 18 && currentHour >= 2) {
                console.log("🟠 Navigating to: /journal-countdown");
                navigate('/journal-countdown');
            } else {
                console.log("🟢 Navigating to: /journal-form");
                navigate(`/journal-form?date=${dayDateFormatted}`); // Explicitly added date param here as well for extra safety
            }
        } else if (!isToday && !isFutureDay) {
            if (entryForDay) {
                if (entryForDay.createdAt) {
                    const entryTimestamp = entryForDay.createdAt.toDate();
                    const entryHour = entryTimestamp.getHours();
                    const isWithinEditWindow = (entryHour >= 18 || entryHour < 2) && format(entryTimestamp, 'yyyy-MM-dd') === dayDateFormatted;

                    if (isWithinEditWindow) {
                        console.log("📂 Navigating to JournalForm for past day WITH entry AND within edit window:", dayDateFormatted);
                        navigate(`/journal-form?date=${dayDateFormatted}`); // Explicitly added date param here as well for extra safety
                    } else {
                        console.log("🔒 Past day entry exists, but NOT within edit window.");
                        return;
                    }
                } else {
                    console.log("⚠️ Past day entry exists, but createdAt is missing. Navigation prevented for safety.");
                    return;
                }

            } else {
                console.log("❌ Past day WITHOUT entry, no navigation.");
                return;
            }
        } else if (isFutureDay) {
            console.log("❌ Future day, no navigation.");
        }
    },
    [startOfCurrentWeek, navigate, journalEntries, today]
);


  const renderDayButtons = useCallback(() => {
    return [...Array(7)].map((_, i) => {
      const dayDate = addDays(startOfCurrentWeek, i);
      const dateKey = format(dayDate, 'yyyy-MM-dd');
      const entryForDay = journalEntries.find(
        (entry) => entry?.createdAt && format(entry.createdAt.toDate(), 'yyyy-MM-dd') === dateKey
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
          MoodIconComponent = JournalUnfilledIcon;
          console.log("JournalSection - No entry for TODAY:", format(dayDate, 'yyyy-MM-dd'));
        }
      } else { // Past days
        if (loading) {
          MoodIconComponent = JournalLoadingIcon;
        } else if (entryForDay) {
          console.log("JournalSection - entryForDay.mood (past day):", entryForDay.mood);
          MoodIconComponent = moodIcons[entryForDay.mood];
          console.log("JournalSection - MoodIconComponent for", format(dayDate, 'yyyy-MM-dd'), ":", MoodIconComponent);
        } else {
          MoodIconComponent = JournalUnfilledIcon;
          console.log("JournalSection - No entry for PAST DAY:", format(dayDate, 'yyyy-MM-dd'));
        }
      }

      return (
        <div key={i} className="day-container">
          <button
            className={`day-button ${isToday ? 'day-button-today' : ''}`}
            onClick={() => {
                console.log("BUTTON CLICKED!", i);
                handleDayClick(i);
            }}
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