/* eslint-disable import/prefer-default-export */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable import/no-extraneous-dependencies */
import { isLoggedInAtom } from 'atoms';
import {
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  signInWithRedirect,
} from 'firebase/auth';
import { useSetAtom } from 'jotai';
import { useCallback } from 'react';

export const useGoogleSignUp = () => {
  const setIsLoggedIn = useSetAtom(isLoggedInAtom);

  const auth = getAuth();
  auth.useDeviceLanguage();

  const getSignUpWithGoogleResult = useCallback(
    async () =>
      getRedirectResult(auth)
        .then((result) => {
          if (result) {
            // This gives you a Google Access Token. You can use it to access Google APIs.
            const credential = GoogleAuthProvider.credentialFromResult(result);
            const token = credential?.accessToken;

            // The signed-in user info.
            const user = result.user;
            // IdP data available using getAdditionalUserInfo(result)
            // ...
            setIsLoggedIn(true);
            return {
              status: 'success',
              data: {
                user,
                credentialAccessToken: token,
              },
            };
          }

          return {
            status: 'error',
            error: {
              code: 500,
              message: 'Something went wrong!',
            },
          };
        })
        .catch((error) => {
          // Handle Errors here.
          const errorCode = error.code;
          const errorMessage = error.message;
          // The email of the user's account used.
          const email = error.customData.email;
          // The AuthCredential type that was used.
          const credential = GoogleAuthProvider.credentialFromError(error);
          // ...
          return {
            status: 'error',
            error,
          };
        }),
    [auth, setIsLoggedIn],
  );

  const handleGoogleSignUp = useCallback(async () => {
    const provider = new GoogleAuthProvider();

    await signInWithRedirect(auth, provider);

    const data = await getSignUpWithGoogleResult();
    console.log('🚀 ~ handleGoogleSignUp ~ data:', data);
  }, [auth, getSignUpWithGoogleResult]);

  return {
    handleGoogleSignUp,
  };
};
