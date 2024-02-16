/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Dropdown,
  Field,
  Input,
  Option,
  OptionOnSelectData,
  SelectionEvents,
  Textarea,
} from '@fluentui/react-components';
import { DatePicker } from '@fluentui/react-datepicker-compat';
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

const Name = ({
  control,
  errors,
}: {
  control: Control<FieldValues, unknown>;
  errors: FieldErrors<FieldValues>;
}) => {
  return (
    <Controller
      control={control}
      name="name"
      rules={ValidationRules.textRequired}
      defaultValue=""
      render={({ field: { value, disabled, name, ref, onChange, onBlur } }) => (
        <Field
          required
          label="Name"
          className="h-fit"
          validationState={errors.name && 'error'}
          validationMessage={errors.name?.message as string}
        >
          <Input
            as="input"
            type="text"
            name={name}
            value={value}
            disabled={disabled}
            onChange={onChange}
            onBlur={onBlur}
            ref={ref}
          />
        </Field>
      )}
    />
  );
};

const useType = () => {
  const { setValue } = useFormContext();
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);

  const handleOptionSelect = useCallback(
    (event: SelectionEvents, data: OptionOnSelectData) => {
      setValue('type', data.optionValue);
      setSelectedOptions(data.selectedOptions);
    },
    [setValue],
  );

  return {
    handleOptionSelect,
    selectedOptions,
  };
};

const Type = ({
  control,
  errors,
}: {
  control: Control<FieldValues, unknown>;
  errors: FieldErrors<FieldValues>;
}) => {
  const { handleOptionSelect, selectedOptions } = useType();

  return (
    <Controller
      control={control}
      name="type"
      rules={ValidationRules.textRequired}
      defaultValue=""
      render={({ field: { value, disabled, name, ref, onChange, onBlur } }) => (
        <Field
          required
          label="Type"
          className="h-fit !min-w-min"
          validationState={errors.type && 'error'}
          validationMessage={errors.type?.message as string}
        >
          <Dropdown
            name={name}
            value={value}
            disabled={disabled}
            onChange={onChange}
            onBlur={onBlur}
            ref={ref}
            selectedOptions={selectedOptions}
            onOptionSelect={handleOptionSelect}
            placeholder="Select institute type"
          >
            {['University', 'Autonomous', 'Affiliated'].map((option) => (
              <Option key={option} value={option}>
                {option}
              </Option>
            ))}
          </Dropdown>
        </Field>
      )}
    />
  );
};

const useDateOfEstablishment = () => {
  const { setValue } = useFormContext();

  const handleSelectDate = useCallback(
    (date: Date | null | undefined) => {
      setValue('dateOfEstablishment', date);
    },
    [setValue],
  );

  return {
    handleSelectDate,
  };
};

const DateOfEstablishment = ({
  control,
  errors,
}: {
  control: Control<FieldValues, unknown>;
  errors: FieldErrors<FieldValues>;
}) => {
  const { handleSelectDate } = useDateOfEstablishment();

  return (
    <Controller
      control={control}
      name="dateOfEstablishment"
      rules={ValidationRules.textRequired}
      defaultValue=""
      render={({ field: { value, disabled, name, ref, onChange, onBlur } }) => (
        <Field
          required
          label="Date Of Establishment"
          className="h-fit !min-w-min"
          validationState={errors.dateOfEstablishment && 'error'}
          validationMessage={errors.dateOfEstablishment?.message as string}
        >
          <DatePicker
            name={name}
            value={value}
            disabled={disabled}
            onChange={onChange}
            onBlur={onBlur}
            ref={ref}
            onSelectDate={handleSelectDate}
            placeholder="Select a date"
          />
        </Field>
      )}
    />
  );
};

const Website = ({
  control,
  errors,
}: {
  control: Control<FieldValues, unknown>;
  errors: FieldErrors<FieldValues>;
}) => {
  return (
    <Controller
      control={control}
      name="website"
      rules={ValidationRules.urlRequired}
      defaultValue=""
      render={({ field: { value, disabled, name, ref, onChange, onBlur } }) => (
        <Field
          required
          label="Website"
          className="h-fit"
          validationState={errors.website && 'error'}
          validationMessage={errors.website?.message as string}
        >
          <Input
            as="input"
            type="text"
            name={name}
            value={value}
            disabled={disabled}
            onChange={onChange}
            onBlur={onBlur}
            ref={ref}
          />
        </Field>
      )}
    />
  );
};

