// src/utils/logEvent.js
import { db, auth } from '../services/firebase'; // Corrected import path to services - NOW points to services correctly
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const logEvent = async (eventName, eventDetails) => {
  try {
    const user = auth.currentUser;
    const logsCollection = collection(db, 'appLogs'); // Collection name for logs

    await addDoc(logsCollection, {
      userId: user ? user.uid : 'anonymous', // Log user ID or 'anonymous' if not logged in
      timestamp: serverTimestamp(), // Firebase server timestamp
      eventName: eventName,
      eventDetails: eventDetails,
    });

    console.log(`Event "${eventName}" logged successfully.`);
  } catch (error) {
    console.error('Error logging event:', eventName, error);
    // You might want to handle error logging more robustly in a production app
  }
};

export default logEvent;