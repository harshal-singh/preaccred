import { withSentryReactRouterV6Routing } from '@sentry/react';
import Layout from 'layout';
import { lazy, Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { Route, Routes } from 'react-router-dom';

import PageError from 'pages/PageError';
import PageNotFound from 'pages/PageNotFound';

import HomeSpinner from 'components/Loaders/HomeLoader';
import PageSkeleton from 'components/Skeletons/PageSkeleton';

const Home = lazy(() => import('pages/Home'));
const InstitutesVerification = lazy(
  () => import('pages/Institutes/Verification'),
);
const ActiveInstitutes = lazy(() => import('pages/Institutes/Active'));
const DeletedInstitutes = lazy(() => import('pages/Institutes/Deleted'));

const SentryRoutes = withSentryReactRouterV6Routing(Routes);

const Element = ({
  children,
  fallback,
}: {
  children: JSX.Element;
  fallback: JSX.Element;
}) => {
  return (
    <ErrorBoundary FallbackComponent={PageError}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </ErrorBoundary>
  );
};

const AppRoutes = () => {
  return (
    <Layout>
      <SentryRoutes>
        <Route
          path="/"
          element={
            <Element fallback={<HomeSpinner />}>
              <Home />
            </Element>
          }
        />

        <Route
          path="institutes/verification"
          element={
            <Element fallback={<PageSkeleton />}>
              <InstitutesVerification />
            </Element>
          }
        />
        <Route
          path="institutes/active"
          element={
            <Element fallback={<PageSkeleton />}>
              <ActiveInstitutes />
            </Element>
          }
        />
        <Route
          path="institutes/deleted"
          element={
            <Element fallback={<PageSkeleton />}>
              <DeletedInstitutes />
            </Element>
          }
        />

        {/* page not found */}
        <Route path="*" element={<PageNotFound />} />
      </SentryRoutes>
    </Layout>
  );
};
export default AppRoutes;
