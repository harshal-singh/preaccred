import { Button, DrawerFooter } from '@fluentui/react-components';
import { isAddDrawerOpenAtom, selectedTabAtom } from 'atoms';
import { useAtom, useSetAtom } from 'jotai';
import { useCallback, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';

import useUpdate from 'hooks/Institute/useUpdate';

const useUpdateAndNextButton = () => {
  const [selectedTab, setSelectedTab] = useAtom(selectedTabAtom);
  const {
    handleSubmit,
    formState: { isValid },
  } = useFormContext();
  const { handleUpdateInstitute, isSuccess } = useUpdate();

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
    handleUpdateInstitute: handleSubmit(handleUpdateInstitute),
  };
};

const BackAndNextButton = () => {
  const {
    isDetailTabSelected,
    isCriteriasTabSelected,
    prevStep,
    nextStep,
    isFormValid,
    handleUpdateInstitute,
    isSuccess,
  } = useUpdateAndNextButton();

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
            : handleUpdateInstitute();
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
