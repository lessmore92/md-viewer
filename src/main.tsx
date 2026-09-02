import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import { applyTheme, readDarkPreference } from './app/theme';
import './index.css';
import './styles/github.css';

applyTheme(readDarkPreference());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
