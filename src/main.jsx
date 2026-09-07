/**
 * Application entry point.
 *
 * Loads the runtime config before the first render so the axios client always
 * has a base URL.
 *
 * @module main
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import 'react-datasheet-grid/dist/style.css';
import './styles/app.css';
import { loadConfig } from './api/config.js';
import { AuthProvider } from './context/AuthContext.jsx';
import App from './App.jsx';

loadConfig().then(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </StrictMode>,
  );
});
