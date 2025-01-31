// src/components/Journal/JournalForm.jsx
import React, { useState, useCallback, useEffect } from 'react';
import './JournalForm.css';
import Header from '../Layout/Header';
import '../../styles/global.css';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    addJournalEntry,
    auth,
    db,
    getJournalEntryByDate,
    updateJournalEntry,
    deleteJournalEntry
} from '../../services/firebase';
import logEvent from '../../utils/logEvent';
import ConfirmModal from '../ConfirmModal'; // Import ConfirmModal

// Import Material UI Slider
import Slider from '@mui/material/Slider';
import { styled } from '@mui/material/styles';

// Import Mood Icons
import { ReactComponent as MoodFrustrated } from '../../styles/components/assets/mood-frustrated.svg'; // Frustrated first
import { ReactComponent as MoodUnmotivated } from '../../styles/components/assets/mood-unmotivated.svg';
import { ReactComponent as MoodNeutral } from '../../styles/components/assets/mood-neutral.svg';
import { ReactComponent as MoodFocused } from '../../styles/components/assets/mood-focused.svg';
import { ReactComponent as MoodInspired } from '../../styles/components/assets/mood-inspired.svg'; // Inspired last

// Import Button Icons
import { ReactComponent as SaveIcon } from '../../styles/components/assets/save.svg';
import { ReactComponent as EraseIcon } from '../../styles/components/assets/erase.svg';
import { ReactComponent as EditIcon } from '../../styles/components/assets/edit.svg'; // Import EditIcon


const moodOptions = [
    { value: 'frustrated', label: 'Frustrated', icon: MoodFrustrated }, // 1: Frustrated
    { value: 'unmotivated', label: 'Unmotivated', icon: MoodUnmotivated }, // 2: Unmotivated
    { value: 'neutral', label: 'Neutral', icon: MoodNeutral },        // 3: Neutral
    { value: 'focused', label: 'Focused', icon: MoodFocused },        // 4: Focused
    { value: 'inspired', label: 'Inspired', icon: MoodInspired },      // 5: Inspired
];

// Custom styled Slider Thumb component -  We will style thumb directly in `sx` for more control
// const ThumbIcon = styled('span')(({ theme }) => ({
//     '& .MuiSlider-thumb': {
//         width: 40,
//         height: 40,
//         '&:before': {
//             content: '""',
//             display: 'block',
//             position: 'absolute',
//             width: '100%',
//             height: '100%',
//             borderRadius: '50%',
//             backgroundColor: theme.palette.background.paper,
//             boxShadow: theme.shadows[2],
//             zIndex: -1,
//         },
//     },
// }));

// Non-linear scale function - Corrected for 5 moods
const moodPoints = [0, 25, 50, 75, 100]; // 5 points for 5 moods, evenly spaced
const moodScale = (value) => {
    let moodIndex = -1;
    for (let i = 0; i < moodPoints.length; i++) {
        if (value <= moodPoints[i]) {
            moodIndex = i;
            break;
        }
    }
    if (moodIndex === -1) moodIndex = moodPoints.length - 1; // Fallback for values above max
    return moodIndex;
};

// Reverse scale function to map mood index back to slider value
const reverseMoodScale = (index) => {
    return moodPoints[index] || 0;
};


