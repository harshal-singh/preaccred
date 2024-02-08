import { withSentryReactRouterV6Routing } from '@sentry/react';
import { Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';

import Login from 'pages/Login';

import HomeSpinner from 'components/Loaders/HomeLoader';

const SentryRoutes = withSentryReactRouterV6Routing(Routes);

const AuthRoutes = () => {
  return (
    <SentryRoutes>
      <Route
        path="*"
        element={
          <Suspense fallback={<HomeSpinner />}>
            <Login />
          </Suspense>
        }
      />
    </SentryRoutes>
  );
};
export default AuthRoutes;
