/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { isLoggedInAtom } from 'atoms';
import {
  createUserWithEmailAndPassword,
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  signInWithRedirect,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { useSetAtom } from 'jotai';
import { useCallback } from 'react';

type UserSignUpDetails = { fullName?: string; email: string; password: string };

export const useEmailAndPasswordSignUp = () => {
  const setIsLoggedIn = useSetAtom(isLoggedInAtom);

  const auth = getAuth();
  auth.useDeviceLanguage();

  const getSignUpWithEmailAndPasswordResult = useCallback(
    async (data: UserSignUpDetails) =>
      createUserWithEmailAndPassword(auth, data.email, data.password)
        .then((userCredential) => {
          // The signed-in user info.
          const user = userCredential.user;

          return {
            status: 'success',
            data: {
              user,
            },
          };
        })
        .catch((error) => {
          return {
            status: 'error',
            error,
          };
        }),
    [auth],
  );

  const handleSignUpWithEmailAndPassword = useCallback(
    async (data: UserSignUpDetails) => {
      await getSignUpWithEmailAndPasswordResult(data);

      return auth.currentUser
        ? updateProfile(auth.currentUser, {
            displayName: data.fullName,
          })
            .then(() => {
              setIsLoggedIn(true);

              return {
                status: 'success',
                data: {
                  code: 200,
                  message: 'Signed in successfully!',
                },
              };
            })
            .catch((error) => {
              return {
                status: 'error',
                error,
              };
            })
        : {
            status: 'error',
            error: {
              code: 500,
              message: 'Something went wrong!',
            },
          };
    },
    [auth.currentUser, getSignUpWithEmailAndPasswordResult, setIsLoggedIn],
  );

  return {
    handleSignUpWithEmailAndPassword,
  };
};

export const useGoogleSignUp = () => {
  const setIsLoggedIn = useSetAtom(isLoggedInAtom);

  const auth = getAuth();
  auth.useDeviceLanguage();

  const getSignUpWithGoogleResult = useCallback(
    async () =>
      getRedirectResult(auth)
        .then((result) => {
          if (result) {
            setIsLoggedIn(true);
            // This gives you a Google Access Token. You can use it to access Google APIs.
            const credential = GoogleAuthProvider.credentialFromResult(result);
            const token = credential?.accessToken;

            // The signed-in user info.
            const user = result.user;

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

export const useGoogleSignOut = () => {
  const setIsLoggedIn = useSetAtom(isLoggedInAtom);

  const auth = getAuth();
  auth.useDeviceLanguage();

  const getSignOutResult = useCallback(
    async () =>
      signOut(auth)
        .then(() => {
          setIsLoggedIn(false);

          return {
            status: 'success',
            data: {
              code: 200,
              message: 'Signed out successfully!',
            },
          };
        })
        .catch((error) => {
          return {
            status: 'error',
            error,
          };
        }),
    [auth, setIsLoggedIn],
  );

  const handleGoogleSignOut = useCallback(async () => {
    const data = await getSignOutResult();
    console.log('🚀 ~ handleGoogleSignOut ~ data:', data);
  }, [getSignOutResult]);

  return {
    handleGoogleSignOut,
  };
};
