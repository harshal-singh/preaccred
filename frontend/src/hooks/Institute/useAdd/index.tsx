import { Text } from '@fluentui/react-components';
import { useAddInstituteMutation } from 'api/mutations/useInstituteMutations';
import { ModelTypes } from 'api/zeus';
import { isAddDrawerOpenAtom } from 'atoms';
import { useSetAtom } from 'jotai';
import { useCallback } from 'react';

import useToast from 'hooks/useToast';

const useAddInstitute = () => {
  const setIsAddInstituteDrawerOpen = useSetAtom(isAddDrawerOpenAtom);
  const { dispatchToast } = useToast();

  const { mutateAsync, isSuccess } = useAddInstituteMutation();

  const resetDrawer = useCallback(() => {
    setIsAddInstituteDrawerOpen(false);
  }, [setIsAddInstituteDrawerOpen]);

  const handleAddInstitute = useCallback(
    async (formData: Partial<ModelTypes['institute']>) => {
      const res = await mutateAsync({
        name: formData.name,
        website: formData.website,
        date_of_establishment: formData.date_of_establishment as string,
        type: formData.type,
        address: formData.address,
        landmark: formData.landmark,
        city: formData.city,
        state: formData.state,
        pin: formData.pin,
        createdById: '0d50626e-4395-4a85-94f6-6243a9b1f47f',
      });

      const onDismiss = () => {};

      if (res.status === 'success') {
        resetDrawer();
        dispatchToast({
          intent: 'success',
          title: 'Success',
          body: `Added ${res.data?.name} institute.`,
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
              Error occurred while updating institute.
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
    handleAddInstitute,
    isSuccess,
  };
};

export default useAddInstitute;
