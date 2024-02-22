import { useMutation, useQueryClient } from '@tanstack/react-query';
import client from 'api/client';
import { ModelTypes } from 'api/zeus';

type UpdateFaculty = {
  id: string;
  data: Omit<ModelTypes['Faculty_insert_input'], 'id'>;
};

export const useAddFacultyMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: ModelTypes['Faculty_insert_input']) => {
      try {
        const res = await client('mutation')({
          insert_Faculty_one: [
            {
              object: {
                ...data,
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
        return { status: 'success', data: res.insert_Faculty_one };
      } catch (error) {
        return { status: 'error', error };
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['VerificationPendingFaculties'],
      });
    },
    onError: (error) => {
      console.log('🚀 ~ useAddFaculty ~ error:', error);
    },
  });
};

export const useUpdateFacultyMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: UpdateFaculty) => {
      try {
        const res = await client('mutation')({
          update_Faculty_by_pk: [
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
        return { status: 'success', data: res.update_Faculty_by_pk };
      } catch (error) {
        return { status: 'error', error };
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['ActiveFaculties'],
      });
      void queryClient.invalidateQueries({
        queryKey: ['VerificationPendingFaculties'],
      });
    },
    onError: (error) => {
      console.log('🚀 ~ useUpdateFaculty ~ error:', error);
    },
  });
};
