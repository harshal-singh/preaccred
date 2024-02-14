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

import useTenantVerificationAction from 'hooks/Tenant/useTenantVerificationAction';

type Props = {
  selectedActionData:
    | {
        key: string;
        name: string;
        tenant: ModelTypes['Tenant'];
      }
    | undefined;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
};

const TenantVerificationActionDrawer = ({
  selectedActionData,
  setIsOpen,
}: Props) => {
  const {
    toasterId,

    renderFooter,
  } = useTenantVerificationAction({ setIsOpen, selectedActionData });

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
          <span className="capitalize">
            {selectedActionData?.name}{' '}
            {selectedActionData?.key === 'resendEmail' && 'to'}
          </span>{' '}
          Tenant
        </DrawerHeaderTitle>
      </DrawerHeader>
      <DrawerBody className="!overflow-hidden border-y">
        <MessageBar intent="info" layout="multiline" className="my-6">
          <MessageBarBody className="pb-2">
            <MessageBarTitle>
              You are about to {selectedActionData?.name}{' '}
              {selectedActionData?.key === 'resendEmail' && 'to'} the tenant
            </MessageBarTitle>
          </MessageBarBody>
        </MessageBar>
        <Text>
          Are you sure you want to {selectedActionData?.name}{' '}
          {selectedActionData?.key === 'resendEmail' && 'to'} the following
          tenant?
        </Text>
        <div className="flex flex-col gap-4 mt-6">
          <Field label="Tenant Name" className="font-semibold">
            <Text>{selectedActionData?.tenant.name}</Text>
          </Field>
          <Field label="Username" className="font-semibold">
            <Text>
              {selectedActionData?.tenant.firstName}{' '}
              {selectedActionData?.tenant.lastName}
            </Text>
          </Field>
          <Field label="Email ID" className="font-semibold">
            <Text>{selectedActionData?.tenant.emailId}</Text>
          </Field>
          <Field label="Contact" className="font-semibold">
            <Text>{selectedActionData?.tenant.contact}</Text>
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

export default TenantVerificationActionDrawer;
