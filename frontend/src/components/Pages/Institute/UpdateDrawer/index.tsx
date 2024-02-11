import { Drawer, DrawerBody, DrawerProps } from '@fluentui/react-components';
import { ModelTypes } from 'api/zeus';
import { isUpdateDrawerOpenAtom, selectedInstituteAtom } from 'atoms';
import { useAtomValue, useSetAtom } from 'jotai';
import { ReactNode, useMemo } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import Body from './Body';
import Footer from './Footer';
import Header from './Header';

const useDrawerProps = (): DrawerProps => {
  const setIsOpen = useSetAtom(isUpdateDrawerOpenAtom);

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
  const selectedInstitute = useAtomValue(selectedInstituteAtom);

  const formMethods = useForm<Partial<ModelTypes['institute']>>({
    mode: 'all',
    reValidateMode: 'onChange',
    defaultValues: {
      name: selectedInstitute?.name,
      website: selectedInstitute?.website,
      date_of_establishment: selectedInstitute?.date_of_establishment as string,
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

const UpdateInstituteDrawer = () => {
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

export default UpdateInstituteDrawer;
