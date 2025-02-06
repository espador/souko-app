// App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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
import UpdateProjectPage from './pages/UpdateProjectPage'; // Import new page

const App = () => {
    return (
        <Router>
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
        </Router>
    );
};

export default App;