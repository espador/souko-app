// TimeTrackerTop.jsx
import React, { useEffect, useState } from 'react';

/**
 * Props:
 *  - projectName: string
 *  - hourRate: number
 *  - currencyId: 'euro'|'usd'|'gbp'|etc
 *  - elapsedTime: number (seconds)
 *  - sessionObjective: string (e.g. "8 hours" or "no objective")
 */
const TimeTrackerTop = ({
  projectName = 'Unnamed',
  hourRate = 0,
  currencyId = 'euro',
  elapsedTime = 0,
  sessionObjective = 'no objective',
}) => {
  const [progressPercent, setProgressPercent] = useState(0);

  // --------------------------------------
  // 1) Build the motivational text, with color-coded portions
  // --------------------------------------
  let currencySymbol = '';
  switch (currencyId) {
    case 'usd':
      currencySymbol = '$';
      break;
    case 'gbp':
      currencySymbol = '£';
      break;
    case 'euro':
      currencySymbol = '€';
      break;
    default:
      currencySymbol = '';
  }

  const elapsedHours = elapsedTime / 3600;
  const earned = hourRate * elapsedHours;
  const formattedEarned = earned.toFixed(2).replace('.', ','); 
  const formattedRate   = hourRate.toFixed(2).replace('.', ',');

  let motivationalText;
  if (hourRate > 0) {
    motivationalText = (
      <>
        Time flows into <span className="accent-pink">{projectName}</span>, 
        &nbsp;gaining <span className="accent-purple">{currencySymbol}{formattedEarned}</span> 
        &nbsp;at <span className="accent-purple">{currencySymbol}{formattedRate}</span> per hour. 
        &nbsp;Every moment shapes mastery.
      </>
    );
  } else {
    motivationalText = (
      <>
        Time flows into <span className="accent-pink">{projectName}</span>. 
        &nbsp;Every moment shapes mastery.
      </>
    );
  }

  // --------------------------------------
  // 2) Compute progress bar + objective
  // --------------------------------------
  const hasObjective = sessionObjective !== 'no objective';

  useEffect(() => {
    if (!hasObjective) {
      setProgressPercent(0);
      return;
    }
    // Parse the hours from something like "8 hours"
    const hoursString = sessionObjective.replace(/\D/g, '');
    const objectiveHours = parseFloat(hoursString) || 0;
    if (objectiveHours <= 0) {
      setProgressPercent(0);
      return;
    }
    let ratio = (elapsedHours / objectiveHours) * 100;
    if (ratio < 1 && ratio > 0) {
      ratio = 1;  // ensure a tiny visible bar
    } else if (ratio > 100) {
      ratio = 100; // cap at 100%
    }
    setProgressPercent(ratio);
  }, [hasObjective, sessionObjective, elapsedHours]);

  // Turn the "Session objective" label red if user is over objective
  let labelStyle = {};
  if (hasObjective) {
    const hoursString = sessionObjective.replace(/\D/g, '');
    const objectiveHours = parseFloat(hoursString) || 0;
    if (elapsedHours > objectiveHours) {
      labelStyle = { color: 'red' };
    }
  }

  return (
    <div className="time-tracker-top-container">
      {/* 1) Motivational text */}
      <div className="motivational-section">
        {motivationalText}
      </div>

      {/* 2) Progress bar only if objective != "no objective" */}
      {hasObjective && (
        <div className="objective-progress-container">

          {/* Row with “Session objective” (left) and “8 hours” (right) */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '8px',
            }}
          >
            <span style={labelStyle}>Session objective</span>
            <span style={{ color: '#fff' }}>
              {sessionObjective}
            </span>
          </div>

          <div className="progress-bar">
            <div
              className="progress-bar-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeTrackerTop;
