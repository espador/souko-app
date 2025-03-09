import React, { useState, useEffect, memo } from 'react'; 
import {
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged // <-- We’ll use this
} from 'firebase/auth';
import { auth } from './services/firebase';
import { motion, AnimatePresence } from 'framer-motion';

// Import page components
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import TimeTrackerPage from './pages/TimeTrackerPage';
import CreateProjectPage from './pages/CreateProjectPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import SessionDetailPage from './pages/SessionDetailPage';
import SessionOverviewPage from './pages/SessionOverviewPage';
import ProjectOverviewPage from './pages/ProjectOverviewPage';
import JournalOverviewPage from './pages/JournalOverviewPage';
import JournalCountdown from './components/Journal/JournalCountdown';
import JournalForm from './components/Journal/JournalForm';
import JournalConfirmation from './components/Journal/JournalConfirmation';
import UpdateProjectPage from './pages/UpdateProjectPage';

// Onboarding components
import OnboardingStep1 from './components/Onboarding/OnboardingStep1';
import OnboardingStep2 from './components/Onboarding/OnboardingStep2';
import OnboardingStep3 from './components/Onboarding/OnboardingStep3';
import OnboardingStep4 from './components/Onboarding/OnboardingStep4';

// TimeTracker setup page
import TimeTrackerSetupPage from './pages/TimeTrackerSetupPage';

import { OnboardingProvider } from './contexts/OnboardingContext';

import './styles/global.css';

const App = memo(() => {
  console.log('App - RENDER START');

  // State to manage the current page & route params
  const [currentPage, setCurrentPage] = useState('login'); 
  const [pageParams, setPageParams] = useState({});

  // Track the authenticated user at the top level
  const [user, setUser] = useState(null);

  // 1) Ensure we use local persistence to minimize iOS session clearing
  useEffect(() => {
    setPersistence(auth, browserLocalPersistence)
      .then(() => {
        console.log('Firebase persistence set to browserLocalPersistence');
      })
      .catch((error) => {
        console.error('Error setting auth persistence:', error);
      });
  }, []);

  // 2) Listen to changes in the authenticated user, update state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      console.log('onAuthStateChanged - user:', firebaseUser);
      setUser(firebaseUser);
    });
    return () => unsubscribe();
  }, []);

  // 3) Whenever `user` changes, decide if we should redirect to login or home
  useEffect(() => {
    // If the user is logged in and we’re still on the login page, go home
    if (user && currentPage === 'login') {
      console.log('User is logged in; navigating to home...');
      setCurrentPage('home');
    }
    // If the user is not logged in and we’re NOT on the login page, go login
    if (!user && currentPage !== 'login') {
      console.log('No user found; navigating to login...');
      setCurrentPage('login');
    }
  }, [user, currentPage]);

  // Wrapper function to handle navigation
  const navigate = (page, params = {}) => {
    setCurrentPage(page);
    setPageParams(params);
    console.log(`Navigating to: ${page} with params:`, params);
  };

  // 4) Render based on current page
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
      case 'session-overview':
        return (
          <SessionOverviewPage
            navigate={navigate}
            totalTime={pageParams.totalTime}
            projectId={pageParams.projectId}
          />
        );
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
      </div>
    </OnboardingProvider>
  );
});

export default App;
