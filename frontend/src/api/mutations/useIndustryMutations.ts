import { useMutation, useQueryClient } from '@tanstack/react-query';
import client from 'api/client';
import { ModelTypes } from 'api/zeus';

type UpdateIndustry = {
  id: string;
  data: Omit<ModelTypes['Industry_insert_input'], 'id'>;
};

export const useAddIndustryMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: ModelTypes['Industry_insert_input']) => {
      try {
        const res = await client('mutation')({
          insert_Industry_one: [
            {
              object: {
                ...data,
                tenantId: 'a3b595a8-c874-48f7-9aa1-99694f9ee185', // change this
              },
            },
            {
              id: true,
              name: true,
              description: true,
            },
          ],
        });
        return { status: 'success', data: res.insert_Industry_one };
      } catch (error) {
        return { status: 'error', error };
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['ActiveIndustries'],
      });
    },
    onError: (error) => {
      console.log('🚀 ~ useAddIndustry ~ error:', error);
    },
  });
};

export const useUpdateIndustryMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: UpdateIndustry) => {
      try {
        const res = await client('mutation')({
          update_Industry_by_pk: [
            {
              pk_columns: { id },
              _set: { ...data },
            },
            {
              id: true,
              name: true,
              description: true,
            },
          ],
        });
        return { status: 'success', data: res.update_Industry_by_pk };
      } catch (error) {
        return { status: 'error', error };
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['ActiveIndustries'],
      });
    },
    onError: (error) => {
      console.log('🚀 ~ useUpdateIndustry ~ error:', error);
    },
  });
};
