import React, { useState, useRef, useCallback, useMemo } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Layout/Header';
import '../styles/components/CreateProjectPage.css';

import { ReactComponent as BillableIcon } from '../styles/components/assets/billable.svg';
import { ReactComponent as UploadFileIcon } from '../styles/components/assets/uploadfile.svg';
import { ReactComponent as EuroIcon } from '../styles/components/assets/euro.svg';
import { ReactComponent as DollarIcon } from '../styles/components/assets/dollar.svg';

// Import TextGenerateEffect
import { TextGenerateEffect } from '../styles/components/text-generate-effect.tsx';

// Increase max file size from 500KB to 1024KB (1MB) to accommodate modern mobile photos.
const MAX_FILE_SIZE_KB = 2048;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_KB * 2048;
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/gif'];
const MAX_IMAGE_WIDTH = 5000;
const MAX_IMAGE_HEIGHT = 5000;
const TARGET_IMAGE_WIDTH = 164; // Target width for compressed images (pixels)
const TARGET_IMAGE_HEIGHT = 164; // Target height for compressed images (pixels)
const COMPRESSION_QUALITY = 0.5; // JPEG compression quality (0 to 1)

const CreateProjectPage = React.memo(() => {
  const [projectName, setProjectName] = useState('');
  const [hourRate, setHourRate] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [projectImage, setProjectImage] = useState(null);
  const fileInputRef = useRef(null);
  const projectNameInputRef = useRef(null);
  const hourRateInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  // NEW: Currency toggle state
  const [currencyId, setCurrencyId] = useState('euro'); // "euro" by default

  // Compress the image using a canvas.
  const compressImage = useCallback(async (file) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Scale the image down if it exceeds target dimensions.
        if (width > TARGET_IMAGE_WIDTH || height > TARGET_IMAGE_HEIGHT) {
          const aspectRatio = width / height;
          if (width > height) {
            width = TARGET_IMAGE_WIDTH;
            height = width / aspectRatio;
          } else {
            height = TARGET_IMAGE_HEIGHT;
            width = height * aspectRatio;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: blob.type,
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              reject(new Error('Failed to compress image.'));
            }
          },
          'image/jpeg', // Convert image to JPEG for better compression.
          COMPRESSION_QUALITY
        );
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }, []);

  // Handle the create project logic
  const handleCreateProject = useCallback(async (e) => {
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
      if (projectImage && typeof projectImage !== 'string') {
        setUploading(true);
        const storage = getStorage();
        const storageRef = ref(storage, `project-images/${user.uid}/${projectName}-${Date.now()}`);
        const uploadTask = uploadBytesResumable(storageRef, projectImage);

        await new Promise((resolve, reject) => {
          uploadTask.on('state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              console.log('Upload is ' + progress.toFixed(2) + '% done');
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
        imageUrl = projectImage;
      }

      await addDoc(collection(db, 'projects'), {
        name: projectName.trim(),
        userId: user.uid,
        trackedTime: 0,
        imageUrl: imageUrl,
        hourRate: hourRate ? parseInt(hourRate, 10) : 0,
        currencyId // Save currency ("euro" or "dollar")
      });

      navigate('/home');
    } catch (err) {
      setUploading(false);
      console.error('Error creating project:', err);
      setError('Failed to create the project. Please try again.');
    }
  }, [projectName, projectImage, navigate, hourRate, currencyId]);

  // Trigger file input for image
  const handleImageUploadClick = useCallback(() => {
    fileInputRef.current.click();
  }, []);

  // Handle file change (image selection)
  const handleImageChange = useCallback(async (event) => {
    const file = event.target.files[0];

    if (!file) return;

    // Validate file type.
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      alert(`Please select a valid image file type: ${ALLOWED_FILE_TYPES.join(', ')}`);
      event.target.value = '';
      return;
    }

    // Validate file size.
    if (file.size > MAX_FILE_SIZE_BYTES) {
      alert(`Image size should be less than ${MAX_FILE_SIZE_KB} KB.`);
      event.target.value = '';
      return;
    }

    const img = new Image();
    img.onload = async () => {
      // Validate image dimensions.
      if (img.width > MAX_IMAGE_WIDTH || img.height > MAX_IMAGE_HEIGHT) {
        alert(`Image dimensions should not exceed ${MAX_IMAGE_WIDTH}x${MAX_IMAGE_HEIGHT} pixels.`);
        setProjectImage(null);
        event.target.value = '';
        return;
      }

      try {
        const compressedImageFile = await compressImage(file);
        setProjectImage(compressedImageFile);
      } catch (compressionError) {
        console.error('Image compression error:', compressionError);
        alert('Failed to process image. Please try again.');
        setProjectImage(null);
        event.target.value = '';
      }
    };
    img.onerror = () => {
      alert('Error loading image.');
      setProjectImage(null);
      event.target.value = '';
    };
    img.src = URL.createObjectURL(file);
  }, [compressImage]);

  const getInitials = useCallback((name) => {
    return name.trim().charAt(0).toUpperCase();
  }, []);

  const memoizedProjectImage = useMemo(() => {
    if (projectImage && typeof projectImage !== 'string') {
      return <img src={URL.createObjectURL(projectImage)} alt="Project" className="project-image" />;
    } else if (projectImage && typeof projectImage === 'string') {
      return <img src={projectImage} alt="Project" className="project-image" />;
    } else {
      return (
        <div
          className="default-project-image"
          style={{ backgroundColor: '#7B7BFF' }}
        >
          <span>{getInitials(projectName || 'P')}</span>
        </div>
      );
    }
  }, [projectImage, projectName, getInitials]);

  // NEW: Toggle currency from euro <-> dollar
  const handleCurrencyToggle = useCallback(() => {
    setCurrencyId((prev) => (prev === 'euro' ? 'dollar' : 'euro'));
  }, []);

  return (
    <div className="create-project-page">
      <Header
        variant="journalOverview"
        showBackArrow={true}
      />
      <main className="create-project-content">
        <section className="motivational-section">
          <TextGenerateEffect
            words={`Every journey \nbegins with one\n moment. Tell me \nabout your project ...`}
            element="h1"
          />
        </section>
        <section className="project-details-section">
          <h2>Project details</h2>

          {/* PROJECT NAME WRAPPER */}
          <div className="project-input-wrapper">
            <div
              className="project-image-container"
              onClick={handleImageUploadClick}
            >
              {memoizedProjectImage}
            </div>
            <input
              type="text"
              placeholder="Project name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="project-name-input"
              ref={projectNameInputRef}
              onBlur={() => {
                projectNameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
            />
            <input
              type="file"
              accept="image/jpeg, image/png, image/gif"
              onChange={handleImageChange}
              ref={fileInputRef}
              style={{ display: 'none' }}
            />
            {/* Upload button with new .icon-button styling */}
            <button
              type="button"
              className="icon-button"
              onClick={handleImageUploadClick}
            >
              <UploadFileIcon />
            </button>
          </div>

          {/* HOUR RATE + CURRENCY WRAPPER */}
          <div className="project-input-wrapper">
            <div className="project-icon-container">
              <BillableIcon className="project-visual" style={{ fill: '#FFFFFF' }}/>
            </div>
            <input
              type="number"
              placeholder="Hour rate"
              value={hourRate}
              onChange={(e) => setHourRate(e.target.value)}
              className="project-name-input"
              ref={hourRateInputRef}
              onBlur={() => {
                hourRateInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
              inputMode="numeric"
            />
            {/* Currency toggle button with new .icon-button styling */}
            <button
              type="button"
              className="icon-button"
              onClick={handleCurrencyToggle}
            >
              {currencyId === 'euro' ? <EuroIcon /> : <DollarIcon />}
            </button>
          </div>
        </section>

        {error && <p className="error-message">{error}</p>}

        <button
          className="create-project-button sticky-button"
          onClick={handleCreateProject}
          disabled={uploading}
        >
          {uploading ? (
            <div className="spinner"></div>
          ) : (
            <>
              <span className="button-icon">✛</span> Create your project
            </>
          )}
        </button>
      </main>
    </div>
  );
});

CreateProjectPage.displayName = 'CreateProjectPage';

export default CreateProjectPage;
