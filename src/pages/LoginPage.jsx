import React, { useEffect } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../services/firebase'; // Update the path
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';

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
      console.log("User Info:", result.user);
      navigate('/home'); // Navigate after successful login
    } catch (error) {
      console.error("Login Error:", error);
      alert("Authentication failed. Please try again.");
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.logo}>Sou—ko*</h1>
      <p style={styles.tagline}>Every journey begins with one moment.</p>
      <button style={styles.loginButton} onClick={handleLogin}>
        Sign in with Google
      </button>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: '#f4f4f4',
  },
  logo: { fontSize: '3rem', fontFamily: 'serif' },
  tagline: { fontSize: '1.2rem', margin: '20px 0' },
  loginButton: {
    padding: '10px 20px',
    fontSize: '1rem',
    backgroundColor: '#4285F4',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
  },
};

export default LoginPage;
