import { Text } from '@fluentui/react-components';
import { useUpdateInstituteMutation } from 'api/mutations/useInstituteMutations';
import { ModelTypes, Status_enum } from 'api/zeus';
import {
  isUpdateDrawerOpenAtom,
  selectedInstituteAtom,
  selectedTabAtom,
} from 'atoms';
import { useAtom, useSetAtom } from 'jotai';
import { useCallback } from 'react';

import useToast from 'hooks/useToast';

const useVerification = () => {
  const [selectedInstitute, setSelectedInstitute] = useAtom(
    selectedInstituteAtom,
  );

  const setIsUpdateDrawerOpen = useSetAtom(isUpdateDrawerOpenAtom);
  const { dispatchToast } = useToast();

  const { mutateAsync, isSuccess } = useUpdateInstituteMutation();

  const resetDrawer = useCallback(() => {
    setSelectedInstitute(null);
    setIsUpdateDrawerOpen(false);
  }, [setSelectedInstitute, setIsUpdateDrawerOpen]);

  const handleResendEmail = useCallback(async () => {
    if (!selectedInstitute) return;
    const onDismiss = () => {};

    resetDrawer();
    dispatchToast({
      intent: 'success',
      title: 'Success',
      body: `Sent verification email to ${selectedInstitute.name} institute.`,
      onDismiss,
    });
  }, [selectedInstitute, resetDrawer, dispatchToast]);

  const handleUpdateStatus = useCallback(
    async (status: boolean) => {
      if (!selectedInstitute) return;

      const updates = status
        ? { isVerified: status }
        : { status: Status_enum.DELETED };

      const res = await mutateAsync({
        id: selectedInstitute.id as string,
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
          body: `Updated ${res.data?.name} institute details.`,
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
              Error occurred while updating institute details.
              <br />
              Error: {String(res.error)}
            </Text>
          ),
          onDismiss,
        });
      }
    },
    [selectedInstitute, mutateAsync, resetDrawer, dispatchToast],
  );

  return {
    handleResendEmail,
    handleUpdateStatus,
    isSuccess,
  };
};

export default useVerification;
