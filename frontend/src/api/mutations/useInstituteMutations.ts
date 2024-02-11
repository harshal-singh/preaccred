import { useMutation, useQueryClient } from '@tanstack/react-query';
import client from 'api/client';
import { ModelTypes } from 'api/zeus';

type UpdateInstitute = {
  id: string;
  data: Omit<ModelTypes['institute_insert_input'], 'id'>;
};

export const useAddInstituteMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: ModelTypes['institute_insert_input']) => {
      try {
        const res = await client('mutation')({
          insert_institute_one: [
            {
              object: {
                ...data,
              },
            },
            {
              id: true,
              name: true,
              website: true,
              date_of_establishment: true,
              type: true,
              address: true,
              landmark: true,
              city: true,
              state: true,
              pin: true,
              createdById: true,
              updatedById: true,
              createdAt: true,
              updatedAt: true,
              status: true,
              cursorId: true,
            },
          ],
        });
        return { status: 'success', data: res.insert_institute_one };
      } catch (error) {
        return { status: 'error', error };
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['ActiveInstitutes'],
      });
    },
    onError: (error) => {
      console.log('🚀 ~ useAddInstitute ~ error:', error);
    },
  });
};

export const useUpdateInstituteMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: UpdateInstitute) => {
      try {
        const res = await client('mutation')({
          update_institute_by_pk: [
            {
              pk_columns: { id },
              _set: { ...data },
            },
            {
              id: true,
              name: true,
              website: true,
              date_of_establishment: true,
              type: true,
              address: true,
              landmark: true,
              city: true,
              state: true,
              pin: true,
              createdById: true,
              updatedById: true,
              createdAt: true,
              updatedAt: true,
              status: true,
              cursorId: true,
            },
          ],
        });
        return { status: 'success', data: res.update_institute_by_pk };
      } catch (error) {
        return { status: 'error', error };
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['ActiveInstitutes'],
      });
    },
    onError: (error) => {
      console.log('🚀 ~ useUpdateInstitute ~ error:', error);
    },
  });
};