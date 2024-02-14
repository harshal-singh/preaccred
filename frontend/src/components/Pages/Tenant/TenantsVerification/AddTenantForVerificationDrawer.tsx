import {
  Button,
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  Toaster,
} from '@fluentui/react-components';
import { Dismiss24Regular } from '@fluentui/react-icons';
import { Dispatch, SetStateAction } from 'react';
import { FormProvider } from 'react-hook-form';

import useAddTenantForVerification from 'hooks/Tenant/useAddTenantForVerification';

import Basic from './Basic';
import Finish from './Finish';
import Packages from './Packages';
import Tabs from './Tabs';

type Props = {
  setIsOpen: Dispatch<SetStateAction<boolean>>;
};

const AddTenantForVerificationDrawer = ({ setIsOpen }: Props) => {
  const {
    selectedTabValue,
    setSelectedTabValue,

    listOfPackages,

    formMethods,

    toasterId,

    renderFooter,
  } = useAddTenantForVerification({ setIsOpen });

  const { reset } = formMethods;

  return (
    <Drawer
      size="large"
      position="end"
      open
      onOpenChange={() => {
        setIsOpen(false);
        reset();
      }}
    >
      <DrawerHeader>
        <DrawerHeaderTitle
          action={
            <Button
              appearance="subtle"
              aria-label="Close"
              icon={<Dismiss24Regular />}
              onClick={() => {
                setIsOpen(false);
                reset();
              }}
            />
          }
        >
          Add Tenant For Verification
        </DrawerHeaderTitle>
      </DrawerHeader>
      <DrawerBody className="flex !overflow-hidden border-y">
        <Tabs
          selectedTabValue={selectedTabValue}
          setSelectedTabValue={setSelectedTabValue}
        />

        <div className="w-full overflow-auto py-10">
          <FormProvider {...formMethods}>
            {selectedTabValue === 'basic' && <Basic />}
            {selectedTabValue === 'packages' && (
              <Packages listOfPackages={listOfPackages} />
            )}
            {selectedTabValue === 'finish' && (
              <Finish
                setSelectedTabValue={setSelectedTabValue}
                listOfPackages={listOfPackages}
              />
            )}
          </FormProvider>
        </div>
      </DrawerBody>

      <Toaster toasterId={toasterId} offset={{ vertical: 100 }} />
      {renderFooter}
    </Drawer>
  );
};

export default AddTenantForVerificationDrawer;
