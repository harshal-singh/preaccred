import { Text } from '@fluentui/react-components';
import { useUpdateInstituteMutation } from 'api/mutations/useInstituteMutations';
import { STATUS_enum } from 'api/zeus';
import { isDeleteDrawerOpenAtom } from 'atoms';
import { useAtom, useSetAtom } from 'jotai';
import { useCallback } from 'react';

import { selectedInstituteAtom } from 'atoms';

import useToast from 'hooks/useToast';

const useDeleteInstitute = () => {
  const [selectedInstitute, setSelectedInstitute] = useAtom(
    selectedInstituteAtom,
  );
  const setIsDeleteDrawerOpen = useSetAtom(isDeleteDrawerOpenAtom);
  const { dispatchToast } = useToast();

  const { mutateAsync } = useUpdateInstituteMutation();

  const resetDrawer = useCallback(() => {
    setSelectedInstitute(null);
    setIsDeleteDrawerOpen(false);
  }, [setIsDeleteDrawerOpen, setSelectedInstitute]);

  const handleDeleteInstitute = useCallback(async () => {
    if (!selectedInstitute) return;

    const res = await mutateAsync({
      id: selectedInstitute.id as string,
      data: {
        status: STATUS_enum.DELETED,
      },
    });

    const onDismiss = () => {};

    if (res.status === 'success') {
      resetDrawer();
      dispatchToast({
        intent: 'success',
        title: 'Success',
        body: `Deleted ${res.data?.name} institute.`,
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
            Error occurred while deleting institute.
            <br />
            Error: {String(res.error)}
          </Text>
        ),
        onDismiss,
      });
    }
  }, [selectedInstitute, mutateAsync, resetDrawer, dispatchToast]);

  return {
    selectedInstitute,
    handleDeleteInstitute,
  };
};

export default useDeleteInstitute;
