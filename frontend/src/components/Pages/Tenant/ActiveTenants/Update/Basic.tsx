/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Field, Input, Textarea } from '@fluentui/react-components';
import { ModelTypes } from 'api/zeus';
import { useFormContext, Controller, Form } from 'react-hook-form';

const rules = {
  name: {
    required: {
      value: true,
      message: 'This field is required',
    },
  },
  firstName: {
    required: {
      value: true,
      message: 'This field is required',
    },
  },
  lastName: {
    required: {
      value: true,
      message: 'This field is required',
    },
  },
  emailId: {
    required: {
      value: true,
      message: 'This field is required',
    },
    pattern: {
      value: /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/,
      message: 'Please enter a valid email id',
    },
  },
  contact: {
    required: {
      value: true,
      message: 'This field is required',
    },
    pattern: {
      value: /^[\d+-]+$/,
      message: 'Please enter a valid contact number',
    },
    minLength: {
      value: 6,
      message: 'Minimum length should be 6',
    },
    maxLength: {
      value: 15,
      message: 'Maximum length should be 15',
    },
  },
  address: {
    required: {
      value: true,
      message: 'This field is required',
    },
    minLength: {
      value: 25,
      message: 'Minimum length should be 25',
    },
    maxLength: {
      value: 250,
      message: 'Maximum length should be 250',
    },
  },
};

type Props = {
  selectedTenant: ModelTypes['Tenant'] | undefined;
};

const Basic = ({ selectedTenant }: Props) => {
  const {
    control,
    formState: { errors },
  } = useFormContext();

  return (
    <Form control={control} className="grid grid-cols-2 gap-6 md:max-w-md">
      {/* 1st row */}
      <Controller
        control={control}
        name="name"
        rules={rules.name}
        defaultValue=""
        render={({
          field: { value, disabled, name, ref, onChange, onBlur },
        }) => (
          <Field
            required
            label="Tenant Name"
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
      <div />

      {/* 2nd row */}
      <Controller
        control={control}
        name="firstName"
        rules={rules.firstName}
        defaultValue=""
        render={({
          field: { value, disabled, name, ref, onChange, onBlur },
        }) => (
          <Field
            required
            label="First Name"
            className="h-fit"
            validationState={errors.firstName && 'error'}
            validationMessage={errors.firstName?.message as string}
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
      <Controller
        control={control}
        name="lastName"
        rules={rules.lastName}
        defaultValue=""
        render={({
          field: { value, disabled, name, ref, onChange, onBlur },
        }) => (
          <Field
            required
            label="Last Name"
            className="h-fit"
            validationState={errors.lastName && 'error'}
            validationMessage={errors.lastName?.message as string}
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

      {/* 3rd row */}
      <Controller
        control={control}
        name="emailId"
        rules={rules.emailId}
        defaultValue=""
        render={({
          field: { value, disabled, name, ref, onChange, onBlur },
        }) => (
          <Field
            required
            label="Email Id"
            className="h-fit"
            validationState={errors.emailId && 'error'}
            validationMessage={errors.emailId?.message as string}
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
      <Controller
        control={control}
        name="contact"
        rules={rules.contact}
        defaultValue=""
        render={({
          field: { value, disabled, name, ref, onChange, onBlur },
        }) => (
          <Field
            required
            label="Contact"
            className="h-fit"
            validationState={errors.contact && 'error'}
            validationMessage={errors.contact?.message as string}
          >
            <Input
              as="input"
              type="tel"
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

      {/* 4th row */}
      <Controller
        control={control}
        name="address"
        rules={rules.address}
        defaultValue=""
        render={({
          field: { value, disabled, name, ref, onChange, onBlur },
        }) => (
          <Field
            label="Address"
            className="col-span-full"
            required
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
    </Form>
  );
};

export default Basic;
