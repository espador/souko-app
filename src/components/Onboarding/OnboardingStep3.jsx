// src/components/Onboarding/OnboardingStep3.jsx
import React, { useState, useCallback } from 'react';
// REMOVED: import { useNavigate } from 'react-router-dom'; // <-- REMOVE useNavigate import
import Header from '../Layout/Header';
import '../../styles/global.css';
import { TextGenerateEffect } from '../../styles/components/text-generate-effect.tsx';
import Slider from '@mui/material/Slider';
import { ReactComponent as SaveIcon } from '../../styles/components/assets/save.svg';
import { useOnboardingContext } from '../../contexts/OnboardingContext';

const moodPoints = [0, 25, 50, 75, 100];
const moodOptions = [
  { value: 'frustrated', label: 'Frustrated' },
  { value: 'unmotivated', label: 'Unmotivated' },
  { value: 'neutral',    label: 'Neutral' },
  { value: 'focused',    label: 'Focused' },
  { value: 'inspired',   label: 'Inspired' },
];

const moodScale = (value) => {
  let moodIndex = -1;
  for (let i = 0; i < moodPoints.length; i++) {
    if (value <= moodPoints[i]) {
      moodIndex = i;
      break;
    }
  }
  if (moodIndex === -1) moodIndex = moodPoints.length - 1;
  return moodIndex;
};

const reverseMoodScale = (index) => {
  return moodPoints[index] || 0;
};

const moodMarks = moodOptions.map((_, index) => ({
  value: reverseMoodScale(index),
  label: '',
}));

function OnboardingStep3({ navigate }) { // <-- Receive navigate prop
  // REMOVED: const navigate = useNavigate(); // <-- REMOVE useNavigate hook

  // Use the mood from context
  const { mood, setMood } = useOnboardingContext();

  // We'll keep a local sliderValue if you like the real-time effect:
  const [sliderValue, setSliderValue] = useState(75);

  const handleSliderChange = useCallback((_, newValue) => {
    let moodIndex = moodScale(newValue);
    if (moodIndex >= 0 && moodIndex < moodOptions.length) {
      setMood(moodOptions[moodIndex].value);
    }
    setSliderValue(newValue);
  }, [setMood]);

  const handleLogMood = () => {
    // We already set mood in context via slider
    navigate('onboarding-step4'); // <-- Updated navigate call, page name as string
  };

  const currentMoodLabel = moodOptions.find(option => option.value === mood)?.label || 'Focused';

  return (
    <div className="onboarding-step3">
      <Header variant="onboarding" currentStep={3} navigate={navigate} /> {/* ✅ Pass navigate prop to Header */}
      <main className="onboarding-step3-content">
        <section className="motivational-section">
          <TextGenerateEffect
            words={`In stillness,\nprogress takes its <span class="accent-text">form</span>.\nReflect on your process to refine your flow.`}
            element="h1"
          />
        </section>

        <div className="divider"></div>

        <div className="mood-container">
          <p className="mood-label">
            Mood: <span className="mood-value">{currentMoodLabel}</span>
          </p>
          <div className="mood-slider-container">
            <Slider
              aria-label="mood-slider"
              defaultValue={reverseMoodScale(moodOptions.findIndex(opt => opt.value === mood))}
              step={null}
              marks={moodMarks}
              min={0}
              max={100}
              value={sliderValue}
              onChange={handleSliderChange}
              valueLabelDisplay="off"
              scale={moodScale}
              sx={{
                color: 'var(--accent-color)',
                '& .MuiSlider-track': {
                  background: 'linear-gradient(to right, #E682FF, #18A2FD, #7B7BFF)',
                  border: 'none',
                },
                '& .MuiSlider-rail': {
                  backgroundColor: '#1D1B25',
                  height: '4px',
                },
                '& .MuiSlider-thumb': {
                  width: '8px',
                  height: '8px',
                  backgroundColor: '#00FF00',
                  '&:hover, &.Mui-focusVisible, &.Mui-active': {
                    boxShadow: `0px 0px 0px 8px rgba(0, 255, 0, 0.16)`,
                  },
                  '&.Mui-active': {
                    width: '16px',
                    height: '16px',
                  },
                },
              }}
            />
          </div>
        </div>

        <button className="log-mood-button sticky-button" onClick={handleLogMood}>
          Log your mood
        </button>
      </main>
    </div>
  );
}

export default OnboardingStep3;