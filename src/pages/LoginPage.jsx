// LoginPage.jsx
import React, { useEffect } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider, db } from '../services/firebase'; // Import db
import { useNavigate } from 'react-router-dom';
import '../styles/global.css';
import logo from '../styles/components/assets/souko-logo.svg';
import googleIcon from '../styles/components/assets/google-icon.svg';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'; // Import Firestore functions

const LoginPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    document.body.classList.add('login-page-background');
    document.body.classList.add('no-scroll');
    return () => {
      document.body.classList.remove('login-page-background');
      document.body.classList.remove('no-scroll');
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
    <div className="login-container">
      <div className="background-image">
        <img src={logo} alt="Sou—ko Logo" className="login-logo" />
        <div className="login-group">
          <p className="login-tagline">Every journey begins with one moment.</p>
          <button className="login-button" onClick={handleLogin}>
            <img src={googleIcon} alt="Google Icon" className="google-icon" />
            Sign in with Google
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;