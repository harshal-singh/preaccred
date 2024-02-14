import { Button, DrawerFooter, TabValue } from '@fluentui/react-components';
import useTenantMutations from 'api/mutations/useTenantMutations';
import useTenantQueries from 'api/queries/useTenantQueries';
import { ModelTypes } from 'api/zeus';
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useForm } from 'react-hook-form';

type Props = {
  setIsOpen: Dispatch<SetStateAction<boolean>>;
};

const useAddTenant = ({ setIsOpen }: Props) => {
  const [selectedTabValue, setSelectedTabValue] = useState<TabValue>('select');
  const [selectedTenant, setSelectedTenant] = useState<
    ModelTypes['Tenant'] | undefined
  >();
  const [tenantsForVerification, setTenantsForVerification] = useState<
    ModelTypes['Tenant'][] | []
  >([]);
  const { getTenantsForVerification } = useTenantQueries();
  const { updateTenant } = useTenantMutations();

  const formMethods = useForm({
    mode: 'all',
    reValidateMode: 'onChange',
    defaultValues: {
      id: '',
      name: '',
    },
  });

  const {
    reset,
    watch,
    handleSubmit,
    formState: { isValid },
  } = formMethods;

  const [id, name] = watch(['id', 'name']);

  useEffect(() => {
    const { data } = getTenantsForVerification;
    if (data?.data) {
      setTenantsForVerification(data.data as ModelTypes['Tenant'][]);
    }
  }, [getTenantsForVerification]);

  useEffect(() => {
    const tenant = tenantsForVerification.find((t) => (t.id as string) === id);
    setSelectedTenant(tenant);
  }, [id, name, tenantsForVerification, setSelectedTenant, watch]);

  const isFormValid = useMemo(() => isValid && !!name, [isValid, name]);

  const prevStep = useCallback(() => {
    if (selectedTabValue === 'packages') {
      setSelectedTabValue('select');
    }

    if (selectedTabValue === 'finish') {
      setSelectedTabValue('packages');
    }
  }, [selectedTabValue]);

  const nextStep = useCallback(() => {
    if (selectedTabValue === 'select') {
      setSelectedTabValue('packages');
    }

    if (selectedTabValue === 'packages') {
      setSelectedTabValue('finish');
    }
  }, [selectedTabValue]);

  const onSubmit = useCallback(async () => {
    const res = await updateTenant(id, {
      verificationStatus: 'verified',
      status: 'active',
    });
    if (res.status === 'success') {
      reset();
      setIsOpen(false);
    }
  }, [updateTenant, id, reset, setIsOpen]);

  const renderFooter = useMemo(() => {
    return (
      <DrawerFooter className="flex justify-between">
        <Button
          appearance="outline"
          disabled={selectedTabValue === 'select'}
          onClick={prevStep}
        >
          Back
        </Button>
        {selectedTabValue === 'finish' ? (
          <Button
            appearance="primary"
            disabled={!isFormValid}
            onClick={handleSubmit(onSubmit)}
          >
            Submit
          </Button>
        ) : (
          <Button appearance="primary" onClick={nextStep}>
            Next
          </Button>
        )}
      </DrawerFooter>
    );
  }, [
    handleSubmit,
    isFormValid,
    nextStep,
    onSubmit,
    prevStep,
    selectedTabValue,
  ]);

  return {
    selectedTabValue,
    setSelectedTabValue,

    selectedTenant,
    tenantsForVerification,

    onSubmit,
    formMethods,

    renderFooter,
  };
};

export default useAddTenant;
