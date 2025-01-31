// src/components/Journal/JournalForm.jsx
import React, { useState, useCallback, useEffect } from 'react';
import './JournalForm.css';
import Header from '../Layout/Header';
import '../../styles/global.css';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
    addJournalEntry,
    auth,
    db,
    getJournalEntryByDate,
    updateJournalEntry,
    deleteJournalEntry
} from '../../services/firebase';
import logEvent from '../../utils/logEvent';
import ConfirmModal from '../ConfirmModal';

import Slider from '@mui/material/Slider';

import { ReactComponent as MoodFrustrated } from '../../styles/components/assets/mood-frustrated.svg';
import { ReactComponent as MoodUnmotivated } from '../../styles/components/assets/mood-unmotivated.svg';
import { ReactComponent as MoodNeutral } from '../../styles/components/assets/mood-neutral.svg';
import { ReactComponent as MoodFocused } from '../../styles/components/assets/mood-focused.svg';
import { ReactComponent as MoodInspired } from '../../styles/components/assets/mood-inspired.svg';

import { ReactComponent as SaveIcon } from '../../styles/components/assets/save.svg';
import { ReactComponent as EraseIcon } from '../../styles/components/assets/erase.svg';
import { ReactComponent as EditIcon } from '../../styles/components/assets/edit.svg';


const moodOptions = [
    { value: 'frustrated', label: 'Frustrated', icon: MoodFrustrated },
    { value: 'unmotivated', label: 'Unmotivated', icon: MoodUnmotivated },
    { value: 'neutral', label: 'Neutral', icon: MoodNeutral },
    { value: 'focused', label: 'Focused', icon: MoodFocused },
    { value: 'inspired', label: 'Inspired', icon: MoodInspired },
];


const moodPoints = [0, 25, 50, 75, 100];
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


const JournalForm = () => {
    const [mood, setMood] = useState('focused');
    const [textField1, setTextField1] = useState('');
    const [textField2, setTextField2] = useState('');
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const selectedDate = searchParams.get('date');
    const [journalEntryId, setJournalEntryId] = useState(null);
    const [showEraseConfirmModal, setShowEraseConfirmModal] = useState(false);


    useEffect(() => {
        console.log("JournalForm useEffect - location.state:", location.state);
        console.log("JournalForm useEffect - searchParams:", searchParams.toString());
        console.log("JournalForm useEffect - selectedDate (from query param):", selectedDate);

        if (selectedDate) {
            const fetchJournalEntry = async () => {
                try {
                    const user = auth.currentUser;
                    if (!user) {
                        console.log("JournalForm useEffect - No user logged in, exiting fetch."); // Added log
                        return;
                    }

                    console.log("JournalForm useEffect - selectedDate received:", selectedDate);
                    console.log("JournalForm useEffect - Fetching entry for date:", selectedDate);

                    const entryData = await getJournalEntryByDate(user.uid, selectedDate);

                    console.log("JournalForm useEffect - Data fetched from getJournalEntryByDate:", entryData); // Keep this log

                    if (entryData) {
                        console.log("JournalForm useEffect - Entry data found:", entryData); // Added log to confirm entryData is truthy
                        setMood(entryData.mood);
                        setTextField1(entryData.reflection);
                        setTextField2(entryData.futureStep);
                        setJournalEntryId(entryData.id);
                        console.log("JournalForm useEffect - State updated with fetched data:", { mood: entryData.mood, reflection: entryData.reflection, futureStep: entryData.futureStep, journalEntryId: entryData.id }); // Added log to show state update
                    } else {
                        console.log(`JournalForm useEffect - No journal entry found for ${selectedDate}, creating new.`);
                        // State is already at default for new entry, no need to reset again here unless you want to explicitly reset journalEntryId to null again.
                    }
                } catch (error) {
                    console.error("JournalForm useEffect - Error fetching journal entry:", error);
                }
            };
            fetchJournalEntry();
        } else {
            setMood('focused');
            setTextField1('');
            setTextField2('');
            setJournalEntryId(null);
            console.log("JournalForm useEffect - No selectedDate, resetting form for new entry.");
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
            console.log("Current User UID:", user?.uid); //  <----- ADD THIS LINE
            if (!user) {
                console.error("User not logged in.");
                return;
            }

            const reflectionText = textField1;
            const futureStepText = textField2;

            if (journalEntryId) {
                await updateJournalEntry(journalEntryId, mood, reflectionText, futureStepText);
                console.log('Journal entry updated in Firestore:', { mood, textField1, textField2, journalEntryId });
                logEvent('journal_updated_firestore', { mood: mood, textField1Length: textField1.length, textField2Length: textField2.length, journalEntryId: journalEntryId });

            } else {
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
              await deleteJournalEntry(journalEntryId);
              console.log('Journal entry deleted from Firestore:', journalEntryId);
              logEvent('journal_deleted_firestore', { journalEntryId: journalEntryId });
              navigate('/home');
          } catch (error) {
              console.error("Error deleting journal entry:", error);
              logEvent('journal_delete_failed', { journalEntryId: journalEntryId, error: error.message });
              alert('Failed to delete journal entry.');
          }
      } else {
          console.log('No journal entry ID to delete.');
          navigate('/home');
      }
  }, [journalEntryId, navigate]);

    const cancelEraseAction = useCallback(() => {
        setShowEraseConfirmModal(false);
    }, []);


    const valuetext = (value) => {
        let moodIndex = moodScale(value);
        const moodOption = moodOptions[moodIndex];
        return moodOption ? moodOption.label : '';
    };

    const valueLabelFormat = (value) => {
        let moodIndex = moodScale(value);
        const moodOption = moodOptions[moodIndex];
        return moodOption ? moodOption.label : '';
    };


    const currentMoodLabel = moodOptions.find(option => option.value === mood)?.label || 'Focused';

    const marks = moodOptions.map((option, index) => ({
        value: reverseMoodScale(index),
        label: '',
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
                            defaultValue={reverseMoodScale(moodOptions.findIndex(opt => opt.value === mood))}
                            getAriaValueText={valuetext}
                            step={null}
                            marks={marks}
                            min={0}
                            max={100}
                            valueLabelDisplay="off"
                            valueLabelFormat={valueLabelFormat}
                            onChange={handleSliderChange}
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
                            className="journal-input journal-textarea journal-text-input-style"
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
                            className="journal-input journal-textarea journal-text-input-style"
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