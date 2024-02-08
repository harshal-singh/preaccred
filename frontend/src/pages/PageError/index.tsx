/* eslint-disable react/forbid-dom-props */
import {
  Button,
  MessageBar,
  MessageBarBody,
  MessageBarIntent,
  MessageBarTitle,
  Text,
} from '@fluentui/react-components';
import { useCallback, useEffect, useState } from 'react';

const useNetworkError = () => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isNetworkChange, setIsNetworkChange] = useState<boolean>(false);

  const reloadPage = useCallback(() => {
    window.location.reload();
  }, []);

  useEffect(() => {
    const onlineHandler = () => {
      setIsOnline(true);
      setIsNetworkChange(true);
    };
    const offlineHandler = () => {
      setIsOnline(false);
      setIsNetworkChange(true);
    };

    window.addEventListener('online', onlineHandler);
    window.addEventListener('offline', offlineHandler);

    return () => {
      window.removeEventListener('online', onlineHandler);
      window.removeEventListener('offline', offlineHandler);
    };
  }, [isOnline]);

  useEffect(() => {
    if (isNetworkChange && isOnline) {
      reloadPage();
    }
  }, [isOnline, isNetworkChange, reloadPage]);

  const status: {
    intent: MessageBarIntent;
    title: string;
    description: string;
  } | null = isOnline
    ? isNetworkChange
      ? {
          intent: 'info',
          title: 'Verifying Internet Connection...',
          description:
            'Pleas wait while the system completes this verification process.',
        }
      : null
    : {
        intent: 'warning',
        title: 'No Internet Connection',
        description: 'Please Check Your Internet Connection.',
      };

  return {
    reloadPage,
    status,
  };
};

const PageError = ({ error }: { error: Error }) => {
  const { reloadPage, status } = useNetworkError();

  if (status) {
    return (
      <div className="px-4 pt-9">
        <MessageBar
          key={status.intent}
          layout="multiline"
          intent={status.intent}
        >
          <MessageBarBody className="pb-4">
            <MessageBarTitle>{status.title}</MessageBarTitle>
            <div className="mt-2 mb-4">
              <Text className="font-sans">{status.description}</Text>
            </div>
            <Button size="small" onClick={reloadPage}>
              Reload Page
            </Button>
          </MessageBarBody>
        </MessageBar>
      </div>
    );
  }

  return (
    <div className="px-4 pt-9">
      <MessageBar key="error" layout="multiline" intent="error">
        <MessageBarBody className="pb-4">
          <MessageBarTitle>{error.message}</MessageBarTitle>
          <div className="mt-2 mb-4">
            <pre className="font-sans break-all" style={{ textWrap: 'wrap' }}>
              {error.stack}
            </pre>
          </div>
          <Button size="small" onClick={reloadPage}>
            Reload Page
          </Button>
        </MessageBarBody>
      </MessageBar>
    </div>
  );
};

export default PageError;
