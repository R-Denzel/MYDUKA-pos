import { CartItem } from '@/types/pos';

export interface VatSettings {
  enabled: boolean;
  rate: number;
  inclusive: boolean;
}

export interface SaleTotals {
  subtotal: number;
  discountTotal: number;
  vatAmount: number;
  total: number;
}

export function getBillableItems(items: CartItem[], hasPremium: boolean): CartItem[] {
  if (hasPremium) return items;
  return items.map((item) => {
    const billableItem = { ...item };
    delete billableItem.discountType;
    delete billableItem.discountValue;
    return billableItem;
  });
}

export function getItemDiscount(item: CartItem): number {
  const price = Math.max(0, item.price || 0);
  const value = Math.max(0, item.discountValue || 0);
  const discountPerItem =
    item.discountType === 'percentage' ? (price * Math.min(value, 100)) / 100 : value;

  return Math.min(price, discountPerItem) * Math.max(0, item.qty || 0);
}

export function calculateSaleTotals(items: CartItem[], vat: VatSettings): SaleTotals {
  const grossSubtotal = items.reduce(
    (sum, item) => sum + Math.max(0, item.price || 0) * Math.max(0, item.qty || 0),
    0,
  );
  const discountTotal = items.reduce((sum, item) => sum + getItemDiscount(item), 0);
  const subtotal = Math.max(0, grossSubtotal - discountTotal);
  const rate = vat.enabled ? Math.max(0, vat.rate) / 100 : 0;
  const vatAmount = vat.inclusive && rate > 0
    ? subtotal - subtotal / (1 + rate)
    : subtotal * rate;

  return {
    subtotal,
    discountTotal,
    vatAmount,
    total: vat.enabled && !vat.inclusive ? subtotal + vatAmount : subtotal,
  };
}
