import { isLoggedInAtom } from 'atoms';
import { useAtomValue } from 'jotai';

import AppRoutes from './app.routes';
import AuthRoutes from './auth.routes';

const Routes = () => {
  const isLoggedIn = useAtomValue(isLoggedInAtom);
  return isLoggedIn ? <AppRoutes /> : <AuthRoutes />;
};

export default Routes;
