import { Field, Input, Textarea } from '@fluentui/react-components';
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
  descriptionRequired: {
    required: {
      value: true,
      message: 'This field is required',
    },
    minLength: {
      value: 15,
      message: 'Minimum length should be 15',
    },
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
const Description = ({
  control,
  errors,
}: {
  control: Control<FieldValues, unknown>;
  errors: FieldErrors<FieldValues>;
}) => {
  return (
    <Controller
      control={control}
      name="description"
      rules={rules.descriptionRequired}
      defaultValue=""
      render={({ field: { value, disabled, name, ref, onChange, onBlur } }) => (
        <Field
          required
          label="Description"
          className="col-span-full"
          validationState={errors.description && 'error'}
          validationMessage={errors.description?.message}
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
    <Form control={control} className="grid grid-cols-1 gap-6 py-4 h-fit">
      <Name control={control} errors={errors} />
      <Description control={control} errors={errors} />
    </Form>
  );
};

export default Body;
