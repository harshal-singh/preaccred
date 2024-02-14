/* eslint-disable jsx-a11y/anchor-is-valid */
import { Divider, Field, Link, Text } from '@fluentui/react-components';
import { ModelTypes } from 'api/zeus';
import { Dispatch } from 'react';
import { Form, useFormContext } from 'react-hook-form';

type Props = {
  setSelectedTabValue: Dispatch<unknown>;
  listOfPackages: ModelTypes['Package'][] | [];
};

const Finish = ({ setSelectedTabValue, listOfPackages }: Props) => {
  const {
    getValues,
    control,
    formState: { errors },
  } = useFormContext();

  const renderLink = (tabName: string) => {
    return <Link onClick={() => setSelectedTabValue(tabName)}>Edit</Link>;
  };

  const selectedPackages = JSON.parse(
    getValues('packages') as string,
  ) as string[];
  const selectedPackagesName = selectedPackages
    .map((packageId) => listOfPackages.find((p) => p.id === packageId))
    .map((p) => p?.name)
    .join(', ');

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
        <Text weight="semibold">Basic</Text>
        <Field
          label="Tenant Name:"
          orientation="horizontal"
          hint={renderLink('basic')}
          validationMessage={
            getValues('name')
              ? (errors.name?.message as string)
              : 'This field is required'
          }
        >
          <Text className="mt-1">{getValues('name')}</Text>
        </Field>
        <Field
          label="First Name:"
          orientation="horizontal"
          hint={renderLink('basic')}
          validationMessage={
            getValues('firstName')
              ? (errors.firstName?.message as string)
              : 'This field is required'
          }
        >
          <Text className="mt-1">{getValues('firstName')}</Text>
        </Field>
        <Field
          label="Last Name:"
          orientation="horizontal"
          hint={renderLink('basic')}
          validationMessage={
            getValues('lastName')
              ? (errors.lastName?.message as string)
              : 'This field is required'
          }
        >
          <Text className="mt-1">{getValues('lastName')}</Text>
        </Field>
        <Field
          label="Email Id:"
          orientation="horizontal"
          hint={renderLink('basic')}
          validationMessage={
            getValues('emailId')
              ? (errors.emailId?.message as string)
              : 'This field is required'
          }
        >
          <Text className="mt-1">{getValues('emailId')}</Text>
        </Field>
        <Field
          label="Contact:"
          orientation="horizontal"
          hint={renderLink('basic')}
          validationMessage={
            getValues('contact')
              ? (errors.contact?.message as string)
              : 'This field is required'
          }
        >
          <Text className="mt-1">{getValues('contact')}</Text>
        </Field>
        <Field
          label="Address:"
          orientation="horizontal"
          hint={renderLink('basic')}
          validationMessage={
            getValues('address')
              ? (errors.address?.message as string)
              : 'This field is required'
          }
        >
          <Text className="mt-1">{getValues('address')}</Text>
        </Field>

        <Text weight="semibold" className="mt-8">
          Packages
        </Text>
        <Field
          label="Selected Packages:"
          orientation="horizontal"
          hint={renderLink('packages')}
          validationMessage={
            (JSON.parse(getValues('packages') as string) as string[]).length > 0
              ? (errors.packages?.message as string)
              : 'This field is required'
          }
        >
          <Text className="mt-1">{selectedPackagesName}</Text>
        </Field>
      </div>
    </Form>
  );
};

export default Finish;
