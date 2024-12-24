// LoginPage.jsx
import React, { useEffect } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../services/firebase';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import '../styles/global.css';
import bgImage from '../styles/components/assets/bg-image.webp';
import logo from '../styles/components/assets/souko-logo.svg';
import googleIcon from '../styles/components/assets/google-icon.svg'; // Import as googleIcon (lowercase)

const LoginPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) navigate('/home');
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      console.log('User Info:', result.user);
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