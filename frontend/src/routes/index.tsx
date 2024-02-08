import { isLoggedInAtom } from 'atoms';
import { useAtom } from 'jotai';

import AppRoutes from './app.routes';
import AuthRoutes from './auth.routes';

const Routes = () => {
  const [isLoggedIn] = useAtom(isLoggedInAtom);

  return isLoggedIn ? <AppRoutes /> : <AuthRoutes />;
};

export default Routes;
