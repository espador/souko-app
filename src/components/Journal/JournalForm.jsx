import React, { useState, useCallback, useEffect, useMemo } from 'react';
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


const JournalForm = React.memo(({ navigate, selectedDate: propSelectedDate }) => {
    const [mood, setMood] = useState('focused');
    const [textField1, setTextField1] = useState('');
    const [textField2, setTextField2] = useState('');
    const selectedDate = propSelectedDate;
    const [journalEntryId, setJournalEntryId] = useState(null);
    const [showEraseConfirmModal, setShowEraseConfirmModal] = useState(false);
    const [loadingEntry, setLoadingEntry] = useState(false);


    const fetchJournalEntry = useCallback(async (uid, date) => {
        setLoadingEntry(true);
        try {
            return await getJournalEntryByDate(uid, date);
        } catch (error) {
            console.error("Error fetching journal entry:", error);
            return null;
        } finally {
            setLoadingEntry(false);
        }
    }, []);


    useEffect(() => {
        const loadEntry = async () => {
            console.log("JournalForm useEffect triggered, selectedDate:", selectedDate);

            if (selectedDate) {
                const user = auth.currentUser;
                if (user) {
                    setLoadingEntry(true);
                    const entryData = await fetchJournalEntry(user.uid, selectedDate);
                    setLoadingEntry(false);
                    if (entryData) {
                        setMood(entryData.mood);
                        setTextField1(entryData.reflection);
                        setTextField2(entryData.futureStep);
                        setJournalEntryId(entryData.id);
                        console.log("Journal entry loaded successfully for date:", selectedDate);
                    } else {
                        console.log(`No journal entry found for ${selectedDate}, creating new.`);
                        setJournalEntryId(null);
                    }
                }
            } else {
                setMood('focused');
                setTextField1('');
                setTextField2('');
                setJournalEntryId(null);
                console.log("No selectedDate prop received, resetting form for new entry.");
            }
        };
        loadEntry();
    }, [selectedDate, fetchJournalEntry]);


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
                await updateJournalEntry(journalEntryId, mood, reflectionText, futureStepText);
                console.log('Journal entry updated in Firestore:', { mood, textField1, textField2, journalEntryId });
                logEvent('journal_updated_firestore', { mood: mood, textField1Length: textField1.length, textField2Length: textField2.length, journalEntryId: journalEntryId });


            } else {
                await addJournalEntry(user.uid, mood, reflectionText, futureStepText, selectedDate);
                console.log('Journal entry saved to Firestore:', { mood, textField1, textField2, selectedDate });
                logEvent('journal_saved_firestore', { mood: mood, textField1Length: textField1.length, textField2Length: textField2.length });
            }
            navigate('home');


        } catch (error) {
            console.error("Error saving/updating journal entry to Firestore:", error);
            logEvent('journal_save_failed', { mood: mood, error: error.message });
        }
    }, [mood, textField1, textField2, navigate, journalEntryId, selectedDate]);


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
                navigate('home');
            } catch (error) {
                console.error("Error deleting journal entry:", error);
                logEvent('journal_delete_failed', { journalEntryId: journalEntryId, error: error.message });
                alert('Failed to delete journal entry.');
            }
        } else {
            console.log('No journal entry ID to delete.');
            navigate('home');
        }
    }, [journalEntryId, navigate]);


    const cancelEraseAction = useCallback(() => {
        setShowEraseConfirmModal(false);
    }, []);


    const valuetext = useCallback((value) => {
        let moodIndex = moodScale(value);
        const moodOption = moodOptions[moodIndex];
        return moodOption ? moodOption.label : '';
    }, []);


    const valueLabelFormat = useCallback((value) => {
        let moodIndex = moodScale(value);
        const moodOption = moodOptions[moodIndex];
        return moodOption ? moodOption.label : '';
    }, []);


    const currentMoodLabel = useMemo(() => {
        return moodOptions.find(option => option.value === mood)?.label || 'Focused';
    }, [mood]);


    const marks = useMemo(() => moodOptions.map((option, index) => ({
        value: reverseMoodScale(index),
        label: '',
    })), []);


    return (
        <div className="journal-form-page">
            <Header
                variant="journalOverview"
                showBackArrow={true}
                navigate={navigate}
            />
            <main className="motivational-section">
                <TextGenerateEffect
                    words={"In stillness, \n progress takes \nits form."}
                />
                </main>

                <div className="divider"></div>
                <h2 className="projects-label">Journal details</h2>

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
                    <div className="journal-input-tile journal-input-tile-text1">
                        <textarea
                            type="text"
                            id="textField1"
                            placeholder={`Which moment made you feel ${currentMoodLabel}?`}
                            value={textField1}
                            onChange={handleText1Change}
                            className="journal-input journal-textarea journal-text-input-style journal-text-input-placeholder"
                            maxLength={140}
                        />
                    </div>
                </div>

                <div className="journal-form-section journal-form-section-text2">
                    <div className="journal-input-tile">
                        <textarea
                            type="text"
                            id="textField2"
                            placeholder="One small action to shape your path."
                            value={textField2}
                            onChange={handleText2Change}
                            className="journal-input journal-textarea journal-text-input-style journal-text-input-placeholder"
                            maxLength={140}
                        />
                    </div>
                </div>

                <div className="form-navigation form-navigation-single-page">
                    <button className="save-button" onClick={handleSubmit} disabled={loadingEntry}>
                        Save this note
                    </button>
                    <button className="erase-button" onClick={handleErase} disabled={loadingEntry}>
                        Erase your thought
                    </button>
                </div>
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


JournalForm.displayName = 'JournalForm';
export default JournalForm;