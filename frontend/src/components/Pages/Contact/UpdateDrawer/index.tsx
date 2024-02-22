import { Drawer, DrawerBody, DrawerProps } from '@fluentui/react-components';
import { ModelTypes } from 'api/zeus';
import {
  isUpdateDrawerOpenAtom,
  selectedContactAtom,
  selectedTabAtom,
} from 'atoms';
import { useAtomValue, useSetAtom } from 'jotai';
import { ReactNode, useMemo } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import Footer from './Footer';
import Header from './Header';
import Body from '../Body';

const useDrawerProps = (): DrawerProps => {
  const setIsOpen = useSetAtom(isUpdateDrawerOpenAtom);
  const setSelectedTab = useSetAtom(selectedTabAtom);
  const setSelectedContact = useSetAtom(selectedContactAtom);

  return useMemo(
    () => ({
      size: 'large',
      position: 'end',
      open: true,
      onOpenChange: () => {
        setSelectedContact(null);
        setSelectedTab('details');
        setIsOpen(false);
      },
    }),
    [setIsOpen, setSelectedContact, setSelectedTab],
  );
};

const useUpdate = () => {
  const selectedContact = useAtomValue(selectedContactAtom);

  const formMethods = useForm<Partial<ModelTypes['Contact']>>({
    mode: 'all',
    reValidateMode: 'onChange',
    defaultValues: {
      name: selectedContact?.name,
      phoneNo: selectedContact?.phoneNo,
      primaryEmailId: selectedContact?.primaryEmailId,
      secondaryEmailId: selectedContact?.secondaryEmailId,
      collegeName: selectedContact?.collegeName,
    },
  });

  return {
    formMethods,
  };
};

const Form = ({ children }: { children: ReactNode }) => {
  const { formMethods } = useUpdate();
  return <FormProvider {...formMethods}>{children}</FormProvider>;
};

const UpdateContactDrawer = () => {
  const drawerProps = useDrawerProps();

  return (
    <Drawer {...drawerProps}>
      <Header />
      <Form>
        <DrawerBody className="flex !overflow-hidden border-y">
          <Body />
        </DrawerBody>
        <Footer />
      </Form>
    </Drawer>
  );
};

export default UpdateContactDrawer;
