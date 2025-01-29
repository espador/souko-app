// src/components/Journal/JournalForm.jsx
import React, { useState, useCallback } from 'react';
import './JournalForm.css';
import Header from '../Layout/Header';
import '../../styles/global.css';
import { useNavigate } from 'react-router-dom';
import { addJournalEntry, auth, db } from '../../services/firebase';
import logEvent from '../../utils/logEvent';

// Import Material UI Slider
import Slider from '@mui/material/Slider';
import { styled } from '@mui/material/styles';

// Import Mood Icons
import { ReactComponent as MoodNeutral } from '../../styles/components/assets/mood-neutral.svg';
import { ReactComponent as MoodInspired } from '../../styles/components/assets/mood-inspired.svg';
import { ReactComponent as MoodFocused } from '../../styles/components/assets/mood-focused.svg';
import { ReactComponent as MoodUnmotivated } from '../../styles/components/assets/mood-unmotivated.svg';
import { ReactComponent as MoodFrustrated } from '../../styles/components/assets/mood-frustrated.svg';

// Import Button Icons
import { ReactComponent as SaveIcon } from '../../styles/components/assets/save.svg';
import { ReactComponent as EraseIcon } from '../../styles/components/assets/erase.svg';

const moodOptions = [
  { value: 'neutral', label: 'Neutral', icon: MoodNeutral },
  { value: 'inspired', label: 'Inspired', icon: MoodInspired },
  { value: 'focused', label: 'Focused', icon: MoodFocused },
  { value: 'unmotivated', label: 'Unmotivated', icon: MoodUnmotivated },
  { value: 'frustrated', label: 'Frustrated', icon: MoodFrustrated },
];

// Custom styled Slider Thumb component
const ThumbIcon = styled('span')(({ theme }) => ({
  '& .MuiSlider-thumb': {
    width: 40,
    height: 40,
    '&:before': {
      content: '""',
      display: 'block',
      position: 'absolute',
      width: '100%',
      height: '100%',
      borderRadius: '50%',
      backgroundColor: theme.palette.background.paper,
      boxShadow: theme.shadows[2],
      zIndex: -1,
    },
  },
}));

// Non-linear scale function
const moodScale = (value) => {
  const moodPoints = [0, 20, 40, 60, 80, 100]; // Points for each mood
  const moodIndex = moodPoints.indexOf(value);
  return moodIndex === -1 ? 0 : moodIndex; // Default to Neutral if value not found
};

// Reverse scale function to map mood index back to slider value for default value
const reverseMoodScale = (index) => {
  const moodPoints = [0, 20, 40, 60, 80, 100];
  return moodPoints[index] || 0; // Default to 0 if index is out of bounds
};


