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
  setIsOpen: Dispatch<SetStateAction<boolean>>;
};

type CustomTenantInputProps = {
  name: string;
  firstName: string;
  lastName: string;
  emailId: string;
  contact: string;
  address: string;
  packages: string;
};

const useAddTenantForVerification = ({ setIsOpen }: Props) => {
  const [selectedTabValue, setSelectedTabValue] = useState<TabValue>('basic');
  const [listOfPackages, setListOfPackages] = useState<
    ModelTypes['Package'][] | []
  >([]);
  const toasterId = useId('addTenantForVerification');
  const { dispatchToast, dismissToast } = useToastController(toasterId);

  const { getPackages } = usePackageQueries();
  const { addTenantForVerification } = useTenantMutations();

  const formMethods = useForm({
    mode: 'all',
    reValidateMode: 'onChange',
    defaultValues: {
      name: '',
      firstName: '',
      lastName: '',
      emailId: '',
      contact: '',
      address: '',
      packages: JSON.stringify([]),
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

  const isFormValid = useMemo(
    () =>
      isValid &&
      !!name &&
      !!firstName &&
      !!lastName &&
      !!emailId &&
      !!contact &&
      !!address &&
      (JSON.parse(packages) as string[]).length > 0,
    [isValid, name, firstName, lastName, emailId, contact, address, packages],
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
      const allPackages = (JSON.parse(data.packages) as string[]).map(
        (packageId) => {
          return { packageId };
        },
      );

      const res = await addTenantForVerification({
        name: data.name,
        firstName: data.firstName,
        lastName: data.lastName,
        contact: data.contact,
        emailId: data.emailId,
        address: data.address,
        packages: {
          data: allPackages,
        },
      });

      const onDismiss = () => {
        reset();
        setIsOpen(false);
        dismissToast(toasterId);
      };

      if (res.status === 'success') {
        showToast({
          intent: 'success',
          title: 'Success',
          body: `Added "${res.data?.name}" tenant for verification.`,
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
              Error occurred while adding tenant for verification.
              <br />
              Error: {String(res.error)}
            </Text>
          ),
          footer: <Button onClick={onDismiss}>Okay</Button>,
          onDismiss,
        });
      }
    },
    [
      addTenantForVerification,
      dismissToast,
      reset,
      setIsOpen,
      showToast,
      toasterId,
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
            Submit
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

export default useAddTenantForVerification;
