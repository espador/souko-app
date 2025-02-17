// src/context/OnboardingContext.jsx
import React, { createContext, useContext, useState } from 'react';

// Create the context
const OnboardingContext = createContext();

// Export a handy hook to consume the context
export const useOnboardingContext = () => useContext(OnboardingContext);

// Provider component that wraps your <App /> in index.js or App.js
export const OnboardingProvider = ({ children }) => {
  const [projectName, setProjectName] = useState('');
  const [hourRate, setHourRate] = useState('');
  const [currencyId, setCurrencyId] = useState('euro');
  const [projectImage, setProjectImage] = useState(null); // We'll store the File or the compressed image
  const [mood, setMood] = useState('focused');           // Default mood

  return (
    <OnboardingContext.Provider
      value={{
        projectName,
        setProjectName,
        hourRate,
        setHourRate,
        currencyId,
        setCurrencyId,
        projectImage,
        setProjectImage,
        mood,
        setMood,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};
