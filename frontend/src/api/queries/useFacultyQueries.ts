/* eslint-disable import/prefer-default-export */
import { useInfiniteQuery } from '@tanstack/react-query';
import client from 'api/client';
import { ModelTypes, order_by } from 'api/zeus';

export const useGetFaculty = ({
  queryKey,
  filter = {},
}: {
  queryKey: string;
  filter?: ModelTypes['Faculty_bool_exp'];
}) =>
  useInfiniteQuery({
    queryKey: [queryKey, filter],
    queryFn: async ({ pageParam: lastCursorId }) => {
      try {
        const res = await client('query')({
          Faculty_aggregate: [
            {},
            {
              aggregate: {
                max: {
                  cursorId: true,
                },
              },
            },
          ],
          Faculty: [
            {
              limit: 100,
              where: {
                ...filter,
                cursorId: { _gt: lastCursorId },
              },
              order_by: [{ cursorId: order_by.asc }],
            },
            {
              id: true,
              name: true,
              gender: true,
              phoneNo: true,
              emailId: true,
              dob: true,
              panCardNo: true,
              address: true,
              cast: true,
              minority: true,
              qualification: true,
              experience: true,
              designation: true,
              dateOfJoining: true,
              staffType: true,
              section: true,
              statusOfApproval: true,
              jobType: true,
              instituteId: true,
              createdById: true,
              updatedById: true,
              createdAt: true,
              updatedAt: true,
              status: true,
              isVerified: true,
              cursorId: true,
            },
          ],
        });

        const data = res.Faculty;
        const maxCursorId = res.Faculty_aggregate.aggregate?.max?.cursorId;
        const currentCursorId = data.at(-1)?.cursorId as number;
        const lastCursor =
          maxCursorId === currentCursorId ? undefined : currentCursorId;

        return {
          status: 'success',
          data,
          lastCursor,
        };
      } catch (error) {
        return { status: 'error', error };
      }
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => lastPage.lastCursor,
  });
