import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import { applyTheme, readTheme } from './app/theme';
import './index.css';
import './styles/github.css';
import './styles/ebook.css';

applyTheme(readTheme());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
