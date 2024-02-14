import {
  Button,
  Divider,
  Field,
  Image,
  Input,
  Text,
} from '@fluentui/react-components';
import { isLoggedInAtom } from 'atoms';
import { useAtom } from 'jotai';
import { Controller, Form, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';

import PreaccredLogo_164x30 from 'assets/preaccred-logo-164x30.png';

const VITE_SUPERADMIN_PASSWORD = import.meta.env
  .VITE_SUPERADMIN_PASSWORD as string;

const rules = {
  password: {
    required: {
      value: true,
      message: 'This field is required',
    },
  },
};

const Login = () => {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useAtom(isLoggedInAtom);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isValid },
  } = useForm({
    mode: 'all',
    reValidateMode: 'onChange',
    defaultValues: {
      password: '',
    },
  });

  const onSubmit = ({ password }: { password: string }) => {
    const valid = password === VITE_SUPERADMIN_PASSWORD;
    if (!valid) {
      setError(
        'password',
        { message: 'Invalid password!' },
        { shouldFocus: true },
      );
      return;
    }

    setIsLoggedIn(true);
    navigate('/');
  };

  return (
    <div className="w-full min-h-screen grid place-items-center bg-tint40">
      <div className="bg-white border rounded-xl py-9 px-6 grid place-items-center shadow-lg shadow-tint30">
        <Image
          src={PreaccredLogo_164x30}
          alt="preaccred logo"
          width={164}
          height={30}
        />
        <Divider className="my-4" />
        <Text
          as="h4"
          className="shrink-0 text-shade10 mb-4"
          size={500}
          weight="bold"
        >
          Tenant Admin Login
        </Text>
        <Form control={control} className="flex flex-col gap-4">
          <Controller
            control={control}
            name="password"
            rules={rules.password}
            defaultValue=""
            render={({
              field: { value, disabled, name, ref, onChange, onBlur },
            }) => (
              <Field
                required
                label="Password"
                className="h-fit"
                validationState={errors.password && 'error'}
                validationMessage={errors.password?.message as string}
              >
                <Input
                  as="input"
                  type="password"
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

          <Button
            appearance="primary"
            disabled={!isValid}
            type="submit"
            onClick={handleSubmit(onSubmit)}
          >
            Login
          </Button>
        </Form>
      </div>
    </div>
  );
};

export default Login;
