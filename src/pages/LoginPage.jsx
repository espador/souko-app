import React, { useEffect, useCallback, useState } from 'react';
import { signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged } from 'firebase/auth';
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

  // Helper functions to detect iOS and standalone mode
  const isIOS = () => /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
  const isInStandaloneMode = () => ('standalone' in window.navigator) && window.navigator.standalone;

  // Process login result: create profile if necessary then navigate to home
  const processLoginResult = useCallback(async (result) => {
    setLoading(true);
    const user = result.user;
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
      console.log('New profile created for user:', user.uid);
    } else {
      console.log('Profile already exists for user:', user.uid);
    }

    console.log('User Info:', user);
    navigate('/home');
    setLoading(false);
  }, [navigate]);

  useEffect(() => {
    document.body.classList.add('no-scroll');

    // Check for pending redirect results (especially for iOS standalone PWAs)
    const checkRedirect = async () => {
      setLoading(true);
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          await processLoginResult(result);
        }
      } catch (error) {
        console.error('Redirect login error:', error);
        alert('Authentication failed. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    checkRedirect();

    // Listen for auth state changes - helps if redirect doesn't immediately return a result
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        navigate('/home');
      }
    });

    return () => {
      document.body.classList.remove('no-scroll');
      unsubscribe();
    };
  }, [processLoginResult, navigate]);

  const handleLogin = async () => {
    setLoading(true);
    try {
      if (isIOS() && isInStandaloneMode()) {
        // Use redirect method for iOS PWAs to avoid pop-up issues.
        await signInWithRedirect(auth, googleProvider);
      } else {
        const result = await signInWithPopup(auth, googleProvider);
        await processLoginResult(result);
      }
    } catch (error) {
      console.error('Login Error:', error);
      alert('Authentication failed. Please try again.');
    } finally {
      setLoading(false);
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
