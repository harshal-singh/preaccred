import {
  Dropdown,
  Field,
  Input,
  Option,
  Textarea,
} from '@fluentui/react-components';
import { DatePicker } from '@fluentui/react-datepicker-compat';
import { useState } from 'react';
import {
  useFormContext,
  Form,
  Controller,
  FieldValues,
  Control,
  FieldErrors,
} from 'react-hook-form';

const rules = {
  textRequired: {
    required: {
      value: true,
      message: 'This field is required',
    },
    maxLength: {
      value: 250,
      message: 'Maximum length should be 250',
    },
  },
  textNotRequired: {
    maxLength: {
      value: 250,
      message: 'Maximum length should be 250',
    },
  },
};

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
      rules={rules.textRequired}
      defaultValue=""
      render={({ field: { value, disabled, name, ref, onChange, onBlur } }) => (
        <Field
          required
          label="Name"
          className="h-fit"
          validationState={errors.name && 'error'}
          validationMessage={errors.name?.message}
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

const Type = ({
  control,
  errors,
}: {
  control: Control<FieldValues, unknown>;
  errors: FieldErrors<FieldValues>;
}) => {
  return (
    <Controller
      control={control}
      name="type"
      rules={rules.textRequired}
      defaultValue=""
      render={({ field: { value, disabled, name, ref, onChange, onBlur } }) => (
        <Field
          required
          label="Type"
          className="h-fit"
          validationState={errors.type && 'error'}
          validationMessage={errors.type?.message}
        >
          <Dropdown placeholder="Select institute type">
            {['University', 'Autonomous', 'Affiliated'].map((option) => (
              <Option key={option}>{option}</Option>
            ))}
          </Dropdown>
        </Field>
      )}
    />
  );
};

const DateOfEstablishment = ({
  control,
  errors,
}: {
  control: Control<FieldValues, unknown>;
  errors: FieldErrors<FieldValues>;
}) => {
  const [selectedDate, setSelectedDate] = useState<Date | null | undefined>(
    null,
  );

  return (
    <Controller
      control={control}
      name="date_of_establishment"
      rules={rules.textRequired}
      defaultValue=""
      render={({ field: { value, disabled, name, ref, onChange, onBlur } }) => (
        <Field
          required
          label="Date Of Establishment"
          className="h-fit"
          validationState={errors.date_of_establishment && 'error'}
          validationMessage={errors.date_of_establishment?.message}
        >
          <DatePicker
            value={selectedDate}
            onSelectDate={setSelectedDate}
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
      rules={rules.textRequired}
      defaultValue=""
      render={({ field: { value, disabled, name, ref, onChange, onBlur } }) => (
        <Field
          required
          label="Website"
          className="h-fit"
          validationState={errors.website && 'error'}
          validationMessage={errors.website?.message}
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
      rules={rules.textRequired}
      defaultValue=""
      render={({ field: { value, disabled, name, ref, onChange, onBlur } }) => (
        <Field
          required
          label="Landmark"
          className="h-fit"
          validationState={errors.landmark && 'error'}
          validationMessage={errors.landmark?.message}
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
      rules={rules.textRequired}
      defaultValue=""
      render={({ field: { value, disabled, name, ref, onChange, onBlur } }) => (
        <Field
          required
          label="City"
          className="h-fit"
          validationState={errors.city && 'error'}
          validationMessage={errors.city?.message}
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
      rules={rules.textRequired}
      defaultValue=""
      render={({ field: { value, disabled, name, ref, onChange, onBlur } }) => (
        <Field
          required
          label="State"
          className="h-fit"
          validationState={errors.state && 'error'}
          validationMessage={errors.state?.message}
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
      rules={rules.textRequired}
      defaultValue=""
      render={({ field: { value, disabled, name, ref, onChange, onBlur } }) => (
        <Field
          required
          label="Pin Code"
          className="h-fit"
          validationState={errors.pin && 'error'}
          validationMessage={errors.pin?.message}
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
      rules={rules.textRequired}
      defaultValue=""
      render={({ field: { value, disabled, name, ref, onChange, onBlur } }) => (
        <Field
          required
          label="Address"
          className="col-span-2"
          validationState={errors.address && 'error'}
          validationMessage={errors.address?.message}
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

const Body = () => {
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

export default Body;