import { Drawer, DrawerBody, DrawerProps } from '@fluentui/react-components';
import { ModelTypes } from 'api/zeus';
import { isAddDrawerOpenAtom } from 'atoms';
import { useSetAtom } from 'jotai';
import { ReactNode, useMemo } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import Body from './Body';
import Footer from './Footer';
import Header from './Header';

const useDrawerProps = (): DrawerProps => {
  const setIsOpen = useSetAtom(isAddDrawerOpenAtom);

  return useMemo(
    () => ({
      size: 'medium',
      position: 'end',
      open: true,
      onOpenChange: () => {
        setIsOpen(false);
      },
    }),
    [setIsOpen],
  );
};

const useAdd = () => {
  const formMethods = useForm<Partial<ModelTypes['institute']>>({
    mode: 'all',
    reValidateMode: 'onChange',
    defaultValues: {
      name: '',
      website: '',
      date_of_establishment: '',
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
        <DrawerBody className="border-y">
          <Body />
        </DrawerBody>
        <Footer />
      </Form>
    </Drawer>
  );
};

export default AddIndustryDrawer;
