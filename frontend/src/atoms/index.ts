import { ToastIntent } from '@fluentui/react-components';
import { ModelTypes } from 'api/zeus';
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
export const toastDetailAtom = atom<ToastDetail | null>(null);

export const isAddDrawerOpenAtom = atom<boolean>(false);
export const isUpdateDrawerOpenAtom = atom<boolean>(false);
export const isDeleteDrawerOpenAtom = atom<boolean>(false);

export const selectedInstituteAtom = atom<Partial<
  ModelTypes['Institute']
> | null>(null);
