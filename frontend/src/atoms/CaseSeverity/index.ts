import { ModelTypes } from 'api/zeus';
import { atom } from 'jotai';

type CaseSeverity = Partial<ModelTypes['CaseSeverity']>;
export const selectedCaseSeverityAtom = atom<CaseSeverity | null>(null);
export const isAddCaseSeverityDrawerOpenAtom = atom<boolean>(false);
export const isUpdateCaseSeverityDrawerOpenAtom = atom<boolean>(false);
