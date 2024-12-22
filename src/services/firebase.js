// src/firebase/firebase.js
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCvs3XU6C8SCvUZtmjPJPuWMiFoJiDrkCk",
  authDomain: "souko-app.firebaseapp.com",
  projectId: "souko-app",
  storageBucket: "souko-app.firebasestorage.app",
  messagingSenderId: "713268951136",
  appId: "1:713268951136:web:a0f028d39557da4082ab05",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// In-memory cache for fetched projects
const projectCache = new Map();

// Function to fetch projects for a user
const fetchUserProjects = async (userId, forceRefresh = false) => {
  if (!userId) {
    throw new Error('User ID is required to fetch projects.');
  }

  // Check cache
  if (!forceRefresh && projectCache.has(userId)) {
    console.log('Returning cached projects for user:', userId);
    return projectCache.get(userId);
  }

  try {
    const projectsRef = collection(db, 'projects');
    const q = query(projectsRef, where('userId', '==', userId));
    const querySnapshot = await getDocs(q);

    const projects = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Update cache
    projectCache.set(userId, projects);

    console.log('Projects fetched and cached for user:', userId);
    return projects;
  } catch (error) {
    console.error("Error fetching user projects:", error);
    throw error;
  }
};

// Function to fetch sessions for a project
const fetchProjectSessions = async (projectName, userId) => {
  if (!projectName || !userId) {
    throw new Error('Project name and user ID are required to fetch sessions.');
  }

  try {
    const sessionsRef = collection(db, 'sessions');
    const q = query(sessionsRef, where('project', '==', projectName), where('userId', '==', userId));
    const querySnapshot = await getDocs(q);

    const sessions = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    console.log('Sessions fetched for project:', projectName, sessions);
    return sessions;
  } catch (error) {
    console.error("Error fetching project sessions:", error);
    throw error;
  }
};

// Function to add a project
const addProject = async (name, userId) => {
  if (!name || !userId) {
    throw new Error('Project name and user ID are required to add a project.');
  }

  try {
    const docRef = await addDoc(collection(db, 'projects'), {
      name,
      userId,
      trackedTime: 0, // Default tracked time
    });
    console.log('Project added with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Error adding project:", error);
    throw error;
  }
};

// Function to add a session
const addSession = async (userId, project, elapsedTime, startTime, endTime, isBillable, sessionNotes) => {
  if (!userId || !project) {
    throw new Error('User ID and project name are required to add a session.');
  }

  try {
    const docRef = await addDoc(collection(db, 'sessions'), {
      userId,
      project,
      elapsedTime: elapsedTime || 0,
      startTime: startTime ? new Date(startTime) : null,
      endTime: endTime ? new Date(endTime) : null,
      isBillable: isBillable || false,
      sessionNotes: sessionNotes || '',
    });
    console.log('Session added with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Error adding session:", error);
    throw error;
  }
};

// Function to refresh project cache
const refreshUserProjects = async (userId) => {
  try {
    console.log("Refreshing projects for user:", userId);
    const projects = await fetchUserProjects(userId, true); // Force refresh
    console.log("Refreshed projects:", projects);
    return projects;
  } catch (error) {
    console.error("Error refreshing user projects:", error);
    throw error;
  }
};

export {
  auth,
  googleProvider,
  db,
  fetchUserProjects,
  fetchProjectSessions,
  addProject,
  addSession,
  refreshUserProjects,
  app,
};
