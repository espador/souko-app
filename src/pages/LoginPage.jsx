// src/pages/LoginPage.jsx
import React, { useEffect, useCallback, useState, useRef } from 'react';
import {
  signInWithPopup,
  getRedirectResult,
  onAuthStateChanged,
  browserSessionPersistence,
  setPersistence,
  indexedDBLocalPersistence
} from 'firebase/auth';
import { auth, googleProvider, db } from '../services/firebase';
import '../styles/loginpage.css';
import googleIcon from '../styles/components/assets/google-icon.svg';
import scrollIcon from '../styles/components/assets/scroll-icon.svg';
import threadsIcon from '../styles/components/assets/threads.svg';
import greenSmiley from '../styles/components/assets/greensmiley.png';

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  runTransaction
} from 'firebase/firestore';
import { TextGenerateEffect } from '../styles/components/text-generate-effect.tsx';
import Header from '../components/Layout/Header';

// Import additional images for feature highlights
import featureImage0 from '../styles/components/assets/feature-0.png';
import featureImage1 from '../styles/components/assets/feature-1.png';
import featureImage2 from '../styles/components/assets/feature-2.png';
import featureImage3 from '../styles/components/assets/feature-3.png';

const LoginPage = ({ navigate }) => {
  const [loading, setLoading] = useState(false);
  const [totalTime, setTotalTime] = useState('0h 0m');
  const [authError, setAuthError] = useState(null);
  
  // Refs for elements we want to animate
  const featureTextRefs = useRef([]);
  const featureCardTitleRefs = useRef([]);
  const featureCardDescRefs = useRef([]);
  const ctaContentRef = useRef(null);

  /**
   * Process login result
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
          soukoNumber: newSoukoNumber,
          onboardingComplete: false,
        });
        console.log('processLoginResult - New profile created for user:', user.uid, 'with soukoNumber:', newSoukoNumber);
      } else {
        console.log('processLoginResult - Profile already exists for user:', user.uid);
      }

      console.log('processLoginResult - Navigating to home...');
      navigate('home');
    } catch (error) {
      console.error('processLoginResult - Error:', error);
      setAuthError('Authentication failed during profile processing. Please try again.');
    } finally {
      setLoading(false);
      console.log('processLoginResult - FINISH');
    }
  }, [navigate]);

  // Fetch total time
  useEffect(() => {
    const fetchTotalTime = async () => {
      try {
        const soukoTimeDoc = await getDoc(doc(db, 'counters', 'SoukoTime'));
        if (soukoTimeDoc.exists()) {
          const totalSeconds = soukoTimeDoc.data().TotalSoukoTime;
          const hours = Math.floor(totalSeconds / 3600);
          const minutes = Math.floor((totalSeconds % 3600) / 60);
          setTotalTime(`${hours}h ${minutes}m`);
        }
      } catch (error) {
        console.error('Error fetching total time:', error);
        setTotalTime('0h 0m'); // Fallback value
      }
    };

    fetchTotalTime();
  }, []);

  /**
   * useEffect for auth handling
   */
  useEffect(() => {
    console.log('LoginPage useEffect - START');
    document.body.classList.add('allow-scroll'); // Enable scrolling on landing page

    // Add login-root class to #root element
    const rootElement = document.getElementById('root');
    if (rootElement) {
      rootElement.classList.add('login-root');
    }

    // Set persistence to indexedDBLocalPersistence first
    // This helps with iOS Safari issues
    setPersistence(auth, indexedDBLocalPersistence)
      .then(() => {
        console.log('Firebase persistence set to indexedDBLocalPersistence');
        
        // Check redirect result
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
            setAuthError('Authentication failed during redirect. Please try again.');
          } finally {
            setLoading(false);
            console.log('checkRedirect - FINISH');
          }
        };
        checkRedirect();
      })
      .catch((error) => {
        console.error('Error setting auth persistence:', error);
        // Fall back to browserSessionPersistence if indexedDB fails
        setPersistence(auth, browserSessionPersistence)
          .then(() => {
            console.log('Fallback: Firebase persistence set to browserSessionPersistence');
          })
          .catch((error) => {
            console.error('Error setting fallback auth persistence:', error);
          });
      });

    // Listen for auth changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('onAuthStateChanged - Auth state changed:', user);
      if (user) {
        console.log('onAuthStateChanged - User logged in => navigate home');
        navigate('home');
      }
    });

    return () => {
      unsubscribe();

      // Cleanup function to remove the class when component unmounts
      if (rootElement) {
        rootElement.classList.remove('login-root');
      }

      console.log('LoginPage useEffect - CLEANUP');
    };
  }, [processLoginResult, navigate]);

  /**
   * Handle login
   */
  const handleLogin = async () => {
    console.log('handleLogin - START');
    setLoading(true);
    setAuthError(null);
    
    try {
      // First ensure we're using the right persistence
      await setPersistence(auth, indexedDBLocalPersistence);
      
      console.log('handleLogin - Using signInWithPopup');
      const result = await signInWithPopup(auth, googleProvider);
      console.log('handleLogin - signInWithPopup result:', result);
      await processLoginResult(result);
    } catch (error) {
      console.error('handleLogin - Login Error:', error);
      
      // Try fallback to session persistence if needed
      if (error.code === 'auth/internal-error' || error.code === 'auth/web-storage-unsupported') {
        try {
          await setPersistence(auth, browserSessionPersistence);
          const result = await signInWithPopup(auth, googleProvider);
          await processLoginResult(result);
        } catch (fallbackError) {
          console.error('handleLogin - Fallback Login Error:', fallbackError);
          setAuthError('Authentication failed. Please try again or use a different browser.');
        }
      } else {
        setAuthError('Authentication failed. Please try again.');
      }
    } finally {
      setLoading(false);
      console.log('handleLogin - FINISH');
    }
  };

  // Setup intersection observer for fade-in animations
  useEffect(() => {
    const observerOptions = {
      root: null, // use viewport
      rootMargin: '0px',
      threshold: 0.1 // trigger when 10% of element is visible
    };

    const handleIntersect = (entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          // Unobserve after animation to improve performance
          observer.unobserve(entry.target);
        }
      });
    };

    const observer = new IntersectionObserver(handleIntersect, observerOptions);
    
    // Observe feature text elements
    if (featureTextRefs.current) {
      featureTextRefs.current.forEach(ref => {
        if (ref) observer.observe(ref);
      });
    }
    
    // Observe feature card titles
    if (featureCardTitleRefs.current) {
      featureCardTitleRefs.current.forEach(ref => {
        if (ref) observer.observe(ref);
      });
    }
    
    // Observe feature card descriptions
    if (featureCardDescRefs.current) {
      featureCardDescRefs.current.forEach(ref => {
        if (ref) observer.observe(ref);
      });
    }
    
    // Observe CTA content
    if (ctaContentRef.current) {
      observer.observe(ctaContentRef.current);
    }

    return () => {
      // Cleanup observer on component unmount
      observer.disconnect();
    };
  }, []);

  // Function to add refs to our ref arrays for animations
  const addFeatureTextRef = el => {
    if (el && !featureTextRefs.current.includes(el)) {
      featureTextRefs.current.push(el);
    }
  };
  
  const addFeatureCardTitleRef = el => {
    if (el && !featureCardTitleRefs.current.includes(el)) {
      featureCardTitleRefs.current.push(el);
    }
  };
  
  const addFeatureCardDescRef = el => {
    if (el && !featureCardDescRefs.current.includes(el)) {
      featureCardDescRefs.current.push(el);
    }
  };

  return (
    <div className="landing-page"> {/* Main container with scroll enabled */}
      {/* Fixed section - stays in place */}
      <div className="fixed-section">
        {/* Background Gradient */}
        <div className="background-gradient"></div>

        {/* Header */}
        <div className="landing-header">
          <Header showLiveTime={true} variant="login" />
        </div>

        {/* Total Time Banner */}
        <div className="total-time-banner">
          <div className="total-time-content">
            <span className="total-time-label">(beta) Total tracked time</span>
            <span className="total-time-value">{totalTime}</span>
          </div>
        </div>

        {/* Hero Section */}
        <section className="hero-section">
          <div className="hero-content">
            <p className="hero-appname">
              Souko
            </p>
            <h1 className="hero-title">
              <TextGenerateEffect words={`Designed to track your time, \nbuilt to inspire.`} />
            </h1>
            <p className="hero-subtitle">
              Mastery isn't rushed — it's refined. Souko helps you master your craft, one session at a time. No teams, no noise, just you and your moments.
            </p>
            <div className="hero-cta">
              <button
                className={`login-button ${loading ? 'login-button-loading' : ''}`}
                onClick={handleLogin}
                disabled={loading}
              >
                <img src={googleIcon} alt="Google Icon" className="google-icon" />
                {loading ? 'Connecting...' : 'Continue with Google'}
              </button>
              {authError && <p className="auth-error">{authError}</p>}
            </div>
            <div className="scroll-icon-container">
              <img src={scrollIcon} alt="Scroll down" className="scroll-icon" />
            </div>
          </div>
        </section>
      </div>

      {/* Scrollable content - scrolls over fixed section */}
      <div className="scrollable-content">
        {/* Main Feature Section */}
        <section className="main-feature-section">
          <div className="feature-content">
            <div className="feature-image-container">
              <img src={featureImage0} alt="Souko Main Feature" className="feature-card-image" />
            </div>
            <div className="feature-text" ref={addFeatureTextRef}>
              <h2 className="feature-title">Your space, your moments</h2>
              <p className="feature-description">
                Souko helps you connect your time to your purpose, turning moments into meaningful progress. This isn't your team's tool — it's your personal space to master your craft.
                Your time, your space, your moments.
              </p>
            </div>
          </div>
        </section>

        {/* Feature Highlights Section */}
        <section className="feature-highlights-section">
          <h2 className="highlights-title">Features</h2>

          <div className="feature-cards">
            <div className="feature-card">
              <div className="feature-card-image-container">
                <img src={featureImage1} alt="Project Tracking" className="feature-card-image" />
              </div>
              <h3 className="feature-card-title" ref={addFeatureCardTitleRef}>Time Tracking</h3>
              <p className="feature-card-description" ref={addFeatureCardDescRef}>
                Track your sessions with purpose. Set clear objectives, label your work, and stay focused. All your sessions, tracked seamlessly across devices.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-card-image-container">
                <img src={featureImage2} alt="Daily Reflections" className="feature-card-image" />
              </div>
              <h3 className="feature-card-title" ref={addFeatureCardTitleRef}>Project insights</h3>
              <p className="feature-card-description" ref={addFeatureCardDescRef}>
                Know what's working — and what's not. See your earnings, track progress by project, and understand how your time shapes results. Clear insights, sharper focus.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-card-image-container">
                <img src={featureImage3} alt="Progress Insights" className="feature-card-image" />
              </div>
              <h3 className="feature-card-title" ref={addFeatureCardTitleRef}>Kaizen journal</h3>
              <p className="feature-card-description" ref={addFeatureCardDescRef}>
                In just seconds, capture your mood, reflect on what shaped it, and define actions to improve tomorrow. Build streaks that build momentum — one moment at a time.
              </p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="cta-section">
          <div className="cta-container">
            <div className="cta-image-container">
              <img src={greenSmiley} alt="Green Smiley" className="cta-image rotating-smiley" />
            </div>
            <div className="cta-content" ref={ctaContentRef}>
              <h2 className="cta-title">This project was built in public by Bram Vanhaeren</h2>
              <p className="cta-text">
                A designer with no coding experience, learning to build digital products end-to-end with the power of AI and 10+ years of design expertise. Every insight, mistake, and breakthrough fuels my talks and consultancy. Curious about the journey? Let's chat.
              </p>
              <div className="cta-buttons">
                <div className="social-buttons">
                  <a
                    href="https://madebybram.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="social-button"
                  >
                    MadeByBram.com
                  </a>
                  <a
                    href="https://www.threads.net/@bramvanhaeren"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="social-button"
                  >
                    <img src={threadsIcon} alt="Threads" className="social-icon" />
                    Threads
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="landing-footer">
          <div className="footer-content">
            <div className="footer-logo">
              <span className="footer-logo-text">Souko</span>
            </div>

            <div className="footer-legal">
              <p className="footer-copyright">© 2025 Souko. All rights reserved.</p>
              <p className="footer-terms">
                By continuing, you agree to our <a href="/terms" className="footer-terms-link">Terms</a> and <a href="/privacy" className="footer-terms-link">Privacy Policy</a>.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default LoginPage;
