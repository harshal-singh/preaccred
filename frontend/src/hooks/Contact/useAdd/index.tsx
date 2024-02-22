import { Text } from '@fluentui/react-components';
import { useAddContactMutation } from 'api/mutations/useContactMutations';
import { ModelTypes } from 'api/zeus';
import { isAddDrawerOpenAtom, selectedTabAtom } from 'atoms';
import { useSetAtom } from 'jotai';
import { useCallback } from 'react';

import useToast from 'hooks/useToast';

const useAddContact = () => {
  const setSelectedTab = useSetAtom(selectedTabAtom);
  const setIsAddContactDrawerOpen = useSetAtom(isAddDrawerOpenAtom);
  const { dispatchToast } = useToast();

  const { mutateAsync, isSuccess } = useAddContactMutation();

  const resetDrawer = useCallback(() => {
    setSelectedTab('details');
    setIsAddContactDrawerOpen(false);
  }, [setIsAddContactDrawerOpen, setSelectedTab]);

  const handleAddContact = useCallback(
    async (formData: Partial<ModelTypes['Contact']>) => {
      const res = await mutateAsync({
        name: formData.name,
        phoneNo: formData.phoneNo,
        primaryEmailId: formData.primaryEmailId,
        secondaryEmailId: formData.secondaryEmailId,
        collegeName: formData.collegeName,
        createdById: '0d50626e-4395-4a85-94f6-6243a9b1f47f',
      });

      const onDismiss = () => {};

      if (res.status === 'success') {
        resetDrawer();
        dispatchToast({
          intent: 'success',
          title: 'Success',
          body: `Added ${res.data?.name} contact details.`,
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
              Error occurred while adding contact details.
              <br />
              Error: {String(res.error)}
            </Text>
          ),
          onDismiss,
        });
      }
    },
    [mutateAsync, resetDrawer, dispatchToast],
  );

  return {
    handleAddContact,
    isSuccess,
  };
};

export default useAddContact;
