// src/components/Sidebar.jsx
import React, { useState } from 'react';
import '../../styles/global.css';
import { ReactComponent as CloseIcon } from '../../styles/components/assets/close.svg';
import { ReactComponent as LogoutIcon } from '../../styles/components/assets/logout.svg';
import { db } from '../../services/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const Sidebar = ({ isOpen, onClose, onLogout }) => {
  const [feedback, setFeedback] = useState('');
  const [showSubmitButton, setShowSubmitButton] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const handleFeedbackChange = (e) => {
    const value = e.target.value;
    setFeedback(value);
    setShowSubmitButton(value.trim().length > 0);
  };

  const handleSubmitFeedback = async () => {
    if (!feedback.trim()) return;
    
    setIsSubmitting(true);
    try {
      // Add feedback to the betaFeedback collection
      await addDoc(collection(db, 'betaFeedback'), {
        feedback: feedback.trim(),
        createdAt: serverTimestamp(),
        userAgent: navigator.userAgent,
        platform: navigator.platform
      });
      
      // Reset form and show success message
      setFeedback('');
      setShowSubmitButton(false);
      setFeedbackSubmitted(true);
      
      // Reset success message after 3 seconds
      setTimeout(() => {
        setFeedbackSubmitted(false);
      }, 3000);
    } catch (error) {
      console.error("Error submitting feedback:", error);
      alert("Failed to submit feedback. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-content">
        <div className="sidebar-header">
          <div className="sidebar-43404C-left">
            <button className="close-button" onClick={onClose}>
              <CloseIcon className="close-icon" />
            </button>
          </div>
          <div className="sidebar-header-right">
            <button className="sidebar-logout-button" onClick={onLogout}>
              <LogoutIcon className="sidebar-logout-icon" />
            </button>
          </div>
        </div>
        
        <h1 className="sidebar-title">Your space, your moments.</h1>
        <div className="divider"></div>
        <div className="session-project-name">Designed to track your time,
                built to inspire.</div>
                <p>Mastery isn't rushed — it's refined. Souko helps you master your craft, one session at a time. No teams, no noise, just you and your moments.</p>
        
        <div className="journal-form-section">
        <div className="divider"></div>
          <h2 className="session-feedback">(beta) Share your feedback</h2>
          <div className="journal-input-tile">
            <textarea
              type="text"
              placeholder="What would you like to see improved?"
              value={feedback}
              onChange={handleFeedbackChange}
              className="journal-input journal-textarea journal-text-input-style"
              maxLength={500}
            />
          </div>
          
          {showSubmitButton && !feedbackSubmitted && (
            <button 
              className="save-button" 
              onClick={handleSubmitFeedback}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Share feedback'}
            </button>
          )}
          
          {feedbackSubmitted && (
            <p className="feedback-success">
              Thank you for your feedback!
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
