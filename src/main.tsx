import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { GlobalErrorBoundary } from './components/common/GlobalErrorBoundary';
import { performanceMonitor } from './services/performanceMonitor';
import { initDeviceCapabilities } from './utils/deviceCapabilities';
import './index.css';

// Recover automatically from stale chunk hashes when a new production build is deployed
if (typeof window !== 'undefined') {
  initDeviceCapabilities();
  performanceMonitor.initWebVitalsObserver();
  performanceMonitor.initGlobalErrorTracking();
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    const reloadKey = 'theunbound_chunk_preload_recovery';
    const lastReload = sessionStorage.getItem(reloadKey);
    const now = Date.now();
    if (!lastReload || now - Number(lastReload) > 10000) {
      sessionStorage.setItem(reloadKey, String(now));
      window.location.reload();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  </StrictMode>,
);
