import { toastDetailAtom } from 'atoms';
import { useSetAtom } from 'jotai';

const useToast = () => {
  const dispatchToast = useSetAtom(toastDetailAtom);
  return {
    dispatchToast,
  };
};

export default useToast;
