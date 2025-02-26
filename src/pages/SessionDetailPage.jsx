import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    doc,
    getDoc,
    updateDoc,
    deleteDoc,
    collection,
    query,
    where,
    getDocs,
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
import { ReactComponent as Spinner } from '../styles/components/assets/spinner.svg';
import ConfirmModal from '../components/ConfirmModal';

const CACHE_DURATION_MS = 30000; // 30 seconds - adjust as needed

const SessionDetailPage = ({ navigate, sessionId: routeSessionId }) => {
    const sessionId = routeSessionId;
    const [user, setUser] = useState(null);
    const [session, setSession] = useState(null);
    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);
    const [sessionNotes, setSessionNotes] = useState('');
    const [isBillable, setIsBillable] = useState(true);
    const [loading, setLoading] = useState(true);
    const [isSaveActive, setIsSaveActive] = useState(false);
    const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
    const previousSessionRef = useRef(null);
    const hasLoaded = useRef(false);

    // Load cached session detail data if available - memoized
    const loadCachedData = useCallback((uid, sessionId) => {
        const cachedData = sessionStorage.getItem(`sessionDetail-${uid}-${sessionId}`);
        if (cachedData) {
            const { session, projects, selectedProject, sessionNotes, isBillable, timestamp } = JSON.parse(cachedData);
            if (Date.now() - timestamp < CACHE_DURATION_MS) {
                setSession(session);
                setProjects(projects);
                setSelectedProject(selectedProject);
                setSessionNotes(sessionNotes);
                setIsBillable(isBillable);
                console.log("Session details loaded from cache");
                return true;
            } else {
                sessionStorage.removeItem(`sessionDetail-${uid}-${sessionId}`); //remove outdated cache
                console.log("Cached data expired, fetching from Firestore");
                return false;
            }
        }
        return false;
    }, []);

    const cacheData = useCallback((uid, sessionId, session, projects, selectedProject, sessionNotes, isBillable) => {
        const cacheObject = {
            session,
            projects,
            selectedProject,
            sessionNotes,
            isBillable,
            timestamp: Date.now()
        };
        sessionStorage.setItem(`sessionDetail-${uid}-${sessionId}`, JSON.stringify(cacheObject));
        console.log("Session details cached");
    }, []);

    const fetchProjects = useCallback(async (uid) => {
        try {
            const projectsRef = collection(db, 'projects');
            const q = query(projectsRef, where("userId", "==", uid));
            const querySnapshot = await getDocs(q);
            const projectsList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                name: doc.data().name,
                imageUrl: doc.data().imageUrl,
                ...doc.data()
            }));
            setProjects(projectsList);
            console.log("Projects fetched successfully:", projectsList);
            return projectsList;
        } catch (error) {
            console.error("Error fetching projects:", error);
            return [];
        }
    }, []);

    const fetchSessionDetails = useCallback(async (sessionIdToFetch) => { // Removed 'projects' argument
        if (!sessionIdToFetch) return null;

        try {
            const sessionRef = doc(db, 'sessions', sessionIdToFetch);
            const sessionSnap = await getDoc(sessionRef);
            if (sessionSnap.exists()) {
                const sessionData = sessionSnap.data();
                return sessionData;
            } else {
                console.error("Session not found in Firestore - sessionId:", sessionIdToFetch);
                return null;
            }
        } catch (error) {
            console.error("Error fetching session details:", error, sessionIdToFetch);
            return null;
        }
    }, []);


    useEffect(() => {
        console.log("Data Loading useEffect (Fetch Projects) - START - User State:", user, "SessionId Prop:", sessionId);
        if (user && sessionId && !hasLoaded.current) {
            hasLoaded.current = true;
            const cachedDataFound = loadCachedData(user.uid, sessionId);
            if (cachedDataFound) {
                setLoading(false);
            } else {
                setLoading(true);
                fetchProjects(user.uid); // Only fetch projects here
            }
        } else {
            console.log("Data Loading useEffect (Fetch Projects) - Skipped: Already loaded or no user/sessionId");
        }
        console.log("Data Loading useEffect (Fetch Projects) - END");
    }, [user, sessionId, fetchProjects, loadCachedData]);


    useEffect(() => {
        console.log("Data Loading useEffect (Fetch Session & Select Project) - START - Projects State Ready:", projects.length > 0, "SessionId:", sessionId);
        if (projects.length > 0 && sessionId && user) { // Only run this effect when projects are available
            fetchSessionDetails(sessionId)
                .then(sessionData => {
                    if (sessionData) {
                        setSession(sessionData);
                        setSessionNotes(sessionData.sessionNotes || '');
                        setIsBillable(sessionData.isBillable);

                        let projectToSelect = null;
                        if (sessionData.projectId) {
                            projectToSelect = projects.find(p => p.id === sessionData.projectId);
                            if (projectToSelect) {
                                console.log("Project found by projectId:", projectToSelect.name);
                            } else {
                                console.warn("Project ID from session not found in fetched projects. Falling back to project name.");
                            }
                        }
                        if (!projectToSelect && sessionData.project) {
                            projectToSelect = projects.find(p => p.name === sessionData.project);
                            if(projectToSelect) {
                                console.log("Project found by projectName (fallback):", projectToSelect.name);
                            } else {
                                console.warn("Project Name from session also not found in fetched projects.");
                            }
                        }


                        if (projectToSelect) {
                            setSelectedProject(projectToSelect);
                            console.log("Data Loading useEffect - Project pre-selected:", projectToSelect.name);
                        } else {
                            console.warn("Data Loading useEffect - No project matched from session data. Falling back to first project or null.");
                            setSelectedProject(projects[0] || null);
                            if (projects[0]) {
                                console.log("Data Loading useEffect - Fallback to first project:", projects[0].name);
                            } else {
                                console.log("Data Loading useEffect - No projects available to fallback to.");
                                setSelectedProject(null);
                            }
                        }
                    } else {
                        setSession(null);
                    }
                })
                .catch(e => {
                    console.error("Data Loading useEffect (Fetch Session & Select Project) - Error:", e);
                    setSession(null);
                })
                .finally(() => {
                    setLoading(false);
                });
        } else if (projects.length === 0 && sessionId) {
            console.log("Data Loading useEffect (Fetch Session & Select Project) - No projects available yet.");
            if (!loading) setLoading(false); // Ensure loading is false if projects are not loaded and we're not already loading.
        }
        console.log("Data Loading useEffect (Fetch Session & Select Project) - END");
    }, [projects, sessionId, user, fetchSessionDetails]); // Depend on 'projects' state


    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });
        return () => unsubscribeAuth();
    }, []);


    useEffect(() => {
        if (session && user && sessionId && projects.length > 0 && selectedProject) {
            cacheData(user.uid, sessionId, session, projects, selectedProject, sessionNotes, isBillable);
        }
    }, [user, sessionId, session, projects, selectedProject, sessionNotes, isBillable, cacheData]);


    useEffect(() => {
        if (session) {
            const hasChanged =
                selectedProject?.name !== session.project ||
                isBillable !== session.isBillable ||
                sessionNotes !== session.sessionNotes;
            setIsSaveActive(hasChanged);
        }
    }, [selectedProject?.name, isBillable, sessionNotes, session]);


    const handleProjectChange = (e) => {
        const projectName = e.target.value;
        const project = projects.find(p => p.name === projectName);
        setSelectedProject(project);
    };

    const handleBillableToggle = () => {
        setIsBillable(!isBillable);
        setIsSaveActive(true);
    };

    const handleNotesChange = (e) => {
        setSessionNotes(e.target.value);
        setIsSaveActive(true);
    };

    const handleSaveSession = async () => {
        if (!isSaveActive || !session || !selectedProject) return;

        try {
            const sessionRef = doc(db, 'sessions', sessionId);
            await updateDoc(sessionRef, {
                project: selectedProject.name,
                projectId: selectedProject.id, // Save projectId as well!
                isBillable: isBillable,
                sessionNotes: sessionNotes,
            });

            const updatedSession = { ...session, project: selectedProject.name, projectId: selectedProject.id, isBillable: isBillable, sessionNotes: sessionNotes }; // Update session state with projectId
            setSession(updatedSession);
            setIsSaveActive(false);
            console.log('Session updated successfully!');

        } catch (error) {
            console.error('Error updating session:', error);
        }
    };


    const handleDeleteSession = () => {
        setShowDeleteConfirmModal(true);
    };

    const confirmDeleteSession = async () => {
        try {
            // Fetch session details to get projectId before deleting
            const sessionRef = doc(db, 'sessions', sessionId);
            const sessionSnap = await getDoc(sessionRef);
            let projectIdToNavigate = null;
            if (sessionSnap.exists()) {
                projectIdToNavigate = sessionSnap.data().projectId;
            }

            await deleteDoc(doc(db, 'sessions', sessionId));
            console.log('Session deleted successfully!');

            // Navigate to project detail page with projectId
            if (projectIdToNavigate) {
                navigate('project-detail', { projectId: projectIdToNavigate });
            } else {
                // Fallback navigation if projectId is not found (optional, maybe navigate to projects overview)
                navigate('projects');
                console.warn("Project ID not found for deleted session, navigating to projects overview.");
            }

        } catch (error) {
            console.error('Error deleting session:', error);
        } finally {
            setShowDeleteConfirmModal(false);
        }
    };

    const cancelDeleteSession = () => {
        setShowDeleteConfirmModal(false);
    };


    if (loading) {
        return (
            <div className="homepage-loading">
                <Spinner className="profile-pic souko-logo-header spinning-logo" />
            </div>
        );
    }


    if (!session) {
        return <p className="error">Session not found.</p>;
    }


    return (
        <div className="session-detail-page">
            <Header variant="journalOverview" showBackArrow={true} navigate={navigate} />
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
                    <option value="" disabled>Select Project</option>
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