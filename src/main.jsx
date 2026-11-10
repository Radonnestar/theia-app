import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import './index.css';
import App from './App.jsx';

// No <StrictMode>: the WebGL context must be created exactly once.
createRoot(document.getElementById('root')).render(<App />);
