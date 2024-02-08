import {
  Button,
  DrawerHeader,
  DrawerHeaderTitle,
} from '@fluentui/react-components';
import { Dismiss24Regular } from '@fluentui/react-icons';
import { useSetAtom } from 'jotai';

import { isUpdateIndustryDrawerOpenAtom } from 'atoms/Industry';

const CloseButton = () => {
  const setIsOpen = useSetAtom(isUpdateIndustryDrawerOpenAtom);

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
  return (
    <DrawerHeader>
      <DrawerHeaderTitle action={<CloseButton />}>
        Update industry
      </DrawerHeaderTitle>
    </DrawerHeader>
  );
};

export default Header;
