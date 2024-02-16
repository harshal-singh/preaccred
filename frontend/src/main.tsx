// eslint-disable import/no-extraneous-dependencies
import {
  FluentProvider,
  webLightTheme,
  teamsLightTheme,
} from '@fluentui/react-components';
import {
  init,
  BrowserTracing,
  reactRouterV6Instrumentation,
  replayIntegration,
} from '@sentry/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getAnalytics } from 'firebase/analytics';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { StrictMode, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import {
  BrowserRouter,
  useLocation,
  useNavigationType,
  createRoutesFromChildren,
  matchRoutes,
} from 'react-router-dom';

import ToastProvider from 'components/ToastProvider';

import App from './App';

const firebaseConfig = {
  apiKey: 'AIzaSyAnWpvVym7Wc3Y3GDTrYjgQnIzMWpqEkEo',
  authDomain: 'preaccred.firebaseapp.com',
  projectId: 'preaccred',
  storageBucket: 'preaccred.appspot.com',
  messagingSenderId: '191413765846',
  appId: '1:191413765846:web:8ae1b8677cdf4ee1ca6b77',
  measurementId: 'G-S408HQY3H7',
};

const app = initializeApp(firebaseConfig);
console.log('🚀 ~ app:', app);
// const auth = getAuth(app);
// const analytics = getAnalytics(app);

init({
  dsn: 'https://33997dba42dc2891b29b6b853caf0608@o4506715734147072.ingest.sentry.io/4506715738406912',
  integrations: [
    new BrowserTracing({
      routingInstrumentation: reactRouterV6Instrumentation(
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      ),
    }),
    replayIntegration(),
  ],
  // Performance Monitoring
  tracesSampleRate: 1,
  // Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
});

const queryClient = new QueryClient();

ReactDOM.createRoot(document.querySelector('#root')!).render(
  <StrictMode>
    <FluentProvider theme={teamsLightTheme}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ToastProvider>
      </QueryClientProvider>
    </FluentProvider>
  </StrictMode>,
);
