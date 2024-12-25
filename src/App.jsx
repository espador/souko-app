import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import TimeTrackerPage from './pages/TimeTrackerPage';
import CreateProjectPage from './pages/CreateProjectPage';
import ProjectDetailPage from './pages/ProjectDetailPage'; // Import ProjectDetailPage

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/time-tracker" element={<TimeTrackerPage />} />
        <Route path="/create-project" element={<CreateProjectPage />} />
        <Route path="/project/:projectId" element={<ProjectDetailPage />} /> {/* Project detail route */}
      </Routes>
    </Router>
  );
};

export default App;