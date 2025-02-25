// src/components/Onboarding/OnboardingStep4.jsx
import React, { useState } from 'react'; // ✅ FIX: added { useState } here
// REMOVED: import { useNavigate } from 'react-router-dom'; // <-- REMOVE useNavigate import
import Header from '../Layout/Header';
import './OnboardingStep4.css';
import { TextGenerateEffect } from '../../styles/components/text-generate-effect.tsx';
import { ReactComponent as StartTimerIcon } from '../../styles/components/assets/start-timer.svg';

// Firebase
import { db, auth } from '../../services/firebase';
import {
  doc,
  setDoc,
  collection,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL
} from 'firebase/storage';

// Import context
import { useOnboardingContext } from '../../contexts/OnboardingContext';

function OnboardingStep4({ navigate }) { // <-- Receive navigate prop
  const [error, setError] = useState(''); // ✅ no more "useState is not defined" error

  // Pull any onboarding data from context
  const {
    projectName,
    hourRate,
    currencyId,
    projectImage,
    mood,
  } = useOnboardingContext();

  const handlePlayClick = async () => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not logged in.');

      // 1) Create/update profile doc
      await setDoc(
        doc(db, 'profiles', user.uid),
        {
          uid: user.uid,
          featureAccessLevel: 'free',
          displayName: user.displayName || '',
          email: user.email || '',
          onboardingComplete: true,  // <-- Mark onboarding as complete
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      // 2) Upload project image if we have one (and it isn’t a string)
      let imageUrl = null;
      if (projectImage && typeof projectImage !== 'string') {
        const storage = getStorage();
        const storageRef = ref(
          storage,
          `project-images/${user.uid}/${projectName}-${Date.now()}`
        );
        const uploadTask = uploadBytesResumable(storageRef, projectImage);

        await new Promise((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            () => {},
            (uploadError) => reject(uploadError),
            async () => {
              imageUrl = await getDownloadURL(uploadTask.snapshot.ref);
              resolve();
            }
          );
        });
      }

      // 3) Create the project doc
      const projectRef = await addDoc(collection(db, 'projects'), {
        userId: user.uid,
        name: projectName.trim(),
        hourRate: hourRate ? parseInt(hourRate, 10) : 0,
        currencyId,
        imageUrl: imageUrl || null,
        trackedTime: 0,
        createdAt: serverTimestamp(),
      });

      // 4) Create a journal entry doc with the mood
      await addDoc(collection(db, 'journalEntries'), {
        userId: user.uid,
        projectId: projectRef.id,
        mood,
        reflection: '', // or any reflection text if you like
        createdAt: serverTimestamp(),
      });

      // Finally, navigate to the time tracker
      navigate('time-tracker'); // moves you to your time tracker
    } catch (err) {
      console.error('Error finalizing onboarding:', err);
      setError('Failed to finish onboarding. Please try again.');
    }
  };

  return (
    <div className="onboarding-step4">
      <Header variant="onboarding" currentStep={4} navigate={navigate} />
      <main className="onboarding-step4-content">
        <section className="motivational-section">
          <TextGenerateEffect
            words={`The song of your\nroots is the song\nof now. Tap <span class="accent-text">play</span>\nto discover the\ntime tracker.`}
            element="h1"
          />
          <p className="onboarding-description">
            You’re all set. Use Souko your way! Track time, refine your flow, enjoy the moments!
          </p>
        </section>

        {error && <p className="error-message">{error}</p>}
      </main>

      <button className="fab" onClick={handlePlayClick}>
        <StartTimerIcon className="fab-icon" />
      </button>
    </div>
  );
}

export default OnboardingStep4;
