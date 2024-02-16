import {
  Button,
  DrawerHeader,
  DrawerHeaderTitle,
} from '@fluentui/react-components';
import { Dismiss24Regular } from '@fluentui/react-icons';
import { isUpdateDrawerOpenAtom, actionAtom } from 'atoms';
import { useAtomValue, useSetAtom } from 'jotai';

const CloseButton = () => {
  const setIsOpen = useSetAtom(isUpdateDrawerOpenAtom);

  return (
    <Button
      appearance="subtle"
      aria-label="Close panel"
      icon={<Dismiss24Regular />}
      onClick={() => {
        setIsOpen(false);
      }}
      className="!ml-auto"
    />
  );
};

const Header = () => {
  const action = useAtomValue(actionAtom);
  const actionText = action === 'resendEmail' ? 'resend email' : action;

  return (
    <DrawerHeader>
      <DrawerHeaderTitle action={<CloseButton />}>
        {actionText}
      </DrawerHeaderTitle>
    </DrawerHeader>
  );
};

export default Header;
