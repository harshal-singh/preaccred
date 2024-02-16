import { Drawer, DrawerBody, DrawerProps } from '@fluentui/react-components';
import { isManageDrawerOpenAtom } from 'atoms';
import { useSetAtom } from 'jotai';
import { useMemo } from 'react';

import Body from './Body';
import Footer from './Footer';
import Header from './Header';

const useDrawerProps = (): DrawerProps => {
  const setIsOpen = useSetAtom(isManageDrawerOpenAtom);

  return useMemo(
    () => ({
      size: 'small',
      position: 'end',
      open: true,
      onOpenChange: () => {
        setIsOpen(false);
      },
    }),
    [setIsOpen],
  );
};

const VerificationDrawer = () => {
  const drawerProps = useDrawerProps();

  return (
    <Drawer {...drawerProps}>
      <Header />
      <DrawerBody className="flex !overflow-hidden border-y">
        <Body />
      </DrawerBody>
      <Footer />
    </Drawer>
  );
};

export default VerificationDrawer;
