import React, { useMemo } from 'react';
import '../../styles/global.css';
import { formatTimeFromMinutes } from '../../utils/formatTime';


const LevelProfile = React.memo(({ projectName, totalTrackedTimeMinutes, levelProgressionData }) => { // <-- Receive props


    // Memoize currentLevel calculation
    const currentLevel = useMemo(() => {
        if (!levelProgressionData) return 1;
        let level = 1;
        for (let l = 1; l <= Object.keys(levelProgressionData).length; l++) {
            if (totalTrackedTimeMinutes >= levelProgressionData[l]) {
                level = l;
            } else {
                break;
            }
        }
        return level;
    }, [totalTrackedTimeMinutes, levelProgressionData]);


    // Memoize minutesForCurrentLevel calculation
    const minutesForCurrentLevel = useMemo(() => {
        if (!levelProgressionData || !levelProgressionData[currentLevel - 1]) return 0;
        return levelProgressionData[currentLevel - 1] || 0;
    }, [currentLevel, levelProgressionData]);


    // Memoize minutesForNextLevel calculation
    const minutesForNextLevel = useMemo(() => {
        if (!levelProgressionData) return 60;
        const nextLevel = currentLevel + 1;
        return levelProgressionData[nextLevel] || levelProgressionData[Object.keys(levelProgressionData).length];
    }, [currentLevel, levelProgressionData]);


    // Memoize progressPercentage calculation
    const progressPercentage = useMemo(() => {
        const currentMinutes = minutesForCurrentLevel;
        const nextLevelMinutes = minutesForNextLevel;
        const rangeForLevel = nextLevelMinutes - currentMinutes;
        const trackedInCurrentLevel = totalTrackedTimeMinutes - currentMinutes;


        if (rangeForLevel <= 0) return 100;
        return Math.min(100, Math.max(0, (trackedInCurrentLevel / rangeForLevel) * 100));
    }, [totalTrackedTimeMinutes, minutesForCurrentLevel, minutesForNextLevel]);


    // Memoize timeToLevelUpMinutes calculation
    const timeToLevelUpMinutes = useMemo(() => {
        const nextLevelMinutes = minutesForNextLevel;
        return Math.max(0, nextLevelMinutes - totalTrackedTimeMinutes);
    }, [totalTrackedTimeMinutes, minutesForNextLevel]);


    // Memoize formatted total tracked time
    const formattedTotalTrackedTime = useMemo(() => formatTimeFromMinutes(totalTrackedTimeMinutes), [totalTrackedTimeMinutes]);


    // Memoize formatted time to level up
    const formattedTimeToLevelUp = useMemo(() => formatTimeFromMinutes(timeToLevelUpMinutes), [timeToLevelUpMinutes]);


    if (!levelProgressionData) {
        return <div>Loading Level Data...</div>;
    }


    return (
        <div className="level-profile-container">
            <div className="level-header">
                <span className="project-label">{projectName}</span>
                <div className="level-badge">
                    {currentLevel}
                </div>
            </div>
            <div className="level-stats">
                <span className="total-lvl-time">{formattedTotalTrackedTime}</span> {/* Use memoized formatted time */}
                <span className="time-to-level-up">{formattedTimeToLevelUp} to level up</span> {/* Use memoized formatted time */}
            </div>
            <div className="progress-bar">
                <div className="progress-bar-fill" style={{ width: `${progressPercentage}%` }}></div>
            </div>
        </div>
    );
});


LevelProfile.displayName = 'LevelProfile'; // displayName for React.memo
export default LevelProfile;