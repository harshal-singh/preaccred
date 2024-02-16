import { Drawer, DrawerBody, DrawerProps } from '@fluentui/react-components';
import { ModelTypes } from 'api/zeus';
import {
  isUpdateDrawerOpenAtom,
  selectedInstituteAtom,
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

const useUpdate = () => {
  const selectedInstitute = useAtomValue(selectedInstituteAtom);

  const formMethods = useForm<Partial<ModelTypes['Institute']>>({
    mode: 'all',
    reValidateMode: 'onChange',
    defaultValues: {
      name: selectedInstitute?.name,
      website: selectedInstitute?.website,
      dateOfEstablishment: new Date(
        selectedInstitute?.dateOfEstablishment as string,
      ),
      type: selectedInstitute?.type,
      address: selectedInstitute?.address,
      landmark: selectedInstitute?.landmark,
      city: selectedInstitute?.city,
      state: selectedInstitute?.state,
      pin: selectedInstitute?.pin,
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
        <DrawerBody className="flex !overflow-hidden border-y">
          <Body />
        </DrawerBody>
        <Footer />
      </Form>
    </Drawer>
  );
};

export default UpdateIndustryDrawer;