const Landmark = ({
  control,
  errors,
}: {
  control: Control<FieldValues, unknown>;
  errors: FieldErrors<FieldValues>;
}) => {
  return (
    <Controller
      control={control}
      name="landmark"
      rules={ValidationRules.textRequired}
      defaultValue=""
      render={({ field: { value, disabled, name, ref, onChange, onBlur } }) => (
        <Field
          required
          label="Landmark"
          className="h-fit"
          validationState={errors.landmark && 'error'}
          validationMessage={errors.landmark?.message as string}
        >
          <Input
            as="input"
            type="text"
            name={name}
            value={value}
            disabled={disabled}
            onChange={onChange}
            onBlur={onBlur}
            ref={ref}
          />
        </Field>
      )}
    />
  );
};

const City = ({
  control,
  errors,
}: {
  control: Control<FieldValues, unknown>;
  errors: FieldErrors<FieldValues>;
}) => {
  return (
    <Controller
      control={control}
      name="city"
      rules={ValidationRules.textRequired}
      defaultValue=""
      render={({ field: { value, disabled, name, ref, onChange, onBlur } }) => (
        <Field
          required
          label="City"
          className="h-fit"
          validationState={errors.city && 'error'}
          validationMessage={errors.city?.message as string}
        >
          <Input
            as="input"
            type="text"
            name={name}
            value={value}
            disabled={disabled}
            onChange={onChange}
            onBlur={onBlur}
            ref={ref}
          />
        </Field>
      )}
    />
  );
};

const State = ({
  control,
  errors,
}: {
  control: Control<FieldValues, unknown>;
  errors: FieldErrors<FieldValues>;
}) => {
  return (
    <Controller
      control={control}
      name="state"
      rules={ValidationRules.textRequired}
      defaultValue=""
      render={({ field: { value, disabled, name, ref, onChange, onBlur } }) => (
        <Field
          required
          label="State"
          className="h-fit"
          validationState={errors.state && 'error'}
          validationMessage={errors.state?.message as string}
        >
          <Input
            as="input"
            type="text"
            name={name}
            value={value}
            disabled={disabled}
            onChange={onChange}
            onBlur={onBlur}
            ref={ref}
          />
        </Field>
      )}
    />
  );
};

const PinCode = ({
  control,
  errors,
}: {
  control: Control<FieldValues, unknown>;
  errors: FieldErrors<FieldValues>;
}) => {
  return (
    <Controller
      control={control}
      name="pin"
      rules={ValidationRules.textRequired}
      defaultValue=""
      render={({ field: { value, disabled, name, ref, onChange, onBlur } }) => (
        <Field
          required
          label="Pin Code"
          className="h-fit"
          validationState={errors.pin && 'error'}
          validationMessage={errors.pin?.message as string}
        >
          <Input
            as="input"
            type="number"
            name={name}
            value={value}
            disabled={disabled}
            onChange={onChange}
            onBlur={onBlur}
            ref={ref}
          />
        </Field>
      )}
    />
  );
};

const Address = ({
  control,
  errors,
}: {
  control: Control<FieldValues, unknown>;
  errors: FieldErrors<FieldValues>;
}) => {
  return (
    <Controller
      control={control}
      name="address"
      rules={ValidationRules.textRequired}
      defaultValue=""
      render={({ field: { value, disabled, name, ref, onChange, onBlur } }) => (
        <Field
          required
          label="Address"
          className="col-span-2"
          validationState={errors.address && 'error'}
          validationMessage={errors.address?.message as string}
        >
          <Textarea
            resize="vertical"
            name={name}
            value={value}
            disabled={disabled}
            onChange={onChange}
            onBlur={onBlur}
            ref={ref}
          />
        </Field>
      )}
    />
  );
};

const Details = () => {
  const {
    control,
    formState: { errors },
  } = useFormContext();

  return (
    <Form control={control} className="grid grid-cols-2 gap-6 py-4 h-fit">
      <Name control={control} errors={errors} />
      <Type control={control} errors={errors} />
      <DateOfEstablishment control={control} errors={errors} />
      <Website control={control} errors={errors} />
      <Landmark control={control} errors={errors} />
      <City control={control} errors={errors} />
      <State control={control} errors={errors} />
      <PinCode control={control} errors={errors} />
      <Address control={control} errors={errors} />
    </Form>
  );
};

export default Details;
