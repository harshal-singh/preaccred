/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Button,
  Dropdown,
  Field,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Option,
  Spinner,
} from '@fluentui/react-components';
import { ModelTypes } from 'api/zeus';
import { Dispatch, SetStateAction, useState } from 'react';
import {
  Controller,
  ControllerRenderProps,
  FieldValues,
  Form,
  useFormContext,
} from 'react-hook-form';

const rules = {
  packages: {
    required: {
      value: true,
      message: 'This field is required',
    },
  },
};

type EmailStatus = 'none' | 'sending' | 'sent';

type VerificationButtonProps = {
  emailStatus: string;
  setEmailStatus: Dispatch<SetStateAction<EmailStatus>>;
  field: ControllerRenderProps<FieldValues, 'isVerificationMailSent'>;
};

const sendVerificationEmail = ({
  setEmailStatus,
}: Omit<VerificationButtonProps, 'emailStatus' | 'field'>) => {
  setEmailStatus('sending');
  // send mail logic
};

const VerificationButton = ({
  emailStatus,
  setEmailStatus,
  field,
}: VerificationButtonProps) => {
  if (emailStatus === 'sent') {
    return (
      <MessageBar intent="success">
        <MessageBarBody>
          <MessageBarTitle>Verification email sent</MessageBarTitle>
        </MessageBarBody>
      </MessageBar>
    );
  }

  const isSending = emailStatus === 'sending';

  return (
    <Button
      className="h-fit"
      appearance="primary"
      name={field.name}
      disabled={isSending || field.disabled}
      onClick={() => sendVerificationEmail({ setEmailStatus })}
      onChange={field.onChange}
      onBlur={field.onBlur}
      ref={field.ref}
    >
      {isSending && <Spinner size="extra-tiny" className="mr-2" />}
      Send verification email
    </Button>
  );
};

type Props = {
  selectedTenant: ModelTypes['Tenant'] | undefined;
  listOfPackages: ModelTypes['Package'][] | [];
};

const Packages = ({ selectedTenant, listOfPackages }: Props) => {
  const [emailStatus, setEmailStatus] = useState<EmailStatus>('none');

  const {
    setValue,
    control,
    watch,
    formState: { errors },
  } = useFormContext();

  if (listOfPackages.length === 0) {
    return (
      <MessageBar intent="info" layout="multiline">
        <MessageBarBody className="pb-2">
          <MessageBarTitle>No pending tenant found</MessageBarTitle>
        </MessageBarBody>
      </MessageBar>
    );
  }

  const selectedPackages = JSON.parse(watch('packages') as string) as string[];

  const selectedPackagesName = selectedPackages
    .map((packageId) => listOfPackages.find((p) => p.id === packageId))
    .map((p) => p?.name)
    .join(', ');

  return (
    <Form control={control} className="grid grid-cols-2 gap-6 md:max-w-md">
      {/* 1st row */}
      <Controller
        control={control}
        name="packages"
        rules={rules.packages}
        render={({ field: { disabled, name, ref, onChange, onBlur } }) => (
          <Field
            required
            label="Select Packages"
            className="h-fit"
            validationState={errors.packages && 'error'}
            validationMessage={errors.packages?.message as string}
          >
            <Dropdown
              className="!min-w-min"
              aria-labelledby="select-packages"
              placeholder="Select packages"
              multiselect
              name={name}
              disabled={disabled}
              value={selectedPackagesName}
              onOptionSelect={(_, data) => {
                setValue('packages', JSON.stringify(data.selectedOptions));
              }}
              selectedOptions={selectedPackages}
              onChange={onChange}
              onBlur={onBlur}
              ref={ref}
            >
              {listOfPackages.map((p) => (
                <Option key={p.id as string} value={p.id as string}>
                  {p.name}
                </Option>
              ))}
            </Dropdown>
          </Field>
        )}
      />
      <div />

      {/* 2nd row */}
      <Controller
        control={control}
        name="isVerificationMailSent"
        disabled={selectedPackages.length === 0}
        render={({ field }) => (
          <VerificationButton
            emailStatus={emailStatus}
            setEmailStatus={setEmailStatus}
            field={field}
          />
        )}
      />
    </Form>
  );
};

export default Packages;
