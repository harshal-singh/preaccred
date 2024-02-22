/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Field, Input } from '@fluentui/react-components';
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

const CollegeName = ({
  control,
  errors,
}: {
  control: Control<FieldValues, unknown>;
  errors: FieldErrors<FieldValues>;
}) => {
  return (
    <Controller
      control={control}
      name="collegeName"
      rules={ValidationRules.textRequired}
      defaultValue=""
      render={({ field: { value, disabled, name, ref, onChange, onBlur } }) => (
        <Field
          required
          label="College Name"
          className="h-fit"
          validationState={errors.collegeName && 'error'}
          validationMessage={errors.collegeName?.message as string}
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

const PhoneNo = ({
  control,
  errors,
}: {
  control: Control<FieldValues, unknown>;
  errors: FieldErrors<FieldValues>;
}) => {
  return (
    <Controller
      control={control}
      name="phoneNo"
      rules={ValidationRules.phoneNoRequired}
      defaultValue=""
      render={({ field: { value, disabled, name, ref, onChange, onBlur } }) => (
        <Field
          required
          label="Phone No"
          className="h-fit"
          validationState={errors.phoneNo && 'error'}
          validationMessage={errors.phoneNo?.message as string}
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

const PrimaryEmailId = ({
  control,
  errors,
}: {
  control: Control<FieldValues, unknown>;
  errors: FieldErrors<FieldValues>;
}) => {
  return (
    <Controller
      control={control}
      name="primaryEmailId"
      rules={ValidationRules.emailRequired}
      defaultValue=""
      render={({ field: { value, disabled, name, ref, onChange, onBlur } }) => (
        <Field
          required
          label="Primary Email"
          className="h-fit"
          validationState={errors.primaryEmailId && 'error'}
          validationMessage={errors.primaryEmailId?.message as string}
        >
          <Input
            as="input"
            type="email"
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

const SecondaryEmailId = ({
  control,
  errors,
}: {
  control: Control<FieldValues, unknown>;
  errors: FieldErrors<FieldValues>;
}) => {
  return (
    <Controller
      control={control}
      name="secondaryEmailId"
      rules={ValidationRules.emailRequired}
      defaultValue=""
      render={({ field: { value, disabled, name, ref, onChange, onBlur } }) => (
        <Field
          required
          label="Secondary Email"
          className="h-fit"
          validationState={errors.secondaryEmailId && 'error'}
          validationMessage={errors.secondaryEmailId?.message as string}
        >
          <Input
            as="input"
            type="email"
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
      <CollegeName control={control} errors={errors} />
      <div />
      <Name control={control} errors={errors} />
      <PhoneNo control={control} errors={errors} />
      <PrimaryEmailId control={control} errors={errors} />
      <SecondaryEmailId control={control} errors={errors} />
    </Form>
  );
};

export default Details;
