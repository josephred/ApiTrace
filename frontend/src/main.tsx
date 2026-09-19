import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AuthProvider } from './lib/auth';
import { SyncProvider } from './lib/sync';
import { ThemeProvider } from './lib/theme';
import { HelpProvider } from './lib/helpContext';
import { SettingsProvider } from './lib/settingsContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/ui';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <HelpProvider>
        <SettingsProvider>
          <ErrorBoundary>
            <BrowserRouter>
              <AuthProvider>
                <SyncProvider>
                  <ToastProvider>
                    <App />
                  </ToastProvider>
                </SyncProvider>
              </AuthProvider>
            </BrowserRouter>
          </ErrorBoundary>
        </SettingsProvider>
      </HelpProvider>
    </ThemeProvider>
  </StrictMode>,
);
