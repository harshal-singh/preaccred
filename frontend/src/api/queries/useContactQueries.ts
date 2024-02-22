/* eslint-disable import/prefer-default-export */
import { useInfiniteQuery } from '@tanstack/react-query';
import client from 'api/client';
import { ModelTypes, order_by } from 'api/zeus';

export const useGetContact = ({
  queryKey,
  filter = {},
}: {
  queryKey: string;
  filter?: ModelTypes['Contact_bool_exp'];
}) =>
  useInfiniteQuery({
    queryKey: [queryKey, filter],
    queryFn: async ({ pageParam: lastCursorId }) => {
      try {
        const res = await client('query')({
          Contact_aggregate: [
            {},
            {
              aggregate: {
                max: {
                  cursorId: true,
                },
              },
            },
          ],
          Contact: [
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
              phoneNo: true,
              primaryEmailId: true,
              secondaryEmailId: true,
              collegeName: true,
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

        const data = res.Contact;
        const maxCursorId = res.Contact_aggregate.aggregate?.max?.cursorId;
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
