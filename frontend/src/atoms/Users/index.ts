import { ModelTypes } from 'api/zeus';
import { atom } from 'jotai';

type User = Partial<ModelTypes['User']>;

export const selectedUserAtom = atom<User | null>(null);
export const isManageGroupsTabOpenAtom = atom<boolean>(false);
export const isManageUserDrawerOpenAtom = atom<boolean>(false);
export const showUpdateUserFormAtom = atom<boolean>(false);
