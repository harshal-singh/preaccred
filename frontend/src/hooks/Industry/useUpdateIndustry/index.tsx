import { Text } from '@fluentui/react-components';
import { useUpdateIndustryMutation } from 'api/mutations/useIndustryMutations';
import { ModelTypes } from 'api/zeus';
import { useAtom, useSetAtom } from 'jotai';
import { useCallback } from 'react';

import {
  isUpdateIndustryDrawerOpenAtom,
  selectedIndustryAtom,
} from 'atoms/Industry';

import useToast from 'hooks/useToast';

const useUpdateIndustry = () => {
  const [selectedIndustry, setSelectedIndustry] = useAtom(selectedIndustryAtom);

  const setIsUpdateIndustryDrawerOpen = useSetAtom(
    isUpdateIndustryDrawerOpenAtom,
  );
  const { dispatchToast } = useToast();

  const { mutateAsync, isSuccess } = useUpdateIndustryMutation();

  const resetDrawer = useCallback(() => {
    setSelectedIndustry(null);
    setIsUpdateIndustryDrawerOpen(false);
  }, [setSelectedIndustry, setIsUpdateIndustryDrawerOpen]);

  const handleUpdateIndustry = useCallback(
    async (formData: Partial<ModelTypes['Industry']>) => {
      if (!selectedIndustry) return;

      const res = await mutateAsync({
        id: selectedIndustry.id as string,
        data: {
          name: formData.name,
          description: formData.description,
        },
      });

      const onDismiss = () => {};

      if (res.status === 'success') {
        resetDrawer();
        dispatchToast({
          intent: 'success',
          title: 'Success',
          body: `Updated ${res.data?.name} industry.`,
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
              Error occurred while updating industry detail.
              <br />
              Error: {String(res.error)}
            </Text>
          ),
          onDismiss,
        });
      }
    },
    [selectedIndustry, mutateAsync, resetDrawer, dispatchToast],
  );

  return {
    handleUpdateIndustry,
    isSuccess,
  };
};

export default useUpdateIndustry;
