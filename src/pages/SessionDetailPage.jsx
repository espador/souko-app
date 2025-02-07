// SessionDetailPage.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { formatTime } from '../utils/formatTime';
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
import ConfirmModal from '../components/ConfirmModal'; // Import the ConfirmModal component

const SessionDetailPage = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [sessionNotes, setSessionNotes] = useState('');
  const [isBillable, setIsBillable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [isSaveActive, setIsSaveActive] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false); // State for delete confirmation modal

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const fetchProjects = useCallback(async (uid) => {
    try {
      const projectsRef = collection(db, 'projects');
      const projectQuery = query(projectsRef, where('userId', '==', uid));
      const projectSnapshot = await getDocs(projectQuery);
      const userProjects = projectSnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name,
        imageUrl: doc.data().imageUrl,
      }));
      setProjects(userProjects);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  }, []);

  const fetchSessionDetails = useCallback(async () => {
    if (!sessionId || !user) return;
    setLoading(true);
    try {
      const sessionRef = doc(db, 'sessions', sessionId);
      const sessionSnap = await getDoc(sessionRef);
      if (sessionSnap.exists()) {
        const sessionData = sessionSnap.data();
        setSession(sessionData);
        setSessionNotes(sessionData.sessionNotes || '');
        setIsBillable(sessionData.isBillable);

        // Find and set the selected project object
        const project = projects.find(p => p.name === sessionData.project);
        setSelectedProject(project);
      } else {
        console.error("Session not found");
      }
    } catch (error) {
      console.error("Error fetching session details:", error);
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, [sessionId, user, projects]);

  useEffect(() => {
    if (user) {
      fetchProjects(user.uid);
    }
  }, [user, fetchProjects]);

  useEffect(() => {
    fetchSessionDetails();
  }, [fetchSessionDetails]);

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
        isBillable: isBillable,
        sessionNotes: sessionNotes,
      });
      setIsSaveActive(false);
      // Optionally show a success message
    } catch (error) {
      console.error("Error updating session:", error);
      // Optionally show an error message
    }
  };

  const handleDeleteSession = () => {
    setShowDeleteConfirmModal(true); // Open the delete confirmation modal
  };

  const confirmDeleteSession = async () => {
    setShowDeleteConfirmModal(false);
    try {
      await deleteDoc(doc(db, 'sessions', sessionId));
      navigate('/home'); // Navigate to the homepage after deletion
    } catch (error) {
      console.error("Error deleting session:", error);
      // Optionally show an error message
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
       <Header
              variant="journalOverview"
              showBackArrow={true}
            />

      <div className="timer-quote">This moment was yours</div>
      <div className="timer">{new Date(session.elapsedTime * 1000).toISOString().substr(11, 8)}</div>

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

      {/* Confirmation Modal for Deleting Session */}
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