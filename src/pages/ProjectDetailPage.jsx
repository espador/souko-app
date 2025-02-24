import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom'; // Keep useParams to get projectId from URL (if needed for initial load)
import {
    doc,
    getDoc,
    collection,
    query,
    where,
    orderBy,
    getDocs,
    onSnapshot,
    startAfter,
    limit
} from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { formatTime } from '../utils/formatTime';
import Header from '../components/Layout/Header';
import '../styles/global.css';
import '../styles/components/ProjectDetailPage.css';
import { ReactComponent as DropdownIcon } from '../styles/components/assets/dropdown.svg';
import { ReactComponent as SoukoLogoHeader } from '../styles/components/assets/Souko-logo-header.svg';
import { ReactComponent as TimerIcon } from '../styles/components/assets/timer.svg';
import { ReactComponent as BillableIcon } from '../styles/components/assets/billable.svg';
import { ReactComponent as EditIcon } from '../styles/components/assets/edit.svg';
import { TextGenerateEffect } from '../styles/components/text-generate-effect.tsx';
import { ReactComponent as StartTimerIcon } from '../styles/components/assets/start-timer.svg';
import { ReactComponent as StopTimerIcon } from '../styles/components/assets/stop-timer.svg';

const CACHE_DURATION_MS = 30000; // 30 seconds
const SESSIONS_LIMIT = 30; // Load 30 sessions at a time

// Helper to convert session start time into a Date object.
const convertToDate = (session) => {
    if (session.startTimeMs != null) {
        const num = Number(session.startTimeMs);
        const date = new Date(num);
        if (!isNaN(date.getTime())) return date;
    }
    if (session.startTime && typeof session.startTime.toDate === 'function') {
        try {
            return session.startTime.toDate();
        } catch (error) {
            console.error('Error converting Timestamp:', error);
        }
    }
    if (session.startTime && session.startTime.seconds != null && session.startTime.nanoseconds != null) {
        const seconds = Number(session.startTime.seconds);
        const nanoseconds = Number(session.startTime.nanoseconds);
        const date = new Date(seconds * 1000 + nanoseconds / 1000000);
        if (!isNaN(date.getTime())) return date;
    }
    if (session.startTime && typeof session.startTime === 'string') {
        let parsed = new Date(session.startTime);
        if (isNaN(parsed.getTime())) {
            parsed = new Date(session.startTime.replace(' at ', ' '));
        }
        if (!isNaN(parsed.getTime())) return parsed;
    }
    return null;
};

const loadCachedProjectDetail = (uid, projectId) => {
    const cacheKey = `projectDetailData_${uid}_${projectId}`;
    const cachedStr = localStorage.getItem(cacheKey);
    if (cachedStr) {
        try {
            const cached = JSON.parse(cachedStr);
            if (Date.now() - cached.timestamp < CACHE_DURATION_MS) {
                return cached;
            }
        } catch (e) {
            console.error('Error parsing cached project detail data', e);
        }
    }
    return null;
};

const cacheProjectDetail = (uid, projectId, project, sessions, lastSessionDocCache) => {
    const cacheKey = `projectDetailData_${uid}_${projectId}`;
    const cache = {
        project: project,
        sessions: sessions,
        lastSessionDoc: lastSessionDocCache, // Cache lastSessionDoc
        timestamp: Date.now(),
    };
    localStorage.setItem(cacheKey, JSON.stringify(cache));
};


