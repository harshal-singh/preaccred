/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import {
  Button,
  DrawerFooter,
  Text,
  Toast,
  ToastBody,
  ToastFooter,
  ToastIntent,
  ToastTitle,
  useId,
  useToastController,
} from '@fluentui/react-components';
import useTenantMutations from 'api/mutations/useTenantMutations';
import { ModelTypes } from 'api/zeus';
import { Dispatch, SetStateAction, useCallback, useMemo } from 'react';

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

const useTenantVerificationAction = ({
  selectedActionData,
  setIsOpen,
}: Props) => {
  const toasterId = useId('addTenantForVerification');
  const { dispatchToast, dismissToast } = useToastController(toasterId);
  const { updateTenant } = useTenantMutations();

  const showToast = useCallback(
    ({
      intent,
      title,
      body,
      footer,
      onDismiss,
    }: {
      intent: ToastIntent;
      title: string | JSX.Element;
      body: string | JSX.Element;
      footer?: string | JSX.Element;
      onDismiss?: () => void;
    }) =>
      dispatchToast(
        <Toast>
          <ToastTitle className="capitalize">{title}</ToastTitle>
          <ToastBody>{body}</ToastBody>
          <ToastFooter>{footer}</ToastFooter>
        </Toast>,
        {
          intent,
          timeout: 10_000,
          onStatusChange(event, data) {
            if (data.status === 'dismissed' && onDismiss) {
              onDismiss();
            }
          },
        },
      ),
    [dispatchToast],
  );

  const onClick = useCallback(async () => {
    if (selectedActionData?.tenant) {
      const selectedKey = selectedActionData.key;

      let status = 'inactive';
      let verificationStatus = 'rejected';
      if (selectedKey === 'approve') {
        status = 'active';
        verificationStatus = 'verified';
      }

      const tenantId = selectedActionData.tenant.id as string;
      const res = await updateTenant(tenantId, {
        status,
        verificationStatus,
      });

      const onDismiss = () => {
        setIsOpen(false);
        dismissToast(toasterId);
      };

      if (res.status === 'success') {
        showToast({
          intent: 'success',
          title: `${
            selectedKey === 'resendEmail'
              ? 'Email sent'
              : selectedKey === 'approve'
              ? 'approved '
              : 'rejected '
          }`,
          body: `You have
              ${
                selectedKey === 'resendEmail'
                  ? 'resent verification email to'
                  : selectedKey === 'approve'
                  ? 'approved '
                  : 'rejected '
              }
              the tenant.`,
          footer: <Button onClick={onDismiss}>Okay</Button>,
          onDismiss,
        });
      }
      if (res.status === 'error') {
        showToast({
          intent: 'error',
          title: 'Error',
          body: (
            <Text>
              Error occurred while
              {selectedKey === 'resendEmail'
                ? 'resending the verification email to'
                : selectedKey === 'approve'
                ? 'approving '
                : 'rejecting '}{' '}
              the tenant.
              <br />
              Error: {String(res.error)}
            </Text>
          ),
          footer: <Button onClick={onDismiss}>Okay</Button>,
          onDismiss,
        });
      }
    }
  }, [
    dismissToast,
    selectedActionData?.key,
    selectedActionData?.tenant,
    setIsOpen,
    showToast,
    toasterId,
    updateTenant,
  ]);

  const renderFooter = useMemo(() => {
    return (
      <DrawerFooter className="flex justify-between">
        <Button appearance="primary" className="capitalize" onClick={onClick}>
          {selectedActionData?.name}
        </Button>
      </DrawerFooter>
    );
  }, [onClick, selectedActionData?.name]);

  return {
    toasterId,

    renderFooter,
  };
};

export default useTenantVerificationAction;
