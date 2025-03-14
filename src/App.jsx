// App.jsx
import React, { useState, useEffect, memo } from 'react';
import {
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import { auth, db } from './services/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { onSnapshot, collection, query, where } from 'firebase/firestore';

// Import page components
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import TimeTrackerPage from './pages/TimeTrackerPage';
import CreateProjectPage from './pages/CreateProjectPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import SessionDetailPage from './pages/SessionDetailPage';
import ProjectOverviewPage from './pages/ProjectOverviewPage';
import JournalOverviewPage from './pages/JournalOverviewPage';
import JournalCountdown from './components/Journal/JournalCountdown';
import JournalForm from './components/Journal/JournalForm';
import JournalConfirmation from './components/Journal/JournalConfirmation';
import UpdateProjectPage from './pages/UpdateProjectPage';
import TimeTrackerManualPage from './pages/TimeTrackerManualPage';

// Onboarding components
import OnboardingStep1 from './components/Onboarding/OnboardingStep1';
import OnboardingStep2 from './components/Onboarding/OnboardingStep2';
import OnboardingStep3 from './components/Onboarding/OnboardingStep3';
import OnboardingStep4 from './components/Onboarding/OnboardingStep4';

// TimeTracker setup page
import TimeTrackerSetupPage from './pages/TimeTrackerSetupPage';

import { OnboardingProvider } from './contexts/OnboardingContext';

import FloatingNavigation from './components/Layout/FloatingNavigation';
import './styles/global.css';

const App = memo(() => {
  console.log('App - RENDER START');

  const [currentPage, setCurrentPage] = useState('login');
  const [pageParams, setPageParams] = useState({});

  // Track user & active session so all pages can see it
  const [currentUser, setCurrentUser] = useState(null);
  const [activeSession, setActiveSession] = useState(null);

  // Configure local persistence
  useEffect(() => {
    setPersistence(auth, browserLocalPersistence)
      .then(() => {
        console.log('Firebase persistence set to browserLocalPersistence');
      })
      .catch((error) => {
        console.error('Error setting auth persistence:', error);
      });
  }, []);

  // Listen for auth changes, then watch for an active session
  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      setCurrentUser(user);
      if (!user) {
        // Not logged in => go to login screen
        setCurrentPage('login');
        setActiveSession(null);
      } else {
        // Logged in => set up a snapshot for the active session
        const activeSessionQuery = query(
          collection(db, 'sessions'),
          where('userId', '==', user.uid),
          where('endTime', '==', null)
        );
        const unsubSession = onSnapshot(activeSessionQuery, (snap) => {
          if (!snap.empty) {
            const docRef = snap.docs[0];
            const data = docRef.data();
            setActiveSession({
              ...data,
              id: docRef.id,
            });
          } else {
            setActiveSession(null);
          }
        });
      }
    });
    return () => {
      unsubscribeAuth && unsubscribeAuth();
      // unsubSession is covered in the callback
    };
  }, []);

  // A simple navigate function
  const navigate = (page, params = {}) => {
    setCurrentPage(page);
    setPageParams(params);
    console.log(`Navigating to: ${page} with params:`, params);
  };

  // Render the current page
  const renderPage = () => {
    switch (currentPage) {
      case 'login':
        return <LoginPage navigate={navigate} />;
      case 'home':
        return (
          <HomePage
            navigate={navigate}
            currentPage={currentPage}
            skipAutoRedirect={pageParams.skipAutoRedirect}
          />
        );
      case 'projects':
        return <ProjectOverviewPage navigate={navigate} />;
      case 'time-tracker-setup':
        return <TimeTrackerSetupPage navigate={navigate} />;
      case 'time-tracker-manual':
        return <TimeTrackerManualPage navigate={navigate} />;
      case 'time-tracker':
        return (
          <TimeTrackerPage
            navigate={navigate}
            sessionId={pageParams.sessionId}
          />
        );
      case 'create-project':
        return <CreateProjectPage navigate={navigate} />;
      case 'project-detail':
        return (
          <ProjectDetailPage
            navigate={navigate}
            projectId={pageParams.projectId}
          />
        );
      case 'session-detail':
        return (
          <SessionDetailPage
            navigate={navigate}
            sessionId={pageParams.sessionId}
          />
        );
      // REMOVE the old 'session-overview' route:
      // case 'session-overview':
      //   return <SessionOverviewPage ... />
      case 'journal-countdown':
        return <JournalCountdown navigate={navigate} />;
      case 'journal-overview':
        return <JournalOverviewPage navigate={navigate} />;
      case 'journal-form':
        return (
          <JournalForm
            navigate={navigate}
            selectedDate={pageParams.selectedDate}
          />
        );
      case 'journal-confirmation':
        return <JournalConfirmation navigate={navigate} />;
      case 'update-project':
        return (
          <UpdateProjectPage
            navigate={navigate}
            projectId={pageParams.projectId}
          />
        );
      case 'onboarding-step1':
        return <OnboardingStep1 navigate={navigate} />;
      case 'onboarding-step2':
        return <OnboardingStep2 navigate={navigate} />;
      case 'onboarding-step3':
        return <OnboardingStep3 navigate={navigate} />;
      case 'onboarding-step4':
        return <OnboardingStep4 navigate={navigate} />;
      default:
        return <div>Page Not Found</div>;
    }
  };

  console.log('App - RENDER END');

  // Show floating nav only on certain pages
  const showFloatingNav = ['home', 'projects', 'journal-overview'].includes(
    currentPage
  );

  return (
    <OnboardingProvider>
      <div className="app-container">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentPage}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="motion-container"
          >
            {renderPage()}
          </motion.div>
        </AnimatePresence>

        {showFloatingNav && (
          <FloatingNavigation
            currentPage={currentPage}
            navigate={navigate}
            hasActiveSession={Boolean(activeSession)}
            activeSession={activeSession}
          />
        )}
      </div>
    </OnboardingProvider>
  );
});

export default App;