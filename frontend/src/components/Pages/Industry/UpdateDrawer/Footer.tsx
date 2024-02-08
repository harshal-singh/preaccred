import { Button, DrawerFooter } from '@fluentui/react-components';
import { useAtomValue, useSetAtom } from 'jotai';
import { useFormContext } from 'react-hook-form';

import {
  isUpdateIndustryDrawerOpenAtom,
  selectedIndustryAtom,
} from 'atoms/Industry';

import useUpdateIndustry from 'hooks/Industry/useUpdateIndustry';

const useUpdateButton = () => {
  const selectedIndustry = useAtomValue(selectedIndustryAtom);
  const { handleSubmit, watch } = useFormContext();
  const { handleUpdateIndustry, isSuccess } = useUpdateIndustry();

  const hasChanges =
    selectedIndustry?.name !== watch('name') ||
    selectedIndustry?.description !== watch('description');

  const {
    formState: { isValid },
  } = useFormContext();

  return {
    isFormValid: hasChanges && isValid,
    isSuccess,
    handleUpdateIndustry: handleSubmit(handleUpdateIndustry),
  };
};

const Update = () => {
  const { isFormValid, handleUpdateIndustry, isSuccess } = useUpdateButton();

  return (
    <Button
      appearance="primary"
      aria-label="Update"
      onClick={handleUpdateIndustry}
      disabled={!isFormValid || isSuccess}
    >
      Update
    </Button>
  );
};

const CloseButton = () => {
  const setIsOpen = useSetAtom(isUpdateIndustryDrawerOpenAtom);
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
