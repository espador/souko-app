// JournalOverviewPage.jsx
import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Layout/Header';
import '@fontsource/shippori-mincho';
import { TextGenerateEffect } from '../styles/components/text-generate-effect.tsx';
import '../styles/components/JournalOverviewPage.css';

const JournalOverviewPage = () => {
  const [user, setUser] = useState(null);
  const [journalEntries, setJournalEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Helper function to convert Firestore Timestamp to Date
  const convertTimestamp = (timestamp) => {
    return timestamp && typeof timestamp.toDate === 'function'
      ? timestamp.toDate()
      : null;
  };

  const fetchData = useCallback(async (uid) => {
    setLoading(true);
    try {
      // Removed orderBy from query to avoid issues if createdAt is missing
      const q = query(
        collection(db, 'journalEntries'),
        where('userId', '==', uid)
      );

      const journalSnapshot = await getDocs(q);

      // Map each document to an entry and convert createdAt to a Date
      const fetchedEntries = journalSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt ? convertTimestamp(doc.data().createdAt) : null,
      }));

      // Sort entries locally in descending order by createdAt (most recent first)
      const sortedEntries = fetchedEntries.sort((a, b) => {
        const aTime = a.createdAt ? a.createdAt.getTime() : 0;
        const bTime = b.createdAt ? b.createdAt.getTime() : 0;
        return bTime - aTime;
      });

      setJournalEntries(sortedEntries);
    } catch (error) {
      console.error('Error fetching journal entries:', error.message);
    } finally {
      setLoading(false);
      console.log('Journal Overview Data fetching complete.');
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        navigate('/');
      } else {
        setUser(currentUser);
        fetchData(currentUser.uid);
      }
    });
    return () => unsubscribe();
  }, [navigate, fetchData]);

  const journalEntryCount = journalEntries.length;

  const renderJournalEntriesByMonth = useMemo(() => {
    if (loading) {
      return <p>Loading journal entries...</p>;
    } else if (journalEntries.length > 0) {
      const entriesByMonth = journalEntries.reduce((acc, entry) => {
        if (!entry.createdAt) return acc; // Skip entries without a valid createdAt
        const monthYear = entry.createdAt.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        if (!acc[monthYear]) {
          acc[monthYear] = [];
        }
        acc[monthYear].push(entry);
        return acc;
      }, {});

      return Object.entries(entriesByMonth).map(([monthYear, entries]) => (
        <section key={monthYear} className="month-section">
          <h2 className="month-header">{monthYear}</h2>
          <ul className="journal-entries-list">
            {entries.map((entry) => (
              <li key={entry.id} className="journal-entry-item">
                <div className="entry-date">
                  {entry.createdAt.toLocaleString('en-US', {
                    weekday: 'short',   // e.g., Mon, Tue
                    hour: 'numeric',    // e.g., 18
                    minute: 'numeric',  // e.g., 23
                    second: 'numeric',  // e.g., 27
                    hour12: false,      // 24-hour format
                    day: 'numeric'      // e.g., 27
                  }).replace(/,/g, '.')}
                </div>
                <div className="entry-mood">{entry.mood}</div>
              </li>
            ))}
          </ul>
        </section>
      ));
    } else {
      return <p>No journal entries found.</p>;
    }
  }, [loading, journalEntries]);

  return (
    <div className="journal-overview-container">
      <Header
        variant="journalOverview"
        showBackArrow={true}
        onBack={() => navigate('/home')}
      />
      <section className="motivational-section">
        {!loading && (
          <TextGenerateEffect
            words={`You logged <span class="accent-text">${journalEntryCount} moments</span>. Progress blooms where focus takes root.`}
          />
        )}
      </section>
      <main className="journal-overview-content">
        <section className="journal-entries-section">
          {renderJournalEntriesByMonth}
        </section>
      </main>
    </div>
  );
};

export default JournalOverviewPage;
