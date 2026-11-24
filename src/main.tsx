import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/ui/App';
import './app/ui/app.css';

const container = document.getElementById('root');
if (!container) throw new Error('Saknar #root i index.html');
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
