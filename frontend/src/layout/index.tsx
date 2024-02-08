import { ReactNode } from 'react';

import Navbar from 'components/Navbar';
import Sidebar from 'components/Sidebar';

const Layout = ({ children }: { children: ReactNode }) => {
  return (
    <>
      <Navbar />
      <div className="flex relative pt-14 min-h-screen">
        <Sidebar />
        <div className="flex-1 overflow-hidden">{children}</div>
      </div>
    </>
  );
};

export default Layout;
