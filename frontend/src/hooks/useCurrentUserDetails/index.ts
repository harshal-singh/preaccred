import { User, getAuth, onAuthStateChanged } from 'firebase/auth';
import { useState } from 'react';

const useCurrentUserDetails = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const auth = getAuth();

  onAuthStateChanged(auth, (user) => {
    if (user) {
      setCurrentUser(user);
    } else {
      setCurrentUser(null);
    }
  });

  console.log('🚀 ~ useCurrentUserDetails ~ currentUser:', currentUser);

  return {
    currentUser,
  };
};

export default useCurrentUserDetails;
