import { useInfiniteQuery } from '@tanstack/react-query';
import client from 'api/client';
import { ModelTypes, order_by } from 'api/zeus';

export const useGetIndustries = ({
  queryKey,
  filter = {},
}: {
  queryKey: string;
  filter?: ModelTypes['Industry_bool_exp'];
}) =>
  useInfiniteQuery({
    queryKey: [queryKey, filter],
    queryFn: async ({ pageParam: lastCursorId }) => {
      try {
        const res = await client('query')({
          Industry_aggregate: [
            {},
            {
              aggregate: {
                max: {
                  cursorId: true,
                },
              },
            },
          ],
          Industry: [
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
              tenantId: true,
              createdAt: true,
              status: true,
              cursorId: true,
            },
          ],
        });

        const industries = res.Industry;
        const maxCursorId = res.Industry_aggregate.aggregate?.max?.cursorId;
        const currentCursorId = industries.at(-1)?.cursorId as number;
        const lastCursor =
          maxCursorId === currentCursorId ? undefined : currentCursorId;

        return {
          status: 'success',
          industries,
          lastCursor,
        };
      } catch (error) {
        return { status: 'error', error };
      }
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => lastPage.lastCursor,
  });
