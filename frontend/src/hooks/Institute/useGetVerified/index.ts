import { useGetInstitute } from 'api/queries/useInstituteQueries';
import { Status_enum } from 'api/zeus';
import { useMemo } from 'react';

const useGetVerified = () => {
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
        _eq: Status_enum.ACTIVE,
      },
    },
    queryKey: 'VerifiedInstitutes',
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

export default useGetVerified;
