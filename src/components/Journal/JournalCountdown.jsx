// src/components/Journal/JournalCountdown.jsx
import React, { useState, useEffect } from 'react';
import './JournalCountdown.css';
import { useNavigate } from 'react-router-dom'; // Import useNavigate
import Header from '../Layout/Header'; // Import Header with corrected path
import '../../styles/global.css'; // Import global styles

const JournalCountdown = () => {
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());
  const navigate = useNavigate();

  useEffect(() => {
    const intervalId = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000); // Update every second

    return () => clearInterval(intervalId); // Cleanup on unmount
  }, []);

  function calculateTimeLeft() {
    const now = new Date();
    const targetTime = new Date(now); // Clone current date

    // Set target time to 18:00 (6 PM) today
    targetTime.setHours(18, 0, 0, 0);

    // If current time is already past 18:00 today, you might want to adjust target to tomorrow 18:00
    if (now.getHours() >= 18) {
      targetTime.setDate(targetTime.getDate() + 1); // Set to tomorrow
    }

    const difference = targetTime.getTime() - now.getTime();

    if (difference <= 0) {
      return { hours: 0, minutes: 0, seconds: 0 }; // Time has reached 18:00 or passed
    }

    let hours = Math.floor((difference / (1000 * 60 * 60)));
    let minutes = Math.floor((difference / 1000 / 60) % 60);
    let seconds = Math.floor((difference / 1000) % 60);

    return { hours, minutes, seconds };
  }

  const handleReturnHome = () => {
    navigate('/home'); // Navigate to homepage
  };

  const handleSetReminder = () => {
    // Implement reminder setting logic here (e.g., using browser notifications or device calendar)
    alert('Reminder set for 6 PM!'); // Placeholder for reminder functionality
  };

  return (
    <div className="journal-countdown-page"> {/* Changed container class name to page */}
      <Header
        title=""
        showBackArrow={true}
        onBack={() => navigate('/home')}
        hideProfile={true}
      />
      <main className="journal-countdown-content"> {/* Added main content container */}
        <section className="motivational-section"> {/* Added motivational section for consistent styling */}
          <h1 className="journal-countdown-quote">
            The song of your roots is the song of now. Revisit in <span id="countdown-timer">
              {String(timeLeft.hours).padStart(2, '0')}h {String(timeLeft.minutes).padStart(2, '0')}m {String(timeLeft.seconds).padStart(2, '0')}s
            </span>
          </h1>
        </section>
        <div className="journal-countdown-buttons">
          <button className="journal-countdown-button" onClick={handleReturnHome}>Return home</button>
          <button className="journal-countdown-button" onClick={handleSetReminder}>Set reminder</button>
        </div>
      </main>
    </div>
  );
};

export default JournalCountdown;