const ProjectDetailPage = React.memo(({ navigate, projectId }) => { // <-- Receive navigate and projectId props
    const routeProjectId = projectId; // Use projectId prop directly
    const [project, setProject] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);

    // Pagination state:
    const [lastSessionDoc, setLastSessionDoc] = useState(null);
    const [hasMoreSessions, setHasMoreSessions] = useState(true);
    const [sessionsLoading, setSessionsLoading] = useState(false); // Separate loading state for sessions

    // State for filters and display mode
    const [selectedTimeRange, setSelectedTimeRange] = useState('total');
    const [displayMode, setDisplayMode] = useState('time');
    const [effectTrigger, setEffectTrigger] = useState(0);
    const projectHeaderRef = useRef(null);

    // Optimized active session state for FAB
    const [activeSession, setActiveSession] = useState(null);
    const fabRef = useRef(null);
    const scrollTimeout = useRef(null);


    const fetchProjectDetails = useCallback(async (projectId, uid) => {
        const cachedData = loadCachedProjectDetail(uid, projectId);
        if (cachedData) {
            setProject(cachedData.project || null);
            setSessions(cachedData.sessions || []);
            setLastSessionDoc(cachedData.lastSessionDoc || null); // Restore lastSessionDoc from cache
            setHasMoreSessions(cachedData.sessions ? cachedData.sessions.length >= SESSIONS_LIMIT : true);
            setLoading(false);
        } else {
            setLoading(true); // Initial loading from firebase
        }

        try {
            const projectRef = doc(db, 'projects', projectId);
            const projectSnapshot = await getDoc(projectRef);
            if (!projectSnapshot.exists() || projectSnapshot.data().userId !== uid) {
                console.error('Project not found or unauthorized.');
                setProject(null);
                setLoading(false);
                return;
            }
            const projectData = { id: projectSnapshot.id, ...projectSnapshot.data() };
            setProject(projectData);

            // Initial sessions fetch moved to separate useEffect with pagination handling

        } catch (error) {
            console.error('Error fetching project details:', error);
            setProject(null);
            setLoading(false);
        }
    }, []);


    // Fetch initial sessions and setup session listener (with pagination)
    useEffect(() => {
        if (!currentUser || !routeProjectId) return;

        setSessionsLoading(true); // Start loading sessions
        let initialSessionFetch = true; // Flag to skip initial cache update from listener

        const sessionsRef = collection(db, 'sessions');
        const sessionsQuery = query(
            sessionsRef,
            where('projectId', '==', routeProjectId),
            where('userId', '==', currentUser.uid),
            where('status', '==', 'stopped'),
            orderBy('startTime', 'desc'),
            limit(SESSIONS_LIMIT)
        );


        const unsubSessions = onSnapshot(sessionsQuery, async (snapshot) => {
            const fetchedSessions = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));
            setSessions(fetchedSessions);
            setHasMoreSessions(snapshot.docs.length >= SESSIONS_LIMIT);
            setLastSessionDoc(snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null); // Update lastSessionDoc

            if (!initialSessionFetch) { // Skip caching on initial load as fetchProjectDetails might have already cached
                cacheProjectDetail(currentUser.uid, routeProjectId, project, fetchedSessions, snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null); // Update cache with new sessions and lastDoc
            }
            initialSessionFetch = false;
            setSessionsLoading(false); // Sessions loading complete
        }, error => {
            console.error("Sessions onSnapshot error:", error);
            setSessionsLoading(false);
        });


        return () => {
            unsubSessions();
        };

    }, [currentUser, routeProjectId, project]); // Removed fetchProjectDetails from dependency, using project from state


    const handleLoadMore = useCallback(async () => {
        if (!currentUser || !routeProjectId || !hasMoreSessions || sessionsLoading) return; // Prevent loading more while sessions are already loading
        setSessionsLoading(true); // Start loading more sessions

        const sessionsRef = collection(db, 'sessions');
        const q = query(
            sessionsRef,
            where('projectId', '==', routeProjectId),
            where('userId', '==', currentUser.uid),
            where('status', '==', 'stopped'),
            orderBy('startTime', 'desc'),
            startAfter(lastSessionDoc),
            limit(SESSIONS_LIMIT)
        );

        try {
            const sessionsSnapshot = await getDocs(q);
            const moreSessions = sessionsSnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));

            setSessions((prev) => [...prev, ...moreSessions]);
            setHasMoreSessions(sessionsSnapshot.docs.length >= SESSIONS_LIMIT);
            setLastSessionDoc(sessionsSnapshot.docs.length > 0 ? sessionsSnapshot.docs[sessionsSnapshot.docs.length - 1] : lastSessionDoc); // Update lastSessionDoc if new docs are present

            // Update cache after loading more sessions - important to include new sessions and updated lastSessionDoc
            cacheProjectDetail(currentUser.uid, routeProjectId, project, [...sessions, ...moreSessions], sessionsSnapshot.docs.length > 0 ? sessionsSnapshot.docs[sessionsSnapshot.docs.length - 1] : lastSessionDoc);

        } catch (error) {
            console.error('Error loading more sessions:', error);
        } finally {
            setSessionsLoading(false); // Finish loading more sessions
        }
    }, [currentUser, routeProjectId, lastSessionDoc, hasMoreSessions, sessions, project, sessionsLoading]); // Added sessionsLoading to dependencies


    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setCurrentUser(user);
                fetchProjectDetails(routeProjectId, user.uid); // Fetch project details on auth state change
            } else {
                navigate('login'); // <-- Use navigate prop, page name as string
            }
            setLoading(false); // Set general loading to false after auth and project details are attempted
        });
        return () => unsubscribe();
    }, [navigate, routeProjectId, fetchProjectDetails]);


    // Optimized active session listener for FAB
    useEffect(() => {
        if (currentUser) {
            const activeSessionQuery = query(
                collection(db, 'sessions'),
                where('userId', '==', currentUser.uid),
                where('endTime', '==', null)
            );
            const unsubActiveSession = onSnapshot(activeSessionQuery, (snapshot) => {
                if (!snapshot.empty) {
                    setActiveSession(snapshot.docs[0].data());
                } else {
                    setActiveSession(null);
                }
            });
            return () => unsubActiveSession();
        }
    }, [currentUser]);


    const handleTimeRangeChange = useCallback((e) => {
        setSelectedTimeRange(e.target.value);
    }, []);

    const handleDisplayModeChange = useCallback((mode) => {
        setDisplayMode(mode);
        setEffectTrigger((prev) => prev + 1);
    }, []);

    const getSessionsForTimeRange = useCallback((sessions, timeRange) => {
        if (timeRange === 'total') {
            return sessions;
        }
        const now = new Date();
        let startDate;
        if (timeRange === 'week') {
            const dayOfWeek = now.getDay();
            const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            startDate = new Date(now);
            startDate.setDate(now.getDate() - mondayOffset);
            startDate.setHours(0, 0, 0, 0);
        } else if (timeRange === 'month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            startDate.setHours(0, 0, 0, 0);
        }
        return sessions.filter((session) => {
            const sessionDate = convertToDate(session);
            return sessionDate && sessionDate >= startDate && sessionDate <= now;
        });
    }, []);

    const filteredSessions = useMemo(() => {
        return getSessionsForTimeRange(sessions, selectedTimeRange);
    }, [sessions, selectedTimeRange, getSessionsForTimeRange]);

    const totalTime = useMemo(() => {
        return filteredSessions.reduce(
            (sum, session) => sum + (session.elapsedTime || 0),
            0
        );
    }, [filteredSessions]);

    const billableTime = useMemo(() => {
        return filteredSessions.reduce(
            (sum, session) => (session.isBillable ? sum + (session.elapsedTime || 0) : sum),
            0
        );
    }, [filteredSessions]);

    const totalEarned = useMemo(() => {
        if (displayMode === 'earned' && project?.hourRate) {
            const rate = parseFloat(project.hourRate);
            if (!isNaN(rate)) {
                return (billableTime / 3600) * rate;
            }
        }
        return 0;
    }, [displayMode, project?.hourRate, billableTime]);

    // NEW: Format the earned amount based on currencyId
    const formatEarnedAmount = useCallback(
        (amount) => {
            if (!project) return '';
            // Default to euro if currencyId isn't set
            const isDollar = project.currencyId === 'dollar';
            const symbol = isDollar ? '$' : '€';
            const locale = isDollar ? 'en-US' : 'en-DE';
            return `${symbol}${amount.toLocaleString(locale, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            })}`;
        },
        [project]
    );

    const sessionsByDate = useMemo(() => {
        return filteredSessions.reduce((acc, session) => {
            let dateStr = 'Invalid Date';
            const dateObj = convertToDate(session);
            if (dateObj) {
                try {
                    dateStr = dateObj.toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                    });
                } catch (error) {
                    console.error('Error converting date:', error, session.startTime);
                }
            }
            if (!acc[dateStr]) {
                acc[dateStr] = [];
            }
            acc[dateStr].push(session);
            return acc;
        }, {});
    }, [filteredSessions]);

    const sortedDates = useMemo(() => {
        return Object.keys(sessionsByDate).sort((a, b) => {
            if (a === 'Invalid Date') return 1;
            if (b === 'Invalid Date') return -1;
            try {
                const dateA = new Date(a);
                const dateB = new Date(b);
                return dateB - dateA;
            } catch (error) {
                console.error('Error comparing dates:', error);
                return 0;
            }
        });
    }, [sessionsByDate]);

    const formatStartTime = useCallback((session) => {
        const date = convertToDate(session);
        if (date) {
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${hours}:${minutes}`;
        }
        return 'N/A';
    }, []);


    const hasActiveSession = Boolean(activeSession);

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

    if (loading) {
        return (
            <div className="homepage-loading">
                <SoukoLogoHeader className="profile-pic souko-logo-header spinning-logo" />
            </div>
        );
    }

    if (!project) {
        return (
            <div className="project-container">
                <h1 className="error-title">Project not found</h1>
                <button className="button" onClick={() => navigate('home')}> {/* ✅ navigate to 'home' */}
                    Return to Homepage
                </button>
            </div>
        );
    }

    return (
        <div className="project-container">
            <Header variant="journalOverview" showBackArrow={true} navigate={navigate} /> {/* ✅ navigate prop passed to Header */}
            <div
                className="project-dropdown-container top-tile"
                onClick={() => {
                    console.log('Navigating to update project with projectId:', project.id);
                    navigate('update-project', { projectId: project.id, }); // ✅ navigate to 'update-project' with params
                }}
            >
                {project?.imageUrl ? (
                    <img src={project.imageUrl} alt={project.name} className="dropdown-project-image" />
                ) : project?.name ? (
                    <div className="dropdown-default-image">
                        {project.name.charAt(0).toUpperCase()}
                    </div>
                ) : null}
                <div className="project-name">{project.name}</div>
                <EditIcon className="edit-icon" />
            </div>

            <div className="filters-container">
                <div className="time-range-dropdown">
                    <select
                        className="time-range-select"
                        value={selectedTimeRange}
                        onChange={handleTimeRangeChange}
                    >
                        <option value="total">Total</option>
                        <option value="week">This week</option>
                        <option value="month">This month</option>
                    </select>
                    <DropdownIcon className="dropdown-arrow" />
                </div>

                <div className="display-mode-toggle">
                    <button
                        className={`display-mode-button ${displayMode === 'time' ? 'active' : 'muted'}`}
                        onClick={() => handleDisplayModeChange('time')}
                    >
                        <TimerIcon className="display-mode-icon" />
                    </button>
                    <button
                        className={`display-mode-button ${displayMode === 'earned' ? 'active' : 'muted'}`}
                        onClick={() => handleDisplayModeChange('earned')}
                    >
                        <BillableIcon className="display-mode-icon" />
                    </button>
                </div>
            </div>

            <div className="project-header-container" ref={projectHeaderRef}>
                <h1 className="timer project-time">
                    {displayMode === 'time' ? (
                        <TextGenerateEffect
                            key={`time-value-${effectTrigger}`}
                            words={formatTime(totalTime)}
                        />
                    ) : (
                        <TextGenerateEffect
                            key={`earned-value-${effectTrigger}`}
                            words={formatEarnedAmount(totalEarned)}
                        />
                    )}
                </h1>
            </div>

            <div className="sessions-container">
                {sortedDates.length > 0 ? (
                    sortedDates.map((date) => (
                        <div key={date} className="sessions-by-day">
                            <h2>
                                {date === 'Invalid Date'
                                    ? 'Invalid Date'
                                    : new Date(date).toLocaleDateString('en-US', {
                                        weekday: 'long',
                                        month: 'long',
                                        day: 'numeric',
                                    })}
                            </h2>
                            <ul className="sessions-list">
                                {sessionsByDate[date].map((session) => (
                                    // ✅ Replace <Link> with button and navigate to 'session-detail' with params
                                    <li key={session.id} className="session-item input-tile" onClick={() => navigate('session-detail', { sessionId: session.id })}>
                                        <span className="session-start-time">{formatStartTime(session)}</span>
                                        <span
                                            className="session-time"
                                            style={{
                                                color: session.isBillable
                                                    ? 'var(--accent-color)'
                                                    : 'var(--text-muted)',
                                            }}
                                        >
                                            {formatTime(session.elapsedTime)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))
                ) : (
                    <p>No sessions tracked for this project yet.</p>
                )}
                {hasMoreSessions && (
                    <div className="load-more-container">
                        <button
                            className={`load-more-button ${sessionsLoading ? 'loading' : ''}`} // Disable button when loading
                            onClick={handleLoadMore}
                            disabled={sessionsLoading} // Disable button when loading
                        >
                            {sessionsLoading ? "Loading Moments..." : "Load More Moments"}
                        </button>
                    </div>
                )}
            </div>
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

ProjectDetailPage.displayName = 'ProjectDetailPage';
export default ProjectDetailPage;