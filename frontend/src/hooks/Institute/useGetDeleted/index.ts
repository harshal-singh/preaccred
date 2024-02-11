import { useGetInstitute } from 'api/queries/useInstituteQueries';
import { STATUS_enum } from 'api/zeus';
import { useMemo } from 'react';

const useGetActive = () => {
  const {
    data,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    error,
    isError,
    isLoadingError,
  } = useGetInstitute({
    filter: {
      status: {
        _eq: STATUS_enum.ACTIVE,
      },
    },
    queryKey: 'ActiveInstitutes',
  });

  const institutes = useMemo(() => {
    const pages = data?.pages ?? [];
    return pages.flatMap((page) => page.data ?? []);
  }, [data?.pages]);

  return {
    institutes,

    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isError: isError || isLoadingError,
    error,
  };
};

export default useGetActive;
