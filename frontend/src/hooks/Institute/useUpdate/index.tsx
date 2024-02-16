import { Text } from '@fluentui/react-components';
import { useUpdateInstituteMutation } from 'api/mutations/useInstituteMutations';
import { ModelTypes } from 'api/zeus';
import {
  isUpdateDrawerOpenAtom,
  selectedInstituteAtom,
  selectedTabAtom,
} from 'atoms';
import { useAtom, useSetAtom } from 'jotai';
import { useCallback } from 'react';

import useToast from 'hooks/useToast';

const useUpdateInstitute = () => {
  const setSelectedTab = useSetAtom(selectedTabAtom);
  const [selectedInstitute, setSelectedInstitute] = useAtom(
    selectedInstituteAtom,
  );

  const setIsUpdateInstituteDrawerOpen = useSetAtom(isUpdateDrawerOpenAtom);
  const { dispatchToast } = useToast();

  const { mutateAsync, isSuccess } = useUpdateInstituteMutation();

  const resetDrawer = useCallback(() => {
    setSelectedTab('details');
    setSelectedInstitute(null);
    setIsUpdateInstituteDrawerOpen(false);
  }, [setSelectedTab, setSelectedInstitute, setIsUpdateInstituteDrawerOpen]);

  const handleUpdateInstitute = useCallback(
    async (formData: Partial<ModelTypes['Institute']>) => {
      if (!selectedInstitute) return;

      const res = await mutateAsync({
        id: selectedInstitute.id as string,
        data: {
          name: formData.name,
          website: formData.website,
          dateOfEstablishment: formData.dateOfEstablishment as string,
          type: formData.type,
          address: formData.address,
          landmark: formData.landmark,
          city: formData.city,
          state: formData.state,
          pin: formData.pin,
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
    handleUpdateInstitute,
    isSuccess,
  };
};

export default useUpdateInstitute;
