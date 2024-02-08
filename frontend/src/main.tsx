import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import {
  init,
  BrowserTracing,
  Replay,
  reactRouterV6Instrumentation,
} from '@sentry/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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

init({
  dsn: 'https://aded0bfdf2b271208b6b64cee955b37e@o4506389227110400.ingest.sentry.io/4506389232615424',
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
    new Replay(),
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
    <FluentProvider theme={webLightTheme}>
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
