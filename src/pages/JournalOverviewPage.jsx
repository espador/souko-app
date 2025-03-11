import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot, orderBy, getDoc, doc } from 'firebase/firestore';
import Header from '../components/Layout/Header';
import '@fontsource/shippori-mincho';
import { TextGenerateEffect } from '../styles/components/text-generate-effect.tsx';
import '../styles/global.css';
import { format } from 'date-fns';
import { ReactComponent as DropdownIcon } from '../styles/components/assets/dropdown.svg';

const CACHE_DURATION_MS = 30000;

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const JournalOverviewPage = ({ navigate }) => {
    const [user, setUser] = useState(null);
    const [journalEntries, setJournalEntries] = useState([]);
    const [loadingJournalEntries, setLoadingJournalEntries] = useState(true);
    const [loadingProfileData, setLoadingProfileData] = useState(true);
    const [dataLoadCounter, setDataLoadCounter] = useState(0);
    const [selectedMonth, setSelectedMonth] = useState(new Date());
    const [currentStreak, setCurrentStreak] = useState(0);
    const [totalJournalEntriesCount, setTotalJournalEntriesCount] = useState(0);
    const [mostFrequentMood, setMostFrequentMood] = useState(null);


    const convertTimestamp = useCallback((timestamp) => {
        if (!timestamp) return null; // Handle null or undefined timestamp
        try {
            const date = timestamp.toDate();
            if (date instanceof Date && !isNaN(date)) {
                return date;
            } else {
                console.error("convertTimestamp: Invalid Date object", timestamp);
                return null;
            }
        } catch (e) {
            console.error("convertTimestamp error:", e, timestamp);
            return null;
        }
    }, []);

    const loadCachedData = useCallback((uid) => {
        const cachedStr = localStorage.getItem(`journalOverviewData_${uid}`);
        if (cachedStr) {
            try {
                const cached = JSON.parse(cachedStr);
                if (Date.now() - cached.timestamp < CACHE_DURATION_MS) {
                    return true;
                }
            } catch (e) {
                console.error("Error parsing cached journal data", e);
            }
        }
        return false;
    }, []);

    const cacheData = useCallback((uid, journalEntries) => {
        const dataToCache = {
            journalEntries: journalEntries,
            timestamp: Date.now(),
        };
        localStorage.setItem(`journalOverviewData_${uid}`, JSON.stringify(dataToCache));
    }, []);

    const fetchData = useCallback(async (uid, month) => {
        setLoadingJournalEntries(true);
        const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
        const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999);

        const journalQuery = query(
            collection(db, 'journalEntries'),
            where('userId', '==', uid),
            where('createdAt', '>=', startOfMonth),
            where('createdAt', '<=', endOfMonth),
            orderBy('createdAt', 'desc')
        );

        let unsubJournal;

        const handleJournalSnapshot = (snapshot) => {
            const fetchedEntries = snapshot.docs.map((doc) => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: convertTimestamp(data.createdAt),
                };
            });
            setJournalEntries(fetchedEntries);
            setDataLoadCounter(prevCounter => prevCounter + 1);
            setLoadingJournalEntries(false); // Move setLoadingJournalEntries(false) here, after entries are set
        };


        unsubJournal = onSnapshot(journalQuery, handleJournalSnapshot, error => {
            console.error("Journal entries onSnapshot error:", error);
            setLoadingJournalEntries(false); // Ensure loading is set to false even on error
            setDataLoadCounter(prevCounter => prevCounter + 1);
        });

        return () => {
            if (unsubJournal) unsubJournal();
        };
    }, [convertTimestamp]);

    const fetchProfileData = useCallback(async (uid) => {
        setLoadingProfileData(true);
        try {
            const profileRef = doc(db, 'profiles', uid);
            const profileSnap = await getDoc(profileRef);
            if (profileSnap.exists()) {
                const profileData = profileSnap.data();
                setCurrentStreak(profileData.currentStreak || 0);
                setTotalJournalEntriesCount(profileData.monthlyJournalCount || 0);
                setMostFrequentMood(profileData.monthlyMostFrequentMood || null);
            } else {
                console.log("No such profile!");
                setCurrentStreak(0);
                setTotalJournalEntriesCount(0);
                setMostFrequentMood(null);
            }
        } catch (error) {
            console.error("Error fetching profile data:", error);
            setCurrentStreak(0);
            setTotalJournalEntriesCount(0);
            setMostFrequentMood(null);
        } finally {
            setLoadingProfileData(false);
        }
    }, []);


    useEffect(() => {
        if (dataLoadCounter >= 1 && user) {
            cacheData(user.uid, journalEntries);
            setDataLoadCounter(0);
        }
    }, [dataLoadCounter, user, journalEntries, cacheData]);


    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
            if (!currentUser) {
                navigate('login');
            } else {
                setUser(currentUser);
                Promise.all([
                    fetchData(currentUser.uid, selectedMonth),
                    fetchProfileData(currentUser.uid)
                ]).then(() => {
                    // No need to set loading here, individual loaders handle it.
                });
            }
        });
        return () => unsubscribeAuth();
    }, [navigate, fetchData, fetchProfileData, selectedMonth]);


    const handleMonthChange = useCallback((event) => {
        const monthIndex = monthNames.indexOf(event.target.value);
        if (monthIndex !== -1) {
            const newMonth = new Date(selectedMonth.getFullYear(), monthIndex, 1);
            setSelectedMonth(newMonth);
            if (user) {
                fetchData(user.uid, newMonth);
            }
        }
    }, [fetchData, selectedMonth, user]);


    const renderJournalEntriesByMonth = useMemo(() => {
        if (loadingJournalEntries) {
            return <p>Loading journal entries...</p>;
        } else if (journalEntries.length > 0) {
            return (
                <ul className="journal-entries-list">
                    {journalEntries.map((entry) => {
                        const date = entry.createdAt; // Already converted to Date object in fetchData
                        if (!(date instanceof Date) || isNaN(date)) {
                            console.error("Invalid createdAt Date:", entry.createdAt, entry);
                            return null; // Skip rendering this entry if date is invalid
                        }
                        return (
                            <li key={entry.id} className="journal-entry-item">
                                <div className="entry-date">
                                    {format(date, 'd')} {format(date, 'EEE').substring(0, 3)}
                                </div>
                                <div className="entry-mood">{entry.mood}</div>
                            </li>
                        );
                    }).filter(item => item !== null) // Filter out null items from map (invalid dates)
                    }
                </ul>
            );
        } else {
            return <p>No journal entries found for this month.</p>;
        }
    }, [loadingJournalEntries, journalEntries]);


    const currentMonthName = useMemo(() => {
        return monthNames[selectedMonth.getMonth()];
    }, [selectedMonth]);


    const monthOptions = useMemo(() => {
        const options = [];
        for (let i = 0; i < 12; i++) {
            const monthDate = new Date(selectedMonth.getFullYear(), i, 1);
            options.push(<option key={monthNames[i]} value={monthNames[i]}>{monthNames[i]}</option>);
        }
        return options;
    }, [selectedMonth]);


    return (
        <div className="journal-overview-container">
            <Header
                navigate={navigate}
                variant="journalOverview"
                showBackArrow={true}
                onBack={() => navigate('home')}
            />
            <section className="motivational-section">
                {(!loadingProfileData && !loadingJournalEntries && mostFrequentMood) ? (
                    <>
                        <TextGenerateEffect
                            words={`You logged <span class="accent-text">${totalJournalEntriesCount} moments</span> so far. \nThis month you're feeling more <span class="accent-text">${mostFrequentMood}</span>!`}
                        />
                    </>
                ) : (
                    (loadingProfileData || loadingJournalEntries) ? <p>Loading motivational quote...</p> : <p></p>
                )}
            </section>
            <div className="divider"></div>

            <section className="journal-filter-section">
                <div className="journal-filter-container">
                    <div className="month-dropdown-wrapper">
                        <select
                            className="month-dropdown"
                            value={currentMonthName}
                            onChange={handleMonthChange}
                        >
                            {monthOptions}
                        </select>
                        <DropdownIcon className="dropdown-arrow" />
                    </div>
                    <div className="streak-container">
                        <span className="your-streak-text">Your streak</span>
                        <div className="journal-badge">{currentStreak}</div>
                    </div>
                </div>
            </section>

            <main className="journal-overview-content">
                <section className="journal-entries-section">
                    {renderJournalEntriesByMonth}
                </section>
            </main>
        </div>
    );
};

export default JournalOverviewPage;