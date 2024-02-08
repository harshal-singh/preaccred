import { Drawer, DrawerBody, DrawerProps } from '@fluentui/react-components';
import { ModelTypes } from 'api/zeus';
import { useSetAtom } from 'jotai';
import { ReactNode, useMemo } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { isAddIndustryDrawerOpenAtom } from 'atoms/Industry';

import Body from './Body';
import Footer from './Footer';
import Header from './Header';

const useDrawerProps = (): DrawerProps => {
  const setIsOpen = useSetAtom(isAddIndustryDrawerOpenAtom);

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

const useAdd = () => {
  const formMethods = useForm<Partial<ModelTypes['Industry']>>({
    mode: 'all',
    reValidateMode: 'onChange',
    defaultValues: {
      name: '',
      description: '',
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
