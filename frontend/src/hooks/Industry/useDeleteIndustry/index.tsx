import { Text } from '@fluentui/react-components';
import { useUpdateIndustryMutation } from 'api/mutations/useIndustryMutations';
import { Status_enum } from 'api/zeus';
import { isDeleteDrawerOpenAtom } from 'atoms';
import { useAtom, useSetAtom } from 'jotai';
import { useCallback } from 'react';

import { selectedIndustryAtom } from 'atoms/Industry';

import useToast from 'hooks/useToast';

const useDeleteIndustry = () => {
  const [selectedIndustry, setSelectedIndustry] = useAtom(selectedIndustryAtom);
  const setIsDeleteDrawerOpen = useSetAtom(isDeleteDrawerOpenAtom);
  const { dispatchToast } = useToast();

  const { mutateAsync } = useUpdateIndustryMutation();

  const resetDrawer = useCallback(() => {
    setSelectedIndustry(null);
    setIsDeleteDrawerOpen(false);
  }, [setIsDeleteDrawerOpen, setSelectedIndustry]);

  const handleDeleteIndustry = useCallback(async () => {
    if (!selectedIndustry) return;

    const res = await mutateAsync({
      id: selectedIndustry.id as string,
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
        body: `Deleted ${res.data?.name} industry.`,
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
            Error occurred while deleting industry.
            <br />
            Error: {String(res.error)}
          </Text>
        ),
        onDismiss,
      });
    }
  }, [selectedIndustry, mutateAsync, resetDrawer, dispatchToast]);

  return {
    selectedIndustry,
    handleDeleteIndustry,
  };
};

export default useDeleteIndustry;
