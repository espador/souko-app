const functions = require("firebase-functions");
const admin = require("firebase-admin");
const dateFns = require("date-fns-tz");

admin.initializeApp();

exports.calculateJournalStreak = functions.firestore
    .document("/journalEntries/{journalEntryId}")
    .onCreate(async (snap, context) => {
      const newEntry = snap.data();
      const userId = newEntry.userId;

      if (!userId) {
        functions.logger.error("No userId in new journal entry", { entryId: context.params.journalEntryId });
        return null;
      }

      const profileRef = admin.firestore().collection("profiles").doc(userId);
      const journalRef = admin.firestore().collection("journalEntries");

      try {
        const profileSnap = await profileRef.get();
        if (!profileSnap.exists) {
          functions.logger.error("No profile for userId", { userId });
          return null;
        }

        const profileData = profileSnap.data();
        let streak = profileData.journalStreak || 0;
        let lastDate = null;
        let userTimezone = profileData.timezone || "UTC";

        if (profileData.lastJournalDate) {
          lastDate = dateFns.utcToZonedTime(dateFns.parseISO(profileData.lastJournalDate), userTimezone);
        }

        const query = journalRef
            .where("userId", "==", userId)
            .orderBy("createdAt", "desc")
            .limit(2);

        const entriesSnap = await query.get();
        const entries = [];
        entriesSnap.forEach((doc) => entries.push(doc.data()));

        // Convert new entry timestamp to user's timezone
        const newDate = dateFns.startOfDay(dateFns.utcToZonedTime(newEntry.createdAt.toDate(), userTimezone));

        if (entries.length <= 1) {
          streak = 1;
          lastDate = newDate;
        } else {
          const latest = entries[0];
          const latestDate = dateFns.startOfDay(dateFns.utcToZonedTime(latest.createdAt.toDate(), userTimezone));

          functions.logger.log("📅 Entry Dates:", {
            latestDate: latestDate.toISOString(),
            newEntryDate: newDate.toISOString(),
            userTimezone
          });

          if (dateFns.differenceInCalendarDays(newDate, latestDate) === 1) {
            streak++; // Entry is on the next calendar day
          } else if (dateFns.isSameDay(newDate, latestDate)) {
            functions.logger.log("Journal entry is within the same day, keeping streak.");
          } else {
            functions.logger.log("Journal entry is NOT consecutive, resetting streak.");
            streak = 1; // Reset streak if entry is not consecutive
          }

          lastDate = newDate;
        }

        const update = {
          journalStreak: streak,
          lastJournalDate: lastDate.toISOString(),
        };

        await profileRef.update(update);
        functions.logger.log("✅ Streak updated successfully:", { userId, newStreak: streak });

        // 🔥 **Force re-fetch to ensure the updated value is written**
        const updatedProfileSnap = await profileRef.get();
        const updatedProfileData = updatedProfileSnap.data();
        functions.logger.log("🔄 Post-update profile check:", updatedProfileData);

        return null;
      } catch (error) {
        functions.logger.error("❌ Streak calculation error", error, { userId });
        return null;
      }
    });
