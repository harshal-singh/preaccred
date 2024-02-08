import { ToastIntent } from '@fluentui/react-components';
import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

type ToastDetail = {
  intent: ToastIntent;
  title: string | JSX.Element;
  body: string | JSX.Element;
  footer?: string | JSX.Element;
  onDismiss?: () => void;
  timeout?: number;
};

export const isLoggedInAtom = atomWithStorage<boolean>('isLoggedIn', false);
export const isDeleteDrawerOpenAtom = atom<boolean>(false);
export const toastDetailAtom = atom<ToastDetail | null>(null);
