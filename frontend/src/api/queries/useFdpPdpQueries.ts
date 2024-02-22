/* eslint-disable import/prefer-default-export */
import { useInfiniteQuery } from '@tanstack/react-query';
import client from 'api/client';
import { ModelTypes, order_by } from 'api/zeus';

export const useGetFdpPdp = ({
  queryKey,
  filter = {},
}: {
  queryKey: string;
  filter?: ModelTypes['FdpPdp_bool_exp'];
}) =>
  useInfiniteQuery({
    queryKey: [queryKey, filter],
    queryFn: async ({ pageParam: lastCursorId }) => {
      try {
        const res = await client('query')({
          FdpPdp_aggregate: [
            {},
            {
              aggregate: {
                max: {
                  cursorId: true,
                },
              },
            },
          ],
          FdpPdp: [
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
              description: true,
              dateFrom: true,
              dateTo: true,
              nature: true,
              venue: true,
              type: true,
              facultyId: true,
              instituteId: true,
              file: true,
              createdById: true,
              updatedById: true,
              createdAt: true,
              updatedAt: true,
              status: true,
              cursorId: true,
            },
          ],
        });

        const data = res.FdpPdp;
        const maxCursorId = res.FdpPdp_aggregate.aggregate?.max?.cursorId;
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
