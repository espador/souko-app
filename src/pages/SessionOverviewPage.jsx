import React, { useCallback, useMemo } from 'react';
import { formatTime } from '../utils/formatTime';
import '../styles/global.css';
import '../styles/components/SessionOverviewPage.css';
import { TextGenerateEffect } from "../styles/components/text-generate-effect.tsx";
import Header from '../components/Layout/Header'; // Import Header


const SessionOverviewPage = React.memo(({ navigate, totalTime, projectId }) => { // <-- Receive navigate, totalTime, projectId props


    const formattedTime = useMemo(() => formatTime(totalTime), [totalTime]);


    const handleStartNewSession = useCallback(() => {
        navigate('time-tracker'); // <-- Use navigate prop, page name as string
    }, [navigate]);


    const handleReturnHome = useCallback(() => {
        navigate('home'); // <-- Use navigate prop, page name as string
    }, [navigate]);


    const handleOpenProjectDetails = useCallback(() => {
        if (projectId) {
            navigate('project-detail', { projectId: projectId }); // <-- Use navigate prop, page name as string, pass projectId param
        } else {
            console.warn("Project ID not available to open details.");
        }
    }, [navigate, projectId]);


    const handleShare = useCallback(() => {
        // This button is currently disabled
        console.log("Share functionality is disabled."); // Log when share is attempted
    }, []);


    return (
        <div className="session-overview-page">
            <Header // Add Header component here
                variant="journalOverview"
                showBackArrow={true}
                navigate={navigate} // <-- Pass navigate prop to Header
            />
            <section className="motivational-section">
                <TextGenerateEffect
                    words={`For <span class="accent-text">${formattedTime}</span>, you lived the\n now! Honoring the simplicity\n of being.`}
                />
            </section>


            <div className="overview-actions sticky-button">
                <button className="button secondary-button" onClick={handleStartNewSession}>
                    Start a new session
                </button>
                <button className="button secondary-button" onClick={handleReturnHome}>
                    Return home
                </button>
                <button className="button secondary-button disabled" disabled onClick={handleShare}>
                    Share
                </button>
            </div>
        </div>
    );
});


SessionOverviewPage.displayName = 'SessionOverviewPage'; // For React.memo


export default SessionOverviewPage;