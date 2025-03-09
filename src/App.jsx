import React, { useState, useEffect, memo } from 'react'; 
import {
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import { auth } from './services/firebase';
import { motion, AnimatePresence } from 'framer-motion';

// Import all your page components
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

// NEW: Import our new setup page
import TimeTrackerSetupPage from './pages/TimeTrackerSetupPage';

// Import the OnboardingProvider
import { OnboardingProvider } from './contexts/OnboardingContext';

import './styles/global.css';

const App = memo(() => {
  console.log("App - RENDER START");

  // State to manage the current page
  const [currentPage, setCurrentPage] = useState('login'); // Default to login page
  const [pageParams, setPageParams] = useState({}); 

  useEffect(() => {
    // CHANGED: We now set Local Persistence, not Session.
    setPersistence(auth, browserLocalPersistence)
      .then(() => {
        console.log("Firebase persistence set to browserLocalPersistence");
      })
      .catch((error) => {
        console.error('Error setting auth persistence:', error);
      });
  }, []);

  // Function to handle navigation (state-based)
  const navigate = (page, params = {}) => {
    setCurrentPage(page);
    setPageParams(params);
    console.log(`Navigating to: ${page} with params:`, params);
  };

  // Function to render the current page based on state
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

  console.log("App - RENDER END");

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
