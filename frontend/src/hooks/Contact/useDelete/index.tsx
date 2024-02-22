import { Text } from '@fluentui/react-components';
import { useUpdateContactMutation } from 'api/mutations/useContactMutations';
import { Status_enum } from 'api/zeus';
import { isDeleteDrawerOpenAtom, selectedContactAtom } from 'atoms';
import { useAtom, useSetAtom } from 'jotai';
import { useCallback } from 'react';

import useToast from 'hooks/useToast';

const useDeleteContact = () => {
  const [selectedContact, setSelectedContact] = useAtom(
    selectedContactAtom,
  );
  const setIsDeleteDrawerOpen = useSetAtom(isDeleteDrawerOpenAtom);
  const { dispatchToast } = useToast();

  const { mutateAsync } = useUpdateContactMutation();

  const resetDrawer = useCallback(() => {
    setSelectedContact(null);
    setIsDeleteDrawerOpen(false);
  }, [setIsDeleteDrawerOpen, setSelectedContact]);

  const handleDeleteContact = useCallback(async () => {
    if (!selectedContact) return;

    const res = await mutateAsync({
      id: selectedContact.id as string,
      data: {
        status: Status_enum.DELETED,
      },
    });

    const onDismiss = () => {};

    if (res.status === 'success') {
      resetDrawer();
      dispatchToast({
        intent: 'success',
        title: 'Success',
        body: `Deleted ${res.data?.name} contact.`,
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
            Error occurred while deleting contact.
            <br />
            Error: {String(res.error)}
          </Text>
        ),
        onDismiss,
      });
    }
  }, [selectedContact, mutateAsync, resetDrawer, dispatchToast]);

  return {
    selectedContact,
    handleDeleteContact,
  };
};

export default useDeleteContact;
