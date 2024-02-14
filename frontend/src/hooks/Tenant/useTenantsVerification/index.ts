import useTenantQueries from 'api/queries/useTenantQueries';
import { ModelTypes } from 'api/zeus';
import { useState, useEffect } from 'react';

const useTenantsVerification = () => {
  const [isAddTenantDrawerOpen, setIsAddTenantDrawerOpen] =
    useState<boolean>(false);
  const [
    isTenantVerificationActionDrawerOpen,
    setIsTenantVerificationActionDrawerOpen,
  ] = useState<boolean>(false);
  const [selectedActionData, setSelectedActionData] = useState<
    | {
        key: string;
        name: string;
        tenant: ModelTypes['Tenant'];
      }
    | undefined
  >();
  const [tenantsForVerification, setTenantsForVerification] = useState<
    ModelTypes['Tenant'][] | []
  >([]);

  const { data, isLoading } = useTenantQueries().getTenantsForVerification;

  useEffect(() => {
    if (data?.data) {
      setTenantsForVerification(data.data as ModelTypes['Tenant'][]);
    }
  }, [data?.data]);

  return {
    isLoading,
    tenantsForVerification,

    isAddTenantDrawerOpen,
    setIsAddTenantDrawerOpen,

    isTenantVerificationActionDrawerOpen,
    setIsTenantVerificationActionDrawerOpen,

    selectedActionData,
    setSelectedActionData,
  };
};

export default useTenantsVerification;
