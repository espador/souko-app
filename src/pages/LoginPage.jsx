// LoginPage.jsx
import React, { useEffect, useCallback } from 'react';
import {
  signInWithPopup, // Keep this import for potential future use or fallback
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged
} from 'firebase/auth';
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

  // Process login result: create profile if necessary then navigate to home
  const processLoginResult = useCallback(async (result) => {
    console.log('processLoginResult called with:', result); // LOG: Check if this function is called and with what

    if (!result || !result.user) {
      console.log('processLoginResult: No result or user found, returning'); // LOG: Check if result or user is missing
      return; // Safety check in case result is null
    }

    const user = result.user;
    console.log('Firebase user:', user);

    // Check if profile exists in 'profiles' collection
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

    console.log('Navigating to /home from processLoginResult'); // LOG: Check if navigation is attempted
    navigate('/home');
  }, [navigate]);

  useEffect(() => {
    document.body.classList.add('no-scroll');

    // 1. Listen for existing auth state (user may already be signed in)
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('onAuthStateChanged in LoginPage triggered:', user); // LOG: Check if onAuthStateChanged is triggered and user state
      if (user) {
        console.log('User already signed in (onAuthStateChanged):', user);
        navigate('/home');
      }
    });

    // 2. Check for redirect results (Crucial for PWAs)
    const checkRedirect = async () => {
      try {
        console.log('Checking for redirect result...'); // LOG: Check if checkRedirect is called
        const result = await getRedirectResult(auth);
        console.log('getRedirectResult =>', result); // LOG: Inspect the redirect result
        if (result) {
          console.log('Redirect result found, processing...'); // LOG: Check if redirect result is processed
          await processLoginResult(result);
        } else {
          console.log('No redirect result found (initial load or popup flow).'); // LOG: Indicate no redirect result (normal for popup or initial load)
        }
      } catch (error) {
        console.error('Redirect login error:', error);
        alert('Authentication failed. Please try again.');
      }
    };

    checkRedirect(); // Check for redirect result on component mount

    return () => {
      document.body.classList.remove('no-scroll');
      unsubscribe();
    };
  }, [processLoginResult, navigate]);

  const handleLogin = async () => {
    try {
      console.log('Login button clicked'); // LOG: Check if login button is clicked
      console.log('Using signInWithRedirect for PWA (always)'); // LOG: Force redirect for PWA context
      await signInWithRedirect(auth, googleProvider); // **FORCE signInWithRedirect for PWAs**
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
           and 
          <Link to="/privacy" className="login-link">Privacy Policy</Link>.
        </h2>
      </div>
    </div>
  );
};

export default LoginPage;