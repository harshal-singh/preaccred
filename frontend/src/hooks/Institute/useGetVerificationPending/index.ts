import { useGetInstitute } from 'api/queries/useInstituteQueries';
import { Status_enum } from 'api/zeus';
import { useMemo } from 'react';

const useGetVerificationPending = () => {
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
      isVerified: {
        _eq: false,
      },
    },
    queryKey: 'VerificationPendingInstitutes',
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

export default useGetVerificationPending;
