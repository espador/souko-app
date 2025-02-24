import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { auth, db } from '../services/firebase';
import { signOut } from 'firebase/auth';
import {
    collection,
    getDocs,
    query,
    where,
    doc,
    getDoc,
    onSnapshot,
} from 'firebase/firestore';
import { formatTime } from '../utils/formatTime';
import Header from '../components/Layout/Header';
import '../styles/global.css';
import '../styles/components/HomePage.css';
import { ReactComponent as StartTimerIcon } from '../styles/components/assets/start-timer.svg';
import { ReactComponent as StopTimerIcon } from '../styles/components/assets/stop-timer.svg';
// Import spinner component (same as used in ProjectOverviewPage)
import { ReactComponent as SoukoLogoHeader } from '../styles/components/assets/Souko-logo-header.svg';
import '@fontsource/shippori-mincho';
import Sidebar from '../components/Layout/Sidebar';
import '../styles/components/Sidebar.css';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { TextGenerateEffect } from '../styles/components/text-generate-effect.tsx';
import JournalSection from '../components/Journal/JournalSection';
import LevelProfile from '../components/Level/LevelProfile'; // Import LevelProfile

export const cn = (...inputs) => twMerge(clsx(inputs));

const CACHE_DURATION_MS = 30000; // 30 seconds - adjust as needed

const loadCachedHomePageData = (uid, setDataFunctions) => {
    const cachedStr = localStorage.getItem(`homePageData_${uid}`);
    if (cachedStr) {
        try {
            const cached = JSON.parse(cachedStr);
            if (Date.now() - cached.timestamp < CACHE_DURATION_MS) {
                setDataFunctions.setProjects(cached.projects || []);
                setDataFunctions.setSessions(cached.sessions || []);
                setDataFunctions.setJournalEntries(cached.journalEntries || []);
                setDataFunctions.setUserProfile(cached.userProfile || null);
                setDataFunctions.setLevelConfig(cached.levelConfig || null);
                setDataFunctions.setHasTrackedEver(cached.hasTrackedEver || false);
                return true;
            }
        } catch (e) {
            console.error("Error parsing cached home page data", e);
        }
    }
    return false;
};

const cacheHomePageData = (uid, projects, sessions, journalEntries, userProfile, levelConfig, hasTrackedEver) => {
    const cache = {
        projects,
        sessions,
        journalEntries,
        userProfile,
        levelConfig,
        hasTrackedEver,
        timestamp: Date.now()
    };
    localStorage.setItem(`homePageData_${uid}`, JSON.stringify(cache));
};


