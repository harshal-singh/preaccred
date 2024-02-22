import { useMutation, useQueryClient } from '@tanstack/react-query';
import client from 'api/client';
import { ModelTypes } from 'api/zeus';

type UpdateContact = {
  id: string;
  data: Omit<ModelTypes['Contact_insert_input'], 'id'>;
};

export const useAddContactMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: ModelTypes['Contact_insert_input']) => {
      try {
        const res = await client('mutation')({
          insert_Contact_one: [
            {
              object: {
                ...data
              },
            },
            {
              id: true,
              name: true,
              status: true,
              isVerified: true,
            },
          ],
        });
        return { status: 'success', data: res.insert_Contact_one };
      } catch (error) {
        return { status: 'error', error };
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['VerificationPendingContacts'],
      });
    },
    onError: (error) => {
      console.log('🚀 ~ useAddContact ~ error:', error);
    },
  });
};

export const useUpdateContactMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: UpdateContact) => {
      try {
        const res = await client('mutation')({
          update_Contact_by_pk: [
            {
              pk_columns: { id },
              _set: { ...data },
            },
            {
              id: true,
              name: true,
              status: true,
              isVerified: true,
            },
          ],
        });
        return { status: 'success', data: res.update_Contact_by_pk };
      } catch (error) {
        return { status: 'error', error };
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['ActiveContacts'],
      });
      void queryClient.invalidateQueries({
        queryKey: ['VerificationPendingContacts'],
      });
    },
    onError: (error) => {
      console.log('🚀 ~ useUpdateContact ~ error:', error);
    },
  });
};
