// src/firebase/firebase.js
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
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

// In-memory cache for fetched projects to reduce reads
const projectCache = new Map();

// Function to fetch user-specific projects with caching
const fetchUserProjects = async (userId, forceRefresh = false) => {
  if (!userId) {
    throw new Error('User ID is required to fetch projects.');
  }

  // Check the cache first
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

    // Cache the result
    projectCache.set(userId, projects);

    console.log('Projects fetched and cached for user:', userId);
    return projects;
  } catch (error) {
    console.error("Error fetching user projects:", error);
    throw error;
  }
};

// Example integration where a forced refresh might be needed
const refreshUserProjects = async (userId) => {
  try {
    console.log("Refreshing projects for user", userId);
    const projects = await fetchUserProjects(userId, true); // Force refresh
    console.log("Refreshed projects:", projects);
  } catch (error) {
    console.error("Error refreshing user projects:", error);
  }
};

export { auth, googleProvider, db, fetchUserProjects, refreshUserProjects, app };
