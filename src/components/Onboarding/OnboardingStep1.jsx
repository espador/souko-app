// src/components/Onboarding/OnboardingStep1.jsx
import React from 'react';
// REMOVED: import { useNavigate } from 'react-router-dom'; // <-- REMOVE useNavigate import
import Header from '../Layout/Header';
import './OnboardingStep1.css';
import { TextGenerateEffect } from '../../styles/components/text-generate-effect.tsx';
import { ReactComponent as SaveIcon } from '../../styles/components/assets/save.svg';

function OnboardingStep1({ navigate }) { // <-- Receive navigate as prop
  // REMOVED: const navigate = useNavigate(); // <-- REMOVE useNavigate hook

  const handleGetStarted = () => {
    // Proceed to next onboarding step
    navigate('onboarding-step2'); // <-- Updated navigate call, page name as string
  };

  return (
    <div className="onboarding-step1">
      <Header variant="onboarding" currentStep={1} navigate={navigate} /> {/* ✅ Pass navigate prop to Header */}
      <main className="onboarding-step1-content">
        <section className="motivational-section">
          <TextGenerateEffect
            words={`Mastery isn't rushed; it's\n built. Welcome to <span class="accent-text">Souko</span>.Track your\n projects,refine your flow.`}
            element="h1"
          />
          <p className="onboarding-description">
            Let’s set up your first project so you can start tracking your time effortlessly.
          </p>
        </section>
      </main>

      <button className="average-onboarding sticky-button-top" disabled>
        Average onboarding in 43.2 seconds
      </button>

      <button className="get-started-button sticky-button" onClick={handleGetStarted}>
        <SaveIcon
          className="button-icon"
          style={{ fill: 'var(--text-color)' }}
        />
        Get started
      </button>
    </div>
  );
}

export default OnboardingStep1;