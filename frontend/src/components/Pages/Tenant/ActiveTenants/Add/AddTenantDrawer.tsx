import {
  Button,
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
} from '@fluentui/react-components';
import { Dismiss24Regular } from '@fluentui/react-icons';
import { Dispatch, SetStateAction } from 'react';
import { FormProvider } from 'react-hook-form';

import useAddTenant from 'hooks/Tenant/useAddTenant';

import Finish from './Finish';
import Packages from './Packages';
import Select from './Select';
import Tabs from './Tabs';

type Props = {
  setIsOpen: Dispatch<SetStateAction<boolean>>;
};

const AddTenantDrawer = ({ setIsOpen }: Props) => {
  const {
    selectedTabValue,
    setSelectedTabValue,

    selectedTenant,
    tenantsForVerification,

    formMethods,

    renderFooter,
  } = useAddTenant({ setIsOpen });

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
          Add Tenant
        </DrawerHeaderTitle>
      </DrawerHeader>
      <DrawerBody className="flex !overflow-hidden border-y">
        <Tabs
          selectedTabValue={selectedTabValue}
          setSelectedTabValue={setSelectedTabValue}
        />

        <div className="w-full overflow-auto py-10">
          <FormProvider {...formMethods}>
            {selectedTabValue === 'select' && (
              <Select
                tenantsForVerification={tenantsForVerification}
                selectedTenant={selectedTenant}
              />
            )}
            {selectedTabValue === 'packages' && (
              <Packages selectedTenant={selectedTenant} />
            )}
            {selectedTabValue === 'finish' && (
              <Finish
                setSelectedTabValue={setSelectedTabValue}
                selectedTenant={selectedTenant}
              />
            )}
          </FormProvider>
        </div>
      </DrawerBody>
      {renderFooter}
    </Drawer>
  );
};

export default AddTenantDrawer;
