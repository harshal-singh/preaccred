import {
  Button,
  DrawerHeader,
  DrawerHeaderTitle,
} from '@fluentui/react-components';
import { Dismiss24Regular } from '@fluentui/react-icons';
import { isUpdateDrawerOpenAtom, selectedTabAtom } from 'atoms';
import { useSetAtom } from 'jotai';

const CloseButton = () => {
  const setSelectedTab = useSetAtom(selectedTabAtom);
  const setIsOpen = useSetAtom(isUpdateDrawerOpenAtom);

  return (
    <Button
      appearance="subtle"
      aria-label="Close panel"
      icon={<Dismiss24Regular />}
      onClick={() => {
        setSelectedTab('details');
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
        Update institute
      </DrawerHeaderTitle>
    </DrawerHeader>
  );
};

export default Header;
