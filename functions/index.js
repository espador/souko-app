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

/**
 * Triggered whenever a new journal entry is created.
 * Increments or resets the user’s streak in their profile.
 */
exports.calculateJournalStreak = functions.firestore
  .document("/journalEntries/{journalEntryId}")
  .onCreate(async (snap, context) => {
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

      // 1) Figure out what date the new entry was created (in user’s local time)
      //    If there’s no `createdAt`, fallback to the Firestore snapshot’s createTime.
      const entryTimestamp = newEntry.createdAt
        ? (newEntry.createdAt.toDate && newEntry.createdAt.toDate()) ||
          parseISO(newEntry.createdAt)
        : snap.createTime.toDate();

      const newEntryDate = startOfDay(utcToZonedTime(entryTimestamp, userTimezone));

      // 2) Parse the profile’s lastJournalDate (if it exists)
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

      // 4) Update user’s profile
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
