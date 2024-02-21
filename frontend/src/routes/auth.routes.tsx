import { withSentryReactRouterV6Routing } from '@sentry/react';
import { Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';

import SignIn from 'pages/Auth/SignIn';
import SignUp from 'pages/Auth/SignUp';

import HomeSpinner from 'components/Loaders/HomeLoader';

const SentryRoutes = withSentryReactRouterV6Routing(Routes);

const AuthRoutes = () => {
  return (
    <SentryRoutes>
      <Route
        path="/"
        element={
          <Suspense fallback={<HomeSpinner />}>
            <SignIn />
          </Suspense>
        }
      />
      <Route
        path="sign/in"
        element={
          <Suspense fallback={<HomeSpinner />}>
            <SignIn />
          </Suspense>
        }
      />
      <Route
        path="sign/up"
        element={
          <Suspense fallback={<HomeSpinner />}>
            <SignUp />
          </Suspense>
        }
      />
    </SentryRoutes>
  );
};
export default AuthRoutes;
