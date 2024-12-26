import React, { useState, useRef } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Layout/Header';
import '../styles/components/CreateProjectPage.css'; // Corrected import path
import { ReactComponent as EditIcon } from '../styles/components/assets/edit.svg';

const CreateProjectPage = () => {
    const [projectName, setProjectName] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const [projectImage, setProjectImage] = useState(null); // This will hold the local preview OR the Firebase URL
    const fileInputRef = useRef(null);
    const [uploading, setUploading] = useState(false);

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

            let imageUrl = null;
            if (projectImage && typeof projectImage !== 'string') { // Check if it's a File object (new upload)
                setUploading(true);
                const storage = getStorage();
                const storageRef = ref(storage, `project-images/${user.uid}/${projectName}-${Date.now()}`);
                const uploadTask = uploadBytesResumable(storageRef, projectImage);

                await new Promise((resolve, reject) => {
                    uploadTask.on('state_changed',
                        (snapshot) => {
                            // You can track progress here if needed
                            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                            console.log('Upload is ' + progress + '% done');
                        },
                        (error) => {
                            setUploading(false);
                            setError('Failed to upload image.');
                            console.error('Image upload error:', error);
                            reject(error);
                        },
                        async () => {
                            imageUrl = await getDownloadURL(uploadTask.snapshot.ref);
                            setUploading(false);
                            resolve();
                        }
                    );
                });
            } else if (typeof projectImage === 'string') {
                imageUrl = projectImage; // Already a Firebase URL
            }

            // Add project to Firestore
            await addDoc(collection(db, 'projects'), {
                name: projectName.trim(),
                userId: user.uid,
                trackedTime: 0,
                imageUrl: imageUrl, // Store the Firebase Storage URL
            });

            navigate('/home');
        } catch (err) {
            setUploading(false);
            console.error('Error creating project:', err);
            setError('Failed to create the project. Please try again.');
        }
    };

    const handleImageUploadClick = () => {
        fileInputRef.current.click();
    };

    const handleImageChange = (event) => {
      const file = event.target.files[0];
      if (file && file.size <= 5 * 1024 * 1024) { // 5MB limit
          setProjectImage(file); // Ensure you are setting the state here
          const reader = new FileReader();
          reader.onloadend = () => {
              // Optionally, keep a local preview URL if needed
              // setLocalPreviewUrl(reader.result);
          };
          reader.readAsDataURL(file);
      } else if (file) {
          alert('Image size should be less than 5MB.');
      }
  };

    const getInitials = (name) => {
        return name.trim().charAt(0).toUpperCase();
    };

    return (
        <div className="create-project-page">
            <Header
                title=""
                showBackArrow={true}
                onBack={() => navigate('/home')}
                hideProfile={true}
            />
            <main className="create-project-content">
            <section className="motivational-section">
                    <p>
                            Every journey begins with{' '}
                            <span style={{ color: 'var(--accent-color)' }}>one moment</span>.
                            Tell me about your project ...
                        </p>
        </section>
                <section className="project-details-section">
                    <h2>Project details</h2>
                    <div className="project-name-input-wrapper">
                        <div
                            className="project-image-container"
                            onClick={handleImageUploadClick}
                            >
                            {projectImage && typeof projectImage !== 'string' ? (
                                <img
                                    src={URL.createObjectURL(projectImage)} // Create temporary URL for preview
                                    alt="Project"
                                    className="project-image"
                                />
                            ) : projectImage && typeof projectImage === 'string' ? (
                                <img
                                    src={projectImage}
                                    alt="Project"
                                    className="project-image"
                                />
                            ) : (
                                <div
                                    className="default-project-image"
                                    style={{ backgroundColor: '#555' }} // Example background color
                                    >
                                    <span>{getInitials(projectName || 'P')}</span>
                                </div>
                            )}
                        </div>
                        <input
                            type="text"
                            placeholder="Project name"
                            value={projectName}
                            onChange={(e) => setProjectName(e.target.value)}
                            className="project-name-input"
                        />
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                        />
                        <div className="edit-icon-container">
                            <EditIcon className="edit-icon" />
                        </div>
                    </div>
                </section>

                {error && <p className="error-message">{error}</p>}

                <button
    className="create-project-button"
    onClick={handleCreateProject}
    disabled={uploading}
>
    {uploading ? (
        <div className="spinner"></div>
    ) : (
        <>
            <span className="button-icon">+</span> Create your project
        </>
    )}
</button>

            </main>
        </div>
    );
};

export default CreateProjectPage;