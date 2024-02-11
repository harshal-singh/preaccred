import {
  Button,
  DrawerHeader,
  DrawerHeaderTitle,
} from '@fluentui/react-components';
import { Dismiss24Regular } from '@fluentui/react-icons';
import { isAddDrawerOpenAtom } from 'atoms';
import { useSetAtom } from 'jotai';

const CloseButton = () => {
  const setIsOpen = useSetAtom(isAddDrawerOpenAtom);

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
        Add institute
      </DrawerHeaderTitle>
    </DrawerHeader>
  );
};

export default Header;
