/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Combobox,
  Field,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Option,
  Text,
} from '@fluentui/react-components';
import { ModelTypes } from 'api/zeus';
import { useFormContext, Controller, Form } from 'react-hook-form';

const rules = {
  name: {
    required: {
      value: true,
      message: 'This field is required',
    },
  },
};

type Props = {
  selectedTenant: ModelTypes['Tenant'] | undefined;
  tenantsForVerification: ModelTypes['Tenant'][] | [];
};

const Select = ({ selectedTenant, tenantsForVerification }: Props) => {
  const {
    setValue,
    control,
    formState: { errors },
  } = useFormContext();

  return (
    <Form control={control} className="grid grid-cols-2 gap-6 md:max-w-md">
      {/* 1st row */}

      <Controller
        control={control}
        name="name"
        defaultValue=""
        rules={rules.name}
        disabled={tenantsForVerification.length === 0}
        render={({
          field: { value, disabled, name, ref, onChange, onBlur },
        }) => (
          <Field
            required
            label="Tenant"
            className="h-fit"
            validationState={errors.name && 'error'}
            validationMessage={errors.name?.message as string}
          >
            <Combobox
              freeform
              className="!min-w-min"
              placeholder="Select a Tenant"
              name={name}
              value={value}
              disabled={disabled}
              onChange={onChange}
              onBlur={onBlur}
              ref={ref}
              onOptionSelect={(_, data) => {
                setValue('name', data.optionText);
                setValue('id', data.optionValue);
              }}
            >
              {tenantsForVerification.map((tenant) => (
                <Option key={tenant.id as string} value={tenant.id as string}>
                  {tenant.name}
                </Option>
              ))}
            </Combobox>
          </Field>
        )}
      />
      <div />

      {tenantsForVerification.length === 0 && (
        <MessageBar intent="info" layout="multiline">
          <MessageBarBody className="pb-2">
            <MessageBarTitle>No pending tenant found</MessageBarTitle>
          </MessageBarBody>
        </MessageBar>
      )}

      {selectedTenant && (
        <>
          {/* 2nd row */}
          <Field label="Tenant Name" className="font-semibold">
            <Text className="text-gray120" weight="regular">
              {selectedTenant.name}
            </Text>
          </Field>
          <div />

          {/* 3rd row */}
          <Field label="First Name" className="font-semibold">
            <Text className="text-gray120" weight="regular">
              {selectedTenant.firstName}
            </Text>
          </Field>
          <Field label="Last Name" className="font-semibold">
            <Text className="text-gray120" weight="regular">
              {selectedTenant.lastName}
            </Text>
          </Field>

          {/* 4th row */}
          <Field label="Email Id" className="font-semibold">
            <Text className="text-gray120" weight="regular">
              {selectedTenant.emailId}
            </Text>
          </Field>
          <Field label="Contact" className="font-semibold">
            <Text className="text-gray120" weight="regular">
              {selectedTenant.contact}
            </Text>
          </Field>

          {/* 5th row */}
          <Field label="Address" className="font-semibold">
            <Text className="text-gray120" weight="regular">
              {selectedTenant.address}
            </Text>
          </Field>
        </>
      )}
    </Form>
  );
};

export default Select;
