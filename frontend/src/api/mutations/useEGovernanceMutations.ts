import { useMutation, useQueryClient } from '@tanstack/react-query';
import client from 'api/client';
import { ModelTypes } from 'api/zeus';

type UpdateEGovernance = {
  id: string;
  data: Omit<ModelTypes['EGovernance_insert_input'], 'id'>;
};

export const useAddEGovernanceMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: ModelTypes['EGovernance_insert_input']) => {
      try {
        const res = await client('mutation')({
          insert_EGovernance_one: [
            {
              object: {
                ...data,
              },
            },
            {
              id: true,
              name: true,
              status: true,
            },
          ],
        });
        return { status: 'success', data: res.insert_EGovernance_one };
      } catch (error) {
        return { status: 'error', error };
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['VerificationPendingEGovernances'],
      });
    },
    onError: (error) => {
      console.log('🚀 ~ useAddEGovernance ~ error:', error);
    },
  });
};

export const useUpdateEGovernanceMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: UpdateEGovernance) => {
      try {
        const res = await client('mutation')({
          update_EGovernance_by_pk: [
            {
              pk_columns: { id },
              _set: { ...data },
            },
            {
              id: true,
              name: true,
              status: true,
            },
          ],
        });
        return { status: 'success', data: res.update_EGovernance_by_pk };
      } catch (error) {
        return { status: 'error', error };
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['ActiveEGovernances'],
      });
      void queryClient.invalidateQueries({
        queryKey: ['VerificationPendingEGovernances'],
      });
    },
    onError: (error) => {
      console.log('🚀 ~ useUpdateEGovernance ~ error:', error);
    },
  });
};
