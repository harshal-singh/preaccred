import {
  Button,
  DrawerHeader,
  DrawerHeaderTitle,
} from '@fluentui/react-components';
import { Dismiss24Regular } from '@fluentui/react-icons';
import {
  isUpdateDrawerOpenAtom,
  selectedContactAtom,
  selectedTabAtom,
} from 'atoms';
import { useSetAtom } from 'jotai';

const CloseButton = () => {
  const setIsOpen = useSetAtom(isUpdateDrawerOpenAtom);
  const setSelectedTab = useSetAtom(selectedTabAtom);
  const setSelectedContact = useSetAtom(selectedContactAtom);

  return (
    <Button
      appearance="subtle"
      aria-label="Close panel"
      icon={<Dismiss24Regular />}
      onClick={() => {
        setSelectedContact(null);
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
        Update contact
      </DrawerHeaderTitle>
    </DrawerHeader>
  );
};

export default Header;
