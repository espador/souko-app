import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom'; // Keep useParams to get projectId from URL (if needed for initial load)
import {
    doc,
    getDoc,
    updateDoc,
    deleteDoc,
    collection,
    query,
    where,
    getDocs,
    onSnapshot,
} from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import Header from '../components/Layout/Header';
import '../styles/global.css';
import '../styles/components/SessionDetailPage.css';
import { ReactComponent as EditIcon } from '../styles/components/assets/edit.svg';
import { ReactComponent as DropdownIcon } from '../styles/components/assets/dropdown.svg';
import { ReactComponent as RadioActiveIcon } from '../styles/components/assets/radio-active.svg';
import { ReactComponent as RadioMutedIcon } from '../styles/components/assets/radio-muted.svg';
import { ReactComponent as SaveIcon } from '../styles/components/assets/save.svg';
import { ReactComponent as EraseIcon } from '../styles/components/assets/erase.svg';
import { ReactComponent as SoukoLogoHeader } from '../styles/components/assets/Souko-logo-header.svg';
import ConfirmModal from '../components/ConfirmModal';

const CACHE_DURATION_MS = 30000; // 30 seconds - adjust as needed


const SessionDetailPage = ({ navigate, sessionId: routeSessionId }) => { // <-- Receive navigate and sessionId props
    const sessionId = routeSessionId; // Use sessionId prop directly
    const [user, setUser] = useState(null);
    const [session, setSession] = useState(null);
    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);
    const [sessionNotes, setSessionNotes] = useState('');
    const [isBillable, setIsBillable] = useState(true);
    const [loading, setLoading] = useState(true);
    const [isSaveActive, setIsSaveActive] = useState(false);
    const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
    const [hasFetchedSession, setHasFetchedSession] = useState(false); // Flag to fetch session details only once
    const [dataLoadCounter, setDataLoadCounter] = useState(0); // Counter for data loading


    // Load cached session detail data if available - memoized
    const loadCachedData = useCallback((uid, sessionId) => {
        const cachedStr = localStorage.getItem(`sessionDetailData_${uid}_${sessionId}`);
        if (cachedStr) {
            try {
                const cached = JSON.parse(cachedStr);
                if (Date.now() - cached.timestamp < CACHE_DURATION_MS) {
                    setSession(cached.session || null);
                    setProjects(cached.projects || []);
                    setSelectedProject(cached.selectedProject || null);
                    setSessionNotes(cached.sessionNotes || '');
                    setIsBillable(cached.isBillable || true);
                    return true;
                }
            } catch (e) {
                console.error("Error parsing cached session detail data", e);
            }
        }
        return false;
    }, []);


    // Cache data function - memoized
    const cacheData = useCallback((uid, sessionId, session, projects, selectedProject, sessionNotes, isBillable) => {
        const cache = {
            session,
            projects,
            selectedProject,
            sessionNotes,
            isBillable,
            timestamp: Date.now(),
        };
        localStorage.setItem(`sessionDetailData_${uid}_${sessionId}`, JSON.stringify(cache));
    }, []);


    // Fetch projects using onSnapshot for real-time updates - useCallback for dependency optimization
    const fetchProjects = useCallback(async (uid) => {
        const projectsQuery = query(collection(db, 'projects'), where('userId', '==', uid));


        let unsubProjects;


        const handleProjectsSnapshot = (snapshot) => {
            const userProjects = snapshot.docs.map((doc) => ({
                id: doc.id,
                name: doc.data().name,
                imageUrl: doc.data().imageUrl,
            }));
            setProjects(userProjects);
            setDataLoadCounter(prevCounter => prevCounter + 1); // Increment counter when projects loaded
        };


        unsubProjects = onSnapshot(projectsQuery, handleProjectsSnapshot, error => {
            console.error("Projects onSnapshot error:", error);
            setDataLoadCounter(prevCounter => prevCounter + 1); // Ensure counter is incremented even on error
        });


        return () => {
            if (unsubProjects) unsubProjects();
        };


    }, []); // Dependencies array for useCallback


    // Fetch session details - useCallback for dependency optimization
    const fetchSessionDetails = useCallback(async (sessionIdToFetch, uid, cachedDataFound) => {
        if (!sessionIdToFetch || !uid) return;
        if (!cachedDataFound) {
            setLoading(true); // Only set loading to true if not loaded from cache
        }


        try {
            const sessionRef = doc(db, 'sessions', sessionIdToFetch);
            const sessionSnap = await getDoc(sessionRef);
            if (sessionSnap.exists()) {
                const sessionData = sessionSnap.data();
                setSession(sessionData);
                setSessionNotes(sessionData.sessionNotes || '');
                setIsBillable(sessionData.isBillable);
                // Only set selectedProject if it hasn't been changed by the user already
                // and if projects are already loaded
                if (!selectedProject && projects.length > 0) {
                    const project = projects.find(p => p.name === sessionData.project);
                    setSelectedProject(project);
                }
                setDataLoadCounter(prevCounter => prevCounter + 1); // Increment counter when session details loaded
            } else {
                console.error("Session not found");
                setSession(null);
                setDataLoadCounter(prevCounter => prevCounter + 1); // Increment counter even if session not found to stop loading
            }
        } catch (error) {
            console.error("Error fetching session details:", error);
            setSession(null);
            setDataLoadCounter(prevCounter => prevCounter + 1); // Increment counter on error as well
        } finally {
            if (!cachedDataFound) { // Do not set loading to false here if data was loaded from cache, it's handled in useEffect
                setLoading(false);
            }
        }
    }, [projects, selectedProject]); // Include projects and selectedProject in dependencies


    // Handle caching and loading states - useEffect for managing loading завершения
    useEffect(() => {
        if (dataLoadCounter >= 2) { // Wait for both projects and session details to load (or fail)
            if (user && sessionId && session && projects.length > 0 && selectedProject) { // Check if session and selectedProject are not null before caching
                cacheData(user.uid, sessionId, session, projects, selectedProject, sessionNotes, isBillable);
            }
            setLoading(false); // Set loading to false after all data loading завершения
            setDataLoadCounter(0); // Reset counter for future loads if needed
        }
    }, [dataLoadCounter, user, sessionId, session, projects, selectedProject, sessionNotes, isBillable, cacheData]); // Include cacheData in dependencies


    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });
        return () => unsubscribeAuth();
    }, []);


    useEffect(() => {
        if (user && sessionId) {
            const cachedDataFound = loadCachedData(user.uid, sessionId);
            if (!cachedDataFound) {
                setLoading(true); // Start loading only if not loaded from cache
            }
            fetchProjects(user.uid);
            fetchSessionDetails(sessionId, user.uid, cachedDataFound); // Pass cachedDataFound flag
        }
    }, [user, sessionId, fetchProjects, fetchSessionDetails, loadCachedData]); // Include loadCachedData in dependencies


    useEffect(() => {
        if (session) {
            const hasChanged =
                selectedProject?.name !== session.project ||
                isBillable !== session.isBillable ||
                sessionNotes !== session.sessionNotes;
            setIsSaveActive(hasChanged);
        }
    }, [selectedProject, isBillable, sessionNotes, session]);


    const handleProjectChange = (e) => {
        const projectName = e.target.value;
        const project = projects.find(p => p.name === projectName);
        setSelectedProject(project);
    };


    const handleBillableToggle = () => {
        setIsBillable(!isBillable);
    };


    const handleNotesChange = (e) => {
        setSessionNotes(e.target.value);
    };


    const handleSaveSession = async () => {
        if (!sessionId || !isSaveActive) return;
        try {
            const sessionRef = doc(db, 'sessions', sessionId);
            await updateDoc(sessionRef, {
                project: selectedProject.name,
                projectId: selectedProject.id,
                isBillable: isBillable,
                sessionNotes: sessionNotes,
            });
            setIsSaveActive(false);
            navigate('session-overview'); // <-- Use navigate prop, page name as string - to SessionOverviewPage
        } catch (error) {
            console.error("Error updating session:", error);
            // Optionally, add error feedback here
        }
    };




    const handleDeleteSession = () => {
        setShowDeleteConfirmModal(true);
    };


    const confirmDeleteSession = async () => {
        setShowDeleteConfirmModal(false);
        try {
            await deleteDoc(doc(db, 'sessions', sessionId));
            navigate('session-overview'); // <-- Use navigate prop, page name as string - to SessionOverviewPage
        } catch (error) {
            console.error("Error deleting session:", error);
        }
    };


    const cancelDeleteSession = () => {
        setShowDeleteConfirmModal(false);
    };


    if (loading) {
        return (
            <div className="homepage-loading">
                <SoukoLogoHeader className="profile-pic souko-logo-header spinning-logo" />
            </div>
        );
    }


    if (!session) {
        return <p className="error">Session not found.</p>;
    }


    return (
        <div className="session-detail-page">
            <Header variant="journalOverview" showBackArrow={true} navigate={navigate} /> {/* ✅ navigate prop passed to Header */}
            <div className="timer-quote">This moment was yours</div>
            <div className="timer">
                {new Date(session.elapsedTime * 1000).toISOString().substr(11, 8)}
            </div>


            <h2 className="projects-label">Details</h2>
            <div className="project-dropdown-container">
                {selectedProject?.imageUrl ? (
                    <img
                        src={selectedProject.imageUrl}
                        alt={selectedProject.name}
                        className="dropdown-project-image"
                    />
                ) : selectedProject?.name ? (
                    <div className="dropdown-default-image">
                        {selectedProject.name.charAt(0).toUpperCase()}
                    </div>
                ) : null}
                <select
                    className="project-dropdown"
                    value={selectedProject?.name || ''}
                    onChange={handleProjectChange}
                >
                    {projects.map((project) => (
                        <option key={project.id} value={project.name}>
                            {project.name}
                        </option>
                    ))}
                </select>
                <DropdownIcon className="dropdown-arrow" />
            </div>


            <div className="input-tile billable-tile" onClick={handleBillableToggle} style={{ cursor: 'pointer' }}>
                <span className="input-label billable-label">
                    {isBillable ? 'Billable' : 'Non-billable'}
                </span>
                <div className="billable-radio">
                    {isBillable ? <RadioActiveIcon /> : <RadioMutedIcon />}
                </div>
            </div>


            <div className="input-tile notes-input-tile">
                <textarea
                    id="session-notes"
                    className="notes-textarea"
                    placeholder="Add notes for this session"
                    value={sessionNotes}
                    onChange={handleNotesChange}
                />
                <EditIcon className="notes-edit-icon" />
            </div>


            <button
                className={`save-button sticky-button-top ${isSaveActive ? 'active' : ''}`}
                onClick={handleSaveSession}
                disabled={!isSaveActive}
            >
                <SaveIcon className="button-icon" style={{ fill: isSaveActive ? 'var(--text-color)' : 'var(--text-muted)' }} />
                Save this moment
            </button>


            <button className="erase-button sticky-button" onClick={handleDeleteSession}>
                <EraseIcon className="button-icon" />
                Erase your moment
            </button>


            <ConfirmModal
                show={showDeleteConfirmModal}
                onHide={cancelDeleteSession}
                title="Erase this moment?"
                body="Are you sure you want to delete this session? This action cannot be undone."
                onConfirm={confirmDeleteSession}
                confirmText="Yes, Erase"
                cancelText="Cancel"
            />
        </div>
    );
};


export default SessionDetailPage;