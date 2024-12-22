import React, { useEffect } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../services/firebase';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import '../styles/global.css'; // Import global styles

const LoginPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) navigate('/home'); // Redirect authenticated users
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      console.log('User Info:', result.user);
      navigate('/home'); // Navigate after successful login
    } catch (error) {
      console.error('Login Error:', error);
      alert('Authentication failed. Please try again.');
    }
  };

  return (
    <div className="login-container">
      <h1 className="login-logo">Sou—ko*</h1>
      <p className="login-tagline">Every journey begins with one moment.</p>
      <button className="login-button" onClick={handleLogin}>
        Sign in with Google
      </button>
    </div>
  );
};

export default LoginPage;
