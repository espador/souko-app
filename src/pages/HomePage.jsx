// src/pages/HomePage.jsx
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import {
    collection,
    getDocs,
    query,
    where,
    doc,
    getDoc,
    onSnapshot,
} from 'firebase/firestore';
import { useNavigate, Link, useLocation } from 'react-router-dom';
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

const HomePage = React.memo(() => {
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

    const navigate = useNavigate();
    const location = useLocation();
    const fabRef = useRef(null);
    const scrollTimeout = useRef(null);

    const hasActiveSession = Boolean(activeSession);

    // Function to fetch data for the homepage (projects, sessions, etc.)
    const fetchData = useCallback(async (uid) => {
        setLoading(true);
        try {
            // 1) Projects
            const projectSnapshot = await getDocs(
                query(collection(db, 'projects'), where('userId', '==', uid))
            );
            const userProjects = projectSnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));
            setProjects(userProjects);

            // 2) Sessions (for general stats)
            const sessionSnapshot = await getDocs(
                query(collection(db, 'sessions'), where('userId', '==', uid))
            );
            const userSessions = sessionSnapshot.docs.map((doc) => doc.data());
            setSessions(userSessions);
            setHasTrackedEver(userSessions.length > 0);

            // 3) Journal entries (last 7 days)
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const journalSnapshot = await getDocs(
                query(
                    collection(db, 'journalEntries'),
                    where('userId', '==', uid),
                    where('createdAt', '>=', sevenDaysAgo)
                )
            );
            const userJournalEntries = journalSnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));
            setJournalEntries(userJournalEntries);

            // 4) User profile
            const profileRef = doc(db, 'profiles', uid);
            const profileSnap = await getDoc(profileRef);
            if (profileSnap.exists()) {
                setUserProfile(profileSnap.data());
                setTotalTrackedTimeMinutes(profileSnap.data().totalTrackedTime || 0); // Initialize totalTrackedTimeMinutes
            } else {
                setUserProfile(null);
            }

            // 5) Level Configuration - FETCHING LEVEL CONFIGURATION HERE
            const levelConfigRef = doc(db, 'config', 'level_config');
            const levelConfigSnap = await getDoc(levelConfigRef);
            if (levelConfigSnap.exists()) {
                setLevelConfig(levelConfigSnap.data());
            } else {
                console.error("Level config document not found!");
                setLevelConfig({}); // Set to empty object to avoid errors in LevelProfile, or handle error differently
            }


        } catch (error) {
            console.error('Error fetching data:', error.message);
        } finally {
            setLoading(false);
        }
    }, []);

    // Listen for auth changes and perform auto-redirect only once per app session
    useEffect(() => {
        const skipAutoRedirect = location.state?.skipAutoRedirect;
        const autoRedirectDone = sessionStorage.getItem('autoRedirectDone');
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (!currentUser) {
                navigate('/');
            } else {
                setUser(currentUser);

                // If we haven't skipped auto-redirect and haven't auto-redirected yet...
                if (!skipAutoRedirect && !autoRedirectDone) {
                    const activeSessionQuery = query(
                        collection(db, 'sessions'),
                        where('userId', '==', currentUser.uid),
                        where('endTime', '==', null)
                    );
                    const activeSessionSnapshot = await getDocs(activeSessionQuery);
                    if (!activeSessionSnapshot.empty) {
                        // Mark that we've already auto-redirected for this app session.
                        sessionStorage.setItem('autoRedirectDone', 'true');
                        navigate('/time-tracker');
                        return; // Exit early to avoid fetching extra data.
                    }
                }

                // Otherwise, fetch the rest of the homepage data.
                fetchData(currentUser.uid);
            }
        });
        return () => unsubscribe();
    }, [navigate, fetchData, location.state]);

    // Listen for an active session and total tracked time updates
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

            // 2. Total Tracked Time Listener
            const unsubscribeProfile = onSnapshot(profileRef, (docSnap) => {
                if (docSnap.exists()) {
                    setUserProfile(docSnap.data());
                    setTotalTrackedTimeMinutes(docSnap.data().totalTrackedTime || 0);
                }
            });


            return () => {
                unsubscribeActiveSession();
                unsubscribeProfile();
            };
        }
    }, [user]);


    // Show/hide FAB while scrolling
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

    // Onboarding logic
    useEffect(() => {
        if (!loading && userProfile !== undefined) {
            const isOnboardingRoute = location.pathname.startsWith('/onboarding');
            if (!isOnboardingRoute) {
                if (!userProfile || userProfile.onboardingComplete !== true) {
                    navigate('/onboarding/step1');
                }
            }
        }
    }, [loading, userProfile, location, navigate]);

    // Limit projects to the 3 most recent ones
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

    // Weekly tracked time from the user profile
    const weeklyTrackedTime = userProfile?.weeklyTrackedTime || 0;

    const handleLogout = useCallback(async () => {
        try {
            await signOut(auth);
            navigate('/');
        } catch (error) {
            console.error('Logout Error:', error.message);
        }
    }, [navigate]);

    const openSidebar = useCallback(() => setIsSidebarOpen(true), []);
    const closeSidebar = useCallback(() => setIsSidebarOpen(false), []);

    // Updated loading state to use the spinner component
    if (loading) {
        return (
            <div className="homepage-loading">
                <SoukoLogoHeader className="profile-pic souko-logo-header spinning-logo" />
            </div>
        );
    }

    return (
        <div className="homepage">
            <Header user={userProfile} showLiveTime={true} onProfileClick={openSidebar} />
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

                <JournalSection journalEntries={journalEntries} loading={false} />

                <section className="projects-section">
                    <div className="projects-header">
                        <h2 className="projects-label">Your projects</h2>
                        <div className="projects-actions">
                            <Link to="/projects" className="projects-all-link">
                                All
                            </Link>
                        </div>
                    </div>
                    {projectsToRender.length > 0 ? (
                        <ul className="projects-list">
                            {projectsToRender.map((project) => (
                                <li
                                    key={project.id}
                                    className="project-item"
                                    onClick={() => navigate(`/project/${project.id}`)}
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

            <button ref={fabRef} className="fab" onClick={() => navigate('/time-tracker')}>
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