import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import Header from '../components/Layout/Header';
import '@fontsource/shippori-mincho';
import { TextGenerateEffect } from '../styles/components/text-generate-effect.tsx';
import '../styles/components/JournalOverviewPage.css';

const CACHE_DURATION_MS = 30000; // 30 seconds


const JournalOverviewPage = ({ navigate }) => { // <-- Receive navigate prop
    const [user, setUser] = useState(null);
    const [journalEntries, setJournalEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dataLoadCounter, setDataLoadCounter] = useState(0); // Counter for data loading


    // Helper function to convert Firestore Timestamp to Date - memoized
    const convertTimestamp = useCallback((timestamp) => {
        return timestamp && typeof timestamp.toDate === 'function'
            ? timestamp.toDate()
            : null;
    }, []);


    // Load cached journal data if available - memoized
    const loadCachedData = useCallback((uid) => {
        const cachedStr = localStorage.getItem(`journalOverviewData_${uid}`);
        if (cachedStr) {
            try {
                const cached = JSON.parse(cachedStr);
                if (Date.now() - cached.timestamp < CACHE_DURATION_MS) {
                    setJournalEntries(cached.journalEntries || []);
                    return true;
                }
            } catch (e) {
                console.error("Error parsing cached journal data", e);
            }
        }
        return false;
    }, []);


    // Cache data function - memoized
    const cacheData = useCallback((uid, journalEntries) => {
        const dataToCache = {
            journalEntries: journalEntries,
            timestamp: Date.now(),
        };
        localStorage.setItem(`journalOverviewData_${uid}`, JSON.stringify(dataToCache));
    }, []);


    // Fetch data and handle real-time updates - useCallback for dependency optimization
    const fetchData = useCallback(async (uid) => {
        if (loadCachedData(uid)) {
            setLoading(false); // If loaded from cache, no need to wait for firebase
        } else {
            setLoading(true); // Only set loading to true if not loaded from cache, or before refetching from Firebase
        }

        const journalQuery = query(
            collection(db, 'journalEntries'),
            where('userId', '==', uid),
            orderBy('createdAt', 'desc') // Order by createdAt for initial load and updates
        );


        let unsubJournal;


        const handleJournalSnapshot = (snapshot) => {
            const fetchedEntries = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
                createdAt: convertTimestamp(doc.data().createdAt), // Use memoized convertTimestamp
            }));
            setJournalEntries(fetchedEntries);
            setDataLoadCounter(prevCounter => prevCounter + 1); // Increment counter when journal entries loaded
        };


        unsubJournal = onSnapshot(journalQuery, handleJournalSnapshot, error => {
            console.error("Journal entries onSnapshot error:", error);
            setDataLoadCounter(prevCounter => prevCounter + 1); // Ensure counter is incremented even on error
        });


        return () => {
            if (unsubJournal) unsubJournal();
        };


    }, [convertTimestamp, loadCachedData]); // Dependencies array for useCallback


    // Set loading to false and cache data after data is loaded
    useEffect(() => {
        if (dataLoadCounter >= 1 && user) { // dataLoadCounter >= 1 enough as we only have journal entries loading
            cacheData(user.uid, journalEntries);
            setLoading(false);
            setDataLoadCounter(0); // Reset counter
        }
    }, [dataLoadCounter, user, journalEntries, cacheData]); // Include cacheData in dependency array


    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
            if (!currentUser) {
                navigate('login'); // <-- Use navigate prop, page name as string
            } else {
                setUser(currentUser);
                fetchData(currentUser.uid);
            }
        });
        return () => unsubscribeAuth();
    }, [navigate, fetchData]); // fetchData is useCallback, so safe to include


    const journalEntryCount = useMemo(() => journalEntries.length, [journalEntries]);


    const renderJournalEntriesByMonth = useMemo(() => {
        if (loading) {
            return <p>Loading journal entries...</p>;
        } else if (journalEntries.length > 0) {
            const entriesByMonth = journalEntries.reduce((acc, entry) => {
                if (!entry.createdAt) return acc;
                const monthYear = entry.createdAt.toLocaleString('en-US', { month: 'long', year: 'numeric' });
                if (!acc[monthYear]) {
                    acc[monthYear] = [];
                }
                acc[monthYear].push(entry);
                return acc;
            }, {});
            return Object.entries(entriesByMonth).map(([monthYear, entries]) => (
                <section key={monthYear} className="month-section">
                    <h2 className="month-header">{monthYear}</h2>
                    <ul className="journal-entries-list">
                        {entries.map((entry) => (
                            <li key={entry.id} className="journal-entry-item">
                                <div className="entry-date">
                                    {entry.createdAt.toLocaleString('en-US', {
                                        weekday: 'short',
                                        hour: 'numeric',
                                        minute: 'numeric',
                                        second: 'numeric',
                                        hour12: false,
                                        day: 'numeric'
                                    }).replace(/,/g, '.')}
                                </div>
                                <div className="entry-mood">{entry.mood}</div>
                            </li>
                        ))}
                    </ul>
                </section>
            ));
        } else {
            return <p>No journal entries found.</p>;
        }
    }, [loading, journalEntries]); // loading and journalEntries are dependencies


    return (
        <div className="journal-overview-container">
            <Header
                navigate={navigate} // <-- Pass navigate prop to Header
                variant="journalOverview"
                showBackArrow={true}
                onBack={() => navigate('home')} // <-- Use navigate prop, page name as string
            />
            <section className="motivational-section">
                {!loading && (
                    <TextGenerateEffect
                        words={`You logged <span class="accent-text">${journalEntryCount} moments</span>. Progress blooms where focus takes root.`}
                    />
                )}
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