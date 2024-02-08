import { ModelTypes } from 'api/zeus';
import { atom } from 'jotai';

type CustomRole = Partial<ModelTypes['CustomRole']>;
export const selectedCustomRoleAtom = atom<CustomRole | null>(null);
export const isAddCustomRoleDrawerOpenAtom = atom<boolean>(false);
export const isUpdateCustomRoleDrawerOpenAtom = atom<boolean>(false);
