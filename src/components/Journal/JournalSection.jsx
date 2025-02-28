import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format, startOfWeek, addDays, parseISO } from 'date-fns';

// PNG Imports - Memoized import of mood icons
const moodIcons = {
    neutral: require('../../styles/components/assets/mood-neutral.png'),
    inspired: require('../../styles/components/assets/mood-inspired.png'),
    focused: require('../../styles/components/assets/mood-focused.png'),
    unmotivated: require('../../styles/components/assets/mood-unmotivated.png'),
    frustrated: require('../../styles/components/assets/mood-frustrated.png'),
};

// Static imports for non-mood icons - no need to memoize as they are static
import JournalUnfilledIcon from '../../styles/components/assets/journal-future.png';
import JournalLoadingIcon from '../../styles/components/assets/journal-loading.png';


const JournalSection = React.memo(({ journalEntries = [], loading, navigate }) => { // <-- Receive navigate prop
    const [currentTime, setCurrentTime] = useState(new Date());
    const [isJournalAvailable, setIsJournalAvailable] = useState(false);
    const today = useMemo(() => new Date(), []); // Memoize today's date
    const startOfCurrentWeek = useMemo(() => startOfWeek(today, { weekStartsOn: 1 }), [today]); // Memoize startOfWeek


    // Update currentTime every minute - useEffect hook
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60 * 1000);
        return () => clearInterval(timer);
    }, []);


    // Update isJournalAvailable based on currentTime - useEffect hook
    useEffect(() => {
        const currentHour = currentTime.getHours();
        setIsJournalAvailable(currentHour >= 18);
    }, [currentTime]);


    // Memoize parseDateForJournal function
    const parseDateForJournal = useCallback((date) => {
        if (!date) return null;
        if (date instanceof Date) return date;
        if (typeof date === 'string') return parseISO(date);
        if (typeof date?.toDate === 'function') return date.toDate();
        return null;
    }, []);


    // Handle day click - useCallback for memoization
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
                    navigate('journal-countdown');
                } else {
                    // Corrected line: Pass selectedDate as part of the state
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
                            // Corrected line: Pass selectedDate as part of the state
                            navigate('journal-form', { selectedDate: dayDateFormatted });
                        }
                    }
                }
            }
        },
        [startOfCurrentWeek, navigate, journalEntries, parseDateForJournal]
    );


    // Memoize weekDays array
    const weekDays = useMemo(() => {
        return [...Array(7)].map((_, i) => addDays(startOfCurrentWeek, i));
    }, [startOfCurrentWeek]);


    // Render day buttons - useCallback for memoization
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
                MoodIconComponent = entryForDay ? moodIcons[entryForDay.mood] : JournalLoadingIcon;
            } else if (isFutureDay) {
                MoodIconComponent = JournalUnfilledIcon;
            } else {
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
    }, [weekDays, today, journalEntries, loading, handleDayClick, parseDateForJournal]); // Dependencies for useCallback


    return (
        <section className="journal-section">
            <div className="journal-header">
                <h2 className="journal-label">Your journal</h2>
                <button onClick={() => navigate('journal-overview')} className="journal-all-link">All</button>
            </div>
            <div className="journal-days">{renderDayButtons()}</div>
        </section>
    );
});


JournalSection.displayName = 'JournalSection'; // displayName for React.memo
export default JournalSection;