import React, { useEffect, useCallback, useState } from 'react';
import { signInWithPopup, getRedirectResult, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider, db } from '../services/firebase';
import { useNavigate, Link } from 'react-router-dom';
import '../styles/global.css';
import '../styles/components/LoginPage.css';
import googleIcon from '../styles/components/assets/google-icon.svg';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { TextGenerateEffect } from '../styles/components/text-generate-effect.tsx';
import Header from '../components/Layout/Header';

const LoginPage = () => {
  const navigate = useNavigate();
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
      navigate('/home');
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

    // Check for pending redirect results (helpful if a redirect was previously used)
    const checkRedirect = async () => {
      console.log('checkRedirect - START');
      setLoading(true);
      try {
        const result = await getRedirectResult(auth);
        console.log('checkRedirect - getRedirectResult:', result);
        if (result) {
          await processLoginResult(result);
        } else {
          console.log('checkRedirect - No redirect result found');
        }
      } catch (error) {
        console.error('checkRedirect - Redirect login error:', error);
        alert('Authentication failed during redirect. Please try again.');
      } finally {
        setLoading(false);
        console.log('checkRedirect - FINISH');
      }
    };

    checkRedirect();

    // Listen for auth state changes - navigate to home if the user is already logged in
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('onAuthStateChanged - Auth state changed:', user);
      if (user) {
        console.log('onAuthStateChanged - User logged in, navigating to /home');
        navigate('/home');
      }
    });

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
      unsubscribe();
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      console.log('LoginPage useEffect - CLEANUP');
    };
  }, [processLoginResult, navigate]);

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
        {loading && <div className="loading-indicator">Loading...</div>}
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
        {/* Add to Home Screen Button/Instructions for mobile */}
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
          (Beta) By continuing, you agree to our <Link to="/terms" className="login-link">Terms</Link> and <Link to="/privacy" className="login-link">Privacy Policy</Link>.
        </h2>
      </div>
    </div>
  );
};

export default LoginPage;
