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
        <Text weight="semibold">Details</Text>
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
          label="Type:"
          orientation="horizontal"
          hint={renderLink('details')}
          validationMessage={
            getValues('type')
              ? (errors.type?.message as string)
              : 'This field is required'
          }
        >
          <Text className="mt-1">{getValues('type')}</Text>
        </Field>
        <Field
          label="Date Of Establishment:"
          orientation="horizontal"
          hint={renderLink('details')}
          validationMessage={
            getValues('dateOfEstablishment')
              ? (errors.dateOfEstablishment?.message as string)
              : 'This field is required'
          }
        >
          <Text className="mt-1">
            {getValues('dateOfEstablishment') &&
              new Date(
                getValues('dateOfEstablishment') as string,
              ).toLocaleString(undefined, {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
          </Text>
        </Field>
        <Field
          label="Website"
          orientation="horizontal"
          hint={renderLink('details')}
          validationMessage={
            getValues('website')
              ? (errors.website?.message as string)
              : 'This field is required'
          }
        >
          <Text className="mt-1">{getValues('website')}</Text>
        </Field>
        <Field
          label="Landmark:"
          orientation="horizontal"
          hint={renderLink('details')}
          validationMessage={
            getValues('landmark')
              ? (errors.landmark?.message as string)
              : 'This field is required'
          }
        >
          <Text className="mt-1">{getValues('landmark')}</Text>
        </Field>
        <Field
          label="City:"
          orientation="horizontal"
          hint={renderLink('details')}
          validationMessage={
            getValues('city')
              ? (errors.city?.message as string)
              : 'This field is required'
          }
        >
          <Text className="mt-1">{getValues('city')}</Text>
        </Field>
        <Field
          label="State:"
          orientation="horizontal"
          hint={renderLink('details')}
          validationMessage={
            getValues('state')
              ? (errors.state?.message as string)
              : 'This field is required'
          }
        >
          <Text className="mt-1">{getValues('state')}</Text>
        </Field>
        <Field
          label="Pin Code:"
          orientation="horizontal"
          hint={renderLink('details')}
          validationMessage={
            getValues('pin')
              ? (errors.pin?.message as string)
              : 'This field is required'
          }
        >
          <Text className="mt-1">{getValues('pin')}</Text>
        </Field>
        <Field
          label="Address:"
          orientation="horizontal"
          hint={renderLink('details')}
          validationMessage={
            getValues('address')
              ? (errors.address?.message as string)
              : 'This field is required'
          }
        >
          <Text className="mt-1">{getValues('address')}</Text>
        </Field>
        <Text weight="semibold" className="mt-8">
          Criteria&apos;s
        </Text>
        <Field
          label="Selected Criteria's:"
          orientation="horizontal"
          hint={renderLink('criterias')}
          validationMessage={
            getValues('criterias')
              ? (errors.criterias?.message as string)
              : 'This field is required'
          }
        >
          <Text className="mt-1">{getValues('criterias')}</Text>
        </Field>
      </div>
    </Form>
  );
};

export default Finish;
