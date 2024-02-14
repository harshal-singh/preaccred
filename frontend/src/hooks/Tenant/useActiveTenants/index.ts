import useTenantQueries from 'api/queries/useTenantQueries';
import { ModelTypes } from 'api/zeus';
import { useState, useEffect } from 'react';

const useActiveTenants = () => {
  const [isAddTenantDrawerOpen, setIsAddTenantDrawerOpen] =
    useState<boolean>(false);
  const [isUpdateTenantDrawerOpen, setIsUpdateTenantDrawerOpen] =
    useState<boolean>(false);
  const [isDeleteTenantDrawerOpen, setIsDeleteTenantDrawerOpen] =
    useState<boolean>(false);
  const [selectedTenant, setSelectedTenant] = useState<
    ModelTypes['Tenant'] | undefined
  >();
  const [activeTenants, setActiveTenants] = useState<
    ModelTypes['Tenant'][] | []
  >([]);

  const { data, isLoading } = useTenantQueries().getActiveTenants;

  useEffect(() => {
    if (data?.data) {
      setActiveTenants(data.data as ModelTypes['Tenant'][]);
    }
  }, [data?.data]);

  return {
    isLoading,
    activeTenants,

    isAddTenantDrawerOpen,
    setIsAddTenantDrawerOpen,

    selectedTenant,
    setSelectedTenant,

    isUpdateTenantDrawerOpen,
    setIsUpdateTenantDrawerOpen,

    isDeleteTenantDrawerOpen,
    setIsDeleteTenantDrawerOpen,
  };
};

export default useActiveTenants;
