import { Drawer, DrawerBody, DrawerProps } from '@fluentui/react-components';
import { ModelTypes } from 'api/zeus';
import { useAtomValue, useSetAtom } from 'jotai';
import { ReactNode, useMemo } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import {
  isUpdateIndustryDrawerOpenAtom,
  selectedIndustryAtom,
} from 'atoms/Industry';

import Body from './Body';
import Footer from './Footer';
import Header from './Header';

const useDrawerProps = (): DrawerProps => {
  const setIsOpen = useSetAtom(isUpdateIndustryDrawerOpenAtom);

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

const useUpdate = () => {
  const selectedIndustry = useAtomValue(selectedIndustryAtom);

  const formMethods = useForm<Partial<ModelTypes['Industry']>>({
    mode: 'all',
    reValidateMode: 'onChange',
    defaultValues: {
      name: selectedIndustry?.name,
      description: selectedIndustry?.description,
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

const UpdateIndustryDrawer = () => {
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

export default UpdateIndustryDrawer;
