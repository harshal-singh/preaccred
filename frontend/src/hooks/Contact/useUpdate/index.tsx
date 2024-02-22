import { Text } from '@fluentui/react-components';
import { useUpdateContactMutation } from 'api/mutations/useContactMutations';
import { ModelTypes } from 'api/zeus';
import {
  isUpdateDrawerOpenAtom,
  selectedContactAtom,
  selectedTabAtom,
} from 'atoms';
import { useAtom, useSetAtom } from 'jotai';
import { useCallback } from 'react';

import useToast from 'hooks/useToast';

const useUpdateContact = () => {
  const setSelectedTab = useSetAtom(selectedTabAtom);
  const [selectedContact, setSelectedContact] = useAtom(
    selectedContactAtom,
  );

  const setIsUpdateContactDrawerOpen = useSetAtom(isUpdateDrawerOpenAtom);
  const { dispatchToast } = useToast();

  const { mutateAsync, isSuccess } = useUpdateContactMutation();

  const resetDrawer = useCallback(() => {
    setSelectedTab('details');
    setSelectedContact(null);
    setIsUpdateContactDrawerOpen(false);
  }, [setSelectedTab, setSelectedContact, setIsUpdateContactDrawerOpen]);

  const handleUpdateContact = useCallback(
    async (formData: Partial<ModelTypes['Contact']>) => {
      if (!selectedContact) return;

      const res = await mutateAsync({
        id: selectedContact.id as string,
        data: {
          name: formData.name,
          phoneNo: formData.phoneNo,
          primaryEmailId: formData.primaryEmailId,
          secondaryEmailId: formData.secondaryEmailId,
          collegeName: formData.collegeName,
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
    handleUpdateContact,
    isSuccess,
  };
};

export default useUpdateContact;
