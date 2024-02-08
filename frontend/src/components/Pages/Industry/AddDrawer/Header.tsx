import {
  Button,
  DrawerHeader,
  DrawerHeaderTitle,
} from '@fluentui/react-components';
import { Dismiss24Regular } from '@fluentui/react-icons';
import { useSetAtom } from 'jotai';

import { isAddIndustryDrawerOpenAtom } from 'atoms/Industry';

const CloseButton = () => {
  const setIsOpen = useSetAtom(isAddIndustryDrawerOpenAtom);

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
        Add industry
      </DrawerHeaderTitle>
    </DrawerHeader>
  );
};

export default Header;
