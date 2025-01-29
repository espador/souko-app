// src/components/Journal/JournalSection.jsx
import React, { useState, useEffect, useCallback } from 'react';
import './JournalSection.css';
import { useNavigate } from 'react-router-dom';
import { format, startOfWeek, addDays } from 'date-fns';
import JournalCountdown from './JournalCountdown';

import { ReactComponent as MoodNeutral } from '../../styles/components/assets/mood-neutral.svg';
import { ReactComponent as MoodInspired } from '../../styles/components/assets/mood-inspired.svg';
import { ReactComponent as MoodFocused } from '../../styles/components/assets/mood-focused.svg';
import { ReactComponent as MoodUnmotivated } from '../../styles/components/assets/mood-unmotivated.svg';
import { ReactComponent as MoodFrustrated } from '../../styles/components/assets/mood-frustrated.svg';
import { ReactComponent as JournalUnfilledIcon } from '../../styles/components/assets/journal-future.svg';
import { ReactComponent as JournalLoadingIcon } from '../../styles/components/assets/journal-loading.svg';

const moodIcons = {
  neutral: MoodNeutral,
  inspired: MoodInspired,
  focused: MoodFocused,
  unmotivated: MoodUnmotivated,
  frustrated: MoodFrustrated,
};

const JournalSection = React.memo(({ journalEntries = [] }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isJournalAvailable, setIsJournalAvailable] = useState(false);
  const navigate = useNavigate();
  const today = new Date();
  const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 1 });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60 * 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const currentHour = currentTime.getHours();
    setIsJournalAvailable(currentHour >= 18 || currentHour < 2);
  }, [currentTime]);

  const getDayButtonStyle = useCallback((dayDate, entryForDay) => {
    const formattedDayDate = format(dayDate, 'yyyy-MM-dd');
    const formattedToday = format(today, 'yyyy-MM-dd');
    if (formattedDayDate === formattedToday) {
      return 'day-button day-button-today';
    } else if (entryForDay) {
      return 'day-button day-button-filled';
    } else if (dayDate < today) {
      return 'day-button day-button-past-unfilled';
    }
    return 'day-button day-button-future';
  }, [today]);

  const handleDayClick = useCallback((index) => {
    const dayDate = addDays(startOfCurrentWeek, index);
    const isToday = format(dayDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');

    if (isToday && !isJournalAvailable) {
      navigate('/journal-countdown');
    } else {
      navigate('/journal-form');
    }
  }, [startOfCurrentWeek, today, isJournalAvailable, navigate]);

  const renderDayButtons = useCallback(() => {
    const dayButtons = [];
    if (Array.isArray(journalEntries)) {
      for (let i = 0; i < 7; i++) {
        const dayDate = addDays(startOfCurrentWeek, i);
        const dayLabel = format(dayDate, 'EEE').charAt(0).toLowerCase();
        const dateKey = format(dayDate, 'yyyy-MM-dd');
        const entryForDay = journalEntries.find(entry => {
          if (entry && entry.timestamp) {
            return format(entry.timestamp.toDate(), 'yyyy-MM-dd') === dateKey;
          }
          return false;
        });

        let MoodIconComponent = null;
        const isToday = format(dayDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
        const isFutureDay = dayDate > today;

        if (isFutureDay) {
          MoodIconComponent = JournalUnfilledIcon;
        } else if (isToday) {
          MoodIconComponent = !isJournalAvailable ? JournalLoadingIcon : (entryForDay ? moodIcons[entryForDay.mood] : JournalLoadingIcon);
        } else {
          MoodIconComponent = entryForDay ? moodIcons[entryForDay.mood] : JournalUnfilledIcon;
        }

        const buttonStyle = getDayButtonStyle(dayDate, entryForDay);
        const dayButtonStyleClass = `day-button-label ${isToday ? 'day-button-label-today' : (dayDate < today ? 'day-button-label-past' : 'day-button-label-future')}`;


        dayButtons.push(
          <div key={i} className="day-container">
            <button
              className={buttonStyle}
              onClick={() => handleDayClick(i)}
              disabled={isToday && !isJournalAvailable}
            >
              {MoodIconComponent && <MoodIconComponent className="mood-icon" />}
            </button>
            <span className={dayButtonStyleClass}>{dayLabel}</span>
          </div>
        );
      }
    }
    return dayButtons;
  }, [startOfCurrentWeek, today, journalEntries, navigate, getDayButtonStyle, isJournalAvailable]);

  return (
    <section className="journal-section">
      <div className="journal-header">
        <h2 className="journal-label">Your journal</h2>
        <div className="journal-all-link">All</div>
      </div>
      <div className="journal-days">
        {renderDayButtons()}
      </div>
    </section>
  );
});

JournalSection.displayName = 'JournalSection';

export default JournalSection;