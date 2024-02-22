import {
  Field,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Text,
} from '@fluentui/react-components';
import { actionAtom, selectedContactAtom } from 'atoms';
import { useAtomValue } from 'jotai';

const Body = () => {
  const action = useAtomValue(actionAtom);
  const selectedContact = useAtomValue(selectedContactAtom);

  return (
    <>
      <MessageBar intent="info" layout="multiline" className="my-6">
        <MessageBarBody className="pb-2">
          <MessageBarTitle>
            You are about to {action} the contact
          </MessageBarTitle>
        </MessageBarBody>
      </MessageBar>
      <Text>Are you sure you want to {action} the following contact?</Text>
      <div className="flex flex-col gap-4 mt-6">
        <Field label="Name" className="font-semibold">
          <Text>{selectedContact?.name}</Text>
        </Field>
        <Field label="College Name" className="font-semibold">
          <Text>{selectedContact?.collegeName}</Text>
        </Field>
      </div>
    </>
  );
};

export default Body;
