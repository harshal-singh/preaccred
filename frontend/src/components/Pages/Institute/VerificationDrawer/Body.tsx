import {
  Field,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Text,
} from '@fluentui/react-components';
import { actionAtom, selectedInstituteAtom } from 'atoms';
import { useAtomValue } from 'jotai';

const Body = () => {
  const action = useAtomValue(actionAtom);
  const selectedInstitute = useAtomValue(selectedInstituteAtom);

  const actionText = action === 'resendEmail' ? 'resend email' : action;

  return (
    <>
      <MessageBar intent="info" layout="multiline" className="my-6">
        <MessageBarBody className="pb-2">
          <MessageBarTitle>
            You are about to {actionText}
            {actionText === 'resendEmail' && 'to'} the institute
          </MessageBarTitle>
        </MessageBarBody>
      </MessageBar>
      <Text>
        Are you sure you want to {actionText}
        {actionText === 'resendEmail' && 'to'} the following institute?
      </Text>
      <div className="flex flex-col gap-4 mt-6">
        <Field label="Name" className="font-semibold">
          <Text>{selectedInstitute?.name}</Text>
        </Field>
        <Field label="Type" className="font-semibold">
          <Text>{selectedInstitute?.type}</Text>
        </Field>
        <Field label="City" className="font-semibold">
          <Text>{selectedInstitute?.city}</Text>
        </Field>
      </div>
    </>
  );
};

export default Body;
