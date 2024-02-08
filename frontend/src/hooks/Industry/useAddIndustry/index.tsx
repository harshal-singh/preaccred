import { Text } from '@fluentui/react-components';
import { useAddIndustryMutation } from 'api/mutations/useIndustryMutations';
import { ModelTypes } from 'api/zeus';
import { useSetAtom } from 'jotai';
import { useCallback } from 'react';

import { isAddIndustryDrawerOpenAtom } from 'atoms/Industry';

import useToast from 'hooks/useToast';

const useAddIndustry = () => {
  const setIsAddIndustryDrawerOpen = useSetAtom(isAddIndustryDrawerOpenAtom);
  const { dispatchToast } = useToast();

  const { mutateAsync, isSuccess } = useAddIndustryMutation();

  const resetDrawer = useCallback(() => {
    setIsAddIndustryDrawerOpen(false);
  }, [setIsAddIndustryDrawerOpen]);

  const handleAddIndustry = useCallback(
    async (formData: Partial<ModelTypes['Industry']>) => {
      const res = await mutateAsync({
        name: formData.name,
        description: formData.description,
      });

      const onDismiss = () => {};

      if (res.status === 'success') {
        resetDrawer();
        dispatchToast({
          intent: 'success',
          title: 'Success',
          body: `Added ${res.data?.name} industry.`,
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
              Error occurred while updating industry.
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
    handleAddIndustry,
    isSuccess,
  };
};

export default useAddIndustry;
