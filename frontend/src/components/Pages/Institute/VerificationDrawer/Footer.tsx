import { Button, DrawerFooter } from '@fluentui/react-components';
import { actionAtom, isUpdateDrawerOpenAtom, selectedTabAtom } from 'atoms';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';

import useVerification from 'hooks/Institute/useVerification';

const ActionButton = () => {
  const action = useAtomValue(actionAtom);
  const { handleResendEmail, handleUpdateStatus } = useVerification();

  const actionText = action === 'resendEmail' ? 'resend email' : action;

  const verify = action === 'approve';

  const handleClick =
    action === 'resendEmail'
      ? handleResendEmail
      : () => handleUpdateStatus(verify);

  return (
    <Button
      appearance="primary"
      aria-label="Verification button"
      onClick={handleClick}
      className="capitalize"
    >
      {actionText}
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
