// UpdateProjectPage.jsx
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { doc, getDoc, updateDoc, deleteDoc, collection, deleteDoc as deleteDocFirestore, getDocs, query, where } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '../components/Layout/Header';
import '../styles/components/UpdateProjectPage.css';

// Existing icons
import { ReactComponent as EditIcon } from '../styles/components/assets/edit.svg';
import { ReactComponent as BillableIcon } from '../styles/components/assets/billable.svg';
// New icons for update and delete actions:
import { ReactComponent as UpdateButtonIcon } from '../styles/components/assets/updatebutton.svg';
import { ReactComponent as EraseIcon } from '../styles/components/assets/erase.svg';

const MAX_FILE_SIZE_KB = 2048;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_KB * 2048;
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/gif'];
const MAX_IMAGE_WIDTH = 5000;
const MAX_IMAGE_HEIGHT = 5000;
const TARGET_IMAGE_WIDTH = 164;
const TARGET_IMAGE_HEIGHT = 164;
const COMPRESSION_QUALITY = 0.5;

const UpdateProjectPage = React.memo(() => {
  const { projectId } = useParams();
  const [projectName, setProjectName] = useState('');
  const [hourRate, setHourRate] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [projectImage, setProjectImage] = useState(null);
  const fileInputRef = useRef(null);
  const projectNameInputRef = useRef(null);
  const hourRateInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false); // For delete confirmation
  const [initialProjectName, setInitialProjectName] = useState('');
  const [initialHourRate, setInitialHourRate] = useState('');
  const [initialProjectImage, setInitialProjectImage] = useState(null);
  const [isSaveActive, setIsSaveActive] = useState(false);


  useEffect(() => {
    const fetchProject = async () => {
      try {
        console.log("UpdateProjectPage.jsx: Fetching project with projectId:", projectId); // Debug log
        console.log("UpdateProjectPage.jsx: Current user:", auth.currentUser); // Debug log - Check authentication

        if (!auth.currentUser) {
          setError('User not authenticated. Please sign in.'); // More specific error
          return;
        }

        const projectDoc = doc(db, 'projects', projectId);
        const docSnap = await getDoc(projectDoc);

        if (docSnap.exists()) {
          const projectData = docSnap.data();
          console.log("UpdateProjectPage.jsx: Project data fetched:", projectData); // Debug log - See fetched data
          setProjectName(projectData.name);
          setHourRate(projectData.hourRate ? String(projectData.hourRate) : '');
          setProjectImage(projectData.imageUrl || null);
          setInitialProjectName(projectData.name);
          setInitialHourRate(projectData.hourRate ? String(projectData.hourRate) : '');
          setInitialProjectImage(projectData.imageUrl || null);
        } else {
          setError('Project not found.');
        }
      } catch (err) {
        console.error('UpdateProjectPage.jsx: Error fetching project:', err);
        setError('Failed to load project details.');
      }
    };

    fetchProject();
  }, [projectId]);

  useEffect(() => {
    const hasChanged =
      projectName !== initialProjectName ||
      hourRate !== initialHourRate ||
      projectImage !== initialProjectImage; // Simple comparison, might need deeper check for file objects if needed
    setIsSaveActive(hasChanged);
  }, [projectName, hourRate, projectImage, initialProjectName, initialHourRate, initialProjectImage]);


  const compressImage = useCallback(async (file) => {
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
  }, []);

  const handleUpdateProject = useCallback(async (e) => {
    e.preventDefault();

    if (!projectName.trim()) {
      setError('Project name is required.');
      return;
    }

    try {
      const projectDocRef = doc(db, 'projects', projectId);
      const projectSnap = await getDoc(projectDocRef);
      let currentProjectData = projectSnap.data();
      let imageUrl = currentProjectData.imageUrl;

      if (projectImage && typeof projectImage !== 'string' && projectImage !== currentProjectData.imageUrl) {
        setUploading(true);
        const storage = getStorage();

        // Delete old image if it exists and is not a default image.
        if (imageUrl && !imageUrl.startsWith('default-')) {
          const imageRef = ref(storage, imageUrl);
          try {
            await deleteObject(imageRef);
            console.log('Old image deleted');
          } catch (deleteError) {
            console.error('Error deleting old image:', deleteError);
          }
        }

        const storageRef = ref(storage, `project-images/${auth.currentUser.uid}/${projectName}-${Date.now()}`);
        const uploadTask = uploadBytesResumable(storageRef, projectImage);

        await new Promise((resolve, reject) => {
          uploadTask.on('state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              console.log('Upload is ' + progress.toFixed(2) + '% done');
            },
            (error) => {
              setUploading(false);
              setError('Failed to upload new image.');
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

      await updateDoc(projectDocRef, {
        name: projectName.trim(),
        imageUrl: imageUrl,
        hourRate: hourRate ? parseInt(hourRate, 10) : 0,
      });

      navigate(-1); // Navigate to the previous page
    } catch (err) {
      setUploading(false);
      console.error('Error updating project:', err);
      setError('Failed to update the project. Please try again.');
    }
  }, [projectId, projectName, projectImage, navigate, hourRate]);

  const handleDeleteProject = useCallback(async () => {
    setIsDeleteDialogOpen(true);
  }, []);

  const confirmDeleteProject = useCallback(async () => {
    setIsDeleteDialogOpen(false);
    try {
      const projectDocRef = doc(db, 'projects', projectId);
      const projectSnap = await getDoc(projectDocRef);
      const projectData = projectSnap.data();
      const imageUrl = projectData.imageUrl;
      if (imageUrl && !imageUrl.startsWith('default-')) {
        const storage = getStorage();
        const imageRef = ref(storage, imageUrl);
        try {
          await deleteObject(imageRef);
          console.log('Project image deleted from storage');
        } catch (deleteError) {
          console.error('Error deleting project image from storage:', deleteError);
        }
      }

      // Delete related sessions.
      const sessionsQuery = query(collection(db, 'sessions'), where('projectId', '==', projectId));
      const sessionsSnapshot = await getDocs(sessionsQuery);
      const batch = db.batch();
      sessionsSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log('Related sessions deleted');

      await deleteDocFirestore(projectDocRef);
      navigate('/home');
    } catch (err) {
      console.error('Error deleting project:', err);
      setError('Failed to delete the project.');
    }
  }, [projectId, navigate]);

  const cancelDeleteProject = useCallback(() => {
    setIsDeleteDialogOpen(false);
  }, []);

  const handleImageUploadClick = useCallback(() => {
    fileInputRef.current.click();
  }, []);

  const handleImageChange = useCallback(async (event) => {
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

  return (
    <div className="update-project-page">
      <Header
              variant="journalOverview"
              showBackArrow={true}
            />
      <main className="update-project-content">
        <section className="motivational-section">
          <h1>
            Precision fuels progress set it up
            <span style={{ color: 'var(--accent-color)' }}> your way.</span>
          </h1>
        </section>
        <section className="project-details-section">
          <h2>Project details</h2>
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
            <div className="edit-icon-container">
              <EditIcon className="edit-icon" />
            </div>
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
            <div className="edit-icon-container">
              <EditIcon className="edit-icon" />
            </div>
          </div>
        </section>

        {error && <p className="error-message">{error}</p>}

        <button
          className={`update-project-button sticky-button-top ${!isSaveActive ? 'disabled' : ''}`}
          onClick={handleUpdateProject}
          disabled={uploading || !isSaveActive}
        >
          {uploading ? (
            <div className="spinner"></div>
          ) : (
            <>
              <UpdateButtonIcon className="button-icon" />
              Update Project
            </>
          )}
        </button>
        <button
          className="delete-project-button sticky-button"
          onClick={handleDeleteProject}
        >
          <EraseIcon className="button-icon" />
          Delete Project
        </button>

        {/* Delete Confirmation Dialog */}
        {isDeleteDialogOpen && (
          <div className="delete-confirmation-dialog">
            <p>Are you sure you want to delete this project and all its sessions?</p>
            <div className="dialog-buttons">
              <button onClick={confirmDeleteProject} className="confirm-delete">Yes, Delete</button>
              <button onClick={cancelDeleteProject} className="cancel-delete">Cancel</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
});

UpdateProjectPage.displayName = 'UpdateProjectPage';

export default UpdateProjectPage;