const functions = require("firebase-functions");
const admin = require("firebase-admin");

// date-fns and date-fns-tz
const {
  parseISO,
  differenceInCalendarDays,
  startOfDay
} = require("date-fns");
const { utcToZonedTime } = require("date-fns-tz");

admin.initializeApp();
const db = admin.firestore(); // Get Firestore instance once

/**
 * Triggered whenever a new journal entry is created.
 * Increments or resets the user's streak in their profile.
 */
exports.calculateJournalStreak = functions.firestore
  .document("/journalEntries/{journalEntryId}")
  .onCreate(async (snap, context) => {
    // ... (Your existing calculateJournalStreak function code here) ...
    const newEntry = snap.data();
    const userId = newEntry.userId;

    // Safety check: must have a userId
    if (!userId) {
      functions.logger.error("No userId in journal entry", {
        entryId: context.params.journalEntryId,
      });
      return null;
    }

    try {
      const profileRef = admin.firestore().collection("profiles").doc(userId);
      const profileSnap = await profileRef.get();

      if (!profileSnap.exists) {
        functions.logger.error("No profile for userId", { userId });
        return null;
      }

      const profileData = profileSnap.data();
      let streak = profileData.currentStreak || 0;
      const userTimezone = profileData.timezone || "UTC";

      // 1) Figure out what date the new entry was created (in user's local time)
      //    If there's no `createdAt`, fallback to the Firestore snapshot's createTime.
      const entryTimestamp = newEntry.createdAt
        ? (newEntry.createdAt.toDate && newEntry.createdAt.toDate()) ||
          parseISO(newEntry.createdAt)
        : snap.createTime.toDate();

      const newEntryDate = startOfDay(utcToZonedTime(entryTimestamp, userTimezone));

      // 2) Parse the profile's lastJournalDate (if it exists)
      let lastDate = null;
      if (profileData.lastJournalDate) {
        const parsedLast = parseISO(profileData.lastJournalDate);
        lastDate = startOfDay(utcToZonedTime(parsedLast, userTimezone));
      }

      // 3) Compare newEntryDate vs. lastDate
      if (!lastDate) {
        // First ever entry => streak = 1
        streak = 1;
      } else {
        const dayDifference = differenceInCalendarDays(newEntryDate, lastDate);
        if (dayDifference === 0) {
          // Same day => do nothing
          functions.logger.info("Journal entry is the same day; streak unchanged.");
        } else if (dayDifference === 1) {
          // Next consecutive day => increment
          streak += 1;
        } else {
          // Skipped days => reset to 1
          streak = 1;
        }
      }

      // 4) Update user's profile
      await profileRef.update({
        currentStreak: streak,
        lastJournalDate: newEntryDate.toISOString(),
      });

      functions.logger.info("✅ Streak updated successfully", {
        userId,
        newStreak: streak,
      });
      return null;
    } catch (error) {
      functions.logger.error("❌ Streak calculation error", error, { userId });
      return null;
    }
  });


/**
 * Scheduled function that runs daily at midnight to update total tracked time.
 */
exports.dailyTotalTrackedTimeUpdate = functions.pubsub.schedule('0 0 * * *') // Runs daily at midnight (00:00)
  .timeZone('Europe/Berlin')
  .onRun(async (context) => {
    console.log('Cloud Function dailyTotalTrackedTimeUpdate started at:', new Date().toISOString());

    try {
      const sessionsSnapshot = await db.collection('sessions').get(); // Use the Firestore instance 'db'
      let totalElapsedTime = 0;

      sessionsSnapshot.forEach(doc => {
        const sessionData = doc.data();
        if (sessionData.elapsedTime) {
          totalElapsedTime += sessionData.elapsedTime;
        }
      });

      console.log(`Calculated total elapsed time: ${totalElapsedTime} seconds`);

      // Write to counters > SoukoTime document, field "TotalSoukoTime"
      const totalTimeRef = db.collection('counters').doc('SoukoTime'); // Use 'db'
      await totalTimeRef.set({
        TotalSoukoTime: totalElapsedTime,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      console.log('Total tracked time updated in Firestore under counters > SoukoTime.');
      return null;

    } catch (error) {
      console.error('Error in dailyTotalTrackedTimeUpdate Cloud Function:', error);
      return null;
    }
  });

/**
 * Updates project total time statistics in an aggregated "projectTotals" document
 * instead of individual projectStats documents.
 */
exports.updateProjectTotalTime = functions.firestore
  .document('/sessions/{sessionId}')
  .onWrite(async (change, context) => {
    try {
      // Get the old and new session data
      const oldSession = change.before.exists ? change.before.data() : null;
      const newSession = change.after.exists ? change.after.data() : null;
      
      // We need the user ID to update their aggregated stats
      const userId = (newSession && newSession.userId) || 
                    (oldSession && oldSession.userId);
      
      if (!userId) {
        console.log('No user ID found, skipping update');
        return null;
      }
      
      // Get all sessions for this user
      const sessionsRef = db.collection('sessions');
      const userSessionsQuery = sessionsRef
        .where('userId', '==', userId)
        .where('status', 'in', ['stopped', 'completed']);
      
      const sessionsSnapshot = await userSessionsQuery.get();
      
      // Create a map of project totals
      const projectTotals = {};
      
      sessionsSnapshot.forEach(doc => {
        const session = doc.data();
        if (session.projectId && session.elapsedTime) {
          if (!projectTotals[session.projectId]) {
            projectTotals[session.projectId] = {
              totalTime: 0,
              billableTime: 0
            };
          }
          
          projectTotals[session.projectId].totalTime += session.elapsedTime;
          
          if (session.isBillable) {
            projectTotals[session.projectId].billableTime += session.elapsedTime;
          }
        }
      });
      
      // Store aggregated stats in a single document per user
      const userStatsRef = db.collection('userStats').doc(userId);
      await userStatsRef.set({
        projectTotals: projectTotals,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      
      console.log(`Updated project stats for user ${userId}`);
      return null;
    } catch (error) {
      console.error('Error in updateProjectTotalTime:', error);
      return null;
    }
  });