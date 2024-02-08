import { ModelTypes } from 'api/zeus';
import { atom } from 'jotai';

type IssueCategory = Partial<ModelTypes['IssueCategory']>;
export const selectedIssueCategoryAtom = atom<IssueCategory | null>(null);
export const isAddIssueCategoryDrawerOpenAtom = atom<boolean>(false);
export const isUpdateIssueCategoryDrawerOpenAtom = atom<boolean>(false);
