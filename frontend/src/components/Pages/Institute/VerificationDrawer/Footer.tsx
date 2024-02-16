import { Button, DrawerFooter } from '@fluentui/react-components';
import { isAddDrawerOpenAtom, selectedTabAtom } from 'atoms';
import { useAtom, useSetAtom } from 'jotai';
import { useCallback, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';

import useAdd from 'hooks/Institute/useAdd';

const useAddAndNextButton = () => {
  const [selectedTab, setSelectedTab] = useAtom(selectedTabAtom);
  const {
    handleSubmit,
    formState: { isValid },
  } = useFormContext();
  const { handleAddInstitute, isSuccess } = useAdd();

  const prevStep = useCallback(() => {
    if (selectedTab === 'finish') {
      setSelectedTab('criterias');
    }
    if (selectedTab === 'criterias') {
      setSelectedTab('details');
    }
  }, [selectedTab, setSelectedTab]);

  const nextStep = useCallback(() => {
    if (selectedTab === 'details') {
      setSelectedTab('criterias');
    }
    if (selectedTab === 'criterias') {
      setSelectedTab('finish');
    }
  }, [selectedTab, setSelectedTab]);

  const isDetailTabSelected = useMemo(
    () => selectedTab === 'details',
    [selectedTab],
  );
  const isCriteriasTabSelected = useMemo(
    () => selectedTab === 'criterias',
    [selectedTab],
  );

  return {
    isDetailTabSelected,
    isCriteriasTabSelected,
    prevStep,
    nextStep,
    isFormValid: isValid,
    isSuccess,
    handleAddInstitute: handleSubmit(handleAddInstitute),
  };
};

const BackAndNextButton = () => {
  const {
    isDetailTabSelected,
    isCriteriasTabSelected,
    prevStep,
    nextStep,
    isFormValid,
    handleAddInstitute,
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
        appearance={
          isDetailTabSelected || isCriteriasTabSelected ? 'outline' : 'primary'
        }
        aria-label={
          isDetailTabSelected || isCriteriasTabSelected ? 'Next' : 'Add'
        }
        onClick={() => {
          return isDetailTabSelected || isCriteriasTabSelected
            ? nextStep()
            : handleAddInstitute();
        }}
        disabled={
          !isDetailTabSelected &&
          !isCriteriasTabSelected &&
          (!isFormValid || isSuccess)
        }
      >
        {isDetailTabSelected || isCriteriasTabSelected ? 'Next' : 'Add'}
      </Button>
    </div>
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
    <DrawerFooter className="!justify-between">
      <BackAndNextButton />
      <CloseButton />
    </DrawerFooter>
  );
};

export default Footer;
