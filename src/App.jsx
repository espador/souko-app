// App.jsx
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { setPersistence, browserLocalPersistence, onAuthStateChanged } from 'firebase/auth';
import { auth } from './services/firebase';

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

const AppRoutes = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Explicitly set Firebase auth persistence to local storage
    setPersistence(auth, browserLocalPersistence)
      .then(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          if (user && location.pathname === "/") {
            // If user is logged in and currently on the login page, redirect to home
            navigate('/home', { replace: true });
          } else if (!user && location.pathname !== "/") {
            // If user is not logged in and trying to access a protected route, redirect to login
            navigate('/', { replace: true });
          }
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
    </Routes>
  );
};

const App = () => {
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
};

export default App;
