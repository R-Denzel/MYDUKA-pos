export interface ProductVariant {
  id: string;
  name: string;
  price: number;
  stock: number;
}

export interface Product {
  id: string;
  name: string;
  barcode: string;
  category: string;
  basePrice: number;
  hasVariants: boolean;
  variants: ProductVariant[];
  totalStock: number;
  imageUrl?: string;
  createdAt: string;
}

export interface CartItem {
  productId: string;
  variantId?: string;
  name: string;
  variantName?: string;
  price: number;
  qty: number;
}

export interface Sale {
  id: string;
  items: CartItem[];
  total: number;
  paymentMethod: 'cash' | 'mobile_money' | 'card';
  timestamp: string;
}

export type PaymentMethod = 'cash' | 'mobile_money' | 'card';

export const CATEGORIES = [
  'Drinks',
  'Food',
  'Groceries',
  'Clothes',
  'Electronics',
  'Health',
  'Other',
] as const;
