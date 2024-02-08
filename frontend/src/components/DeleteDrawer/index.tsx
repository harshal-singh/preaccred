import {
  Button,
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  Text,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  DrawerFooter,
} from '@fluentui/react-components';
import { Dismiss24Regular } from '@fluentui/react-icons';
import { isDeleteDrawerOpenAtom } from 'atoms';
import { useSetAtom } from 'jotai';
import { useState } from 'react';

type Props = {
  title: string;
  message: string;
  handleDelete: () => void;
};

const useDeleteDrawer = () => {
  const setIsOpen = useSetAtom(isDeleteDrawerOpenAtom);
  const [isClickedOnce, setIsClickedOnce] = useState<boolean>(false);

  return {
    setIsOpen,
    isClickedOnce,
    setIsClickedOnce,
  };
};

const DeleteDrawer = ({ title, message, handleDelete }: Props) => {
  const { setIsOpen, isClickedOnce, setIsClickedOnce } = useDeleteDrawer();

  return (
    <Drawer
      size="small"
      position="end"
      open
      onOpenChange={() => {
        setIsOpen(false);
      }}
    >
      <DrawerHeader>
        <DrawerHeaderTitle
          action={
            <Button
              appearance="subtle"
              aria-label="Close panel"
              icon={<Dismiss24Regular />}
              onClick={() => {
                setIsOpen(false);
              }}
            />
          }
        >
          {title}
        </DrawerHeaderTitle>
      </DrawerHeader>
      <DrawerBody className="border-y">
        <MessageBar intent="warning" layout="multiline" className="my-6">
          <MessageBarBody className="pb-2">
            <MessageBarTitle>You are about to delete.</MessageBarTitle>
          </MessageBarBody>
        </MessageBar>
        <Text>{message}</Text>
      </DrawerBody>
      <DrawerFooter>
        <Button
          disabled={isClickedOnce}
          appearance="primary"
          aria-label="Delete"
          onClick={() => {
            handleDelete();
            setIsClickedOnce(true);
          }}
        >
          Delete
        </Button>
        <Button
          appearance="outline"
          aria-label="Close panel"
          onClick={() => {
            setIsOpen(false);
          }}
        >
          Close
        </Button>
      </DrawerFooter>
    </Drawer>
  );
};

export default DeleteDrawer;
