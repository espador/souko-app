import React, { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Layout/Header'; // Adjust path if necessary

const CreateProjectPage = () => {
  const [projectName, setProjectName] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleCreateProject = async (e) => {
    e.preventDefault();

    if (!projectName.trim()) {
      setError('Project name is required.');
      return;
    }

    try {
      const user = auth.currentUser;

      if (!user) {
        throw new Error('User is not logged in.');
      }

      // Add project to Firestore
      await addDoc(collection(db, 'projects'), {
        name: projectName.trim(),
        userId: user.uid, // Make sure this is set correctly
        trackedTime: 0,
      });

      // Redirect back to the homepage
      navigate('/home');
    } catch (err) {
      console.error('Error creating project:', err);
      setError('Failed to create the project. Please try again.');
    }
  };

  return (
    <div>
      <Header
        title="Create Project"
        showBackArrow={true}
        onBack={() => navigate('/home')} // Navigate back to the homepage
        hideProfile={true} // Hides the profile picture and logout option
      />
      <div style={styles.container}>
        <h1>Create New Project</h1>
        <form onSubmit={handleCreateProject} style={styles.form}>
          <label>
            Project Name:
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              style={styles.input}
              placeholder="Enter project name"
            />
          </label>
          {error && <p style={styles.error}>{error}</p>}
          <button type="submit" style={styles.button}>
            Create Project
          </button>
        </form>
      </div>
    </div>
  );
};

const styles = {
  container: {
    fontFamily: 'Arial, sans-serif',
    padding: '20px',
    textAlign: 'center',
  },
  form: {
    marginTop: '20px',
  },
  input: {
    display: 'block',
    width: '100%',
    padding: '10px',
    margin: '10px 0',
    borderRadius: '5px',
    border: '1px solid #ccc',
    fontSize: '16px',
  },
  button: {
    padding: '10px 20px',
    backgroundColor: '#4285F4',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '16px',
  },
  error: {
    color: 'red',
    fontSize: '14px',
    marginTop: '10px',
  },
};

export default CreateProjectPage;
