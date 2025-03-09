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

  // Helper: detect iOS + standalone
  const isIOS = () =>
    /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
  const isInStandaloneMode = () =>
    'standalone' in window.navigator && window.navigator.standalone;

  /**
   * "processLoginResult" => Firestore profile creation + navigate home.
   * This matches your older code that always navigated to 'home' after sign-in.
   */
  const processLoginResult = useCallback(async (result) => {
    console.log('processLoginResult - START');
    setLoading(true);
    try {
      if (!result || !result.user) {
        console.warn('processLoginResult - NO USER in result:', result);
        return;
      }
      const user = result.user;
      console.log('processLoginResult - User object:', user);

      // Make sure user doc exists
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
   * On first render, check if we just came back from a redirect sign-in.
   * If so, "getRedirectResult" gives us the user => call "processLoginResult".
   */
  useEffect(() => {
    console.log('LoginPage useEffect - check redirect result');
    getRedirectResult(auth)
      .then((result) => {
        if (result) {
          console.log('LoginPage - getRedirectResult found user:', result.user);
          processLoginResult(result);
        } else {
          console.log('LoginPage - getRedirectResult had no user');
        }
      })
      .catch((error) => {
        console.error('LoginPage - getRedirectResult error:', error);
      });
  }, [processLoginResult]);

  /**
   * Also set up "beforeinstallprompt" (Android) and disable body scroll
   */
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
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      console.log('LoginPage useEffect - CLEANUP');
    };
  }, []);

  /**
   * The button the user clicks: on iOS standalone, do signInWithRedirect
   * on everything else, do signInWithPopup
   */
  const handleLogin = async () => {
    console.log('handleLogin - START');
    setLoading(true);
    try {
      if (isIOS() && isInStandaloneMode()) {
        console.log('handleLogin - Using signInWithRedirect for iOS PWA');
        await signInWithRedirect(auth, googleProvider);
      } else {
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

  /**
   * If user taps “Add to Home Screen” button on Android
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
