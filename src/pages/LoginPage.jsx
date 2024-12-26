import React, { useEffect } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../services/firebase';
import { useNavigate } from 'react-router-dom';
import '../styles/global.css';
import logo from '../styles/components/assets/souko-logo.svg';
import googleIcon from '../styles/components/assets/google-icon.svg';

const LoginPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    document.body.classList.add('login-page-background'); // Add a specific class to the body
    document.body.classList.add('no-scroll'); // Add the no-scroll class
    return () => {
      document.body.classList.remove('login-page-background'); // Remove the class on unmount
      document.body.classList.remove('no-scroll'); // Remove it on unmount
    };
  }, []);

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