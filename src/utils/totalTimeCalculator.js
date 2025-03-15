// totalTimeCalculator.js
import { db } from '../services/firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  runTransaction 
} from 'firebase/firestore';

const calculateTotalTime = async () => {
  try {
    // Get all sessions
    const sessionsSnapshot = await getDocs(collection(db, 'sessions'));
    
    // Calculate total elapsed time in seconds
    let totalSeconds = 0;
    
    sessionsSnapshot.forEach((doc) => {
      const sessionData = doc.data();
      if (sessionData.elapsedTime) {
        totalSeconds += sessionData.elapsedTime;
      }
    });

    // Store the total time in the counters collection
    const soukoTimeRef = doc(db, 'counters', 'SoukoTime');
    
    await runTransaction(db, async (transaction) => {
      // Update the total time
      await setDoc(soukoTimeRef, {
        totalSeconds: totalSeconds,
        lastUpdated: new Date().toISOString()
      });
    });

    console.log('Total time updated successfully:', totalSeconds);
    return totalSeconds;

  } catch (error) {
    console.error('Error calculating total time:', error);
    throw error;
  }
};

// Helper function to format seconds into "xxh xxm" format
export const formatTotalTime = (totalSeconds) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
};

// Function to get formatted total time
export const getFormattedTotalTime = async () => {
  try {
    const soukoTimeRef = doc(db, 'counters', 'SoukoTime');
    const soukoTimeDoc = await getDoc(soukoTimeRef);
    
    if (soukoTimeDoc.exists()) {
      const { totalSeconds } = soukoTimeDoc.data();
      return formatTotalTime(totalSeconds);
    }
    
    // If document doesn't exist, calculate it first
    const totalSeconds = await calculateTotalTime();
    return formatTotalTime(totalSeconds);
  } catch (error) {
    console.error('Error getting formatted total time:', error);
    return '0h 0m'; // Default fallback
  }
};

export default calculateTotalTime;
