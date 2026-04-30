import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { store } from '@/app/store';
import BrandProvider from '@/app/brand';
import App from '@/App';
import { appBasePath, appPath } from '@/app/basePath';
import { PermissionProvider } from '@/components/PermissionContext';
import { NotifierProvider } from '@/components/Notifier';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrandProvider>
        <BrowserRouter basename={appBasePath || undefined}>
          <PermissionProvider>
            <NotifierProvider>
              <App />
            </NotifierProvider>
          </PermissionProvider>
        </BrowserRouter>
      </BrandProvider>
    </Provider>
  </React.StrictMode>,
);

// Register the service worker only in production builds. In dev, Vite already
// owns the network and an SW would interfere with HMR.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(appPath('/sw.js')).catch(() => {
      // Swallow — SW registration is best-effort.
    });
  });
}
