// src/context/OnboardingContext.jsx
import React, { createContext, useContext, useState, useRef, useEffect, useMemo } from 'react'; // Import useMemo

// Create the context
const OnboardingContext = createContext();

// Export a handy hook to consume the context
export const useOnboardingContext = () => useContext(OnboardingContext);

// Provider component that wraps your <App /> in index.js or App.js
export const OnboardingProvider = ({ children }) => {
  console.log("OnboardingProvider - RENDER START"); // <--- ADD THIS LOG

  const [projectName, setProjectName] = useState('');
  const [hourRate, setHourRate] = useState('');
  const [currencyId, setCurrencyId] = useState('euro');
  const [projectImage, setProjectImage] = useState(null); // We'll store the File or the compressed image
  const [mood, setMood] = useState('focused');           // Default mood

  const contextValue = useMemo(() => ({ // Memoize contextValue using useMemo
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
  }), [projectName, hourRate, currencyId, projectImage, mood]); // Dependency array for useMemo


  // useRef to track previous context value for comparison (logging - keep for debugging)
  const previousContextValueRef = useRef(null);

  useEffect(() => {
    if (previousContextValueRef.current) {
      const prevValue = previousContextValueRef.current;
      const currentValue = contextValue;

      const hasContextValueChanged =
        prevValue.projectName !== currentValue.projectName ||
        prevValue.hourRate !== currentValue.hourRate ||
        prevValue.currencyId !== currentValue.currencyId ||
        prevValue.projectImage !== currentValue.projectImage || // Note: File/object comparison might not be reliable
        prevValue.mood !== currentValue.mood;


      console.log("OnboardingProvider - Context Value Changed:", hasContextValueChanged);
      if (!hasContextValueChanged) {
        console.log("OnboardingProvider - CONTEXT VALUE OBJECT REFERENCE CHANGED BUT DATA UNCHANGED");
      }

    } else {
      console.log("OnboardingProvider - Initial Render - Context Value Set");
    }
    previousContextValueRef.current = contextValue;
    console.log("OnboardingProvider - Context Value:", contextValue);

  });


  console.log("OnboardingProvider - RENDER END");   // <--- ADD THIS LOG

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}
    </OnboardingContext.Provider>
  );
};