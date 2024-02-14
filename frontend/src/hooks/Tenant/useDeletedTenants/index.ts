import useTenantQueries from 'api/queries/useTenantQueries';
import { ModelTypes } from 'api/zeus';
import { useState, useEffect } from 'react';

const useDeletedTenants = () => {
  const [deletedTenants, setDeletedTenants] = useState<
    ModelTypes['Tenant'][] | []
  >([]);

  const { data, isLoading } = useTenantQueries().getDeletedTenants;

  useEffect(() => {
    if (data?.data) {
      setDeletedTenants(data.data as ModelTypes['Tenant'][]);
    }
  }, [data?.data]);

  return {
    isLoading,
    deletedTenants,
  };
};

export default useDeletedTenants;
