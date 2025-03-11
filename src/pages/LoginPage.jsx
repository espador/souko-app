// src/pages/LoginPage.jsx
import React, { useEffect, useCallback, useState } from 'react';
// We import onAuthStateChanged, getRedirectResult, signInWithPopup
import {
  signInWithPopup,
  getRedirectResult,
  onAuthStateChanged
} from 'firebase/auth';
import { auth, googleProvider, db } from '../services/firebase';
import '../styles/global.css';
import googleIcon from '../styles/components/assets/google-icon.svg';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  runTransaction // Import runTransaction
} from 'firebase/firestore';
import { TextGenerateEffect } from '../styles/components/text-generate-effect.tsx';
import Header from '../components/Layout/Header';

const LoginPage = ({ navigate }) => {
  const [loading, setLoading] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallButton, setShowInstallButton] = useState(false);

  // Detect iOS + standalone (if you still want to show “Add to Home Screen” instructions)
  const isIOS = () =>
    /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
  const isInStandaloneMode = () =>
    'standalone' in window.navigator && window.navigator.standalone;

  /**
   * processLoginResult => Called once we have a user object (from popup or redirect).
   * Writes the user profile doc, then navigates to 'home'.
   */
  const processLoginResult = useCallback(async (result) => {
    console.log('processLoginResult - START');
    if (!result || !result.user) {
      console.warn('processLoginResult - No user in result:', result);
      return;
    }
    setLoading(true);

    try {
      const user = result.user;
      console.log('processLoginResult - User object:', user);

      // Check if user doc exists; if not, create it
      const profileRef = doc(db, 'profiles', user.uid);
      const profileSnap = await getDoc(profileRef);

      if (!profileSnap.exists()) {
        // Get and increment soukoNumber in a transaction
        let newSoukoNumber = '';
        try {
          await runTransaction(db, async (transaction) => {
            const counterRef = doc(db, 'counters', 'soukoCounter');
            const counterDoc = await transaction.get(counterRef);
            if (!counterDoc.exists()) {
              throw new Error("Counter document does not exist!");
            }
            const currentCount = counterDoc.data().count;
            const nextCount = currentCount + 1;
            transaction.update(counterRef, { count: nextCount });
            newSoukoNumber = String(nextCount).padStart(4, '0');
          });
          console.log("Transaction successfully committed, new soukoNumber:", newSoukoNumber);
        } catch (error) {
          console.error("Transaction failed: ", error);
          newSoukoNumber = '0000'; // Default soukoNumber in case of error
        }

        await setDoc(profileRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          profileImageUrl: user.photoURL,
          featureAccessLevel: 'free',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          soukoNumber: newSoukoNumber, // Save soukoNumber to profile
          onboardingComplete: false, // Set onboarding to false for new users
        });
        console.log('processLoginResult - New profile created for user:', user.uid, 'with soukoNumber:', newSoukoNumber);
      } else {
        console.log('processLoginResult - Profile already exists for user:', user.uid);
      }

      // Immediately navigate to home (just like your old code did with navigate('/home'))
      console.log('processLoginResult - Navigating to home...');
      navigate('home');
    } catch (error) {
      console.error('processLoginResult - Error:', error);
      alert('Authentication failed during profile processing. Please try again.');
    } finally {
      setLoading(false);
      console.log('processLoginResult - FINISH');
    }
  }, [navigate]);

  /**
   * useEffect #1 => Runs once on mount
   * 1) Checks if there's a pending redirect result (like your old code).
   * 2) Subscribes to onAuthStateChanged so if the user is already logged in, we go to home.
   */
  useEffect(() => {
    console.log('LoginPage useEffect - START');
    document.body.classList.add('no-scroll');

    // 1) Check redirect result
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

    // 2) Listen for auth changes => If user is already logged in, navigate home
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('onAuthStateChanged - Auth state changed:', user);
      if (user) {
        console.log('onAuthStateChanged - User logged in => navigate home');
        navigate('home');
      }
    });

    // 3) “beforeinstallprompt” for Android
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      console.log('beforeinstallprompt event captured');
      setDeferredPrompt(e);
      setShowInstallButton(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      document.body.classList.remove('no-scroll');
      unsubscribe(); // stop listening to onAuthStateChanged
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      console.log('LoginPage useEffect - CLEANUP');
    };
  }, [processLoginResult, navigate]);

  /**
   * handleLogin => your old code used signInWithPopup always.
   */
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

  /**
   * If the user chooses to "Add to Home Screen" on Android
   */
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
          <button
            className="login-button"
            onClick={handleLogin}
            disabled={loading}
          >
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