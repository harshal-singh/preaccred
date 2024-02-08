import { ModelTypes } from 'api/zeus';
import { atom } from 'jotai';

type Industry = Partial<ModelTypes['Industry']>;
export const selectedIndustryAtom = atom<Industry | null>(null);
export const isAddIndustryDrawerOpenAtom = atom<boolean>(false);
export const isUpdateIndustryDrawerOpenAtom = atom<boolean>(false);
