import { useMutation, useQueryClient } from '@tanstack/react-query';
import client from 'api/client';
import { ModelTypes } from 'api/zeus';

type UpdateFdpPdp = {
  id: string;
  data: Omit<ModelTypes['FdpPdp_insert_input'], 'id'>;
};

export const useAddFdpPdpMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: ModelTypes['FdpPdp_insert_input']) => {
      try {
        const res = await client('mutation')({
          insert_FdpPdp_one: [
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
        return { status: 'success', data: res.insert_FdpPdp_one };
      } catch (error) {
        return { status: 'error', error };
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['VerificationPendingFdpPdps'],
      });
    },
    onError: (error) => {
      console.log('🚀 ~ useAddFdpPdp ~ error:', error);
    },
  });
};

export const useUpdateFdpPdpMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: UpdateFdpPdp) => {
      try {
        const res = await client('mutation')({
          update_FdpPdp_by_pk: [
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
        return { status: 'success', data: res.update_FdpPdp_by_pk };
      } catch (error) {
        return { status: 'error', error };
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['ActiveFdpPdps'],
      });
      void queryClient.invalidateQueries({
        queryKey: ['VerificationPendingFdpPdps'],
      });
    },
    onError: (error) => {
      console.log('🚀 ~ useUpdateFdpPdp ~ error:', error);
    },
  });
};
