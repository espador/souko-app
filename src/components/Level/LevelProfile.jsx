// src/components/Level/LevelProfile.jsx
import React, { useMemo } from 'react';
import './LevelProfile.css';
import { formatTimeFromMinutes } from '../../utils/formatTime';

const LevelProfile = ({ projectName, totalTrackedTimeMinutes, levelProgressionData }) => {

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

    const minutesForCurrentLevel = useMemo(() => {
        if (!levelProgressionData || !levelProgressionData[currentLevel - 1]) return 0; // Added check for undefined level
        return levelProgressionData[currentLevel - 1] || 0;
    }, [currentLevel, levelProgressionData]);

    const minutesForNextLevel = useMemo(() => {
        if (!levelProgressionData) return 60;
        const nextLevel = currentLevel + 1;
        return levelProgressionData[nextLevel] || levelProgressionData[Object.keys(levelProgressionData).length];
    }, [currentLevel, levelProgressionData]);

    const progressPercentage = useMemo(() => {
        const currentMinutes = minutesForCurrentLevel;
        const nextLevelMinutes = minutesForNextLevel;
        const rangeForLevel = nextLevelMinutes - currentMinutes;
        const trackedInCurrentLevel = totalTrackedTimeMinutes - currentMinutes;

        if (rangeForLevel <= 0) return 100;
        return Math.min(100, Math.max(0, (trackedInCurrentLevel / rangeForLevel) * 100));
    }, [totalTrackedTimeMinutes, minutesForCurrentLevel, minutesForNextLevel]);

    const timeToLevelUpMinutes = useMemo(() => {
        const nextLevelMinutes = minutesForNextLevel;
        return Math.max(0, nextLevelMinutes - totalTrackedTimeMinutes);
    }, [totalTrackedTimeMinutes, minutesForNextLevel]);


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
                <span className="total-lvl-time">{formatTimeFromMinutes(totalTrackedTimeMinutes)}</span>
                <span className="time-to-level-up">{formatTimeFromMinutes(timeToLevelUpMinutes)} to level up</span>
            </div>
            <div className="progress-bar">
                <div className="progress-bar-fill" style={{ width: `${progressPercentage}%` }}></div>
            </div>
        </div>
    );
};

export default LevelProfile;