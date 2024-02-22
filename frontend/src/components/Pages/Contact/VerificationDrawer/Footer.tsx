import { Button, DrawerFooter } from '@fluentui/react-components';
import { actionAtom, isUpdateDrawerOpenAtom, selectedTabAtom } from 'atoms';
import { useAtomValue, useSetAtom } from 'jotai';

import useVerification from 'hooks/Contact/useVerification';

const ActionButton = () => {
  const action = useAtomValue(actionAtom);
  const { handleUpdateStatus } = useVerification();

  const verify = action === 'approve';

  return (
    <Button
      appearance="primary"
      aria-label="Verification button"
      onClick={() => handleUpdateStatus(verify)}
      className="capitalize"
    >
      {action}
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
      <ActionButton />
      <CloseButton />
    </DrawerFooter>
  );
};

export default Footer;
