import {
  Button,
  DrawerFooter,
  TabValue,
  Text,
  Toast,
  ToastBody,
  ToastFooter,
  ToastIntent,
  ToastTitle,
  useId,
  useToastController,
} from '@fluentui/react-components';
import useTenantMutations from 'api/mutations/useTenantMutations';
import usePackageQueries from 'api/queries/usePackageQueries';
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
  selectedTenant: ModelTypes['Tenant'] | undefined;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
};

type CustomTenantInputProps = {
  name: string | undefined;
  firstName: string | undefined;
  lastName: string | undefined;
  emailId: string | undefined;
  contact: string | undefined;
  address: string | undefined;
  packages: string | undefined;
};

const useUpdateTenant = ({ selectedTenant, setIsOpen }: Props) => {
  const [selectedTabValue, setSelectedTabValue] = useState<TabValue>('basic');
  const [listOfPackages, setListOfPackages] = useState<
    ModelTypes['Package'][] | []
  >([]);
  const toasterId = useId('addTenantForVerification');
  const { dispatchToast, dismissToast } = useToastController(toasterId);

  const { updateTenantAndItsPackages } = useTenantMutations();
  const { getPackages } = usePackageQueries();

  const defaultPackages = JSON.stringify(
    selectedTenant?.packages.map((p) => p.package.id as string),
  );

  const formMethods = useForm({
    mode: 'all',
    reValidateMode: 'onChange',
    defaultValues: {
      name: selectedTenant?.name,
      firstName: selectedTenant?.firstName,
      lastName: selectedTenant?.lastName,
      emailId: selectedTenant?.emailId,
      contact: selectedTenant?.contact,
      address: selectedTenant?.address,
      packages: defaultPackages,
    },
  });

  const {
    reset,
    watch,
    handleSubmit,
    formState: { isValid, errors },
  } = formMethods;

  const [name, firstName, lastName, emailId, contact, address, packages] =
    watch([
      'name',
      'firstName',
      'lastName',
      'emailId',
      'contact',
      'address',
      'packages',
    ]);

  useEffect(() => {
    const { data } = getPackages;
    if (data?.data) {
      setListOfPackages(data.data as ModelTypes['Package'][]);
    }
  }, [getPackages]);

  const hasChanges = useMemo(
    () =>
      selectedTenant &&
      (name !== selectedTenant.name ||
        firstName !== selectedTenant.firstName ||
        lastName !== selectedTenant.lastName ||
        emailId !== selectedTenant.emailId ||
        contact !== selectedTenant.contact ||
        address !== selectedTenant.address ||
        packages !== defaultPackages),
    [
      selectedTenant,
      name,
      firstName,
      lastName,
      emailId,
      contact,
      address,
      packages,
      defaultPackages,
    ],
  );

  const isFormValid = useMemo(
    () =>
      hasChanges &&
      isValid &&
      !!name &&
      !!firstName &&
      !!lastName &&
      !!emailId &&
      !!contact &&
      !!address &&
      (JSON.parse(packages) as string[]).length > 0,
    [
      hasChanges,
      isValid,
      name,
      firstName,
      lastName,
      emailId,
      contact,
      address,
      packages,
    ],
  );

  const prevStep = useCallback(() => {
    if (selectedTabValue === 'packages') {
      setSelectedTabValue('basic');
    }

    if (selectedTabValue === 'finish') {
      setSelectedTabValue('packages');
    }
  }, [selectedTabValue]);

  const nextStep = useCallback(() => {
    if (selectedTabValue === 'basic') {
      setSelectedTabValue('packages');
    }

    if (selectedTabValue === 'packages') {
      setSelectedTabValue('finish');
    }
  }, [selectedTabValue]);

  const showToast = useCallback(
    ({
      intent,
      title,
      body,
      footer,
      onDismiss,
    }: {
      intent: ToastIntent;
      title: string | JSX.Element;
      body: string | JSX.Element;
      footer?: string | JSX.Element;
      onDismiss?: () => void;
    }) =>
      dispatchToast(
        <Toast>
          <ToastTitle>{title}</ToastTitle>
          <ToastBody>{body}</ToastBody>
          <ToastFooter>{footer}</ToastFooter>
        </Toast>,
        {
          intent,
          timeout: 10_000,
          onStatusChange(event, data) {
            if (data.status === 'dismissed' && onDismiss) {
              onDismiss();
            }
          },
        },
      ),
    [dispatchToast],
  );

  const onSubmit = useCallback(
    async (data: CustomTenantInputProps) => {
      if (selectedTenant) {
        const tenantId = selectedTenant.id as string;

        const allPackages = (JSON.parse(data.packages!) as string[]).map(
          (packageId) => {
            return { packageId, tenantId };
          },
        );

        const res = await updateTenantAndItsPackages(
          tenantId,
          {
            name: data.name,
            firstName: data.firstName,
            lastName: data.lastName,
            contact: data.contact,
            emailId: data.emailId,
            address: data.address,
          },
          allPackages,
        );

        const onDismiss = () => {
          reset();
          setIsOpen(false);
          dismissToast(toasterId);
        };

        if (res.status === 'success') {
          showToast({
            intent: 'success',
            title: 'Success',
            body: `Updated "${res.data?.name}" tenant successfully.`,
            footer: <Button onClick={onDismiss}>Okay</Button>,
            onDismiss,
          });
        }
        if (res.status === 'error') {
          showToast({
            intent: 'error',
            title: 'Error',
            body: (
              <Text>
                Error occurred while updating tenant.
                <br />
                Error: {String(res.error)}
              </Text>
            ),
            footer: <Button onClick={onDismiss}>Okay</Button>,
            onDismiss,
          });
        }
      }
    },
    [
      dismissToast,
      reset,
      selectedTenant,
      setIsOpen,
      showToast,
      toasterId,
      updateTenantAndItsPackages,
    ],
  );

  const renderFooter = useMemo(() => {
    return (
      <DrawerFooter className="flex justify-between">
        <Button
          appearance="outline"
          disabled={selectedTabValue === 'basic' || !toasterId}
          onClick={prevStep}
        >
          Back
        </Button>
        {selectedTabValue === 'finish' ? (
          <Button
            appearance="primary"
            disabled={!isFormValid || !toasterId}
            onClick={handleSubmit(onSubmit)}
          >
            Update
          </Button>
        ) : (
          <Button appearance="primary" disabled={!toasterId} onClick={nextStep}>
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
    toasterId,
  ]);

  return {
    selectedTabValue,
    setSelectedTabValue,

    listOfPackages,

    onSubmit,
    formMethods,

    toasterId,

    renderFooter,
  };
};

export default useUpdateTenant;
