// src/pages/LoginPage.jsx
import React, { useEffect, useCallback, useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider, db } from '../services/firebase';
import '../styles/global.css';
import '../styles/components/LoginPage.css';
import googleIcon from '../styles/components/assets/google-icon.svg';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { TextGenerateEffect } from '../styles/components/text-generate-effect.tsx';
import Header from '../components/Layout/Header';

const LoginPage = ({ navigate }) => {
  const [loading, setLoading] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallButton, setShowInstallButton] = useState(false);

  // Helper functions to detect iOS and standalone mode
  const isIOS = () => /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
  const isInStandaloneMode = () => ('standalone' in window.navigator) && window.navigator.standalone;

  // Process login result: create profile if necessary then navigate to home
  const processLoginResult = useCallback(async (result) => {
    console.log('processLoginResult - START');
    setLoading(true);
    try {
      const user = result.user;
      console.log('processLoginResult - User object:', user);
      const profileRef = doc(db, 'profiles', user.uid);
      const profileSnap = await getDoc(profileRef);

      if (!profileSnap.exists()) {
        await setDoc(profileRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          profileImageUrl: user.photoURL,
          featureAccessLevel: 'free',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        console.log('processLoginResult - New profile created for user:', user.uid);
      } else {
        console.log('processLoginResult - Profile already exists for user:', user.uid);
      }

      console.log('processLoginResult - User Info:', user);
      navigate('home');
      console.log('processLoginResult - Navigated to /home');
    } catch (error) {
      console.error('processLoginResult - Error:', error);
      alert('Authentication failed during profile processing. Please try again.');
    } finally {
      setLoading(false);
      console.log('processLoginResult - FINISH');
    }
  }, [navigate]);

  useEffect(() => {
    console.log('LoginPage useEffect - START');
    document.body.classList.add('no-scroll');

    // No more automatic redirect, LoginPage always renders on app open.
    // Removed checkRedirect and onAuthStateChanged listener

    // Listen for the beforeinstallprompt event (for Android)
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      console.log('beforeinstallprompt event captured');
      setDeferredPrompt(e);
      setShowInstallButton(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      document.body.classList.remove('no-scroll');
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      console.log('LoginPage useEffect - CLEANUP');
    };
  }, []); // Removed processLoginResult from dependency array as it should be stable

  const handleLogin = async () => {
    console.log('handleLogin - START');
    setLoading(true);
    try {
      console.log('handleLogin - Using signInWithPopup');
      const result = await signInWithPopup(auth, googleProvider);
      console.log('handleLogin - signInWithPopup result:', result);
      await processLoginResult(result);
    } catch (error) {
      console.error('handleLogin - Login Error:', error);
      alert('Authentication failed during login. Please try again.');
    } finally {
      setLoading(false);
      console.log('handleLogin - FINISH');
    }
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      console.log('User response to the install prompt:', choiceResult.outcome);
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }
      setDeferredPrompt(null);
      setShowInstallButton(false);
    }
  };

  return (
    <div className="login-page">
      <Header showLiveTime={true} />
      <main className="login-content">
        <section className="motivational-section">
          <TextGenerateEffect words="The song of your roots is the song of now" />
          <h4>
            Master your time, shape your craft, and let progress flow. Mastery isn’t rushed, it’s built.
          </h4>
        </section>
        <div className="login-actions">
          <button className="login-button" onClick={handleLogin} disabled={loading}>
            <img src={googleIcon} alt="Google Icon" className="google-icon" />
            Continue with Google
          </button>
        </div>
        
        {(showInstallButton || (isIOS() && !isInStandaloneMode())) && (
          <div className="install-pwa">
            {isIOS() && !isInStandaloneMode() ? (
              <h2 className="login-pwa">
                For the best experience, tap the <strong>Share</strong> icon and select <strong>"Add to Home Screen"</strong>.
              </h2>
            ) : (
              <button onClick={handleInstallClick} className="install-button">
                Add to Home Screen
              </button>
            )}
          </div>
        )}
      </main>
      <div className="sticky-login-container">
        <h2 className="login-terms">
          (Beta) By continuing, you agree to our <a href="/terms" className="login-link">Terms</a> and <a href="/privacy" className="login-link">Privacy Policy</a>.
        </h2>
      </div>
    </div>
  );
};

export default LoginPage;