const HomePage = React.memo(({ navigate, skipAutoRedirect, currentPage }) => { // <-- Get navigate, skipAutoRedirect, currentPage props
    const [user, setUser] = useState(null);
    const [projects, setProjects] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [journalEntries, setJournalEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [userProfile, setUserProfile] = useState(null);
    const [hasTrackedEver, setHasTrackedEver] = useState(false);
    const [activeSession, setActiveSession] = useState(null);
    const [totalTrackedTimeMinutes, setTotalTrackedTimeMinutes] = useState(0);
    const [levelConfig, setLevelConfig] = useState(null); // New state for level config
    const [dataLoadCounter, setDataLoadCounter] = useState(0);


    const fabRef = useRef(null);
    const scrollTimeout = useRef(null);

    const hasActiveSession = Boolean(activeSession);

    const setDataFunctions = useMemo(() => ({
        setProjects,
        setSessions,
        setJournalEntries,
        setUserProfile,
        setLevelConfig,
        setHasTrackedEver
    }), [setProjects, setSessions, setJournalEntries, setUserProfile, setLevelConfig, setHasTrackedEver]);


    const fetchData = useCallback(async (uid) => {
        if (loadCachedHomePageData(uid, setDataFunctions)) {
            setLoading(false); // If loaded from cache, no need to wait for firebase
        } else {
            setLoading(true); // Only set loading to true if not loaded from cache, or before refetching from Firebase
        }

        try {
            // 1) Projects
            const projectsQuery = query(collection(db, 'projects'), where('userId', '==', uid));
            const sessionsQuery = query(collection(db, 'sessions'), where('userId', '==', uid));
            const journalQuery = query(
                collection(db, 'journalEntries'),
                where('userId', '==', uid),
                where('createdAt', '>=', (() => {
                    const sevenDaysAgo = new Date();
                    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                    return sevenDaysAgo;
                })())
            );
            const profileRef = doc(db, 'profiles', uid);
            const levelConfigRef = doc(db, 'config', 'level_config');


            let unsubProjects, unsubSessions, unsubJournal, unsubProfile, unsubLevelConfig;


            const handleProjectsSnapshot = (snapshot) => {
                const userProjects = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                }));
                setProjects(userProjects);
                setDataLoadCounter(prevCounter => prevCounter + 1);
            };

            const handleSessionsSnapshot = (snapshot) => {
                const userSessions = snapshot.docs.map((doc) => doc.data());
                setSessions(userSessions);
                setHasTrackedEver(userSessions.length > 0);
                setDataLoadCounter(prevCounter => prevCounter + 1);
            };
            const handleJournalSnapshot = (snapshot) => {
                const userJournalEntries = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                }));
                setJournalEntries(userJournalEntries);
                setDataLoadCounter(prevCounter => prevCounter + 1);
            };

            const handleProfileSnapshot = (docSnap) => {
                if (docSnap.exists()) {
                    setUserProfile(docSnap.data());
                    setTotalTrackedTimeMinutes(docSnap.data().totalTrackedTime || 0);
                } else {
                    setUserProfile(null);
                }
                setDataLoadCounter(prevCounter => prevCounter + 1);
            };
            const handleLevelConfigSnapshot = (levelConfigSnap) => {
                if (levelConfigSnap.exists()) {
                    setLevelConfig(levelConfigSnap.data());
                } else {
                    console.error("Level config document not found!");
                    setLevelConfig({});
                }
                setDataLoadCounter(prevCounter => prevCounter + 1);
            };


            // Using onSnapshot for real-time updates
            unsubProjects = onSnapshot(projectsQuery, handleProjectsSnapshot, error => console.error("Projects onSnapshot error:", error));
            unsubSessions = onSnapshot(sessionsQuery, handleSessionsSnapshot, error => console.error("Sessions onSnapshot error:", error));
            unsubJournal = onSnapshot(journalQuery, handleJournalSnapshot, error => console.error("Journal onSnapshot error:", error));
            unsubProfile = onSnapshot(profileRef, handleProfileSnapshot, error => console.error("Profile onSnapshot error:", error));
            unsubLevelConfig = onSnapshot(levelConfigRef, handleLevelConfigSnapshot, error => console.error("LevelConfig onSnapshot error:", error));


            return () => {
                if (unsubProjects) unsubProjects();
                if (unsubSessions) unsubSessions();
                if (unsubJournal) unsubJournal();
                if (unsubProfile) unsubProfile();
                if (unsubLevelConfig) unsubLevelConfig();
            };


        } catch (error) {
            console.error('Error fetching data:', error.message);
            setLoading(false); // Ensure loading is set to false even on error
        }
    }, [setDataFunctions]);


    useEffect(() => {
        const unsubscribeAuth = auth.onAuthStateChanged(async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                fetchData(currentUser.uid);
            } else {
                navigate('login');
            }
        });
        return unsubscribeAuth;
    }, [navigate, fetchData]);


    useEffect(() => {
        if (dataLoadCounter >= 5 && user) { // Wait for 5 data sets: projects, sessions, journal, profile, levelConfig
            cacheHomePageData(user.uid, projects, sessions, journalEntries, userProfile, levelConfig, hasTrackedEver);
            setLoading(false);
            setDataLoadCounter(0); // Reset counter

        }
    }, [dataLoadCounter, user, projects, sessions, journalEntries, userProfile, levelConfig, hasTrackedEver]);


    // Listen for an active session and total tracked time updates (KEEP THIS LOGIC)
    useEffect(() => {
        if (user) {
            const profileRef = doc(db, 'profiles', user.uid);

            // 1. Active Session Listener
            const activeSessionQuery = query(
                collection(db, 'sessions'),
                where('userId', '==', user.uid),
                where('endTime', '==', null)
            );
            const unsubscribeActiveSession = onSnapshot(activeSessionQuery, (snapshot) => {
                if (!snapshot.empty) {
                    setActiveSession(snapshot.docs[0].data());
                } else {
                    setActiveSession(null);
                }
            });

            // 2. Total Tracked Time Listener - Already handled in main data fetch to avoid duplication and potential conflicts


            return () => {
                unsubscribeActiveSession();
                // unsubscribeProfile; // No need to unsubscribe profile listener here as it's managed in fetchData
            };
        }
    }, [user]);


    // Show/hide FAB while scrolling (KEEP THIS LOGIC)
    useEffect(() => {
        const handleScroll = () => {
            if (fabRef.current) {
                fabRef.current.classList.add('scrolling');
                clearTimeout(scrollTimeout.current);
                scrollTimeout.current = setTimeout(() => {
                    fabRef.current && fabRef.current.classList.remove('scrolling');
                }, 300);
            }
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Onboarding logic (KEEP THIS LOGIC - but adjusted for currentPage prop)
    useEffect(() => {
        if (!loading && userProfile !== undefined) {
            // REMOVED: const isOnboardingRoute = location.pathname.startsWith('/onboarding'); // <-- No longer using location.pathname
            const isOnboardingRoute = currentPage.startsWith('onboarding'); // Check currentPage prop directly
            if (!isOnboardingRoute) {
                if (!userProfile || userProfile.onboardingComplete !== true) {
                    navigate('onboarding-step1'); // <-- Use navigate prop, page name as string
                }
            }
        }
    }, [loading, userProfile, navigate, currentPage]); // <-- Depend on currentPage prop

    // Limit projects to the 3 most recent ones (KEEP THIS LOGIC)
    const projectsToRender = useMemo(() => {
        return [...projects]
            .sort((a, b) => (b.lastTrackedTime || 0) - (a.lastTrackedTime || 0))
            .slice(0, 3);
    }, [projects]);

    const totalSessionTime = useMemo(() => {
        return sessions.reduce((acc, session) => {
            const projectId = session.projectId || 'Unknown Project';
            acc[projectId] = (acc[projectId] || 0) + (session.elapsedTime || 0);
            return acc;
        }, {});
    }, [sessions]);

    // Weekly tracked time from the user profile (KEEP THIS LOGIC)
    const weeklyTrackedTime = userProfile?.weeklyTrackedTime || 0;

    const handleLogout = useCallback(async () => {
        try {
            await signOut(auth);
            navigate('login'); // <-- Use navigate prop, page name as string
        } catch (error) {
            console.error('Logout Error:', error.message);
        }
    }, [navigate]);

    const openSidebar = useCallback(() => setIsSidebarOpen(true), []);
    const closeSidebar = useCallback(() => setIsSidebarOpen(false), []);

    // Updated loading state to use the spinner component (KEEP THIS LOGIC)
    if (loading) {
        return (
            <div className="homepage-loading">
                <SoukoLogoHeader className="profile-pic souko-logo-header spinning-logo" />
            </div>
        );
    }

    return (
        <div className="homepage">
            <Header navigate={navigate} user={userProfile} showLiveTime={true} onProfileClick={openSidebar} /> {/* ✅ navigate prop passed to Header */}
            <main className="homepage-content">
                <LevelProfile
                    projectName="Souko"
                    totalTrackedTimeMinutes={totalTrackedTimeMinutes}
                    levelProgressionData={levelConfig} // PASSING LEVEL CONFIGURATION DATA HERE
                />

                <section className="motivational-section">
                    <TextGenerateEffect
                        words={
                            !hasTrackedEver
                                ? `Every journey begins with one moment.\nStart tracking yours.`
                                : weeklyTrackedTime > 0
                                    ? `This moment is\n progress. You\n tracked <span class="accent-text">${formatTime(
                                        weeklyTrackedTime
                                    )}</span>\n this week.`
                                    : `Momentum begins with a single tracked hour. Let’s go.`
                        }
                    />
                </section>

                <JournalSection navigate={navigate} journalEntries={journalEntries} loading={false} /> {/* ✅ navigate prop passed to JournalSection */}

                <section className="projects-section">
                    <div className="projects-header">
                        <h2 className="projects-label">Your projects</h2>
                        <div className="projects-actions">
                            {/* ✅ Replace <Link> with button and navigate */}
                            <button onClick={() => navigate('projects')} className="projects-all-link">
                                All
                            </button>
                        </div>
                    </div>
                    {projectsToRender.length > 0 ? (
                        <ul className="projects-list">
                            {projectsToRender.map((project) => (
                                <li
                                    key={project.id}
                                    className="project-item"
                                    onClick={() => navigate('project-detail', { projectId: project.id })} // ✅ navigate to 'project-detail' with params
                                >
                                    <div className="project-image-container">
                                        {project.imageUrl ? (
                                            <img
                                                src={project.imageUrl}
                                                alt={project.name}
                                                className="project-image"
                                            />
                                        ) : (
                                            <div
                                                className="default-project-image"
                                                style={{ backgroundColor: '#FE2F00' }}
                                            >
                                                <span>{project.name?.charAt(0).toUpperCase() || 'P'}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="project-name">{project.name}</div>
                                    <div className="project-total-time">
                                        {totalSessionTime[project.id]
                                            ? formatTime(totalSessionTime[project.id])
                                            : formatTime(0)}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p>No projects found. Start tracking to see results here!</p>
                    )}
                </section>
            </main>

            <Sidebar
                isOpen={isSidebarOpen}
                onClose={closeSidebar}
                onLogout={handleLogout}
            />
            {isSidebarOpen && <div className="sidebar-overlay" onClick={closeSidebar}></div>}

            <button ref={fabRef} className="fab" onClick={() => navigate('time-tracker')}> {/* ✅ navigate to 'time-tracker' */}
                {hasActiveSession ? (
                    <StopTimerIcon className="fab-icon" />
                ) : (
                    <StartTimerIcon className="fab-icon" />
                )}
            </button>
        </div>
    );
});

HomePage.displayName = 'HomePage';
export default HomePage;