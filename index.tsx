import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initServices } from './services/initServices';

// Initialize services with app-specific config
initServices();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);