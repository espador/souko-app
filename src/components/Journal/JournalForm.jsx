import React, { useState, useCallback, useEffect, useMemo } from 'react';
import './JournalForm.css';
import Header from '../Layout/Header';
import '../../styles/global.css';
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
import { TextGenerateEffect } from '../../styles/components/text-generate-effect.tsx';


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


const JournalForm = React.memo(({ navigate, selectedDate: propSelectedDate }) => { // <-- Receive navigate and selectedDate props
    const [mood, setMood] = useState('focused');
    const [textField1, setTextField1] = useState('');
    const [textField2, setTextField2] = useState('');
    const selectedDate = propSelectedDate;
    const [journalEntryId, setJournalEntryId] = useState(null);
    const [showEraseConfirmModal, setShowEraseConfirmModal] = useState(false);
    const [loadingEntry, setLoadingEntry] = useState(false); // Loading state for entry fetch


    // Fetch journal entry - useCallback for memoization
    const fetchJournalEntry = useCallback(async (uid, date) => {
        setLoadingEntry(true); // Start loading
        try {
            return await getJournalEntryByDate(uid, date);
        } catch (error) {
            console.error("Error fetching journal entry:", error);
            return null;
        } finally {
            setLoadingEntry(false); // End loading
        }
    }, []);


    useEffect(() => {
        const loadEntry = async () => {
            if (selectedDate) {
                const user = auth.currentUser;
                if (user) {
                    const entryData = await fetchJournalEntry(user.uid, selectedDate); // Use memoized fetchJournalEntry
                    if (entryData) {
                        setMood(entryData.mood);
                        setTextField1(entryData.reflection);
                        setTextField2(entryData.futureStep);
                        setJournalEntryId(entryData.id);
                    } else {
                        console.log(`No journal entry found for ${selectedDate}, creating new.`);
                        setJournalEntryId(null); // Ensure journalEntryId is null for new entries on same date
                    }
                }
            } else {
                setMood('focused');
                setTextField1('');
                setTextField2('');
                setJournalEntryId(null);
                console.log("No selectedDate, resetting form for new entry.");
            }
        };
        loadEntry();
    }, [selectedDate, fetchJournalEntry]); // Include memoized fetchJournalEntry in dependencies


    // Slider change handler - useCallback for memoization
    const handleSliderChange = useCallback((event, newValue) => {
        let moodIndex = moodScale(newValue);
        if (moodIndex >= 0 && moodIndex < moodOptions.length) {
            setMood(moodOptions[moodIndex].value);
        }
    }, []);


    // Textarea change handlers - useCallback for memoization
    const handleText1Change = useCallback((e) => {
        setTextField1(e.target.value);
    }, []);


    const handleText2Change = useCallback((e) => {
        setTextField2(e.target.value);
    }, []);


    // Submit handler - useCallback for memoization
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
                await updateJournalEntry(journalEntryId, mood, reflectionText, futureStepText);
                console.log('Journal entry updated in Firestore:', { mood, textField1, textField2, journalEntryId });
                logEvent('journal_updated_firestore', { mood: mood, textField1Length: textField1.length, textField2Length: textField2.length, journalEntryId: journalEntryId });


            } else {
                await addJournalEntry(user.uid, mood, reflectionText, futureStepText);
                console.log('Journal entry saved to Firestore:', { mood, textField1, textField2 });
                logEvent('journal_saved_firestore', { mood: mood, textField1Length: textField1.length, textField2Length: textField2.length });
            }
            navigate('journal-confirmation'); // <-- Updated navigate call, page name as string


        } catch (error) {
            console.error("Error saving/updating journal entry to Firestore:", error);
            logEvent('journal_save_failed', { mood: mood, error: error.message });
        }
    }, [mood, textField1, textField2, navigate, journalEntryId]); // Dependencies for useCallback


    // Erase handler - useCallback for memoization
    const handleErase = useCallback(() => {
        setShowEraseConfirmModal(true);
    }, []);


    // Confirm erase action handler - useCallback for memoization
    const confirmEraseAction = useCallback(async () => {
        setShowEraseConfirmModal(false);
        if (journalEntryId) {
            try {
                await deleteJournalEntry(journalEntryId);
                console.log('Journal entry deleted from Firestore:', journalEntryId);
                logEvent('journal_deleted_firestore', { journalEntryId: journalEntryId });
                navigate('home'); // <-- Updated navigate call, page name as string
            } catch (error) {
                console.error("Error deleting journal entry:", error);
                logEvent('journal_delete_failed', { journalEntryId: journalEntryId, error: error.message });
                alert('Failed to delete journal entry.');
            }
        } else {
            console.log('No journal entry ID to delete.');
            navigate('home'); // <-- Updated navigate call, page name as string
        }
    }, [journalEntryId, navigate]); // Dependencies for useCallback


    // Cancel erase action handler - useCallback for memoization
    const cancelEraseAction = useCallback(() => {
        setShowEraseConfirmModal(false);
    }, []);


    // Memoized valuetext function
    const valuetext = useCallback((value) => {
        let moodIndex = moodScale(value);
        const moodOption = moodOptions[moodIndex];
        return moodOption ? moodOption.label : '';
    }, []); // useCallback for memoization


    // Memoized valueLabelFormat function
    const valueLabelFormat = useCallback((value) => {
        let moodIndex = moodScale(value);
        const moodOption = moodOptions[moodIndex];
        return moodOption ? moodOption.label : '';
    }, []); // useCallback for memoization


    // Memoized currentMoodLabel
    const currentMoodLabel = useMemo(() => {
        return moodOptions.find(option => option.value === mood)?.label || 'Focused';
    }, [mood]); // useMemo for memoization


    // Memoized marks array
    const marks = useMemo(() => moodOptions.map((option, index) => ({
        value: reverseMoodScale(index),
        label: '',
    })), []); // useMemo for memoization


    return (
        <div className="journal-form-page">
            <Header
                variant="journalOverview"
                showBackArrow={true}
                navigate={navigate} // <-- Pass navigate prop to Header
            />
            <main className="journal-form-content journal-form-single-page">
                {/* Replace the p tag with TextGenerateEffect */}
                <TextGenerateEffect
                    words={"In stillness, \n progress takes \nits form."}
                    className="journal-form-title" // Keep the same class for styling
                />


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
                            type="text"
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
                    <button className="save-button" onClick={handleSubmit} disabled={loadingEntry}> {/* Disable save button while loading entry */}
                        <SaveIcon className="button-icon" />
                        Save this note
                    </button>
                    <button className="erase-button" onClick={handleErase} disabled={loadingEntry}> {/* Disable erase button while loading entry */}
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
                cancelText="Cancel"
            />
        </div>
    );
});


JournalForm.displayName = 'JournalForm'; // displayName for React.memo
export default JournalForm;