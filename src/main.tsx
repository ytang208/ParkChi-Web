import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import ParkChiApp from '../app/ParkChiApp';
import '../app/globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ParkChiApp />
  </StrictMode>,
);
