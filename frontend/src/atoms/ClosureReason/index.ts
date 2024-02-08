import { ModelTypes } from 'api/zeus';
import { atom } from 'jotai';

type ClosureReason = Partial<ModelTypes['ClosureReason']>;
export const selectedClosureReasonAtom = atom<ClosureReason | null>(null);
export const isAddClosureReasonDrawerOpenAtom = atom<boolean>(false);
export const isUpdateClosureReasonDrawerOpenAtom = atom<boolean>(false);
