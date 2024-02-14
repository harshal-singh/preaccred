/* eslint-disable jsx-a11y/anchor-is-valid */
import { Divider, Field, Link, Text } from '@fluentui/react-components';
import { ModelTypes } from 'api/zeus';
import { Dispatch } from 'react';
import { Form, useFormContext } from 'react-hook-form';

type Props = {
  setSelectedTabValue: Dispatch<unknown>;
  selectedTenant: ModelTypes['Tenant'] | undefined;
};

const Finish = ({ setSelectedTabValue, selectedTenant }: Props) => {
  const {
    getValues,
    control,
    formState: { errors },
  } = useFormContext();

  const renderLink = (tabName: string) => {
    return <Link onClick={() => setSelectedTabValue(tabName)}>Edit</Link>;
  };

  return (
    <Form control={control} className="md:max-w-md">
      <div className="flex flex-col gap-2 mb-4">
        <Text as="h3" size={500} weight="semibold">
          Review
        </Text>
        <Text as="p">
          Almost there! Please ensure that the following details are correct
        </Text>
      </div>
      <Divider />
      <div className="flex flex-col gap-4 mt-8">
        <Text weight="semibold">Details</Text>
        <Field
          label="Tenant Name:"
          orientation="horizontal"
          hint={renderLink('select')}
          validationMessage={
            getValues('name')
              ? (errors.name?.message as string)
              : 'This field is required'
          }
        >
          <Text className="mt-1">{selectedTenant?.name}</Text>
        </Field>
        {selectedTenant && (
          <>
            <Field label="First Name:" orientation="horizontal">
              <Text className="mt-1">{selectedTenant.firstName}</Text>
            </Field>
            <Field label="Last Name:" orientation="horizontal">
              <Text className="mt-1">{selectedTenant.lastName}</Text>
            </Field>
            <Field label="Email Id:" orientation="horizontal">
              <Text className="mt-1">{selectedTenant.emailId}</Text>
            </Field>
            <Field label="Contact:" orientation="horizontal">
              <Text className="mt-1">{selectedTenant.contact}</Text>
            </Field>
            <Field label="Address:" orientation="horizontal">
              <Text className="mt-1">{selectedTenant.address}</Text>
            </Field>
            <Text weight="semibold" className="mt-8">
              Packages
            </Text>
            <Field label="Selected Packages:" orientation="horizontal">
              <Text className="mt-1">
                {selectedTenant.packages.map((p) => p.package.name).join(', ')}
              </Text>
            </Field>
          </>
        )}
      </div>
    </Form>
  );
};

export default Finish;