const JournalForm = () => {
  const [mood, setMood] = useState('focused');
  const [textField1, setTextField1] = useState('');
  const [textField2, setTextField2] = useState('');
  const navigate = useNavigate();

  const handleSliderChange = useCallback((event, newValue) => {
    const moodIndex = moodScale(newValue); // Get mood index from slider value
    if (moodIndex >= 0 && moodIndex < moodOptions.length) {
      setMood(moodOptions[moodIndex].value);
    }
  }, []);


  const handleText1Change = useCallback((e) => {
    setTextField1(e.target.value);
  }, []);

  const handleText2Change = useCallback((e) => {
    setTextField2(e.target.value);
  }, []);

  const handleSubmit = useCallback(async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        console.error("User not logged in.");
        return;
      }

      const reflectionText = textField1;
      const futureStepText = textField2;

      await addJournalEntry(user.uid, mood, reflectionText, futureStepText);
      console.log('Journal entry saved to Firestore:', { mood, textField1, textField2 });
      navigate('/journal-confirmation');
      logEvent('journal_saved_firestore', { mood: mood, textField1Length: textField1.length, textField2Length: textField2.length });
    } catch (error) {
      console.error("Error saving journal entry to Firestore:", error);
      logEvent('journal_save_failed', { mood: mood, error: error.message });
    }
  }, [mood, textField1, textField2, navigate]);

  const handleErase = useCallback(() => {
    const confirmErase = window.confirm("Are you sure you want to erase your thought? You will be redirected to the homepage and your current entry will not be saved.");
    if (confirmErase) {
      navigate('/home');
    }
  }, [navigate]);

  const valuetext = (value) => {
    const moodIndex = moodScale(value); // Get mood index from slider value for accessibility
    const moodOption = moodOptions[moodIndex];
    return moodOption ? moodOption.label : '';
  };

  const valueLabelFormat = (value) => {
    const moodIndex = moodScale(value); // Get mood index from slider value for value label
    const moodOption = moodOptions[moodIndex];
    return moodOption ? moodOption.label : '';
  };


  const currentMoodLabel = moodOptions.find(option => option.value === mood)?.label || 'Focused';

  const marks = moodOptions.map((option, index) => ({ // Marks at mood points (optional visual cues)
    value: reverseMoodScale(index), // Use reverse scale to position marks
    label: '', // No labels, as per design
  }));


  return (
    <div className="journal-form-page">
      <Header
        title="Journal Entry"
        showBackArrow={true}
        onBack={() => navigate('/home')}
        hideProfile={true}
      />
      <main className="journal-form-content journal-form-single-page">
        <p className="journal-form-title">In stillness, progress takes its form.</p>

        <div className="journal-form-section journal-form-section-mood">
          <div className="mood-header">Mood: {currentMoodLabel}</div>
          <div className="mood-slider-container">
            <Slider
              aria-label="mood"
              defaultValue={reverseMoodScale(2)} // Default to Focused (index 2), using reverse scale
              getAriaValueText={valuetext}
              step={null}
              marks={marks}
              min={0}
              max={100} // Slider max value
              valueLabelDisplay="auto"
              valueLabelFormat={valueLabelFormat}
              onChange={handleSliderChange}
              ThumbComponent={ThumbIcon}
              scale={moodScale} // Apply non-linear scale function
              sx={{
                color: 'var(--accent-color)',
                '& .MuiSlider-thumb': {
                  backgroundColor: 'var(--card-background)',
                  '&:hover, &.Mui-focusVisible': {
                    boxShadow: `0px 0px 0px 8px rgba(0, 255, 0, 0.16)`,
                  },
                },
                '& .MuiSlider-valueLabel': {
                  backgroundColor: 'var(--card-background)',
                  color: 'var(--text-color)',
                  fontFamily: 'var(--font-commit-mono)',
                  borderRadius: '8px',
                  padding: '4px 8px',
                },
              }}
            />
          </div>
        </div>

        <div className="journal-form-section journal-form-section-text1">
          <label htmlFor="textField1" className="journal-form-label">Which moment made you feel {`<${currentMoodLabel.toLowerCase()}>`}?</label>
          <input
            type="text"
            id="textField1"
            placeholder="Find the root of this feeling in your day."
            value={textField1}
            onChange={handleText1Change}
            className="journal-input"
          />
        </div>

        <div className="journal-form-section journal-form-section-text2">
          <label htmlFor="textField2" className="journal-form-label">What's one step for tomorrow?</label>
          <input
            type="text"
            id="textField2"
            placeholder="One small action to shape your path."
            value={textField2}
            onChange={handleText2Change}
            className="journal-input journal-textarea"
          />
        </div>

        <div className="form-navigation form-navigation-single-page">
          <button className="save-button" onClick={handleSubmit}>
            <SaveIcon className="button-icon" />
            Save this note
          </button>
          <button className="erase-button" onClick={handleErase}>
            <EraseIcon className="button-icon" />
            Erase your thought
          </button>
        </div>
      </main>
    </div>
  );
};

export default JournalForm;