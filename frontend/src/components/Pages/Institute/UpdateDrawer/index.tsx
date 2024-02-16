import { Drawer, DrawerBody, DrawerProps } from '@fluentui/react-components';
import { ModelTypes } from 'api/zeus';
import { isAddDrawerOpenAtom, selectedTabAtom } from 'atoms';
import { useSetAtom } from 'jotai';
import { ReactNode, useMemo } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import Footer from './Footer';
import Header from './Header';
import Body from '../Body';

const useDrawerProps = (): DrawerProps => {
  const setIsOpen = useSetAtom(isAddDrawerOpenAtom);
  const setSelectedTab = useSetAtom(selectedTabAtom);

  return useMemo(
    () => ({
      size: 'large',
      position: 'end',
      open: true,
      onOpenChange: () => {
        setSelectedTab('details');
        setIsOpen(false);
      },
    }),
    [setIsOpen, setSelectedTab],
  );
};

const useAdd = () => {
  const formMethods = useForm<Partial<ModelTypes['Institute']>>({
    mode: 'all',
    reValidateMode: 'onChange',
    defaultValues: {
      name: '',
      website: '',
      dateOfEstablishment: '',
      type: '',
      address: '',
      landmark: '',
      city: '',
      state: '',
      pin: '',
    },
  });

  return {
    formMethods,
  };
};

const Form = ({ children }: { children: ReactNode }) => {
  const { formMethods } = useAdd();
  return <FormProvider {...formMethods}>{children}</FormProvider>;
};

const AddIndustryDrawer = () => {
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

export default AddIndustryDrawer;
