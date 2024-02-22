import { Text } from '@fluentui/react-components';
import { useUpdateContactMutation } from 'api/mutations/useContactMutations';
import { Status_enum } from 'api/zeus';
import {
  isUpdateDrawerOpenAtom,
  selectedContactAtom,
} from 'atoms';
import { useAtom, useSetAtom } from 'jotai';
import { useCallback } from 'react';

import useToast from 'hooks/useToast';

const useVerification = () => {
  const [selectedContact, setSelectedContact] = useAtom(selectedContactAtom);

  const setIsUpdateDrawerOpen = useSetAtom(isUpdateDrawerOpenAtom);
  const { dispatchToast } = useToast();

  const { mutateAsync, isSuccess } = useUpdateContactMutation();

  const resetDrawer = useCallback(() => {
    setSelectedContact(null);
    setIsUpdateDrawerOpen(false);
  }, [setSelectedContact, setIsUpdateDrawerOpen]);

  const handleUpdateStatus = useCallback(
    async (status: boolean) => {
      if (!selectedContact) return;

      const updates = status
        ? { isVerified: status }
        : { status: Status_enum.DELETED };

      const res = await mutateAsync({
        id: selectedContact.id as string,
        data: {
          ...updates,
          updatedById: '0d50626e-4395-4a85-94f6-6243a9b1f47f',
        },
      });

      const onDismiss = () => {};

      if (res.status === 'success') {
        resetDrawer();
        dispatchToast({
          intent: 'success',
          title: 'Success',
          body: `Updated ${res.data?.name} contact details.`,
          onDismiss,
        });
      }
      if (res.status === 'error') {
        resetDrawer();
        dispatchToast({
          intent: 'error',
          title: 'Error',
          body: (
            <Text>
              Error occurred while updating contact details.
              <br />
              Error: {String(res.error)}
            </Text>
          ),
          onDismiss,
        });
      }
    },
    [selectedContact, mutateAsync, resetDrawer, dispatchToast],
  );

  return {
    handleUpdateStatus,
    isSuccess,
  };
};

export default useVerification;