const JournalForm = () => {
    const [mood, setMood] = useState('focused'); // Default mood, now 4th option 'focused'
    const [textField1, setTextField1] = useState('');
    const [textField2, setTextField2] = useState('');
    const navigate = useNavigate();
    const location = useLocation();
    const selectedDate = location.state?.selectedDate;
    const [journalEntryId, setJournalEntryId] = useState(null); // To store document ID for updates
    const [showEraseConfirmModal, setShowEraseConfirmModal] = useState(false);
    // const [originalTimestamp, setOriginalTimestamp] = useState(null); // No longer needed in JournalForm, logic moved to JournalSection


    useEffect(() => {
        if (selectedDate) {
            const fetchJournalEntry = async () => {
                try {
                    const user = auth.currentUser;
                    if (!user) return;
                    const entryData = await getJournalEntryByDate(user.uid, selectedDate);
                    if (entryData) {
                        setMood(entryData.mood);
                        setTextField1(entryData.reflection);
                        setTextField2(entryData.futureStep);
                        setJournalEntryId(entryData.id);
                        // setOriginalTimestamp(entryData.createdAt); // Store original timestamp - No longer needed here
                    } else {
                        // If no entry for the day, initialize with defaults or leave blank
                        console.log(`No journal entry found for ${selectedDate}, creating new.`);
                    }
                } catch (error) {
                    console.error("Error fetching journal entry:", error);
                }
            };
            fetchJournalEntry();
        } else {
            // Reset form for new entries (today's entry)
            setMood('focused'); // Default mood, now 4th option 'focused'
            setTextField1('');
            setTextField2('');
            setJournalEntryId(null);
            // setOriginalTimestamp(null); // Reset original timestamp for new entries - No longer needed here
        }
    }, [selectedDate]);


    const handleSliderChange = useCallback((event, newValue) => {
        let moodIndex = moodScale(newValue);
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

            if (journalEntryId) {
                // Update existing entry -  createdAt is NOT updated here, lastUpdated is handled in firebase.js
                await updateJournalEntry(journalEntryId, mood, reflectionText, futureStepText);
                console.log('Journal entry updated in Firestore:', { mood, textField1, textField2, journalEntryId });
                logEvent('journal_updated_firestore', { mood: mood, textField1Length: textField1.length, textField2Length: textField2.length, journalEntryId: journalEntryId });

            } else {
                // Add new entry - createdAt timestamp is set in firebase.js
                await addJournalEntry(user.uid, mood, reflectionText, futureStepText);
                console.log('Journal entry saved to Firestore:', { mood, textField1, textField2 });
                logEvent('journal_saved_firestore', { mood: mood, textField1Length: textField1.length, textField2Length: textField2.length });
            }
            navigate('/journal-confirmation');

        } catch (error) {
            console.error("Error saving/updating journal entry to Firestore:", error);
            logEvent('journal_save_failed', { mood: mood, error: error.message });
        }
    }, [mood, textField1, textField2, navigate, journalEntryId]);

    const handleErase = useCallback(() => {
        setShowEraseConfirmModal(true);
    }, []);

    const confirmEraseAction = useCallback(async () => {
      setShowEraseConfirmModal(false);
      if (journalEntryId) {
          try {
              await deleteJournalEntry(journalEntryId); // Correct function name: deleteJournalEntry
              console.log('Journal entry deleted from Firestore:', journalEntryId);
              logEvent('journal_deleted_firestore', { journalEntryId: journalEntryId });
              navigate('/home'); // Or journal overview page if preferred
          } catch (error) {
              console.error("Error deleting journal entry:", error);
              logEvent('journal_delete_failed', { journalEntryId: journalEntryId, error: error.message });
              alert('Failed to delete journal entry.'); // Or better error handling
          }
      } else {
          console.log('No journal entry ID to delete.');
          navigate('/home'); // If no entry to delete, just go home
      }
  }, [journalEntryId, navigate]);

    const cancelEraseAction = useCallback(() => {
        setShowEraseConfirmModal(false);
    }, []);


    const valuetext = (value) => {
        let moodIndex = moodScale(value); // Get mood index from slider value for accessibility
        const moodOption = moodOptions[moodIndex];
        return moodOption ? moodOption.label : '';
    };

    const valueLabelFormat = (value) => {
        let moodIndex = moodScale(value); // Get mood index from slider value for value label
        const moodOption = moodOptions[moodIndex];
        return moodOption ? moodOption.label : '';
    };


    const currentMoodLabel = moodOptions.find(option => option.value === mood)?.label || 'Focused';

    const marks = moodOptions.map((option, index) => ({ // Marks at mood points (optional visual cues)
        value: reverseMoodScale(index), // Use reverse scale to position marks
        label: '', // No labels, as per design - remove if you want labels on marks
    }));

      return (
    <div className="journal-form-page">
      <Header
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
                            defaultValue={reverseMoodScale(moodOptions.findIndex(opt => opt.value === mood))} // Dynamically set default mood - 'focused' now index 3
                            getAriaValueText={valuetext}
                            step={null}
                            marks={marks}
                            min={0}
                            max={100} // Slider max value
                            valueLabelDisplay="off" //  <-----  VALUE LABEL DISPLAY SET TO "OFF"
                            valueLabelFormat={valueLabelFormat}
                            onChange={handleSliderChange}
                            // ThumbComponent={ThumbIcon} -  We are styling thumb directly in `sx` now
                            scale={moodScale} // Apply non-linear scale function
                            sx={{
                                color: 'var(--accent-color)', // default color, might be overridden by track gradient
                                '& .MuiSlider-track': {
                                    background: 'linear-gradient(to right, #E682FF, #18A2FD, #7B7BFF)',
                                    border: 'none', // Remove border if any
                                },
                                '& .MuiSlider-rail': {
                                    backgroundColor: '#1D1B25',
                                    height: '4px',
                                },
                                '& .MuiSlider-thumb': {
                                    width: '8px',
                                    height: '8px',
                                    backgroundColor: '#00FF00', // --accent-color: #00FF00;
                                    '&:hover, &.Mui-focusVisible, &.Mui-active': { // Active and focus states
                                        boxShadow: `0px 0px 0px 8px rgba(0, 255, 0, 0.16)`, // Keep existing active shadow
                                    },
                                    '&.Mui-active': {
                                        width: '16px', // Active state size
                                        height: '16px',
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
                    <div className="journal-input-tile">
                        <textarea
                            type="text"
                            id="textField1"
                            placeholder="Find the root of this feeling in your day."
                            value={textField1}
                            onChange={handleText1Change}
                            className="journal-input journal-textarea journal-text-input-style" // ADDED journal-text-input-style
                        />
                        <EditIcon className="journal-edit-icon" />
                    </div>
                </div>

                <div className="journal-form-section journal-form-section-text2">
                    <label htmlFor="textField2" className="journal-form-label">What's one step for tomorrow?</label>
                    <div className="journal-input-tile">
                        <textarea
                            id="textField2"
                            placeholder="One small action to shape your path."
                            value={textField2}
                            onChange={handleText2Change}
                            className="journal-input journal-textarea journal-text-input-style" // ADDED journal-text-input-style
                        />
                        <EditIcon className="journal-edit-icon" />
                    </div>
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
            <ConfirmModal
                show={showEraseConfirmModal}
                onHide={cancelEraseAction}
                title="Erase Journal Entry?"
                body="Are you sure you want to erase this journal entry? This action cannot be undone."
                onConfirm={confirmEraseAction}
                confirmText="Yes, Erase"
                cancelText="Cancel"
            />
        </div>
    );
};

export default JournalForm;