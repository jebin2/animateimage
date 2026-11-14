import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// The app used to have accounts and credits; clear what that version left in
// this browser (sign-in tokens, anonymous id, usage events).
try {
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith('animateimage_') || k === 'use_credits_preference') localStorage.removeItem(k);
  }
  for (const db of ['animateimage_user', 'animateimage_events', 'animateimage_videos', 'animateimage_storage']) indexedDB.deleteDatabase(db);
  document.cookie = 'animateimage_userid=; Max-Age=0; path=/';
} catch { /* storage blocked: nothing to clear */ }

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element to mount to");

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
