import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/global.css';
import App from './App';
// import * as serviceWorkerRegistration from './serviceWorkerRegistration'; // Import the service worker registration
// serviceWorkerRegistration.register(); // Register the service worker
const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register the service worker
serviceWorkerRegistration.register();

// If you want to unregister the service worker (for development or specific reasons), you can use:
// serviceWorkerRegistration.unregister();