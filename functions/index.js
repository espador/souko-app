const functions = require("firebase-functions");
const admin = require("firebase-admin");
const dateFns = require("date-fns");

admin.initializeApp();

exports.calculateJournalStreak = functions.firestore
    .document("/journalEntries/{journalEntryId}")
    .onCreate(async (snap, context) => {
      const newEntry = snap.data();
      const userId = newEntry.userId;

      if (!userId) {
        functions.logger.error(
            "No userId in new journal entry",
            {entryId: context.params.journalEntryId},
        );
        return null;
      }

      const profileRef = admin
          .firestore()
          .collection("profiles")
          .doc(userId);

      const journalRef = admin
          .firestore()
          .collection("journalEntries");

      try {
        const profileSnap = await profileRef.get();
        if (!profileSnap.exists) {
          functions.logger.error(
              "No profile for userId",
              {userId: userId},
          );
          return null;
        }

        const profileData = profileSnap.data();
        let streak = profileData.journalStreak || 0;
        let lastDate = null;

        if (profileData.lastJournalDate) {
          lastDate = dateFns.parseISO(
              profileData.lastJournalDate,
          );
        }

        const query = journalRef
            .where("userId", "==", userId)
            .orderBy("createdAt", "desc")
            .limit(2);

        const entriesSnap = await query.get();

        const entries = [];
        entriesSnap.forEach((doc) => {
          entries.push(doc.data());
        });

        if (entries.length <= 1) {
          streak = 1;
          lastDate = dateFns.startOfDay(
              newEntry.createdAt.toDate(),
          );
        } else {
          const latest = entries[0];
          const previous = entries[1];

          const latestDate = dateFns.startOfDay(
              latest.createdAt.toDate(),
          );
          const previousDate = dateFns.startOfDay(
              previous.createdAt.toDate(),
          );
          const newDate = dateFns.startOfDay(
              newEntry.createdAt.toDate(),
          );

          if (
            dateFns.differenceInDays(
                latestDate,
                previousDate,
            ) === 1
          ) {
            streak++;
            lastDate = newDate;
          } else if (
            dateFns.differenceInDays(
                latestDate,
                previousDate,
            ) === 0
          ) {
            lastDate = newDate;
          } else {
            if (
              dateFns.differenceInDays(
                  latestDate,
                  newDate,
              ) !== 0
            ) {
              streak = 1;
              lastDate = newDate;
            } else {
              lastDate = newDate;
            }
          }
        }

        const update = {
          journalStreak: streak,
          lastJournalDate: lastDate.toISOString(),
        };

        await profileRef.update(update);

        const logData = {userId, newStreak: streak};
        functions.logger.log("Streak updated", logData);

        return null;
      } catch (error) {
        functions.logger.error(
            "Streak error",
            error,
            {userId},
        );
        return null;
      }
    });
