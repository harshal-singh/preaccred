import { useMutation, useQueryClient } from '@tanstack/react-query';
import client from 'api/client';
import { ModelTypes } from 'api/zeus';

type UpdateFacultyFunding = {
  id: string;
  data: Omit<ModelTypes['FacultyFunding_insert_input'], 'id'>;
};

export const useAddFacultyFundingMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: ModelTypes['FacultyFunding_insert_input']) => {
      try {
        const res = await client('mutation')({
          insert_FacultyFunding_one: [
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
        return { status: 'success', data: res.insert_FacultyFunding_one };
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
      console.log('🚀 ~ useAddFacultyFunding ~ error:', error);
    },
  });
};

export const useUpdateFacultyFundingMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: UpdateFacultyFunding) => {
      try {
        const res = await client('mutation')({
          update_FacultyFunding_by_pk: [
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
        return { status: 'success', data: res.update_FacultyFunding_by_pk };
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
      console.log('🚀 ~ useUpdateFacultyFunding ~ error:', error);
    },
  });
};
