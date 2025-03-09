import React, { useEffect, useCallback, useState } from 'react';
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult
} from 'firebase/auth';
import { auth, googleProvider, db } from '../services/firebase';
import '../styles/global.css';
import googleIcon from '../styles/components/assets/google-icon.svg';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { TextGenerateEffect } from '../styles/components/text-generate-effect.tsx';
import Header from '../components/Layout/Header';

const LoginPage = ({ navigate }) => {
  const [loading, setLoading] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallButton, setShowInstallButton] = useState(false);

  // Helper functions to detect iOS and standalone mode
  const isIOS = () =>
    /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
  const isInStandaloneMode = () =>
    'standalone' in window.navigator && window.navigator.standalone;

  // If signInWithRedirect returns, we must handle that result
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
        console.log(
          'processLoginResult - New profile created for user:',
          user.uid
        );
      } else {
        console.log(
          'processLoginResult - Profile already exists for user:',
          user.uid
        );
      }

      console.log('processLoginResult - User Info:', user);
      // We'll rely on the onAuthStateChanged logic in App.jsx to navigate
      // But you *can* do it here if you want:
      // navigate('home');

    } catch (error) {
      console.error('processLoginResult - Error:', error);
      alert('Authentication failed during profile processing. Please try again.');
    } finally {
      setLoading(false);
      console.log('processLoginResult - FINISH');
    }
  }, []);

  // On mount, see if we’re returning from a redirect
  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result) {
          console.log('LoginPage - getRedirectResult:', result);
          processLoginResult(result);
        }
      })
      .catch((error) => {
        console.error('LoginPage - getRedirectResult error:', error);
      });
  }, [processLoginResult]);

  // On mount, also set up any “Add to Home Screen” logic
  useEffect(() => {
    console.log('LoginPage useEffect - START');
    document.body.classList.add('no-scroll');

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      console.log('beforeinstallprompt event captured');
      setDeferredPrompt(e);
      setShowInstallButton(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      document.body.classList.remove('no-scroll');
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
      console.log('LoginPage useEffect - CLEANUP');
    };
  }, []);

  // Called when the user taps “Continue with Google”
  const handleLogin = async () => {
    console.log('handleLogin - START');
    setLoading(true);

    try {
      // On iOS in PWA standalone, prefer signInWithRedirect
      if (isIOS() && isInStandaloneMode()) {
        console.log('handleLogin - Using signInWithRedirect for iOS PWA');
        await signInWithRedirect(auth, googleProvider);
      } else {
        // Otherwise, signInWithPopup is often simpler
        console.log('handleLogin - Using signInWithPopup');
        const result = await signInWithPopup(auth, googleProvider);
        console.log('handleLogin - signInWithPopup result:', result);
        await processLoginResult(result);
      }
    } catch (error) {
      console.error('handleLogin - Login Error:', error);
      alert('Authentication failed during login. Please try again.');
    } finally {
      setLoading(false);
      console.log('handleLogin - FINISH');
    }
  };

  // If user chooses to add app to home screen
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
          <TextGenerateEffect words="Souko, the song of your roots is the song of now" />
          <h4>
            This app is being built in public by @BramVanhaeren—things might
            break, errors will happen, but that’s all part of creating something cool!
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
                For the best experience, tap the <strong>Share</strong> icon
                and select <strong>"Add to Home Screen"</strong>.
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
          (Beta) By continuing, you agree to our{' '}
          <a href="/terms" className="login-link">
            Terms
          </a>{' '}
          and{' '}
          <a href="/privacy" className="login-link">
            Privacy Policy
          </a>
          .
        </h2>
      </div>
    </div>
  );
};

export default LoginPage;
