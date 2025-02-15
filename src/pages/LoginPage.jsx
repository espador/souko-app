// LoginPage.jsx
import React, { useEffect, useCallback } from 'react';
import { signInWithPopup, signInWithRedirect, getRedirectResult } from 'firebase/auth';
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

  // Helper functions to detect iOS and standalone mode
  const isIOS = () => /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
  const isInStandaloneMode = () => ('standalone' in window.navigator) && window.navigator.standalone;

  // Process login result: create profile if necessary then navigate to home
  const processLoginResult = useCallback(async (result) => {
    const user = result.user;
    // Check if profile exists in 'profiles' collection
    const profileRef = doc(db, 'profiles', user.uid);
    const profileSnap = await getDoc(profileRef);

    if (!profileSnap.exists()) {
      // Create a new profile document if it doesn't exist
      await setDoc(profileRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        profileImageUrl: user.photoURL,
        featureAccessLevel: 'free', // Default access level
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      console.log('New profile created for user:', user.uid);
    } else {
      console.log('Profile already exists for user:', user.uid);
    }

    console.log('User Info:', user);
    navigate('/home');
  }, [navigate]);

  useEffect(() => {
    document.body.classList.add('no-scroll');

    // Check for pending redirect results (necessary for iOS standalone mode)
    const checkRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          await processLoginResult(result);
        }
      } catch (error) {
        console.error('Redirect login error:', error);
        alert('Authentication failed. Please try again.');
      }
    };

    checkRedirect();

    return () => {
      document.body.classList.remove('no-scroll');
    };
  }, [processLoginResult]);

  const handleLogin = async () => {
    try {
      if (isIOS() && isInStandaloneMode()) {
        // Use redirect method for iOS PWAs to avoid popup issues.
        await signInWithRedirect(auth, googleProvider);
      } else {
        const result = await signInWithPopup(auth, googleProvider);
        await processLoginResult(result);
      }
    } catch (error) {
      console.error('Login Error:', error);
      alert('Authentication failed. Please try again.');
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
          <button className="login-button" onClick={handleLogin}>
            <img src={googleIcon} alt="Google Icon" className="google-icon" />
            Continue with Google
          </button>
        </div>
      </main>
      <div className="sticky-login-container">
        <h2 className="login-terms">
          By continuing, you agree to our <Link to="/terms" className="login-link">Terms</Link>
          &nbsp;and&nbsp;
          <Link to="/privacy" className="login-link">Privacy Policy</Link>.
        </h2>
      </div>
    </div>
  );
};

export default LoginPage;
