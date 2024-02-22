import { Button, DrawerFooter } from '@fluentui/react-components';
import { isAddDrawerOpenAtom, selectedTabAtom } from 'atoms';
import { useAtom, useSetAtom } from 'jotai';
import { useCallback, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';

import useAdd from 'hooks/Contact/useAdd';

const useAddAndNextButton = () => {
  const [selectedTab, setSelectedTab] = useAtom(selectedTabAtom);

  const {
    handleSubmit,
    formState: { isValid },
  } = useFormContext();

  const { handleAddContact, isSuccess } = useAdd();

  const prevStep = useCallback(() => {
    if (selectedTab === 'finish') {
      setSelectedTab('details');
    }
  }, [selectedTab, setSelectedTab]);

  const nextStep = useCallback(() => {
    if (selectedTab === 'details') {
      setSelectedTab('finish');
    }
  }, [selectedTab, setSelectedTab]);

  const isDetailTabSelected = useMemo(
    () => selectedTab === 'details',
    [selectedTab],
  );

  return {
    isDetailTabSelected,
    prevStep,
    nextStep,
    isFormValid: isValid,
    isSuccess,
    handleAddContact: handleSubmit(handleAddContact),
  };
};

const BackAndNextButton = () => {
  const {
    isDetailTabSelected,
    prevStep,
    nextStep,
    isFormValid,
    handleAddContact,
    isSuccess,
  } = useAddAndNextButton();

  return (
    <div>
      <Button
        className="!mr-2"
        appearance="outline"
        aria-label="Back"
        onClick={() => {
          prevStep();
        }}
        disabled={isDetailTabSelected}
      >
        Back
      </Button>
      <Button
        appearance={isDetailTabSelected ? 'outline' : 'primary'}
        aria-label={isDetailTabSelected ? 'Next' : 'Add'}
        onClick={() => {
          return isDetailTabSelected ? nextStep() : handleAddContact();
        }}
        disabled={!isDetailTabSelected && (!isFormValid || isSuccess)}
      >
        {isDetailTabSelected ? 'Next' : 'Add'}
      </Button>
    </div>
  );
};

const CloseButton = () => {
  const setIsOpen = useSetAtom(isAddDrawerOpenAtom);
  const setSelectedTab = useSetAtom(selectedTabAtom);

  return (
    <Button
      appearance="outline"
      aria-label="Close panel"
      onClick={() => {
        setSelectedTab('details');
        setIsOpen(false);
      }}
    >
      Close
    </Button>
  );
};

const Footer = () => {
  return (
    <DrawerFooter className="!justify-between">
      <BackAndNextButton />
      <CloseButton />
    </DrawerFooter>
  );
};

export default Footer;
