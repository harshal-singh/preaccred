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
  selectedTenant: ModelTypes['Tenant'] | undefined;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
};

const useDeleteTenant = ({ selectedTenant, setIsOpen }: Props) => {
  const toasterId = useId('deleteTenant');
  const { dispatchToast, dismissToast } = useToastController(toasterId);
  const { deleteTenant } = useTenantMutations();

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

  const onDelete = useCallback(async () => {
    if (selectedTenant) {
      const tenantId = selectedTenant.id as string;
      const res = await deleteTenant(tenantId);

      const onDismiss = () => {
        setIsOpen(false);
        dismissToast(toasterId);
      };

      if (res.status === 'success') {
        showToast({
          intent: 'success',
          title: `Deleted`,
          body: `You have successfully delete the ${res.data?.name} tenant.`,
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
              Error occurred while deleting the tenant.
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
    selectedTenant,
    setIsOpen,
    showToast,
    toasterId,
    deleteTenant,
  ]);

  const renderFooter = useMemo(() => {
    return (
      <DrawerFooter className="flex justify-between">
        <Button appearance="primary" className="capitalize" onClick={onDelete}>
          Delete
        </Button>
      </DrawerFooter>
    );
  }, [onDelete]);

  return {
    toasterId,

    renderFooter,
  };
};

export default useDeleteTenant;
