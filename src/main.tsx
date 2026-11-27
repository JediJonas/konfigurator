import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { openSavedProject } from './app/storage/openProject';
import { App } from './app/ui/App';
import './app/ui/app.css';

const container = document.getElementById('root');
if (!container) throw new Error('Saknar #root i index.html');
const root = createRoot(container);
// Det sparade huset läses in före första ritningen, så att mallen inte syns först.
void openSavedProject().finally(() =>
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
);
