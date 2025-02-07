// LoginPage.jsx
import React, { useEffect } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider, db } from '../services/firebase'; // Import db
import { useNavigate, Link } from 'react-router-dom';
import '../styles/global.css';
import '../styles/components/LoginPage.css'; // Import LoginPage specific styles
import googleIcon from '../styles/components/assets/google-icon.svg';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'; // Import Firestore functions
import { TextGenerateEffect } from '../styles/components/text-generate-effect.tsx';
import { ReactComponent as SoukoLogoHeader } from '../styles/components/assets/Souko-logo-header.svg';
import Header from '../components/Layout/Header'; // Import Header component

const LoginPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    document.body.classList.add('no-scroll'); // Keep no-scroll class
    return () => {
      document.body.classList.remove('no-scroll'); // Keep no-scroll class removal
    };
  }, []);

  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
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
    } catch (error) {
      console.error('Login Error:', error);
      alert('Authentication failed. Please try again.');
    }
  };

  return (
    <div className="login-page"> {/* Apply login-page class here */}
      <Header showLiveTime={true}  /> {/* Changed showLiveTime to true here */}
      <main className="login-content">
        <section className="motivational-section">
          <TextGenerateEffect
            words={`The song of your roots is the song of now`}
          />
            <h4>Master your time, shape your craft, and let progress flow. Mastery isn’t rushed, it’s built. </h4>
        </section>
        <div className="login-actions">
          <button className="login-button" onClick={handleLogin}>
            <img src={googleIcon} alt="Google Icon" className="google-icon" />
            Continue with Google
          </button>
        </div>
      </main>
      <div className="sticky-login-container"> {/* Sticky container here */}
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