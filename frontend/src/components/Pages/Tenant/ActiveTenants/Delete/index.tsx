import {
  Button,
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  Toaster,
  Text,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Field,
} from '@fluentui/react-components';
import { Dismiss24Regular } from '@fluentui/react-icons';
import { ModelTypes } from 'api/zeus';
import { Dispatch, SetStateAction } from 'react';

import useDeleteTenant from 'hooks/Tenant/useDeleteTenant';

type Props = {
  selectedTenant: ModelTypes['Tenant'] | undefined;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
};

const DeleteTenantDrawer = ({ selectedTenant, setIsOpen }: Props) => {
  const {
    toasterId,

    renderFooter,
  } = useDeleteTenant({ setIsOpen, selectedTenant });

  return (
    <Drawer
      size="small"
      position="end"
      open
      onOpenChange={() => {
        setIsOpen(false);
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
              }}
            />
          }
        >
          Delete Tenant
        </DrawerHeaderTitle>
      </DrawerHeader>
      <DrawerBody className="!overflow-hidden border-y">
        <MessageBar intent="info" layout="multiline" className="my-6">
          <MessageBarBody className="pb-2">
            <MessageBarTitle>
              You are about to delete this tenant
            </MessageBarTitle>
          </MessageBarBody>
        </MessageBar>
        <Text>Are you sure you want to delete this tenant?</Text>
        <div className="flex flex-col gap-4 mt-6">
          <Field label="Tenant Name" className="font-semibold">
            <Text>{selectedTenant?.name}</Text>
          </Field>
          <Field label="Username" className="font-semibold">
            <Text>
              {selectedTenant?.firstName} {selectedTenant?.lastName}
            </Text>
          </Field>
          <Field label="Email ID" className="font-semibold">
            <Text>{selectedTenant?.emailId}</Text>
          </Field>
          <Field label="Contact" className="font-semibold">
            <Text>{selectedTenant?.contact}</Text>
          </Field>
        </div>
      </DrawerBody>

      <Toaster
        className="w-[275px]"
        toasterId={toasterId}
        offset={{ vertical: 100 }}
      />
      {renderFooter}
    </Drawer>
  );
};

export default DeleteTenantDrawer;
