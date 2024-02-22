import { useGetContact } from 'api/queries/useContactQueries';
import { Status_enum } from 'api/zeus';
import { useMemo } from 'react';

const useGetDeleted = () => {
  const {
    data,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    error,
    isError,
    isLoadingError,
  } = useGetContact({
    filter: {
      status: {
        _eq: Status_enum.DELETED,
      },
    },
    queryKey: 'DeletedContacts',
  });

  const contacts = useMemo(() => {
    const pages = data?.pages ?? [];
    return pages.flatMap((page) => page.data ?? []);
  }, [data?.pages]);

  return {
    contacts,

    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isError: isError || isLoadingError,
    error,
  };
};

export default useGetDeleted;
