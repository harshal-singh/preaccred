/* eslint-disable jsx-a11y/anchor-is-valid */
import { Divider, Field, Link, Text } from '@fluentui/react-components';
import { selectedTabAtom } from 'atoms';
import { useSetAtom } from 'jotai';
import { Form, useFormContext } from 'react-hook-form';

const Finish = () => {
  const setSelectedTab = useSetAtom(selectedTabAtom);

  const {
    getValues,
    control,
    formState: { errors },
  } = useFormContext();

  const renderLink = (tabName: string) => {
    return <Link onClick={() => setSelectedTab(tabName)}>Edit</Link>;
  };

  return (
    <Form control={control} className="w-full overflow-y-scroll py-6">
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
        <Field
          label="College Name:"
          orientation="horizontal"
          hint={renderLink('details')}
          validationMessage={
            getValues('collegeName')
              ? (errors.collegeName?.message as string)
              : 'This field is required'
          }
        >
          <Text className="mt-1">{getValues('collegeName')}</Text>
        </Field>
        <Field
          label="Name:"
          orientation="horizontal"
          hint={renderLink('details')}
          validationMessage={
            getValues('name')
              ? (errors.name?.message as string)
              : 'This field is required'
          }
        >
          <Text className="mt-1">{getValues('name')}</Text>
        </Field>
        <Field
          label="Phone No:"
          orientation="horizontal"
          hint={renderLink('details')}
          validationMessage={
            getValues('phoneNo')
              ? (errors.phoneNo?.message as string)
              : 'This field is required'
          }
        >
          <Text className="mt-1">{getValues('phoneNo')}</Text>
        </Field>
        <Field
          label="Primary Email:"
          orientation="horizontal"
          hint={renderLink('details')}
          validationMessage={
            getValues('primaryEmailId')
              ? (errors.primaryEmailId?.message as string)
              : 'This field is required'
          }
        >
          <Text className="mt-1">{getValues('primaryEmailId')}</Text>
        </Field>
        <Field
          label="Secondary Email:"
          orientation="horizontal"
          hint={renderLink('details')}
          validationMessage={
            getValues('secondaryEmailId')
              ? (errors.secondaryEmailId?.message as string)
              : 'This field is required'
          }
        >
          <Text className="mt-1">{getValues('secondaryEmailId')}</Text>
        </Field>
      </div>
    </Form>
  );
};

export default Finish;
