// src/utils/formatTime.js
export const formatTime = (totalSeconds) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const parts = [];
  if (hours > 0) {
      parts.push(`${hours}h`);
  }
  if (minutes > 0 || hours > 0) { // Show minutes if hours are present or minutes are non-zero
      parts.push(`${minutes}m`);
  }
  if (seconds > 0 && hours === 0 && minutes === 0) { // Show seconds only if no hours and no minutes
      parts.push(`${seconds}s`);
  }

  return parts.join(' ').trim();
};


export const formatTimeFromMinutes = (totalMinutes) => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.floor(totalMinutes % 60);

  const parts = [];
  if (hours > 0) {
      parts.push(`${hours}h`);
  }
  if (minutes > 0 || hours > 0) { // Show minutes if hours are present or minutes are non-zero
      parts.push(`${minutes}m`);
  }

  return parts.join(' ').trim() || '0m'; // Return '0m' if totalMinutes is 0
};