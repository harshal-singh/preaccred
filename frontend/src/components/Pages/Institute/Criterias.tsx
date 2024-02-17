/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Button,
  Dropdown,
  Field,
  Option,
  OptionOnSelectData,
  SelectionEvents,
  Spinner,
} from '@fluentui/react-components';
import { useCallback, useState } from 'react';
import {
  useFormContext,
  Form,
  Controller,
  FieldValues,
  Control,
  FieldErrors,
} from 'react-hook-form';

import ValidationRules from 'helpers/rules';

type EmailStatus = 'none' | 'sending' | 'sent';

const useCriteriasDropdown = () => {
  const { setValue } = useFormContext();
  const [selectedOptions, setSelectedOptions] = useState<string[]>([
    'Criteria 6',
  ]);

  const handleOptionSelect = useCallback(
    (event: SelectionEvents, data: OptionOnSelectData) => {
      setValue('criterias', data.selectedOptions.join(', '));
      setSelectedOptions(data.selectedOptions);
    },
    [setValue],
  );

  return {
    handleOptionSelect,
    selectedOptions,
  };
};

const CriteriasDropdown = ({
  control,
  errors,
}: {
  control: Control<FieldValues, unknown>;
  errors: FieldErrors<FieldValues>;
}) => {
  const { handleOptionSelect, selectedOptions } = useCriteriasDropdown();

  return (
    <Controller
      control={control}
      name="criterias"
      rules={ValidationRules.textRequired}
      defaultValue="Criteria 6"
      render={({ field: { value, disabled, name, ref, onChange, onBlur } }) => (
        <Field
          required
          label="Select Criteria's"
          className="h-fit"
          validationState={errors.criterias && 'error'}
          validationMessage={errors.criterias?.message as string}
        >
          <Dropdown
            multiselect
            name={name}
            value={value}
            disabled={disabled}
            onChange={onChange}
            onBlur={onBlur}
            ref={ref}
            selectedOptions={selectedOptions}
            onOptionSelect={handleOptionSelect}
            placeholder="Select criteria's"
          >
            {[
              'Criteria 1',
              'Criteria 2',
              'Criteria 3',
              'Criteria 4',
              'Criteria 5',
              'Criteria 6',
              'Criteria 7',
            ].map((option) => (
              <Option key={option} value={option} disabled>
                {option}
              </Option>
            ))}
          </Dropdown>
        </Field>
      )}
    />
  );
};

const SendEmailButton = ({
  control,
}: {
  control: Control<FieldValues, unknown>;
}) => {
  const [emailStatus, setEmailStatus] = useState<EmailStatus>('none');
  const isSending = emailStatus === 'sending';

  return (
    <Controller
      control={control}
      name="isVerificationMailSent"
      render={({ field: { value, disabled, name, ref, onChange, onBlur } }) => (
        <Button
          className="h-fit"
          appearance="primary"
          name={name}
          disabled={isSending || disabled}
          onClick={() => setEmailStatus('sending')}
          onChange={onChange}
          onBlur={onBlur}
          ref={ref}
        >
          {isSending && <Spinner size="extra-tiny" className="mr-2" />}
          Send verification email
        </Button>
      )}
    />
  );
};

const Criterias = () => {
  const {
    control,
    formState: { errors },
  } = useFormContext();

  return (
    <Form control={control} className="grid grid-cols-2 gap-6 py-4 h-fit">
      <CriteriasDropdown control={control} errors={errors} />
      <div />
      <SendEmailButton control={control} />
    </Form>
  );
};

export default Criterias;
