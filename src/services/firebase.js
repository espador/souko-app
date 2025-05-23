// src/services/firebase.js
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  serverTimestamp, 
  orderBy,
  runTransaction 
} from 'firebase/firestore'; // Added runTransaction
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCvs3XU6C8SCvUZtmjPJPuWMiFoJiDrkCk",
  authDomain: "souko-app.firebaseapp.com",
  projectId: "souko-app",
  storageBucket: "souko-app.firebasestorage.app",
  messagingSenderId: "713268951136",
  appId: "1:713268951136:web:a0f028d39557da4082ab05",
  measurementId: "G-6BBCWYJ3PD"
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

// -------------------- Journal Entry Functions --------------------

// Function to add a new journal entry
const addJournalEntry = async (userId, mood, reflection, futureStep, selectedDate) => {
  try {
    const entryDate = selectedDate ? new Date(selectedDate) : new Date();
    
    // Create the journal entry
    const journalEntryRef = await addDoc(collection(db, 'journalEntries'), {
      userId,
      mood,
      reflection,
      futureStep,
      createdAt: entryDate,
      updatedAt: new Date()
    });
    
    // Update the user's profile with lastJournalDate and increment totalJournalCount
    const profileRef = doc(db, 'profiles', userId);
    
    // Use a transaction to safely update the counter
    await runTransaction(db, async (transaction) => {
      const profileDoc = await transaction.get(profileRef);
      if (!profileDoc.exists()) {
        // Create profile if it doesn't exist
        transaction.set(profileRef, {
          lastJournalDate: entryDate,
          totalJournalCount: 1
        });
      } else {
        // Update existing profile
        const profileData = profileDoc.data();
        transaction.update(profileRef, {
          lastJournalDate: entryDate,
          totalJournalCount: (profileData.totalJournalCount || 0) + 1
        });
      }
    });
    
    return journalEntryRef.id;
  } catch (error) {
    console.error("Error adding journal entry:", error);
    throw error;
  }
};

// Function to update an existing journal entry
const updateJournalEntry = async (journalEntryId, mood, reflection, futureStep) => { // Renamed 'future' to 'futureStep'
  if (!journalEntryId) {
    throw new Error('Journal entry ID is required to update.');
  }

  try {
    const journalEntryRef = doc(db, 'journalEntries', journalEntryId);
    await updateDoc(journalEntryRef, {
      mood: mood,
      reflection: reflection || '',
      futureStep: futureStep || '', // Use 'futureStep' consistently
      lastUpdated: serverTimestamp(), // Added lastUpdated field and set serverTimestamp
    });
    console.log('Journal entry updated with ID:', journalEntryId);
  } catch (error) {
    console.error("Error updating journal entry:", error);
    throw error;
  }
};

// Function to delete a journal entry
const deleteJournalEntry = async (journalEntryId) => {
  try {
    // First get the entry to find the userId
    const entryRef = doc(db, 'journalEntries', journalEntryId);
    const entrySnap = await getDoc(entryRef);
    
    if (entrySnap.exists()) {
      const entryData = entrySnap.data();
      const userId = entryData.userId;
      
      // Delete the entry
      await deleteDoc(entryRef);
      
      // Update the user's profile to decrement totalJournalCount
      const profileRef = doc(db, 'profiles', userId);
      
      // Use a transaction to safely update the counter
      await runTransaction(db, async (transaction) => {
        const profileDoc = await transaction.get(profileRef);
        if (profileDoc.exists()) {
          const profileData = profileDoc.data();
          const currentCount = profileData.totalJournalCount || 0;
          
          // Ensure we don't go below 0
          transaction.update(profileRef, {
            totalJournalCount: Math.max(0, currentCount - 1)
          });
        }
      });
    }
  } catch (error) {
    console.error("Error deleting journal entry:", error);
    throw error;
  }
};

// Function to fetch a journal entry by ID
const fetchJournalEntryById = async (journalEntryId) => {
  if (!journalEntryId) {
    throw new Error('Journal entry ID is required to fetch.');
  }

  try {
    const journalEntrySnap = await getDoc(doc(db, 'journalEntries', journalEntryId));
    if (journalEntrySnap.exists()) {
      return { id: journalEntrySnap.id, ...journalEntrySnap.data() };
    } else {
      console.log("Journal entry not found");
      return null;
    }
  } catch (error) {
    console.error("Error fetching journal entry:", error);
    throw error;
  }
};

// Function to fetch all journal entries for a user
const fetchJournalEntriesForUser = async (userId) => {
  if (!userId) {
    throw new Error('User ID is required to fetch journal entries.');
  }

  try {
    const journalEntriesRef = collection(db, 'journalEntries');
    // const q = query(journalEntriesRef, where('userId', '==', userId), orderBy('timestamp', 'desc')); // Original line - ordering by timestamp which is now createdAt
    const q = query(journalEntriesRef, where('userId', '==', userId), orderBy('createdAt', 'desc')); // Modified to order by createdAt
    const querySnapshot = await getDocs(q);

    const journalEntries = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    console.log('Journal entries fetched for user:', userId);
    return journalEntries;
  } catch (error) {
    console.error("Error fetching journal entries for user:", error);
    throw error;
  }
};

// Function to fetch journal entry by user ID and date
const getJournalEntryByDate = async (userId, date) => {
  if (!userId || !date) {
    throw new Error('User ID and date are required to fetch journal entry by date.');
  }

  try {
    const journalEntriesRef = collection(db, 'journalEntries');
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    console.log("getJournalEntryByDate - userId:", userId); // ADDED LOG
    console.log("getJournalEntryByDate - date (input):", date); // ADDED LOG
    console.log("getJournalEntryByDate - startOfDay:", startOfDay); // ADDED LOG
    console.log("getJournalEntryByDate - endOfDay:", endOfDay); // ADDED LOG

    const q = query(
      journalEntriesRef,
      where('userId', '==', userId),
      where('createdAt', '>=', startOfDay), // Modified to use createdAt
      where('createdAt', '<=', endOfDay)   // Modified to use createdAt
    );

    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const docSnapshot = querySnapshot.docs[0];
      const entryData = { id: docSnapshot.id, ...docSnapshot.data() };
      console.log("getJournalEntryByDate - Entry found:", entryData); // ADDED LOG
      return entryData;
    } else {
      console.log("getJournalEntryByDate - No entry found for date:", date); // ADDED LOG
      return null; // No entry found for the date
    }
  } catch (error) {
    console.error("Error fetching journal entry by date:", error);
    return null;
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
  addJournalEntry,
  updateJournalEntry,
  deleteJournalEntry,
  fetchJournalEntryById,
  fetchJournalEntriesForUser,
  getJournalEntryByDate, // Export the new function
};
