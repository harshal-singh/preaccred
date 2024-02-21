import {
  Button,
  Divider,
  Field,
  Image,
  Input,
  Text,
} from '@fluentui/react-components';
import { Controller, Form, useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';

import { useEmailAndPasswordSignUp, useGoogleSignUp } from 'hooks/useSignUp';

import ValidationRules from 'helpers/rules';

const EmailAndPasswordSignInForm = () => {
  const { handleSignUpWithEmailAndPassword } = useEmailAndPasswordSignUp();

  const {
    control,
    handleSubmit,
    formState: { errors, isValid, isSubmitting },
  } = useForm({
    mode: 'all',
    reValidateMode: 'onChange',
    defaultValues: {
      email: '',
      password: '',
    },
  });

  return (
    <Form control={control} className="flex flex-col gap-4">
      <Controller
        control={control}
        name="email"
        rules={ValidationRules.emailRequired}
        defaultValue=""
        render={({
          field: { value, disabled, name, ref, onChange, onBlur },
        }) => (
          <Field
            required
            label="Email"
            className="h-fit"
            validationState={errors.email && 'error'}
            validationMessage={errors.email?.message}
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
        name="password"
        rules={ValidationRules.passwordRequired}
        defaultValue=""
        render={({
          field: { value, disabled, name, ref, onChange, onBlur },
        }) => (
          <Field
            required
            label="Password"
            className="h-fit"
            validationState={errors.password && 'error'}
            validationMessage={errors.password?.message}
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
        aria-label="Sign In"
        appearance="primary"
        className="w-full !mt-3"
        onClick={handleSubmit(handleSignUpWithEmailAndPassword)}
        disabled={!isValid || isSubmitting}
      >
        Sign In
      </Button>
    </Form>
  );
};

const GoogleSignInButton = () => {
  const { handleGoogleSignUp } = useGoogleSignUp();

  return (
    <Button
      aria-label="Sign Up"
      appearance="secondary"
      className="w-full"
      onClick={handleGoogleSignUp}
      icon={
        <span className="w-4 h-4">
          <svg
            height="100%"
            viewBox="0 0 20 20"
            width="100%"
            preserveAspectRatio="xMidYMid meet"
            focusable="false"
          >
            <path
              d="M19.6 10.23c0-.82-.1-1.42-.25-2.05H10v3.72h5.5c-.15.96-.74 2.31-2.04 3.22v2.45h3.16c1.89-1.73 2.98-4.3 2.98-7.34z"
              fill="#4285F4"
            />
            <path
              d="M13.46 15.13c-.83.59-1.96 1-3.46 1-2.64 0-4.88-1.74-5.68-4.15H1.07v2.52C2.72 17.75 6.09 20 10 20c2.7 0 4.96-.89 6.62-2.42l-3.16-2.45z"
              fill="#34A853"
            />
            <path
              d="M3.99 10c0-.69.12-1.35.32-1.97V5.51H1.07A9.973 9.973 0 000 10c0 1.61.39 3.14 1.07 4.49l3.24-2.52c-.2-.62-.32-1.28-.32-1.97z"
              fill="#FBBC05"
            />
            <path
              d="M10 3.88c1.88 0 3.13.81 3.85 1.48l2.84-2.76C14.96.99 12.7 0 10 0 6.09 0 2.72 2.25 1.07 5.51l3.24 2.52C5.12 5.62 7.36 3.88 10 3.88z"
              fill="#EA4335"
            />
          </svg>
        </span>
      }
    >
      Sign in with Google
    </Button>
  );
};

const SignIn = () => {
  return (
    <div className="w-full min-h-screen grid place-items-center bg-tint40">
      <div className="flex flex-col gap-6 border rounded-xl p-6 w-80 bg-white">
        <Image
          src="/images/preaccred-logo-180px.png"
          alt="preaccred logo"
          width={180}
          className="place-self-center"
        />
        <Divider />
        <Text as="h4" size={500} weight="bold">
          Sign In
        </Text>
        <EmailAndPasswordSignInForm />
        <Divider>OR</Divider>
        <GoogleSignInButton />
        <Link to="sign/up">New user? please sign up.</Link>
      </div>
    </div>
  );
};

export default SignIn;
