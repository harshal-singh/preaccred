import { Button, Divider, Image, Text } from '@fluentui/react-components';

import { useGoogleSignUp } from 'hooks/useSignUp';

import PreaccredLogo_164x30 from 'assets/preaccred-logo-164x30.png';

const SignUp = () => {
  const { handleGoogleSignUp } = useGoogleSignUp();

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
          Preaccred Sign Up
        </Text>
        <Button
          aria-label="Sign Up"
          appearance="primary"
          onClick={handleGoogleSignUp}
        >
          Sign Up
        </Button>
      </div>
    </div>
  );
};

export default SignUp;
