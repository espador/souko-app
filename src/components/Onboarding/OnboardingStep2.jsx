// src/components/Onboarding/OnboardingStep2.jsx
import React, { useState, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../Layout/Header';
import './OnboardingStep2.css';

// Removed unused imports from 'firebase/storage'
// import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

import { TextGenerateEffect } from '../../styles/components/text-generate-effect.tsx';

// Reuse your icons...
import { ReactComponent as UploadFileIcon } from '../../styles/components/assets/uploadfile.svg';
import { ReactComponent as BillableIcon } from '../../styles/components/assets/billable.svg';
import { ReactComponent as EuroIcon } from '../../styles/components/assets/euro.svg';
import { ReactComponent as DollarIcon } from '../../styles/components/assets/dollar.svg';

// Import the context
import { useOnboardingContext } from '../../contexts/OnboardingContext';

const MAX_FILE_SIZE_KB = 2048; // 2MB
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_KB * 1024;
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/gif'];
const MAX_IMAGE_WIDTH = 5000;
const MAX_IMAGE_HEIGHT = 5000;
const TARGET_IMAGE_WIDTH = 164;
const TARGET_IMAGE_HEIGHT = 164;
const COMPRESSION_QUALITY = 0.5;

function OnboardingStep2() {
  const navigate = useNavigate();

  // Pull from context
  const {
    projectName,
    setProjectName,
    hourRate,
    setHourRate,
    currencyId,
    setCurrencyId,
    projectImage,
    setProjectImage,
  } = useOnboardingContext();

  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const projectNameInputRef = useRef(null);
  const hourRateInputRef = useRef(null);
  // Removed uploading state because it's not used here

  // Compress the image using a canvas
  const compressImage = useCallback(
    async (file) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

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
            'image/jpeg',
            COMPRESSION_QUALITY
          );
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
      });
    },
    []
  );

  const handleImageUploadClick = useCallback(() => {
    fileInputRef.current.click();
  }, []);

  const handleImageChange = useCallback(
    async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        alert(`Please select a valid image file type: ${ALLOWED_FILE_TYPES.join(', ')}`);
        event.target.value = '';
        return;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        alert(`Image size should be less than ${MAX_FILE_SIZE_KB} KB.`);
        event.target.value = '';
        return;
      }

      const img = new Image();
      img.onload = async () => {
        if (img.width > MAX_IMAGE_WIDTH || img.height > MAX_IMAGE_HEIGHT) {
          alert(`Image dimensions should not exceed ${MAX_IMAGE_WIDTH}x${MAX_IMAGE_HEIGHT} pixels.`);
          setProjectImage(null);
          event.target.value = '';
          return;
        }
        try {
          const compressedImageFile = await compressImage(file);
          setProjectImage(compressedImageFile); // store in context
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
    },
    [compressImage, setProjectImage]
  );

  const getInitials = useCallback(
    (name) => name.trim().charAt(0).toUpperCase(),
    []
  );

  const memoizedProjectImage = useMemo(() => {
    if (projectImage && typeof projectImage !== 'string') {
      return <img src={URL.createObjectURL(projectImage)} alt="Project" className="project-image" />;
    } else if (projectImage && typeof projectImage === 'string') {
      return <img src={projectImage} alt="Project" className="project-image" />;
    } else {
      return (
        <div className="default-project-image" style={{ backgroundColor: '#7B7BFF' }}>
          <span>{getInitials(projectName || 'P')}</span>
        </div>
      );
    }
  }, [projectImage, projectName, getInitials]);

  const handleCurrencyToggle = useCallback(() => {
    setCurrencyId((prev) => (prev === 'euro' ? 'dollar' : 'euro'));
  }, [setCurrencyId]);

  // Instead of creating the doc, just validate and store data in context, then move to Step3
  const handleNextStep = useCallback(
    async (e) => {
      e.preventDefault();
      if (!projectName.trim()) {
        setError('Project name is required.');
        return;
      }

      // Just store everything in context
      setError('');
      navigate('/onboarding/step3');
    },
    [projectName, navigate]
  );

  return (
    <div className="onboarding-step2">
      <Header variant="onboarding" currentStep={2} />
      <main className="onboarding-step2-content">
        <section className="motivational-section">
          <TextGenerateEffect
            words={`Every journey\nbegins with one\nmoment.\nTell me about your project ...`}
            element="h1"
          />
        </section>
        <section className="project-details-section">
          <h2>Project details</h2>
          <div className="project-input-wrapper">
            <div className="project-image-container" onClick={handleImageUploadClick}>
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
            <button type="button" className="icon-button" onClick={handleImageUploadClick}>
              <UploadFileIcon />
            </button>
          </div>

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
            <button type="button" className="icon-button" onClick={handleCurrencyToggle}>
              {currencyId === 'euro' ? <EuroIcon /> : <DollarIcon />}
            </button>
          </div>
        </section>

        {error && <p className="error-message">{error}</p>}
      </main>

      <button
        className="create-project-button sticky-button"
        onClick={handleNextStep}
      >
        <span className="button-icon">✛</span> Next
      </button>
    </div>
  );
}

export default OnboardingStep2;
