import { useGetIndustries } from 'api/queries/useIndustryQueries';
import { Status_enum } from 'api/zeus';
import { useMemo } from 'react';

const useActiveIndustries = () => {
  const {
    data,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    error,
    isError,
    isLoadingError,
  } = useGetIndustries({
    filter: {
      status: {
        _eq: Status_enum.ACTIVE,
      },
    },
    queryKey: 'ActiveIndustries',
  });

  const activeIndustries = useMemo(() => {
    const pages = data?.pages ?? [];
    return pages.flatMap((page) => page.industries ?? []);
  }, [data?.pages]);

  return {
    activeIndustries,

    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isError: isError || isLoadingError,
    error,
  };
};

export default useActiveIndustries;
