import { ModelTypes } from 'api/zeus';
import { atom } from 'jotai';

export const selectedProductTabAtom = atom<'detail' | 'finish'>('detail');

type Product = Partial<ModelTypes['Product']>;
export const selectedProductAtom = atom<Product | null>(null);
export const isAddProductDrawerOpenAtom = atom<boolean>(false);
export const isUpdateProductDrawerOpenAtom = atom<boolean>(false);

type ProductVersion = Partial<ModelTypes['ProductVersion']>;
export const selectedProductVersionAtom = atom<ProductVersion | null>(null);
export const isAddProductVersionDrawerOpenAtom = atom<boolean>(false);
export const isUpdateProductVersionDrawerOpenAtom = atom<boolean>(false);

type ProductCategory = Partial<ModelTypes['ProductCategory']>;
export const selectedProductCategoryAtom = atom<ProductCategory | null>(null);
export const isAddProductCategoryDrawerOpenAtom = atom<boolean>(false);
export const isUpdateProductCategoryDrawerOpenAtom = atom<boolean>(false);
