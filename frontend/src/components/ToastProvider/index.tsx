import { Toaster } from '@fluentui/react-components';
import { ReactNode } from 'react';

import useToastProvider from 'hooks/useToastProvider';

const ToastProvider = ({ children }: { children: ReactNode }) => {
  const { toasterId } = useToastProvider();

  return (
    <>
      {children}
      <Toaster toasterId={toasterId} position="bottom" />
    </>
  );
};

export default ToastProvider;
