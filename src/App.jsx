// App.jsx
import React, { useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
  useLocation
} from 'react-router-dom';
import {
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged
} from 'firebase/auth';
import { auth } from './services/firebase';

// Import the OnboardingProvider
import { OnboardingProvider } from './contexts/OnboardingContext';

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

import OnboardingStep1 from './components/Onboarding/OnboardingStep1';
import OnboardingStep2 from './components/Onboarding/OnboardingStep2';
import OnboardingStep3 from './components/Onboarding/OnboardingStep3';
import OnboardingStep4 from './components/Onboarding/OnboardingStep4';

const AppRoutes = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Explicitly set Firebase auth persistence to local storage
    setPersistence(auth, browserLocalPersistence)
      .then(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          console.log('onAuthStateChanged in AppRoutes triggered:', user, location.pathname); // LOG: Check AppRoutes auth state changes
          // If user is logged in AND on the login page, navigate to home.
          // This check is now more specific to prevent potential loops.
          if (user && location.pathname === '/') {
            console.log('AppRoutes: User logged in and on login page, navigating to /home');
            navigate('/home', { replace: true });
          }
          // No need to redirect to login page if user is not logged in. LoginPage handles this.
        });
        return unsubscribe;
      })
      .catch((error) => {
        console.error('Error setting auth persistence:', error);
      });
  }, [navigate, location]);

  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/home" element={<HomePage />} />
      <Route path="/projects" element={<ProjectOverviewPage />} />
      <Route path="/time-tracker" element={<TimeTrackerPage />} />
      <Route path="/create-project" element={<CreateProjectPage />} />
      <Route path="/project/:projectId" element={<ProjectDetailPage />} />
      <Route path="/session/:sessionId" element={<SessionDetailPage />} />
      <Route path="/session-overview" element={<SessionOverviewPage />} />
      <Route path="/journal-countdown" element={<JournalCountdown />} />
      <Route path="/journal-overview" element={<JournalOverviewPage />} />
      <Route path="/journal-form" element={<JournalForm />} />
      <Route path="/journal-confirmation" element={<JournalConfirmation />} />
      <Route path="/projects/:projectId/update" element={<UpdateProjectPage />} />
      <Route path="/onboarding/step1" element={<OnboardingStep1 />} />
      <Route path="/onboarding/step2" element={<OnboardingStep2 />} />
      <Route path="/onboarding/step3" element={<OnboardingStep3 />} />
      <Route path="/onboarding/step4" element={<OnboardingStep4 />} />
    </Routes>
  );
};

const App = () => {
  return (
    <Router>
      {/* Wrap all routes with the OnboardingProvider */}
      <OnboardingProvider>
        <AppRoutes />
      </OnboardingProvider>
    </Router>
  );
};

export default App;