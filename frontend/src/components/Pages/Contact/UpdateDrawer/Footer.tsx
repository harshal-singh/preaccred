import { Button, DrawerFooter } from '@fluentui/react-components';
import {
  isUpdateDrawerOpenAtom,
  selectedContactAtom,
  selectedTabAtom,
} from 'atoms';
import { useAtom, useSetAtom } from 'jotai';
import { useCallback, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';

import useUpdate from 'hooks/Contact/useUpdate';

const useBackNextAndUpdateButton = () => {
  const [selectedTab, setSelectedTab] = useAtom(selectedTabAtom);

  const {
    handleSubmit,
    formState: { isValid },
  } = useFormContext();

  const { handleUpdateContact, isSuccess } = useUpdate();

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
    handleUpdateContact: handleSubmit(handleUpdateContact),
  };
};

const BackNextAndUpdateButton = () => {
  const {
    isDetailTabSelected,
    prevStep,
    nextStep,
    isFormValid,
    handleUpdateContact,
    isSuccess,
  } = useBackNextAndUpdateButton();

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
        aria-label={isDetailTabSelected ? 'Next' : 'Update'}
        onClick={() => {
          return isDetailTabSelected ? nextStep() : handleUpdateContact();
        }}
        disabled={!isDetailTabSelected && (!isFormValid || isSuccess)}
      >
        {isDetailTabSelected ? 'Next' : 'Update'}
      </Button>
    </div>
  );
};

const CloseButton = () => {
  const setIsOpen = useSetAtom(isUpdateDrawerOpenAtom);
  const setSelectedTab = useSetAtom(selectedTabAtom);
  const setSelectedContact = useSetAtom(selectedContactAtom);

  return (
    <Button
      appearance="outline"
      aria-label="Close panel"
      onClick={() => {
        setSelectedContact(null);
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
      <BackNextAndUpdateButton />
      <CloseButton />
    </DrawerFooter>
  );
};

export default Footer;
