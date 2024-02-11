import { Button, DrawerFooter } from '@fluentui/react-components';
import { isUpdateDrawerOpenAtom, selectedInstituteAtom } from 'atoms';
import { useAtomValue, useSetAtom } from 'jotai';
import { useFormContext } from 'react-hook-form';

import useUpdateInstitute from 'hooks/Institute/useUpdate';

const useUpdateButton = () => {
  const selectedInstitute = useAtomValue(selectedInstituteAtom);
  const { handleSubmit, watch } = useFormContext();
  const { handleUpdateInstitute, isSuccess } = useUpdateInstitute();

  const hasChanges =
    selectedInstitute?.name !== watch('name') ||
    selectedInstitute?.website !== watch('website') ||
    selectedInstitute?.date_of_establishment !==
      watch('date_of_establishment') ||
    selectedInstitute?.type !== watch('type') ||
    selectedInstitute?.address !== watch('address') ||
    selectedInstitute?.landmark !== watch('landmark') ||
    selectedInstitute?.city !== watch('city') ||
    selectedInstitute?.state !== watch('state') ||
    selectedInstitute?.pin !== watch('pin');

  const {
    formState: { isValid },
  } = useFormContext();

  return {
    isFormValid: hasChanges && isValid,
    isSuccess,
    handleUpdateInstitute: handleSubmit(handleUpdateInstitute),
  };
};

const Update = () => {
  const { isFormValid, handleUpdateInstitute, isSuccess } = useUpdateButton();

  return (
    <Button
      appearance="primary"
      aria-label="Update"
      onClick={handleUpdateInstitute}
      disabled={!isFormValid || isSuccess}
    >
      Update
    </Button>
  );
};

const CloseButton = () => {
  const setIsOpen = useSetAtom(isUpdateDrawerOpenAtom);
  return (
    <Button
      appearance="outline"
      aria-label="Close panel"
      onClick={() => {
        setIsOpen(false);
      }}
    >
      Close
    </Button>
  );
};

const Footer = () => {
  return (
    <DrawerFooter>
      <Update />
      <CloseButton />
    </DrawerFooter>
  );
};

export default Footer;
