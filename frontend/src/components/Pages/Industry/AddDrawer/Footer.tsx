import { Button, DrawerFooter } from '@fluentui/react-components';
import { useSetAtom } from 'jotai';
import { useFormContext } from 'react-hook-form';

import { isAddIndustryDrawerOpenAtom } from 'atoms/Industry';

import useAddIndustry from 'hooks/Industry/useAddIndustry';

const useAddButton = () => {
  const { handleSubmit } = useFormContext();
  const { handleAddIndustry, isSuccess } = useAddIndustry();

  const {
    formState: { isValid },
  } = useFormContext();

  return {
    isFormValid: isValid,
    isSuccess,
    handleAddIndustry: handleSubmit(handleAddIndustry),
  };
};

const Add = () => {
  const { isFormValid, handleAddIndustry, isSuccess } = useAddButton();

  return (
    <Button
      appearance="primary"
      aria-label="Add"
      onClick={handleAddIndustry}
      disabled={!isFormValid || isSuccess}
    >
      Add
    </Button>
  );
};

const CloseButton = () => {
  const setIsOpen = useSetAtom(isAddIndustryDrawerOpenAtom);
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
