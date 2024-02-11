import { Button, DrawerFooter } from '@fluentui/react-components';
import { isAddDrawerOpenAtom } from 'atoms';
import { useSetAtom } from 'jotai';
import { useFormContext } from 'react-hook-form';

import useAddInstitute from 'hooks/Institute/useAdd';

const useAddButton = () => {
  const { handleSubmit } = useFormContext();
  const { handleAddInstitute, isSuccess } = useAddInstitute();

  const {
    formState: { isValid },
  } = useFormContext();

  return {
    isFormValid: isValid,
    isSuccess,
    handleAddInstitute: handleSubmit(handleAddInstitute),
  };
};

const Add = () => {
  const { isFormValid, handleAddInstitute, isSuccess } = useAddButton();

  return (
    <Button
      appearance="primary"
      aria-label="Add"
      onClick={handleAddInstitute}
      // disabled={!isFormValid || isSuccess}
    >
      Add
    </Button>
  );
};

const CloseButton = () => {
  const setIsOpen = useSetAtom(isAddDrawerOpenAtom);
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
      <Add />
      <CloseButton />
    </DrawerFooter>
  );
};

export default Footer;
