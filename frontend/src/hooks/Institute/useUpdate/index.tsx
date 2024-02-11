import { Text } from '@fluentui/react-components';
import { useUpdateInstituteMutation } from 'api/mutations/useInstituteMutations';
import { ModelTypes } from 'api/zeus';
import { isUpdateDrawerOpenAtom, selectedInstituteAtom } from 'atoms';
import { useAtom, useSetAtom } from 'jotai';
import { useCallback } from 'react';

import useToast from 'hooks/useToast';

const useUpdateInstitute = () => {
  const [selectedInstitute, setSelectedInstitute] = useAtom(
    selectedInstituteAtom,
  );

  const setIsUpdateInstituteDrawerOpen = useSetAtom(isUpdateDrawerOpenAtom);
  const { dispatchToast } = useToast();

  const { mutateAsync, isSuccess } = useUpdateInstituteMutation();

  const resetDrawer = useCallback(() => {
    setSelectedInstitute(null);
    setIsUpdateInstituteDrawerOpen(false);
  }, [setSelectedInstitute, setIsUpdateInstituteDrawerOpen]);

  const handleUpdateInstitute = useCallback(
    async (formData: Partial<ModelTypes['institute']>) => {
      if (!selectedInstitute) return;

      const res = await mutateAsync({
        id: selectedInstitute.id as string,
        data: {
          name: formData.name,
          website: formData.website,
          date_of_establishment: formData.date_of_establishment as string,
          type: formData.type,
          address: formData.address,
          landmark: formData.landmark,
          city: formData.city,
          state: formData.state,
          pin: formData.pin,
          updatedById: formData.updatedById as string,
        },
      });

      const onDismiss = () => {};

      if (res.status === 'success') {
        resetDrawer();
        dispatchToast({
          intent: 'success',
          title: 'Success',
          body: `Updated ${res.data?.name} institute.`,
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
              Error occurred while updating institute detail.
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
    handleUpdateInstitute,
    isSuccess,
  };
};

export default useUpdateInstitute;
