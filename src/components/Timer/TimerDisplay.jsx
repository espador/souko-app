import React, { memo } from 'react';

// *** TimerDisplay Component - Memoized ***
const TimerDisplay = memo(({ timer, isPaused }) => {
  console.log("TimerDisplay component rendered"); // *** ADDED: TimerDisplay Render Log ***
  return (
    <div className={`timer ${isPaused ? 'paused' : ''}`}>
      {new Date(timer * 1000).toISOString().substr(11, 8)}
    </div>
  );
});
TimerDisplay.displayName = 'TimerDisplay'; // Optional, for better React DevTools naming

export default TimerDisplay;