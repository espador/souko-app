import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './JournalCountdown.css';
import Header from '../Layout/Header';
import '../../styles/global.css';
import { TextGenerateEffect } from '../../styles/components/text-generate-effect.tsx';

const JournalCountdown = React.memo(({ navigate }) => { // <-- Receive navigate as prop
    const [timeLeft, setTimeLeft] = useState(calculateTimeLeft); // Initialize state directly with function

    // Memoize calculateTimeLeft function
    const calculateTimeLeft = useCallback(() => {
        const now = new Date();
        const targetTime = new Date(now);

        targetTime.setHours(18, 0, 0, 0);

        if (now.getHours() >= 18) {
            targetTime.setDate(targetTime.getDate() + 1);
        }

        const difference = targetTime.getTime() - now.getTime();

        if (difference <= 0) {
            return { hours: 0, minutes: 0, seconds: 0 };
        }

        let hours = Math.floor((difference / (1000 * 60 * 60)));
        let minutes = Math.floor((difference / 1000 / 60) % 60);
        let seconds = Math.floor((difference / 1000) % 60);

        return { hours, minutes, seconds };
    }, []); // No dependencies as it's self-contained

    useEffect(() => {
        const intervalId = setInterval(() => {
            setTimeLeft(calculateTimeLeft()); // Use memoized function to update state
        }, 1000);

        return () => clearInterval(intervalId);
    }, [calculateTimeLeft]); // Depend on memoized calculateTimeLeft


    const handleReturnHome = useCallback(() => {
        navigate('home'); // <-- Updated navigate call, page name as string
    }, [navigate]);


    const handleSetReminder = useCallback(() => {
        alert('Reminder set for 6 PM!');
    }, []);


    // Memoize timeLeft values for display
    const countdownDisplay = useMemo(() => {
        return `${String(timeLeft.hours).padStart(2, '0')}h ${String(timeLeft.minutes).padStart(2, '0')}m ${String(timeLeft.seconds).padStart(2, '0')}s`;
    }, [timeLeft]);


    return (
        <div className="journal-countdown-page">
            <Header
                variant="journalOverview"
                showBackArrow={true}
                navigate={navigate} // <-- Pass navigate prop to Header
            />
            <main className="journal-countdown-content">
                <section className="motivational-section">
                    <TextGenerateEffect
                        words={`The song of your roots is the song of now.`}
                        className="journal-countdown-quote"
                    />
                    <p className="journal-countdown-quote-description">Revisit Souko in</p>
                    <span id="countdown-timer" className="countdown-timer journal-countdown-quote"> {/* Applying quote style for consistent font */}
            {countdownDisplay} {/* Use memoized countdownDisplay for rendering */}
          </span>
                </section>


                <div className="journal-countdown-buttons sticky-button"> {/* ADD CLASS HERE */}
                    <button className="journal-countdown-button" onClick={handleReturnHome}>Return home</button>
                    <button className="journal-countdown-button" onClick={handleSetReminder}>Set reminder</button>
                </div>
            </main>
        </div>
    );
});


JournalCountdown.displayName = 'JournalCountdown'; // Recommended for React.memo
export default JournalCountdown;