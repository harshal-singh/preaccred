import { useQuery } from '@tanstack/react-query';
import client from 'api/client';
import { useCallback } from 'react';

const useTenantQueries = () => {
  const getTenantsForVerificationFn = useCallback(async () => {
    try {
      const res = await client('query')({
        Tenant: [
          {
            where: {
              status: {
                _neq: 'deleted',
              },
            },
          },
          {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            emailId: true,
            contact: true,
            address: true,
            packages: [
              {},
              {
                package: {
                  id: true,
                  name: true,
                  description: true,
                  price: true,
                  objects: true,
                  roles: true,
                },
              },
            ],
            verificationStatus: true,
            status: true,
          },
        ],
      });
      return { status: 'success', data: res.Tenant };
    } catch (error) {
      return { status: 'error', error };
    }
  }, []);

  const getDeletedTenantsFn = useCallback(async () => {
    try {
      const res = await client('query')({
        Tenant: [
          {
            where: {
              status: {
                _eq: 'deleted',
              },
            },
          },
          {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            emailId: true,
            contact: true,
            address: true,
            packages: [
              {},
              {
                package: {
                  id: true,
                  name: true,
                  description: true,
                  price: true,
                  objects: true,
                  roles: true,
                },
              },
            ],
            verificationStatus: true,
            status: true,
          },
        ],
      });
      return { status: 'success', data: res.Tenant };
    } catch (error) {
      return { status: 'error', error };
    }
  }, []);

  const getActiveTenantsFn = useCallback(async () => {
    try {
      const res = await client('query')({
        Tenant: [
          {
            where: {
              verificationStatus: {
                _eq: 'verified',
              },
              status: {
                _eq: 'active',
              },
            },
          },
          {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            emailId: true,
            contact: true,
            address: true,
            packages: [
              {},
              {
                package: {
                  id: true,
                  name: true,
                  description: true,
                  price: true,
                  objects: true,
                  roles: true,
                },
              },
            ],
            verificationStatus: true,
            status: true,
          },
        ],
      });
      return { status: 'success', data: res.Tenant };
    } catch (error) {
      return { status: 'error', error };
    }
  }, []);

  const getTenantsForVerification = useQuery({
    queryKey: ['TenantsForVerification'],
    queryFn: getTenantsForVerificationFn,
  });

  const getDeletedTenants = useQuery({
    queryKey: ['DeletedTenants'],
    queryFn: getDeletedTenantsFn,
  });

  const getActiveTenants = useQuery({
    queryKey: ['ActiveTenants'],
    queryFn: getActiveTenantsFn,
  });

  return {
    getTenantsForVerification,

    getDeletedTenants,

    getActiveTenants,
  };
};

export default useTenantQueries;
