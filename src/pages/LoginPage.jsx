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
    console.log('processLoginResult - START'); // LOG
    setLoading(true);
    try {
      const user = result.user;
      console.log('processLoginResult - User object:', user); // LOG
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
        console.log('processLoginResult - New profile created for user:', user.uid); // LOG
      } else {
        console.log('processLoginResult - Profile already exists for user:', user.uid); // LOG
      }

      console.log('processLoginResult - User Info:', user); // LOG
      navigate('/home');
      console.log('processLoginResult - Navigated to /home'); // LOG
    } catch (error) {
      console.error('processLoginResult - Error:', error); // LOG
      alert('Authentication failed during profile processing. Please try again.');
    } finally {
      setLoading(false);
      console.log('processLoginResult - FINISH'); // LOG
    }
  }, [navigate]);

  useEffect(() => {
    console.log('LoginPage useEffect - START'); // LOG
    document.body.classList.add('no-scroll');

    // Check for pending redirect results (especially for iOS standalone PWAs)
    const checkRedirect = async () => {
      console.log('checkRedirect - START'); // LOG
      setLoading(true);
      try {
        const result = await getRedirectResult(auth);
        console.log('checkRedirect - getRedirectResult:', result); // LOG
        if (result) {
          await processLoginResult(result);
        } else {
          console.log('checkRedirect - No redirect result found'); // LOG
        }
      } catch (error) {
        console.error('checkRedirect - Redirect login error:', error); // LOG
        alert('Authentication failed during redirect. Please try again.');
      } finally {
        setLoading(false);
        console.log('checkRedirect - FINISH'); // LOG
      }
    };

    checkRedirect();

    // Listen for auth state changes - helps if redirect doesn't immediately return a result
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('onAuthStateChanged - Auth state changed:', user); // LOG
      if (user) {
        console.log('onAuthStateChanged - User logged in, navigating to /home'); // LOG
        navigate('/home');
      }
    });

    return () => {
      document.body.classList.remove('no-scroll');
      unsubscribe();
      console.log('LoginPage useEffect - CLEANUP'); // LOG
    };
  }, [processLoginResult, navigate]);

  const handleLogin = async () => {
    console.log('handleLogin - START'); // LOG
    setLoading(true);
    try {
      console.log('handleLogin - isIOS() && isInStandaloneMode():', isIOS() && isInStandaloneMode()); // LOG
      if (isIOS() && isInStandaloneMode()) {
        console.log('handleLogin - Using signInWithRedirect'); // LOG
        await signInWithRedirect(auth, googleProvider);
      } else {
        console.log('handleLogin - Using signInWithPopup'); // LOG
        const result = await signInWithPopup(auth, googleProvider);
        console.log('handleLogin - signInWithPopup result:', result); // LOG
        await processLoginResult(result);
      }
    } catch (error) {
      console.error('handleLogin - Login Error:', error); // LOG
      alert('Authentication failed during login. Please try again.');
    } finally {
      setLoading(false);
      console.log('handleLogin - FINISH'); // LOG
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
           and 
          <Link to="/privacy" className="login-link">Privacy Policy</Link>.
        </h2>
      </div>
    </div>
  );
};

export default LoginPage;