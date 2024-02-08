import {
  Toast,
  ToastBody,
  ToastFooter,
  ToastIntent,
  ToastTitle,
  useId,
  useToastController,
} from '@fluentui/react-components';
import { toastDetailAtom } from 'atoms';
import { useAtomValue } from 'jotai';
import { useCallback, useEffect } from 'react';

const useToastProvider = () => {
  const toastDetail = useAtomValue(toastDetailAtom);
  const toasterId = useId('AppToastProvider');
  const { dispatchToast: dispatch } = useToastController(toasterId);

  const dispatchToast = useCallback(
    ({
      intent,
      title,
      body,
      footer,
      onDismiss,
      timeout = 3000,
    }: {
      intent: ToastIntent;
      title: string | JSX.Element;
      body: string | JSX.Element;
      footer?: string | JSX.Element;
      onDismiss?: () => void;
      timeout?: number;
    }) =>
      dispatch(
        <Toast>
          <ToastTitle>{title}</ToastTitle>
          <ToastBody className="!leading-4">{body}</ToastBody>
          <ToastFooter>{footer}</ToastFooter>
        </Toast>,
        {
          intent,
          timeout,
          onStatusChange(_, data) {
            if (data.status === 'dismissed' && onDismiss) {
              onDismiss();
            }
          },
          pauseOnHover: true,
        },
      ),
    [dispatch],
  );

  useEffect(() => {
    if (toastDetail) {
      dispatchToast(toastDetail);
    }
  }, [dispatchToast, toastDetail]);

  return {
    toasterId,
  };
};

export default useToastProvider;
