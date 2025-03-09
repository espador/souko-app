const functions = require("firebase-functions");
const admin = require("firebase-admin");

// 1) Import main date-fns methods from 'date-fns'
const {
  parseISO,
  differenceInCalendarDays,
  isSameDay,
  startOfDay
} = require('date-fns');

// 2) Import only time-zone helpers from 'date-fns-tz'
const { utcToZonedTime } = require('date-fns-tz');

admin.initializeApp();

exports.calculateJournalStreak = functions.firestore
  .document("/journalEntries/{journalEntryId}")
  .onWrite(async (change, context) => {
    // Skip if doc was deleted
    if (!change.after.exists) {
      functions.logger.log("Journal entry deleted; skipping streak calculation.");
      return null;
    }

    const newEntry = change.after.data();
    const userId = newEntry.userId;
    if (!userId) {
      functions.logger.error("No userId in journal entry", {
        entryId: context.params.journalEntryId,
      });
      return null;
    }

    const profileRef = admin.firestore().collection("profiles").doc(userId);

    try {
      const profileSnap = await profileRef.get();
      if (!profileSnap.exists) {
        functions.logger.error("No profile for userId", { userId });
        return null;
      }

      const profileData = profileSnap.data();
      let streak = profileData.currentStreak || 0;
      let lastDate = null;
      const userTimezone = profileData.timezone || "UTC";

      // Convert lastJournalDate with parseISO (from date-fns) + utcToZonedTime (from date-fns-tz)
      if (profileData.lastJournalDate) {
        lastDate = utcToZonedTime(
          parseISO(profileData.lastJournalDate),
          userTimezone
        );
      }

      // Query the two most recent journal entries for this user
      const journalRef = admin.firestore().collection("journalEntries");
      const entriesSnap = await journalRef
        .where("userId", "==", userId)
        .orderBy("createdAt", "desc")
        .limit(2)
        .get();

      const entries = [];
      entriesSnap.forEach((doc) => entries.push(doc.data()));

      // Convert newEntry.createdAt => user's timezone => startOfDay
      const newDate = startOfDay(
        utcToZonedTime(newEntry.createdAt.toDate(), userTimezone)
      );

      if (entries.length <= 1) {
        // If this is the user’s only journal entry, set streak to 1
        streak = 1;
        lastDate = newDate;
      } else {
        // Check if it's consecutive
        const latest = entries[0];
        const latestDate = startOfDay(
          utcToZonedTime(latest.createdAt.toDate(), userTimezone)
        );

        functions.logger.log("📅 Entry Dates:", {
          latestDate: latestDate.toISOString(),
          newEntryDate: newDate.toISOString(),
          userTimezone,
        });

        const dayDifference = differenceInCalendarDays(newDate, latestDate);

        if (dayDifference === 1) {
          // Consecutive day => increment streak
          streak++;
        } else if (isSameDay(newDate, latestDate)) {
          // Same day => do nothing
          functions.logger.log(
            "Journal entry is within the same day, keeping streak."
          );
        } else {
          // Not consecutive => reset
          streak = 0;
          functions.logger.log(
            "Journal entry is NOT consecutive, resetting streak to 0."
          );
        }
        lastDate = newDate;
      }

      // Finally, update the user's profile with the new streak
      const update = {
        currentStreak: streak,
        lastJournalDate: lastDate.toISOString(),
      };

      await profileRef.update(update);
      functions.logger.log("✅ Streak updated successfully:", {
        userId,
        newStreak: streak,
      });

      return null;
    } catch (error) {
      functions.logger.error("❌ Streak calculation error", error, { userId });
      return null;
    }
  });
